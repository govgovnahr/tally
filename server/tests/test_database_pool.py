import psycopg2.extensions
import database


def test_closed_connection_returns_to_pool_for_reuse():
    conn1 = database.get_connection()
    raw1 = conn1._conn
    conn1.close()

    conn2 = database.get_connection()
    try:
        # With no concurrent borrowers, releasing then re-borrowing should hand
        # back the same underlying psycopg2 connection rather than opening a
        # fresh one — the whole point of pooling.
        assert conn2._conn is raw1
    finally:
        conn2.close()


def test_close_without_commit_leaves_pool_connection_idle():
    conn = database.get_connection()
    conn.execute("SELECT 1")  # opens an implicit transaction, never committed
    conn.close()  # no explicit commit()/rollback() from the caller

    conn2 = database.get_connection()
    try:
        # A connection handed back mid-transaction would otherwise poison the
        # next borrower — the release path must reset it to idle first.
        assert conn2._conn.get_transaction_status() == psycopg2.extensions.TRANSACTION_STATUS_IDLE
        # And it should be immediately usable, not stuck in stale state.
        row = conn2.execute("SELECT 1 AS one").fetchone()
        assert row["one"] == 1
    finally:
        conn2.close()


def test_close_is_idempotent():
    conn = database.get_connection()
    conn.close()
    conn.close()  # must not raise or double-release the same connection to the pool


def test_stale_cursor_survives_a_connection_swap_from_a_sibling_cursor():
    conn = database.get_connection()
    try:
        # Mirrors init_db()'s shape: a long-lived cursor reused across several
        # statements, on a _Connection that other code (conn.execute() shorthand
        # calls, e.g. from _bind_rls_identity) may also issue queries on directly.
        cursor = conn.cursor()
        cursor.execute("SELECT 1")

        # Simulate what _ReconnectingCursor.execute()'s retry path does when a
        # *different* cursor sharing this same _Connection hits a transient
        # OperationalError mid-execute: it closes the old raw connection and
        # swaps in a new one, out from under any cursor built earlier.
        old_raw = conn._conn
        conn._conn = database._get_pool().getconn()
        old_raw.close()

        # Before the fix, this raised psycopg2.InterfaceError: cursor already
        # closed — `cursor` still held a psycopg2 cursor bound to old_raw.
        row = cursor.execute("SELECT 2 AS two").fetchone()
        assert row["two"] == 2
    finally:
        conn.close()
