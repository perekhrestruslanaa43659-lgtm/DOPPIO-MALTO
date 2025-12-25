# 🚀 Quick Deploy Guide - Vercel

## Step 1: Installa Vercel CLI
```bash
npm install -g vercel
```

## Step 2: Login
```bash
vercel login
```

## Step 3: Deploy
```bash
cd c:\scheduling
vercel --prod
```

## Step 4: Configura Database PostgreSQL

### Opzione A: Vercel Postgres (Consigliato)
1. Vai su [Vercel Dashboard](https://vercel.com/dashboard)
2. Seleziona il progetto
3. Vai su **Storage** → **Create Database** → **Postgres**
4. Copia il `DATABASE_URL`
5. Vai su **Settings** → **Environment Variables**
6. Aggiungi `DATABASE_URL` con il valore copiato

### Opzione B: Database Esterno (Supabase/Railway/Neon)
1. Crea un database PostgreSQL gratuito su uno di questi servizi
2. Copia la connection string
3. Aggiungi come variabile d'ambiente `DATABASE_URL` su Vercel

## Step 5: Configura Variabili d'Ambiente

Su **Vercel Dashboard** → **Settings** → **Environment Variables**, aggiungi:

```
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your-secure-random-string
GOOGLE_CLIENT_ID=your-google-client-id (opzionale)
GOOGLE_CLIENT_SECRET=your-google-secret (opzionale)
```

## Step 6: Esegui Migrazioni Database

Dopo aver configurato il database:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

## Step 7: Re-Deploy

Dopo aver configurato le variabili d'ambiente:

```bash
vercel --prod
```

## ✅ Verifica

1. Apri l'URL fornito da Vercel
2. Testa il login
3. Vai alla pagina AI Agent
4. Inserisci la tua API key Gemini
5. Testa una conversazione

## 🔑 API Key Gemini (Per gli utenti)

L'AI Agent richiede che ogni utente inserisca la propria API key:

1. Vai su [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crea una nuova API key
3. Nella pagina AI Agent, clicca **⚙️ Settings**
4. Inserisci la chiave e salva

---

**Note:**
- Il database è già configurato per PostgreSQL ✅
- Il server è già compatibile con Vercel Serverless ✅
- L'AI Agent funziona lato client (nessuna config server necessaria) ✅

Per dettagli completi, vedi: [VERCEL_DEPLOYMENT.md](file:///c:/scheduling/VERCEL_DEPLOYMENT.md)
