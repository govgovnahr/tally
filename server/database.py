import sqlite3
import uuid
import os
from datetime import datetime, date

_data_dir = os.path.join(os.path.expanduser("~"), ".budget_app")
os.makedirs(_data_dir, exist_ok=True)
DB_PATH = os.path.join(_data_dir, "budget.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            type TEXT NOT NULL,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("SELECT COUNT(*) FROM expenses")
    count = cursor.fetchone()[0]

    if count == 0:
        seed = [
            (str(uuid.uuid4()), "Groceries", 84.52, "Food", "2026-03-25", datetime.now().isoformat()),
            (str(uuid.uuid4()), "Monthly Rent", 1500.00, "Housing", "2026-03-01", datetime.now().isoformat()),
            (str(uuid.uuid4()), "Bus Pass", 45.00, "Transport", "2026-03-03", datetime.now().isoformat()),
            (str(uuid.uuid4()), "Netflix", 15.99, "Entertainment", "2026-03-10", datetime.now().isoformat()),
            (str(uuid.uuid4()), "Doctor Visit", 120.00, "Health", "2026-03-18", datetime.now().isoformat()),
            (str(uuid.uuid4()), "Restaurant", 62.30, "Food", "2026-03-22", datetime.now().isoformat()),
        ]
        cursor.executemany(
            "INSERT INTO expenses (id, name, amount, type, date, created_at) VALUES (?,?,?,?,?,?)",
            seed,
        )

    conn.commit()
    conn.close()
