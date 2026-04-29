import uuid
import math
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from database import get_connection, get_avg_monthly_expenses
from models import SavingsGoal, NewSavingsGoal, UpdateSavingsGoal, NewContribution
from auth import get_current_user

router = APIRouter()


def _current_month():
    now = date.today()
    return f"{now.year}-{now.month:02d}"


def _months_range(n: int):
    today = date.today()
    months = []
    for i in range(n - 1, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        months.append(f"{y}-{m:02d}")
    return months


def _add_months(ym: str, n: int) -> str:
    y, m = map(int, ym.split("-"))
    m += n
    while m > 12:
        m -= 12
        y += 1
    return f"{y}-{m:02d}"


def _portfolio_avg_net(conn, user_id: str, months: int = 3) -> float:
    past_months = _months_range(months + 1)[:-1]
    if not past_months:
        return 0.0
    placeholders = ",".join(["%s"] * len(past_months))
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT to_char(date::date, 'YYYY-MM') as month, COALESCE(SUM(amount),0) as total "
        f"FROM incomes WHERE user_id = %s AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) GROUP BY month",
        [user_id] + past_months,
    )
    income_by_month = {row["month"]: row["total"] for row in cursor.fetchall()}
    cursor.execute(
        f"SELECT to_char(date::date, 'YYYY-MM') as month, COALESCE(SUM(amount),0) as total "
        f"FROM expenses WHERE user_id = %s AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) GROUP BY month",
        [user_id] + past_months,
    )
    expense_by_month = {row["month"]: row["total"] for row in cursor.fetchall()}
    nets = [income_by_month.get(m, 0.0) - expense_by_month.get(m, 0.0) for m in past_months]
    return round(sum(nets) / len(nets), 2)


def _get_contributions(goal_id: str, cursor):
    cursor.execute(
        "SELECT * FROM savings_contributions WHERE goal_id = %s ORDER BY date DESC",
        (goal_id,),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    total = round(sum(r["amount"] for r in rows), 2)
    return rows, total


def _add_computed(goal: dict, conn, portfolio_avg: float = 0.0) -> dict:
    cursor = conn.cursor()
    cur_month = _current_month()

    allocation_pct = goal.get("allocation_pct")
    priority = goal.get("priority")
    paused = bool(goal.get("paused", 0))

    contrib_rows, total_contributions = _get_contributions(goal["id"], cursor)

    base = {
        **goal,
        "paused": paused,
        "total_contributions": total_contributions,
        "contributions": contrib_rows,
    }
    base.pop("user_id", None)

    if goal["goal_type"] == "monthly":
        cursor.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM savings_contributions "
            "WHERE goal_id = %s AND to_char(date::date, 'YYYY-MM') = %s",
            (goal["id"], cur_month),
        )
        monthly_contributions = round(cursor.fetchone()["total"], 2)
        progress_pct = (
            round(min(100.0, max(0.0, monthly_contributions / goal["target"] * 100)), 2)
            if goal["target"] > 0 else 0.0
        )
        return {
            **base,
            "completed": False,
            "monthly_contributions": monthly_contributions,
            "effective_progress": monthly_contributions,
            "progress_pct": progress_pct,
            "avg_monthly_net": portfolio_avg,
            "effective_avg_monthly_net": None,
            "projected_completion": None,
            "current_net": None,
            "effective_net": None,
            "cumulative_net": None,
        }

    effective_progress = total_contributions
    progress_pct = (
        round(min(100.0, max(0.0, effective_progress / goal["target"] * 100)), 2)
        if goal["target"] > 0 else 0.0
    )

    contribution_rate = None
    if total_contributions > 0 and contrib_rows:
        first_date = min(r["date"][:10] for r in contrib_rows)
        first_y, first_m = int(first_date[:4]), int(first_date[5:7])
        today = date.today()
        months_elapsed = (today.year - first_y) * 12 + (today.month - first_m)
        if months_elapsed > 0:
            contribution_rate = round(total_contributions / months_elapsed, 2)

    if allocation_pct is not None:
        effective_avg = max(0.0, round(portfolio_avg * (allocation_pct / 100), 2))
        if effective_avg == 0 and contribution_rate:
            effective_avg = contribution_rate
    elif priority is not None:
        effective_avg = None
    else:
        effective_avg = portfolio_avg if portfolio_avg > 0 else (contribution_rate or 0.0)

    projected_completion = None
    if effective_avg is not None:
        remaining = goal["target"] - effective_progress
        if remaining <= 0:
            projected_completion = cur_month
        elif effective_avg > 0:
            months_needed = math.ceil(remaining / effective_avg)
            projected_completion = _add_months(cur_month, months_needed)

    today_str = date.today().isoformat()
    deadline_passed = bool(goal.get("deadline")) and goal["deadline"][:10] < today_str
    completed = (effective_progress >= goal["target"] and goal["target"] > 0) or deadline_passed

    return {
        **base,
        "completed": completed,
        "monthly_contributions": None,
        "effective_progress": effective_progress,
        "progress_pct": progress_pct,
        "avg_monthly_net": portfolio_avg,
        "effective_avg_monthly_net": effective_avg,
        "projected_completion": projected_completion,
        "current_net": None,
        "effective_net": None,
        "cumulative_net": None,
    }


