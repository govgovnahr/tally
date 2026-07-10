# Plaid Bank Linking

Built on `feature/plaid-integration`. Sandbox only for v1 — see "Non-goals" below for what's deliberately deferred. This file describes what's actually implemented; supersedes an earlier draft (production-focused, no review queue, unencrypted tokens, polling instead of webhooks) that predated these decisions.

## Architecture

- `server/plaid_client.py` — lazy Plaid client construction (`get_client()`), Sandbox-only. Raises `RuntimeError` if `PLAID_CLIENT_ID`/`PLAID_SECRET` are unset, checked at call time so the app still boots and non-Plaid routes work fine without them (e.g. the desktop/PyInstaller build). Also holds `PLAID_CATEGORY_HINTS`, the Plaid `personal_finance_category.primary` → friendly-name map.
- `server/crypto_utils.py` — `encrypt_token`/`decrypt_token`, Fernet symmetric encryption keyed by `PLAID_ENCRYPTION_KEY`. Fails closed (raises `RuntimeError`) if the key is missing or not valid Fernet format, checked lazily at first use.
- `server/plaid_sync.py` — `sync_plaid_item(conn, item_id)`, the core sync engine. Pages through `/transactions/sync` until `has_more` is false, categorizes each transaction, and either stages it for review (first sync) or auto-commits it (every sync after).
- `server/routers/plaid_router.py` — all `/plaid/*` endpoints.

## Database

- `plaid_items` — one row per linked bank login (Plaid "Item"): encrypted `access_token`, `cursor` (NULL until first sync), `status` (`active`/`relink_required`/`error`).
- `plaid_accounts` — accounts within an Item.
- `plaid_pending_transactions` — first-sync review staging, cleared on commit.
- `expenses.plaid_transaction_id` / `incomes.plaid_transaction_id` — unique partial indexes, the dedup key for `ON CONFLICT` upserts.

New tables are created **after** the `ALTER TABLE` migration loop in `init_db()`, not before — the loop's `conn.rollback()` (needed because `cycle_start_day`'s `ALTER` fails on every restart after the first) wipes out anything created earlier in the same uncommitted transaction. This bit us once already; see git history on this file's introduction.

## Sync engine behavior (`plaid_sync.py`)

- **Sign convention**: Plaid's `amount` is positive for money out (expense), negative for money in (income) — the *opposite* of CSV import's `_determine_record_type()`. `_plaid_record_type()` handles this; CSV's helper is never reused here.
- **Categorization priority**: `import_rules` (explicit user rule, always wins) → Plaid's category (source of truth — mapped via `PLAID_CATEGORY_HINTS`, auto-creates the `expense_type` if none matches, same pattern as `/import/budgets`' auto-create) → existing `_infer_type_with_source()` keyword/AI pipeline (only for Plaid categories that map to `None` — transfers, general services, etc.). Accepted trade-off: a user with custom-named categories may get a near-duplicate category rather than a merge.
- **First sync vs. every sync after**: no stored `cursor` means first sync — rows land in `plaid_pending_transactions` for review (`mode: "review"`). Once a cursor exists, every sync auto-commits directly into `expenses`/`incomes` via `INSERT ... ON CONFLICT (plaid_transaction_id) DO UPDATE SET amount/date/name` (updates on Plaid's "modified" events, never touches `type` so a user's manual recategorization survives). `removed` transactions are deleted from both tables and the pending queue.
- **Dedup is exact-match only** (`plaid_transaction_id`). No fuzzy manual-vs-Plaid matching — deferred, see non-goals.

## Endpoints (`plaid_router.py`)

