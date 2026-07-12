def test_create_import_rule(client):
    r = client.post("/import-rules", json={"pattern": "starbucks", "expense_type": "Food"})
    assert r.status_code == 201
    data = r.json()
    assert data["pattern"] == "starbucks"
    assert data["expense_type"] == "Food"


def test_create_rule_retroactively_updates_matching_expenses(client):
    client.post("/expenses", json={
        "name": "Uber Eats Order", "amount": 22.0, "type": "Other",
        "date": "2026-05-01", "is_recurring": False,
    })

    r = client.post("/import-rules", json={"pattern": "uber eats", "expense_type": "Food"})
    assert r.status_code == 201
    assert r.json()["updated_count"] >= 1

    expenses_r = client.get("/expenses?type=Food")
    names = [e["name"] for e in expenses_r.json()["expenses"]]
    assert "Uber Eats Order" in names


def test_saving_same_pattern_upserts(client):
    first = client.post("/import-rules", json={"pattern": "netflix", "expense_type": "Entertainment"})
    second = client.post("/import-rules", json={"pattern": "netflix", "expense_type": "Other"})
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["expense_type"] == "Other"


def test_empty_pattern_rejected(client):
    r = client.post("/import-rules", json={"pattern": "   ", "expense_type": "Food"})
    assert r.status_code == 400


def test_delete_import_rule(client):
    create_r = client.post("/import-rules", json={"pattern": "spotify", "expense_type": "Entertainment"})
    rule_id = create_r.json()["id"]

    r = client.delete(f"/import-rules/{rule_id}")
    assert r.status_code == 200

    rules = client.get("/import-rules").json()
    assert all(rule["id"] != rule_id for rule in rules)


def test_delete_missing_rule_404(client):
    r = client.delete("/import-rules/does-not-exist")
    assert r.status_code == 404
