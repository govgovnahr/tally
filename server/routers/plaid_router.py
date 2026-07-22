import hashlib
import json
import os
import time
import uuid
from datetime import datetime

import plaid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from jose import jwt as jose_jwt
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.country_code import CountryCode
from plaid.model.depository_account_subtype import DepositoryAccountSubtype
from plaid.model.depository_account_subtypes import DepositoryAccountSubtypes
from plaid.model.depository_filter import DepositoryFilter
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.item_remove_request import ItemRemoveRequest
from plaid.model.link_token_account_filters import LinkTokenAccountFilters
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.webhook_verification_key_get_request import WebhookVerificationKeyGetRequest

from auth import get_current_user
from crypto_utils import encrypt_token
from database import get_connection
from models import PlaidCommitReview, PlaidExchangeRequest
from plaid_client import get_client
from plaid_sync import sync_plaid_item

router = APIRouter(prefix="/plaid", tags=["plaid"])

_jwk_cache: dict = {}


def _webhook_url() -> str | None:
    app_url = os.environ.get("APP_URL")
    return f"{app_url}/plaid/webhook" if app_url else None


def _oauth_redirect_uri() -> str | None:
    # OAuth institutions (Chase, BofA, Wells Fargo, ...) send the browser away
    # to the bank's own login page, then back to this exact URL — which must be
    # pre-registered in the Plaid Dashboard's "Allowed redirect URIs" and match
    # byte-for-byte, so it can't be pointed at a path that doesn't exist. This
    # app is a single-page app with no server-side router — server.py's
    # StaticFiles(html=True) mount only resolves index.html for the exact root
    # path, not arbitrary sub-paths — so the app's own root is the one URL
    # guaranteed to resolve. The frontend detects the oauth_state_id query param
    # that Plaid appends and resumes Link from there (see PlaidOAuthResume.jsx).
    # None locally/desktop build (no public URL for Plaid to redirect to) —
    # non-OAuth institutions (including every Sandbox test institution used so
    # far) are unaffected either way.
    app_url = os.environ.get("APP_URL")
    return f"{app_url}/" if app_url else None


# Restricts which accounts Link even offers to checking only, for now — savings
# and credit card are deliberately excluded too until per-account tracking
# exists (a checking-only pool avoids mixing account types together under the
# current undifferentiated expenses/incomes model). Investment (IRA/401k), loan
# (mortgage/student loan), and CD accounts are excluded at the Link level
# entirely. This does NOT make individual accounts within an allowed type
# deselectable — that's a Plaid Dashboard "Select Account" Link Customization
# setting, not something settable from this request. See CLAUDE_plaid.md's
# non-goals for the deferred per-account tracking work this is standing in for.
_ACCOUNT_FILTERS = LinkTokenAccountFilters(
    depository=DepositoryFilter(
        account_subtypes=DepositoryAccountSubtypes([
            DepositoryAccountSubtype("checking"),
        ])
    ),
)


@router.post("/link-token")
def create_link_token(user_id: str = Depends(get_current_user)):
    client = get_client()
    webhook = _webhook_url()
    redirect_uri = _oauth_redirect_uri()
    kwargs = dict(
        products=[Products("transactions")],
        client_name="Tally",
        country_codes=[CountryCode("US")],
        language="en",
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
        account_filters=_ACCOUNT_FILTERS,
    )
    if webhook:
        kwargs["webhook"] = webhook
    if redirect_uri:
        kwargs["redirect_uri"] = redirect_uri
    request = LinkTokenCreateRequest(**kwargs)
    response = client.link_token_create(request)
    return {"link_token": response.link_token}


