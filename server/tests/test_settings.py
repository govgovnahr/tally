def test_get_settings_defaults(client):
    r = client.get("/settings")
    assert r.status_code == 200
    data = r.json()
    assert "cycle_start_day" in data
    assert "ai_enabled" in data
    assert "current_period" in data


def test_merge_patch_preserves_other_fields(client):
    # Set cycle_start_day first
    r = client.put("/settings", json={"cycle_start_day": 15})
    assert r.status_code == 200
    assert r.json()["cycle_start_day"] == 15

    # Patching ai_enabled alone must not reset cycle_start_day
    r2 = client.put("/settings", json={"ai_enabled": True})
    assert r2.status_code == 200
    assert r2.json()["cycle_start_day"] == 15

    # Patching cycle_start_day alone must not reset ai_enabled
    r3 = client.put("/settings", json={"cycle_start_day": 1})
    assert r3.status_code == 200
    assert r3.json()["ai_enabled"] is True

    # cleanup: disable ai again so later tests see a clean default
    client.put("/settings", json={"ai_enabled": False})


def test_period_bounds_calendar_month(client):
    client.put("/settings", json={"cycle_start_day": 1})
    r = client.get("/settings/period-bounds?month=2026-06")
    assert r.status_code == 200
    data = r.json()
    assert data["period_start"] == "2026-06-01"
    assert data["period_end"] == "2026-07-01"


def test_period_bounds_custom_cycle(client):
    client.put("/settings", json={"cycle_start_day": 23})
    r = client.get("/settings/period-bounds?month=2026-06")
    assert r.status_code == 200
    data = r.json()
    assert data["period_start"] == "2026-05-23"
    assert data["period_end"] == "2026-06-23"
    client.put("/settings", json={"cycle_start_day": 1})  # reset for other tests


def test_period_bounds_bulk(client):
    r = client.get("/settings/period-bounds-bulk?months=2026-01,2026-02")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert {d["month"] for d in data} == {"2026-01", "2026-02"}


def test_invalid_cycle_day_rejected(client):
    r = client.put("/settings", json={"cycle_start_day": 32})
    assert r.status_code == 422
