"""Parity tests: /dashboard sections must equal the standalone endpoints.

This is the guard that the helpers extracted for the aggregate endpoint
(summary_rows, income_summary_total, macro_summary, compute_pacing_payload,
compute_outliers, compute_savings_goals) didn't drift from the routes they were
lifted out of.
"""

_MONTH = "2026-05"


def _seed(client):
    client.post("/expenses", json={"name": "Dash Groceries", "amount": 60.0, "type": "Food", "date": f"{_MONTH}-04", "is_recurring": False})
    client.post("/expenses", json={"name": "Dash Bus", "amount": 15.0, "type": "Transport", "date": f"{_MONTH}-05", "is_recurring": False})
    client.post("/incomes", json={"name": "Dash Salary", "amount": 2200.0, "date": f"{_MONTH}-01", "is_recurring": 0})
    client.post("/budgets", json=[{"type": "Food", "monthly_limit": 300.0}])


def _bounds(client):
    b = client.get(f"/settings/period-bounds?month={_MONTH}").json()
    return b["period_start"], b["period_end"]


def test_dashboard_period_matches_settings(client):
    _seed(client)
    dash = client.get(f"/dashboard?month={_MONTH}").json()
    settings = client.get(f"/settings/period-bounds?month={_MONTH}").json()
    assert dash["period"]["period_start"] == settings["period_start"]
    assert dash["period"]["period_end"] == settings["period_end"]
    assert dash["period"]["period_label"] == _MONTH


def test_dashboard_expenses_summary_matches_standalone(client):
    _seed(client)
    ps, pe = _bounds(client)
    dash = client.get(f"/dashboard?month={_MONTH}").json()
    standalone = client.get(f"/expenses/summary?period_start={ps}&period_end={pe}").json()
    assert dash["expenses_summary"] == standalone


def test_dashboard_incomes_summary_matches_standalone(client):
    _seed(client)
    ps, pe = _bounds(client)
    dash = client.get(f"/dashboard?month={_MONTH}").json()
    standalone = client.get(f"/incomes/summary?period_start={ps}&period_end={pe}").json()
    assert dash["incomes_summary"] == standalone


def test_dashboard_macro_summary_matches_standalone(client):
    _seed(client)
    ps, pe = _bounds(client)
    dash = client.get(f"/dashboard?month={_MONTH}").json()
    standalone = client.get(f"/macrocategories/summary?period_start={ps}&period_end={pe}").json()
    assert dash["macrocategories_summary"] == standalone


def test_dashboard_budgets_effective_matches_standalone(client):
    _seed(client)
    dash = client.get(f"/dashboard?month={_MONTH}").json()
    standalone = client.get(f"/budgets/effective?month={_MONTH}").json()
    assert dash["budgets_effective"] == standalone


def test_dashboard_pacing_matches_standalone(client):
    _seed(client)
    dash = client.get(f"/dashboard?month={_MONTH}&lookback_months=3").json()
    standalone = client.get(f"/analysis/pacing?month={_MONTH}&lookback_months=3").json()
    assert dash["pacing"] == standalone


def test_dashboard_savings_goals_matches_standalone(client):
    _seed(client)
    client.post("/savings-goals", json={"goal_type": "one_time", "name": "Dash Goal", "target": 500.0, "color": "#80cbc4"})
    dash = client.get(f"/dashboard?month={_MONTH}").json()
    standalone = client.get("/savings-goals").json()
    assert dash["savings_goals"] == standalone


def test_dashboard_outliers_filtered_to_period(client):
    _seed(client)
    ps, pe = _bounds(client)
    dash = client.get(f"/dashboard?month={_MONTH}&outlier_months=12").json()
    # Every returned outlier must fall inside the current period window.
    assert all(ps <= o["date"] < pe for o in dash["outliers"])
