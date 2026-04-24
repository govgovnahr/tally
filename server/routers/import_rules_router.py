import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import get_connection
from auth import get_current_user

router = APIRouter()


class NewImportRule(BaseModel):
    pattern: str
    expense_type: str


@router.get("/import-rules")
def get_import_rules(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM import_rules WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


@router.post("/import-rules", status_code=201)
def upsert_import_rule(rule: NewImportRule, user_id: str = Depends(get_current_user)):
    pattern = rule.pattern.strip()
    if not pattern:
        raise HTTPException(status_code=400, detail="Pattern cannot be empty")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM import_rules WHERE LOWER(pattern) = LOWER(?) AND user_id = ?", (pattern, user_id))
    existing = cursor.fetchone()
    if existing:
        cursor.execute(
            "UPDATE import_rules SET expense_type=?, created_at=? WHERE id=? AND user_id=?",
            (rule.expense_type, datetime.now().isoformat(), existing["id"], user_id),
        )
        rule_id = existing["id"]
    else:
        rule_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO import_rules (id, pattern, expense_type, created_at, user_id) VALUES (?,?,?,?,?)",
            (rule_id, pattern, rule.expense_type, datetime.now().isoformat(), user_id),
        )
    cursor.execute(
        "UPDATE expenses SET type = ? WHERE user_id = ? AND LOWER(name) LIKE ?",
        (rule.expense_type, user_id, f"%{pattern.lower()}%"),
    )
    updated_count = cursor.rowcount
    conn.commit()
    conn.close()
    return {"id": rule_id, "pattern": pattern, "expense_type": rule.expense_type, "updated_count": updated_count}


@router.delete("/import-rules/{rule_id}")
def delete_import_rule(rule_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM import_rules WHERE id=? AND user_id=?", (rule_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Rule not found")
    cursor.execute("DELETE FROM import_rules WHERE id=? AND user_id=?", (rule_id, user_id))
    conn.commit()
    conn.close()
    return {"id": rule_id}
