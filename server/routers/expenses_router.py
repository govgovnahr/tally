import calendar
import uuid
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_connection, seed_recurring_forward, month_start, get_user_settings, cycle_period_for_date
from models import Expense, Expenses, NewExpense, TypeSummary
from auth import get_current_user

router = APIRouter()

_EXPENSE_COLS = "id, name, amount, type, date, created_at, is_recurring, subcategory"
_ALLOWED_SORT = {"name", "date", "amount"}


def _valid_type_names(conn, user_id: str):
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM expense_types WHERE user_id = %s", (user_id,))
    return [row["name"] for row in cursor.fetchall()]


@router.get("/expenses")
def get_expenses(
    type: Optional[str] = None, month: Optional[str] = None, macrocategory_id: Optional[str] = None,
    subcategory: Optional[str] = None,
    period_start: Optional[str] = None, period_end: Optional[str] = None,
    page: int = 1, page_size: int = 50, search: Optional[str] = None,
    sort_by: str = "date", sort_dir: str = "desc",
    user_id: str = Depends(get_current_user),
):
    col = sort_by if sort_by in _ALLOWED_SORT else "date"
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    conn = get_connection()
    cursor = conn.cursor()
    conditions = ["user_id = %s"]
    params = [user_id]
    if type:
        conditions.append("type = %s")
        params.append(type)
    if subcategory:
        conditions.append("subcategory = %s")
        params.append(subcategory)
    if macrocategory_id:
        conditions.append("type IN (SELECT name FROM expense_types WHERE macrocategory_id = %s AND user_id = %s)")
        params.extend([macrocategory_id, user_id])
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
    cursor.execute(f"SELECT COUNT(*) AS count FROM expenses {where}", params)
    total = cursor.fetchone()["count"]
    offset = (page - 1) * page_size
    cursor.execute(
        f"SELECT {_EXPENSE_COLS} FROM expenses {where} ORDER BY {col} {direction}, created_at DESC LIMIT %s OFFSET %s",
        params + [page_size, offset],
    )
    rows = cursor.fetchall()
    conn.close()
    expenses = [Expense(**dict(row)) for row in rows]
    return {"expenses": [vars(e) for e in expenses], "total": total, "page": page, "page_size": page_size}


@router.post("/expenses")
def add_expense(new_expense: NewExpense, user_id: str = Depends(get_current_user)):
    expense = Expense(
        id=str(uuid.uuid4()),
        name=new_expense.name.strip(),
        amount=round(new_expense.amount, 2),
        type=new_expense.type,
        date=new_expense.date,
        created_at=datetime.now().isoformat(),
        is_recurring=new_expense.is_recurring,
        subcategory=new_expense.subcategory,
    )

    conn = get_connection()
    cursor = conn.cursor()
    # Guarded insert: the WHERE EXISTS validates the type in the same round trip
    # as the write. rowcount 0 (no RETURNING row) means the type was invalid —
    # the only reason this can fail to insert — so it's unambiguously a 400.
    cursor.execute(
        "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id, subcategory) "
        "SELECT %s,%s,%s,%s,%s,%s,%s,%s,%s "
        "WHERE EXISTS (SELECT 1 FROM expense_types WHERE user_id = %s AND name = %s) "
        "RETURNING id",
        (expense.id, expense.name, expense.amount, expense.type, expense.date, expense.created_at, expense.is_recurring, user_id,
         expense.subcategory, user_id, expense.type),
    )
    if cursor.fetchone() is None:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid expense type")
    conn.commit()
    conn.close()

    if expense.is_recurring:
        seed_recurring_forward(expense.name, expense.amount, expense.type, expense.date[:7], user_id)

    return vars(expense)


