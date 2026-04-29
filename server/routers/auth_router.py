import uuid
import logging
from fastapi import APIRouter, Depends
from database import get_connection, _DEFAULT_TYPES
from auth import get_current_user

router = APIRouter(prefix="/auth")
logger = logging.getLogger("budget_app.auth")


def _seed_default_types(cursor, user_id: str):
    for name, color, icon, sort_order in _DEFAULT_TYPES:
        cursor.execute(
            "INSERT INTO expense_types (id, name, color, icon, sort_order, is_default, user_id) "
            "VALUES (%s,%s,%s,%s,%s,1,%s) ON CONFLICT (user_id, name) DO NOTHING",
            (str(uuid.uuid4()), name, color, icon, sort_order, user_id),
        )


@router.get("/auth/me")
def me(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    _seed_default_types(cursor, user_id)
    conn.commit()
    conn.close()
    return {"id": user_id}
