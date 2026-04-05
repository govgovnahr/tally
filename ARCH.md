# Architecture

## Backend — `server/`

- **FastAPI** + **SQLite** (`~/.budget_app/budget.db`, created by `database.py:init_db()`)
- Routers: `expenses_router`, `budgets_router`, `types_router`, `incomes_router`, `import_router`, `import_rules_router`, `macrocategories_router`
- Models: dataclasses in `models.py`; Pydantic models inline for request validation
- CORS whitelisted to `http://localhost:5173` only
- On startup: `init_db()` → `apply_recurring_expenses()` + `apply_recurring_incomes()` copy last month's recurring entries into current month

## Frontend — `client/src/`

- **React 19 + Vite + MUI v7 + Recharts**, no router
- All styling via MUI `sx` prop + dark theme in `theme.js`. No component CSS files (`index.css` = scrollbar overrides only)
- `api.js` uses `VITE_API_URL` — empty in prod, `http://localhost:3001` in dev via `client/.env.development`

### State (App.jsx)
`refreshKey` (triggers refetches) · `selectedMonth` · `activeType` · `activeMacro`
Gates render on budgets existing; shows `BudgetSetup` onboarding if none.

### Context (ExpenseTypesContext.jsx)
Provides globally: `expenseTypes`, `typeMap`, `typeNames`, `reloadTypes`, `macrocategories`, `macroMap`, `reloadMacros`, `loading`

### Components

| Component | Purpose |
|-----------|---------|
| `BudgetSetup.jsx` | Onboarding — set initial budget limits |
| `SummaryBar.jsx` | Month nav, totals, macrocategory + category cards, spending chart. Clicking a card filters the page. |
| `SpendingChart.jsx` | Horizontal bar chart (spent vs budget per category); inside SummaryBar |
| `MonthlyTrendsChart.jsx` | Stacked bars per type + income line; click bar filters; future months dimmed; budget as ReferenceLine or dashed Line when overrides exist |
| `ExpenseList.jsx` | Paginated table, type-filter tabs, add/edit/delete, import, clear. Filters by `activeType` or `activeMacro`. |
| `AddExpenseForm.jsx` | Add/edit expense; debounced auto-categorization via `/import/infer-type`; edit mode has "Remember this categorization" (saves import rule + retroactively applies to matching expenses) |
| `AddIncomeForm.jsx` | Add/edit income |
| `BudgetGoals.jsx` | Category cards (top 10 per group, expandable) grouped by macrocategory + budget limits + Monthly Overrides + Macrocategory management |
| `ImportDialog.jsx` | 3-step CSV/Excel import: upload → column mapping → results |
| `ImportBudgetsDialog.jsx` | 3-step CSV/Excel budget import; supports `target_month` override; creates missing types |

## Database

Tables: `expenses`, `incomes`, `budgets`, `monthly_budgets`, `expense_types`, `macrocategories`, `import_rules`

### expense_types
`id, name, color, icon, sort_order, is_default, macrocategory_id`
6 seeded defaults (Food, Transport, Housing, Entertainment, Health, Other) — `is_default=1`, cannot be deleted.
`ICON_REGISTRY` / `ICON_OPTIONS` in `client/src/expenseTypes.js`.

### macrocategories
`id, name, color, budget_limit(nullable)`
User-defined groups of expense types. Optional `budget_limit` shows a group progress bar in SummaryBar. DELETE nulls `macrocategory_id` on all member types.

### monthly_budgets
`type, month, monthly_limit` (PK: type+month)
Override wins over default `budgets` table. Computed by `GET /budgets/effective`. When any override exists, trends chart renders budget as a varying dashed Line instead of a flat ReferenceLine.

### import_rules
`id, pattern, expense_type`
Case-insensitive substring match. Applied before keyword heuristics in `_infer_type()`. Saving a rule retroactively updates all matching existing expenses.

### Recurring
`is_recurring=1` on expenses/incomes. On startup: previous month's recurring entries copied into current month. On add/edit: next 2 months seeded immediately.
