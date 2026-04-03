# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Two terminals required — both must run simultaneously:

**Backend** (port 3001):
```bash
cd server
pip install -r requirements.txt
python server.py
```

**Frontend** (port 5173):
```bash
cd client
npm install
npm run dev
```

## Architecture

Full-stack single-page budgeting app. No test suite exists.

### Backend — `server/`
- **FastAPI** app (`server.py`) with **SQLite** (`budget.db` at `~/.budget_app/budget.db`, created on first run via `database.py:init_db()`)
- Routers: `expenses_router`, `budgets_router`, `types_router`, `incomes_router`, `import_router`, `import_rules_router`, `macrocategories_router`
- Models split between dataclasses (`models.py`) and Pydantic models (used for request body validation)
- CORS is whitelisted to `http://localhost:5173` only
- **Route order matters**: named routes (e.g. `/expenses/summary`, `/macrocategories/summary`) must be registered before `/{id}` param routes in each router file
- On startup, `init_db()` creates/migrates tables, `apply_recurring_expenses()` and `apply_recurring_incomes()` auto-copy last month's recurring entries into the current month

### Frontend — `client/src/`
- **React 19 + Vite + Material UI (MUI v7) + Recharts**, no router — single page
- UI built with MUI components via the `sx` prop against the custom dark theme in `theme.js`. No component CSS files — `index.css` only contains scrollbar overrides.
- `App.jsx` owns `refreshKey` (increment to trigger refetches), `selectedMonth`, `activeType`, and `activeMacro` state. It gates render on budgets existing; if none, shows `BudgetSetup` onboarding.
- `ExpenseTypesContext.jsx` provides `expenseTypes`, `typeMap`, `typeNames`, `reloadTypes`, `macrocategories`, `macroMap`, `reloadMacros`, `loading` globally. Wrap the app in `ExpenseTypesProvider`.
- `api.js` uses `VITE_API_URL` env var — empty string in production, `http://localhost:3001` in dev (via `client/.env.development`)

### Components

| Component | Purpose |
|-----------|---------|
| `App.jsx` | Root — manages `refreshKey`, `selectedMonth`, `activeType`, `activeMacro`; routes between onboarding and main view |
| `BudgetSetup.jsx` | Onboarding: set initial monthly budget limits; shown when no budgets exist |
| `SummaryBar.jsx` | Monthly header with nav arrows, total spent vs budget, income/net row, macrocategory group cards, per-category cards, spending chart. Clicking a macrocategory or category card filters the whole page. |
| `SpendingChart.jsx` | Recharts horizontal bar chart (spent vs budget per category); rendered inside `SummaryBar` |
| `MonthlyTrendsChart.jsx` | Recharts `ComposedChart` — stacked bars per expense type + income line; click bar to filter by type; respects `activeType` and `activeMacro` filters; per-type or total budget reference/line; future months dimmed |
| `ExpenseList.jsx` | Paginated expense/income table with type-filter tabs, add/edit/delete, Import button, Clear Month/All button. Filters by `activeType` or `activeMacro`. |
| `AddExpenseForm.jsx` | Dialog for adding or editing an expense; auto-categorizes on name input (debounced, calls `/import/infer-type`); edit mode has "Remember this categorization" checkbox |
| `AddIncomeForm.jsx` | Dialog for adding or editing an income entry |
| `BudgetGoals.jsx` | Category management (cards sorted by budget limit, top 10 shown, grouped by macrocategory when groups exist) + budget limits + Monthly Overrides section + Macrocategories management section |
| `ImportDialog.jsx` | 3-step CSV/Excel import for transactions: upload → column mapping (sheet selector for multi-sheet xlsx, header row auto-detection) → results |
| `ImportBudgetsDialog.jsx` | 3-step CSV/Excel import for budget goals: upload → column mapping → results. Supports `target_month` override and creates missing expense types automatically. |

### Expense Types
- **User-defined**, stored in the `expense_types` DB table (id, name, color, icon, sort_order, is_default, macrocategory_id)
- `is_default = 1` for the 6 seeded types (Food, Transport, Housing, Entertainment, Health, Other) — these cannot be deleted
- `macrocategory_id` links a type to a macrocategory (nullable)
- **Frontend:** `client/src/expenseTypes.js` exports `ICON_REGISTRY` (key → MUI component) and `ICON_OPTIONS` (ordered list for the picker). Type data itself comes from the API via `ExpenseTypesContext`.
- **Backend:** `routers/types_router.py` handles CRUD; PUT accepts `macrocategory_id`; `_valid_type_names(conn)` in `expenses_router.py` queries live type names for validation.

