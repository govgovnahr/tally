# Architecture

## Backend — `server/`

- **FastAPI** + **Postgres** (Supabase; `DATABASE_URL` env var — see "Render Deployment" in CLAUDE.md). `database.py:get_connection()` draws from a module-level `psycopg2.pool.ThreadedConnectionPool` (min 2 / max 20), not a fresh connection per call; `conn.close()` returns the connection to the pool (rolling back first if uncommitted) rather than tearing it down.
- Routers: `auth_router`, `ai_router`, `expenses_router`, `budgets_router`, `types_router`, `incomes_router`, `import_router`, `import_rules_router`, `macrocategories_router`, `savings_goals_router`, `analysis_router`, `settings_router`, `dashboard_router`
- `dashboard_router` (`GET /dashboard?month=`) is an aggregate endpoint — one payload covering everything `DashboardPage.jsx` needs (expense/income/macro summaries, effective budgets, pacing, outliers, savings goals), computed on one pooled connection instead of ~8 separate requests. Its section logic is `conn`-taking helpers factored out of and reused by the standalone endpoints (`summary_rows`, `income_summary_total`, `macro_summary`, `compute_pacing_payload`, `compute_outliers`, `compute_savings_goals`) — no SQL is duplicated between them.
- Write endpoints favor single-statement `INSERT/UPDATE/DELETE ... RETURNING` (and `WHERE EXISTS`/`WHERE NOT EXISTS` guards) over separate check-then-write round trips — e.g. `add_expense`, `add_income`, `delete_expense/income`, `toggle_pause`. Where collapsing would blur a 404-vs-400 distinction (e.g. `update_expense`), a lightweight validation query is kept instead.
- Models: dataclasses in `models.py`; Pydantic models inline for request validation
- CORS whitelisted to `http://localhost:5173`
- On startup: `init_db()` → `apply_recurring_expenses()` + `apply_recurring_incomes()`

## Frontend — `client/src/`

- **React 19 + Vite + Tailwind CSS + Radix UI primitives (`@radix-ui/react-*`) + `glasscn-ui`/`class-variance-authority` + Recharts**, no router
- Styling: Tailwind utility classes + `colors.jsx`'s `useC()` (light/dark palette context, default value so components render without a provider); no MUI
- `motion` (Framer Motion) for micro-interactions (tutorial overlay, expandable cards, `SparkleBurst`)
- `api.js` uses `VITE_API_URL` — empty in prod, `http://localhost:3001` in dev via `.env.development`

### State (App.jsx)
`refreshKey` · `selectedMonth` · `activeType` · `activeMacro`
Gates render on budgets existing; shows `BudgetSetup` if none. `SavingsPage` has its own isolated `refreshKey`.

### Context (ExpenseTypesContext.jsx)
`expenseTypes`, `typeMap`, `typeNames`, `reloadTypes`, `macrocategories`, `macroMap`, `reloadMacros`, `loading`

### Components

