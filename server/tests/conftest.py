import os
import sys
import uuid
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
import server
import auth
import database
from server import app
from auth import get_current_user
from database import get_connection

# server.py's global fixed-window rate limiter (100 writes/min, 300 GETs/min)
# is keyed per-IP/user for real traffic. Every TestClient request in this
# suite shares one fake key, so a fast full run (connection pooling removed
# the per-request latency that used to spread requests across minutes) can
# burst past those caps well within normal test activity. Not a limit real
# users would hit; raise it for the test session only.
server._WRITE_LIMIT = 100_000
server._GET_LIMIT = 100_000

TEST_USER = "test-user-00000000-0000-0000-0000-000000000099"

_SEED_TYPES = [
    ("Food",          "#e8a87c", "Restaurant",   0),
    ("Transport",     "#82b4e0", "Commute",       1),
    ("Housing",       "#c49ee8", "Home",          2),
    ("Entertainment", "#f0c040", "Movie",         3),
    ("Health",        "#80cbc4", "LocalHospital", 4),
    ("Other",         "#a0a0a0", "Category",      5),
]


@pytest.fixture(scope="session")
def client():
    app.dependency_overrides[get_current_user] = lambda: TEST_USER

    # _bind_db_identity (server.py) reads auth.resolve_identity_for_db directly
    # as a plain function call in ASGI middleware, not through FastAPI's
    # dependency-injection system — app.dependency_overrides above has no
    # effect on it. Patch it separately so this suite's requests actually run
    # under Postgres's `authenticated` role / RLS, the same as a real signed-in
    # user, instead of silently staying on the app's bypass-RLS role.
    #
    # pytest.MonkeyPatch() (not the function-scoped `monkeypatch` fixture,
    # which can't be used from a session-scoped fixture) + try/finally so the
    # patch is always undone even if something below raises — otherwise a
    # failure during seeding would leave auth.resolve_identity_for_db
    # permanently overridden to always return TEST_USER for the rest of the
    # interpreter process.
    mp = pytest.MonkeyPatch()
    mp.setattr(auth, "resolve_identity_for_db", lambda request: TEST_USER)
    try:
        conn = get_connection()
        for name, color, icon, sort_order in _SEED_TYPES:
            conn.execute(
                "INSERT INTO expense_types (id, name, color, icon, sort_order, is_default, user_id) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (user_id, name) DO NOTHING",
                (str(uuid.uuid4()), name, color, icon, sort_order, 1, TEST_USER),
            )
        conn.commit()
        conn.close()

        with TestClient(app) as c:
            yield c
    finally:
        conn = get_connection()
        # database._USER_OWNED_TABLES is the canonical "every table with a
        # user_id column" list — used here (not a separately hand-maintained
        # copy) so this cleanup can't silently drift out of sync with the
        # tables RLS is actually enabled on.
        for table in database._USER_OWNED_TABLES:
            try:
                conn.execute(f"DELETE FROM {table} WHERE user_id = %s", (TEST_USER,))
            except Exception:
                pass
        conn.commit()
        conn.close()

        app.dependency_overrides.clear()
        mp.undo()