### Macrocategories
- **User-defined groups** of expense types (e.g. "Living", "Lifestyle"). Stored in `macrocategories` table (id, name, color, budget_limit)
- `budget_limit` is optional — used to show a group-level progress bar in SummaryBar
- Managed in the "Macrocategories" collapsible section at the bottom of Budget Goals
- Each expense type card has a dropdown to assign it to a macrocategory
- When a macrocategory is active (`activeMacro` in App.jsx), it filters: SummaryBar category cards, SpendingChart, MonthlyTrendsChart bars, and ExpenseList transactions
- Clicking a macrocategory card clears `activeType`; clicking a type tab clears `activeMacro`

### Monthly Budget Overrides
- Per-month budget limits stored in `monthly_budgets` table (type, month, monthly_limit, PRIMARY KEY(type, month))
- Override wins over the default from `budgets` table; computed by `GET /budgets/effective?month=`
- Managed via "Monthly Overrides" collapsible section in Budget Goals
- `GET /budgets/effective-range` returns per-month budget data for the trends chart (renders as a varying dashed Line when overrides exist, otherwise a flat ReferenceLine)

### Income
- Stored in the `incomes` table (id, name, amount, date, created_at, is_recurring)
- No "type" field — income is a single category displayed in teal (`#80cbc4`)
- `SummaryBar` shows total income and net (income − expenses) for the selected month
- `MonthlyTrendsChart` overlays income as a line on the spending bar chart
- Income tab in ExpenseList is always second (after "All"), before expense type tabs

### Recurring Expenses & Income
- Marked with `is_recurring = 1`; display a `RepeatIcon` in the table
- On startup, `apply_recurring_expenses()` and `apply_recurring_incomes()` copy previous month's recurring entries into the current month if not already present
- On add/edit, `seed_recurring_forward()` / `seed_income_recurring_forward()` immediately seeds the next 2 months

### Import (CSV / Excel) — Transactions
- `POST /import/preview` — auto-detects header row, returns headers + first 3 rows + sheet names for xlsx
- `POST /import` — accepts `mapping` (JSON: appField→fileColumn), `header_row`, optional `sheet_name`; determines expense vs income per row from amount sign or a mapped debit/credit column; infers expense type from learned rules then keyword heuristics then "Other"
- Multi-sheet xlsx: sheet selector appears in the mapping UI when more than one sheet is present

### Import — Budget Goals
- `POST /import/budgets` — accepts multipart form with `file`, `mapping` (JSON), `header_row`, optional `sheet_name`, optional `target_month`
- Aggregates duplicate category rows by summing their values
- Creates missing expense types automatically (assigns a default color/icon)
- If `target_month` is provided, saves as a monthly override instead of the default budget

### Import Rules (Learned Categorization)
- Stored in `import_rules` table (id, pattern, expense_type) — pattern is a case-insensitive substring match
- `POST /import-rules` upserts by pattern; `DELETE /import-rules/{id}` removes
- Applied in `_infer_type()` before keyword heuristics — user rules always win
- Created from `AddExpenseForm` edit mode via "Remember this categorization" checkbox + editable pattern field
- Also used by `GET /import/infer-type?name=` for live auto-categorization in AddExpenseForm

### Database
- `budget.db` stored at `~/.budget_app/budget.db` — persists across updates, not bundled into the binary
- Tables: `expenses`, `incomes`, `budgets`, `monthly_budgets`, `expense_types`, `macrocategories`, `import_rules`
- Column migrations handled in `init_db()` via try/except `ALTER TABLE` (e.g. `is_recurring`, `macrocategory_id`)

## Building for Distribution

CI/CD via GitHub Actions (`.github/workflows/build.yml`) — triggers on push to `master`, builds for macOS and Windows, uploads artifacts.

Local build:
```bash
./build.sh
```

Builds React frontend → copies `client/dist/` to `server/static/` → PyInstaller bundles everything into `server/dist/BudgetTracker/`. Users double-click the launcher script; the binary opens the app in their browser.

**PyInstaller notes:**
- All routers must be listed as `--hidden-import` in the workflow (including `macrocategories_router`)
- `openpyxl` requires `--collect-all openpyxl` (uses pkg_resources to locate XML schemas)
- `sys.frozen` is detected in `server.py` to switch from reload-mode uvicorn to production mode with browser auto-open

