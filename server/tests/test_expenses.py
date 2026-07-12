def test_create_expense(client):
    r = client.post("/expenses", json={
        "name": "Test Coffee",
        "amount": 4.50,
        "type": "Food",
        "date": "2026-05-01",
        "is_recurring": False,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Test Coffee"
    assert data["amount"] == 4.50
    assert data["type"] == "Food"


def test_list_expenses_returns_created(client):
    client.post("/expenses", json={
        "name": "Lunch", "amount": 12.0, "type": "Food",
        "date": "2026-05-02", "is_recurring": False,
    })
    r = client.get("/expenses")
    assert r.status_code == 200
    data = r.json()
    assert "expenses" in data
    assert data["total"] >= 1
    assert all("id" in e for e in data["expenses"])


def test_delete_expense(client):
    r = client.post("/expenses", json={
        "name": "To Delete", "amount": 5.0, "type": "Other",
        "date": "2026-05-01", "is_recurring": False,
    })
    expense_id = r.json()["id"]

    del_r = client.delete(f"/expenses/{expense_id}")
    assert del_r.status_code == 200

    list_r = client.get("/expenses?search=To+Delete")
    assert all(e["id"] != expense_id for e in list_r.json()["expenses"])


def test_amount_must_be_positive(client):
    r = client.post("/expenses", json={
        "name": "Bad", "amount": -10, "type": "Food",
        "date": "2026-05-01", "is_recurring": False,
    })
    assert r.status_code == 422  # rejected by Pydantic's Field(gt=0) before the handler runs


def test_invalid_type_rejected(client):
    r = client.post("/expenses", json={
        "name": "Bad", "amount": 10, "type": "DoesNotExist",
        "date": "2026-05-01", "is_recurring": False,
    })
    assert r.status_code == 400


def test_filter_by_month(client):
    client.post("/expenses", json={
        "name": "May Expense", "amount": 20.0, "type": "Other",
        "date": "2026-05-15", "is_recurring": False,
    })
    r = client.get("/expenses?month=2026-05")
    assert r.status_code == 200
    data = r.json()
    assert all(e["date"].startswith("2026-05") for e in data["expenses"])
