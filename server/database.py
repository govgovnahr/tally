import math
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

_data_dir = os.environ.get("BUDGET_DATA_DIR") or os.path.join(os.path.expanduser("~"), ".budget_app")
os.makedirs(_data_dir, exist_ok=True)
DB_PATH = os.path.join(_data_dir, "budget.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


def _cols(cursor, table: str) -> set:
    cursor.execute(f"PRAGMA table_info({table})")
    return {row["name"] for row in cursor.fetchall()}


def _table_sql(cursor, table: str) -> str:
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,))
    row = cursor.fetchone()
    return row[0] if row else ""


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            plaid_access_token TEXT,
            created_at TEXT NOT NULL
        )
    """)

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
    exp_cols = _cols(cursor, "expenses")
    if "is_recurring" not in exp_cols:
        cursor.execute("ALTER TABLE expenses ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0")
    if "user_id" not in exp_cols:
        cursor.execute("ALTER TABLE expenses ADD COLUMN user_id TEXT")
    if "plaid_transaction_id" not in exp_cols:
        cursor.execute("ALTER TABLE expenses ADD COLUMN plaid_transaction_id TEXT")

    # budgets: migrate from single-column PK (type) to composite PK (user_id, type)
    budget_cols = _cols(cursor, "budgets")
    if not budget_cols:
        cursor.execute("""
            CREATE TABLE budgets (
                user_id TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL,
                monthly_limit REAL NOT NULL,
                PRIMARY KEY (user_id, type)
            )
        """)
    elif "user_id" not in budget_cols:
        cursor.execute("""
            CREATE TABLE budgets_new (
                user_id TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL,
                monthly_limit REAL NOT NULL,
                PRIMARY KEY (user_id, type)
            )
        """)
        cursor.execute("INSERT INTO budgets_new (user_id, type, monthly_limit) SELECT '', type, monthly_limit FROM budgets")
        cursor.execute("DROP TABLE budgets")
        cursor.execute("ALTER TABLE budgets_new RENAME TO budgets")

    # monthly_budgets: migrate from (type, month) to (user_id, type, month)
    mb_cols = _cols(cursor, "monthly_budgets")
    if not mb_cols:
        cursor.execute("""
            CREATE TABLE monthly_budgets (
                user_id TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL,
                month TEXT NOT NULL,
                monthly_limit REAL NOT NULL,
                PRIMARY KEY (user_id, type, month)
            )
        """)
    elif "user_id" not in mb_cols:
        cursor.execute("""
            CREATE TABLE monthly_budgets_new (
                user_id TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL,
                month TEXT NOT NULL,
                monthly_limit REAL NOT NULL,
                PRIMARY KEY (user_id, type, month)
            )
        """)
        cursor.execute("INSERT INTO monthly_budgets_new (user_id, type, month, monthly_limit) SELECT '', type, month, monthly_limit FROM monthly_budgets")
        cursor.execute("DROP TABLE monthly_budgets")
        cursor.execute("ALTER TABLE monthly_budgets_new RENAME TO monthly_budgets")

    # expense_types: migrate UNIQUE(name) → UNIQUE(user_id, name)
    et_cols = _cols(cursor, "expense_types")
    if not et_cols:
        cursor.execute("""
            CREATE TABLE expense_types (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                icon TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                is_default INTEGER DEFAULT 0,
                user_id TEXT,
                macrocategory_id TEXT,
                UNIQUE(user_id, name)
            )
        """)
    elif "UNIQUE(user_id" not in _table_sql(cursor, "expense_types"):
        has_macro = "macrocategory_id" in et_cols
        has_uid = "user_id" in et_cols
        cursor.execute("""
            CREATE TABLE expense_types_new (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                icon TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                is_default INTEGER DEFAULT 0,
                user_id TEXT,
                macrocategory_id TEXT,
                UNIQUE(user_id, name)
            )
        """)
        uid_sel = "user_id" if has_uid else "NULL"
        mac_sel = "macrocategory_id" if has_macro else "NULL"
        cursor.execute(f"INSERT INTO expense_types_new SELECT id, name, color, icon, sort_order, is_default, {uid_sel}, {mac_sel} FROM expense_types")
        cursor.execute("DROP TABLE expense_types")
        cursor.execute("ALTER TABLE expense_types_new RENAME TO expense_types")

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
    for col, defn in [("credit_type", "TEXT"), ("user_id", "TEXT")]:
        try:
            cursor.execute(f"ALTER TABLE incomes ADD COLUMN {col} {defn}")
        except Exception:
            pass

    # import_rules: migrate UNIQUE(pattern) → UNIQUE(user_id, pattern)
    ir_cols = _cols(cursor, "import_rules")
    if not ir_cols:
        cursor.execute("""
            CREATE TABLE import_rules (
                id TEXT PRIMARY KEY,
                pattern TEXT NOT NULL,
                expense_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                user_id TEXT,
                UNIQUE(user_id, pattern)
            )
        """)
    elif "user_id" not in ir_cols:
        cursor.execute("""
            CREATE TABLE import_rules_new (
                id TEXT PRIMARY KEY,
                pattern TEXT NOT NULL,
                expense_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                user_id TEXT,
                UNIQUE(user_id, pattern)
            )
        """)
        cursor.execute("INSERT INTO import_rules_new (id, pattern, expense_type, created_at, user_id) SELECT id, pattern, expense_type, created_at, NULL FROM import_rules")
        cursor.execute("DROP TABLE import_rules")
        cursor.execute("ALTER TABLE import_rules_new RENAME TO import_rules")

    # macrocategories: migrate UNIQUE(name) → UNIQUE(user_id, name)
    macro_cols = _cols(cursor, "macrocategories")
    if not macro_cols:
        cursor.execute("""
            CREATE TABLE macrocategories (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                color        TEXT NOT NULL DEFAULT '#a0a0a0',
                budget_limit REAL,
                user_id      TEXT,
                UNIQUE(user_id, name)
            )
        """)
    elif "user_id" not in macro_cols:
        cursor.execute("""
            CREATE TABLE macrocategories_new (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                color        TEXT NOT NULL DEFAULT '#a0a0a0',
                budget_limit REAL,
                user_id      TEXT,
                UNIQUE(user_id, name)
            )
        """)
        cursor.execute("INSERT INTO macrocategories_new (id, name, color, budget_limit, user_id) SELECT id, name, color, budget_limit, NULL FROM macrocategories")
        cursor.execute("DROP TABLE macrocategories")
        cursor.execute("ALTER TABLE macrocategories_new RENAME TO macrocategories")

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
    for col, defn in [
        ("allocation_pct", "REAL"),
        ("priority", "INTEGER"),
        ("paused", "INTEGER DEFAULT 0"),
        ("color", "TEXT"),
        ("months_target", "INTEGER"),
        ("user_id", "TEXT"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE savings_goals ADD COLUMN {col} {defn}")
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
    for col, defn in [("expense_id", "TEXT"), ("user_id", "TEXT")]:
        try:
            cursor.execute(f"ALTER TABLE savings_contributions ADD COLUMN {col} {defn}")
        except Exception:
            pass

    conn.commit()
    conn.close()


def _month_str(year, month):
    total = (year - 1) * 12 + (month - 1)
    y = total // 12 + 1
    m = total % 12 + 1
    return f"{y}-{m:02d}", y, m


def seed_recurring_forward(name: str, amount: float, type_: str, source_month: str, user_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    src_y, src_m = map(int, source_month.split('-'))
    for delta in range(1, 3):
        target_str, ty, tm = _month_str(src_y, src_m + delta)
        target_date = f"{ty}-{tm:02d}-01"
        cursor.execute(
            "SELECT 1 FROM expenses WHERE name = ? AND type = ? AND strftime('%Y-%m', date) = ? AND user_id = ?",
            (name, type_, target_str, user_id),
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id) VALUES (?,?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), name, amount, type_, target_date, datetime.now().isoformat(), 1, user_id),
            )
    conn.commit()
    conn.close()


def apply_recurring_expenses():
    conn = get_connection()
    cursor = conn.cursor()
    today = date.today()

    cursor.execute("SELECT DISTINCT user_id FROM expenses WHERE is_recurring = 1 AND user_id IS NOT NULL")
    user_ids = [row[0] for row in cursor.fetchall()]

    for user_id in user_ids:
        for delta in range(3):
            target_str, ty, tm = _month_str(today.year, today.month + delta)
            target_date = f"{ty}-{tm:02d}-01"
            src_str, _, _ = _month_str(today.year, today.month + delta - 1)

            cursor.execute("""
                SELECT id, name, amount, type, is_recurring FROM expenses
                WHERE is_recurring = 1
                AND user_id = ?
                AND strftime('%Y-%m', date) = ?
                AND (name || '|' || type) NOT IN (
                    SELECT name || '|' || type FROM expenses
                    WHERE user_id = ? AND strftime('%Y-%m', date) = ?
                )
            """, (user_id, src_str, user_id, target_str))

            for row in cursor.fetchall():
                cursor.execute(
                    "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id) VALUES (?,?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), row["name"], row["amount"], row["type"],
                     target_date, datetime.now().isoformat(), 1, user_id),
                )

    conn.commit()
    conn.close()


def seed_income_recurring_forward(name: str, amount: float, source_month: str, user_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    src_y, src_m = map(int, source_month.split('-'))
    for delta in range(1, 3):
        target_str, ty, tm = _month_str(src_y, src_m + delta)
        target_date = f"{ty}-{tm:02d}-01"
        cursor.execute(
            "SELECT 1 FROM incomes WHERE name = ? AND strftime('%Y-%m', date) = ? AND user_id = ?",
            (name, target_str, user_id),
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring, user_id) VALUES (?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), name, amount, target_date, datetime.now().isoformat(), 1, user_id),
            )
    conn.commit()
    conn.close()


def apply_recurring_incomes():
    conn = get_connection()
    cursor = conn.cursor()
    today = date.today()

    cursor.execute("SELECT DISTINCT user_id FROM incomes WHERE is_recurring = 1 AND user_id IS NOT NULL")
    user_ids = [row[0] for row in cursor.fetchall()]

    for user_id in user_ids:
        for delta in range(3):
            target_str, ty, tm = _month_str(today.year, today.month + delta)
            target_date = f"{ty}-{tm:02d}-01"
            src_str, _, _ = _month_str(today.year, today.month + delta - 1)
            cursor.execute("""
                SELECT id, name, amount, is_recurring FROM incomes
                WHERE is_recurring = 1
                AND user_id = ?
                AND strftime('%Y-%m', date) = ?
                AND name NOT IN (
                    SELECT name FROM incomes WHERE user_id = ? AND strftime('%Y-%m', date) = ?
                )
            """, (user_id, src_str, user_id, target_str))
            for row in cursor.fetchall():
                cursor.execute(
                    "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring, user_id) VALUES (?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), row["name"], row["amount"], target_date, datetime.now().isoformat(), 1, user_id),
                )

    conn.commit()
    conn.close()


def _outlier_filtered_totals(conn, months_list: list[str], by_type: bool = False, user_id: str = None):
    if not months_list:
        return {}
    placeholders = ",".join("?" * len(months_list))
    cursor = conn.cursor()

    uid_clause = "AND user_id = ?" if user_id else ""
    uid_params = [user_id] if user_id else []

    cursor.execute(
        f"SELECT id, type, amount, strftime('%Y-%m', date) as mo "
        f"FROM expenses WHERE strftime('%Y-%m', date) IN ({placeholders}) {uid_clause}",
        months_list + uid_params,
    )
    rows = cursor.fetchall()

    cat_amounts: dict[str, list[float]] = {}
    for r in rows:
        cat_amounts.setdefault(r["type"], []).append(r["amount"])

    cat_stats: dict[str, tuple[float, float]] = {}
    for t, amounts in cat_amounts.items():
        if len(amounts) < 3:
            continue
        mean = sum(amounts) / len(amounts)
        std = math.sqrt(sum((a - mean) ** 2 for a in amounts) / len(amounts))
        cat_stats[t] = (mean, std)

    credit_rows = cursor.execute(
        f"SELECT credit_type, strftime('%Y-%m', date) as mo, SUM(amount) as total "
        f"FROM incomes WHERE credit_type IS NOT NULL "
        f"AND strftime('%Y-%m', date) IN ({placeholders}) {uid_clause} "
        f"GROUP BY credit_type, mo",
        months_list + uid_params,
    ).fetchall()

    if by_type:
        result: dict = {}
        for r in rows:
            stats = cat_stats.get(r["type"])
            if stats and stats[1] > 0 and abs(r["amount"] - stats[0]) / stats[1] >= 1.5:
                continue
            result.setdefault(r["type"], {}).setdefault(r["mo"], 0.0)
            result[r["type"]][r["mo"]] += r["amount"]
        for cr in credit_rows:
            t, mo = cr["credit_type"], cr["mo"]
            if t in result and mo in result[t]:
                result[t][mo] = max(0.0, result[t][mo] - cr["total"])
        return result
    else:
        totals: dict[str, float] = {}
        for r in rows:
            stats = cat_stats.get(r["type"])
            if stats and stats[1] > 0 and abs(r["amount"] - stats[0]) / stats[1] >= 1.5:
                continue
            totals[r["mo"]] = totals.get(r["mo"], 0.0) + r["amount"]
        for cr in credit_rows:
            mo = cr["mo"]
            totals[mo] = max(0.0, totals.get(mo, 0.0) - cr["total"])
        return totals


def get_avg_monthly_expenses(conn, months: int = 3, user_id: str = None) -> float:
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
    expense_by_month = _outlier_filtered_totals(conn, past_months, by_type=False, user_id=user_id)
    totals = [expense_by_month.get(m, 0.0) for m in past_months]
    return round(sum(totals) / len(totals), 2)


def compute_budget_pacing(conn, month: str, lookback_months: int = 3, user_id: str = None) -> list:
    today = date.today()
    cur_month = f"{today.year}-{today.month:02d}"

    if month > cur_month:
        return []

    y, m = map(int, month.split("-"))
    days_in_month = calendar.monthrange(y, m)[1]
    is_current = month == cur_month
    days_elapsed = today.day if is_current else days_in_month

    raw_month = _outlier_filtered_totals(conn, [month], by_type=True, user_id=user_id)
    month_spending = {t: round(sum(mo_totals.values()), 2) for t, mo_totals in raw_month.items()}

    if not is_current:
        return [
            {"type": t, "spent": s, "projected_spend": None,
             "days_elapsed": days_elapsed, "days_in_month": days_in_month}
            for t, s in month_spending.items()
        ]

    past_months = []
    for i in range(lookback_months, 0, -1):
        py, pm = today.year, today.month - i
        while pm <= 0:
            pm += 12
            py -= 1
        past_months.append(f"{py}-{pm:02d}")

    historical_daily: dict[str, float] = {}
    if past_months:
        by_type = _outlier_filtered_totals(conn, past_months, by_type=True, user_id=user_id)
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
            historical_monthly_avg = daily_rate * days_in_month
            raw_projected = spent + daily_rate * remaining_days
            projected = round(min(raw_projected, max(spent, historical_monthly_avg)), 2)
        elif days_elapsed > 0:
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
