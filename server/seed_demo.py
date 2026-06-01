"""
Demo data seed script.

Usage:
    DEMO_USER_ID=<supabase-user-uuid> python seed_demo.py

Creates ~5 months of realistic expenses/income, savings goals with contributions,
budgets, and import rules. Includes deliberate outliers and an at-risk savings goal
for portfolio demo purposes.

Run again with --clear to wipe existing demo data before re-seeding.
"""

import os
import sys
import uuid
from datetime import datetime, date

from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.dirname(__file__))

from database import get_connection  # noqa: E402

DEMO_USER_ID = os.environ.get("DEMO_USER_ID")
if not DEMO_USER_ID:
    print("ERROR: Set DEMO_USER_ID env var to the Supabase user UUID for the demo account.")
    sys.exit(1)

CLEAR = "--clear" in sys.argv


def uid():
    return str(uuid.uuid4())


def ts(d: str) -> str:
    return f"{d}T09:00:00"


# ─── Expense types ────────────────────────────────────────────────────────────

TYPES = [
    ("Food",          "#e8a87c", "Restaurant",    0, 1),
    ("Transport",     "#82b4e0", "Commute",        1, 1),
    ("Housing",       "#c49ee8", "Home",           2, 1),
    ("Entertainment", "#f0c040", "Movie",          3, 1),
    ("Health",        "#80cbc4", "LocalHospital",  4, 1),
    ("Other",         "#a0a0a0", "Category",       5, 1),
    ("Savings",       "#8fb996", "Savings",        6, 1),
]

# ─── Budgets ──────────────────────────────────────────────────────────────────

BUDGETS = [
    ("Food",          450),
    ("Transport",     150),
    ("Housing",      1800),
    ("Entertainment", 100),
    ("Health",         75),
    ("Other",         200),
]

# ─── Expenses ─────────────────────────────────────────────────────────────────
# (name, amount, type, date)
# Outliers marked with 🔺 in comments

