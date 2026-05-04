# Tally — Plaid Integration Plan

## Overview
Full production Plaid integration: multi-user bank linking, auto-import of
transactions, real-time balance sync, background auto-sync + manual refresh,
Plaid-first categorization with Tally fallback, and duplicate detection across
Plaid + manual/CSV imports.

---

## Architecture

```
User browser
  └── Plaid Link (JS SDK) → Plaid API
        └── public_token → FastAPI /plaid/exchange
              └── access_token stored in DB (per user)

Background job (APScheduler in FastAPI)
  └── every 6 hours: fetch new transactions for all linked users
        └── deduplicate → categorize → insert into expenses table

Webhook (Plaid → FastAPI /plaid/webhook)
  └── TRANSACTIONS_INITIAL_UPDATE → trigger immediate sync
  └── TRANSACTIONS_DEFAULT_UPDATE → trigger sync for affected user
```

---

## Database changes

### New table: `plaid_items`
Stores one row per user per linked bank (Plaid calls this an "Item").

```sql
CREATE TABLE IF NOT EXISTS plaid_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    item_id TEXT NOT NULL UNIQUE,
    institution_name TEXT,
    institution_id TEXT,
    cursor TEXT,                    -- Plaid transactions cursor for incremental sync
    last_synced_at TEXT,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'  -- active | error | relink_required
);
```

### New table: `plaid_accounts`
Stores individual accounts within a linked item (checking, savings, credit).

```sql
CREATE TABLE IF NOT EXISTS plaid_accounts (
    id TEXT PRIMARY KEY,
    plaid_item_id TEXT NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL UNIQUE,   -- Plaid's account_id
    name TEXT NOT NULL,
    official_name TEXT,
    type TEXT NOT NULL,                -- depository | credit | loan | investment
    subtype TEXT,                      -- checking | savings | credit card | etc
    current_balance REAL,
    available_balance REAL,
    currency TEXT DEFAULT 'USD',
    last_balance_update TEXT
);
```

### Modify `expenses` table
Add columns to track Plaid-sourced transactions and enable duplicate detection.

```sql
ALTER TABLE expenses ADD COLUMN plaid_transaction_id TEXT UNIQUE;
ALTER TABLE expenses ADD COLUMN plaid_account_id TEXT;
ALTER TABLE expenses ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
-- source: 'manual' | 'plaid' | 'csv'
ALTER TABLE expenses ADD COLUMN plaid_category TEXT;
ALTER TABLE expenses ADD COLUMN pending INTEGER NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN merchant_name TEXT;
```

Add index for duplicate detection performance:
```sql
CREATE INDEX IF NOT EXISTS idx_expenses_plaid_txn ON expenses(plaid_transaction_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_amount_date ON expenses(amount, date, user_id);
```

---

## Phase 1: Plaid credentials + environment setup

### 1.1 Plaid dashboard setup
1. Go to dashboard.plaid.com → create a production app
2. Under Products, enable: **Transactions**, **Balance**
3. Under Redirect URIs, add:
   - `https://budget-app-qv32.onrender.com`
   - `http://localhost:5173` (for dev)
4. Copy Client ID and Production Secret

### 1.2 Environment variables
Add to Render dashboard and local `.env`:
```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_production_secret
PLAID_ENV=production
PLAID_WEBHOOK_URL=https://budget-app-qv32.onrender.com/plaid/webhook
```

### 1.3 Install Plaid Python SDK
```bash
pip install plaid-python
```
Add to `server/requirements.txt`.

### 1.4 Plaid client singleton
Create `server/plaid_client.py`:
```python
import plaid
from plaid.api import plaid_api
import os

configuration = plaid.Configuration(
    host=plaid.Environment.Production if os.environ.get("PLAID_ENV") == "production"
         else plaid.Environment.Sandbox,
    api_key={
        "clientId": os.environ["PLAID_CLIENT_ID"],
        "secret": os.environ["PLAID_SECRET"],
    }
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)
```

---

## Phase 2: Plaid Link flow (frontend + backend)