@router.get("/expenses/months")
def get_months(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    settings = get_user_settings(conn, user_id)
    cycle_start_day = settings["cycle_start_day"]
    cursor = conn.cursor()
    cursor.execute(
        "SELECT DISTINCT LEFT(date, 7) as month FROM expenses WHERE user_id = %s ORDER BY month",
        (user_id,),
    )
    calendar_months = [row["month"] for row in cursor.fetchall()]
    conn.close()

    if cycle_start_day == 1:
        return calendar_months

    # A populated calendar month may map to one or two cycle periods (a period
    # can span two calendar months) — checking both the first and last day of
    # each populated calendar month guarantees no period with data is missed.
    labels = set()
    for ym in calendar_months:
        y, m = map(int, ym.split("-"))
        first_day = date(y, m, 1)
        last_day = date(y, m, calendar.monthrange(y, m)[1])
        labels.add(cycle_period_for_date(first_day, cycle_start_day)[2])
        labels.add(cycle_period_for_date(last_day, cycle_start_day)[2])
    return sorted(labels)


@router.get("/expenses/subcategories")
def get_subcategories(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT DISTINCT subcategory FROM expenses "
        "WHERE user_id = %s AND subcategory IS NOT NULL AND subcategory != '' "
        "ORDER BY subcategory",
        (user_id,),
    )
    result = [row["subcategory"] for row in cursor.fetchall()]
    conn.close()
    return result


def summary_rows(conn, user_id, month=None, period_start=None, period_end=None):
    """Per-type spend summary. Extracted so the /dashboard aggregate can reuse it
    without a second HTTP round trip. Caller owns the connection."""
    cursor = conn.cursor()
    if period_start and period_end:
        cursor.execute(
            "SELECT type, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE user_id = %s AND date >= %s AND date < %s GROUP BY type ORDER BY total DESC",
            (user_id, period_start, period_end),
        )
    elif month:
        cursor.execute(
            "SELECT type, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE user_id = %s AND LEFT(date, 7) = %s GROUP BY type ORDER BY total DESC",
            (user_id, month),
        )
    else:
        cursor.execute(
            "SELECT type, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE user_id = %s GROUP BY type ORDER BY total DESC",
            (user_id,),
        )
    rows = cursor.fetchall()
    return [{"type": row["type"], "total": round(row["total"], 2), "count": row["count"]} for row in rows]


@router.get("/expenses/summary")
def get_summary(
    month: Optional[str] = None, period_start: Optional[str] = None, period_end: Optional[str] = None,
    user_id: str = Depends(get_current_user),
):
    conn = get_connection()
    result = summary_rows(conn, user_id, month, period_start, period_end)
    conn.close()
    return result


@router.get("/expenses/monthly-totals")
def get_monthly_totals(months: int = 6, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT LEFT(date, 7) as month, SUM(amount) as total "
        "FROM expenses WHERE user_id = %s AND date >= %s "
        "GROUP BY month ORDER BY month ASC",
        (user_id, month_start(months - 1)),
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"month": row["month"], "total": round(row["total"], 2)} for row in rows]


@router.get("/expenses/monthly-by-type")
def get_monthly_by_type(months: int = 6, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT LEFT(date, 7) as month, type, SUM(amount) as total "
        "FROM expenses WHERE user_id = %s AND date >= %s "
        "GROUP BY month, type ORDER BY month ASC",
        (user_id, month_start(months - 1)),
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"month": row["month"], "type": row["type"], "total": round(row["total"], 2)} for row in rows]


@router.put("/expenses/{expense_id}")
def update_expense(expense_id: str, updated: NewExpense, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    valid = _valid_type_names(conn, user_id)
    if updated.type not in valid:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid expense type. Must be one of: {valid}")
    if updated.amount <= 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    cursor = conn.cursor()
    # Type already validated above (keeps 400-vs-404 distinct); RETURNING folds
    # the existence check into the UPDATE — no row back means id/user_id missed → 404.
    cursor.execute(
        "UPDATE expenses SET name=%s, amount=%s, type=%s, date=%s, is_recurring=%s, subcategory=%s WHERE id=%s AND user_id=%s RETURNING id",
        (updated.name.strip(), round(updated.amount, 2), updated.type, updated.date, updated.is_recurring, updated.subcategory, expense_id, user_id),
    )
    if cursor.fetchone() is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Expense not found")
    conn.commit()
    conn.close()

    if updated.is_recurring:
        seed_recurring_forward(updated.name.strip(), round(updated.amount, 2), updated.type, updated.date[:7], user_id)

    return {"id": expense_id, "name": updated.name.strip(), "amount": round(updated.amount, 2),
            "type": updated.type, "date": updated.date, "is_recurring": updated.is_recurring,
            "subcategory": updated.subcategory}


@router.delete("/transactions")
def clear_transactions(
    month: Optional[str] = Query(None), period_start: Optional[str] = Query(None), period_end: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    if period_start and period_end:
        cursor.execute("DELETE FROM expenses WHERE user_id = %s AND date >= %s AND date < %s", (user_id, period_start, period_end))
        cursor.execute("DELETE FROM incomes WHERE user_id = %s AND date >= %s AND date < %s", (user_id, period_start, period_end))
    elif month:
        cursor.execute("DELETE FROM expenses WHERE user_id = %s AND LEFT(date, 7) = %s", (user_id, month))
        cursor.execute("DELETE FROM incomes WHERE user_id = %s AND LEFT(date, 7) = %s", (user_id, month))
    else:
        cursor.execute("DELETE FROM expenses WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM incomes WHERE user_id = %s", (user_id,))
    conn.commit()
    conn.close()
    return {"cleared": True}


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM expenses WHERE id = %s AND user_id = %s RETURNING id", (expense_id, user_id))
    if cursor.fetchone() is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Expense not found")
    conn.commit()
    conn.close()
    return {"id": expense_id}
