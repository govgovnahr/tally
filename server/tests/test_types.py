def test_create_type(client):
    r = client.post("/expense-types", json={"name": "Custom Cat", "color": "#e8a87c", "icon": "Star"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Custom Cat"
    assert data["is_default"] == 0


def test_duplicate_type_name_rejected(client):
    client.post("/expense-types", json={"name": "Dup Type", "color": "#e8a87c", "icon": "Star"})
    r = client.post("/expense-types", json={"name": "Dup Type", "color": "#f0c040", "icon": "Star"})
    assert r.status_code == 409


def test_rename_type_cascades_to_expenses(client):
    create_r = client.post("/expense-types", json={"name": "Rename Me", "color": "#82b4e0", "icon": "Star"})
    type_id = create_r.json()["id"]

    client.post("/expenses", json={
        "name": "Tagged", "amount": 10.0, "type": "Rename Me",
        "date": "2026-05-01", "is_recurring": False,
    })

    r = client.put(f"/expense-types/{type_id}", json={"name": "Renamed", "color": "#82b4e0", "icon": "Star"})
    assert r.status_code == 200

    expenses_r = client.get("/expenses?type=Renamed")
    names = [e["name"] for e in expenses_r.json()["expenses"]]
    assert "Tagged" in names


def test_default_type_other_cannot_be_deleted(client):
    types_r = client.get("/expense-types")
    other_type = next(t for t in types_r.json() if t["name"] == "Other")
    r = client.delete(f"/expense-types/{other_type['id']}")
    assert r.status_code == 403


def test_delete_type_in_use_requires_reassign(client):
    create_r = client.post("/expense-types", json={"name": "In Use", "color": "#c49ee8", "icon": "Star"})
    type_id = create_r.json()["id"]
    client.post("/expenses", json={
        "name": "Blocks Delete", "amount": 5.0, "type": "In Use",
        "date": "2026-05-01", "is_recurring": False,
    })

    r = client.delete(f"/expense-types/{type_id}")
    assert r.status_code == 409


def test_delete_type_with_reassign_succeeds(client):
    create_r = client.post("/expense-types", json={"name": "Reassign Source", "color": "#c49ee8", "icon": "Star"})
    type_id = create_r.json()["id"]
    client.post("/expenses", json={
        "name": "Needs Reassign", "amount": 5.0, "type": "Reassign Source",
        "date": "2026-05-01", "is_recurring": False,
    })

    types_r = client.get("/expense-types")
    other_type = next(t for t in types_r.json() if t["name"] == "Other")

    r = client.delete(f"/expense-types/{type_id}?reassign_to={other_type['id']}")
    assert r.status_code == 200

    expenses_r = client.get("/expenses?type=Other")
    names = [e["name"] for e in expenses_r.json()["expenses"]]
    assert "Needs Reassign" in names