This is the OAuth-like flow that lets users connect their bank.

### 2.1 Backend: create link token
```
POST /plaid/link-token
```
- Authenticated endpoint (requires user session)
- Creates a Plaid link_token for the current user
- Returns `{ link_token: "..." }`

```python
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode

@app.post("/plaid/link-token")
def create_link_token(user=Depends(get_current_user)):
    request = LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="Tally",
        country_codes=[CountryCode("US")],
        language="en",
        user={"client_user_id": user["id"]},
        webhook=os.environ["PLAID_WEBHOOK_URL"],
    )
    response = client.link_token_create(request)
    return {"link_token": response["link_token"]}
```

### 2.2 Frontend: Plaid Link SDK
Install:
```bash
npm install react-plaid-link
```

Create `client/src/components/PlaidLinkButton.jsx`:
```jsx
import { usePlaidLink } from 'react-plaid-link'
import { useEffect, useState } from 'react'

export function PlaidLinkButton({ onSuccess }) {
  const [linkToken, setLinkToken] = useState(null)

  useEffect(() => {
    fetch('/plaid/link-token', { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then(data => setLinkToken(data.link_token))
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => {
      fetch('/plaid/exchange', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken, metadata })
      }).then(() => onSuccess())
    },
  })

  return (
    <button onClick={() => open()} disabled={!ready}>
      Connect a bank account
    </button>
  )
}
```

### 2.3 Backend: exchange public token
```
POST /plaid/exchange
Body: { public_token, metadata }
```
- Exchanges public_token for permanent access_token
- Stores access_token + item_id in `plaid_items`
- Fetches accounts immediately and stores in `plaid_accounts`
- Triggers initial transaction sync for this item
- **Never expose access_token to the frontend**

```python
@app.post("/plaid/exchange")
def exchange_token(body: dict, user=Depends(get_current_user)):
    response = client.item_public_token_exchange({"public_token": body["public_token"]})
    access_token = response["access_token"]
    item_id = response["item_id"]

    # Store in plaid_items
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO plaid_items (id, user_id, access_token, item_id, institution_name, created_at, status)
        VALUES (%s, %s, %s, %s, %s, %s, 'active')
    """, (str(uuid4()), user["id"], access_token, item_id,
          body.get("metadata", {}).get("institution", {}).get("name"), now()))
    conn.commit()

    # Fetch and store accounts
    sync_accounts(access_token, item_id, user["id"])

    # Trigger initial transaction sync
    sync_transactions_for_item(item_id)

    return {"status": "ok"}
```

---

## Phase 3: Transaction sync

### 3.1 Incremental sync using cursor
Plaid's Transactions Sync API uses a cursor — store it per item, pass it on
each call to get only new/modified/removed transactions since last sync.

Create `server/plaid_sync.py`:

```python
def sync_transactions_for_item(item_id: str):
    conn = get_connection()
    cursor_conn = conn.cursor()

    # Get item
    cursor_conn.execute("SELECT * FROM plaid_items WHERE item_id = %s", (item_id,))
    item = cursor_conn.fetchone()
    if not item:
        return

    access_token = item["access_token"]
    plaid_cursor = item["cursor"]  # None on first sync

    added, modified, removed = [], [], []
    has_more = True

    while has_more:
        request = TransactionsSyncRequest(
            access_token=access_token,
            cursor=plaid_cursor,
            count=500,
        )
        response = client.transactions_sync(request)
        added.extend(response["added"])
        modified.extend(response["modified"])
        removed.extend(response["removed"])
        has_more = response["has_more"]
        plaid_cursor = response["next_cursor"]

    # Process
    _upsert_transactions(added + modified, item["user_id"])
    _remove_transactions(removed)

    # Save updated cursor + last_synced_at
    cursor_conn.execute("""
        UPDATE plaid_items SET cursor = %s, last_synced_at = %s WHERE item_id = %s
    """, (plaid_cursor, now(), item_id))
    conn.commit()
```

### 3.2 Categorization logic
Plaid-first, Tally fallback:

