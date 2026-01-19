Scheduling Dashboard — frontend

Setup locale

1. Installa dipendenze:

```bash
cd frontend
npm install
```

2. Avvia in dev:

```bash
npm run dev
```

Variabili d'ambiente
- `VITE_N8N_WEBHOOK` — URL base degli endpoint webhook n8n, es: `https://your-n8n.example/webhook`

Endpoints n8n attesi
- GET  /get-staff -> lista staff JSON
- POST /upsert-staff -> body: staff row -> upsert
- GET  /get-turni -> lista turni generati
- POST /upsert-turno -> body: turno -> upsert

Nota: il frontend si connette a n8n che funge da backend; implementa i webhook n8n corrispondenti usando i nodi Google Sheets.
