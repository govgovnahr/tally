import sqlite3
import uuid
import os
from datetime import datetime, date

_DEFAULT_TYPES = [
    ("Food",          "#e8a87c", "Restaurant",    0),
    ("Transport",     "#82b4e0", "Commute",        1),
    ("Housing",       "#c49ee8", "Home",           2),
    ("Entertainment", "#f0c040", "Movie",          3),
    ("Health",        "#80cbc4", "LocalHospital",  4),
    ("Other",         "#a0a0a0", "Category",       5),
]

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

    # TODO: for multi-user, budgets PK will become composite (user_id, type)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expense_types (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL,
            icon TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            is_default INTEGER DEFAULT 0,
            user_id TEXT
        )
    """)

    cursor.execute("SELECT COUNT(*) FROM expense_types")
    if cursor.fetchone()[0] == 0:
        for name, color, icon, sort_order in _DEFAULT_TYPES:
            cursor.execute(
                "INSERT INTO expense_types (id, name, color, icon, sort_order, is_default) VALUES (?,?,?,?,?,1)",
                (str(uuid.uuid4()), name, color, icon, sort_order),
            )

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS incomes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_recurring INTEGER NOT NULL DEFAULT 0,
            user_id TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS import_rules (
            id TEXT PRIMARY KEY,
            pattern TEXT NOT NULL UNIQUE,
            expense_type TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS monthly_budgets (
            type TEXT NOT NULL,
            month TEXT NOT NULL,
            monthly_limit REAL NOT NULL,
            PRIMARY KEY (type, month)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS macrocategories (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL UNIQUE,
            color        TEXT NOT NULL DEFAULT '#a0a0a0',
            budget_limit REAL
        )
    """)

    # Migration: add macrocategory_id to expense_types
    try:
        cursor.execute("ALTER TABLE expense_types ADD COLUMN macrocategory_id TEXT REFERENCES macrocategories(id)")
    except Exception:
        pass  # column already exists

    conn.commit()
    conn.close()


def _month_str(year, month):
    """Return YYYY-MM string for a given year/month, handling wrap-around."""
    total = (year - 1) * 12 + (month - 1)
    y = total // 12 + 1
    m = total % 12 + 1
    return f"{y}-{m:02d}", y, m


def seed_recurring_forward(name: str, amount: float, type_: str, source_month: str):
    """Seed one recurring expense into the 2 months after source_month, if not already present."""
    conn = get_connection()
    cursor = conn.cursor()
    src_y, src_m = map(int, source_month.split('-'))
    for delta in range(1, 3):
        target_str, ty, tm = _month_str(src_y, src_m + delta)
        target_date = f"{ty}-{tm:02d}-01"
        cursor.execute(
            "SELECT 1 FROM expenses WHERE name = ? AND type = ? AND strftime('%Y-%m', date) = ?",
            (name, type_, target_str),
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring) "
                "VALUES (?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), name, amount, type_, target_date, datetime.now().isoformat(), 1),
            )
    conn.commit()
    conn.close()


def apply_recurring_expenses():
    """Copy recurring expenses forward: last month → now, now → +1, now → +2."""
    conn = get_connection()
    cursor = conn.cursor()

    today = date.today()

    # Seed current month from last month, then +1 and +2 months from the month before each.
    # Iterating delta 0..2 means: target=(now+delta), source=(now+delta-1).
    for delta in range(3):
        target_str, ty, tm = _month_str(today.year, today.month + delta)
        target_date = f"{ty}-{tm:02d}-01"
        src_str, _, _ = _month_str(today.year, today.month + delta - 1)

        cursor.execute("""
            SELECT * FROM expenses
            WHERE is_recurring = 1
            AND strftime('%Y-%m', date) = ?
            AND (name || '|' || type) NOT IN (
                SELECT name || '|' || type FROM expenses
                WHERE strftime('%Y-%m', date) = ?
            )
        """, (src_str, target_str))

        for row in cursor.fetchall():
            cursor.execute(
                "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring) "
                "VALUES (?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), row["name"], row["amount"], row["type"],
                 target_date, datetime.now().isoformat(), 1),
            )

    conn.commit()
    conn.close()


def seed_income_recurring_forward(name: str, amount: float, source_month: str):
    """Seed one recurring income into the 2 months after source_month, if not already present."""
    conn = get_connection()
    cursor = conn.cursor()
    src_y, src_m = map(int, source_month.split('-'))
    for delta in range(1, 3):
        target_str, ty, tm = _month_str(src_y, src_m + delta)
        target_date = f"{ty}-{tm:02d}-01"
        cursor.execute(
            "SELECT 1 FROM incomes WHERE name = ? AND strftime('%Y-%m', date) = ?",
            (name, target_str),
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring) VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), name, amount, target_date, datetime.now().isoformat(), 1),
            )
    conn.commit()
    conn.close()


def apply_recurring_incomes():
    """Copy recurring incomes forward: last month → now, now → +1, now → +2."""
    conn = get_connection()
    cursor = conn.cursor()
    today = date.today()
    for delta in range(3):
        target_str, ty, tm = _month_str(today.year, today.month + delta)
        target_date = f"{ty}-{tm:02d}-01"
        src_str, _, _ = _month_str(today.year, today.month + delta - 1)
        cursor.execute("""
            SELECT * FROM incomes
            WHERE is_recurring = 1
            AND strftime('%Y-%m', date) = ?
            AND name NOT IN (
                SELECT name FROM incomes WHERE strftime('%Y-%m', date) = ?
            )
        """, (src_str, target_str))
        for row in cursor.fetchall():
            cursor.execute(
                "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring) VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), row["name"], row["amount"], target_date, datetime.now().isoformat(), 1),
            )
    conn.commit()
    conn.close()
