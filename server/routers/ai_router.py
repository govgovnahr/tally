import json
import logging
import os
from datetime import date, timedelta
from typing import List

import base64

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langgraph.errors import GraphRecursionError
from auth import get_current_user
from database import get_connection, get_user_settings, compute_budget_pacing, get_outliers_for_agent
from models import ChatRequest, ChatResponse, ChatMessage
from ai_agent import run_agent, stream_agent

router = APIRouter()
logger = logging.getLogger("budget_app")


@router.get("/ai/insights")
def get_insights(user_id: str = Depends(get_current_user)):
    if not os.environ.get("OPENAI_API_KEY"):
        return []

    conn = get_connection()
    try:
        settings = get_user_settings(conn, user_id)
        if not settings["ai_enabled"]:
            return []
        context = _gather_insights_context(conn, user_id)
    finally:
        conn.close()

    if not context:
        return []

    try:
        import openai
        client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            temperature=0,
            messages=[
                {"role": "system", "content": (
                    "You are a personal finance assistant. Given a user's financial data, return ONLY "
                    "valid JSON with this structure: {\"insights\": [...]} where each insight is "
                    "{\"text\": string, \"sentiment\": \"positive\"|\"warning\"|\"neutral\", "
                    "\"page\": \"expenses\"|\"savings\"|\"budget\"|\"analysis\"}. "
                    "Generate 2-3 concise, specific, actionable insights using exact numbers from the data. "
                    "Focus on what is notable or surprising, not obvious. "
                    "Choose `page` based on where the user should go to act on this insight."
                )},
                {"role": "user", "content": context},
            ],
            max_tokens=400,
        )
        raw = json.loads(response.choices[0].message.content)
        items = raw.get("insights", [])
        valid = []
        for item in items[:3]:
            if not isinstance(item, dict) or "text" not in item:
                continue
            sentiment = item.get("sentiment", "neutral")
            page = item.get("page", "analysis")
            valid.append({
                "text": str(item["text"]),
                "sentiment": sentiment if sentiment in ("positive", "warning", "neutral") else "neutral",
                "page": page if page in ("expenses", "savings", "budget", "analysis") else "analysis",
            })
        return valid
    except Exception:
        logger.exception("Insights generation failed for user %s", user_id)
        return []


class ParseExpenseRequest(BaseModel):
    text: str
    expense_types: List[str] = []


@router.post("/ai/parse-expense")
def parse_expense(body: ParseExpenseRequest, user_id: str = Depends(get_current_user)):
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="AI not available")

    conn = get_connection()
    try:
        settings = get_user_settings(conn, user_id)
    finally:
        conn.close()

    if not settings["ai_enabled"]:
        raise HTTPException(status_code=403, detail="AI features are disabled.")

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")

    today_str = date.today().isoformat()
    yesterday_str = (date.today() - timedelta(days=1)).isoformat()
    type_list = ", ".join(body.expense_types) if body.expense_types else "Food, Transport, Housing, Entertainment, Health, Other"

    prompt = (
        f"Today is {today_str}. Extract expense details from the user's text.\n"
        f"Available categories: {type_list}\n\n"
        f'Text: "{text}"\n\n'
        "Return ONLY valid JSON, no markdown:\n"
        '{"name": "merchant or description, Title Case, 2-4 words", '
        '"amount": 0.00, '
        f'"date": "YYYY-MM-DD (today={today_str}, yesterday={yesterday_str})", '
        '"type": "exact category name from the list above"}'
    )

    try:
        import openai
        client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=120,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        return {
            "name": str(result.get("name", "")),
            "amount": float(result.get("amount", 0)),
            "date": str(result.get("date", today_str)),
            "type": str(result.get("type", "")),
        }
    except Exception:
        logger.exception("parse-expense failed for user %s", user_id)
        raise HTTPException(status_code=500, detail="Could not parse expense. Try describing it differently.")


