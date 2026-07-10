# Overdraft Warning, Paycheck Detection, Multi-Account Monitoring

## Context

The Plaid integration (feature/plaid-integration, verified working end-to-end this session) currently does one thing: sync a single linked checking account's transactions into the existing expenses/incomes pool. Three follow-on features were requested: (1) warn when a checking account is projected to overdraft before the next paycheck, (2) better recurring-paycheck tracking to feed that warning, (3) treat each linked account (savings, checking, credit card) as a first-class, distinguishable thing rather than an undifferentiated transaction pool.

Feature #3 is architecturally foundational to the other two — accurate overdraft projection and paycheck detection are both more correct once accounts are distinguishable rather than pooled. Built in that order: **full multi-account monitoring → recurring paycheck detection → overdraft projection.** Doing #3 completely first (schema, balance sync, loosened Plaid Link filters, and per-account UI all together) means #2 and #3 get built on a settled foundation instead of one that changes underneath them mid-stream.

Decisions locked in for this work:
- **Auto-apply paycheck detection above a confidence bar** (not manual confirmation) — but only *high-confidence* patterns feed the overdraft warning; lower-confidence detections are stored but don't drive anything financial yet.
- **Configurable buffer, default $100** — the warning fires when projected balance is expected to dip below the buffer, not only at a literal $0 crossing.
- **Detected paycheck stays a virtual forecast** — never inserted as an actual income row. Avoids double-counting once the real Plaid transaction lands, and avoids the exact brittleness (phantom duplicate rows from exact-name-match anti-joins) the existing recurring-expense seeding already has.

## Known gotcha carried forward

`expenses.plaid_transaction_id` / `incomes.plaid_transaction_id` use a **partial unique index** (`WHERE plaid_transaction_id IS NOT NULL`). Any `ON CONFLICT (plaid_transaction_id)` clause must repeat that `WHERE` predicate or Postgres errors with "no unique or exclusion constraint matching" — hit and fixed twice already this session. The new `linked_account_id` column doesn't need its own such index (not a conflict target), but keep this in mind if any new upsert touches these tables.

---

## Phase A — Full multi-account monitoring

**Schema** (`server/database.py` `init_db()`):
- Add `current_balance DOUBLE PRECISION`, `available_balance DOUBLE PRECISION`, `last_balance_sync_at TEXT` directly into the `CREATE TABLE IF NOT EXISTS plaid_accounts` statement (~line 261) — safe, since that CREATE already sits after the rollback-prone ALTER loop.
- Add a **new** `ALTER TABLE plaid_accounts ADD COLUMN ...` try/except loop, placed *after* that CREATE TABLE block, to cover the local DB already provisioned from this session's Sandbox testing (which has the table without these columns).
- Add `ALTER TABLE expenses/incomes ADD COLUMN linked_account_id TEXT` to the **existing** ALTER loop (~line 229, alongside `plaid_transaction_id`). Nullable — only Plaid-synced rows get one; no backfill of historical rows.
- Add `idx_expenses_linked_account` / `idx_incomes_linked_account` to the index list.

**Loosen what Plaid Link offers** — `_ACCOUNT_FILTERS` in `plaid_router.py` currently restricts to checking only; add `DepositoryAccountSubtype("savings")` and a `CreditFilter`/`CreditAccountSubtype("all")` so savings and credit card accounts become linkable.

**Populate balances on link** — `exchange_token()` already calls `client.accounts_get()` and discards `.balances`; add `current_balance`, `available_balance`, `last_balance_sync_at` to the existing per-account INSERT.

**Refresh balances on sync** — `plaid_sync.py`'s `sync_plaid_item()` already has `client`/`access_token` in scope. Add an `AccountsBalanceGetRequest` call (confirmed to exist in the installed SDK, exposes `.balances.current`/`.available`), **time-gated** — skip if `last_balance_sync_at` is under 1 hour old, since balance calls cost real API usage in production.

