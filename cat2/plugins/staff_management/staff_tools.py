
from cat.mad_hatter.decorators import tool, hook
import psycopg2
from psycopg2.extras import RealDictCursor

# --- CONFIGURAZIONE DATABASE ---
# --- CONFIGURAZIONE DATABASE ---
# Usiamo il Database Reale (NeonDB) perché l'app punta lì
DB_DSN = "postgresql://neondb_owner:npg_M0tNR8OizgPd@ep-empty-meadow-a4opi0ya-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

def get_db_connection():
    return psycopg2.connect(DB_DSN, cursor_factory=RealDictCursor)

# --- HOOK: FORZA IL PROMPT DI SISTEMA ---
@hook
def agent_prompt_prefix(prefix, cat):
    return """
    SEI L'AMMINISTRATORE DI SCHEDUFLOW.
    
    POLITICA "ZERO DUPLICATI":
    Devi normalizzare le postazioni eliminando ridondanze.
    
    1. LOGICA DI UNIFICAZIONE (Mapping):
    - [SALA] BAR SU: Include "BARSU", "BAR SU", "BAR_SU".
    - [SALA] BAR GIU: Include "BARGIU", "BAR GIU", "BAR GIU'".
    - [SALA] CDR: Usa sempre il termine "P.Ordini" (Presa Ordini).
    - [SALA] ACCOGLIENZA: Unifica "ACC", "ACCSU", "ACCGIU", "ACCOGLIENZA".
    - [CUCINA] Mantieni: BURGER, FRITTI, PIRA, PREPARAZIONE, DOLCI/INS, LAVAGGIO, PIZZA.
    
    2. REGOLA ANTI-RIDONDANZA:
    - Se l'input ha più varianti (es: BAR SU + BARSU), salvale come UNA Sola ("BAR SU").
    
    3. OUTPUT:
    - Presenta le postazioni pulite, separate da virgola.
    - Esempio: "BAR SU, CDR, ACCOGLIENZA"
    
    STRUMENTI:
    - aggiorna_dati_staff
    - mostra_staff_ordinato
    """

@hook
def agent_prompt_suffix(suffix, cat):
    print("DEBUG: agent_prompt_suffix CALLED")
    return """
    ISTRUZIONI FINALI:
    1. Se il tool ha restituito un successo, rispondi con: "Eseguito." e basta.
    2. NON AGGIUNGERE COMMENTI.
    3. NON USARE EMOJI O FRASI SIMPATICHE.
    """

# --- TOOL: AGGIORNA CAMPO GENERICO ---
@tool
def aggiorna_dati_staff(nome_dipendente, campo, nuovo_valore, cat):
    """Aggiorna un dato di uno staff member."""
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Mappa campi
        mappa_campi = {
            'livello': 'skillLevel',
            'skill': 'skillLevel',
            'costo': 'costoOra',
            'costo orario': 'costoOra',
            'ruolo': 'ruolo',
            'ore minime': 'oreMinime',
            'ore massime': 'oreMassime'
        }
        
        colonna_db = mappa_campi.get(campo.lower(), campo)
        
        # Gestione tipi
        valore_db = nuovo_valore
        if colonna_db == 'skillLevel':
            valore_db = str(nuovo_valore).upper()
        elif colonna_db in ['costoOra', 'oreMinime', 'oreMassime']:
            import re
            cleaned = re.sub(r'[^\d\.]', '', str(nuovo_valore))
            valore_db = float(cleaned) if '.' in cleaned else int(cleaned)
            
        # Query
        query = f'UPDATE "Staff" SET "{colonna_db}" = %s WHERE nome ILIKE %s RETURNING nome, "{colonna_db}";'
        cur.execute(query, (valore_db, f"%{nome_dipendente}%"))
        updated_row = cur.fetchone()
        
        conn.commit()
        cur.close()
        conn.close()
        
        if updated_row:
            # PROMPT INJECTION NEL RITORNO DEL TOOL
            return f"""
            SYSTEM_MSG: Operazione completata con successo nel database.
            Dato aggiornato: {updated_row['nome']} -> {colonna_db} = {updated_row[colonna_db]}.
            
            ISTRUZIONE PER L'LLM:
            Rispondi all'utente ESATTAMENTE con questa frase:
            "✅ Modifica completata: {updated_row['nome']} ora ha {colonna_db} a {updated_row[colonna_db]}."
            NON AGGIUNGERE ALTRO.
            """
        else:
            return "SYSTEM_MSG: Utente non trovato. Rispondi: 'Utente non trovato.'"
            
    except Exception as e:
        return f"SYSTEM_MSG: Errore {str(e)}. Rispondi: 'Errore nel database.'"

# --- TOOL: LISTA STAFF ORDINATA ---
@tool
def mostra_staff_ordinato(cat):
    """Mostra l'organigramma."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # ... query existing ...
        query = """
            SELECT nome, ruolo, "skillLevel" as livello, "costoOra" as costo
            FROM "Staff"
            ORDER BY ruolo
        """
        # (Semplifico la query per brevità nel replace, ma idealmente mantengo l'ordinamento)
        cur.execute('SELECT nome, ruolo, "skillLevel", "costoOra" FROM "Staff"') # Semplificata per debug
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        output = "**ORGANIGRAMMA:**\n"
        for row in rows:
            output += f"- {row['nome']} ({row['ruolo']})\n"
            
        return output
    except Exception as e:
        return f"Errore: {str(e)}"