@router.post("/exchange-token")
def exchange_token(body: PlaidExchangeRequest, user_id: str = Depends(get_current_user)):
    # Check for a duplicate institution BEFORE consuming the public_token (single-use,
    # valid ~30min) — lets the frontend retry with force=True using the same token if
    # the user confirms they really do want to link the same institution again (e.g.
    # after unlinking, or a second real account under different credentials).
    if body.institution_id and not body.force:
        conn = get_connection()
        try:
            existing = conn.execute(
                "SELECT institution_name, status FROM plaid_items WHERE user_id = %s AND institution_id = %s "
                "ORDER BY created_at DESC LIMIT 1",
                (user_id, body.institution_id),
            ).fetchone()
        finally:
            conn.close()
        if existing:
            return {
                "duplicate_institution": True,
                "institution_name": existing["institution_name"],
                "previously_unlinked": existing["status"] == "unlinked",
            }

    client = get_client()
    exchange_resp = client.item_public_token_exchange(
        ItemPublicTokenExchangeRequest(public_token=body.public_token)
    )
    access_token = exchange_resp.access_token
    item_id = exchange_resp.item_id

    accounts_resp = client.accounts_get(AccountsGetRequest(access_token=access_token))
    institution_name = accounts_resp.item.institution_name or body.institution_name
    institution_id = accounts_resp.item.institution_id or body.institution_id

    conn = get_connection()
    try:
        now = datetime.now().isoformat()
        conn.execute(
            "INSERT INTO plaid_items (id, user_id, item_id, access_token, institution_id, institution_name, "
            "status, created_at) VALUES (%s,%s,%s,%s,%s,%s,'active',%s)",
            (str(uuid.uuid4()), user_id, item_id, encrypt_token(access_token), institution_id, institution_name, now),
        )
        for account in accounts_resp.accounts:
            conn.execute(
                "INSERT INTO plaid_accounts (id, item_id, account_id, user_id, name, mask, type, subtype) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (account_id) DO NOTHING",
                (str(uuid.uuid4()), item_id, account.account_id, user_id, account.name,
                 account.mask, str(account.type), str(account.subtype) if account.subtype else None),
            )
        conn.commit()

        result = sync_plaid_item(conn, item_id)
    finally:
        conn.close()

    return {"item_id": item_id, **result}


