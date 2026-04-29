import calendar
import math
from datetime import date
from fastapi import APIRouter, Depends, Query
from database import get_connection, get_avg_monthly_expenses, compute_budget_pacing
from auth import get_current_user

router = APIRouter()


def _current_month():
    today = date.today()
    return f"{today.year}-{today.month:02d}"


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


def _effective_budgets_map(conn, month: str, user_id: str) -> dict:
    defaults = {r["type"]: r["monthly_limit"]
                for r in conn.execute("SELECT type, monthly_limit FROM budgets WHERE user_id = %s", (user_id,)).fetchall()}
    overrides = {r["type"]: r["monthly_limit"]
                 for r in conn.execute(
                     "SELECT type, monthly_limit FROM monthly_budgets WHERE user_id = %s AND month = %s", (user_id, month)
                 ).fetchall()}
    return overrides if overrides else defaults


@router.get("/analysis/pacing")
def get_pacing(
    month: str = Query(...), lookback_months: int = Query(3),
    user_id: str = Depends(get_current_user),
):
    today = date.today()
    cur_month = _current_month()
    y, m = map(int, month.split("-"))
    days_in_month = calendar.monthrange(y, m)[1]

    if month > cur_month:
        return {
            "month": month,
            "days_elapsed": 0,
            "days_in_month": days_in_month,
            "is_current_month": False,
            "categories": [],
        }

    conn = get_connection()
    pacing_rows = compute_budget_pacing(conn, month, lookback_months=lookback_months, user_id=user_id)
    budgets = _effective_budgets_map(conn, month, user_id)
    conn.close()

    days_elapsed = today.day if month == cur_month else days_in_month

    categories = []
    for row in pacing_rows:
        t = row["type"]
        budget_limit = budgets.get(t)
        projected = row["projected_spend"]

        if not budget_limit or budget_limit <= 0:
            status = "no_budget"
        elif projected is None:
            status = "over_budget" if row["spent"] > budget_limit else "on_track"
        elif projected > budget_limit * 1.05:
            status = "over_budget"
        elif projected > budget_limit * 1.01:
            status = "at_risk"
        elif projected < budget_limit * 0.90:
            status = "well_under"
        else:
            status = "on_track"

        pacing_pct = None
        if budget_limit and budget_limit > 0 and projected is not None:
            pacing_pct = round(min((projected / budget_limit) * 100, 150), 1)

        categories.append({
            "type": t,
            "spent": row["spent"],
            "projected_spend": projected,
            "budget_limit": budget_limit,
            "pacing_pct": pacing_pct,
            "status": status,
        })

    return {
        "month": month,
        "days_elapsed": days_elapsed,
        "days_in_month": days_in_month,
        "is_current_month": month == cur_month,
        "categories": categories,
    }


@router.get("/analysis/category-stats")
def get_category_stats(
    months: int = Query(6), exclude_outliers: bool = Query(False),
    user_id: str = Depends(get_current_user),
):
    month_list = _months_range(months)
    conn = get_connection()
    placeholders = ",".join(["%s"] * len(month_list))

    rows = conn.execute(
        f"SELECT to_char(date::date, 'YYYY-MM') as month, type, COALESCE(SUM(amount), 0) as total "
        f"FROM expenses WHERE user_id = %s AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) "
        f"GROUP BY month, type",
        [user_id] + month_list,
    ).fetchall()
    credit_rows = conn.execute(
        f"SELECT to_char(date::date, 'YYYY-MM') as month, credit_type as type, COALESCE(SUM(amount), 0) as total "
        f"FROM incomes WHERE user_id = %s AND credit_type IS NOT NULL AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) "
        f"GROUP BY month, credit_type",
        [user_id] + month_list,
    ).fetchall()
    budget_map = {r["type"]: r["monthly_limit"]
                  for r in conn.execute("SELECT type, monthly_limit FROM budgets WHERE user_id = %s", (user_id,)).fetchall()}
    conn.close()

    by_type: dict[str, dict] = {}
    for row in rows:
        t = row["type"]
        by_type.setdefault(t, {})
        by_type[t][row["month"]] = round(row["total"], 2)
    for cr in credit_rows:
        t, mo = cr["type"], cr["month"]
        if t in by_type and mo in by_type[t]:
            by_type[t][mo] = round(max(0.0, by_type[t][mo] - cr["total"]), 2)

    if exclude_outliers:
        avg_by_type: dict[str, dict] = {}
        for t, month_totals in by_type.items():
            non_zero = {mo: v for mo, v in month_totals.items() if v > 0}
            if len(non_zero) >= 3:
                vals = list(non_zero.values())
                mean = sum(vals) / len(vals)
                std = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))
                if std > 0:
                    avg_by_type[t] = {mo: v for mo, v in non_zero.items() if abs(v - mean) / std < 1.5}
                    continue
            avg_by_type[t] = month_totals
    else:
        avg_by_type = by_type

    result = []
    for t, month_totals in by_type.items():
        monthly_vals = [month_totals.get(m, 0.0) for m in month_list]
        avg_vals = [avg_by_type.get(t, {}).get(m, 0.0) for m in month_list]
        non_zero_avg = [v for v in avg_vals if v > 0]
        avg = round(sum(non_zero_avg) / len(non_zero_avg), 2) if non_zero_avg else 0.0
        budget_limit = budget_map.get(t)

        months_over = 0
        avg_overage = 0.0
        if budget_limit and budget_limit > 0:
            overages = [v - budget_limit for v in monthly_vals if v > budget_limit]
            months_over = len(overages)
            avg_overage = round(sum(overages) / len(overages), 2) if overages else 0.0

        last = monthly_vals[-1]
        if avg > 0:
            trend = "up" if last > avg * 1.05 else ("down" if last < avg * 0.95 else "flat")
        else:
            trend = "flat"

        result.append({
            "type": t,
            "avg_monthly": avg,
            "last_month": round(last, 2),
            "budget_limit": budget_limit,
            "months_over": months_over,
            "months_total": months,
            "frequency_pct": round(months_over / months * 100, 1) if months > 0 else 0.0,
            "avg_overage": avg_overage,
            "trend": trend,
            "monthly": [{"month": m, "total": month_totals.get(m, 0.0)} for m in month_list],
        })

    result.sort(key=lambda x: (x["frequency_pct"], x["avg_monthly"]), reverse=True)
    return result


