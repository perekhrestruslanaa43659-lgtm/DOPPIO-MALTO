
import psycopg2
import sys

print("Script starting...")
DB_CONFIG = {
    "host": "db",
    "database": "staff_db",
    "user": "admin",
    "password": "password_doppio_malto"
}

try:
    print("Connecting to DB...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    print("Executing query...")
    # Use tuple for params to avoid syntax errors
    cur.execute('SELECT nome, "costoOra" FROM "Staff" WHERE nome ILIKE %s', ('%Ahmed%',))
    row = cur.fetchone()
    print(f"RISULTATO: {row}")
    conn.close()
    print("Done.")
except Exception as e:
    print(f"ERROR: {e}")