**Populate `linked_account_id` per transaction** — both `sync_plaid_item()`'s per-transaction insert and `plaid_router.py`'s `commit_review()` insert currently discard `txn.account_id`/`row["account_id"]`. Build a `{plaid_account_id: plaid_accounts.id}` map once per sync call, thread it into both the `INSERT` and the modified-transaction `ON CONFLICT ... DO UPDATE SET` (add `linked_account_id = EXCLUDED.linked_account_id` there too).

**Frontend**:
- `AccountPage.jsx`: expand the collapsed account summary line (currently `item.accounts.map(a => ...).join(', ')`) into per-account rows — name/mask/subtype badge/current+available balance/last sync time.
- `ExpenseList.jsx`: add an account filter (options from `GET /plaid/items`), passed as a `linked_account_id` query param to the list endpoints.
- `list_items()` in `plaid_router.py` needs the new balance columns added to its SELECT.

**Learning checkpoint**: the `linked_account_id` mapping/threading across `sync_plaid_item()` and `commit_review()` is a good hand-write — same partial-index/`ON CONFLICT` territory already hit twice this session, good repetition for it to stick.

---

## Phase B — Recurring paycheck detection

**New table `recurring_income_patterns`**: `id, user_id, normalized_payer, cadence` (`weekly|biweekly|semimonthly|monthly`), `expected_amount, amount_tolerance_pct, next_expected_date, last_seen_date, confidence` (`high|low`), `linked_account_id, created_at, updated_at`. Deliberately separate from `is_recurring` — do not reuse `seed_income_recurring_forward()`'s exact-name-match model, unsuitable for messy real bank text. `linked_account_id` (from Phase A) lets a pattern be scoped to the account it was detected on, useful once multiple deposit accounts exist.

**Detection function** (learning checkpoint — hand-write this): `detect_recurring_income_patterns(conn, user_id)` in `database.py`, run over `incomes WHERE user_id=%s AND plaid_transaction_id IS NOT NULL` (manual entries already have the explicit checkbox, don't need auto-detect):
1. Normalize payer text (strip trailing digits/check numbers, uppercase, collapse whitespace).
2. Cluster by normalized name + amount within tolerance (±7%), scoped per `linked_account_id`.
3. Require ≥3 occurrences to consider a cluster at all.
4. Compute date deltas between occurrences; bucket into weekly (~7d)/biweekly (~14d)/semimonthly (alternating ~14-17d or fixed days-of-month)/monthly (~30d).
5. **Confidence scoring** (this is what "auto-apply above a threshold" means concretely): `high` requires ≥4 occurrences AND interval standard deviation ≤2 days AND amount variance ≤5%; anything meeting the minimum (3 occurrences) but not those tighter bounds is `low`. Only `high`-confidence patterns feed Phase C's overdraft calculation — `low`-confidence ones are stored (so they're visible/correctable) but inert.
6. `expected_amount` = median of cluster; `next_expected_date` = last occurrence + cadence delta.
7. Upsert by `(user_id, normalized_payer, linked_account_id)` — recomputing refreshes dates/amount/confidence, never silently "downgrades" in a way that's surprising (recompute is idempotent, not additive).

**Recompute trigger**: called from `sync_plaid_item()` after committing any income rows — no new cron/scheduler needed, matches the app's existing pattern of doing work at natural trigger points (same spirit as `apply_recurring_expenses`/`incomes` at startup, but this fires on sync instead since that's when new income data actually arrives).

**Visibility**: a small read-only surface in `AccountPage.jsx`'s Linked Accounts section showing detected patterns and their confidence, so a bad `high`-confidence detection is at least visible and correctable later (a dismiss/ignore action can be a fast follow, not blocking Phase C).

---

## Phase C — Overdraft projection

