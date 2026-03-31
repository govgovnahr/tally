from typing import List
from fastapi import APIRouter
from database import get_connection
from models import NewBudget

router = APIRouter()


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
    cursor = conn.cursor()
    for b in budgets:
        cursor.execute(
            "INSERT OR REPLACE INTO budgets (type, monthly_limit) VALUES (?, ?)",
            (b.type, b.monthly_limit),
        )
    conn.commit()
    conn.close()
    return [{"type": b.type, "monthly_limit": b.monthly_limit} for b in budgets]
