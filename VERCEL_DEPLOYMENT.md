# Guida Deployment Vercel - Applicazione Scheduling con AI Agent

## 🚀 Quick Start

### 1. Installare Vercel CLI
```bash
npm install -g vercel
```

### 2. Login a Vercel
```bash
vercel login
```

### 3. Deploy
```bash
cd c:\scheduling
vercel
```

Segui le istruzioni interattive. Vercel rileverà automaticamente il progetto.

---

## ⚙️ Configurazione Variabili d'Ambiente

### Su Vercel Dashboard

1. Vai su [vercel.com/dashboard](https://vercel.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **Settings** → **Environment Variables**
4. Aggiungi le seguenti variabili:

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `DATABASE_URL` | URL database PostgreSQL | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | Chiave segreta JWT | `your-secret-key-here` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret | `GOCSPX-xxx` |
| `EMAIL_USER` | Email per notifiche (opzionale) | `noreply@example.com` |
| `EMAIL_PASS` | Password email (opzionale) | `app-password` |

### Variabili Locali (.env)

Per lo sviluppo locale, crea un file `.env` in `backend/`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-jwt-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
```

---

## 🗄️ Database Setup

### ⚠️ Importante: SQLite non funziona su Vercel

Vercel usa serverless functions che non supportano SQLite. Devi migrare a PostgreSQL.

### Opzione 1: Vercel Postgres (Consigliato)

1. Nel tuo progetto Vercel, vai su **Storage**
2. Clicca **Create Database** → **Postgres**
3. Copia il `DATABASE_URL` fornito
4. Aggiungilo alle variabili d'ambiente

### Opzione 2: Database Esterno

Puoi usare:
- **Supabase** (PostgreSQL gratuito)
- **Railway** (PostgreSQL gratuito)
- **Neon** (PostgreSQL serverless)

### Migrare da SQLite a PostgreSQL

1. Aggiorna `backend/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"  // cambia da "sqlite"
  url      = env("DATABASE_URL")
}
```

2. Esegui le migrazioni:
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

---

## 🔧 Configurazione AI Agent

L'AI Agent usa Google Gemini e funziona **lato client**.

### Per gli utenti finali:

1. Vai alla pagina **AI Agent**
2. Clicca su **⚙️ Settings**
3. Inserisci la tua API key Gemini
4. Clicca **💾 Salva e Inizia**

### Come ottenere l'API Key Gemini:

1. Vai su [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Accedi con il tuo account Google
3. Clicca **Create API Key**
4. Copia la chiave

**Nota:** Gemini Pro è gratuito fino a 60 richieste/minuto!

---

## 📦 Build e Deploy

### Build Locale (Test)

```bash
# Frontend
cd frontend
npm run build

# Backend (non richiede build)
cd backend
npm install
```

### Deploy Automatico

Vercel fa il deploy automatico ad ogni push su GitHub:

1. Collega il repository GitHub a Vercel
2. Ogni push su `main` triggera un deploy automatico
3. I pull request creano preview deployments

### Deploy Manuale

```bash
# Deploy in produzione
vercel --prod

# Deploy preview
vercel
```

---

## 🌐 Domini

Dall'immagine vedo che hai già questi domini configurati:

- `scheduliuwavercel.app`
- `scheduliflow-git-main-perekhrestruslanaa43659-lgtm-projects.vercel.app`
- `scheduliflow-azanlop4gs-perekhrestruslanaa43659-lgtm-projects.vercel.app`

### Configurare un Dominio Personalizzato

1. Vai su **Settings** → **Domains**
2. Aggiungi il tuo dominio
3. Configura i DNS secondo le istruzioni Vercel

---

## 🐛 Troubleshooting

### Build Fallisce

**Errore:** `Module not found`
- Verifica che tutte le dipendenze siano in `package.json`
- Esegui `npm install` localmente

**Errore:** Database connection
- Verifica che `DATABASE_URL` sia configurato
- Assicurati di usare PostgreSQL, non SQLite

### AI Agent non funziona

**Errore:** "API key not valid"
- Verifica che l'API key Gemini sia corretta
- Controlla che non ci siano restrizioni sull'API key

**Errore:** CORS
- Verifica che il backend accetti richieste dal dominio Vercel
- Controlla la configurazione CORS in `server.js`

### Performance Issues

- Abilita **Vercel Analytics** per monitorare
- Considera l'uso di **Edge Functions** per ridurre latenza
- Ottimizza le query al database

---

## 📊 Monitoraggio

### Vercel Dashboard

- **Deployments:** Storico di tutti i deploy
- **Analytics:** Metriche di performance e traffico
- **Logs:** Log in tempo reale delle serverless functions
- **Speed Insights:** Analisi delle performance

### Log in Tempo Reale

```bash
vercel logs [deployment-url]
```

---

## 🔐 Sicurezza

### Best Practices

1. **Non committare `.env`** - È già in `.gitignore`
2. **Usa variabili d'ambiente** per tutti i secrets
3. **Abilita HTTPS** (automatico su Vercel)
4. **Configura CORS** correttamente
5. **Valida input utente** lato server

### Proteggere l'API

Considera di aggiungere:
- Rate limiting
- API key authentication
- Input validation
- SQL injection protection (Prisma lo fa automaticamente)

---

## 📚 Risorse Utili

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Google Gemini API](https://ai.google.dev/docs)

---

## 🆘 Supporto

Se hai problemi:

1. Controlla i **Logs** su Vercel Dashboard
2. Verifica le **Environment Variables**
3. Testa localmente con `vercel dev`
4. Consulta la [Vercel Community](https://github.com/vercel/vercel/discussions)
