import uuid
from datetime import datetime

import plaid
from plaid.model.transactions_sync_request import TransactionsSyncRequest

from crypto_utils import decrypt_token
from database import get_user_settings
from plaid_client import get_client, PLAID_CATEGORY_HINTS
from routers.import_router import (
    _DEFAULT_COLORS,
    _DEFAULT_ICON,
    _get_ai_categorizer,
    _infer_type_with_source,
    _soft_match_type,
)


def _plaid_record_type(amount: float) -> str:
    """
    Plaid's sign convention is the OPPOSITE of CSV import's _determine_record_type():
    positive amount = money OUT (expense), negative = money IN (income/refund).
    Do not reuse the CSV helper here.
    """
    return "expense" if amount > 0 else "income"


def _create_expense_type(conn, user_id: str, name: str, valid_types: list) -> str:
    """Auto-create a category from a Plaid taxonomy name, mirroring /import/budgets'
    existing auto-create-by-name pattern (next unused color, default icon)."""
    used_colors = {
        r["color"] for r in conn.execute(
            "SELECT color FROM expense_types WHERE user_id = %s", (user_id,)
        ).fetchall()
    }
    available = [c for c in _DEFAULT_COLORS if c not in used_colors] or _DEFAULT_COLORS
    color = available[0]
    sort_order = conn.execute(
        "SELECT COALESCE(MAX(sort_order)+1, 0) AS sort_order FROM expense_types WHERE user_id = %s",
        (user_id,),
    ).fetchone()["sort_order"]
    conn.execute(
        "INSERT INTO expense_types (id, name, color, icon, sort_order, user_id) "
        "VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (user_id, name) DO NOTHING",
        (str(uuid.uuid4()), name, color, _DEFAULT_ICON, sort_order, user_id),
    )
    valid_types.append(name)
    return name


def _resolve_category(conn, user_id, name, merchant_name, amount, plaid_category_primary,
                       valid_types, rules, ai_categorize_fn):
    """Categorization priority: import_rules > Plaid category (source of truth,
    auto-creates the category if unmatched) > existing keyword/AI fallback pipeline."""
    effective_name = merchant_name or name
    name_lower = effective_name.lower()

    for pattern, expense_type in rules:
        if pattern.lower() in name_lower:
            matched = _soft_match_type(expense_type, valid_types)
            if matched:
                return matched, "rule"

    hint = PLAID_CATEGORY_HINTS.get(plaid_category_primary or "")
    if hint:
        matched = next((v for v in valid_types if v.lower() == hint.lower()), None)
        if not matched:
            matched = _create_expense_type(conn, user_id, hint, valid_types)
        return matched, "plaid_category"

    category, source = _infer_type_with_source(effective_name, valid_types, rules)
    if source == "fallback" and ai_categorize_fn:
        suggestion = ai_categorize_fn(effective_name, amount, valid_types)
        suggested = suggestion.get("category")
        if suggested and suggested in valid_types:
            return suggested, "ai"
    return category, source


