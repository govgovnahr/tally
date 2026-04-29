import math
import psycopg2
import psycopg2.extras
import uuid
import os
import calendar
from datetime import datetime, date
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

_DEFAULT_TYPES = [
    ("Food",          "#e8a87c", "Restaurant",    0),
    ("Transport",     "#82b4e0", "Commute",        1),
    ("Housing",       "#c49ee8", "Home",           2),
    ("Entertainment", "#f0c040", "Movie",          3),
    ("Health",        "#80cbc4", "LocalHospital",  4),
    ("Other",         "#a0a0a0", "Category",       5),
]


class _Connection:
    """Thin wrapper adding sqlite3-compatible conn.execute() shorthand to psycopg2."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        c = self._conn.cursor()
        c.execute(sql, params)
        return c

    def cursor(self):
        return self._conn.cursor()

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self._conn.rollback()
        else:
            self._conn.commit()
        self._conn.close()


def get_connection():
    conn = psycopg2.connect(
        os.environ["DATABASE_URL"],
        cursor_factory=psycopg2.extras.RealDictCursor,
    )
    return _Connection(conn)


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            amount DOUBLE PRECISION NOT NULL,
            type TEXT NOT NULL,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_recurring INTEGER NOT NULL DEFAULT 0,
            user_id TEXT,
            plaid_transaction_id TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            user_id TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL,
            monthly_limit DOUBLE PRECISION NOT NULL,
            PRIMARY KEY (user_id, type)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS monthly_budgets (
            user_id TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL,
            month TEXT NOT NULL,
            monthly_limit DOUBLE PRECISION NOT NULL,
            PRIMARY KEY (user_id, type, month)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expense_types (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            icon TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            is_default INTEGER DEFAULT 0,
            user_id TEXT,
            macrocategory_id TEXT,
            UNIQUE (user_id, name)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS incomes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            amount DOUBLE PRECISION NOT NULL,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_recurring INTEGER NOT NULL DEFAULT 0,
            user_id TEXT,
            credit_type TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS import_rules (
            id TEXT PRIMARY KEY,
            pattern TEXT NOT NULL,
            expense_type TEXT NOT NULL,
            created_at TEXT NOT NULL,
            user_id TEXT,
            UNIQUE (user_id, pattern)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS macrocategories (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            color        TEXT NOT NULL DEFAULT '#a0a0a0',
            budget_limit DOUBLE PRECISION,
            user_id      TEXT,
            UNIQUE (user_id, name)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS savings_goals (
            id             TEXT PRIMARY KEY,
            goal_type      TEXT NOT NULL,
            name           TEXT NOT NULL,
            target         DOUBLE PRECISION NOT NULL,
            deadline       TEXT,
            created_at     TEXT NOT NULL,
            allocation_pct DOUBLE PRECISION,
            priority       INTEGER,
            paused         INTEGER DEFAULT 0,
            color          TEXT,
            months_target  INTEGER,
            user_id        TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS savings_contributions (
            id         TEXT PRIMARY KEY,
            goal_id    TEXT NOT NULL,
            amount     DOUBLE PRECISION NOT NULL,
            date       TEXT NOT NULL,
            note       TEXT,
            created_at TEXT NOT NULL,
            expense_id TEXT,
            user_id    TEXT
        )
    """)

    for sql in [
        "CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_expenses_user_type ON expenses(user_id, type)",
        "CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON incomes(user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_contributions_goal ON savings_contributions(goal_id)",
        "CREATE INDEX IF NOT EXISTS idx_contributions_user ON savings_contributions(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_import_rules_user ON import_rules(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_macrocategories_user ON macrocategories(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id)",
    ]:
        cursor.execute(sql)

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
            "SELECT 1 FROM expenses WHERE name = %s AND type = %s AND to_char(date::date, 'YYYY-MM') = %s AND user_id = %s",
            (name, type_, target_str, user_id),
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (str(uuid.uuid4()), name, amount, type_, target_date, datetime.now().isoformat(), 1, user_id),
            )
    conn.commit()
    conn.close()


def apply_recurring_expenses():
    conn = get_connection()
    cursor = conn.cursor()
    today = date.today()

    cursor.execute("SELECT DISTINCT user_id FROM expenses WHERE is_recurring = 1 AND user_id IS NOT NULL")
    user_ids = [row["user_id"] for row in cursor.fetchall()]

    for user_id in user_ids:
        for delta in range(3):
            target_str, ty, tm = _month_str(today.year, today.month + delta)
            target_date = f"{ty}-{tm:02d}-01"
            src_str, _, _ = _month_str(today.year, today.month + delta - 1)

            cursor.execute("""
                SELECT id, name, amount, type, is_recurring FROM expenses
                WHERE is_recurring = 1
                AND user_id = %s
                AND to_char(date::date, 'YYYY-MM') = %s
                AND (name || '|' || type) NOT IN (
                    SELECT name || '|' || type FROM expenses
                    WHERE user_id = %s AND to_char(date::date, 'YYYY-MM') = %s
                )
            """, (user_id, src_str, user_id, target_str))

            for row in cursor.fetchall():
                cursor.execute(
                    "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
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
            "SELECT 1 FROM incomes WHERE name = %s AND to_char(date::date, 'YYYY-MM') = %s AND user_id = %s",
            (name, target_str, user_id),
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (str(uuid.uuid4()), name, amount, target_date, datetime.now().isoformat(), 1, user_id),
            )
    conn.commit()
    conn.close()


def apply_recurring_incomes():
    conn = get_connection()
    cursor = conn.cursor()
    today = date.today()

    cursor.execute("SELECT DISTINCT user_id FROM incomes WHERE is_recurring = 1 AND user_id IS NOT NULL")
    user_ids = [row["user_id"] for row in cursor.fetchall()]

    for user_id in user_ids:
        for delta in range(3):
            target_str, ty, tm = _month_str(today.year, today.month + delta)
            target_date = f"{ty}-{tm:02d}-01"
            src_str, _, _ = _month_str(today.year, today.month + delta - 1)
            cursor.execute("""
                SELECT id, name, amount, is_recurring FROM incomes
                WHERE is_recurring = 1
                AND user_id = %s
                AND to_char(date::date, 'YYYY-MM') = %s
                AND name NOT IN (
                    SELECT name FROM incomes WHERE user_id = %s AND to_char(date::date, 'YYYY-MM') = %s
                )
            """, (user_id, src_str, user_id, target_str))
            for row in cursor.fetchall():
                cursor.execute(
                    "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring, user_id) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                    (str(uuid.uuid4()), row["name"], row["amount"], target_date, datetime.now().isoformat(), 1, user_id),
                )

    conn.commit()
    conn.close()


def _outlier_filtered_totals(conn, months_list: list[str], by_type: bool = False, user_id: str = None):
    if not months_list:
        return {}
    placeholders = ",".join(["%s"] * len(months_list))
    cursor = conn.cursor()

    uid_clause = "AND user_id = %s" if user_id else ""
    uid_params = [user_id] if user_id else []

    cursor.execute(
        f"SELECT id, type, amount, to_char(date::date, 'YYYY-MM') as mo "
        f"FROM expenses WHERE to_char(date::date, 'YYYY-MM') IN ({placeholders}) {uid_clause}",
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
        f"SELECT credit_type, to_char(date::date, 'YYYY-MM') as mo, SUM(amount) as total "
        f"FROM incomes WHERE credit_type IS NOT NULL "
        f"AND to_char(date::date, 'YYYY-MM') IN ({placeholders}) {uid_clause} "
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
