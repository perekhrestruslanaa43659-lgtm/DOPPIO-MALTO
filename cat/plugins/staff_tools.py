
from cat.mad_hatter.decorators import tool, hook
import psycopg2
from psycopg2.extras import RealDictCursor

# --- CONFIGURAZIONE EMAIL ---
# (Manteniamo config email se serve, o la rimuoviamo se non usata)
# ...

# --- CONFIGURAZIONE DATABASE ---
DB_CONFIG = {
    "host": "db",
    "database": "staff_db",
    "user": "admin",
    "password": "password_doppio_malto"
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)

# --- HOOK: FORZA IL COMPORTAMENTO NEL PROMPT ---
@hook
def agent_prompt_prefix(prefix, cat):
    custom_prefix = """
    Sei l'assistente ufficiale di ScheduFlow per Doppio Malto.
    
    IMPORTANTE:
    1. Rispondi SEMPRE in ITALIANO.
    2. Sei gentile, professionale ma simpatico (come lo Stregatto).
    3. Usa i tool a disposizione per leggere e scrivere sul database.
    """
    return custom_prefix + prefix

# --- TOOL: MODIFICA LIVELLO DIPENDENTE ---
@tool
def cambia_livello_staff(nome_dipendente, nuovo_livello, cat):
    """Cambia il livello (JUNIOR, MEDIUM, SENIOR) di un dipendente. 
    Esempio: 'Cambia il livello di Ahmed a senior'."""
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Prisma usa CamelCase per le colonne ("skillLevel") e PascalCase per la tabella ("Staff")
        # Attenzione alle virgolette doppie per PostgreSql case-sensitive
        query = 'UPDATE "Staff" SET "skillLevel" = %s WHERE nome ILIKE %s RETURNING nome, "skillLevel";'
        
        # Normalizziamo il livello a upper case (SENIOR, MEDIUM, JUNIOR)
        livello_upper = nuovo_livello.upper()
        
        cur.execute(query, (livello_upper, f"%{nome_dipendente}%"))
        updated_row = cur.fetchone()
        
        conn.commit()
        cur.close()
        conn.close()
        
        if updated_row:
            return f"✅ Fatto! Ho aggiornato il livello di {updated_row['nome']} a {updated_row['skillLevel']}."
        else:
            return f"❌ Non ho trovato nessun dipendente con il nome '{nome_dipendente}'."
            
    except Exception as e:
        return f"⚠️ Errore durante l'aggiornamento database: {str(e)}"

# --- TOOL: LISTA STAFF ORDINATA ---
@tool
def mostra_staff_ordinato(cat):
    """Mostra l'organigramma completo dello staff, ordinato per ruolo."""
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Query adattata allo schema Prisma (senza colonna 'area')
        query = """
            SELECT nome, ruolo, "skillLevel" as livello
            FROM "Staff"
            ORDER BY 
            CASE ruolo
                WHEN 'Direttore' THEN 1
                WHEN 'Vice Direttore' THEN 2
                WHEN 'Junior Manager' THEN 3
                WHEN 'Operatore' THEN 4
                WHEN 'Cameriere' THEN 4
                WHEN 'Capo Cucina' THEN 5
                WHEN 'Manager Cucina' THEN 6
                WHEN 'Operatore Cucina' THEN 7
                ELSE 99
            END;
        """
        cur.execute(query)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        output = "**ORGANIGRAMMA (da Database):**\n"
        for row in rows:
            output += f"- {row['ruolo']}: {row['nome']} ({row['livello']})\n"
            
        return output
    except Exception as e:
        return f"❌ Errore lettura database: {str(e)}"
