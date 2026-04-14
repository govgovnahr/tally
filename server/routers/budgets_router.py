from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from database import get_connection
from models import NewBudget
from pydantic import BaseModel
from datetime import date

router = APIRouter()


def _month_range(months: int) -> list[str]:
    """Return list of YYYY-MM strings for the last `months` months up to and including current month."""
    today = date.today()
    result = []
    y, m = today.year, today.month
    for _ in range(months):
        result.append(f"{y}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(result))


def _effective_budgets(conn, month: str) -> list[dict]:
    """Return effective budget per type for a given month.
    If any override exists for the month, use ONLY the overrides for that month.
    Otherwise fall back to defaults.
    """
    defaults = {r["type"]: r["monthly_limit"]
                for r in conn.execute("SELECT type, monthly_limit FROM budgets").fetchall()}
    overrides = {r["type"]: r["monthly_limit"]
                 for r in conn.execute(
                     "SELECT type, monthly_limit FROM monthly_budgets WHERE month = ?", (month,)
                 ).fetchall()}
    if overrides:
        return [
            {"type": t, "monthly_limit": limit, "is_override": True}
            for t, limit in overrides.items()
        ]
    return [
        {"type": t, "monthly_limit": limit, "is_override": False}
        for t, limit in defaults.items()
    ]


@router.get("/budgets")
def get_budgets():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT type, monthly_limit FROM budgets ORDER BY type")
    rows = cursor.fetchall()
    conn.close()
    return [{"type": row["type"], "monthly_limit": row["monthly_limit"]} for row in rows]


@router.post("/budgets")
def set_budgets(budgets: List[NewBudget]):
    conn = get_connection()
    valid_types = {r["name"] for r in conn.execute("SELECT name FROM expense_types").fetchall()}
    invalid = [b.type for b in budgets if b.type not in valid_types]
    if invalid:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unknown expense types: {invalid}")
    cursor = conn.cursor()
    for b in budgets:
        cursor.execute(
            "INSERT OR REPLACE INTO budgets (type, monthly_limit) VALUES (?, ?)",
            (b.type, b.monthly_limit),
        )
    conn.commit()
    conn.close()
    return [{"type": b.type, "monthly_limit": b.monthly_limit} for b in budgets]


@router.get("/budgets/effective")
def get_effective_budgets(month: str = Query(...)):
    conn = get_connection()
    result = _effective_budgets(conn, month)
    conn.close()
    return result


@router.get("/budgets/effective-range")
def get_effective_range(months: int = Query(6)):
    month_list = _month_range(months)

    # Append next month if it has any budget overrides
    today = date.today()
    nm = today.month + 1
    ny = today.year
    if nm > 12:
        nm = 1
        ny += 1
    next_month = f"{ny}-{nm:02d}"

    conn = get_connection()
    defaults = {r["type"]: r["monthly_limit"]
                for r in conn.execute("SELECT type, monthly_limit FROM budgets").fetchall()}
    has_next_overrides = conn.execute(
        "SELECT 1 FROM monthly_budgets WHERE month = ? LIMIT 1", (next_month,)
    ).fetchone() is not None
    if has_next_overrides:
        month_list.append(next_month)

    placeholders = ",".join("?" * len(month_list))
    all_overrides = conn.execute(
        f"SELECT type, month, monthly_limit FROM monthly_budgets WHERE month IN ({placeholders})",
        month_list,
    ).fetchall()
    conn.close()
    overrides_by_month: dict = {}
    for r in all_overrides:
        overrides_by_month.setdefault(r["month"], {})[r["type"]] = r["monthly_limit"]

    result = []
    for m in month_list:
        mo = overrides_by_month.get(m, {})
        by_type = dict(mo) if mo else dict(defaults)
        result.append({
            "month": m,
            "total": sum(by_type.values()),
            "by_type": by_type,
        })
    return result


@router.get("/budgets/monthly-overrides")
def get_monthly_overrides(month: Optional[str] = Query(None)):
    conn = get_connection()
    if month:
        rows = conn.execute(
            "SELECT type, monthly_limit FROM monthly_budgets WHERE month = ? ORDER BY type",
            (month,),
        ).fetchall()
        conn.close()
        return [{"type": r["type"], "monthly_limit": r["monthly_limit"]} for r in rows]
    else:
        rows = conn.execute(
            "SELECT DISTINCT month FROM monthly_budgets ORDER BY month"
        ).fetchall()
        conn.close()
        return [r["month"] for r in rows]


class MonthlyOverridesPayload(BaseModel):
    month: str
    budgets: List[NewBudget]


@router.post("/budgets/monthly-overrides")
def set_monthly_overrides(payload: MonthlyOverridesPayload):
    conn = get_connection()
    valid_types = {r["name"] for r in conn.execute("SELECT name FROM expense_types").fetchall()}
    invalid = [b.type for b in payload.budgets if b.type not in valid_types]
    if invalid:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unknown expense types: {invalid}")
    cursor = conn.cursor()
    for b in payload.budgets:
        cursor.execute(
            "INSERT OR REPLACE INTO monthly_budgets (type, month, monthly_limit) VALUES (?, ?, ?)",
            (b.type, payload.month, b.monthly_limit),
        )
    conn.commit()
    conn.close()
    return {"month": payload.month, "saved": len(payload.budgets)}


@router.delete("/budgets/monthly-overrides/{month}")
def delete_monthly_overrides(month: str):
    conn = get_connection()
    conn.execute("DELETE FROM monthly_budgets WHERE month = ?", (month,))
    conn.commit()
    conn.close()
    return {"deleted": month}


@router.delete("/budgets/monthly-overrides/{month}/{type_name}")
def delete_monthly_override_type(month: str, type_name: str):
    conn = get_connection()
    conn.execute("DELETE FROM monthly_budgets WHERE month = ? AND type = ?", (month, type_name))
    conn.commit()
    conn.close()
    return {"deleted": type_name, "month": month}
