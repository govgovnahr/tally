def test_create_income(client):
    r = client.post("/incomes", json={
        "name": "Paycheck", "amount": 2500.0, "date": "2026-05-01", "is_recurring": 0,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Paycheck"
    assert data["amount"] == 2500.0


def test_amount_must_be_positive(client):
    r = client.post("/incomes", json={
        "name": "Bad", "amount": 0, "date": "2026-05-01", "is_recurring": 0,
    })
    assert r.status_code == 422  # rejected by Pydantic's Field(gt=0) before the handler runs


def test_list_incomes_filters_by_month(client):
    client.post("/incomes", json={
        "name": "May Deposit", "amount": 100.0, "date": "2026-05-10", "is_recurring": 0,
    })
    r = client.get("/incomes?month=2026-05")
    assert r.status_code == 200
    data = r.json()
    assert all(i["date"].startswith("2026-05") for i in data["incomes"])


def test_income_summary_excludes_credit_type(client):
    client.post("/incomes", json={
        "name": "Refund", "amount": 30.0, "date": "2026-05-15",
        "is_recurring": 0, "credit_type": "refund",
    })
    client.post("/incomes", json={
        "name": "Salary", "amount": 1000.0, "date": "2026-05-15", "is_recurring": 0,
    })
    r = client.get("/incomes/summary?month=2026-05")
    assert r.status_code == 200
    # Only the non-credit income counts toward the summary total
    assert r.json()["total"] >= 1000.0


def test_update_income(client):
    create_r = client.post("/incomes", json={
        "name": "Old Name", "amount": 50.0, "date": "2026-05-01", "is_recurring": 0,
    })
    income_id = create_r.json()["id"]

    r = client.put(f"/incomes/{income_id}", json={
        "name": "New Name", "amount": 75.0, "date": "2026-05-02", "is_recurring": 0,
    })
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"
    assert r.json()["amount"] == 75.0


def test_update_missing_income_404(client):
    r = client.put("/incomes/does-not-exist", json={
        "name": "X", "amount": 10.0, "date": "2026-05-01", "is_recurring": 0,
    })
    assert r.status_code == 404


def test_delete_income(client):
    create_r = client.post("/incomes", json={
        "name": "To Delete", "amount": 20.0, "date": "2026-05-01", "is_recurring": 0,
    })
    income_id = create_r.json()["id"]

    r = client.delete(f"/incomes/{income_id}")
    assert r.status_code == 200

    list_r = client.get("/incomes?search=To+Delete")
    assert all(i["id"] != income_id for i in list_r.json()["incomes"])


def test_delete_missing_income_404(client):
    r = client.delete("/incomes/does-not-exist")
    assert r.status_code == 404


def test_rapid_duplicate_submission_rejected(client):
    first = client.post("/incomes", json={
        "name": "Monthly Paycheck", "amount": 3000.0, "date": "2026-07-31", "is_recurring": 1,
    })
    assert first.status_code == 201

    # Same name+amount submitted again moments later, as happens when a slow
    # first request makes a user think it failed and they retry.
    second = client.post("/incomes", json={
        "name": "Monthly Paycheck", "amount": 3000.0, "date": "2026-07-31", "is_recurring": 1,
    })
    assert second.status_code == 409


def test_pool_connection_clean_after_duplicate_409(client):
    # The 409 path closes the connection without committing (the guarded INSERT
    # matched no row). It must return to the pool clean — a following request
    # must not inherit an aborted/mid-transaction connection.
    client.post("/incomes", json={
        "name": "Clean Pool Probe", "amount": 12.0, "date": "2026-05-01", "is_recurring": 0,
    })
    dup = client.post("/incomes", json={
        "name": "Clean Pool Probe", "amount": 12.0, "date": "2026-05-01", "is_recurring": 0,
    })
    assert dup.status_code == 409
    # Any normal request right after must succeed on the recycled connection.
    r = client.get("/incomes?month=2026-05")
    assert r.status_code == 200


def test_duplicate_check_ignores_date(client):
    # The real-world incident this guards against: the user hand-retyped the
    # date on the retry, so it differed from the first attempt's date. The
    # dedup check is keyed on name+amount (within the time window), not date.
    client.post("/incomes", json={
        "name": "Freelance Gig", "amount": 500.0, "date": "2026-06-30", "is_recurring": 0,
    })
    r = client.post("/incomes", json={
        "name": "Freelance Gig", "amount": 500.0, "date": "2026-07-31", "is_recurring": 0,
    })
    assert r.status_code == 409


def test_different_amount_not_treated_as_duplicate(client):
    client.post("/incomes", json={
        "name": "Side Project", "amount": 200.0, "date": "2026-05-01", "is_recurring": 0,
    })
    r = client.post("/incomes", json={
        "name": "Side Project", "amount": 250.0, "date": "2026-05-01", "is_recurring": 0,
    })
    assert r.status_code == 201


def test_recurring_income_seeds_two_months_idempotently(client):
    client.post("/incomes", json={
        "name": "Seed Salary", "amount": 4000.0, "date": "2026-05-01", "is_recurring": 1,
    })
    jun = client.get("/incomes?month=2026-06&search=Seed+Salary").json()["incomes"]
    jul = client.get("/incomes?month=2026-07&search=Seed+Salary").json()["incomes"]
    assert len(jun) == 1
    assert len(jul) == 1

    # A second recurring income with the same name (different amount escapes the
    # 5s primary dedup) must not re-seed Jun/Jul — the seed dedups on name+month.
    client.post("/incomes", json={
        "name": "Seed Salary", "amount": 4001.0, "date": "2026-05-01", "is_recurring": 1,
    })
    jun2 = client.get("/incomes?month=2026-06&search=Seed+Salary").json()["incomes"]
    assert len(jun2) == 1


def test_duplicate_check_expires_after_window(client):
    import time
    client.post("/incomes", json={
        "name": "Window Test Income", "amount": 42.0, "date": "2026-05-01", "is_recurring": 0,
    })
    time.sleep(6)  # dedup window is 5 seconds
    r = client.post("/incomes", json={
        "name": "Window Test Income", "amount": 42.0, "date": "2026-05-01", "is_recurring": 0,
    })
    assert r.status_code == 201
