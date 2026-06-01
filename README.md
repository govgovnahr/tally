# Tally

Personal budgeting app. Track expenses and income, set category budgets, monitor savings goals. Deployable to Render or runnable as a local desktop app.

## Features

- **User auth** — email/password registration and login; JWT cookie sessions; per-user data isolation
- **Expense & income tracking** — add, edit, delete, import from CSV/Excel; recurring entries seed future months automatically
- **Categories** — custom expense types (color + icon) grouped into macrocategories with optional group budget limits
- **Budgets** — per-category monthly limits with per-month overrides; two-tone progress bars show actual vs projected spend
- **Auto-categorization** — learned import rules match transaction names to categories; rules apply retroactively
- **Savings goals** — monthly contribution target + one-time goals + emergency fund; projected completion, allocation (% slice or priority cascade), pause/resume
- **Spending analysis** — budget pacing (historical daily rate projection), over-budget frequency, z-score outlier detection, month-over-month trends
- **Monthly trends** — stacked bar chart by category + income line over 6 months; future months dimmed

## Deploying to Render

`render.yaml` is pre-configured with a persistent disk, auto-generated secret key, and correct build/start commands.

1. Push repo to GitHub
2. Render dashboard → **New → Blueprint** → connect repo
3. Click **Apply** — Render reads `render.yaml` and provisions everything (~3–5 min build)
4. Visit the service URL and register your account
5. Render dashboard → your service → **Environment** → set `REGISTRATION_OPEN` to `"false"`
6. Optionally set `ALLOWED_ORIGINS` to `https://your-app.onrender.com`

Data persists at `/data/budget.db` on a 1 GB Render disk (survives redeploys).

## Running in Development

```bash
# Backend — http://localhost:3001
cd server && pip install -r requirements.txt && python server.py

# Frontend — http://localhost:5173
cd client && npm install && npm run dev
```

## Building for Desktop Distribution

```bash
./build.sh
```

React build → `client/dist/` → `server/static/` → PyInstaller → `server/dist/BudgetTracker/`. CI/CD on push to `master` produces macOS and Windows builds. Data stored at `~/.budget_app/budget.db` (persists across updates).

## Stack

React 19 + Vite + MUI v7 + Recharts (frontend) · FastAPI + SQLite + JWT/bcrypt (backend) · PyInstaller + GitHub Actions (desktop packaging/CI)

## Docs

- [ARCH.md](./ARCH.md) — component map, database schema, state flow
- [API.md](./API.md) — full endpoint reference
- [CLAUDE.md](./CLAUDE.md) — dev notes and gotchas
