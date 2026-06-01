def test_create_one_time_goal(client):
    r = client.post("/savings-goals", json={
        "goal_type": "one_time",
        "name": "Test Vacation",
        "target": 2000.0,
        "deadline": "2027-12-31",
        "color": "#82b4e0",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Test Vacation"
    assert data["target"] == 2000.0
    assert data["progress_pct"] == 0.0
    assert data["projected_completion"] is None  # no contributions yet


def test_contribution_updates_progress(client):
    goal_r = client.post("/savings-goals", json={
        "goal_type": "one_time",
        "name": "Test Fund",
        "target": 500.0,
        "color": "#80cbc4",
    })
    goal_id = goal_r.json()["id"]

    r = client.post(f"/savings-goals/{goal_id}/contributions", json={
        "amount": 100.0,
        "date": "2026-05-01",
        "note": "First deposit",
    })
    assert r.status_code == 200

    goals_r = client.get("/savings-goals")
    goal = next(g for g in goals_r.json() if g["id"] == goal_id)
    assert goal["total_contributions"] == 100.0
    assert goal["progress_pct"] == 20.0


def test_contribution_creates_linked_expense(client):
    goal_r = client.post("/savings-goals", json={
        "goal_type": "one_time",
        "name": "Linked Goal",
        "target": 1000.0,
        "color": "#f0c040",
    })
    goal_id = goal_r.json()["id"]

    client.post(f"/savings-goals/{goal_id}/contributions", json={
        "amount": 50.0, "date": "2026-05-10",
    })

    expenses_r = client.get("/expenses?type=Savings")
    names = [e["name"] for e in expenses_r.json()["expenses"]]
    assert "Linked Goal" in names


def test_duplicate_monthly_goal_rejected(client):
    client.post("/savings-goals", json={
        "goal_type": "monthly", "name": "Monthly A",
        "target": 500.0, "color": "#e8a87c",
    })
    r = client.post("/savings-goals", json={
        "goal_type": "monthly", "name": "Monthly B",
        "target": 300.0, "color": "#f0c040",
    })
    assert r.status_code == 409


def test_pause_and_resume_goal(client):
    goal_r = client.post("/savings-goals", json={
        "goal_type": "one_time", "name": "Pause Test",
        "target": 300.0, "color": "#c49ee8",
    })
    goal_id = goal_r.json()["id"]

    pause_r = client.post(f"/savings-goals/{goal_id}/pause")
    assert pause_r.status_code == 200

    goals_r = client.get("/savings-goals")
    goal = next(g for g in goals_r.json() if g["id"] == goal_id)
    assert goal["paused"] is True
