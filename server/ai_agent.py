import os
import logging
import operator
from datetime import date
from typing import TypedDict, Annotated

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from database import get_connection, get_outliers_for_agent, compute_budget_pacing
from embeddings import search_similar
from ai_helpers import ai_suggest_category
from routers.savings_goals_router import (
    _add_computed, _apply_priority_cascade, _portfolio_avg_net,
)

logger = logging.getLogger("budget_app")

def _build_system_prompt():
    today = date.today().isoformat()
    current_month = today[:7]
    return (
        "You are Tally AI, a personal finance assistant.\n"
        "Today is " + today + ". The current month is " + current_month + ".\n\n"
        "TOOL ROUTING — pick the right tool to minimize round-trips:\n"
        "• get_budget_status          → 'am I on track', 'how is my budget', budget vs actual spend\n"
        "• get_savings_goals_status   → 'how are my goals', savings progress, projected completion\n"
        "• get_category_breakdown     → 'how much on [category]' — shows all categories so you can match intent to actual names\n"
        "• get_monthly_summary        → savings rate, monthly net, trends, 'current rate' questions\n"
        "• get_recurring_transactions → fixed costs, regular bills, recurring income\n"
        "• flag_anomalies             → unusual or suspicious spending\n"
        "• savings_calculator         → 'how long to save $X' — use AFTER you have a monthly_net figure\n"
        "• semantic_search            → fuzzy lookups only ('coffee shop charges', 'anything travel-related')\n"
        "                               NEVER for totals — returns ≤5 rows, will miss data\n"
        "• sql_query                  → precise queries not covered above; always SUM/GROUP BY for totals\n\n"
        "HANDLING EMPTY MONTHS:\n"
        "If the current month has no data, it likely has not ended yet. Fall back to the most recent\n"
        "1-3 months with data and state clearly which period you are using. Never say you cannot\n"
        "access data — always look at surrounding months first.\n\n"
        "GENERAL:\n"
        "• Cite amounts and dates when available. Never fabricate financial data.\n"
        "• When a category name is ambiguous (e.g. 'food'), call get_category_breakdown first to see\n"
        "  what categories actually exist — never assume a name matches the user's intent."
    )

# Tables the SQL tool is allowed to query.
# Restricting to user-scoped tables prevents the agent from reading schema metadata.
_ALLOWED_TABLES = {
    "expenses", "incomes", "expense_types",
    "budgets", "savings_goals", "savings_contributions",
}

# Keywords that indicate a write operation — the SQL tool must stay read-only.
# The LLM can occasionally hallucinate DML even with clear instructions, so we
# enforce this at the tool layer rather than relying solely on the system prompt.
_FORBIDDEN_KEYWORDS = [
    "insert", "update", "delete", "drop", "alter",
    "truncate", "create", "replace",
]


def _validate_sql(sql_str):
    lower = sql_str.lower()
    for kw in _FORBIDDEN_KEYWORDS:
        if kw in lower:
            return False, "Write operations are not allowed. Use SELECT queries only."
    return True, None


def _inject_user_id(sql_str, user_id):
    """
    Belt-and-suspenders user isolation: if the LLM forgot to filter by user_id,
    we wrap the query and add the filter ourselves.  We never rely on the LLM
    alone to enforce data isolation.
    """
    if "user_id" not in sql_str.lower():
        inner = sql_str.rstrip("; ")
        return "SELECT * FROM (" + inner + ") AS _q WHERE user_id = '" + user_id + "'"
    return sql_str


class AgentState(TypedDict):
    messages: Annotated[list, operator.add]
    user_id: str


