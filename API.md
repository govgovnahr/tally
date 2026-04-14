# API Endpoints

Base: `http://localhost:3001`

## Expenses
| Method | Path | Notes |
|--------|------|-------|
| GET | `/expenses` | `?type= ?macrocategory_id= ?month= ?page= ?page_size= ?search= ?sort_by=date\|name\|amount ?sort_dir=asc\|desc` → `{ expenses, total, page, page_size }` |
| POST | `/expenses` | `{ name, amount, type, date, is_recurring }` |
| PUT | `/expenses/{id}` | Updates all fields |
| DELETE | `/expenses/{id}` | |
| DELETE | `/transactions` | `?month=YYYY-MM` clears that month; no param clears all expenses + incomes |
| GET | `/expenses/summary` | `?month=YYYY-MM` → `[{ type, total, count }]` |
| GET | `/expenses/monthly-totals` | `?months=6` → `[{ month, total }]` |
| GET | `/expenses/monthly-by-type` | `?months=6` → `[{ month, type, total }]` |
| GET | `/expenses/months` | Distinct months with expense data |

## Incomes
| Method | Path | Notes |
|--------|------|-------|
| GET | `/incomes` | `?month= ?page= ?page_size= ?search= ?sort_by=date\|name\|amount ?sort_dir=asc\|desc` → `{ incomes, total, page, page_size }` |
| POST | `/incomes` | `{ name, amount, date, is_recurring }` |
| PUT | `/incomes/{id}` | |
| DELETE | `/incomes/{id}` | |
| GET | `/incomes/summary` | `?month=YYYY-MM` → `{ total }` |
| GET | `/incomes/monthly-totals` | `?months=6` → `[{ month, total }]` |

## Budgets
| Method | Path | Notes |
|--------|------|-------|
| GET | `/budgets` | Default limits → `[{ type, monthly_limit }]` |
| POST | `/budgets` | Array of `{ type, monthly_limit }`; upserts |
| GET | `/budgets/effective` | `?month=YYYY-MM` → `[{ type, monthly_limit, is_override }]` |
| GET | `/budgets/effective-range` | `?months=6` → `[{ month, total, by_type }]` |
| GET | `/budgets/monthly-overrides` | `?month=` → overrides for month; no param → months with any overrides |
| POST | `/budgets/monthly-overrides` | `{ month, budgets: [{ type, monthly_limit }] }`; upserts |
| DELETE | `/budgets/monthly-overrides/{month}` | Removes all overrides for that month |

## Expense Types
| Method | Path | Notes |
|--------|------|-------|
| GET | `/expense-types` | All types (includes `macrocategory_id`) |
| POST | `/expense-types` | `{ name, color, icon }` |
| PUT | `/expense-types/{id}` | `{ name, color, icon, macrocategory_id? }`; cascades rename to expenses + budgets |
| DELETE | `/expense-types/{id}` | 403 if `is_default`; requires `?reassign_to=<id>` if expenses exist |

## Macrocategories
| Method | Path | Notes |
|--------|------|-------|
| GET | `/macrocategories` | All macrocategories |
| POST | `/macrocategories` | `{ name, color?, budget_limit? }` |
| GET | `/macrocategories/summary` | `?month=YYYY-MM` → `[{ id, name, color, budget_limit, total, count }]` |
| PUT | `/macrocategories/{id}` | `{ name, color, budget_limit? }` |
| DELETE | `/macrocategories/{id}` | Nulls `macrocategory_id` on member types |

## Import
| Method | Path | Notes |
|--------|------|-------|
| POST | `/import/preview` | Multipart: `file`, opt `header_row`, opt `sheet_name` → `{ headers, preview, header_row, sheet_names }` |
| POST | `/import` | Multipart: `file`, `mapping` (JSON), `header_row`, opt `sheet_name` → `{ imported, skipped, errors }` |
| GET | `/import/infer-type` | `?name=` → `{ type }` |
| POST | `/import/budgets` | Multipart: `file`, `mapping`, `header_row`, opt `sheet_name`, opt `target_month`; upserts budgets, creates missing types |
| GET | `/import-rules` | All learned categorization rules |
| POST | `/import-rules` | `{ pattern, expense_type }`; upserts on pattern; retroactively applies → `{ id, pattern, expense_type, updated_count }` |
| DELETE | `/import-rules/{id}` | |

## Savings Goals
| Method | Path | Notes |
|--------|------|-------|
| GET | `/savings-goals` | All goals with computed: `effective_progress`, `total_contributions`, `progress_pct`, `avg_monthly_net`, `effective_avg_monthly_net`, `projected_completion`, `completed`, `contributions[]` |
| POST | `/savings-goals` | `{ goal_type, name, target, deadline?, color?, allocation_pct?, priority? }`; 409 if `monthly` exists; 409 on priority conflict |
| PUT | `/savings-goals/{id}` | `{ name, target, deadline?, color?, allocation_pct?, priority?, paused }`; `goal_type` immutable |
| DELETE | `/savings-goals/{id}` | Deletes contributions; linked expenses preserved |
| PATCH | `/savings-goals/{id}/pause` | Toggles `paused` |
| GET | `/savings-goals/net-chart` | `?months=6` → `[{ month, income, expenses, net }]`; all months returned even with no data |
| GET | `/savings-goals/monthly-goal` | → `{ target: N \| null }` |
| GET | `/savings-goals/avg-net` | `?months=3` → `{ avg_monthly_net, months }` |
| GET | `/savings-goals/{id}/contributions` | → `[{ id, goal_id, amount, date, note, created_at, expense_id }]` date DESC |
| POST | `/savings-goals/{id}/contributions` | `{ amount, date, note?, expense_id? }`; creates linked expense unless `expense_id` provided; auto-creates "Savings" type if needed |
| DELETE | `/savings-goals/{id}/contributions/{contrib_id}` | Also deletes linked expense |

## Analysis
| Method | Path | Notes |
|--------|------|-------|
| GET | `/analysis/pacing` | `?month=YYYY-MM &lookback_months=3` → `{ month, days_elapsed, days_in_month, is_current_month, categories: [{ type, spent, projected_spend, budget_limit, pacing_pct, status }] }`. Past months: `projected_spend=null`. Future months: `categories=[]`. |
| GET | `/analysis/category-stats` | `?months=6` → `[{ type, avg_monthly, last_month, budget_limit, months_over, months_total, frequency_pct, avg_overage, trend, monthly[] }]` sorted by frequency desc |
| GET | `/analysis/outliers` | `?months=3` → `[{ id, name, type, amount, date, category_avg, z_score, pct_above_avg }]` z≥1.5, min 3 per category, capped at 15 |
| GET | `/analysis/avg-monthly-expenses` | `?months=3` → `{ avg_monthly_expenses, months }` (excludes current month) |
| GET | `/analysis/month-over-month` | `?months=6` → `[{ month, total_spent, total_income, net, mom_change_pct }]` |