def _gather_insights_context(conn, user_id: str) -> str:
    today = date.today()
    current_month = f"{today.year}-{today.month:02d}"
    parts = []

    # Budget pacing for current month
    try:
        pacing = compute_budget_pacing(conn, current_month, lookback_months=3, user_id=user_id)
        if pacing:
            lines = []
            for p in pacing:
                proj = f"${p['projected_spend']:.0f}" if p["projected_spend"] is not None else "unknown"
                lines.append(f"  {p['type']}: spent ${p['spent']:.0f}, projected {proj} this month")
            parts.append("Budget pacing (current month):\n" + "\n".join(lines))
    except Exception as e:
        logger.warning("Insights: pacing failed: %s", e)

    # Recent outliers (last 1 month)
    try:
        outliers = get_outliers_for_agent(conn, user_id, months=1)
        if outliers:
            lines = []
            for o in outliers[:3]:
                lines.append(f"  {o['name']} (${o['amount']:.0f}) in {o['type']} on {o['date']} — {o['pct_above_avg']:.0f}% above avg")
            parts.append("Unusual transactions (last month):\n" + "\n".join(lines))
    except Exception as e:
        logger.warning("Insights: outliers failed: %s", e)

    # Month-over-month net (last 3 months)
    try:
        cursor = conn.cursor()
        months = []
        for i in range(2, -1, -1):
            y, m = today.year, today.month - i
            while m <= 0:
                m += 12
                y -= 1
            months.append(f"{y}-{m:02d}")

        cursor.execute(
            "SELECT LEFT(date, 7) AS month, SUM(amount) AS total FROM expenses "
            "WHERE user_id = %s AND LEFT(date, 7) = ANY(%s) GROUP BY month ORDER BY month",
            (user_id, months),
        )
        exp_by_month = {r["month"]: r["total"] for r in cursor.fetchall()}

        cursor.execute(
            "SELECT LEFT(date, 7) AS month, SUM(amount) AS total FROM incomes "
            "WHERE user_id = %s AND LEFT(date, 7) = ANY(%s) GROUP BY month ORDER BY month",
            (user_id, months),
        )
        inc_by_month = {r["month"]: r["total"] for r in cursor.fetchall()}

        if exp_by_month or inc_by_month:
            lines = []
            for mo in months:
                inc = inc_by_month.get(mo, 0)
                exp = exp_by_month.get(mo, 0)
                net = inc - exp
                lines.append(f"  {mo}: income ${inc:.0f}, expenses ${exp:.0f}, net ${net:.0f}")
            parts.append("Last 3 months summary:\n" + "\n".join(lines))
    except Exception as e:
        logger.warning("Insights: MoM failed: %s", e)

    # Savings goals
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT g.name, g.goal_type, g.target, g.deadline,
                   COALESCE(SUM(c.amount), 0) AS progress
            FROM savings_goals g
            LEFT JOIN savings_contributions c ON c.goal_id = g.id AND c.user_id = g.user_id
            WHERE g.user_id = %s AND g.paused = 0
            GROUP BY g.id, g.name, g.goal_type, g.target, g.deadline
            """,
            (user_id,),
        )
        goals = cursor.fetchall()
        if goals:
            lines = []
            for g in goals:
                pct = (g["progress"] / g["target"] * 100) if g["target"] > 0 else 0
                deadline = f", deadline {g['deadline']}" if g["deadline"] else ""
                lines.append(f"  {g['name']} ({g['goal_type']}): ${g['progress']:.0f} of ${g['target']:.0f} ({pct:.0f}%){deadline}")
            parts.append("Savings goals:\n" + "\n".join(lines))
    except Exception as e:
        logger.warning("Insights: goals failed: %s", e)

    return "\n\n".join(parts) if parts else ""


def _gather_budget_context(conn, user_id: str, lookback: int = 3, exclude_outliers: bool = False) -> dict:
    today = date.today()
    months = []
    for i in range(lookback - 1, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0:
            m += 12
            y -= 1
        months.append(f"{y}-{m:02d}")

    cursor = conn.cursor()
    placeholders = ",".join(["%s"] * len(months))
    cursor.execute(
        f"SELECT type, LEFT(date, 7) AS month, SUM(amount) AS total "
        f"FROM expenses WHERE user_id = %s AND LEFT(date, 7) IN ({placeholders}) "
        f"GROUP BY type, month",
        [user_id] + months,
    )
    by_type: dict = {}
    for r in cursor.fetchall():
        by_type.setdefault(r["type"], []).append(float(r["total"]))
    if exclude_outliers:
        filtered: dict = {}
        for t, totals in by_type.items():
            if len(totals) >= 3:
                mean = sum(totals) / len(totals)
                std = (sum((v - mean) ** 2 for v in totals) / len(totals)) ** 0.5
                if std > 0:
                    filtered[t] = [v for v in totals if abs(v - mean) / std < 1.5]
                    continue
            filtered[t] = totals
        by_type = filtered

    # Match category-stats: divide by non-zero months only (same as avg_monthly on the card)
    spending = {t: round(sum(totals) / len(totals), 2) for t, totals in by_type.items() if totals}

    cursor.execute("SELECT type, monthly_limit FROM budgets WHERE user_id = %s", (user_id,))
    current_limits = {r["type"]: float(r["monthly_limit"]) for r in cursor.fetchall()}

    return {"spending": spending, "current_limits": current_limits, "months_analyzed": months}


@router.post("/ai/scan-receipt")
async def scan_receipt(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="AI not available")

    conn = get_connection()
    try:
        settings = get_user_settings(conn, user_id)
        if not settings["ai_enabled"]:
            raise HTTPException(status_code=403, detail="AI features are disabled.")
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM expense_types WHERE user_id = %s", (user_id,))
        expense_types = [row["name"] for row in cursor.fetchall()]
    finally:
        conn.close()

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Please use an image under 10MB.")

    b64 = base64.b64encode(image_bytes).decode()
    system_prompt = (
        "You are a receipt parser. Extract key information from the receipt image.\n\n"
        f"Available expense categories: {', '.join(expense_types)}\n\n"
        "Return ONLY valid JSON:\n"
        "{\"name\": \"<merchant or description>\", \"amount\": <total as number>, "
        "\"date\": \"<YYYY-MM-DD or null>\", \"type_suggestion\": \"<matching category or null>\"}\n\n"
        "Rules:\n"
        "- name: merchant name or brief description, max 40 chars\n"
        "- amount: the final total including tax, as a positive number\n"
        "- date: transaction date in YYYY-MM-DD, or null if not visible\n"
        "- type_suggestion: must exactly match one of the available categories, or null"
    )

    try:
        import openai
        client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        response = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{file.content_type};base64,{b64}", "detail": "low"}},
                    {"type": "text", "text": "Extract the receipt information."},
                ]},
            ],
            max_tokens=300,
        )
        raw = json.loads(response.choices[0].message.content)
        amount_raw = raw.get("amount")
        return {
            "name": str(raw.get("name", ""))[:40],
            "amount": round(float(amount_raw), 2) if amount_raw and float(amount_raw) > 0 else None,
            "date": raw.get("date") or date.today().isoformat(),
            "type_suggestion": raw.get("type_suggestion") if raw.get("type_suggestion") in expense_types else None,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Receipt scan failed for user %s", user_id)
        raise HTTPException(status_code=500, detail="Could not read receipt. Please try again.")


@router.post("/ai/budget-recommendations")
def get_budget_recommendations(months: int = Query(default=3, ge=1, le=12), exclude_outliers: bool = Query(default=False), user_id: str = Depends(get_current_user)):
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="AI not available")

    conn = get_connection()
    try:
        settings = get_user_settings(conn, user_id)
        if not settings["ai_enabled"]:
            raise HTTPException(status_code=403, detail="AI features are disabled.")
        context = _gather_budget_context(conn, user_id, lookback=months, exclude_outliers=exclude_outliers)
    finally:
        conn.close()

    if not context["spending"]:
        raise HTTPException(status_code=400, detail="Not enough spending history to generate recommendations.")

    system_prompt = (
        "You are Tally AI, a personal finance assistant generating monthly budget recommendations from 3 months of spending data.\n\n"
        "RECOMMENDATIONS:\n"
        "For fixed categories (e.g. Housing, Rent, Loans), recommend the average spend with up to 3% buffer.\n"
        "For variable categories, recommend average spend with a 10-15% buffer.\n\n"
        "HANDLING ZERO-HISTORY CATEGORIES:\n"
        "If a category has no spend data across all 3 months, omit it from the recommendations entirely.\n\n"
        "RATIONALE:\n"
        "One sentence, grounded in numbers. Example: 'You averaged $X/mo; $Y adds a 12% buffer for variability.'\n\n"
        "OUTPUT:\n"
        "Return ONLY valid JSON: {\"recommendations\": [{\"type\": \"<category name>\", \"recommended_limit\": <number>, \"rationale\": \"<one sentence>\"}]}\n"
        "Never fabricate data. Only recommend categories present in the spending input."
    )

    try:
        import openai
        client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(context, indent=2)},
            ],
            max_tokens=1500,
        )
        raw = json.loads(response.choices[0].message.content)
        recs = raw.get("recommendations", [])
        valid = []
        for r in recs:
            if not isinstance(r, dict) or "type" not in r or "recommended_limit" not in r:
                continue
            valid.append({
                "type": str(r["type"]),
                "recommended_limit": round(float(r["recommended_limit"]), 2),
                "current_limit": context["current_limits"].get(str(r["type"]), 0.0),
                "avg_spend": context["spending"].get(str(r["type"]), 0.0),
                "rationale": str(r.get("rationale", "")),
            })
        return valid
    except HTTPException:
        raise
    except Exception:
        logger.exception("Budget recommendations failed for user %s", user_id)
        raise HTTPException(status_code=500, detail="Could not generate recommendations. Please try again.")


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        settings = get_user_settings(conn, user_id)
    finally:
        conn.close()
    if not settings["ai_enabled"]:
        raise HTTPException(status_code=403, detail="AI features are disabled. Enable them in Account settings.")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    history = [{"role": msg.role, "content": msg.content} for msg in body.history]

    def generate():
        try:
            for event in stream_agent(user_id, history, body.message):
                yield f"data: {json.dumps(event)}\n\n"
        except GraphRecursionError:
            logger.warning("Agent hit recursion limit for user %s", user_id)
            yield f"data: {json.dumps({'type': 'error', 'detail': 'The agent took too many steps. Try a more specific question.'})}\n\n"
        except Exception as e:
            logger.exception("Agent error for user %s", user_id)
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Something went wrong. Please try again.'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