def _apply_priority_cascade(goals: list, portfolio_avg: float) -> list:
    for g in goals:
        if g.get("completed"):
            g["priority"] = None
            g["allocation_pct"] = None

    total_pct = sum((g.get("allocation_pct") or 0.0) for g in goals if not g.get("completed"))
    remainder = max(0.0, round(portfolio_avg * (1 - total_pct / 100), 2))

    priority_goals = sorted(
        [g for g in goals if g.get("priority") is not None and not g.get("completed") and g["goal_type"] == "one_time"],
        key=lambda g: g["priority"],
    )

    cur_month = _current_month()
    month_offset = 0

    for g in priority_goals:
        effective_progress = g.get("effective_progress") or 0.0
        remaining = g["target"] - effective_progress
        rate = remainder
        if rate == 0:
            contrib_rows = g.get("contributions") or []
            if contrib_rows and effective_progress > 0:
                first_date = min(r["date"][:10] for r in contrib_rows)
                first_y, first_m = int(first_date[:4]), int(first_date[5:7])
                today = date.today()
                months_elapsed = (today.year - first_y) * 12 + (today.month - first_m)
                if months_elapsed > 0:
                    rate = round(effective_progress / months_elapsed, 2)
        g["effective_avg_monthly_net"] = rate
        if remaining <= 0:
            g["projected_completion"] = cur_month
        elif rate > 0:
            months_needed = math.ceil(remaining / rate)
            g["projected_completion"] = _add_months(cur_month, month_offset + months_needed)
            month_offset += months_needed
        else:
            g["projected_completion"] = None

    return goals


