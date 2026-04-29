"""Quick Supabase connection test. Run from server/ with DATABASE_URL set."""
import os
import sys
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

url = os.environ.get("DATABASE_URL")
if not url:
    print("ERROR: DATABASE_URL not set. Export it or add it to server/.env")
    sys.exit(1)

try:
    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)
    cur = conn.cursor()
    cur.execute("SELECT version(), current_database(), current_user;")
    row = cur.fetchone()
    print("Connection OK")
    print(f"  DB      : {row['current_database']}")
    print(f"  User    : {row['current_user']}")
    print(f"  Version : {row['version'][:60]}...")
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)
    tables = [r["table_name"] for r in cur.fetchall()]
    if tables:
        print(f"  Tables  : {', '.join(tables)}")
    else:
        print("  Tables  : (none — run init_db() on first startup)")
    conn.close()
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)