**New function** (learning checkpoint — hand-write this): `compute_overdraft_projection(conn, user_id)` in `database.py`, following `compute_budget_pacing()`'s conventions:
1. `current_balance` = `SUM(current_balance) FROM plaid_accounts WHERE user_id=%s AND subtype='checking'` — pooled across all linked checking accounts specifically (a deliberate scope now that Phase A makes savings/credit distinguishable — a credit card balance going negative isn't the same risk as checking cash running out, so this is a correct choice, not a fallback).
2. `buffer` = user's configured threshold (new `user_settings.overdraft_buffer` column, default `100`, editable via the existing `SettingsUpdate` merge-patch pattern in `settings_router.py`).
3. `next_paycheck` = earliest `recurring_income_patterns` row for this user with `confidence='high'` and `next_expected_date >= today`. None found → return a `status: "insufficient_data"` response, no warning possible.
4. Outflow modeling, split to avoid double-counting: discrete known outflows = `expenses WHERE user_id=%s AND is_recurring=1 AND date BETWEEN today AND next_expected_date` (real scheduled bills); everything else uses `compute_budget_pacing()`-style historical daily rate for *non-recurring* spend only (`is_recurring=0`, lookback-months average). Optionally scope both by `linked_account_id` for the checking account(s) once multiple exist, rather than mixing in spend from other linked accounts.
5. Day-by-day walk from today to `next_expected_date`: running balance −= (daily rate + any discrete outflow landing that day); first day balance dips below `buffer` → `projected_low_date`, `projected_low_balance`, `will_overdraft_risk=True`.

**New endpoint**: `GET /analysis/overdraft-projection` in `analysis_router.py`, matching existing house style (`Depends(get_current_user)`, no extra params needed beyond what's already inferred).

**Settings**: add `overdraft_buffer` to `user_settings` (same ALTER-loop pattern as `cycle_start_day`), `SettingsUpdate` Pydantic model, and a small input in `AccountPage.jsx`'s settings sections.

**Frontend**: new `OverdraftWarning.jsx` in `client/src/components/charts/`, structurally cloned from `OutlierAlert.jsx` (same card shell, `TriangleAlert` icon, `C.overBudget` instead of `C.atRisk` for severity) — mounted in `DashboardPage.jsx` above `OutlierAlert`, before the KPI row. Fetched unconditionally, **not** gated by `ai_enabled` (unlike `AIInsightsCard.jsx` — this is a deterministic financial warning, must always compute regardless of AI settings).

---

## Verification

- **Phase A**: after migration, confirm `plaid_accounts` has balance columns populated post-link and post-sync; re-link in Sandbox with savings/credit now allowed and confirm all account types populate correctly; confirm `linked_account_id` populates on newly-synced transactions without breaking the existing `ON CONFLICT` dedup (re-run a sync twice, confirm no duplicate rows, confirm no partial-index error); click through the new account filter in ExpenseList.
- **Phase B**: seed a few synced income transactions with the same normalized payer/amount at realistic date deltas (can insert directly into `incomes` with `plaid_transaction_id` set, mimicking a real sync, since Sandbox doesn't reliably produce multi-month recurring income on demand) and confirm `detect_recurring_income_patterns()` correctly buckets cadence and confidence.
- **Phase C**: with a detected high-confidence pattern and a known `current_balance`, hand-verify the day-by-day walk against a manually computed expected result for at least one "will overdraft" and one "won't overdraft" case.

### Critical files
- `server/database.py` — schema, `compute_overdraft_projection()`, `detect_recurring_income_patterns()`
- `server/plaid_sync.py` — balance refresh, `linked_account_id` threading, pattern-detection trigger
- `server/routers/plaid_router.py` — `_ACCOUNT_FILTERS`, balance population on link, `list_items()`
- `server/routers/analysis_router.py` — new overdraft endpoint
- `server/routers/settings_router.py` — `overdraft_buffer` setting
- `client/src/components/pages/DashboardPage.jsx`, `client/src/components/charts/OutlierAlert.jsx` (clone target)
- `client/src/components/pages/AccountPage.jsx` — per-account UI, pattern visibility, settings input
- `client/src/components/pages/ExpenseList.jsx` — account filter
