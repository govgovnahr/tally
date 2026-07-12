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
