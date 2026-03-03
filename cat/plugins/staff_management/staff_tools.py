
from cat.mad_hatter.decorators import tool, hook
from pydantic import BaseModel
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
import asyncio

# --- CONFIGURAZIONE EMAIL ---
conf = ConnectionConfig(
    MAIL_USERNAME="tua_email@doppiomalto.it",
    MAIL_PASSWORD="password_sicura",
    MAIL_FROM="noreply@doppiomalto.it",
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True
)

# --- MAPPA GERARCHICA DOPPIO MALTO ---
# Definiamo l'ordine numerico per l'ordinamento automatico
GERARCHIA_ORDINE = {
    "Direttore": 1, "Vice Direttore": 2, "Junior Manager": 3, "Operatore Sala": 4,
    "Capo Cucina": 5, "Manager Cucina": 6, "Operatore Cucina": 7
}

# --- TOOL: AGGIUNGI DIPENDENTE (REAL API) ---
@tool(return_direct=False)
def aggiungi_dipendente_staff(nome, ruolo, area, cat):
    """Aggiunge un dipendente reale al database. Input: nome, ruolo (es: Direttore), area (SALA o CUCINA)."""
    
    import requests
    
    # Map area/role to API format if needed, but current API is flexible.
    # API endpoints usually at http://host.docker.internal:3000/api/staff if running in Docker
    # Or http://localhost:3000/api/staff if Cat is local (but Cat is usually dockerized)
    
    # Try host.docker.internal first (standard for Docker Desktop)
    api_url = "http://host.docker.internal:3000/api/staff"
    
    payload = {
        "nome": nome,
        "ruolo": ruolo, 
        # Area is implicit in role usually, or added to custom field? 
        # The App API 'POST /staff' expects: { nome, cognome, ruolo, email... }
        "cognome": "", # Optional
        "email": "", # Optional
        "listIndex": 999 
    }
    
    headers = {
        "Content-Type": "application/json",
        "x-user-tenant-key": "locale-test-doppio-malto" 
    }
    
    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=5)
        if response.status_code in [200, 201]:
            return f"✅ Fatto! Ho aggiunto {nome} ({ruolo}) al database principale."
        else:
            return f"⚠️ Errore API: {response.status_code} - {response.text}"
    except Exception as e:
        return f"❌ Errore di connessione al server: {str(e)}. Assicurati che l'app Next.js sia avviata."




# --- TOOL: MODIFICA DATI DIPENDENTE (REAL API) ---
@tool(return_direct=False)
def modifica_dati_staff(nome_dipendente, campo_da_modificare, nuovo_valore, cat):
    """Modifica i dati di un dipendente. 
    Input: 
    - nome_dipendente (es: 'Ahmed')
    - campo_da_modificare (es: 'ruolo', 'skillLevel' o 'livello', 'nome')
    - nuovo_valore (es: 'SENIOR', 'Chef', 'Mario')
    """
    import requests
    
    api_url = "http://host.docker.internal:3000/api/staff"
    headers = {
        "Content-Type": "application/json",
        "x-user-tenant-key": "locale-test-doppio-malto"
    }
    
    try:
        # 1. Cerca il dipendente per trovare l'ID
        response_get = requests.get(api_url, headers=headers, timeout=5)
        if response_get.status_code != 200:
            return f"⚠️ Errore API durante la ricerca: {response_get.status_code}"
            
        staff_list = response_get.json()
        
        # Cerca corrispondenza fuzzy o esatta
        target_user = None
        for s in staff_list:
            full_name = (s.get('nome', '') + ' ' + s.get('cognome', '')).lower()
            if nome_dipendente.lower() in full_name:
                target_user = s
                break
        
        if not target_user:
            return f"❌ Non ho trovato nessun dipendente con il nome '{nome_dipendente}'."
            
        # 2. Prepara i dati per l'update
        target_id = target_user['id']
        
        # Mappa nomi amichevoli ai campi del DB
        campo_db = campo_da_modificare
        if campo_da_modificare.lower() in ['livello', 'skill', 'competenza']:
            campo_db = 'skillLevel'
            nuovo_valore = nuovo_valore.upper() # Es: SENIOR
        elif campo_da_modificare.lower() == 'ruolo':
             # Manteniamo il casing originale o mappiamo se necessario
             pass
             
        full_payload = target_user.copy()
        full_payload.update({campo_db: nuovo_valore})
        
        update_url = f"{api_url}?id={target_id}"
        
        response_put = requests.put(update_url, json=full_payload, headers=headers, timeout=5)
        
        if response_put.status_code == 200:
            return f"✅ Aggiornato {target_user['nome']}: {campo_da_modificare} -> {nuovo_valore}"
        else:
             return f"⚠️ Errore Update: {response_put.status_code} - {response_put.text}"

    except Exception as e:
        return f"❌ Errore nello script: {str(e)}"

# --- TOOL: INVIO EMAIL NOTIFICA ---
@tool(return_direct=True)
async def invia_email_staff(destinatario, oggetto, corpo, cat):
    """Invia un'email a un dipendente. Input: email, oggetto, messaggio."""
    
    message = MessageSchema(
        subject=oggetto,
        recipients=[destinatario],
        body=corpo,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)
    return f"Email inviata con successo a {destinatario}."

# --- HOOK: FORZA IL COMPORTAMENTO NEL PROMPT ---
@hook
def agent_prompt_prefix(prefix, cat):
    custom_prefix = """
    Sei l'assistente ufficiale di ScheduFlow per Doppio Malto.
    
    IMPORTANTE:
    1. Rispondi SEMPRE in ITALIANO.
    2. Sei gentile, professionale ma simpatico (come lo Stregatto).
    3. Gestisci lo staff seguendo queste priorità: 
       - SALA (Direttore > Vice > Junior > Operatori) 
       - CUCINA (Capo Cucina > Manager > Operatori).
    4. Se l'utente chiede modifiche manuali, elenca i dipendenti con un ID numerico.
    """
    return custom_prefix + prefix

# --- TOOL: LOGIN SIMULATO ---
@tool
def verifica_accesso(email, password, cat):
    """Verifica le credenziali per accedere alle funzioni admin di ScheduFlow."""
    # Qui implementeresti il confronto hash con Passlib
    if email == "admin@doppiomalto.it" and password == "admin123":
        cat.working_memory["user_auth"] = True
        return "Accesso eseguito. Ora puoi modificare l'organigramma."
    return "Credenziali errate."