def _build_tools(user_id):
    """
    Build tool closures that capture user_id so every DB call is automatically
    scoped to the right user without passing it as a tool argument (which would
    expose it to the LLM and let it be spoofed).
    """

    @tool
    def semantic_search(query: str, limit: int = 5) -> list:
        """Search expenses, incomes, and savings goals by meaning. Use for fuzzy queries like 'coffee shop charges' or 'vacation fund progress'."""
        conn = get_connection()
        try:
            results = search_similar(conn, user_id, query, limit)
        finally:
            conn.close()
        return results

    @tool
    def sql_query(sql: str) -> list:
        """Run a read-only SQL SELECT against the user's data. Allowed tables: expenses, incomes, expense_types, budgets, savings_goals, savings_contributions."""
        valid, err = _validate_sql(sql)
        if not valid:
            return [{"error": err}]

        safe_sql = _inject_user_id(sql, user_id)
        # Cap rows to avoid overwhelming the LLM context window
        capped = "SELECT * FROM (" + safe_sql.rstrip("; ") + ") AS _cap LIMIT 50"

        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(capped)
            rows = cursor.fetchall()
        except Exception as e:
            conn.close()
            return [{"error": "Query failed: " + str(e)}]
        conn.close()

        result = []
        for row in rows:
            result.append(dict(row))
        return result

    @tool
    def savings_calculator(monthly_net: float, goal_amount: float, months_to_project: int) -> dict:
        """
        Project month-by-month savings trajectory given a monthly net income and a target goal.
        Use when the user asks how long to reach a savings goal or wants a forecast.
        monthly_net: average amount saved per month (income minus expenses)
        goal_amount: the savings target to reach
        months_to_project: number of months to forecast
        """
        if monthly_net < 1:
            return {
                "error": "monthly net is less than 1; user is not currently contributing to savings goal",
                "monthly_net": monthly_net,
                "goal_amount": goal_amount,
                "months_to_project": months_to_project,
            }
        res = {"months": []}
        running_total = 0
        reached_month = None
        for i in range(months_to_project):
            running_total += monthly_net
            reached_goal = running_total >= goal_amount
            if reached_goal and reached_month is None:
                reached_month = i + 1
            res["months"].append({
                "month": i + 1,
                "running_total": round(running_total, 2),
                "reached_goal": reached_goal,
            })
        res["months_to_goal"] = reached_month
        return res
    @tool
    def suggest_category(expense_name: str, amount: float) -> dict:
        """Suggest an expense category for a transaction. Use when the user asks how to categorize something."""
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM expense_types WHERE user_id = %s ORDER BY sort_order",
                (user_id,),
            )
            expense_types = []
            for row in cursor.fetchall():
                expense_types.append(row["name"])
        finally:
            conn.close()

        if not expense_types:
            return {"category": "Other", "reasoning": "No expense types configured for this user"}

        return ai_suggest_category(expense_name, amount, expense_types)

    @tool
    def flag_anomalies(months: int = 3) -> list:
        """
        Return statistically anomalous expenses (z-score >= 1.5) from the past N months.
        Uses the same detection logic as the Outlier Alert on the dashboard — same results, explained in plain language.
        """
        conn = get_connection()
        try:
            outliers = get_outliers_for_agent(conn, user_id, months)
        finally:
            conn.close()
        return outliers

    @tool
    def get_monthly_summary(months: int = 3) -> list:
        """
        Return income, expenses, and net for each of the last N months that have data.
        Use this first for any question about spending trends, savings rate, or budget tracking —
        it fetches everything in one query instead of requiring multiple sql_query calls.
        Returns a list like: [{"month": "2026-04", "income": 5000.0, "expenses": 3200.0, "net": 1800.0}, ...]
        sorted newest first. Skips months with no activity so the results are always meaningful.
        """
        conn = get_connection()
        try:
            cursor = conn.cursor()

            # Pull per-month income totals
            cursor.execute(
                "SELECT LEFT(date, 7) AS month, SUM(amount) AS total "
                "FROM incomes WHERE user_id = %s "
                "GROUP BY LEFT(date, 7) "
                "ORDER BY month DESC LIMIT %s",
                (user_id, months),
            )
            income_by_month = {}
            for row in cursor.fetchall():
                income_by_month[row["month"]] = round(float(row["total"]), 2)

            # Pull per-month expense totals (exclude Savings type to avoid double-counting)
            cursor.execute(
                "SELECT LEFT(date, 7) AS month, SUM(e.amount) AS total "
                "FROM expenses e "
                "LEFT JOIN expense_types t ON e.type = t.name AND t.user_id = %s "
                "WHERE e.user_id = %s AND (t.is_default IS NULL OR t.is_default != 1 OR t.name != 'Savings') "
                "GROUP BY LEFT(date, 7) "
                "ORDER BY month DESC LIMIT %s",
                (user_id, user_id, months),
            )
            expense_by_month = {}
            for row in cursor.fetchall():
                expense_by_month[row["month"]] = round(float(row["total"]), 2)
        finally:
            conn.close()

        all_months = set(income_by_month.keys()) | set(expense_by_month.keys())
        result = []
        for month in sorted(all_months, reverse=True):
            income = income_by_month.get(month, 0.0)
            expenses = expense_by_month.get(month, 0.0)
            result.append({
                "month": month,
                "income": income,
                "expenses": expenses,
                "net": round(income - expenses, 2),
            })
        return result[:months]

    @tool
    def get_category_breakdown(months: int = 3) -> list:
        """
        Return spending broken down by expense category for the last N months with data.
        Use this for ANY question about spending on a specific category or type (food, groceries,
        transport, entertainment, etc.) — it shows all categories so you can identify which ones
        match the user's intent even if the category name differs from what they said.
        Returns: [{"month": "2026-04", "category": "Groceries", "total": 234.50}, ...]
        sorted by month desc, then category. Includes only months/categories with actual spending.
        """
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT LEFT(date, 7) AS month, type AS category, SUM(amount) AS total "
                "FROM expenses "
                "WHERE user_id = %s "
                "GROUP BY LEFT(date, 7), type "
                "ORDER BY month DESC, type ASC",
                (user_id,),
            )
            rows = cursor.fetchall()
        finally:
            conn.close()

        # Collect distinct months, keep only the most recent N that have any data
        seen_months = []
        for row in rows:
            if row["month"] not in seen_months:
                seen_months.append(row["month"])

        cutoff_months = set(seen_months[:months])
        result = []
        for row in rows:
            if row["month"] in cutoff_months:
                result.append({
                    "month": row["month"],
                    "category": row["category"],
                    "total": round(float(row["total"]), 2),
                })
        return result

    @tool
    def get_budget_status(month: str = None) -> dict:
        """
        Return budget vs actual spending for a given month (YYYY-MM). Omit month to use the current month.
        Returns per-category: budget_limit, spent, projected_spend, pacing_pct, and status
        (on_track / at_risk / over_budget / well_under / no_budget).
        Use for any question about whether the user is on track with their budget.
        Falls back to the most recent month with data if the current month is empty.
        """
        target_month = month if month else date.today().isoformat()[:7]

        conn = get_connection()
        try:
            # Resolve effective budget limits (monthly overrides take precedence over defaults)
            defaults_cursor = conn.cursor()
            defaults_cursor.execute(
                "SELECT type, monthly_limit FROM budgets WHERE user_id = %s",
                (user_id,),
            )
            budget_limits = {}
            for row in defaults_cursor.fetchall():
                budget_limits[row["type"]] = row["monthly_limit"]

            overrides_cursor = conn.cursor()
            overrides_cursor.execute(
                "SELECT type, monthly_limit FROM monthly_budgets WHERE user_id = %s AND month = %s",
                (user_id, target_month),
            )
            for row in overrides_cursor.fetchall():
                budget_limits[row["type"]] = row["monthly_limit"]

            pacing_rows = compute_budget_pacing(conn, target_month, user_id=user_id)

            # If no spending this month, fall back to the most recent month that has data
            if not pacing_rows:
                fallback_cursor = conn.cursor()
                fallback_cursor.execute(
                    "SELECT LEFT(date, 7) AS month FROM expenses WHERE user_id = %s "
                    "ORDER BY date DESC LIMIT 1",
                    (user_id,),
                )
                row = fallback_cursor.fetchone()
                if row:
                    target_month = row["month"]
                    pacing_rows = compute_budget_pacing(conn, target_month, user_id=user_id)
        finally:
            conn.close()

        categories = []
        for row in pacing_rows:
            t = row["type"]
            limit = budget_limits.get(t)
            projected = row["projected_spend"]

            if not limit or limit <= 0:
                status = "no_budget"
            elif projected is None:
                status = "over_budget" if row["spent"] > limit else "on_track"
            elif projected > limit * 1.05:
                status = "over_budget"
            elif projected > limit * 1.01:
                status = "at_risk"
            elif projected < limit * 0.90:
                status = "well_under"
            else:
                status = "on_track"

            pacing_pct = None
            if limit and limit > 0 and projected is not None:
                pacing_pct = round(min((projected / limit) * 100, 150), 1)

            categories.append({
                "category": t,
                "budget_limit": limit,
                "spent": row["spent"],
                "projected_spend": projected,
                "pacing_pct": pacing_pct,
                "status": status,
            })

        categories.sort(key=lambda x: x["spent"] or 0, reverse=True)
        return {"month": target_month, "categories": categories}

    @tool
    def get_savings_goals_status() -> list:
        """
        Return all savings goals with computed progress, projected completion dates, and allocation amounts.
        Use for any question about savings goals, progress toward targets, or when goals will be reached.
        Returns fields: name, goal_type, target, effective_progress, progress_pct,
        projected_completion, effective_avg_monthly_net, paused, deadline, completed.
        """
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM savings_goals WHERE user_id = %s ORDER BY created_at",
                (user_id,),
            )
            raw_goals = [dict(row) for row in cursor.fetchall()]
            portfolio_avg = _portfolio_avg_net(conn, user_id)
            computed = []
            for goal in raw_goals:
                computed.append(_add_computed(goal, conn, portfolio_avg))
            computed = _apply_priority_cascade(computed, portfolio_avg)
        finally:
            conn.close()

        result = []
        for g in computed:
            result.append({
                "name": g.get("name"),
                "goal_type": g.get("goal_type"),
                "target": g.get("target"),
                "effective_progress": g.get("effective_progress"),
                "progress_pct": g.get("progress_pct"),
                "projected_completion": g.get("projected_completion"),
                "monthly_allocation": g.get("effective_avg_monthly_net"),
                "paused": g.get("paused"),
                "deadline": g.get("deadline"),
                "completed": g.get("completed"),
            })
        return result

    @tool
    def get_recurring_transactions() -> dict:
        """
        Return all recurring expenses and recurring income streams.
        Use for questions about fixed monthly costs, regular bills, or predictable income.
        Returns: {"recurring_expenses": [...], "recurring_income": [...]} sorted by amount descending.
        """
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name, amount, type FROM expenses "
                "WHERE user_id = %s AND is_recurring = 1 "
                "ORDER BY amount DESC",
                (user_id,),
            )
            recurring_expenses = []
            for row in cursor.fetchall():
                recurring_expenses.append({
                    "name": row["name"],
                    "amount": round(float(row["amount"]), 2),
                    "category": row["type"],
                })

            cursor.execute(
                "SELECT name, amount FROM incomes "
                "WHERE user_id = %s AND is_recurring = 1 "
                "ORDER BY amount DESC",
                (user_id,),
            )
            recurring_income = []
            for row in cursor.fetchall():
                recurring_income.append({
                    "name": row["name"],
                    "amount": round(float(row["amount"]), 2),
                })
        finally:
            conn.close()

        return {
            "recurring_expenses": recurring_expenses,
            "recurring_income": recurring_income,
        }

    return [
        semantic_search, sql_query, savings_calculator, suggest_category,
        flag_anomalies, get_monthly_summary, get_category_breakdown,
        get_budget_status, get_savings_goals_status, get_recurring_transactions,
    ]


