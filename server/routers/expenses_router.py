import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from database import get_connection, seed_recurring_forward
from models import Expense, Expenses, NewExpense, TypeSummary

router = APIRouter()


def _valid_type_names(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM expense_types")
    return [row["name"] for row in cursor.fetchall()]


_ALLOWED_SORT = {"name", "date", "amount"}

@router.get("/expenses")
def get_expenses(type: Optional[str] = None, month: Optional[str] = None, macrocategory_id: Optional[str] = None,
                 page: int = 1, page_size: int = 50, search: Optional[str] = None,
                 sort_by: str = "date", sort_dir: str = "desc"):
    col = sort_by if sort_by in _ALLOWED_SORT else "date"
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    conn = get_connection()
    cursor = conn.cursor()
    conditions = []
    params = []
    if type:
        conditions.append("type = ?")
        params.append(type)
    if macrocategory_id:
        conditions.append("type IN (SELECT name FROM expense_types WHERE macrocategory_id = ?)")
        params.append(macrocategory_id)
    if month:
        conditions.append("strftime('%Y-%m', date) = ?")
        params.append(month)
    if search:
        conditions.append("name LIKE ?")
        params.append(f"%{search}%")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    cursor.execute(f"SELECT COUNT(*) FROM expenses {where}", params)
    total = cursor.fetchone()[0]
    offset = (page - 1) * page_size
    cursor.execute(
        f"SELECT * FROM expenses {where} ORDER BY {col} {direction}, created_at DESC LIMIT ? OFFSET ?",
        params + [page_size, offset],
    )
    rows = cursor.fetchall()
    conn.close()
    expenses = [Expense(**dict(row)) for row in rows]
    return {"expenses": [vars(e) for e in expenses], "total": total, "page": page, "page_size": page_size}


@router.post("/expenses")
def add_expense(new_expense: NewExpense):
    conn = get_connection()
    valid = _valid_type_names(conn)
    if new_expense.type not in valid:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid expense type. Must be one of: {valid}")
    if new_expense.amount <= 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    expense = Expense(
        id=str(uuid.uuid4()),
        name=new_expense.name.strip(),
        amount=round(new_expense.amount, 2),
        type=new_expense.type,
        date=new_expense.date,
        created_at=datetime.now().isoformat(),
        is_recurring=new_expense.is_recurring,
    )

    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring) VALUES (?,?,?,?,?,?,?)",
        (expense.id, expense.name, expense.amount, expense.type, expense.date, expense.created_at, expense.is_recurring),
    )
    conn.commit()
    conn.close()

    if expense.is_recurring:
        seed_recurring_forward(expense.name, expense.amount, expense.type, expense.date[:7])

    return vars(expense)


@router.get("/expenses/months")
def get_months():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT DISTINCT strftime('%Y-%m', date) as month FROM expenses ORDER BY month"
    )
    months = [row["month"] for row in cursor.fetchall()]
    conn.close()
    return months


@router.get("/expenses/summary")
def get_summary(month: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    if month:
        cursor.execute(
            "SELECT type, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE strftime('%Y-%m', date) = ? GROUP BY type ORDER BY total DESC",
            (month,),
        )
    else:
        cursor.execute(
            "SELECT type, SUM(amount) as total, COUNT(*) as count FROM expenses GROUP BY type ORDER BY total DESC"
        )
    rows = cursor.fetchall()
    conn.close()
    return [{"type": row["type"], "total": round(row["total"], 2), "count": row["count"]} for row in rows]


@router.get("/expenses/monthly-totals")
def get_monthly_totals(months: int = 6):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT strftime('%Y-%m', date) as month, SUM(amount) as total "
        f"FROM expenses "
        f"WHERE date >= date('now', 'start of month', '-{months - 1} months') "
        f"GROUP BY month ORDER BY month ASC"
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"month": row["month"], "total": round(row["total"], 2)} for row in rows]


@router.get("/expenses/monthly-by-type")
def get_monthly_by_type(months: int = 6):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT strftime('%Y-%m', date) as month, type, SUM(amount) as total "
        f"FROM expenses "
        f"WHERE date >= date('now', 'start of month', '-{months - 1} months') "
        f"GROUP BY month, type ORDER BY month ASC"
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"month": row["month"], "type": row["type"], "total": round(row["total"], 2)} for row in rows]


@router.put("/expenses/{expense_id}")
def update_expense(expense_id: str, updated: NewExpense):
    conn = get_connection()
    valid = _valid_type_names(conn)
    if updated.type not in valid:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid expense type. Must be one of: {valid}")
    if updated.amount <= 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    cursor = conn.cursor()
    cursor.execute("SELECT id FROM expenses WHERE id = ?", (expense_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Expense not found")

    cursor.execute(
        "UPDATE expenses SET name=?, amount=?, type=?, date=?, is_recurring=? WHERE id=?",
        (updated.name.strip(), round(updated.amount, 2), updated.type, updated.date, updated.is_recurring, expense_id),
    )
    conn.commit()
    conn.close()

    if updated.is_recurring:
        seed_recurring_forward(updated.name.strip(), round(updated.amount, 2), updated.type, updated.date[:7])

    return {"id": expense_id, "name": updated.name.strip(), "amount": round(updated.amount, 2),
            "type": updated.type, "date": updated.date, "is_recurring": updated.is_recurring}


@router.delete("/transactions")
def clear_transactions(month: Optional[str] = Query(None)):
    conn = get_connection()
    cursor = conn.cursor()
    if month:
        cursor.execute("DELETE FROM expenses WHERE strftime('%Y-%m', date) = ?", (month,))
        cursor.execute("DELETE FROM incomes WHERE strftime('%Y-%m', date) = ?", (month,))
    else:
        cursor.execute("DELETE FROM expenses")
        cursor.execute("DELETE FROM incomes")
    conn.commit()
    conn.close()
    return {"cleared": True}


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
