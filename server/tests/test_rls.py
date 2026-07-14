"""Verifies RLS actually blocks cross-user access at the DB level — not just
that the app's own hand-written WHERE clauses happen to be correct. Every
query below deliberately omits any user_id filter; if a row from the "wrong"
user ever comes back, Postgres itself isn't scoping the connection.

Uses database.get_connection() and database.current_user_id directly rather
than going through the FastAPI TestClient, so these tests exercise the same
mechanism get_current_user() drives in production without depending on it.
"""

import uuid
import database

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


def test_rls_scopes_bare_select_to_the_bound_user():
    _insert_expense(_USER_A, "belongs to A")
    _insert_expense(_USER_B, "belongs to B")
    token = database.current_user_id.set(_USER_A)
    try:
        conn = database.get_connection()
        try:
            rows = conn.execute(
                "SELECT name FROM expenses WHERE user_id IN (%s, %s)", (_USER_A, _USER_B)
            ).fetchall()
        finally:
            conn.close()
    finally:
        database.current_user_id.reset(token)
        _cleanup()

    assert {r["name"] for r in rows} == {"belongs to A"}


def test_rls_switches_cleanly_across_pooled_connection_reuse():
    """Guards the exact invariant the design depends on: SET LOCAL must not
    leak one user's identity into the next borrower of the same pooled
    connection."""
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