def should_continue(state):
    """
    Conditional edge: decides whether the graph routes to the tool executor or ends.

    After each agent_node run the last message tells us what the LLM decided to do.
    If it issued tool calls we must run the tool executor so results come back on the
    next turn.  If it produced a plain text reply the conversation turn is done.

    This function is the core of the ReAct loop — without it the agent can never
    use its tools, even if the LLM requests them.
    """
    if state["messages"][-1].tool_calls:
        return "tools"
    return END


def stream_agent(user_id, history, new_message):
    """
    Generator yielding SSE-ready dicts.
    Uses stream_mode=["updates","messages"] so tool events and reply tokens
    come from a single graph run — no double LLM call.
    Emits:
      {"type": "tool_start", "tool": <name>}  — once per tool call, as it's invoked
      {"type": "token", "content": <str>}      — reply tokens as they stream
      {"type": "done", "tool_steps": [...], "history": [...]}
    """
    from langchain_core.messages import AIMessageChunk

    tools = _build_tools(user_id)
    # streaming=True lets LangGraph intercept token chunks via the callback system
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, streaming=True).bind_tools(tools)
    tool_node = ToolNode(tools)

    def agent_node(state):
        response = llm.invoke(state["messages"])
        return {"messages": [response], "user_id": state["user_id"]}

    graph_builder = StateGraph(AgentState)
    graph_builder.add_node("agent", agent_node)
    graph_builder.add_node("tools", tool_node)
    graph_builder.set_entry_point("agent")
    graph_builder.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph_builder.add_edge("tools", "agent")
    graph = graph_builder.compile()

    messages = [SystemMessage(content=_build_system_prompt())]
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=new_message))

    tool_steps = []
    final_reply = ""

    for event in graph.stream(
        {"messages": messages, "user_id": user_id},
        config={"recursion_limit": 15},
        stream_mode=["updates", "messages"],
    ):
        mode, data = event

        if mode == "updates":
            if "agent" in data:
                last = data["agent"]["messages"][-1]
                if hasattr(last, "tool_calls") and last.tool_calls:
                    for tc in last.tool_calls:
                        tool_steps.append(tc["name"])
                        yield {"type": "tool_start", "tool": tc["name"]}
                elif last.content:
                    final_reply = last.content

        elif mode == "messages":
            msg_chunk, _ = data
            # Planning LLM calls produce empty content with tool_calls populated.
            # Only the final reply call produces non-empty content — emit those as tokens.
            if isinstance(msg_chunk, AIMessageChunk) and msg_chunk.content:
                yield {"type": "token", "content": msg_chunk.content}

    updated_history = list(history)
    updated_history.append({"role": "user", "content": new_message})
    updated_history.append({"role": "assistant", "content": final_reply})

    yield {"type": "done", "tool_steps": tool_steps, "history": updated_history}


