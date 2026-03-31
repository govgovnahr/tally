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
- Routes live in `routers/expenses_router.py`; models split between dataclasses (`models.py`) and Pydantic (`NewExpense` for request body validation)
- CORS is whitelisted to `http://localhost:5173` only
- **Route order matters**: `/expenses/summary` must be registered before `/expenses/{expense_id}` to avoid FastAPI treating "summary" as a path param

### Frontend — `client/src/`
- **React 19 + Vite**, no router — single page
- `App.jsx` owns a `refreshKey` integer; incrementing it triggers `useEffect` refetches in both `SummaryBar` and `ExpenseList`. Pass `onRefresh` down to trigger this.
- `api.js` uses `VITE_API_URL` env var for the base URL — empty string in production (relative to origin), `http://localhost:3001` in dev (via `client/.env.development`)
- Each component has a co-located `.css` file; global design tokens live in `index.css` as CSS custom properties

### Expense Types
Fixed list defined in multiple places — keep them in sync if adding types:
- `server/routers/expenses_router.py` → `EXPENSE_TYPES`
- `client/src/components/ExpenseList.jsx` → `EXPENSE_TYPES` + `TYPE_COLORS`
- `client/src/components/SummaryBar.jsx` → `TYPE_CONFIG` (color + icon per type)
- `client/src/components/AddExpenseForm.jsx` → `EXPENSE_TYPES`

### Database
`budget.db` is stored in `~/.budget_app/budget.db` (user's home directory), not in the project. This ensures data persists across app updates and is not bundled into the executable.

## Building for Distribution

```bash
./build.sh
```

This script: builds the React frontend → copies `client/dist/` to `server/static/` → runs PyInstaller to produce `server/dist/BudgetTracker/`. Share the entire `BudgetTracker/` folder; users double-click the binary and the app opens in their browser automatically.

In the bundled build, `server.py` detects `sys.frozen` and switches from `reload=True` uvicorn to a plain `uvicorn.run(app, ...)` with a browser auto-open timer.

### API Endpoints
| Method | Path | Notes |
|--------|------|-------|
| GET | `/expenses` | Optional `?type=` query param to filter by category |
| POST | `/expenses` | Body: `{ name, amount, type, date }` |
| DELETE | `/expenses/{id}` | Returns `{ id }` |
| GET | `/expenses/summary` | Returns `[{ type, total, count }]` sorted by total desc |
