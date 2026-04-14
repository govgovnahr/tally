# Budget Tracker

Personal budgeting app. Track expenses and income, set category budgets, monitor savings goals. Runs as a local desktop app (no cloud, no accounts).

## Features

- **Expense & income tracking** — add, edit, delete, import from CSV/Excel; recurring entries seed future months automatically
- **Categories** — custom expense types (color + icon) grouped into macrocategories with optional group budget limits
- **Budgets** — per-category monthly limits with per-month overrides; spending chart shows progress vs limit
- **Auto-categorization** — learned import rules match transaction names to categories; rules apply retroactively
- **Savings goals** — monthly contribution target + one-time goals; progress bars, projected completion, allocation (% slice or priority cascade), pause/resume
- **Monthly trends** — stacked bar chart by category + income line over 6 months; future months dimmed

## Running in Development

```bash
# Backend — http://localhost:3001
cd server && pip install -r requirements.txt && python server.py

# Frontend — http://localhost:5173
cd client && npm install && npm run dev
```

## Building for Distribution

```bash
./build.sh
```

React build → `client/dist/` → `server/static/` → PyInstaller → `server/dist/BudgetTracker/`. CI/CD on push to `master` produces macOS and Windows builds. Data stored at `~/.budget_app/budget.db` (persists across updates).

## Stack

React 19 + Vite + MUI v7 + Recharts (frontend) · FastAPI + SQLite (backend) · PyInstaller + GitHub Actions (packaging/CI)

## Docs

- [ARCH.md](./ARCH.md) — component map, database schema, state flow
- [API.md](./API.md) — full endpoint reference
- [CLAUDE.md](./CLAUDE.md) — dev notes and gotchas
