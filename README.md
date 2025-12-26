# DOPPIO-MALTO

Sistema di gestione turni per Doppio Malto

## Struttura del Progetto

```
├── app/                    # Pagine Next.js
├── components/            # Componenti React riutilizzabili
├── data/
│   └── turni/            # File CSV con i dati dei turni
├── docs/
│   └── deployment/       # Documentazione deployment e guide
├── public/               # File statici pubblici
└── src/
    ├── api/              # API e test
    ├── backend/          # Logica backend
    └── lib/              # Librerie e utility
```

## Installazione

```bash
npm install
```

## Configurazione

1. Copia `.env.example` in `.env`
2. Configura le variabili d'ambiente per Supabase e Gemini

## Sviluppo

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) nel browser.

## Build

```bash
npm run build
npm start
```