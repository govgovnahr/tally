def test_pacing_requires_month(client):
    r = client.get("/analysis/pacing")
    assert r.status_code == 422


def test_pacing_returns_shape(client):
    r = client.get("/analysis/pacing?month=2026-05")
    assert r.status_code == 200
    data = r.json()
    assert data["month"] == "2026-05"
    assert "categories" in data
    assert isinstance(data["categories"], list)


def test_month_over_month_shape(client):
    r = client.get("/analysis/month-over-month?months=3")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for entry in data:
        assert "month" in entry
        assert "total_income" in entry
        assert "total_spent" in entry
        assert "net" in entry
        assert "mom_change_pct" in entry


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


def test_months_available_shape(client):
    r = client.get("/analysis/months-available")
    assert r.status_code == 200
    assert isinstance(r.json()["months"], int)
    assert r.json()["months"] >= 1


def test_months_available_releases_its_connection(client):
    import psycopg2.extensions
    import database

    r = client.get("/analysis/months-available")
    assert r.status_code == 200

    # Regression test: get_months_available used to never call conn.close(),
    # leaving every single call's connection checked out of the pool forever
    # in an idle-in-transaction state — confirmed against the shared DB as
    # several real, day-plus-old idle-in-transaction sessions all running
    # this exact query. Under low test-suite concurrency, the pool hands the
    # very next getconn() back the same connection it just received via
    # putconn() (see test_database_pool.py's identical assumption) — so if
    # the endpoint had leaked it, this connection would still be mid-transaction.
    conn = database.get_connection()
    try:
        assert conn._conn.get_transaction_status() == psycopg2.extensions.TRANSACTION_STATUS_IDLE
    finally:
        conn.close()


def test_health_endpoint_closes_connection_even_if_the_query_fails(client, monkeypatch):
    # Regression test: health()'s except block only ran if get_connection()
    # itself failed — if the connection was obtained fine but conn.execute()
    # raised (a real DB problem, exactly the case this endpoint exists to
    # detect), conn.close() was skipped and leaked. Ironic for a health check
    # to leak connections precisely when the DB is unhealthy.
    import database
    import server as server_module

    real_get_connection = database.get_connection
    closed = {"value": False}

    def spy_get_connection():
        conn = real_get_connection()
        real_close = conn.close

        def failing_execute(*args, **kwargs):
            raise RuntimeError("simulated query failure")

        def spy_close():
            closed["value"] = True
            return real_close()

        conn.execute = failing_execute
        conn.close = spy_close
        return conn

    monkeypatch.setattr(server_module, "get_connection", spy_get_connection)

    r = client.get("/health")
    assert r.status_code == 503
    assert r.json()["db"] == "error"
    assert closed["value"] is True
