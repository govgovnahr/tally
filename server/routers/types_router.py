import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from database import get_connection
from models import NewExpenseType
from auth import get_current_user

router = APIRouter()


@router.get("/expense-types")
def get_types(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expense_types WHERE user_id = ? ORDER BY sort_order, name", (user_id,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


@router.post("/expense-types", status_code=201)
def create_type(body: NewExpenseType, user_id: str = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM expense_types WHERE name = ? AND user_id = ?", (name, user_id))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="A category with that name already exists.")
    cursor.execute("SELECT MAX(sort_order) FROM expense_types WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    sort_order = (row[0] or 0) + 1
    new_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO expense_types (id, name, color, icon, sort_order, is_default, user_id) VALUES (?,?,?,?,?,0,?)",
        (new_id, name, body.color, body.icon, sort_order, user_id),
    )
    cursor.execute("SELECT * FROM expense_types WHERE id = ?", (new_id,))
    result = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return result


@router.put("/expense-types/{type_id}")
def update_type(type_id: str, body: NewExpenseType, user_id: str = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expense_types WHERE id = ? AND user_id = ?", (type_id, user_id))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Category not found.")
    old_name = existing["name"]
    if name != old_name:
        cursor.execute("SELECT id FROM expense_types WHERE name = ? AND user_id = ? AND id != ?", (name, user_id, type_id))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=409, detail="A category with that name already exists.")
        cursor.execute("UPDATE expenses SET type = ? WHERE type = ? AND user_id = ?", (name, old_name, user_id))
        cursor.execute("UPDATE budgets SET type = ? WHERE type = ? AND user_id = ?", (name, old_name, user_id))
        cursor.execute("UPDATE monthly_budgets SET type = ? WHERE type = ? AND user_id = ?", (name, old_name, user_id))
    cursor.execute(
        "UPDATE expense_types SET name = ?, color = ?, icon = ?, macrocategory_id = ? WHERE id = ? AND user_id = ?",
        (name, body.color, body.icon, body.macrocategory_id, type_id, user_id),
    )
    cursor.execute("SELECT * FROM expense_types WHERE id = ?", (type_id,))
    result = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return result


@router.delete("/expense-types/{type_id}")
def delete_type(type_id: str, reassign_to: Optional[str] = None, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expense_types WHERE id = ? AND user_id = ?", (type_id, user_id))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Category not found.")
    if existing["is_default"] and existing["name"] == "Other":
        conn.close()
        raise HTTPException(status_code=403, detail="The 'Other' category cannot be deleted.")
    cursor.execute("SELECT COUNT(*) as count FROM expenses WHERE type = ? AND user_id = ?", (existing["name"], user_id))
    count = cursor.fetchone()["count"]
    if count > 0 and not reassign_to:
        conn.close()
        raise HTTPException(
            status_code=409,
            detail=f"{count} expense(s) use this category. Reassign them before deleting.",
        )
    if reassign_to:
        cursor.execute("SELECT * FROM expense_types WHERE id = ? AND user_id = ?", (reassign_to, user_id))
        target = cursor.fetchone()
        if not target:
            conn.close()
            raise HTTPException(status_code=400, detail="Reassign target not found.")
        cursor.execute(
            "UPDATE expenses SET type = ? WHERE type = ? AND user_id = ?",
            (target["name"], existing["name"], user_id),
        )
    cursor.execute("DELETE FROM budgets WHERE type = ? AND user_id = ?", (existing["name"], user_id))
    cursor.execute("DELETE FROM monthly_budgets WHERE type = ? AND user_id = ?", (existing["name"], user_id))
    cursor.execute("DELETE FROM expense_types WHERE id = ? AND user_id = ?", (type_id, user_id))
    conn.commit()
    conn.close()
    return {"id": type_id}
