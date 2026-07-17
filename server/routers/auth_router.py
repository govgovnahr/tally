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


@router.get("/me")
def me(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    _seed_default_types(cursor, user_id)
    conn.commit()
    conn.close()
    return {"id": user_id}


_CATEGORY_TABLES = {
    "expenses":     (["expenses"], None),
    "income":       (["incomes"], None),
    "budgets":      (["monthly_budgets", "budgets"], None),
    "savings":      (["savings_contributions", "savings_goals"], None),
    "import-rules": (["import_rules"], None),
    "categories":   (["expense_types"], "reseed"),
    "groups":       (["macrocategories"], "nullify_macro"),
}


@router.delete("/data/{category}")
def clear_category(category: str, user_id: str = Depends(get_current_user)):
    if category not in _CATEGORY_TABLES:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown category: {category}")
    tables, special = _CATEGORY_TABLES[category]
    conn = get_connection()
    cursor = conn.cursor()
    if special == "nullify_macro":
        cursor.execute("UPDATE expense_types SET macrocategory_id = NULL WHERE user_id = %s", (user_id,))
    for table in tables:
        cursor.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))
    if special == "reseed":
        _seed_default_types(cursor, user_id)
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/data")
def clear_all_data(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    # Transactional/derived data only — deliberately excludes user_settings
    # (account preferences like cycle_start_day/ai_enabled aren't "data" a
    # user clearing their expenses would expect to lose) and is therefore a
    # curated subset of database.py's _USER_OWNED_TABLES, not that full list.
    # transaction_embeddings IS included: it's derived 1:1 from expenses/
    # incomes/goals, so leaving it out orphans embeddings for data that no
    # longer exists.
    for table in [
        "savings_contributions",
        "savings_goals",
        "expenses",
        "incomes",
        "budgets",
        "monthly_budgets",
        "import_rules",
        "expense_types",
        "macrocategories",
        "transaction_embeddings",
    ]:
        cursor.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))
    _seed_default_types(cursor, user_id)
    conn.commit()
    conn.close()
    return {"ok": True}