`POST /plaid/link-token` · `POST /plaid/exchange-token` (runs the first sync synchronously) · `GET /plaid/items` · `POST /plaid/items/{id}/sync` · `DELETE /plaid/items/{id}` (calls Plaid's `item_remove`, does not delete already-committed expenses/incomes) · `GET /plaid/items/{id}/pending-review` · `POST /plaid/items/{id}/commit-review` · `POST /plaid/webhook`.

**Webhook verification**: Plaid signs webhooks with an ES256 JWT (`Plaid-Verification` header). `_verify_plaid_webhook()` fetches the signing key by `kid` via `client.webhook_verification_key_get` (cached in-process by `kid`), verifies the signature with `python-jose` (already a dependency via `python-jose[cryptography]` — no new JWT library needed), rejects tokens older than 5 minutes, and confirms the claimed `request_body_sha256` matches the actual raw body. Failures raise `HTTPException(400)`, **never 401** — `server.py`'s `_track_auth_failures` IP-blocking middleware only counts 401s, and a misconfigured/retrying webhook shouldn't get an IP blocked.

**Webhook URL is optional**: derived from `APP_URL` (`{APP_URL}/plaid/webhook`) if set, omitted from the Link token request otherwise. `APP_URL` is set in `render.yaml` for the Render deployment; unset locally and in the desktop/PyInstaller build, which have no public URL for Plaid to reach — those rely entirely on the manual `POST /plaid/items/{id}/sync` button.

## Frontend

- `components/dialogs/PlaidLinkButton.jsx` — wraps `react-plaid-link`'s `usePlaidLink`; fetches the link token via the existing `api` axios instance (bearer token auto-attaches), exchanges on success.
- `components/dialogs/PlaidReviewDialog.jsx` — first-sync review, built on the shared `components/shared/ReviewTable.jsx` (extracted from `ImportDialog.jsx`'s former inline `ReviewStep`, which both CSV import and Plaid review now use — rows just need a stable `id`, `name`, `amount`, `date`, `suggested_type`, `source`).
- `components/pages/AccountPage.jsx` — "Linked Accounts" section: institution list, status badges, per-item Sync/Unlink, the Link button, wired to open the review dialog when a first sync produces pending rows.
- `InferenceBadge.jsx` gained a `plaid_category` source variant.

## Config

- Backend env: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`, `PLAID_ENCRYPTION_KEY` (generate via `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` — must be manually generated, not Render's `generateValue`, which won't produce valid Fernet format).
- `render.yaml` already has `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_ENV` stubs plus the new `PLAID_ENCRYPTION_KEY` (`sync: false` — set manually in the Render dashboard).
- `server/requirements.txt`: `plaid-python`. `client/package.json`: `react-plaid-link`.
- `.github/workflows/build.yml`: `--hidden-import "routers.plaid_router"` added to both the macOS and Windows PyInstaller blocks. (Aside, pre-existing and not fixed as part of this work: `auth_router`, `ai_router`, and `settings_router` are also missing from that hidden-import list — worth a follow-up.)

## Non-goals for v1

- No Production/Development Plaid access — Sandbox only.
- No per-connection "review every sync" toggle — only the first sync reviews.
- No Plaid Link "update mode" re-link flow — `relink_required` status is surfaced on the item but not auto-resolved.
- No balance/net-worth widget — Transactions product only.
- No fuzzy manual-vs-Plaid duplicate detection — exact `plaid_transaction_id` match only.
- Plaid transactions are **not** integrated with custom billing-cycle logic, recurring-expense forward-seeding, or the AI agent's tools — manual/CSV data only, consistent with this repo's other partial rollouts (see CLAUDE.md's "Custom Billing Cycle" section for the pattern).
- **No per-account distinction or filtering** — every account Link returns (checking, savings, credit card, and even loan/investment accounts) gets stored in `plaid_accounts` and synced with no type filtering; all transactions land in the same undifferentiated `expenses`/`incomes` pool regardless of source account. A real institution rarely offers as many accounts as Plaid's Sandbox test institutions do, so this may be a non-issue in practice, but it's a known gap. Future direction (not started): treat each linked account as a first-class concept in Tally's own model — a `linked_account_id` on expenses/incomes, per-account sync toggle, per-account views — rather than a narrow Link-time type filter.

## Verified so far

Backend boots cleanly with `plaid_router` registered; `/plaid/items` and `/plaid/link-token` return correct auth/config errors (401 unauthenticated, a clean 500 with `PLAID_CLIENT_ID`/`SECRET` unset — not a crash); `/plaid/webhook` returns 400 (not 401) on a missing/invalid signature. ES256/JWK verification mechanics tested in isolation against a locally-generated key pair. Frontend builds cleanly with the new components.

**Not yet verified**: an actual Plaid Sandbox Link flow end-to-end (needs real `PLAID_CLIENT_ID`/`PLAID_SECRET` sandbox credentials and a browser) — link a Sandbox test institution (e.g. `ins_109508` / "First Platypus Bank", `user_good`/`pass_good`), confirm the review queue populates and commits correctly, confirm a second sync auto-commits without review, and fire a test webhook via Plaid's `/sandbox/item/fire_webhook` to confirm the webhook path.
