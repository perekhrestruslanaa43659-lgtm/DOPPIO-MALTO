
import psycopg2
from psycopg2.extras import RealDictCursor
import sys

# Replicate the config from staff_tools.py
DB_CONFIG = {
    "host": "db",
    "database": "staff_db",
    "user": "admin",
    "password": "password_doppio_malto"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)

def verify_update(nome_dipendente, nuovo_valore):
    print(f"--- Verifying Update for {nome_dipendente} -> Costo: {nuovo_valore} ---")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Check current value
        cur.execute('SELECT nome, "costoOra" FROM "Staff" WHERE nome ILIKE %s', (f"%{nome_dipendente}%",))
        initial = cur.fetchone()
        if not initial:
            print(f"❌ User {nome_dipendente} not found!")
            return
        
        print(f"Current Cost: {initial['costoOra']}")
        
        # 2. Perform Update (Simulating the Tool Logic)
        query = 'UPDATE "Staff" SET "costoOra" = %s WHERE nome ILIKE %s RETURNING nome, "costoOra";'
        cur.execute(query, (nuovo_valore, f"%{nome_dipendente}%"))
        updated = cur.fetchone()
        conn.commit()
        
        print(f"Updated Cost: {updated['costoOra']}")
        
        if float(updated['costoOra']) == float(nuovo_valore):
             print("✅ SUCCESS: Database update confirmed.")
        else:
             print("❌ FAILURE: Value mismatch.")

        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    verify_update("Ahmed", 8.0)
