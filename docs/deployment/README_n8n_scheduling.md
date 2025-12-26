README — Deploy: n8n Workforce Scheduling (Google Sheets)

Scopo
- Guida rapida per costruire il flusso n8n che genera, valida e upserta turni su Google Sheets.

Prerequisiti
- Account Google con accesso a Google Sheets.
- Progetto GCP con API Google Sheets abilitata.
- n8n accessibile (self-host o cloud) con credenziali Google Sheets configurate (Service Account JSON).

Schema Google Sheets (4 schede)
1) Staff
- Colonne: `Nome`, `OreMinSettimana`, `OreMaxSettimana`, `CostoOrario`, `Ruolo`, `Note`

2) Vincoli Settimanali
- Colonne: `SettimanaInizio` (YYYY-MM-DD), `BudgetTotale`, `ProduttivitaAttesa`, `GiorniChiusi` (JSON o CSV), `Note`

3) Indisponibilità
- Colonne: `Dipendente`, `Data` (YYYY-MM-DD), `Inizio` (HH:mm), `Fine` (HH:mm), `Motivo`

4) Turni Generati
- Colonne: `identificativo`, `nome`, `data` (YYYY-MM-DD), `inizio` (HH:mm), `fine` (HH:mm), `costo_stimato`, `stato`, `fonte`, `note`
- Regola: `identificativo` = [NOME]-[YYYY-MM-DD]

n8n Workflow (nodi principali)
- Webhook / Form Input
  - Riceve il JSON di input (vincoli/obiettivi) o comandi in linguaggio naturale (pre-elaborati). Esempio payload accettato sotto.

- Get Staff (Google Sheets)
  - Legge sheet `Staff` -> output `staff` array

- Get Unavailability (Google Sheets)
  - Legge sheet `Indisponibilità` -> output `indisponibilita` array

- Get Weekly Constraints (Google Sheets)
  - Legge sheet `Vincoli Settimanali` per `SettimanaInizio`

- AI Orchestrator (OpenAI/HTTP)
  - Invia payload JSON + System Prompt (vedi sezione "System Prompt")
  - Riceve output JSON con `turni` e `report`

- Parse AI Output (Function)
  - Verifica che l'AI abbia restituito JSON valido e le proprietà richieste

- Validator (Code node — JavaScript)
  - Esegue controlli matematici: orari validi, costo totale vs budget, ore settimanali vs min/max, conflitti con indisponibilità
  - Se errori: produce `problemi` e imposta `stato`="Errore"

- Upsert Turni (Google Sheets)
  - Per ogni turno calcola `identificativo` e cerca riga esistente (`Lookup Row(s)` su colonna `identificativo`).
  - Se trovata: `Update Row` con nuovi valori.
  - Se non trovata: `Append` nuova riga.
  - Se `problemi` presenti: scrivere `stato`="Errore" e dettaglio su `note`.

- Notify / Response
  - Risponde via Webhook/Chat con risultato e link al foglio `Turni Generati`.

System Prompt (da passare all'AI Agent)
- Usa il prompt di ottimizzazione compatto e rigido (italiano). Esempio:

Sei un "Workforce Optimization Expert". Input JSON:
- `staff`: [{nome, oreMin, oreMax, costoOrario, ruolo}],
- `indisponibilita`: [{nome, data, inizio, fine}],
- `vincoli`: {settimanaInizio, budgetTotale, produttivitaAttesa, giorniChiusi},
- `obiettivi`: {produzionePerGiorno, fasceAltaProduttivita}

OBIETTIVI:
1) Genera turni per la settimana `settimanaInizio`.
2) Costo totale <= `budgetTotale`.
3) Ogni dipendente lavori tra `oreMin` e `oreMax`.
4) Non assegnare in `indisponibilita` o `giorniChiusi`.

OUTPUT: rispondi SOLO con JSON:
{ "turni": [ { "identificativo","nome","data","inizio","fine","costo_orario","costo_stimato" } ], "report": { "costoTotale", "orePerDipendente", "problemi" } }

Regola rigida: se budget non sufficiente, includi `problemi` e non violare indisponibilità.

Validator — Code node (snippet)
- Incolla questo codice nel nodo `Code` (JavaScript):

