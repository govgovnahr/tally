# CLAUDE.md

Full-stack single-page budgeting app. No test suite. See [ARCH.md](./ARCH.md) for architecture, [API.md](./API.md) for endpoints. See [DEMO.md](./DEMO.md) for setting up a demo/test account and seeding it with data — useful for local QA without touching real account data.

## Running

```bash
# Backend (port 3001)
cd server && pip install -r requirements.txt && python server.py

# Frontend (port 5173)
cd client && npm install && npm run dev
```

## Building

```bash
./build.sh
```

React build → `client/dist/` → `server/static/` → PyInstaller → `server/dist/BudgetTracker/`. CI/CD via `.github/workflows/build.yml` on push to `master` (macOS + Windows).

**PyInstaller:** All routers need `--hidden-import`; `openpyxl` needs `--collect-all openpyxl`; `sys.frozen` switches uvicorn to prod + opens browser.

## Gotchas

- **Route order**: named routes (e.g. `/expenses/summary`, `/savings-goals/avg-net`) must precede `/{id}` param routes; sub-paths (`/{id}/contributions`, `/{id}/pause`) are safe after `/{id}`
- `activeMacro` and `activeType` are mutually exclusive — selecting one clears the other
- `is_default = 1` types cannot be deleted (frontend hides button, backend 403)
- DB migrations: try/except `ALTER TABLE` in `init_db()`
- `budget.db` path: `BUDGET_DATA_DIR` env var → `~/.budget_app/budget.db` fallback; Render sets `/data`
- Only one `monthly` savings goal (409 on duplicate, app-layer not DB)
- Savings progress is contribution-based — `savings_contributions`, not income/expense data
- Deleting a goal deletes contributions but NOT linked expenses (history preserved)
- New routers need `--hidden-import` in build workflow (both platforms); `auth_router` and `auth` module both need entries
- Budget pacing: past months return `projected_spend: null`; current month uses `spent + historical_daily_rate × remaining_days`; future months return empty categories
- Status chip "over budget" label uses `projected_spend - limit`, not `spent - limit` (spend may be under budget while projection is over)
- `server/seed_demo.py` dates are hand-written against a fixed anchor month (`_ANCHOR_LAST_MONTH`) and shifted by `sd()` at seed time to land on the 5 real calendar months before whenever the script runs (current month stays empty) — if you edit the hand-written data's date range, update `_ANCHOR_LAST_MONTH` to match its new last month

## Savings Goals

Types: `monthly` (contributions this month vs target), `one_time` (cumulative toward target), and `emergency_fund` (one-time variant with server-computed target from `months_target × avg_monthly_expenses`). All support allocation, pausing, manual contributions.

**Allocation** (mutually exclusive, settable at POST/PUT):
- `allocation_pct`: % slice of monthly net (simultaneous with other % goals)
- `priority`: integer rank; remainder after % goals, funded sequentially; no two active goals share priority (409)
- Neither: full avg monthly net for projections

**Computed fields** (server-side, not stored):
- `completed`: `effective_progress >= target` OR `deadline < today` (one_time only; monthly always false)
- `effective_progress`: equals `total_contributions`
- `effective_avg_monthly_net`: projection rate; falls back to contribution-rate when portfolio avg is 0
- `_apply_priority_cascade()`: runs after `_add_computed()`; strips allocation from completed goals (DB untouched); computes cascade offsets; contribution-rate fallback per goal
- `_portfolio_avg_net(conn, months=3)`: avg net over last N complete months; exposed at `GET /savings-goals/avg-net`

**Contributions** (`savings_contributions`: `id, goal_id, amount, date, note, created_at, expense_id`):
- Each contribution creates a linked expense (type = "Savings", name = goal name)
- "Savings" type auto-created on first contribution (`is_default=1`, color `#8fb996`, icon `Savings`)
- Deleting a contribution deletes its linked expense; deleting a goal does NOT delete linked expenses
- `PUT` priority uniqueness check excludes goals past their deadline (slot is free)

**Emergency fund**: `goal_type = 'emergency_fund'`; falls through to `one_time` branch in `_add_computed`. Target = `months_target × get_avg_monthly_expenses(conn, months=3)`; falls back to explicit `target` if avg is 0. `months_target` stored in DB (migration in `init_db`).

## Spending Analysis

`analysis_router.py` — all endpoints under `/analysis/`. Logic helpers in `database.py`.