EXPENSES = [
    # ── January 2026 ──────────────────────────────────────────────────────────
    ("Monthly Rent",         1800.00, "Housing",       "2026-01-01"),
    ("Whole Foods",            72.14, "Food",          "2026-01-03"),
    ("Chipotle",               13.85, "Food",          "2026-01-07"),
    ("Uber",                   18.40, "Transport",     "2026-01-08"),
    ("Netflix",                15.49, "Entertainment", "2026-01-10"),
    ("Spotify",                 9.99, "Entertainment", "2026-01-10"),
    ("Sweetgreen",             15.20, "Food",          "2026-01-12"),
    ("Urgent Care",           185.00, "Health",        "2026-01-14"),  # 🔺 outlier
    ("Blue Bottle Coffee",      5.75, "Food",          "2026-01-15"),
    ("Metro Card",             33.00, "Transport",     "2026-01-15"),
    ("Amazon",                 42.99, "Other",         "2026-01-17"),
    ("Equinox Gym",            38.00, "Health",        "2026-01-18"),
    ("Chipotle",               14.25, "Food",          "2026-01-21"),
    ("Shell Gas",              51.20, "Transport",     "2026-01-22"),
    ("Target",                 58.43, "Other",         "2026-01-24"),
    ("Whole Foods",            68.90, "Food",          "2026-01-28"),
    ("DoorDash",               34.50, "Food",          "2026-01-29"),
    ("Dry Cleaning",           28.00, "Other",         "2026-01-30"),
    ("CVS Pharmacy",           21.60, "Health",        "2026-01-31"),

    # ── February 2026 ─────────────────────────────────────────────────────────
    ("Monthly Rent",         1800.00, "Housing",       "2026-02-01"),
    ("Whole Foods",            80.55, "Food",          "2026-02-02"),
    ("Netflix",                15.49, "Entertainment", "2026-02-10"),
    ("Spotify",                 9.99, "Entertainment", "2026-02-10"),
    ("Uber",                  280.00, "Transport",     "2026-02-11"),  # 🔺 outlier — airport run
    ("Chipotle",               13.50, "Food",          "2026-02-12"),
    ("Metro Card",             33.00, "Transport",     "2026-02-15"),
    ("Equinox Gym",            38.00, "Health",        "2026-02-18"),
    ("Blue Bottle Coffee",      6.25, "Food",          "2026-02-19"),
    ("AMC Theaters",           32.00, "Entertainment", "2026-02-21"),
    ("Sweetgreen",             15.90, "Food",          "2026-02-22"),
    ("Amazon",                 38.49, "Other",         "2026-02-23"),
    ("Target",                 61.20, "Other",         "2026-02-25"),
    ("Whole Foods",            74.80, "Food",          "2026-02-27"),
    ("CVS Pharmacy",           17.40, "Health",        "2026-02-28"),

    # ── March 2026 ────────────────────────────────────────────────────────────
    ("Monthly Rent",         1800.00, "Housing",       "2026-03-01"),
    ("Whole Foods",            78.30, "Food",          "2026-03-03"),
    ("Netflix",                15.49, "Entertainment", "2026-03-10"),
    ("Spotify",                 9.99, "Entertainment", "2026-03-10"),
    ("Chipotle",               14.75, "Food",          "2026-03-11"),
    ("Uber",                   22.60, "Transport",     "2026-03-12"),
    ("Metro Card",             33.00, "Transport",     "2026-03-15"),
    ("Blue Bottle Coffee",      5.50, "Food",          "2026-03-17"),
    ("Nobu Restaurant",       340.00, "Food",          "2026-03-19"),  # 🔺 outlier — anniversary dinner
    ("Equinox Gym",            38.00, "Health",        "2026-03-19"),
    ("Shell Gas",              48.80, "Transport",     "2026-03-20"),
    ("Sweetgreen",             14.40, "Food",          "2026-03-22"),
    ("Amazon",                 55.99, "Other",         "2026-03-24"),
    ("Steam Games",            29.99, "Entertainment", "2026-03-26"),
    ("Target",                 72.15, "Other",         "2026-03-27"),
    ("Whole Foods",            66.70, "Food",          "2026-03-29"),
    ("DoorDash",               28.90, "Food",          "2026-03-30"),
    ("CVS Pharmacy",           14.20, "Health",        "2026-03-31"),

    # ── April 2026 ────────────────────────────────────────────────────────────
    ("Monthly Rent",         1800.00, "Housing",       "2026-04-01"),
    ("Whole Foods",            69.45, "Food",          "2026-04-02"),
    ("Netflix",                15.49, "Entertainment", "2026-04-10"),
    ("Spotify",                 9.99, "Entertainment", "2026-04-10"),
    ("Uber",                   19.80, "Transport",     "2026-04-11"),
    ("Chipotle",               13.90, "Food",          "2026-04-13"),
    ("Metro Card",             33.00, "Transport",     "2026-04-15"),
    ("Concert Tickets",       220.00, "Entertainment", "2026-04-16"),  # 🔺 outlier
    ("Equinox Gym",            38.00, "Health",        "2026-04-18"),
    ("Blue Bottle Coffee",      6.00, "Food",          "2026-04-19"),
    ("Sweetgreen",             16.10, "Food",          "2026-04-21"),
    ("Shell Gas",              53.40, "Transport",     "2026-04-22"),
    ("Amazon",                 29.99, "Other",         "2026-04-23"),
    ("Target",                 44.80, "Other",         "2026-04-25"),
    ("Whole Foods",            75.20, "Food",          "2026-04-27"),
    ("AMC Theaters",           28.50, "Entertainment", "2026-04-28"),
    ("Dry Cleaning",           31.00, "Other",         "2026-04-29"),
    ("CVS Pharmacy",           18.50, "Health",        "2026-04-30"),

    # ── May 2026 ──────────────────────────────────────────────────────────────
    ("Monthly Rent",         1800.00, "Housing",       "2026-05-01"),
    ("Whole Foods",            84.60, "Food",          "2026-05-02"),
    ("Netflix",                15.49, "Entertainment", "2026-05-10"),
    ("Spotify",                 9.99, "Entertainment", "2026-05-10"),
    ("Uber",                   24.50, "Transport",     "2026-05-11"),
    ("Chipotle",               15.40, "Food",          "2026-05-13"),
    ("Blue Bottle Coffee",      5.75, "Food",          "2026-05-14"),
    ("Metro Card",             33.00, "Transport",     "2026-05-15"),
    ("Equinox Gym",            38.00, "Health",        "2026-05-17"),
    ("DoorDash",               41.20, "Food",          "2026-05-18"),
    ("Sweetgreen",             16.80, "Food",          "2026-05-19"),
    ("Amazon",                 67.49, "Other",         "2026-05-20"),
    ("Chipotle",               14.60, "Food",          "2026-05-21"),
    ("Shell Gas",              55.60, "Transport",     "2026-05-22"),
    ("Target",                 79.30, "Other",         "2026-05-23"),
    ("AMC Theaters",           33.00, "Entertainment", "2026-05-24"),
    ("Whole Foods",            91.40, "Food",          "2026-05-25"),  # food running over budget
    ("CVS Pharmacy",           23.10, "Health",        "2026-05-27"),
    ("Dry Cleaning",           26.50, "Other",         "2026-05-28"),
    ("DoorDash",               38.70, "Food",          "2026-05-29"),
    ("Uber",                   21.30, "Transport",     "2026-05-30"),
]