def sync_plaid_item(conn, item_id: str) -> dict:
    item = conn.execute(
        "SELECT * FROM plaid_items WHERE item_id = %s", (item_id,)
    ).fetchone()
    if not item:
        raise ValueError(f"No plaid_items row for item_id={item_id}")
    if item["status"] == "unlinked":
        # Defensive: a webhook can race in after unlink. The stored access_token is
        # already revoked at Plaid's end (item_remove was called), so calling out
        # would just fail anyway — no-op instead.
        return {"mode": "skipped", "reason": "item_unlinked"}

    user_id = item["user_id"]
    access_token = decrypt_token(item["access_token"])
    is_first_sync = item["cursor"] is None
    plaid_cursor = item["cursor"]

    client = get_client()

    added, modified, removed = [], [], []
    has_more = True
    while has_more:
        # The SDK's model rejects cursor=None outright (ApiTypeError) — omit the
        # kwarg entirely on the first sync instead of passing None through.
        kwargs = {"access_token": access_token, "count": 500}
        if plaid_cursor is not None:
            kwargs["cursor"] = plaid_cursor
        request = TransactionsSyncRequest(**kwargs)
        try:
            response = client.transactions_sync(request)
        except plaid.ApiException as e:
            if "ITEM_LOGIN_REQUIRED" in str(e.body):
                conn.execute(
                    "UPDATE plaid_items SET status = 'relink_required' WHERE item_id = %s",
                    (item_id,),
                )
                conn.commit()
                return {"mode": "error", "error": "relink_required"}
            raise
        added.extend(response.added)
        modified.extend(response.modified)
        removed.extend(response.removed)
        has_more = response.has_more
        plaid_cursor = response.next_cursor

    cursor = conn.cursor()
    cursor.execute("SELECT name FROM expense_types WHERE user_id = %s ORDER BY sort_order", (user_id,))
    valid_types = [r["name"] for r in cursor.fetchall()]
    cursor.execute("SELECT pattern, expense_type FROM import_rules WHERE user_id = %s", (user_id,))
    rules = [(r["pattern"], r["expense_type"]) for r in cursor.fetchall()]

    user_settings = get_user_settings(conn, user_id)
    ai_categorize_fn = _get_ai_categorizer() if user_settings["ai_enabled"] else None

    committed_count = 0
    pending_count = 0
    now = datetime.now().isoformat()

    for txn in added + modified:
        record_type = _plaid_record_type(txn.amount)
        amount = round(abs(txn.amount), 2)
        name = txn.name
        merchant_name = txn.merchant_name if txn.merchant_name is not None else None
        pfc_primary = None
        if txn.personal_finance_category is not None:
            pfc_primary = txn.personal_finance_category.primary
        date_str = str(txn.date)
        pending = 1 if txn.pending else 0
        plaid_txn_id = txn.transaction_id
        account_id = txn.account_id

        if record_type == "expense":
            suggested_type, source = _resolve_category(
                conn, user_id, name, merchant_name, amount, pfc_primary, valid_types, rules, ai_categorize_fn,
            )
        else:
            suggested_type, source = None, None

        if is_first_sync:
            cursor.execute(
                "INSERT INTO plaid_pending_transactions "
                "(id, item_id, user_id, plaid_transaction_id, account_id, name, merchant_name, amount, date, "
                "record_type, suggested_type, source, plaid_category_primary, pending, created_at) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT (plaid_transaction_id) DO NOTHING",
                (str(uuid.uuid4()), item_id, user_id, plaid_txn_id, account_id, name, merchant_name, amount,
                 date_str, record_type, suggested_type, source, pfc_primary, pending, now),
            )
            pending_count += cursor.rowcount
        elif record_type == "expense":
            cursor.execute(
                "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id, plaid_transaction_id) "
                "VALUES (%s,%s,%s,%s,%s,%s,0,%s,%s) "
                "ON CONFLICT (plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL "
                "DO UPDATE SET amount = EXCLUDED.amount, date = EXCLUDED.date, name = EXCLUDED.name",
                (str(uuid.uuid4()), name, amount, suggested_type, date_str, now, user_id, plaid_txn_id),
            )
            committed_count += cursor.rowcount
        else:
            cursor.execute(
                "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring, user_id, plaid_transaction_id) "
                "VALUES (%s,%s,%s,%s,%s,0,%s,%s) "
                "ON CONFLICT (plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL "
                "DO UPDATE SET amount = EXCLUDED.amount, date = EXCLUDED.date, name = EXCLUDED.name",
                (str(uuid.uuid4()), name, amount, date_str, now, user_id, plaid_txn_id),
            )
            committed_count += cursor.rowcount

    for txn in removed:
        cursor.execute("DELETE FROM expenses WHERE plaid_transaction_id = %s", (txn.transaction_id,))
        cursor.execute("DELETE FROM incomes WHERE plaid_transaction_id = %s", (txn.transaction_id,))
        cursor.execute("DELETE FROM plaid_pending_transactions WHERE plaid_transaction_id = %s", (txn.transaction_id,))

    cursor.execute(
        "UPDATE plaid_items SET cursor = %s, last_synced_at = %s, status = 'active' WHERE item_id = %s",
        (plaid_cursor, now, item_id),
    )
    conn.commit()

    if is_first_sync:
        return {"mode": "review", "pending_count": pending_count}
    return {"mode": "committed", "committed_count": committed_count}