## API Endpoints

### Expenses
| Method | Path | Notes |
|--------|------|-------|
| GET | `/expenses` | `?type=`, `?macrocategory_id=`, `?month=`, `?page=`, `?page_size=`; returns `{ expenses, total, page, page_size }` |
| POST | `/expenses` | Body: `{ name, amount, type, date, is_recurring }` |
| PUT | `/expenses/{id}` | Updates all fields |
| DELETE | `/expenses/{id}` | |
| DELETE | `/transactions` | `?month=YYYY-MM` clears that month only; no param clears all expenses AND incomes |
| GET | `/expenses/summary` | `?month=YYYY-MM`; returns `[{ type, total, count }]` |
| GET | `/expenses/monthly-totals` | `?months=6`; returns `[{ month, total }]` |
| GET | `/expenses/monthly-by-type` | `?months=6`; returns `[{ month, type, total }]` |
| GET | `/expenses/months` | Returns distinct months that have expense data |

### Incomes
| Method | Path | Notes |
|--------|------|-------|
| GET | `/incomes` | `?month=`, `?page=`, `?page_size=`; returns `{ incomes, total, page, page_size }` |
| POST | `/incomes` | Body: `{ name, amount, date, is_recurring }` |
| PUT | `/incomes/{id}` | |
| DELETE | `/incomes/{id}` | |
| GET | `/incomes/summary` | `?month=YYYY-MM`; returns `{ total }` |
| GET | `/incomes/monthly-totals` | `?months=6`; returns `[{ month, total }]` |

### Budgets
| Method | Path | Notes |
|--------|------|-------|
| GET | `/budgets` | Default limits; returns `[{ type, monthly_limit }]` |
| POST | `/budgets` | Body: array of `{ type, monthly_limit }`; upserts |
| GET | `/budgets/effective` | `?month=YYYY-MM`; returns effective limits (override wins over default): `[{ type, monthly_limit, is_override }]` |
| GET | `/budgets/effective-range` | `?months=6`; per-month totals + by_type for chart: `[{ month, total, by_type }]` |
| GET | `/budgets/monthly-overrides` | `?month=YYYY-MM` returns overrides for that month; no param returns list of months with any overrides |
| POST | `/budgets/monthly-overrides` | Body: `{ month, budgets: [{ type, monthly_limit }] }`; upserts |
| DELETE | `/budgets/monthly-overrides/{month}` | Removes all overrides for that month |

### Expense Types
| Method | Path | Notes |
|--------|------|-------|
| GET | `/expense-types` | Returns all types (includes `macrocategory_id`) |
| POST | `/expense-types` | Body: `{ name, color, icon }` |
| PUT | `/expense-types/{id}` | Body: `{ name, color, icon, macrocategory_id? }`; cascades rename to expenses and budgets |
| DELETE | `/expense-types/{id}` | Blocked for `is_default` types (403); blocked if expenses exist without `?reassign_to=<id>` |

### Macrocategories
| Method | Path | Notes |
|--------|------|-------|
| GET | `/macrocategories` | Returns all macrocategories |
| POST | `/macrocategories` | Body: `{ name, color?, budget_limit? }` |
| GET | `/macrocategories/summary` | `?month=YYYY-MM`; returns `[{ id, name, color, budget_limit, total, count }]` |
| PUT | `/macrocategories/{id}` | Body: `{ name, color, budget_limit? }` |
| DELETE | `/macrocategories/{id}` | Nulls `macrocategory_id` on all member expense types |

### Import
| Method | Path | Notes |
|--------|------|-------|
| POST | `/import/preview` | Multipart: `file`, optional `header_row`, optional `sheet_name`; returns `{ headers, preview, header_row, sheet_names }` |
| POST | `/import` | Multipart: `file`, `mapping` (JSON), `header_row`, optional `sheet_name`; returns `{ imported, skipped, errors }` |
| GET | `/import/infer-type` | `?name=<string>`; returns `{ type }` based on import rules + keyword heuristics |
| POST | `/import/budgets` | Multipart: `file`, `mapping` (JSON), `header_row`, optional `sheet_name`, optional `target_month`; upserts budget limits, creates missing types |
| GET | `/import-rules` | Returns all learned categorization rules |
| POST | `/import-rules` | Body: `{ pattern, expense_type }`; upserts on pattern |
| DELETE | `/import-rules/{id}` | |