# ─── Income ───────────────────────────────────────────────────────────────────
# (name, amount, date)

INCOMES = [
    ("Salary",         4800.00, "2026-01-01"),
    ("Freelance Work",  450.00, "2026-01-18"),
    ("Salary",         4800.00, "2026-02-01"),
    ("Salary",         4800.00, "2026-03-01"),
    ("Freelance Work",  600.00, "2026-03-22"),
    ("Salary",         4800.00, "2026-04-01"),
    ("Salary",         4800.00, "2026-05-01"),
    ("Tax Refund",      820.00, "2026-05-09"),
]

# ─── Savings goals + contributions ────────────────────────────────────────────
# Each goal: (goal_type, name, target, deadline, color, months_target)
# Contributions: list of (amount, date) per goal

GOALS = [
    {
        "goal_type": "one_time",
        "name": "Europe Trip",
        "target": 3000.00,
        "deadline": "2026-09-01",
        "color": "#82b4e0",
        "months_target": None,
        "contributions": [
            (100.00, "2026-01-31"),
            (100.00, "2026-02-28"),
            (100.00, "2026-03-31"),
            (100.00, "2026-04-30"),
            (100.00, "2026-05-31"),
        ],
    },
    {
        "goal_type": "emergency_fund",
        "name": "Emergency Fund",
        "target": 0,      # will be computed from months_target × avg_expenses
        "deadline": None,
        "color": "#80cbc4",
        "months_target": 3,
        "contributions": [
            (500.00, "2026-01-31"),
            (500.00, "2026-02-28"),
            (500.00, "2026-03-31"),
            (500.00, "2026-04-30"),
            (500.00, "2026-05-31"),
        ],
    },
    {
        "goal_type": "monthly",
        "name": "Monthly Savings",
        "target": 500.00,
        "deadline": None,
        "color": "#8fb996",
        "months_target": None,
        "contributions": [
            (180.00, "2026-05-20"),
        ],
    },
]

# ─── Import rules ─────────────────────────────────────────────────────────────

IMPORT_RULES = [
    ("AMZN",        "Other"),
    ("WHOLEFDS",    "Food"),
    ("UBER*",       "Transport"),
    ("NETFLIX",     "Entertainment"),
    ("SPOTIFY",     "Entertainment"),
    ("EQUINOX",     "Health"),
]


# ─── Seed ─────────────────────────────────────────────────────────────────────

def clear_demo_data(conn):
    tables = [
        "savings_contributions", "savings_goals", "expenses", "incomes",
        "budgets", "monthly_budgets", "expense_types", "import_rules",
        "macrocategories", "user_settings",
    ]
    for table in tables:
        try:
            conn.execute(f"DELETE FROM {table} WHERE user_id = %s", (DEMO_USER_ID,))
        except Exception as e:
            print(f"  Warning clearing {table}: {e}")
    conn.commit()
    print("Cleared existing demo data.")