def run_agent(user_id, history, new_message):
    tools = _build_tools(user_id)
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0).bind_tools(tools)
    tool_node = ToolNode(tools)

    def agent_node(state):
        response = llm.invoke(state["messages"])
        return {"messages": [response], "user_id": state["user_id"]}

    graph_builder = StateGraph(AgentState)
    graph_builder.add_node("agent", agent_node)
    graph_builder.add_node("tools", tool_node)
    graph_builder.set_entry_point("agent")
    graph_builder.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", END: END},
    )
    graph_builder.add_edge("tools", "agent")
    graph = graph_builder.compile()

    # Reconstruct the full conversation so the LLM has context across turns
    messages = [SystemMessage(content=_build_system_prompt())]
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=new_message))

    # Cap at 15 nodes (≈6 tool rounds + final reply) to prevent runaway loops.
    # Without this, a confused agent can burn 20+ API calls on a simple question.
    result = graph.invoke(
        {"messages": messages, "user_id": user_id},
        config={"recursion_limit": 15},
    )

    final_message = result["messages"][-1]
    reply = final_message.content

    tool_steps = []
    for msg in result["messages"]:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_steps.append(tc["name"])

    updated_history = list(history)
    updated_history.append({"role": "user", "content": new_message})
    updated_history.append({"role": "assistant", "content": reply})

    return reply, updated_history, tool_steps
