"""Verifies RLS actually blocks cross-user access at the DB level — not just
that the app's own hand-written WHERE clauses happen to be correct. Every
query below deliberately omits any user_id filter; if a row from the "wrong"
user ever comes back, Postgres itself isn't scoping the connection.

Most tests here use database.get_connection() and database.current_user_id
directly rather than going through the FastAPI TestClient, to exercise the
RLS mechanism itself in isolation. test_rls_middleware_isolates_two_users_
over_real_http (bottom of this file) is the exception, and deliberately so:
none of the direct-contextvar tests would catch a regression in the
middleware/dependency wiring itself (the exact bug class that broke this
PR's first implementation attempt), since they bind current_user_id by hand
instead of going through _bind_db_identity.
"""

import uuid
import database
import auth
from auth import get_current_user
from server import app
from tests.conftest import TEST_USER

_USER_A = "test-rls-user-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
_USER_B = "test-rls-user-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def _insert_expense(user_id, name):
    # No contextvar set here — seeds via the bypass (system) role, independent
    # of whatever RLS wiring is under test.
    conn = database.get_connection()
    conn.execute(
        "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
        (str(uuid.uuid4()), name, 1.0, "Other", "2026-01-01", "2026-01-01T00:00:00", 0, user_id),
    )
    conn.commit()
    conn.close()


def _cleanup():
    conn = database.get_connection()
    conn.execute("DELETE FROM expenses WHERE user_id IN (%s, %s)", (_USER_A, _USER_B))
    conn.commit()
    conn.close()


def test_rls_switches_cleanly_across_pooled_connection_reuse():
    """Guards the exact invariant the design depends on: SET LOCAL must not
    leak one user's identity into the next borrower of the same pooled
    connection. (Also covers the simpler "a bare SELECT is scoped to the
    bound user" case as its first half, before it goes on to test the
    pool-reuse/user-switch case — no separate test needed for that alone.)"""
    _insert_expense(_USER_A, "belongs to A")
    _insert_expense(_USER_B, "belongs to B")
    try:
        token_a = database.current_user_id.set(_USER_A)
        conn_a = database.get_connection()
        rows_a = conn_a.execute(
            "SELECT name FROM expenses WHERE user_id IN (%s, %s)", (_USER_A, _USER_B)
        ).fetchall()
        conn_a.close()  # returns to pool; _release() rolls back -> SET LOCAL reverts
        database.current_user_id.reset(token_a)

        token_b = database.current_user_id.set(_USER_B)
        conn_b = database.get_connection()  # may well be the same underlying pooled connection
        rows_b = conn_b.execute(
            "SELECT name FROM expenses WHERE user_id IN (%s, %s)", (_USER_A, _USER_B)
        ).fetchall()
        conn_b.close()
        database.current_user_id.reset(token_b)
    finally:
        _cleanup()

    assert {r["name"] for r in rows_a} == {"belongs to A"}
    assert {r["name"] for r in rows_b} == {"belongs to B"}


def test_no_bound_identity_uses_bypass_role_and_sees_across_users():
    """System/startup paths (init_db, backfill_all_users, seed_demo.py) call
    get_connection() with no request in flight — current_user_id stays unset,
    so they must keep running on the bypass role rather than being silently
    RLS'd down to nothing."""
    _insert_expense(_USER_A, "belongs to A")
    _insert_expense(_USER_B, "belongs to B")
    try:
        assert database.current_user_id.get() is None
        conn = database.get_connection()
        rows = conn.execute(
            "SELECT name FROM expenses WHERE user_id IN (%s, %s)", (_USER_A, _USER_B)
        ).fetchall()
        conn.close()
    finally:
        _cleanup()

    assert {r["name"] for r in rows} == {"belongs to A", "belongs to B"}


def test_rls_middleware_isolates_two_users_over_real_http(client, monkeypatch):
    """
    Drives two different identities through the REAL _bind_db_identity
    middleware + get_current_user dependency + TestClient HTTP path, unlike
    every test above (which binds current_user_id by hand). This is the one
    thing that broke in this PR's first implementation attempt — identity
    silently failing to propagate from a FastAPI dependency into
    get_connection() — so this is the test that would actually catch that
    exact regression if it were reintroduced.
    """
    second_user = "test-rls-http-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    resp_a = client.post("/expenses", json={
        "name": "RLS http-isolation probe (user A)", "amount": 12.34,
        "type": "Other", "date": "2026-01-01", "is_recurring": False,
    })
    assert resp_a.status_code == 200

    # add_expense's guarded INSERT validates `type` against this user's own
    # expense_types (WHERE EXISTS ... AND user_id = %s) — second_user has none
    # seeded, so POST /expenses would 400 on a perfectly valid type name.
    seed_conn = database.get_connection()
    seed_conn.execute(
        "INSERT INTO expense_types (id, name, color, icon, sort_order, is_default, user_id) "
        "VALUES (%s,'Other','#a0a0a0','Category',0,1,%s) ON CONFLICT (user_id, name) DO NOTHING",
        (str(uuid.uuid4()), second_user),
    )
    seed_conn.commit()
    seed_conn.close()

    monkeypatch.setattr(auth, "resolve_identity_for_db", lambda request: second_user)
    app.dependency_overrides[get_current_user] = lambda: second_user
    try:
        resp_b_create = client.post("/expenses", json={
            "name": "RLS http-isolation probe (user B)", "amount": 56.78,
            "type": "Other", "date": "2026-01-01", "is_recurring": False,
        })
        assert resp_b_create.status_code == 200

        names_b = {e["name"] for e in client.get("/expenses?search=RLS+http-isolation+probe").json()["expenses"]}
        assert "RLS http-isolation probe (user B)" in names_b
        assert "RLS http-isolation probe (user A)" not in names_b
    finally:
        # monkeypatch.setattr's own undo doesn't run until this whole test
        # function returns — too late for the assertions below, which need
        # auth.resolve_identity_for_db back to resolving TEST_USER *now*, or
        # the final GET runs with the app-layer filter on TEST_USER but RLS
        # still bound to second_user, ANDing them into a query that can never
        # match any row.
        monkeypatch.undo()
        app.dependency_overrides[get_current_user] = lambda: TEST_USER
        conn = database.get_connection()
        conn.execute("DELETE FROM expenses WHERE user_id = %s", (second_user,))
        conn.execute("DELETE FROM expense_types WHERE user_id = %s", (second_user,))
        conn.commit()
        conn.close()

    names_a = {e["name"] for e in client.get("/expenses?search=RLS+http-isolation+probe").json()["expenses"]}
    assert "RLS http-isolation probe (user A)" in names_a
    assert "RLS http-isolation probe (user B)" not in names_a