def seed():
    conn = get_connection()

    if CLEAR:
        clear_demo_data(conn)

    now = datetime.now().isoformat()

    # Expense types
    print("Seeding expense types…")
    for name, color, icon, sort_order, is_default in TYPES:
        conn.execute(
            "INSERT INTO expense_types (id, name, color, icon, sort_order, is_default, user_id) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (user_id, name) DO NOTHING",
            (uid(), name, color, icon, sort_order, is_default, DEMO_USER_ID),
        )

    # Budgets
    print("Seeding budgets…")
    for expense_type, monthly_limit in BUDGETS:
        conn.execute(
            "INSERT INTO budgets (user_id, type, monthly_limit) VALUES (%s,%s,%s) "
            "ON CONFLICT (user_id, type) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit",
            (DEMO_USER_ID, expense_type, monthly_limit),
        )

    # Expenses
    print(f"Seeding {len(EXPENSES)} expenses…")
    for name, amount, expense_type, exp_date in EXPENSES:
        conn.execute(
            "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            (uid(), name, amount, expense_type, exp_date, ts(exp_date), 0, DEMO_USER_ID),
        )

    # Incomes
    print(f"Seeding {len(INCOMES)} income records…")
    for name, amount, inc_date in INCOMES:
        conn.execute(
            "INSERT INTO incomes (id, name, amount, date, created_at, is_recurring, user_id) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (uid(), name, amount, inc_date, ts(inc_date), 0, DEMO_USER_ID),
        )

    # Savings goals + contributions
    print("Seeding savings goals…")
    for goal in GOALS:
        goal_id = uid()
        target = goal["target"]
        # For emergency fund, set an explicit target since server computes it dynamically
        if goal["goal_type"] == "emergency_fund" and target == 0:
            target = 7500.00  # ~3 months × avg expenses; server will recompute

        conn.execute(
            "INSERT INTO savings_goals "
            "(id, goal_type, name, target, deadline, created_at, color, allocation_pct, priority, months_target, user_id) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (
                goal_id, goal["goal_type"], goal["name"], target,
                goal["deadline"], now, goal["color"],
                None, None, goal["months_target"], DEMO_USER_ID,
            ),
        )

        for amount, contrib_date in goal["contributions"]:
            # Insert a linked Savings expense
            expense_id = uid()
            conn.execute(
                "INSERT INTO expenses (id, name, amount, type, date, created_at, is_recurring, user_id) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (expense_id, goal["name"], amount, "Savings", contrib_date, ts(contrib_date), 0, DEMO_USER_ID),
            )
            conn.execute(
                "INSERT INTO savings_contributions (id, goal_id, amount, date, note, created_at, expense_id, user_id) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (uid(), goal_id, amount, contrib_date, None, ts(contrib_date), expense_id, DEMO_USER_ID),
            )

    # Import rules
    print("Seeding import rules…")
    for pattern, expense_type in IMPORT_RULES:
        conn.execute(
            "INSERT INTO import_rules (id, pattern, expense_type, created_at, user_id) "
            "VALUES (%s,%s,%s,%s,%s) ON CONFLICT (user_id, pattern) DO NOTHING",
            (uid(), pattern, expense_type, now, DEMO_USER_ID),
        )

    conn.commit()
    conn.close()

    print("\nDone! Summary:")
    print(f"  {len(EXPENSES)} expenses across 5 months")
    print(f"  {len(INCOMES)} income records")
    print(f"  {len(GOALS)} savings goals ({sum(len(g['contributions']) for g in GOALS)} contributions)")
    print(f"  {len(BUDGETS)} budget limits")
    print(f"  {len(IMPORT_RULES)} import rules")
    print("\nOutliers seeded:")
    print("  Jan — Urgent Care $185 (Health, ~3× avg)")
    print("  Feb — Uber $280 (Transport, ~12× avg)")
    print("  Mar — Nobu Restaurant $340 (Food, ~5× avg)")
    print("  Apr — Concert Tickets $220 (Entertainment, ~3× avg)")
    print("\nAt-risk goal: Europe Trip ($500 saved of $3,000, deadline Sep 2026)")


if __name__ == "__main__":
    seed()
