def test_pacing_returns_list(client):
    r = client.get("/analysis/pacing")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_month_over_month_shape(client):
    r = client.get("/analysis/month-over-month?months=3")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for entry in data:
        assert "month" in entry
        assert "income" in entry
        assert "expenses" in entry
        assert "net" in entry


def test_outliers_returns_list(client):
    r = client.get("/analysis/outliers")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_outlier_shape_when_present(client):
    # Seed one very large outlier relative to small baseline transactions
    for i in range(3):
        client.post("/expenses", json={
            "name": "Small Buy", "amount": 5.0, "type": "Entertainment",
            "date": f"2026-0{i+1}-01", "is_recurring": False,
        })
    client.post("/expenses", json={
        "name": "Big Purchase", "amount": 500.0, "type": "Entertainment",
        "date": "2026-04-15", "is_recurring": False,
    })

    r = client.get("/analysis/outliers?months=6")
    assert r.status_code == 200
    outliers = r.json()
    if outliers:
        for o in outliers:
            assert "id" in o
            assert "name" in o
            assert "z_score" in o
            assert "pct_above_avg" in o
            assert o["z_score"] >= 1.5


def test_avg_monthly_expenses(client):
    r = client.get("/analysis/avg-monthly-expenses")
    assert r.status_code == 200
    assert "avg_monthly_expenses" in r.json()


def test_health_endpoint(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["db"] == "ok"
