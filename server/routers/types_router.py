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
    cursor.execute("SELECT * FROM expense_types WHERE user_id = %s ORDER BY sort_order, name", (user_id,))
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
    cursor.execute("SELECT id FROM expense_types WHERE name = %s AND user_id = %s", (name, user_id))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="A category with that name already exists.")
    cursor.execute("SELECT MAX(sort_order) AS max_sort FROM expense_types WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    sort_order = (row["max_sort"] or 0) + 1
    new_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO expense_types (id, name, color, icon, sort_order, is_default, user_id) VALUES (%s,%s,%s,%s,%s,0,%s)",
        (new_id, name, body.color, body.icon, sort_order, user_id),
    )
    cursor.execute("SELECT * FROM expense_types WHERE id = %s", (new_id,))
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
    cursor.execute("SELECT * FROM expense_types WHERE id = %s AND user_id = %s", (type_id, user_id))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Category not found.")
    old_name = existing["name"]
    if name != old_name:
        cursor.execute("SELECT id FROM expense_types WHERE name = %s AND user_id = %s AND id != %s", (name, user_id, type_id))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=409, detail="A category with that name already exists.")
        cursor.execute("UPDATE expenses SET type = %s WHERE type = %s AND user_id = %s", (name, old_name, user_id))
        cursor.execute("UPDATE budgets SET type = %s WHERE type = %s AND user_id = %s", (name, old_name, user_id))
        cursor.execute("UPDATE monthly_budgets SET type = %s WHERE type = %s AND user_id = %s", (name, old_name, user_id))
    cursor.execute(
        "UPDATE expense_types SET name = %s, color = %s, icon = %s, macrocategory_id = %s WHERE id = %s AND user_id = %s",
        (name, body.color, body.icon, body.macrocategory_id, type_id, user_id),
    )
    cursor.execute("SELECT * FROM expense_types WHERE id = %s", (type_id,))
    result = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return result


@router.delete("/expense-types/{type_id}")
def delete_type(type_id: str, reassign_to: Optional[str] = None, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expense_types WHERE id = %s AND user_id = %s", (type_id, user_id))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Category not found.")
    if existing["is_default"] and existing["name"] == "Other":
        conn.close()
        raise HTTPException(status_code=403, detail="The 'Other' category cannot be deleted.")
    cursor.execute("SELECT COUNT(*) AS count FROM expenses WHERE type = %s AND user_id = %s", (existing["name"], user_id))
    count = cursor.fetchone()["count"]
    if count > 0 and not reassign_to:
        conn.close()
        raise HTTPException(
            status_code=409,
            detail=f"{count} expense(s) use this category. Reassign them before deleting.",
        )
    if reassign_to:
        cursor.execute("SELECT * FROM expense_types WHERE id = %s AND user_id = %s", (reassign_to, user_id))
        target = cursor.fetchone()
        if not target:
            conn.close()
            raise HTTPException(status_code=400, detail="Reassign target not found.")
        cursor.execute(
            "UPDATE expenses SET type = %s WHERE type = %s AND user_id = %s",
            (target["name"], existing["name"], user_id),
        )
    cursor.execute("DELETE FROM budgets WHERE type = %s AND user_id = %s", (existing["name"], user_id))
    cursor.execute("DELETE FROM monthly_budgets WHERE type = %s AND user_id = %s", (existing["name"], user_id))
    cursor.execute("DELETE FROM expense_types WHERE id = %s AND user_id = %s", (type_id, user_id))
    conn.commit()
    conn.close()
    return {"id": type_id}
