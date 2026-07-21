import uuid

from database import get_connection, _DEFAULT_TYPES
from routers.auth_router import _seed_default_types
from .conftest import TEST_USER


def test_seed_default_types_skips_insert_when_user_already_has_types(client):
    # conftest's session fixture seeds TEST_USER's default expense types before
    # any test runs — _seed_default_types should now be a no-op (no INSERT
    # attempts at all), not re-issue the same 11 statements on every /auth/me
    # call just to have Postgres discard them via ON CONFLICT DO NOTHING.
    conn = get_connection()
    cursor = conn.cursor()
    executed = []
    real_execute = cursor.execute

    def spy_execute(sql, params=()):
        executed.append(sql)
        return real_execute(sql, params)

    cursor.execute = spy_execute

    _seed_default_types(cursor, TEST_USER)
    conn.commit()
    conn.close()

    assert not any("INSERT INTO expense_types" in sql for sql in executed)


def test_seed_default_types_seeds_a_brand_new_user():
    fresh_user = str(uuid.uuid4())
    conn = get_connection()
    cursor = conn.cursor()
    try:
        _seed_default_types(cursor, fresh_user)
        conn.commit()
        rows = conn.execute(
            "SELECT name FROM expense_types WHERE user_id = %s", (fresh_user,)
        ).fetchall()
        assert {r["name"] for r in rows} == {name for name, *_ in _DEFAULT_TYPES}
    finally:
        conn.execute("DELETE FROM expense_types WHERE user_id = %s", (fresh_user,))
        conn.commit()
        conn.close()