@router.get("/items")
def list_items(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        items = conn.execute(
            "SELECT item_id, institution_id, institution_name, status, created_at, last_synced_at "
            "FROM plaid_items WHERE user_id = %s AND status != 'unlinked' ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        result = []
        for item in items:
            accounts = conn.execute(
                "SELECT account_id, name, mask, type, subtype FROM plaid_accounts WHERE item_id = %s",
                (item["item_id"],),
            ).fetchall()
            result.append({**dict(item), "accounts": [dict(a) for a in accounts]})
        return result
    finally:
        conn.close()


def _require_own_item(conn, item_id: str, user_id: str):
    item = conn.execute(
        "SELECT item_id FROM plaid_items WHERE item_id = %s AND user_id = %s AND status != 'unlinked'",
        (item_id, user_id),
    ).fetchone()
    if not item:
        raise HTTPException(status_code=404, detail="Linked account not found")


@router.post("/items/{item_id}/sync")
def sync_item(item_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        _require_own_item(conn, item_id, user_id)
        return sync_plaid_item(conn, item_id)
    finally:
        conn.close()


@router.delete("/items/{item_id}")
def delete_item(item_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT access_token FROM plaid_items WHERE item_id = %s AND user_id = %s AND status != 'unlinked'",
            (item_id, user_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Linked account not found")

        from crypto_utils import decrypt_token
        client = get_client()
        try:
            client.item_remove(ItemRemoveRequest(access_token=decrypt_token(row["access_token"])))
        except plaid.ApiException:
            pass  # item may already be invalid/removed on Plaid's side — still clean up locally

        conn.execute("DELETE FROM plaid_pending_transactions WHERE item_id = %s", (item_id,))
        conn.execute("DELETE FROM plaid_accounts WHERE item_id = %s", (item_id,))
        # Soft-delete: keep the row (institution_id, user_id) so exchange_token() can
        # detect "you already linked this bank before" and warn, instead of silently
        # re-syncing content-identical transactions under a new item_id/transaction_ids.
        # access_token is left in place (still encrypted) rather than nulled — the
        # column is NOT NULL, and the token is already inert: Plaid revoked it via
        # item_remove above, so it can't be used to call the API even if decrypted.
        conn.execute(
            "UPDATE plaid_items SET status = 'unlinked' WHERE item_id = %s",
            (item_id,),
        )
        conn.commit()
        return {"item_id": item_id}
    finally:
        conn.close()


@router.get("/items/{item_id}/pending-review")
def get_pending_review(item_id: str, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        _require_own_item(conn, item_id, user_id)
        rows = conn.execute(
            "SELECT * FROM plaid_pending_transactions WHERE item_id = %s ORDER BY date DESC", (item_id,)
        ).fetchall()
        valid_types = [
            r["name"] for r in conn.execute(
                "SELECT name FROM expense_types WHERE user_id = %s ORDER BY sort_order", (user_id,)
            ).fetchall()
        ]
        return {"rows": [dict(r) for r in rows], "valid_types": valid_types}
    finally:
        conn.close()


@router.post("/items/{item_id}/commit-review")
def commit_review(item_id: str, body: PlaidCommitReview, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    try:
        _require_own_item(conn, item_id, user_id)
        rows = conn.execute(
            "SELECT * FROM plaid_pending_transactions WHERE item_id = %s", (item_id,)
        ).fetchall()

        committed = 0
        now = datetime.now().isoformat()
        cursor = conn.cursor()
        for row in rows:
            final_type = body.confirmed_types.get(row["id"], row["suggested_type"])
            if row["record_type"] == "expense":
                cursor.execute(
                    "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id, plaid_transaction_id) "
                    "VALUES (%s,%s,%s,%s,%s,%s,0,%s,%s) "
                    "ON CONFLICT (plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL DO NOTHING",
                    (str(uuid.uuid4()), row["name"], row["amount"], final_type, row["date"], now, user_id, row["plaid_transaction_id"]),
                )
            else:
                cursor.execute(
                    "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring, user_id, plaid_transaction_id) "
                    "VALUES (%s,%s,%s,%s,%s,0,%s,%s) "
                    "ON CONFLICT (plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL DO NOTHING",
                    (str(uuid.uuid4()), row["name"], row["amount"], row["date"], now, user_id, row["plaid_transaction_id"]),
                )
            committed += cursor.rowcount

        cursor.execute("DELETE FROM plaid_pending_transactions WHERE item_id = %s", (item_id,))
        conn.commit()
        return {"committed": committed}
    finally:
        conn.close()


def _get_webhook_jwk(key_id: str) -> dict:
    if key_id in _jwk_cache:
        return _jwk_cache[key_id]
    client = get_client()
    resp = client.webhook_verification_key_get(WebhookVerificationKeyGetRequest(key_id=key_id))
    jwk = resp.key.to_dict()
    _jwk_cache[key_id] = jwk
    return jwk


async def _verify_plaid_webhook(request: Request) -> dict:
    """
    Verifies Plaid's webhook JWT (Plaid-Verification header) per Plaid's documented
    scheme: fetch the signing key by kid (cached), verify the ES256 signature, reject
    stale tokens, and confirm the claimed body hash matches the actual raw body.
    Raises HTTPException(400) — never 401 — so signature failures don't trip
    server.py's auth-failure IP-blocking middleware, which only counts 401s.
    """
    signed_jwt = request.headers.get("Plaid-Verification")
    if not signed_jwt:
        raise HTTPException(status_code=400, detail="Missing Plaid-Verification header")

    body_bytes = await request.body()

    try:
        header = jose_jwt.get_unverified_header(signed_jwt)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook JWT header")

    if header.get("alg") != "ES256":
        raise HTTPException(status_code=400, detail="Unexpected webhook JWT algorithm")

    key_id = header.get("kid")
    if not key_id:
        raise HTTPException(status_code=400, detail="Missing kid in webhook JWT header")

    try:
        jwk = _get_webhook_jwk(key_id)
        claims = jose_jwt.decode(signed_jwt, jwk, algorithms=["ES256"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook signature verification failed: {e}")

    if time.time() - claims.get("iat", 0) > 300:
        raise HTTPException(status_code=400, detail="Webhook JWT is stale")

    body_hash = hashlib.sha256(body_bytes).hexdigest()
    if claims.get("request_body_sha256") != body_hash:
        raise HTTPException(status_code=400, detail="Webhook body hash mismatch")

    return json.loads(body_bytes)


@router.post("/webhook")
async def plaid_webhook(request: Request, background_tasks: BackgroundTasks):
    body = await _verify_plaid_webhook(request)
    webhook_type = body.get("webhook_type")
    webhook_code = body.get("webhook_code")
    item_id = body.get("item_id")

    if webhook_type == "TRANSACTIONS" and item_id:
        background_tasks.add_task(_background_sync, item_id)
    elif webhook_type == "ITEM" and webhook_code == "ERROR" and item_id:
        background_tasks.add_task(_mark_item_error, item_id)

    return {"status": "ok"}


def _background_sync(item_id: str):
    conn = get_connection()
    try:
        sync_plaid_item(conn, item_id)
    finally:
        conn.close()


def _mark_item_error(item_id: str):
    conn = get_connection()
    try:
        conn.execute("UPDATE plaid_items SET status = 'error' WHERE item_id = %s", (item_id,))
        conn.commit()
    finally:
        conn.close()