@router.get("/analysis/outliers")
def get_outliers(months: int = Query(3), user_id: str = Depends(get_current_user)):
    month_list = _months_range(months)
    conn = get_connection()
    placeholders = ",".join(["%s"] * len(month_list))

    expenses = conn.execute(
        f"SELECT id, name, type, amount, date FROM expenses "
        f"WHERE user_id = %s AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) ORDER BY date DESC",
        [user_id] + month_list,
    ).fetchall()
    conn.close()

    by_type: dict[str, list[float]] = {}
    for e in expenses:
        by_type.setdefault(e["type"], []).append(e["amount"])

    type_stats = {}
    for t, amounts in by_type.items():
        n = len(amounts)
        mean = sum(amounts) / n
        std = math.sqrt(sum((a - mean) ** 2 for a in amounts) / n) if n > 1 else 0.0
        type_stats[t] = {"mean": mean, "std": std, "n": n}

    outliers = []
    for e in expenses:
        stats = type_stats.get(e["type"])
        if not stats or stats["n"] < 3 or stats["std"] == 0:
            continue
        z = (e["amount"] - stats["mean"]) / stats["std"]
        if z < 1.5:
            continue
        pct_above = round(((e["amount"] - stats["mean"]) / stats["mean"]) * 100) if stats["mean"] > 0 else 0
        outliers.append({
            "id": e["id"],
            "name": e["name"],
            "type": e["type"],
            "amount": round(e["amount"], 2),
            "date": e["date"][:10],
            "category_avg": round(stats["mean"], 2),
            "z_score": round(z, 2),
            "pct_above_avg": int(pct_above),
        })

    outliers.sort(key=lambda x: x["z_score"], reverse=True)
    return outliers[:15]


@router.get("/analysis/avg-monthly-expenses")
def get_avg_expenses(months: int = Query(3), user_id: str = Depends(get_current_user)):
    conn = get_connection()
    avg = get_avg_monthly_expenses(conn, months, user_id=user_id)
    conn.close()
    return {"avg_monthly_expenses": avg, "months": months}


@router.get("/analysis/months-available")
def get_months_available(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    row = conn.execute(
        "SELECT MIN(substr(date,1,7)) as earliest FROM expenses WHERE user_id = %s",
        (user_id,)
    ).fetchone()
    if not row or not row["earliest"]:
        return {"months": 6}
    ey, em = map(int, row["earliest"].split("-"))
    today = date.today()
    months = (today.year - ey) * 12 + (today.month - em) + 1
    return {"months": max(months, 1)}


@router.get("/analysis/month-over-month")
def get_month_over_month(months: int = Query(6), user_id: str = Depends(get_current_user)):
    month_list = _months_range(months)
    conn = get_connection()
    placeholders = ",".join(["%s"] * len(month_list))

    expense_rows = conn.execute(
        f"SELECT to_char(date::date, 'YYYY-MM') as month, COALESCE(SUM(amount), 0) as total "
        f"FROM expenses WHERE user_id = %s AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) GROUP BY month",
        [user_id] + month_list,
    ).fetchall()
    expense_by_month = {r["month"]: round(r["total"], 2) for r in expense_rows}

    income_rows = conn.execute(
        f"SELECT to_char(date::date, 'YYYY-MM') as month, COALESCE(SUM(amount), 0) as total "
        f"FROM incomes WHERE user_id = %s AND credit_type IS NULL AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) GROUP BY month",
        [user_id] + month_list,
    ).fetchall()
    income_by_month = {r["month"]: round(r["total"], 2) for r in income_rows}

    credit_rows = conn.execute(
        f"SELECT to_char(date::date, 'YYYY-MM') as month, COALESCE(SUM(amount), 0) as total "
        f"FROM incomes WHERE user_id = %s AND credit_type IS NOT NULL AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) GROUP BY month",
        [user_id] + month_list,
    ).fetchall()
    for cr in credit_rows:
        mo = cr["month"]
        expense_by_month[mo] = round(max(0.0, expense_by_month.get(mo, 0.0) - cr["total"]), 2)
    conn.close()

    result = []
    prev_spent = None
    for mo in month_list:
        total_spent = expense_by_month.get(mo, 0.0)
        total_income = income_by_month.get(mo, 0.0)
        net = round(total_income - total_spent, 2)
        if prev_spent is not None and prev_spent > 0:
            mom_change_pct = round(((total_spent - prev_spent) / prev_spent) * 100, 1)
        else:
            mom_change_pct = None
        result.append({
            "month": mo,
            "total_spent": total_spent,
            "total_income": total_income,
            "net": net,
            "mom_change_pct": mom_change_pct,
        })
        prev_spent = total_spent

    return result