- **Pacing**: `compute_budget_pacing(conn, month, lookback_months)` in `database.py`. Past → `projected_spend=None`. Current → historical daily rate × remaining days. Future → `[]`.
- **Category stats**: avg monthly, over-budget frequency, trend (up/down/flat ±5% vs avg), monthly breakdown.
- **Outliers**: z-score ≥ 1.5 per category; requires ≥ 3 expenses; capped at 15. Computed in-request, not stored.
- **Month-over-month**: total spent + income + net + MoM % change per month.
- `_effective_budgets_map(conn, month)` is a local helper in `analysis_router.py` — not imported from `budgets_router` to avoid cross-package issues.

## Auth

Supabase Auth. `auth.py` verifies Supabase JWTs (HS256, `aud=authenticated`) from `Authorization: Bearer` header. `auth_router.py` exposes only `GET /auth/me` — seeds 6 default expense types on first login via `_seed_default_types`.

- **`SUPABASE_JWT_SECRET`** env var — from Supabase → Project Settings → API → JWT Secret
- All data scoped to `user_id` (Supabase Auth UUID, `auth.users.id`)
- Frontend uses `@supabase/supabase-js`; session stored in localStorage; token attached via axios request interceptor
- Password reset: Supabase emails link → `PASSWORD_RECOVERY` event → `supabase.auth.updateUser({ password })`
- Google OAuth: enable in Supabase → Authentication → Providers → Google; add redirect URLs to Supabase allowlist
- `REGISTRATION_OPEN` env var no longer used — access control is via Supabase Auth settings

## Render Deployment

`render.yaml` is the source of truth. Database = Supabase Postgres via `DATABASE_URL` env var. Build = React → `server/static/` → pip install. Start = `uvicorn server:app`. No PyInstaller needed.

**Required env vars (set in Render dashboard):**
- `DATABASE_URL` — Supabase Transaction pooler URI (port 6543); Project Settings → Database → Connection pooling
- `SUPABASE_JWT_SECRET` — Project Settings → API → JWT Secret
- `SECRET_KEY` — auto-generated by render.yaml
- `ALLOWED_ORIGINS` — set to your Render frontend URL

**Frontend env vars (in `client/.env.*`, gitignored):**
- `VITE_SUPABASE_URL` — Project Settings → API → Project URL
- `VITE_SUPABASE_ANON_KEY` — Project Settings → API → anon/public key

- First deploy: `init_db()` creates all tables automatically on startup
- Free tier cold-start: service spins down after 15 min idle; first request after idle ~30s
- `/health` returns `200 {"status":"ok","db":"ok"}` or `503 {"status":"degraded"}` — use for UptimeRobot monitoring

**Smoke test after deploy:** load app, sign up, add expense, add income, view analysis, check savings goals, import CSV, verify settings persist across page refresh

## AI Features

All AI calls go through `ai_router.py` using OpenAI. Gated on `settings.ai_enabled` per user.

- **Proactive insights** — `GET /ai/insights`: 2-3 observations on dashboard load (`AIInsightsCard`)
- **NL expense entry** — `POST /ai/parse-expense`: free-text → `{name, amount, date, type}` in `AddExpenseForm`
- **Smart import categorization** — `POST /ai/classify-rows`: per-row type inference in `ImportDialog` review step
- **AI budget recommendations** — `POST /ai/budget-recommendations`: 3-month history → per-category limits (`AIBudgetRecsDialog`)
- **Receipt OCR** — `POST /ai/scan-receipt`: image upload → GPT-4o vision → `{name, amount, date, type_suggestion}`; camera button in `ExpenseList` toolbar opens `ReceiptScanDialog`, hands off prefill to `AddExpenseForm`
  - Uses `%s` placeholders (Postgres) — don't use `?`

## Planned Features

### Bank linking (Plaid)
Keep import pipeline modular — `import_rules` and `_infer_type()` source-agnostic. Don't hardcode CSV/Excel in UI or backend. Plaid returns overlapping date windows — deduplication will be critical.

### Projections
**Savings**: `projected_completion` computed server-side, allocation-aware; `NetSavingsChart` shows 3 projected bars (dimmed) + vertical dashed markers for goals completing in window. Future: weight recent months.

**Budget pacing** (implemented): `GET /analysis/pacing` computes `projected = spent + historical_daily_rate × remaining_days`. Historical rate = total spent in past N months / total days in those months, per category. Past months return `projected_spend: null`. SummaryBar and BudgetGoals consume this endpoint. Two-tone progress bars: solid = actual (category color, red only if actually over), ghost extension = projected-beyond-actual (status color at 40% opacity).
