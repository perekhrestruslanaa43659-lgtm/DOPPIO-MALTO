
import psycopg2
import json
from collections import Counter

# NeonDB Connection String
DB_DSN = "postgresql://neondb_owner:npg_M0tNR8OizgPd@ep-empty-meadow-a4opi0ya-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor()
    
    cur.execute('SELECT id, nome, postazioni FROM "Staff"')
    rows = cur.fetchall()
    
    all_stations = []
    
    print(f"Analyzing {len(rows)} staff members...")
    
    for row in rows:
        staff_id, name, stations_json = row
        try:
            stations = json.loads(stations_json)
            if not isinstance(stations, list):
                print(f"Skipping {name}: postazioni not a list ({type(stations)})")
                continue
                
            all_stations.extend(stations)
            
            # Check for duplicates within user
            user_counts = Counter(stations)
            dupes = [k for k, v in user_counts.items() if v > 1]
            if dupes:
                print(f"⚠️  {name} has duplicates: {dupes}")
                
        except json.JSONDecodeError:
            print(f"Skipping {name}: invalid JSON")

    print("\n--- GLOBAL STATION COUNTS ---")
    global_counts = Counter(all_stations)
    for station, count in sorted(global_counts.items()):
        print(f"{station}: {count}")

    conn.close()

except Exception as e:
    print(f"ERROR: {e}")
