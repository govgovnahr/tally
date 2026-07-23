import io


_CSV = b"""Date,Description,Amount
2026-05-01,Starbucks,-4.50
2026-05-02,Amazon Prime,-13.99
2026-05-03,Uber,-18.00
2026-05-04,Paycheck,3000.00
"""

_CSV_MAPPING = '{"name":"Description","amount":"Amount","date":"Date"}'


def test_preview_returns_headers(client):
    r = client.post(
        "/import/preview",
        files={"file": ("statement.csv", io.BytesIO(_CSV), "text/csv")},
    )
    assert r.status_code == 200
    data = r.json()
    assert set(data["headers"]) >= {"Date", "Description", "Amount"}
    assert len(data["preview"]) == 3


def test_suggest_separates_income(client):
    r = client.post(
        "/import/suggest",
        files={"file": ("statement.csv", io.BytesIO(_CSV), "text/csv")},
        data={"mapping": _CSV_MAPPING, "header_row": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["income_count"] == 1      # Paycheck
    assert len(data["rows"]) == 3         # 3 expense rows
    assert all(row["amount"] > 0 for row in data["rows"])
    assert all("suggested_type" in row for row in data["rows"])


def test_full_import_inserts_expenses(client):
    r = client.post(
        "/import",
        files={"file": ("statement.csv", io.BytesIO(_CSV), "text/csv")},
        data={"mapping": _CSV_MAPPING, "header_row": 0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["imported"] == 4  # 3 expense rows + 1 income row ("Paycheck"), "imported" counts both
    assert data["skipped"] == 0


def test_import_with_confirmed_types(client):
    # Override category for row 0 (Starbucks → Entertainment)
    r = client.post(
        "/import",
        files={"file": ("statement.csv", io.BytesIO(_CSV), "text/csv")},
        data={
            "mapping": _CSV_MAPPING,
            "header_row": 0,
            "confirmed_types": '{"0": "Entertainment"}',
        },
    )
    assert r.status_code == 200
    # Verify the override was applied by checking the most recent Entertainment expense
    expenses_r = client.get("/expenses?type=Entertainment")
    names = [e["name"] for e in expenses_r.json()["expenses"]]
    assert "Starbucks" in names


def test_unsupported_format_rejected(client):
    r = client.post(
        "/import/preview",
        files={"file": ("data.txt", io.BytesIO(b"some data"), "text/plain")},
    )
    assert r.status_code == 400


def test_invalid_confirmed_types_json_rejected(client):
    # Regression test: confirmed_types used to be parsed with a bare
    # json.loads() deep inside the function, after conn = get_connection()
    # had already run — malformed JSON raised past conn.close(), leaking the
    # connection on every bad request. Validated upfront now, same as `mapping`.
    r = client.post(
        "/import",
        files={"file": ("statement.csv", io.BytesIO(_CSV), "text/csv")},
        data={
            "mapping": _CSV_MAPPING,
            "header_row": 0,
            "confirmed_types": "{not valid json",
        },
    )
    assert r.status_code == 400


def test_invalid_confirmed_types_json_releases_its_connection(client):
    import psycopg2.extensions
    import database

    client.post(
        "/import",
        files={"file": ("statement.csv", io.BytesIO(_CSV), "text/csv")},
        data={
            "mapping": _CSV_MAPPING,
            "header_row": 0,
            "confirmed_types": "{not valid json",
        },
    )

    conn = database.get_connection()
    try:
        assert conn._conn.get_transaction_status() == psycopg2.extensions.TRANSACTION_STATUS_IDLE
    finally:
        conn.close()


def test_legacy_db_import_of_a_non_sqlite_file_succeeds_with_zero_counts(client):
    # Each table's import is independently try/excepted, so a file that isn't
    # actually a SQLite database (lazily discovered — sqlite3.connect() itself
    # doesn't validate content) still returns 200, with every table at 0.
    r = client.post(
        "/import/legacy-db",
        files={"file": ("old.db", io.BytesIO(b"not a real sqlite database"), "application/octet-stream")},
    )
    assert r.status_code == 200
    assert all(count == 0 for count in r.json()["imported"].values())


def test_legacy_db_import_closes_connection_even_if_commit_fails(client, monkeypatch):
    # Regression test: import_legacy_db() previously only called conn.close()
    # on the line right after conn.commit() — if commit() itself raised (a
    # real possibility: a transient DB blip, or the exact RLS lock-contention
    # scenario mid-commit), close() was skipped and the connection leaked out
    # of the pool forever. Every individual table's INSERT is independently
    # try/excepted, so commit() failing is the one realistic way an exception
    # reaches past all of them — simulate that directly.
    import database
    import routers.import_router as import_router

    real_get_connection = database.get_connection
    closed = {"value": False}

    def spy_get_connection():
        conn = real_get_connection()
        real_close = conn.close

        def failing_commit():
            raise RuntimeError("simulated commit failure")

        def spy_close():
            closed["value"] = True
            return real_close()

        conn.commit = failing_commit
        conn.close = spy_close
        return conn

    monkeypatch.setattr(import_router, "get_connection", spy_get_connection)

    r = client.post(
        "/import/legacy-db",
        files={"file": ("old.db", io.BytesIO(b"not a real sqlite database"), "application/octet-stream")},
    )
    assert r.status_code == 500
    assert closed["value"] is True
