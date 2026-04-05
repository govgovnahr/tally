# CLAUDE.md

Full-stack single-page budgeting app. No test suite. See [ARCH.md](./ARCH.md) for architecture, [API.md](./API.md) for endpoints.

## Running

Two terminals required simultaneously:

```bash
# Backend (port 3001)
cd server && pip install -r requirements.txt && python server.py

# Frontend (port 5173)
cd client && npm install && npm run dev
```

## Building for Distribution

```bash
./build.sh
```

React build → `client/dist/` copied to `server/static/` → PyInstaller bundles into `server/dist/BudgetTracker/`.

CI/CD via GitHub Actions (`.github/workflows/build.yml`) on push to `master`, builds macOS + Windows.

**PyInstaller notes:**
- All routers need `--hidden-import` in the workflow
- `openpyxl` requires `--collect-all openpyxl`
- `sys.frozen` in `server.py` switches uvicorn to production mode + opens browser

## Key Gotchas

- **Route order matters**: named routes (e.g. `/expenses/summary`, `/macrocategories/summary`) must be registered before `/{id}` param routes
- `activeMacro` and `activeType` are mutually exclusive — selecting one clears the other
- `is_default = 1` types cannot be deleted (frontend hides button, backend returns 403)
- DB migrations use try/except `ALTER TABLE` in `init_db()`
- `budget.db` lives at `~/.budget_app/budget.db`, not bundled into the binary
