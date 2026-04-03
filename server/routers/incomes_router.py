import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from database import get_connection, seed_income_recurring_forward
from models import Income, NewIncome

router = APIRouter()


@router.get("/incomes")
def get_incomes(month: Optional[str] = None, page: int = 1, page_size: int = 50):
    conn = get_connection()
    cursor = conn.cursor()
    if month:
        cursor.execute(
            "SELECT COUNT(*) FROM incomes WHERE strftime('%Y-%m', date) = ?", (month,)
        )
        total = cursor.fetchone()[0]
        offset = (page - 1) * page_size
        cursor.execute(
            "SELECT * FROM incomes WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?",
            (month, page_size, offset),
        )
    else:
        cursor.execute("SELECT COUNT(*) FROM incomes")
        total = cursor.fetchone()[0]
        offset = (page - 1) * page_size
        cursor.execute(
            "SELECT * FROM incomes ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?",
            (page_size, offset),
        )
    rows = cursor.fetchall()
    conn.close()
    return {"incomes": [vars(Income(**dict(r))) for r in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/incomes/summary")
def get_income_summary(month: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    if month:
        cursor.execute(
            "SELECT COALESCE(SUM(amount), 0) as total FROM incomes WHERE strftime('%Y-%m', date) = ?",
            (month,),
        )
    else:
        cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM incomes")
    total = cursor.fetchone()["total"]
    conn.close()
    return {"total": round(total, 2)}


@router.get("/incomes/monthly-totals")
def get_income_monthly_totals(months: int = 6):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT strftime('%Y-%m', date) as month, SUM(amount) as total "
        f"FROM incomes "
        f"WHERE date >= date('now', 'start of month', '-{months - 1} months') "
        f"GROUP BY month ORDER BY month ASC"
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"month": row["month"], "total": round(row["total"], 2)} for row in rows]


@router.post("/incomes", status_code=201)
def add_income(new_income: NewIncome):
    if new_income.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    income = Income(
        id=str(uuid.uuid4()),
        name=new_income.name.strip(),
        amount=round(new_income.amount, 2),
        date=new_income.date,
        created_at=datetime.now().isoformat(),
        is_recurring=new_income.is_recurring,
    )
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring) VALUES (?,?,?,?,?,?)",
        (income.id, income.name, income.amount, income.date, income.created_at, income.is_recurring),
    )
    conn.commit()
    conn.close()
    if income.is_recurring:
        seed_income_recurring_forward(income.name, income.amount, income.date[:7])
    return vars(income)


@router.put("/incomes/{income_id}")
def update_income(income_id: str, updated: NewIncome):
    if updated.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM incomes WHERE id = ?", (income_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Income not found")
    cursor.execute(
        "UPDATE incomes SET name=?, amount=?, date=?, is_recurring=? WHERE id=?",
        (updated.name.strip(), round(updated.amount, 2), updated.date, updated.is_recurring, income_id),
    )
    conn.commit()
    conn.close()
    if updated.is_recurring:
        seed_income_recurring_forward(updated.name.strip(), round(updated.amount, 2), updated.date[:7])
    return {"id": income_id, "name": updated.name.strip(), "amount": round(updated.amount, 2),
            "date": updated.date, "is_recurring": updated.is_recurring}


@router.delete("/incomes/{income_id}")
def delete_income(income_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM incomes WHERE id = ?", (income_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Income not found")
    cursor.execute("DELETE FROM incomes WHERE id = ?", (income_id,))
    conn.commit()
    conn.close()
    return {"id": income_id}
