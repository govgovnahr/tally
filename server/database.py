import sqlite3
import uuid
import os
import calendar
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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS savings_goals (
            id         TEXT PRIMARY KEY,
            goal_type  TEXT NOT NULL,
            name       TEXT NOT NULL,
            target     REAL NOT NULL,
            deadline   TEXT,
            created_at TEXT NOT NULL
        )
    """)

    # Migrations: savings_goals new columns
    try:
        cursor.execute("ALTER TABLE savings_goals ADD COLUMN allocation_pct REAL")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE savings_goals ADD COLUMN priority INTEGER")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE savings_goals ADD COLUMN paused INTEGER DEFAULT 0")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE savings_goals ADD COLUMN color TEXT")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE savings_goals ADD COLUMN months_target INTEGER")
    except Exception:
        pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS savings_contributions (
            id         TEXT PRIMARY KEY,
            goal_id    TEXT NOT NULL,
            amount     REAL NOT NULL,
            date       TEXT NOT NULL,
            note       TEXT,
            created_at TEXT NOT NULL
        )
    """)

    try:
        cursor.execute("ALTER TABLE savings_contributions ADD COLUMN expense_id TEXT")
    except Exception:
        pass

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


def get_avg_monthly_expenses(conn, months: int = 3) -> float:
    """Average monthly expenses over last N complete months (excludes current month)."""
    today = date.today()
    past_months = []
    for i in range(months, 0, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        past_months.append(f"{y}-{m:02d}")
    if not past_months:
        return 0.0
    placeholders = ",".join("?" * len(past_months))
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount),0) as total "
        f"FROM expenses WHERE strftime('%Y-%m', date) IN ({placeholders}) GROUP BY month",
        past_months,
    )
    expense_by_month = {row["month"]: row["total"] for row in cursor.fetchall()}
    totals = [expense_by_month.get(m, 0.0) for m in past_months]
    return round(sum(totals) / len(totals), 2)


def compute_budget_pacing(conn, month: str, lookback_months: int = 3) -> list:
    """Compute spending pacing per expense type for a given month.

    For past months: returns spent amounts with projected_spend=None (nothing to project).
    For current month: projected = spent_so_far + historical_daily_rate * remaining_days,
      where historical_daily_rate comes from the past N complete months.
      Falls back to current-pace extrapolation when no history exists for a category.
    Returns [] for future months.
    """
    today = date.today()
    cur_month = f"{today.year}-{today.month:02d}"

    if month > cur_month:
        return []

    y, m = map(int, month.split("-"))
    days_in_month = calendar.monthrange(y, m)[1]
    is_current = month == cur_month
    days_elapsed = today.day if is_current else days_in_month

    cursor = conn.cursor()

    # Actual spending in the target month
    cursor.execute(
        "SELECT type, COALESCE(SUM(amount), 0) as spent "
        "FROM expenses WHERE strftime('%Y-%m', date) = ? GROUP BY type",
        (month,),
    )
    month_spending = {row["type"]: round(row["spent"], 2) for row in cursor.fetchall()}

    # Past months: no projection needed
    if not is_current:
        return [
            {"type": t, "spent": s, "projected_spend": None,
             "days_elapsed": days_elapsed, "days_in_month": days_in_month}
            for t, s in month_spending.items()
        ]

    # Current month: build historical daily rate per category from past N complete months
    past_months = []
    for i in range(lookback_months, 0, -1):
        py, pm = today.year, today.month - i
        while pm <= 0:
            pm += 12
            py -= 1
        past_months.append(f"{py}-{pm:02d}")

    historical_daily: dict[str, float] = {}
    if past_months:
        placeholders = ",".join("?" * len(past_months))
        cursor.execute(
            f"SELECT type, strftime('%Y-%m', date) as mo, COALESCE(SUM(amount), 0) as total "
            f"FROM expenses WHERE strftime('%Y-%m', date) IN ({placeholders}) GROUP BY type, mo",
            past_months,
        )
        by_type: dict[str, dict] = {}
        for row in cursor.fetchall():
            by_type.setdefault(row["type"], {})[row["mo"]] = row["total"]

        for t, month_totals in by_type.items():
            total_days = sum(calendar.monthrange(*map(int, mo.split("-")))[1] for mo in past_months)
            total_spent = sum(month_totals.get(mo, 0.0) for mo in past_months)
            historical_daily[t] = total_spent / total_days if total_days > 0 else 0.0

    remaining_days = days_in_month - days_elapsed
    all_types = set(month_spending.keys()) | set(historical_daily.keys())

    result = []
    for t in all_types:
        spent = month_spending.get(t, 0.0)
        daily_rate = historical_daily.get(t)

        if daily_rate is not None:
            projected = round(spent + daily_rate * remaining_days, 2)
        elif days_elapsed > 0:
            # No history: fall back to extrapolating current pace
            projected = round((spent / days_elapsed) * days_in_month, 2)
        else:
            projected = None

        result.append({
            "type": t,
            "spent": round(spent, 2),
            "projected_spend": projected,
            "days_elapsed": days_elapsed,
            "days_in_month": days_in_month,
        })

    return result


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