@router.get("/savings-goals/monthly-goal")
def get_monthly_goal(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT target FROM savings_goals WHERE user_id = %s AND goal_type = 'monthly' LIMIT 1", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return {"target": round(row["target"], 2) if row else None}


@router.get("/savings-goals/avg-net")
def get_avg_net(months: int = 3, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    avg = _portfolio_avg_net(conn, user_id, months)
    conn.close()
    return {"avg_monthly_net": avg, "months": months}


@router.get("/savings-goals/net-chart")
def get_net_chart(months: int = 6, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    month_list = _months_range(months)
    placeholders = ",".join(["%s"] * len(month_list))
    cursor.execute(
        f"SELECT to_char(date::date, 'YYYY-MM') as month, COALESCE(SUM(amount),0) as total "
        f"FROM incomes WHERE user_id = %s AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) GROUP BY month",
        [user_id] + month_list,
    )
    income_by_month = {row["month"]: row["total"] for row in cursor.fetchall()}
    cursor.execute(
        f"SELECT to_char(date::date, 'YYYY-MM') as month, COALESCE(SUM(amount),0) as total "
        f"FROM expenses WHERE user_id = %s AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) GROUP BY month",
        [user_id] + month_list,
    )
    expense_by_month = {row["month"]: row["total"] for row in cursor.fetchall()}
    conn.close()
    result = []
    for mo in month_list:
        inc = round(income_by_month.get(mo, 0.0), 2)
        exp = round(expense_by_month.get(mo, 0.0), 2)
        result.append({"month": mo, "income": inc, "expenses": exp, "net": round(inc - exp, 2)})
    return result


@router.get("/savings-goals")
def get_savings_goals(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM savings_goals WHERE user_id = %s ORDER BY created_at ASC", (user_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    portfolio_avg = _portfolio_avg_net(conn, user_id)
    result = [_add_computed(r, conn, portfolio_avg) for r in rows]
    result = _apply_priority_cascade(result, portfolio_avg)
    conn.close()
    return result


@router.post("/savings-goals", status_code=201)
def create_savings_goal(body: NewSavingsGoal, user_id: str = Depends(get_current_user)):
    if body.goal_type not in ("monthly", "one_time", "emergency_fund"):
        raise HTTPException(status_code=400, detail="goal_type must be 'monthly', 'one_time', or 'emergency_fund'")
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if body.allocation_pct is not None and not (0 <= body.allocation_pct <= 100):
        raise HTTPException(status_code=400, detail="allocation_pct must be between 0 and 100")
    if body.priority is not None and body.priority < 1:
        raise HTTPException(status_code=400, detail="priority must be >= 1")
    if body.allocation_pct is not None and body.priority is not None:
        raise HTTPException(status_code=400, detail="Cannot set both allocation_pct and priority")

    conn = get_connection()
    cursor = conn.cursor()

    if body.goal_type == "emergency_fund" and body.months_target is not None and body.months_target > 0:
        computed_avg = get_avg_monthly_expenses(conn, months=3, user_id=user_id)
        target = round(body.months_target * computed_avg, 2) if computed_avg > 0 else round(body.target or 0, 2)
    elif body.target is not None and body.target > 0:
        target = round(body.target, 2)
    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Target must be greater than 0")

    if body.goal_type == "monthly":
        cursor.execute("SELECT id FROM savings_goals WHERE user_id = %s AND goal_type = 'monthly'", (user_id,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=409, detail="A monthly savings goal already exists")

    if body.priority is not None:
        today_str = date.today().isoformat()
        cursor.execute(
            "SELECT id FROM savings_goals WHERE user_id = %s AND priority = %s AND (deadline IS NULL OR deadline >= %s)",
            (user_id, body.priority, today_str),
        )
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=409, detail=f"Priority {body.priority} is already assigned to another active goal")

    goal_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO savings_goals (id, goal_type, name, target, deadline, created_at, color, allocation_pct, priority, months_target, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (goal_id, body.goal_type, body.name.strip(), target, body.deadline, created_at, body.color, body.allocation_pct, body.priority, body.months_target, user_id),
    )
    conn.commit()

    cursor.execute("SELECT * FROM savings_goals WHERE id = %s", (goal_id,))
    row = dict(cursor.fetchone())
    portfolio_avg = _portfolio_avg_net(conn, user_id)
    result = _add_computed(row, conn, portfolio_avg)
    conn.close()
    return result


@router.put("/savings-goals/{goal_id}")
def update_savings_goal(goal_id: str, body: UpdateSavingsGoal, user_id: str = Depends(get_current_user)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if body.allocation_pct is not None and not (0 <= body.allocation_pct <= 100):
        raise HTTPException(status_code=400, detail="allocation_pct must be between 0 and 100")
    if body.priority is not None and body.priority < 1:
        raise HTTPException(status_code=400, detail="priority must be >= 1")
    if body.allocation_pct is not None and body.priority is not None:
        raise HTTPException(status_code=400, detail="Cannot set both allocation_pct and priority")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM savings_goals WHERE id = %s AND user_id = %s", (goal_id, user_id))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Savings goal not found")

    if row["goal_type"] == "emergency_fund" and body.months_target is not None and body.months_target > 0:
        computed_avg = get_avg_monthly_expenses(conn, months=3, user_id=user_id)
        target = round(body.months_target * computed_avg, 2) if computed_avg > 0 else round(body.target or row["target"], 2)
    elif body.target is not None and body.target > 0:
        target = round(body.target, 2)
    else:
        target = row["target"]

    if body.priority is not None:
        today_str = date.today().isoformat()
        cursor.execute(
            "SELECT id FROM savings_goals WHERE user_id = %s AND priority = %s AND id != %s "
            "AND (deadline IS NULL OR deadline >= %s)",
            (user_id, body.priority, goal_id, today_str),
        )
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=409, detail=f"Priority {body.priority} is already assigned to another active goal")

    cursor.execute(
        "UPDATE savings_goals SET name=%s, target=%s, deadline=%s, color=%s, allocation_pct=%s, priority=%s, paused=%s, months_target=%s WHERE id=%s AND user_id=%s",
        (body.name.strip(), target, body.deadline, body.color, body.allocation_pct, body.priority, 1 if body.paused else 0, body.months_target, goal_id, user_id),
    )
    conn.commit()

    cursor.execute("SELECT * FROM savings_goals WHERE id = %s", (goal_id,))
    updated = dict(cursor.fetchone())
    portfolio_avg = _portfolio_avg_net(conn, user_id)
    result = _add_computed(updated, conn, portfolio_avg)
    conn.close()
    return result


@router.patch("/savings-goals/{goal_id}/pause")
def toggle_pause(goal_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM savings_goals WHERE id = %s AND user_id = %s", (goal_id, user_id))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Savings goal not found")
    new_paused = 0 if row["paused"] else 1
    cursor.execute("UPDATE savings_goals SET paused=%s WHERE id=%s AND user_id=%s", (new_paused, goal_id, user_id))
    conn.commit()
    cursor.execute("SELECT * FROM savings_goals WHERE id = %s", (goal_id,))
    updated = dict(cursor.fetchone())
    portfolio_avg = _portfolio_avg_net(conn, user_id)
    result = _add_computed(updated, conn, portfolio_avg)
    conn.close()
    return result


def _get_or_create_savings_type(cursor, user_id: str) -> str:
    cursor.execute("SELECT name FROM expense_types WHERE name = 'Savings' AND user_id = %s", (user_id,))
    if cursor.fetchone():
        return "Savings"
    cursor.execute(
        "INSERT INTO expense_types (id, name, color, icon, sort_order, is_default, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (str(uuid.uuid4()), "Savings", "#8fb996", "Savings", 99, 1, user_id),
    )
    return "Savings"


@router.post("/savings-goals/{goal_id}/contributions", status_code=201)
def add_contribution(goal_id: str, body: NewContribution, user_id: str = Depends(get_current_user)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    if not body.date:
        raise HTTPException(status_code=400, detail="Date is required")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM savings_goals WHERE id = %s AND user_id = %s", (goal_id, user_id))
    goal_row = cursor.fetchone()
    if not goal_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Savings goal not found")

    goal_name = goal_row["name"]
    created_at = datetime.now().isoformat()

    if body.expense_id:
        cursor.execute("SELECT id FROM expenses WHERE id = %s AND user_id = %s", (body.expense_id, user_id))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Expense not found")
        expense_id = body.expense_id
    else:
        savings_type = _get_or_create_savings_type(cursor, user_id)
        expense_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            (expense_id, goal_name, round(body.amount, 2), savings_type, body.date, created_at, 0, user_id),
        )

    contrib_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO savings_contributions (id, goal_id, amount, date, note, created_at, expense_id, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
        (contrib_id, goal_id, round(body.amount, 2), body.date, body.note, created_at, expense_id, user_id),
    )
    conn.commit()
    cursor.execute("SELECT * FROM savings_contributions WHERE id = %s", (contrib_id,))
    result = dict(cursor.fetchone())
    conn.close()
    return result


@router.get("/savings-goals/{goal_id}/contributions")
def get_contributions(goal_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM savings_goals WHERE id = %s AND user_id = %s", (goal_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Savings goal not found")
    cursor.execute(
        "SELECT * FROM savings_contributions WHERE goal_id = %s ORDER BY date DESC",
        (goal_id,),
    )
    result = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return result


@router.delete("/savings-goals/{goal_id}/contributions/{contrib_id}")
def delete_contribution(goal_id: str, contrib_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM savings_goals WHERE id = %s AND user_id = %s", (goal_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Savings goal not found")
    cursor.execute(
        "SELECT id, expense_id FROM savings_contributions WHERE id = %s AND goal_id = %s",
        (contrib_id, goal_id),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Contribution not found")
    if row["expense_id"]:
        cursor.execute("DELETE FROM expenses WHERE id = %s AND user_id = %s", (row["expense_id"], user_id))
    cursor.execute("DELETE FROM savings_contributions WHERE id = %s", (contrib_id,))
    conn.commit()
    conn.close()
    return {"id": contrib_id}


@router.delete("/savings-goals/{goal_id}")
def delete_savings_goal(goal_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM savings_goals WHERE id = %s AND user_id = %s", (goal_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Savings goal not found")
    cursor.execute("DELETE FROM savings_contributions WHERE goal_id = %s", (goal_id,))
    cursor.execute("DELETE FROM savings_goals WHERE id = %s AND user_id = %s", (goal_id, user_id))
    conn.commit()
    conn.close()
    return {"id": goal_id}
