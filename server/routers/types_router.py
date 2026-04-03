import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException
from database import get_connection
from models import NewExpenseType

router = APIRouter()


@router.get("/expense-types")
def get_types():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expense_types ORDER BY sort_order, name")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


@router.post("/expense-types", status_code=201)
def create_type(body: NewExpenseType):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM expense_types WHERE name = ?", (name,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="A category with that name already exists.")
    cursor.execute("SELECT MAX(sort_order) FROM expense_types")
    row = cursor.fetchone()
    sort_order = (row[0] or 0) + 1
    new_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO expense_types (id, name, color, icon, sort_order, is_default) VALUES (?,?,?,?,?,0)",
        (new_id, name, body.color, body.icon, sort_order),
    )
    cursor.execute("SELECT * FROM expense_types WHERE id = ?", (new_id,))
    result = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return result


@router.put("/expense-types/{type_id}")
def update_type(type_id: str, body: NewExpenseType):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expense_types WHERE id = ?", (type_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Category not found.")
    old_name = existing["name"]
    if name != old_name:
        cursor.execute("SELECT id FROM expense_types WHERE name = ? AND id != ?", (name, type_id))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=409, detail="A category with that name already exists.")
        cursor.execute("UPDATE expenses SET type = ? WHERE type = ?", (name, old_name))
        cursor.execute("UPDATE budgets SET type = ? WHERE type = ?", (name, old_name))
    cursor.execute(
        "UPDATE expense_types SET name = ?, color = ?, icon = ?, macrocategory_id = ? WHERE id = ?",
        (name, body.color, body.icon, body.macrocategory_id, type_id),
    )
    cursor.execute("SELECT * FROM expense_types WHERE id = ?", (type_id,))
    result = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return result


@router.delete("/expense-types/{type_id}")
def delete_type(type_id: str, reassign_to: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expense_types WHERE id = ?", (type_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Category not found.")
    if existing["is_default"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Default categories cannot be deleted.")
    cursor.execute("SELECT COUNT(*) as count FROM expenses WHERE type = ?", (existing["name"],))
    count = cursor.fetchone()["count"]
    if count > 0 and not reassign_to:
        conn.close()
        raise HTTPException(
            status_code=409,
            detail=f"{count} expense(s) use this category. Reassign them before deleting.",
        )
    if reassign_to:
        cursor.execute("SELECT * FROM expense_types WHERE id = ?", (reassign_to,))
        target = cursor.fetchone()
        if not target:
            conn.close()
            raise HTTPException(status_code=400, detail="Reassign target not found.")
        cursor.execute(
            "UPDATE expenses SET type = ? WHERE type = ?",
            (target["name"], existing["name"]),
        )
    cursor.execute("DELETE FROM budgets WHERE type = ?", (existing["name"],))
    cursor.execute("DELETE FROM expense_types WHERE id = ?", (type_id,))
    conn.commit()
    conn.close()
    return {"id": type_id}
