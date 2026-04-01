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
- **FastAPI** app (`server.py`) with **SQLite** (`budget.db` created on first run via `database.py:init_db()`)
- Routes live in `routers/expenses_router.py` and `routers/budgets_router.py`; models split between dataclasses (`models.py`) and Pydantic (`NewExpense` for request body validation)
- CORS is whitelisted to `http://localhost:5173` only
- **Route order matters**: `/expenses/summary` must be registered before `/expenses/{expense_id}` to avoid FastAPI treating "summary" as a path param
- On startup, `init_db()` creates tables and `apply_recurring_expenses()` auto-copies last month's recurring expenses into the current month

### Frontend — `client/src/`
- **React 19 + Vite + Material UI (MUI v7) + Recharts**, no router — single page
- UI is built with MUI components; styling is done via the `sx` prop against the custom dark theme in `theme.js`. There are no component CSS files — `index.css` only contains scrollbar overrides.
- The MUI theme (`src/theme.js`) defines the dark palette, typography, and component overrides. Wrap any new top-level components with `ThemeProvider` if rendering outside `main.jsx`.
- `App.jsx` owns a `refreshKey` integer; incrementing it triggers `useEffect` refetches in both `SummaryBar` and `ExpenseList`. Pass `onRefresh` down to trigger this.
- `App.jsx` also checks on startup whether any budgets exist; if none, shows `BudgetSetup` (onboarding) instead of the main view
- `api.js` uses `VITE_API_URL` env var for the base URL — empty string in production (relative to origin), `http://localhost:3001` in dev (via `client/.env.development`)

### Components

| Component | Purpose |
|-----------|---------|
| `App.jsx` | Root — manages `refreshKey`, budget-ready check, routes between onboarding and main view |
| `BudgetSetup.jsx` | Onboarding form to set monthly budget limits per category; shown when no budgets exist |
| `SummaryBar.jsx` | Monthly summary cards per category with progress bars and over-budget warnings |
| `ExpenseList.jsx` | Expense table with type-filter tabs, delete, and Add Expense button that opens modal |
| `AddExpenseForm.jsx` | Modal (MUI Dialog) for adding **or editing** an expense — pass an `expense` prop to enter edit mode |
| `BudgetEdit.jsx` | "Budget Goals" page — loads and edits monthly limits per category |
| `SpendingChart.jsx` | Recharts horizontal bar chart (spent vs budget per category); rendered inside `SummaryBar` |

### Expense Types
Two sources of truth — one per language boundary:
- **Frontend:** `client/src/expenseTypes.js` — single file exporting `EXPENSE_TYPES` (array of `{ type, color, Icon }`), `TYPE_MAP` (keyed by name), and `TYPE_NAMES` (plain string array). `Icon` is an MUI icon component — render it as `<config.Icon />`. All frontend components import from here.
- **Backend:** `server/routers/expenses_router.py` → `EXPENSE_TYPES` list (strings only, used for validation)

If adding or renaming a type, update both files.

### Recurring Expenses
- Expenses can be marked `is_recurring = 1` via the "Recurring monthly expense" checkbox in the add form
- On server startup, `apply_recurring_expenses()` in `database.py` checks for recurring expenses from the previous month and copies them into the current month (if not already present, matched by `name|type`)
- Recurring expenses display a `RepeatIcon` (MUI) next to the name in the expense table

### Database
- `budget.db` stored at `~/.budget_app/budget.db` — persists across app updates, not bundled into the executable
- Two tables: `expenses` (id, name, amount, type, date, created_at, is_recurring) and `budgets` (type, monthly_limit)
- Migration for `is_recurring` column is handled in `init_db()` for existing databases

## Building for Distribution

```bash
./build.sh
```

Builds the React frontend → copies `client/dist/` to `server/static/` → runs PyInstaller to produce `server/dist/BudgetTracker/`. Share the entire `BudgetTracker/` folder; users double-click the binary and the app opens in their browser automatically.

In the bundled build, `server.py` detects `sys.frozen` and switches from `reload=True` uvicorn to a plain `uvicorn.run(app, ...)` with a browser auto-open timer.

## API Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/expenses` | Optional `?type=` query param to filter by category; returns `{ expenses: [...] }` |
| POST | `/expenses` | Body: `{ name, amount, type, date, is_recurring }`; returns created expense |
| PUT | `/expenses/{id}` | Body: same as POST; updates all fields, returns updated expense |
| DELETE | `/expenses/{id}` | Returns `{ id }` |
| GET | `/expenses/summary` | Optional `?month=YYYY-MM`; returns `[{ type, total, count }]` sorted by total desc |
| GET | `/budgets` | Returns array of `{ type, monthly_limit }` |
| POST | `/budgets` | Body: array of `{ type, monthly_limit }`; upserts all budget limits |
