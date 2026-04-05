# API Endpoints

Base: `http://localhost:3001`

## Expenses
| Method | Path | Notes |
|--------|------|-------|
| GET | `/expenses` | `?type=` `?macrocategory_id=` `?month=` `?page=` `?page_size=` → `{ expenses, total, page, page_size }` |
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
| GET | `/incomes` | `?month=` `?page=` `?page_size=` → `{ incomes, total, page, page_size }` |
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
| POST | `/import-rules` | `{ pattern, expense_type }`; upserts on pattern; retroactively applies to matching expenses → returns `{ id, pattern, expense_type, updated_count }` |
| DELETE | `/import-rules/{id}` | |
