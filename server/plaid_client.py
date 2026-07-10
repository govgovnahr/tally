import os

import plaid
from plaid.api import plaid_api


def get_client() -> plaid_api.PlaidApi:
    """
    Lazily constructs a Plaid client per call (mirrors _get_ai_categorizer()'s
    lazy-import style in import_router.py) so this module still imports cleanly
    when PLAID_CLIENT_ID/PLAID_SECRET are unset — e.g. the desktop/PyInstaller
    build, which has no Plaid config at all.

    Sandbox only for v1 — Production support is out of scope until Plaid
    application review happens.
    """
    client_id = os.environ.get("PLAID_CLIENT_ID")
    secret = os.environ.get("PLAID_SECRET")
    if not client_id or not secret:
        raise RuntimeError("PLAID_CLIENT_ID / PLAID_SECRET are not set.")

    configuration = plaid.Configuration(
        host=plaid.Environment.Sandbox,
        api_key={"clientId": client_id, "secret": secret},
    )
    return plaid_api.PlaidApi(plaid.ApiClient(configuration))


# Plaid's personal_finance_category.primary values -> friendly display names.
# This is the default categorization source of truth for Plaid-synced transactions
# (see plaid_sync.py) — resolved names are matched case-insensitively against the
# user's existing expense_types, auto-creating one if none matches (same pattern
# as /import/budgets' auto-create-by-name). Values mapped to None are too broad/
# ambiguous to be useful as a category on their own and fall through to the
# existing keyword/AI pipeline instead.
PLAID_CATEGORY_HINTS = {
    "FOOD_AND_DRINK": "Food & Drink",
    "TRANSPORTATION": "Transportation",
    "TRAVEL": "Travel",
    "RENT_AND_UTILITIES": "Rent & Utilities",
    "HOME_IMPROVEMENT": "Home Improvement",
    "MEDICAL": "Medical",
    "PERSONAL_CARE": "Personal Care",
    "ENTERTAINMENT": "Entertainment",
    "GENERAL_MERCHANDISE": "Shopping",
    "GOVERNMENT_AND_NON_PROFIT": "Government & Non-Profit",
    "LOAN_PAYMENTS": None,
    "GENERAL_SERVICES": None,
    "BANK_FEES": None,
    "TRANSFER_IN": None,
    "TRANSFER_OUT": None,
    "INCOME": None,
}