```python
def _resolve_category(plaid_category: list, name: str, existing_categories: list) -> str:
    # Map Plaid's category hierarchy to Tally categories
    PLAID_TO_TALLY = {
        "Food and Drink": "Food",
        "Shops": "Shopping",
        "Recreation": "Hobby",
        "Transfer": "Income",
        "Travel": "Transportation",
        "Healthcare": "Health",
        "Service": "Personal",
        "Community": "Personal",
        "Payment": "Credit Card Payment",
        "Bank Fees": "Personal",
        "Cash Advance": "Personal",
    }
    if plaid_category:
        top = plaid_category[0]
        if top in PLAID_TO_TALLY:
            mapped = PLAID_TO_TALLY[top]
            if mapped in existing_categories:
                return mapped

    # Tally fallback: keyword matching (existing auto-categorization logic)
    return tally_auto_categorize(name, existing_categories)
```

### 3.3 Duplicate detection
Run before inserting any transaction:

```python
def _is_duplicate(cursor, user_id: str, plaid_txn_id: str, amount: float,
                  date: str, name: str) -> bool:
    # Check 1: exact Plaid transaction ID match (Plaid import vs Plaid import)
    cursor.execute("""
        SELECT id FROM expenses
        WHERE plaid_transaction_id = %s
    """, (plaid_txn_id,))
    if cursor.fetchone():
        return True

    # Check 2: fuzzy match for manual/CSV vs Plaid
    # Same user, same amount, same date, similar name (within 3 days window)
    cursor.execute("""
        SELECT id FROM expenses
        WHERE user_id = %s
          AND amount = %s
          AND date BETWEEN %s::date - interval '3 days' AND %s::date + interval '3 days'
          AND source != 'plaid'
          AND plaid_transaction_id IS NULL
    """, (user_id, amount, date, date))
    rows = cursor.fetchall()
    for row in rows:
        # Optional: name similarity check using difflib
        pass

    return False
```

For the fuzzy name match, use Python's `difflib.SequenceMatcher`. If ratio > 0.7,
flag as probable duplicate and surface it to the user rather than silently dropping.

---

## Phase 4: Balance sync

### 4.1 Fetch balances
```
GET /plaid/balances
```
Fetches current + available balances for all accounts for the current user.
Updates `plaid_accounts` table.

```python
@app.get("/plaid/balances")
def refresh_balances(user=Depends(get_current_user)):
    items = get_user_plaid_items(user["id"])
    for item in items:
        response = client.accounts_balance_get({"access_token": item["access_token"]})
        for account in response["accounts"]:
            update_account_balance(account)
    return {"status": "ok"}
```

### 4.2 Display balances in UI
Add a "Linked Accounts" section to the Overview page showing:
- Institution name + account name
- Current balance
- Available balance (for credit accounts: available credit)
- Last updated timestamp

---

## Phase 5: Webhook handler

Plaid pushes updates to your server when new transactions are available,
rather than you polling constantly.

```
POST /plaid/webhook
```

```python
@app.post("/plaid/webhook")
async def plaid_webhook(request: Request):
    body = await request.json()
    webhook_type = body.get("webhook_type")
    webhook_code = body.get("webhook_code")
    item_id = body.get("item_id")

    if webhook_type == "TRANSACTIONS":
        if webhook_code in ("INITIAL_UPDATE", "DEFAULT_UPDATE", "HISTORICAL_UPDATE"):
            # Trigger sync for this item in background
            background_tasks.add_task(sync_transactions_for_item, item_id)

    elif webhook_type == "ITEM":
        if webhook_code == "ERROR":
            # Mark item as error, notify user to relink
            mark_item_error(item_id)

    return {"status": "ok"}
```

Note: Plaid webhooks don't work on localhost. Use ngrok for local webhook testing.

---

## Phase 6: Background auto-sync

Use APScheduler (already likely available, or add it) to run sync periodically.

```bash
pip install apscheduler
```

