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
            created_at TEXT NOT NULL,
            is_recurring INTEGER NOT NULL DEFAULT 0
        )
    """)

    # Migration: add is_recurring to existing databases
    cursor.execute("PRAGMA table_info(expenses)")
    columns = [row["name"] for row in cursor.fetchall()]
    if "is_recurring" not in columns:
        cursor.execute("ALTER TABLE expenses ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            type TEXT PRIMARY KEY,
            monthly_limit REAL NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def apply_recurring_expenses():
    conn = get_connection()
    cursor = conn.cursor()

    today = date.today()
    current_month = today.strftime("%Y-%m")

    if today.month == 1:
        last_month = f"{today.year - 1}-12"
    else:
        last_month = f"{today.year}-{today.month - 1:02d}"

    cursor.execute("""
        SELECT * FROM expenses
        WHERE is_recurring = 1
        AND strftime('%Y-%m', date) = ?
        AND (name || '|' || type) NOT IN (
            SELECT name || '|' || type FROM expenses
            WHERE strftime('%Y-%m', date) = ?
        )
    """, (last_month, current_month))

    to_create = cursor.fetchall()
    for row in to_create:
        new_date = today.strftime("%Y-%m-01")
        cursor.execute(
            "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), row["name"], row["amount"], row["type"], new_date, datetime.now().isoformat(), 1)
        )

    conn.commit()
    conn.close()
