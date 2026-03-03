
import psycopg2
import json

# NeonDB
DB_DSN = "postgresql://neondb_owner:npg_M0tNR8OizgPd@ep-empty-meadow-a4opi0ya-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

# NUOVA MAPPA UTENTE (User Request)
normalization_map = {
    # Bar
    "BARSU": "BAR SU",
    "BAR SU": "BAR SU",
    "BARGIU": "BAR GIU",
    "BAR GIU": "BAR GIU",
    "BAR GIU'": "BAR GIU",
    
    # Accoglienza (Merge)
    "ACC": "ACCOGLIENZA",
    "ACCSU": "ACCOGLIENZA",
    "ACC SU": "ACCOGLIENZA",
    "ACCGIU": "ACCOGLIENZA",
    "ACC GIU": "ACCOGLIENZA",
    "ACC GIU'": "ACCOGLIENZA",
    
    # Cleanups
    "CDR": "CDR",
    "JOLLY": "JOLLY",
    "PEPARAZIONE": "PREPARAZIONE",
    "PREPAZIONE": "PREPARAZIONE"
}

try:
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor()
    
    cur.execute('SELECT id, nome, postazioni FROM "Staff"')
    rows = cur.fetchall()
    
    print(f"Renormalizing {len(rows)} staff members...")
    updated_count = 0
    
    for row in rows:
        staff_id, name, stations_json = row
        try:
            stations = json.loads(stations_json)
            if not isinstance(stations, list): continue
            
            new_stations = []
            seen = set()
            
            for s in stations:
                clean_s = s.strip().upper()
                mapped = normalization_map.get(clean_s, clean_s)
                
                # Deduplicate immediately
                if mapped not in seen:
                    new_stations.append(mapped)
                    seen.add(mapped)
            
            # Update only if changed
            if new_stations != stations:
                print(f"FIXING {name}: {stations} -> {new_stations}")
                json_data = json.dumps(new_stations)
                cur.execute('UPDATE "Staff" SET postazioni = %s WHERE id = %s', (json_data, staff_id))
                updated_count += 1
                
        except Exception:
            pass
            
    conn.commit()
    print(f"✅ DONE. Updated {updated_count} records to new standards (BAR SU, ACCOGLIENZA).")
    conn.close()

except Exception as e:
    print(f"ERROR: {e}")