```javascript
const turni = items[0].json.turni || [];
const staffInfo = items[0].json.staff || [];
const indispo = items[0].json.indisponibilita || [];
const budgetMax = Number(items[0].json.budgetTotale || 0);

function hhmmToDate(dStr, hhmm){
  const [y,m,d] = dStr.split('-').map(Number);
  const [hh,mm] = hhmm.split(':').map(Number);
  return new Date(y,m-1,d,hh,mm,0,0);
}

let costoTot=0;
const orePer = {};
const problemi = [];

turni.forEach(t=>{
  const inizio = hhmmToDate(t.data, t.inizio);
  const fine = hhmmToDate(t.data, t.fine);
  if(fine <= inizio){
    problemi.push({tipo:"ORARIO_INVALIDO", descrizione:`Turno ${t.identificativo} fine <= inizio`});
    return;
  }
  const ore = (fine - inizio)/3600000;
  const costo = ore * Number(t.costo_orario || 0);
  costoTot += costo;
  orePer[t.nome] = (orePer[t.nome]||0) + ore;
  const conflict = indispo.find(u=>{
    return u.Dipendente === t.nome && u.Data === t.data &&
      !(hhmmToDate(t.data, u.Fine) <= inizio || hhmmToDate(t.data, u.Inizio) >= fine);
  });
  if(conflict){
    problemi.push({tipo:"INDISPONIBILITA", descrizione:`${t.nome} non disponibile ${t.data} ${conflict.Inizio}-${conflict.Fine}`});
  }
});

if(costoTot > budgetMax){
  problemi.push({tipo:"BUDGET_SUPERATO", descrizione:`Costo stimato ${costoTot} > budget ${budgetMax}`});
}

staffInfo.forEach(s=>{
  const ore = orePer[s.Nome] || 0;
  if(ore < Number(s.OreMinSettimana || 0)) problemi.push({tipo:"ORE_MIN_VIOLATE", descrizione:`${s.Nome} ore settimanali ${ore} < min ${s.OreMinSettimana}`});
  if(ore > Number(s.OreMaxSettimana || 9999)) problemi.push({tipo:"ORE_MAX_VIOLATE", descrizione:`${s.Nome} ore settimanali ${ore} > max ${s.OreMaxSettimana}`});
});

return [{ json: { status: problemi.length ? "ERROR" : "OK", costoTotale: costoTot, orePerDipendente: orePer, problemi, turni } }];
```

Upsert (Google Sheets) — pratica
- Nodo 1: Lookup Row(s) colonna `identificativo`.
- Se esiste: Update Row → aggiorna `inizio`, `fine`, `costo_stimato`, `stato`.
- Se non esiste: Append Row con tutti i campi.
- Se validator ritorna `ERROR`: scrivi riga con `stato`="Errore" e inserisci `report.problemi` in `note`.

Creare Service Account Google (breve)
1) GCP Console → IAM & Admin → Service Accounts → Create.
2) Assegna ruolo `Editor` o limiti su Sheets; crea key JSON.
3) Condividi il Google Sheet con l'e-mail del service account (editor).
4) In n8n: crea credential Google Service Account e incolla JSON.

Esempio payload per Webhook (singolo giorno)
{
  "staff": [{"nome":"Marco","oreMin":20,"oreMax":40,"costoOrario":12}],
  "indisponibilita": [],
  "vincoli": {"settimanaInizio":"2025-12-22","budgetTotale":500},
  "richiesta": "Tutta la settimana prossima per Marco, 09:00-18:00"
}

Esempio payload per test (settimana completa — Lunedì-Venerdì)
{
  "staff":[{"nome":"Marco","oreMin":20,"oreMax":40,"costoOrario":12}],
  "vincoli":{"settimanaInizio":"2025-12-22","budgetTotale":2000},
  "test_mode": true,
  "richiesta": "Tutta la settimana prossima dalle 09:00 alle 18:00 per Marco"
}

Try it (curl to n8n webhook)
```bash
curl -X POST https://your-n8n.example/webhook/schedule \
  -H "Content-Type: application/json" \
  -d '{"staff":[{"nome":"Marco","oreMin":20,"oreMax":40,"costoOrario":12}],"vincoli":{"settimanaInizio":"2025-12-22","budgetTotale":2000},"richiesta":"Tutta la settimana prossima dalle 09:00 alle 18:00 per Marco"}'
```

Note finali e next steps
- Integrare il System Prompt nell'AI node e testare con payload di esempio.
- Dopo validazione, eseguire Upsert su `Turni Generati`.
- Posso generare i payload di test con date effettive della settimana prossima e/o creare il workflow n8n passo-passo se vuoi.
