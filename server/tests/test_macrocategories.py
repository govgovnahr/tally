def test_create_macrocategory(client):
    r = client.post("/macrocategories", json={"name": "Essentials", "color": "#82b4e0", "budget_limit": 1000.0})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Essentials"
    assert data["budget_limit"] == 1000.0


def test_duplicate_name_rejected(client):
    client.post("/macrocategories", json={"name": "Dup Group", "color": "#e8a87c"})
    r = client.post("/macrocategories", json={"name": "Dup Group", "color": "#f0c040"})
    assert r.status_code == 409


def test_update_macrocategory(client):
    create_r = client.post("/macrocategories", json={"name": "Old Group", "color": "#82b4e0"})
    macro_id = create_r.json()["id"]

    r = client.put(f"/macrocategories/{macro_id}", json={"name": "Renamed Group", "color": "#c49ee8", "budget_limit": 500.0})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed Group"


def test_update_missing_macrocategory_404(client):
    r = client.put("/macrocategories/does-not-exist", json={"name": "X", "color": "#a0a0a0"})
    assert r.status_code == 404


def test_delete_macrocategory_nulls_member_types(client):
    macro_r = client.post("/macrocategories", json={"name": "To Remove", "color": "#a0a0a0"})
    macro_id = macro_r.json()["id"]

    types_r = client.get("/expense-types")
    food_type = next(t for t in types_r.json() if t["name"] == "Food")
    client.put(f"/expense-types/{food_type['id']}", json={
        "name": "Food", "color": food_type["color"], "icon": food_type["icon"], "macrocategory_id": macro_id,
    })

    del_r = client.delete(f"/macrocategories/{macro_id}")
    assert del_r.status_code == 200

    types_after = client.get("/expense-types").json()
    food_after = next(t for t in types_after if t["name"] == "Food")
    assert food_after["macrocategory_id"] is None


def test_delete_missing_macrocategory_404(client):
    r = client.delete("/macrocategories/does-not-exist")
    assert r.status_code == 404


def test_summary_reflects_spending(client):
    macro_r = client.post("/macrocategories", json={"name": "Summary Group", "color": "#80cbc4"})
    macro_id = macro_r.json()["id"]

    types_r = client.get("/expense-types")
    other_type = next(t for t in types_r.json() if t["name"] == "Other")
    client.put(f"/expense-types/{other_type['id']}", json={
        "name": "Other", "color": other_type["color"], "icon": other_type["icon"], "macrocategory_id": macro_id,
    })

    client.post("/expenses", json={
        "name": "Grouped Expense", "amount": 40.0, "type": "Other",
        "date": "2026-05-05", "is_recurring": False,
    })

    r = client.get("/macrocategories/summary?month=2026-05")
    assert r.status_code == 200
    entry = next(e for e in r.json() if e["id"] == macro_id)
    assert entry["total"] >= 40.0
    assert entry["count"] >= 1
