
import psycopg2
import json

# NeonDB
DB_DSN = "postgresql://neondb_owner:npg_M0tNR8OizgPd@ep-empty-meadow-a4opi0ya-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Normalization Map (Bad -> Good)
normalization_map = {
    "BAR SU": "BARSU",
    "BAR GIU'": "BARGIU",
    "BAR GIU": "BARGIU",
    "ACC SU": "ACCSU",
    "ACC GIU": "ACCGIU",
    "PEPARAZIONE": "PREPARAZIONE",
    "PREPAZIONE": "PREPARAZIONE",
    "PREPARAZINE": "PREPARAZIONE"
}

try:
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor()
    
    cur.execute('SELECT id, nome, postazioni FROM "Staff"')
    rows = cur.fetchall()
    
    print(f"Checking {len(rows)} staff members for duplicates...")
    
    updated_count = 0
    
    for row in rows:
        staff_id, name, stations_json = row
        try:
            stations = json.loads(stations_json)
            if not isinstance(stations, list):
                continue
            
            original_len = len(stations)
            normalized_stations = []
            
            # 1. Normalize Names
            for s in stations:
                clean_s = s.strip().upper() # Ensure case/trim
                mapped_s = normalization_map.get(clean_s, clean_s)
                normalized_stations.append(mapped_s)
            
            # 2. De-duplicate (preserve order roughly)
            unique_stations = sorted(list(set(normalized_stations)))
            
            # 3. Check if changed
            # (Sort both to compare content)
            if sorted(stations) != sorted(unique_stations):
                print(f"FIXING {name}: {stations} -> {unique_stations}")
                
                # Update DB
                new_json = json.dumps(unique_stations)
                cur.execute('UPDATE "Staff" SET postazioni = %s WHERE id = %s', (new_json, staff_id))
                updated_count += 1
                
        except json.JSONDecodeError:
            print(f"Skipping {name}: Bad JSON")
            
    conn.commit()
    print(f"\n✅ CLEANUP COMPLETE. Updated {updated_count} staff records.")
    
    conn.close()

except Exception as e:
    print(f"❌ ERROR: {e}")
