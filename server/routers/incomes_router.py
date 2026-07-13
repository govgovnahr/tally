import uuid
from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from database import get_connection, seed_income_recurring_forward, month_start
from models import Income, NewIncome
from auth import get_current_user

router = APIRouter()

_ALLOWED_SORT = {"name", "date", "amount"}
_INCOME_COLS = "id, name, amount, date, created_at, is_recurring, credit_type"
_DUPLICATE_WINDOW_SECONDS = 5


@router.get("/incomes")
def get_incomes(
    month: Optional[str] = None, period_start: Optional[str] = None, period_end: Optional[str] = None,
    page: int = 1, page_size: int = 50,
    search: Optional[str] = None, sort_by: str = "date", sort_dir: str = "desc",
    user_id: str = Depends(get_current_user),
):
    col = sort_by if sort_by in _ALLOWED_SORT else "date"
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    conn = get_connection()
    cursor = conn.cursor()
    conditions = ["user_id = %s"]
    params = [user_id]
    if period_start and period_end:
        conditions.append("date >= %s AND date < %s")
        params.extend([period_start, period_end])
    elif month:
        conditions.append("LEFT(date, 7) = %s")
        params.append(month)
    if search:
        conditions.append("name ILIKE %s")
        params.append(f"%{search}%")
    where = f"WHERE {' AND '.join(conditions)}"
    cursor.execute(f"SELECT COUNT(*) AS count FROM incomes {where}", params)
    total = cursor.fetchone()["count"]
    offset = (page - 1) * page_size
    cursor.execute(
        f"SELECT {_INCOME_COLS} FROM incomes {where} ORDER BY {col} {direction}, created_at DESC LIMIT %s OFFSET %s",
        params + [page_size, offset],
    )
    rows = cursor.fetchall()
    conn.close()
    return {"incomes": [vars(Income(**dict(r))) for r in rows], "total": total, "page": page, "page_size": page_size}


def income_summary_total(conn, user_id, month=None, period_start=None, period_end=None):
    """Total non-credit income for the window. Extracted for /dashboard reuse.
    Caller owns the connection."""
    cursor = conn.cursor()
    if period_start and period_end:
        cursor.execute(
            "SELECT COALESCE(SUM(amount), 0) as total FROM incomes "
            "WHERE user_id = %s AND date >= %s AND date < %s AND credit_type IS NULL",
            (user_id, period_start, period_end),
        )
    elif month:
        cursor.execute(
            "SELECT COALESCE(SUM(amount), 0) as total FROM incomes "
            "WHERE user_id = %s AND LEFT(date, 7) = %s AND credit_type IS NULL",
            (user_id, month),
        )
    else:
        cursor.execute(
            "SELECT COALESCE(SUM(amount), 0) as total FROM incomes WHERE user_id = %s AND credit_type IS NULL",
            (user_id,),
        )
    return round(cursor.fetchone()["total"], 2)


@router.get("/incomes/summary")
def get_income_summary(
    month: Optional[str] = None, period_start: Optional[str] = None, period_end: Optional[str] = None,
    user_id: str = Depends(get_current_user),
):
    conn = get_connection()
    total = income_summary_total(conn, user_id, month, period_start, period_end)
    conn.close()
    return {"total": total}


@router.get("/incomes/monthly-totals")
def get_income_monthly_totals(months: int = 6, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT LEFT(date, 7) as month, SUM(amount) as total "
        "FROM incomes WHERE user_id = %s AND credit_type IS NULL AND date >= %s "
        "GROUP BY month ORDER BY month ASC",
        (user_id, month_start(months - 1)),
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"month": row["month"], "total": round(row["total"], 2)} for row in rows]


@router.post("/incomes", status_code=201)
def add_income(new_income: NewIncome, user_id: str = Depends(get_current_user)):
    if new_income.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    name = new_income.name.strip()
    amount = round(new_income.amount, 2)

    income = Income(
        id=str(uuid.uuid4()),
        name=name,
        amount=amount,
        date=new_income.date,
        created_at=datetime.now().isoformat(),
        is_recurring=new_income.is_recurring,
        credit_type=new_income.credit_type,
        user_id=user_id,
    )

    conn = get_connection()
    cursor = conn.cursor()

    # Guarded insert folds the double-submit dedup into the write: WHERE NOT EXISTS
    # catches a slow first request the user assumed failed and retried moments later
    # from a different entry point. Keyed on name+amount (not date) since a hand-
    # retyped date can differ between attempts. No RETURNING row → it was a duplicate.
    cutoff = (datetime.now() - timedelta(seconds=_DUPLICATE_WINDOW_SECONDS)).isoformat()
    cursor.execute(
        "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring, credit_type, user_id) "
        "SELECT %s,%s,%s,%s,%s,%s,%s,%s "
        "WHERE NOT EXISTS (SELECT 1 FROM incomes WHERE user_id = %s AND name = %s AND amount = %s AND created_at > %s) "
        "RETURNING id",
        (income.id, income.name, income.amount, income.date, income.created_at, income.is_recurring, income.credit_type, user_id,
         user_id, name, amount, cutoff),
    )
    if cursor.fetchone() is None:
        conn.close()
        raise HTTPException(status_code=409, detail="This looks like a duplicate of an income you just added.")
    conn.commit()
    conn.close()
    if income.is_recurring:
        seed_income_recurring_forward(income.name, income.amount, income.date[:7], user_id, income.credit_type)
    return vars(income)


@router.put("/incomes/{income_id}")
def update_income(income_id: str, updated: NewIncome, user_id: str = Depends(get_current_user)):
    if updated.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE incomes SET name=%s, amount=%s, date=%s, is_recurring=%s, credit_type=%s WHERE id=%s AND user_id=%s RETURNING id",
        (updated.name.strip(), round(updated.amount, 2), updated.date, updated.is_recurring, updated.credit_type, income_id, user_id),
    )
    if cursor.fetchone() is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Income not found")
    conn.commit()
    conn.close()
    if updated.is_recurring:
        seed_income_recurring_forward(updated.name.strip(), round(updated.amount, 2), updated.date[:7], user_id, updated.credit_type)
    return {"id": income_id, "name": updated.name.strip(), "amount": round(updated.amount, 2),
            "date": updated.date, "is_recurring": updated.is_recurring, "credit_type": updated.credit_type}


@router.delete("/incomes/{income_id}")
def delete_income(income_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM incomes WHERE id = %s AND user_id = %s RETURNING id", (income_id, user_id))
    if cursor.fetchone() is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Income not found")
    conn.commit()
    conn.close()
    return {"id": income_id}
