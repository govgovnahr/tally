def test_set_and_get_budgets(client):
    r = client.post("/budgets", json=[
        {"type": "Food", "monthly_limit": 400.0},
        {"type": "Transport", "monthly_limit": 150.0},
    ])
    assert r.status_code == 200

    r = client.get("/budgets")
    assert r.status_code == 200
    limits = {b["type"]: b["monthly_limit"] for b in r.json()}
    assert limits["Food"] == 400.0
    assert limits["Transport"] == 150.0


def test_set_budgets_rejects_unknown_type(client):
    r = client.post("/budgets", json=[{"type": "NotACategory", "monthly_limit": 100.0}])
    assert r.status_code == 400


def test_effective_budgets_falls_back_to_default(client):
    client.post("/budgets", json=[{"type": "Health", "monthly_limit": 200.0}])
    r = client.get("/budgets/effective?month=2099-01")
    assert r.status_code == 200
    data = r.json()
    entry = next(e for e in data if e["type"] == "Health")
    assert entry["monthly_limit"] == 200.0
    assert entry["is_override"] is False


def test_monthly_override_wins_over_default(client):
    client.post("/budgets", json=[{"type": "Entertainment", "monthly_limit": 100.0}])
    r = client.post("/budgets/monthly-overrides", json={
        "month": "2026-06",
        "budgets": [{"type": "Entertainment", "monthly_limit": 250.0}],
    })
    assert r.status_code == 200

    eff = client.get("/budgets/effective?month=2026-06").json()
    entry = next(e for e in eff if e["type"] == "Entertainment")
    assert entry["monthly_limit"] == 250.0
    assert entry["is_override"] is True

    # A different month is untouched by the override
    other = client.get("/budgets/effective?month=2026-07").json()
    other_entry = next(e for e in other if e["type"] == "Entertainment")
    assert other_entry["is_override"] is False


def test_delete_monthly_override(client):
    client.post("/budgets/monthly-overrides", json={
        "month": "2026-08",
        "budgets": [{"type": "Food", "monthly_limit": 500.0}],
    })
    r = client.delete("/budgets/monthly-overrides/2026-08")
    assert r.status_code == 200

    overrides = client.get("/budgets/monthly-overrides?month=2026-08").json()
    assert overrides == []


def test_named_routes_precede_param_routes(client):
    # /budgets/effective and /budgets/monthly-overrides must not be swallowed
    # by a hypothetical /budgets/{id}-style route — regression guard per
    # CLAUDE.md's route-order gotcha.
    r = client.get("/budgets/effective?month=2026-01")
    assert r.status_code == 200
    r = client.get("/budgets/monthly-overrides")
    assert r.status_code == 200
