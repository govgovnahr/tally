#!/usr/bin/env python3
"""Seed the dev account with realistic test data.

Requires the server running with DEV_MODE=true:
    cd server && DEV_MODE=true python server.py

Usage:
    python seed_dev.py              # full seed: budgets + 3 months expenses + savings
    python seed_dev.py --new-user   # blank slate: triggers BudgetSetup + onboarding flow
"""
import argparse
import datetime
import random
import sys
import requests

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://localhost:3001')
parser.add_argument('--new-user', action='store_true',
                    help='Clear all data only — no budgets seeded, triggers first-run setup flow')
args = parser.parse_args()

BASE = args.base_url.rstrip('/')
HEADERS = {'Authorization': 'Bearer dev-bypass', 'Content-Type': 'application/json'}


def api(method, path, **kwargs):
    r = getattr(requests, method)(f'{BASE}{path}', headers=HEADERS, **kwargs)
    if not r.ok:
        print(f'  ERROR {method.upper()} {path}: {r.status_code} {r.text[:200]}')
        sys.exit(1)
    return r.json()


def month_dates(year, month):
    """Return the year-month string and a sampler for dates in that month."""
    import calendar
    _, days = calendar.monthrange(year, month)
    def pick(day): return f'{year}-{month:02d}-{min(day, days):02d}'
    return f'{year}-{month:02d}', pick


def past_months(n):
    """Return the n most recent complete months as (year, month) tuples, oldest first."""
    today = datetime.date.today()
    d = today.replace(day=1)
    result = []
    for _ in range(n):
        d = (d - datetime.timedelta(days=1)).replace(day=1)
        result.append((d.year, d.month))
    result.reverse()
    return result


print(f'Connecting to {BASE} ...')
try:
    requests.get(f'{BASE}/health', timeout=4).raise_for_status()
except Exception as e:
    print(f'Server not reachable: {e}')
    sys.exit(1)

TOUR_KEYS = ['tally_tour_seen', 'tally_onboarding_seen', 'tally_onboarding_suggested', 'tally_import_suggested']

# ── Clear + seed default types ──────────────────────────────────────────────
print('Clearing existing dev data ...')
api('delete', '/auth/data')
print('Seeding default expense types ...')
api('get', '/auth/me')

if args.new_user:
    print()
    print('New-user state ready. Clear localStorage in the browser console:')
    keys = ', '.join(f"'{k}'" for k in TOUR_KEYS)
    print(f"  [{keys}].forEach(k => localStorage.removeItem(k))")
    print()
    print('Then hard-refresh (Cmd+Shift+R) — the onboarding tour will auto-start.')
    sys.exit(0)

# ── Budget limits ────────────────────────────────────────────────────────────
print('Setting budget limits ...')
api('post', '/budgets', json=[
    {'type': 'Food',          'monthly_limit': 600},
    {'type': 'Transport',     'monthly_limit': 200},
    {'type': 'Housing',       'monthly_limit': 1800},
    {'type': 'Entertainment', 'monthly_limit': 150},
    {'type': 'Health',        'monthly_limit': 100},
    {'type': 'Other',         'monthly_limit': 100},
])

# ── 3 months of expenses + income ────────────────────────────────────────────
EXPENSE_TEMPLATES = [
    ('Rent',             'Housing',       1800, 1,  1),
    ('Groceries',        'Food',           110, 4,  1),
    ('Groceries',        'Food',            95, 11, 0),
    ('Groceries',        'Food',           120, 18, 0),
    ('Groceries',        'Food',            85, 25, 0),
    ('Netflix',          'Entertainment',   18, 3,  1),
    ('Spotify',          'Entertainment',   11, 3,  1),
    ('Gas',              'Transport',       48, 7,  0),
    ('Gas',              'Transport',       55, 21, 0),
    ('Bus pass',         'Transport',       90, 1,  1),
    ('Doctor copay',     'Health',          30, 14, 0),
    ('Gym membership',   'Health',          45, 1,  1),
    ('Restaurant',       'Food',            72, 13, 0),
    ('Coffee shop',      'Food',            35, 9,  0),
    ('Amazon misc',      'Other',           42, 17, 0),
    ('Phone bill',       'Other',           55, 5,  1),
]

months = past_months(3)
total_expenses = 0
total_incomes = 0

for year, month in months:
    label, pick = month_dates(year, month)
    print(f'  Seeding {label} ...')

    for name, etype, base_amount, day, recurring in EXPENSE_TEMPLATES:
        amount = round(base_amount * random.uniform(0.9, 1.1), 2) if not recurring else base_amount
        api('post', '/expenses', json={
            'name': name, 'amount': amount, 'type': etype,
            'date': pick(day), 'is_recurring': recurring,
        })
        total_expenses += 1

    api('post', '/incomes', json={
        'name': 'Salary', 'amount': 4500.00,
        'date': pick(15), 'is_recurring': 1,
    })
    total_incomes += 1

print(f'  Created {total_expenses} expenses, {total_incomes} income entries')

# ── Savings goal + contributions ─────────────────────────────────────────────
print('Creating savings goal ...')
goal = api('post', '/savings-goals', json={
    'goal_type': 'one_time',
    'name': 'Emergency Fund',
    'target': 10000.00,
    'color': '#80cbc4',
})
goal_id = goal['id']

for year, month in months[:2]:
    _, pick = month_dates(year, month)
    api('post', f'/savings-goals/{goal_id}/contributions', json={
        'amount': 500.00,
        'date': pick(28),
        'note': 'Monthly transfer',
    })
print(f'  Goal "{goal["name"]}" created with 2 contributions')

print()
print('Done. Dev account seeded:')
print(f'  3 months of expenses across 6 categories')
print(f'  3 months of $4,500 salary income')
print(f'  Budget limits set for all default categories')
print(f'  Savings goal: Emergency Fund ($1,000 contributed toward $10,000)')
