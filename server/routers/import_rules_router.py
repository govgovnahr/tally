import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from database import get_connection
from auth import get_current_user
from models import _normalize_subcategory

router = APIRouter()


class NewImportRule(BaseModel):
    pattern: str = Field(min_length=1, max_length=200)
    expense_type: str = Field(min_length=1, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)

    _vsubcat = field_validator("subcategory")(_normalize_subcategory)


@router.get("/import-rules")
def get_import_rules(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM import_rules WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
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
    cursor.execute("SELECT id FROM import_rules WHERE LOWER(pattern) = LOWER(%s) AND user_id = %s", (pattern, user_id))
    existing = cursor.fetchone()
    if existing:
        cursor.execute(
            "UPDATE import_rules SET expense_type=%s, subcategory=%s, created_at=%s WHERE id=%s AND user_id=%s",
            (rule.expense_type, rule.subcategory, datetime.now().isoformat(), existing["id"], user_id),
        )
        rule_id = existing["id"]
    else:
        rule_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO import_rules (id, pattern, expense_type, subcategory, created_at, user_id) VALUES (%s,%s,%s,%s,%s,%s)",
            (rule_id, pattern, rule.expense_type, rule.subcategory, datetime.now().isoformat(), user_id),
        )
    # Only overwrite subcategory on matching expenses when the rule specifies one —
    # a type-only rule shouldn't null out subcategories those expenses already have.
    if rule.subcategory:
        cursor.execute(
            "UPDATE expenses SET type = %s, subcategory = %s WHERE user_id = %s AND LOWER(name) LIKE %s",
            (rule.expense_type, rule.subcategory, user_id, f"%{pattern.lower()}%"),
        )
    else:
        cursor.execute(
            "UPDATE expenses SET type = %s WHERE user_id = %s AND LOWER(name) LIKE %s",
            (rule.expense_type, user_id, f"%{pattern.lower()}%"),
        )
    updated_count = cursor.rowcount
    conn.commit()
    conn.close()
    return {"id": rule_id, "pattern": pattern, "expense_type": rule.expense_type,
            "subcategory": rule.subcategory, "updated_count": updated_count}


@router.delete("/import-rules/{rule_id}")
def delete_import_rule(rule_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM import_rules WHERE id=%s AND user_id=%s", (rule_id, user_id))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Rule not found")
    cursor.execute("DELETE FROM import_rules WHERE id=%s AND user_id=%s", (rule_id, user_id))
    conn.commit()
    conn.close()
    return {"id": rule_id}
