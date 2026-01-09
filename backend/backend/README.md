Mock backend for Scheduling Dashboard

This mock server emulates the n8n webhook endpoints so the frontend can be tested locally without Google Sheets or n8n.

Install & run

```bash
cd scheduling/backend
npm install
npm run dev    # requires nodemon or use npm start
```

Default port: 4000
Set env: PORT to change.

Endpoints
- GET  /get-staff
- POST /upsert-staff  { Nome, OreMinSettimana, OreMaxSettimana, CostoOrario }
- POST /delete-staff  { Nome }

- GET  /get-turni
- POST /upsert-turno { identificativo, nome, data, inizio, fine, costo_stimato, stato }
- POST /delete-turno { identificativo }

- GET  /get-unavailability
- POST /upsert-unavailability { Dipendente, Data, Inizio, Fine, Motivo }
- POST /delete-unavailability { Dipendente, Data, Inizio }

- GET  /get-constraints
- POST /upsert-constraint { SettimanaInizio, BudgetTotale, ProduttivitaAttesa, GiorniChiusi, Note }
- POST /delete-constraint { SettimanaInizio }

Notes
- Data stored in `scheduling/data` as JSON files.
- This backend is intended for local testing; replace with n8n+Google Sheets in production.