In `server/server.py`:
```python
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

def sync_all_users():
    items = get_all_active_plaid_items()
    for item in items:
        try:
            sync_transactions_for_item(item["item_id"])
        except Exception as e:
            print(f"Sync failed for item {item['item_id']}: {e}")

scheduler.add_job(sync_all_users, 'interval', hours=6)
scheduler.start()

@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()
```

### Manual refresh endpoint
```
POST /plaid/sync
```
- Authenticated, triggers sync for the current user's items immediately
- Frontend "Refresh" button calls this

---

## Phase 7: Re-link flow (token expiry)

Plaid access tokens can expire or require re-authentication (e.g. user changes
bank password). Handle gracefully:

1. When sync returns `ITEM_LOGIN_REQUIRED` error → set `plaid_items.status = 'relink_required'`
2. Frontend checks for items in `relink_required` state on load
3. Show a banner: "Your [Bank Name] connection needs to be refreshed"
4. Re-link uses Plaid Link with `access_token` mode (update mode), not a new link

Backend endpoint for update mode link token:
```
POST /plaid/link-token/update
Body: { item_id }
```
Same as link token creation but pass `access_token` to Plaid instead of products.

---

## Phase 8: Frontend UI changes

### Settings / Linked Accounts page
New section in Settings (or dedicated page):
- List of linked institutions with account names + balances
- "Connect a bank" button → triggers Plaid Link
- Per-item: "Sync now" button, "Disconnect" button
- Status indicator: active (green) / error / relink required (amber)

### Overview page additions
- Linked account balances widget (net worth snapshot)
- Last synced timestamp per institution
- "Sync" button with loading state

### Expenses table
- Source badge on each row: `plaid` / `manual` / `csv`
- Pending transaction indicator (Plaid marks pending txns)
- Probable duplicate flagging UI: "This looks like a duplicate of [expense name] — keep both or merge?"

### Import page
- When user imports CSV, run duplicate check against recent Plaid transactions
- Surface conflicts before committing import

---

## Phase 9: Disconnect + data handling

```
DELETE /plaid/items/{item_id}
```
- Calls Plaid's `item_remove` endpoint
- Deletes `plaid_items` and `plaid_accounts` rows
- Does NOT delete expenses that were imported from this item
  (user's financial history should persist even if they disconnect)

---

## Plaid production checklist (before going live)

- [ ] Apply for Production access in Plaid dashboard (requires brief description of use case)
- [ ] Complete Plaid's onboarding questionnaire
- [ ] Add Plaid's required privacy policy language to your app's privacy policy
- [ ] Add "Powered by Plaid" logo in the linked accounts section (required by Plaid ToS)
- [ ] Set up webhook URL in Plaid dashboard
- [ ] Test with at least 2-3 real bank connections in production sandbox first
- [ ] Implement proper error logging for failed syncs (don't lose errors silently)

---

## Estimated complexity by phase

| Phase | Effort | Notes |
|---|---|---|
| 1: Credentials + env | 30 min | Already stubbed in render.yaml |
| 2: Link flow | 1 day | Frontend + backend, most user-facing work |
| 3: Transaction sync | 1-2 days | Cursor logic + categorization + deduplication |
| 4: Balance sync | 2-3 hours | Straightforward API call |
| 5: Webhooks | 3-4 hours | Need ngrok for local testing |
| 6: Auto-sync | 2-3 hours | APScheduler setup |
| 7: Re-link flow | 3-4 hours | Edge case but important for production |
| 8: Frontend UI | 1-2 days | Linked accounts page, badges, duplicate UI |
| 9: Disconnect | 1-2 hours | Simple but important |

Total: ~1 week of focused work. Recommend doing phases 1-4 first to get
a working end-to-end flow, then 5-9 to harden it for production.

---

## Notes
- Never log or expose `access_token` — treat it like a password
- Store access_token encrypted at rest if possible (Postgres pgcrypto or application-level AES)
- Plaid's production pricing: charged per Item per month after free tier
- The duplicate detection window (3 days) handles the common case where a
  pending transaction appears in Plaid before the user manually enters it
- APScheduler runs in-process — if Render restarts the service, the scheduler
  restarts too. This is fine; worst case is a delayed sync, not data loss
