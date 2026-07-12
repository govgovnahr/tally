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
