import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from database import get_connection
from models import Expense, Expenses, NewExpense, TypeSummary

router = APIRouter()

EXPENSE_TYPES = ["Food", "Transport", "Housing", "Entertainment", "Health", "Other"]


@router.get("/expenses")
def get_expenses(type: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    if type:
        cursor.execute(
            "SELECT * FROM expenses WHERE type = ? ORDER BY date DESC, created_at DESC",
            (type,),
        )
    else:
        cursor.execute("SELECT * FROM expenses ORDER BY date DESC, created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    expenses = [Expense(**dict(row)) for row in rows]
    return {"expenses": [vars(e) for e in expenses]}


@router.post("/expenses")
def add_expense(new_expense: NewExpense):
    if new_expense.type not in EXPENSE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid expense type. Must be one of: {EXPENSE_TYPES}")
    if new_expense.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    expense = Expense(
        id=str(uuid.uuid4()),
        name=new_expense.name.strip(),
        amount=round(new_expense.amount, 2),
        type=new_expense.type,
        date=new_expense.date,
        created_at=datetime.now().isoformat(),
    )

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO expenses (id, name, amount, type, date, created_at) VALUES (?,?,?,?,?,?)",
        (expense.id, expense.name, expense.amount, expense.type, expense.date, expense.created_at),
    )
    conn.commit()
    conn.close()
    return vars(expense)


@router.get("/expenses/summary")
def get_summary():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT type, SUM(amount) as total, COUNT(*) as count FROM expenses GROUP BY type ORDER BY total DESC"
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"type": row["type"], "total": round(row["total"], 2), "count": row["count"]} for row in rows]


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM expenses WHERE id = ?", (expense_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Expense not found")
    cursor.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    conn.commit()
    conn.close()
    return {"id": expense_id}
