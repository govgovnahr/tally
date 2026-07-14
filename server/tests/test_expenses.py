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


def test_delete_missing_expense_404(client):
    r = client.delete("/expenses/does-not-exist")
    assert r.status_code == 404


def test_update_missing_expense_404(client):
    r = client.put("/expenses/does-not-exist", json={
        "name": "X", "amount": 10.0, "type": "Other",
        "date": "2026-05-01", "is_recurring": False,
    })
    assert r.status_code == 404


def test_update_expense_invalid_type_400(client):
    # An existing expense with a bad type must return 400 (invalid type), not 404 —
    # the update path keeps a type-validation query specifically to preserve this.
    create_r = client.post("/expenses", json={
        "name": "Retype Me", "amount": 8.0, "type": "Other",
        "date": "2026-05-01", "is_recurring": False,
    })
    expense_id = create_r.json()["id"]
    r = client.put(f"/expenses/{expense_id}", json={
        "name": "Retype Me", "amount": 8.0, "type": "DoesNotExist",
        "date": "2026-05-01", "is_recurring": False,
    })
    assert r.status_code == 400


def test_create_expense_with_subcategory(client):
    r = client.post("/expenses", json={
        "name": "Latte", "amount": 5.5, "type": "Food",
        "date": "2026-05-01", "is_recurring": False, "subcategory": "Coffee Shops",
    })
    assert r.status_code == 200
    assert r.json()["subcategory"] == "Coffee Shops"


def test_create_expense_without_subcategory_is_null(client):
    r = client.post("/expenses", json={
        "name": "No Subcat", "amount": 5.0, "type": "Food",
        "date": "2026-05-01", "is_recurring": False,
    })
    assert r.status_code == 200
    assert r.json().get("subcategory") is None


def test_blank_subcategory_normalized_to_null(client):
    r = client.post("/expenses", json={
        "name": "Blank Subcat", "amount": 5.0, "type": "Food",
        "date": "2026-05-01", "is_recurring": False, "subcategory": "   ",
    })
    assert r.status_code == 200
    assert r.json()["subcategory"] is None


def test_filter_by_subcategory(client):
    client.post("/expenses", json={
        "name": "Espresso", "amount": 3.0, "type": "Food",
        "date": "2026-05-03", "is_recurring": False, "subcategory": "Coffee Shops",
    })
    client.post("/expenses", json={
        "name": "Cereal", "amount": 6.0, "type": "Food",
        "date": "2026-05-03", "is_recurring": False, "subcategory": "Groceries",
    })
    r = client.get("/expenses?subcategory=Coffee+Shops")
    assert r.status_code == 200
    names = [e["name"] for e in r.json()["expenses"]]
    assert "Espresso" in names
    assert "Cereal" not in names


def test_update_expense_sets_subcategory(client):
    create_r = client.post("/expenses", json={
        "name": "Update Subcat", "amount": 8.0, "type": "Other",
        "date": "2026-05-01", "is_recurring": False,
    })
    expense_id = create_r.json()["id"]
    put_r = client.put(f"/expenses/{expense_id}", json={
        "name": "Update Subcat", "amount": 8.0, "type": "Other",
        "date": "2026-05-01", "is_recurring": False, "subcategory": "Utilities",
    })
    assert put_r.status_code == 200
    assert put_r.json()["subcategory"] == "Utilities"

    list_r = client.get("/expenses?search=Update+Subcat")
    updated = next(e for e in list_r.json()["expenses"] if e["id"] == expense_id)
    assert updated["subcategory"] == "Utilities"


def test_get_subcategories_returns_distinct_sorted(client):
    client.post("/expenses", json={
        "name": "Sub A1", "amount": 1.0, "type": "Food",
        "date": "2026-05-04", "is_recurring": False, "subcategory": "Zeta Subcat",
    })
    client.post("/expenses", json={
        "name": "Sub A2", "amount": 1.0, "type": "Food",
        "date": "2026-05-04", "is_recurring": False, "subcategory": "Zeta Subcat",
    })
    client.post("/expenses", json={
        "name": "Sub A3", "amount": 1.0, "type": "Food",
        "date": "2026-05-04", "is_recurring": False, "subcategory": "Alpha Subcat",
    })
    client.post("/expenses", json={
        "name": "Sub A4", "amount": 1.0, "type": "Food",
        "date": "2026-05-04", "is_recurring": False,
    })
    r = client.get("/expenses/subcategories")
    assert r.status_code == 200
    result = r.json()
    assert result.count("Zeta Subcat") == 1
    assert "Alpha Subcat" in result
    assert result.index("Alpha Subcat") < result.index("Zeta Subcat")
    assert None not in result and "" not in result


def test_recurring_expense_seeds_two_months_idempotently(client):
    payload = {
        "name": "Rent Probe", "amount": 1500.0, "type": "Other",
        "date": "2026-05-01", "is_recurring": True,
    }
    client.post("/expenses", json=payload)
    # Two forward months seeded (Jun, Jul); source month itself is the original row.
    jun = client.get("/expenses?month=2026-06&search=Rent+Probe").json()["expenses"]
    jul = client.get("/expenses?month=2026-07&search=Rent+Probe").json()["expenses"]
    assert len(jun) == 1
    assert len(jul) == 1

    # Re-posting the same recurring expense must NOT double-seed those months.
    client.post("/expenses", json=payload)
    jun2 = client.get("/expenses?month=2026-06&search=Rent+Probe").json()["expenses"]
    assert len(jun2) == 1