| Component | Purpose |
|-----------|---------|
| `DashboardPage.jsx` | Main dashboard — one `useQuery` against `GET /dashboard?month=` feeds KPI cards, `SummaryBar`, `ExpenseList`, `SpendingDonut`; `justAddedId` state threads a freshly-added row's id into `ExpenseList`'s highlight/sparkle regardless of which of the page's several "add income" entry points was used |
| `BudgetSetup.jsx` | Onboarding — set initial budget limits |
| `SummaryBar.jsx` | Month nav, totals, macro + category cards, spending chart. Clicking a card filters the page. |
| `SpendingChart.jsx` | Horizontal bar chart (spent vs budget per category); inside SummaryBar |
| `MonthlyTrendsChart.jsx` | Stacked bars per type + income line; click bar filters; future months dimmed; budget as ReferenceLine or dashed Line when overrides exist |
| `ExpenseList.jsx` | Paginated table, type-filter tabs, text search (debounced), sortable columns, add/edit/delete, import, clear. Filters by `activeType` or `activeMacro`. `highlightId` (set on add, or fed in via `externalHighlightId` prop from outside) highlights the row and pops a `SparkleBurst` confirmation next to its name — for both expense and income rows. |
| `AddExpenseForm.jsx` | Add/edit expense; debounced auto-categorization via `/import/infer-type`; "Remember this categorization" saves rule + retroactively applies |
| `AddIncomeForm.jsx` | Add/edit income. Submit carries an `AbortController` signal, aborted on unmount (dialog close) so a request the user gave up on can't silently land after the fact. Backend rejects a same name+amount resubmit within 5s as a duplicate (409). |
| `BudgetGoals.jsx` | Category cards grouped by macrocategory, budget limits, monthly overrides, macrocategory management |
| `ImportDialog.jsx` | 3-step CSV/Excel import: upload → column mapping → results |
| `ImportBudgetsDialog.jsx` | 3-step CSV/Excel budget import; supports `target_month` override; creates missing types |
| `SavingsPage.jsx` | Net savings chart + monthly goal + one-time goal cards + completed goals accordion. Manages own refresh. Allocation settable at create/edit. |
| `NetSavingsChart.jsx` | Bar chart: past 6 months net + 3 projected (dimmed, portfolio avg). Dashed ReferenceLine for monthly goal; vertical markers for one-time goals completing in window. |
| `MonthSelector.jsx` | Horizontal scrollable month picker; highlights months with data |
| `AnalysisPage.jsx` | Spending analysis tab: Budget Pacing (historical daily rate projection, lookback toggle), Budget Performance (avg vs budget chart + over-budget frequency), Unusual Expenses (z-score outliers), Monthly Trends (MoM chart). All list sections collapse at 3 items. |

## Database

Tables: `expenses`, `incomes`, `budgets`, `monthly_budgets`, `expense_types`, `macrocategories`, `import_rules`, `savings_goals`, `savings_contributions`

### expense_types
`id, name, color, icon, sort_order, is_default, macrocategory_id`
11 seeded defaults (`_DEFAULT_TYPES` in `database.py`) aligned to Plaid's `personal_finance_category.primary` taxonomy: Food & Drink, Transportation, Rent & Utilities, Entertainment, Medical, Other, Travel, Home Improvement, Shopping, Personal Care, Government & Non-Profit — all `is_default=1`, but only **"Other"** is actually protected from deletion (`delete_type` 403s specifically on `is_default and name == 'Other'`; frontend hides the delete button only for that one). The other 10 defaults are deletable like any custom type.
`ICON_REGISTRY` / `ICON_OPTIONS` in `client/src/expenseTypes.js`.

### macrocategories
`id, name, color, budget_limit(nullable)`
Optional `budget_limit` shows group progress bar in SummaryBar. DELETE nulls `macrocategory_id` on member types.

### monthly_budgets
`type, month, monthly_limit` (PK: type+month)
Override wins over `budgets` table. Computed by `GET /budgets/effective`. When any override exists, trends chart uses dashed Line instead of flat ReferenceLine.

### import_rules
`id, pattern, expense_type`
Case-insensitive substring match. Applied before keyword heuristics in `_infer_type()`. Saving retroactively updates matching expenses.

### savings_goals
`id, goal_type ('monthly'|'one_time'|'emergency_fund'), name, target, deadline(nullable), created_at, color(nullable), allocation_pct(nullable), priority(nullable), paused, months_target(nullable)`
One `monthly` max (409). `emergency_fund` target computed server-side from `months_target × get_avg_monthly_expenses()` if `target` omitted. Progress from `savings_contributions`. Computed fields added at query time, not stored.

### savings_contributions
`id, goal_id, amount, date, note(nullable), created_at, expense_id`
Each creates a linked expense (type="Savings"). Deleting contribution deletes linked expense. `expense_id` can reference an existing expense.

### Recurring
`is_recurring=1` on expenses/incomes. On startup: previous month's recurring entries copied to current month. On add/edit: next 2 months seeded.
