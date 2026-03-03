
import psycopg2

# URL from .env (parsed)
# postgresql://neondb_owner:npg_M0tNR8OizgPd@ep-empty-meadow-a4opi0ya-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
DB_DSN = "postgresql://neondb_owner:npg_M0tNR8OizgPd@ep-empty-meadow-a4opi0ya-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

print(f"Connecting to NeonDB...")
try:
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    rows = cur.fetchall()
    print("REMOTE TABLES FOUND:")
    for r in rows:
        print(f"- {r[0]}")
    
    # Check for Ahmed
    cur.execute('SELECT nome, "costoOra" FROM "Staff" WHERE nome ILIKE %s', ('%Ahmed%',))
    ahmed = cur.fetchone()
    print(f"AHMED STATUS: {ahmed}")
    
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
