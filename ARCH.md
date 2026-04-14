# Architecture

## Backend — `server/`

- **FastAPI** + **SQLite** (`~/.budget_app/budget.db`, created by `database.py:init_db()`)
- Routers: `expenses_router`, `budgets_router`, `types_router`, `incomes_router`, `import_router`, `import_rules_router`, `macrocategories_router`, `savings_goals_router`, `analysis_router`
- Models: dataclasses in `models.py`; Pydantic models inline for request validation
- CORS whitelisted to `http://localhost:5173`
- On startup: `init_db()` → `apply_recurring_expenses()` + `apply_recurring_incomes()`

## Frontend — `client/src/`

- **React 19 + Vite + MUI v7 + Recharts**, no router
- Styling: MUI `sx` prop + dark theme in `theme.js`; no component CSS files (`index.css` = scrollbar overrides only)
- `api.js` uses `VITE_API_URL` — empty in prod, `http://localhost:3001` in dev via `.env.development`

### State (App.jsx)
`refreshKey` · `selectedMonth` · `activeType` · `activeMacro`
Gates render on budgets existing; shows `BudgetSetup` if none. `SavingsPage` has its own isolated `refreshKey`.

### Context (ExpenseTypesContext.jsx)
`expenseTypes`, `typeMap`, `typeNames`, `reloadTypes`, `macrocategories`, `macroMap`, `reloadMacros`, `loading`

### Components

| Component | Purpose |
|-----------|---------|
| `BudgetSetup.jsx` | Onboarding — set initial budget limits |
| `SummaryBar.jsx` | Month nav, totals, macro + category cards, spending chart. Clicking a card filters the page. |
| `SpendingChart.jsx` | Horizontal bar chart (spent vs budget per category); inside SummaryBar |
| `MonthlyTrendsChart.jsx` | Stacked bars per type + income line; click bar filters; future months dimmed; budget as ReferenceLine or dashed Line when overrides exist |
| `ExpenseList.jsx` | Paginated table, type-filter tabs, text search (debounced), sortable columns, add/edit/delete, import, clear. Filters by `activeType` or `activeMacro`. |
| `AddExpenseForm.jsx` | Add/edit expense; debounced auto-categorization via `/import/infer-type`; "Remember this categorization" saves rule + retroactively applies |
| `AddIncomeForm.jsx` | Add/edit income |
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
6 seeded defaults (Food, Transport, Housing, Entertainment, Health, Other) — `is_default=1`, undeletable.
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
