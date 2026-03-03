
import psycopg2

print("Listing tables...")
DB_CONFIG = {
    "host": "db",
    "database": "staff_db",
    "user": "admin",
    "password": "password_doppio_malto"
}

try:
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    rows = cur.fetchall()
    print("TABLES FOUND:")
    for r in rows:
        print(f"- {r[0]}")
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
