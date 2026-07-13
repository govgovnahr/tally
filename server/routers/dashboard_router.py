from fastapi import APIRouter, Depends, Query
from database import get_connection, get_user_settings, cycle_bounds
from auth import get_current_user

# Reuse the same helpers the standalone endpoints use — no SQL is duplicated here.
from routers.expenses_router import summary_rows
from routers.incomes_router import income_summary_total
from routers.macrocategories_router import macro_summary
from routers.budgets_router import _effective_budgets
from routers.analysis_router import compute_pacing_payload, compute_outliers
from routers.savings_goals_router import compute_savings_goals

router = APIRouter()


@router.get("/dashboard")
def get_dashboard(
    month: str = Query(...),
    lookback_months: int = Query(3),
    outlier_months: int = Query(12),
    user_id: str = Depends(get_current_user),
):
    """One payload for the whole dashboard, on a single pooled connection.

    Collapses the ~8 separate GETs the dashboard used to fire (and the
    period-bounds waterfall that gated half of them) into one request. Period
    bounds are computed server-side from the user's cycle, then every section is
    read on the warm connection — where a round trip is cheap — instead of the
    browser paying network latency per query. Each section's shape matches its
    standalone endpoint byte-for-byte so the frontend needs no transform changes.
    """
    conn = get_connection()
    settings = get_user_settings(conn, user_id)
    cycle_start_day = settings["cycle_start_day"]
    period_start, period_end = cycle_bounds(month, cycle_start_day)

    expenses_summary = summary_rows(conn, user_id, None, period_start, period_end)
    incomes_total = income_summary_total(conn, user_id, None, period_start, period_end)
    macros = macro_summary(conn, user_id, None, period_start, period_end)
    budgets_effective = _effective_budgets(conn, month, user_id)
    pacing = compute_pacing_payload(conn, settings, month, lookback_months, user_id)
    # Mirror the old client-side filter: outliers within the current period only.
    outliers_all = compute_outliers(conn, user_id, outlier_months)
    outliers = [o for o in outliers_all if period_start <= o["date"] < period_end]
    savings_goals = compute_savings_goals(conn, user_id)
    conn.close()

    return {
        "month": month,
        "period": {"period_start": period_start, "period_end": period_end, "period_label": month},
        "expenses_summary": expenses_summary,
        "incomes_summary": {"total": incomes_total},
        "macrocategories_summary": macros,
        "budgets_effective": budgets_effective,
        "pacing": pacing,
        "outliers": outliers,
        "savings_goals": savings_goals,
    }
