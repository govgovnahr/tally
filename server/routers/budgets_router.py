from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_connection
from models import NewBudget
from pydantic import BaseModel
from datetime import date
from auth import get_current_user

router = APIRouter()


def _month_range(months: int) -> list[str]:
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


def _effective_budgets(conn, month: str, user_id: str) -> list[dict]:
    defaults = {r["type"]: r["monthly_limit"]
                for r in conn.execute("SELECT type, monthly_limit FROM budgets WHERE user_id = %s", (user_id,)).fetchall()}
    overrides = {r["type"]: r["monthly_limit"]
                 for r in conn.execute(
                     "SELECT type, monthly_limit FROM monthly_budgets WHERE user_id = %s AND month = %s", (user_id, month)
                 ).fetchall()}
    if overrides:
        return [{"type": t, "monthly_limit": limit, "is_override": True} for t, limit in overrides.items()]
    return [{"type": t, "monthly_limit": limit, "is_override": False} for t, limit in defaults.items()]


@router.get("/budgets")
def get_budgets(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT type, monthly_limit FROM budgets WHERE user_id = %s ORDER BY type", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{"type": row["type"], "monthly_limit": row["monthly_limit"]} for row in rows]


@router.post("/budgets")
def set_budgets(budgets: List[NewBudget], user_id: str = Depends(get_current_user)):
    conn = get_connection()
    valid_types = {r["name"] for r in conn.execute("SELECT name FROM expense_types WHERE user_id = %s", (user_id,)).fetchall()}
    invalid = [b.type for b in budgets if b.type not in valid_types]
    if invalid:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unknown expense types: {invalid}")
    cursor = conn.cursor()
    for b in budgets:
        cursor.execute(
            "INSERT INTO budgets (user_id, type, monthly_limit) VALUES (%s, %s, %s) ON CONFLICT (user_id, type) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit",
            (user_id, b.type, b.monthly_limit),
        )
    conn.commit()
    conn.close()
    return [{"type": b.type, "monthly_limit": b.monthly_limit} for b in budgets]


@router.get("/budgets/effective")
def get_effective_budgets(month: str = Query(...), user_id: str = Depends(get_current_user)):
    conn = get_connection()
    result = _effective_budgets(conn, month, user_id)
    conn.close()
    return result


@router.get("/budgets/effective-range")
def get_effective_range(months: int = Query(6), user_id: str = Depends(get_current_user)):
    month_list = _month_range(months)

    today = date.today()

    conn = get_connection()
    defaults = {r["type"]: r["monthly_limit"]
                for r in conn.execute("SELECT type, monthly_limit FROM budgets WHERE user_id = %s", (user_id,)).fetchall()}
    for i in range(1, 7):
        nm = today.month + i
        ny = today.year + (nm - 1) // 12
        nm = ((nm - 1) % 12) + 1
        future_m = f"{ny}-{nm:02d}"
        has = conn.execute(
            "SELECT 1 FROM monthly_budgets WHERE user_id = %s AND month = %s LIMIT 1", (user_id, future_m)
        ).fetchone() is not None
        if has and future_m not in month_list:
            month_list.append(future_m)

    placeholders = ",".join(["%s"] * len(month_list))
    all_overrides = conn.execute(
        f"SELECT type, month, monthly_limit FROM monthly_budgets WHERE user_id = %s AND month IN ({placeholders})",
        [user_id] + month_list,
    ).fetchall()
    conn.close()
    overrides_by_month: dict = {}
    for r in all_overrides:
        overrides_by_month.setdefault(r["month"], {})[r["type"]] = r["monthly_limit"]

    result = []
    for m in month_list:
        mo = overrides_by_month.get(m, {})
        by_type = dict(mo) if mo else dict(defaults)
        result.append({"month": m, "total": sum(by_type.values()), "by_type": by_type})
    return result


@router.get("/budgets/monthly-overrides")
def get_monthly_overrides(month: Optional[str] = Query(None), user_id: str = Depends(get_current_user)):
    conn = get_connection()
    if month:
        rows = conn.execute(
            "SELECT type, monthly_limit FROM monthly_budgets WHERE user_id = %s AND month = %s ORDER BY type",
            (user_id, month),
        ).fetchall()
        conn.close()
        return [{"type": r["type"], "monthly_limit": r["monthly_limit"]} for r in rows]
    else:
        rows = conn.execute(
            "SELECT DISTINCT month FROM monthly_budgets WHERE user_id = %s ORDER BY month", (user_id,)
        ).fetchall()
        conn.close()
        return [r["month"] for r in rows]


class MonthlyOverridesPayload(BaseModel):
    month: str
    budgets: List[NewBudget]


@router.post("/budgets/monthly-overrides")
def set_monthly_overrides(payload: MonthlyOverridesPayload, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    valid_types = {r["name"] for r in conn.execute("SELECT name FROM expense_types WHERE user_id = %s", (user_id,)).fetchall()}
    invalid = [b.type for b in payload.budgets if b.type not in valid_types]
    if invalid:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unknown expense types: {invalid}")
    cursor = conn.cursor()
    for b in payload.budgets:
        cursor.execute(
            "INSERT INTO monthly_budgets (user_id, type, month, monthly_limit) VALUES (%s, %s, %s, %s) ON CONFLICT (user_id, type, month) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit",
            (user_id, b.type, payload.month, b.monthly_limit),
        )
    conn.commit()
    conn.close()
    return {"month": payload.month, "saved": len(payload.budgets)}


@router.delete("/budgets/monthly-overrides/{month}")
def delete_monthly_overrides(month: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    conn.execute("DELETE FROM monthly_budgets WHERE user_id = %s AND month = %s", (user_id, month))
    conn.commit()
    conn.close()
    return {"deleted": month}


@router.delete("/budgets/monthly-overrides/{month}/{type_name}")
def delete_monthly_override_type(month: str, type_name: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    conn.execute("DELETE FROM monthly_budgets WHERE user_id = %s AND month = %s AND type = %s", (user_id, month, type_name))
    conn.commit()
    conn.close()
    return {"deleted": type_name, "month": month}
