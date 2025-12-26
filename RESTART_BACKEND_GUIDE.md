# 🔧 Guida Riavvio Backend

## ⚠️ Problema Attuale

Il comando `npx prisma db push` è bloccato da oltre 59 minuti, impedendo:
- ✅ Funzionamento pulsante "Genera Turni"
- ✅ Salvataggio utenti nel database
- ✅ Applicazione nuovi campi database

---

## 🚀 Soluzione Rapida - Manuale

### Passo 1: Ferma il Backend
1. Vai al terminale dove vedi `npm run dev` (backend)
2. Premi `Ctrl+C`
3. Aspetta che si fermi completamente

### Passo 2: Riavvia il Backend
```bash
cd c:\scheduling\backend
npm run dev
```

### Passo 3: Ricarica Browser
- Premi `F5` nella pagina web

---

## 🎯 Soluzione Automatica - Script

**Usa lo script creato:**

1. Apri `Esplora File`
2. Vai in `c:\scheduling`
3. Doppio click su `restart-backend.bat`
4. Lo script farà tutto automaticamente

---

## 📋 Cosa Fa lo Script

1. **Ferma tutti i processi Node.js** (backend e prisma bloccato)
2. **Applica le modifiche al database** con `prisma generate`
3. **Riavvia il backend** con `npm run dev`

---

## ✅ Verifica che Funzioni

Dopo il riavvio:

1. **Vai alla pagina Turni**
2. **Clicca "🤖 Genera Turni (AI Expert)"**
3. **Dovrebbe apparire il messaggio di conferma**

4. **Vai alla pagina Utenti**
5. **Crea un nuovo utente**
6. **Dovrebbe salvare e mostrare "✅ Utente creato con successo!"**

---

## 🔮 Prevenzione Futura

### Quando Modifichi il Database:

**❌ NON FARE:**
```bash
# Server in esecuzione
npm run dev
# Poi in un altro terminale
npx prisma db push  ← SBAGLIATO!
```

**✅ FARE:**
```bash
# 1. Ferma server
Ctrl+C

# 2. Applica modifiche
npx prisma db push

# 3. Riavvia
npm run dev
```

### Oppure Usa lo Script:
```bash
restart-backend.bat
```

---

## 🆘 Se Continua a Non Funzionare

1. **Chiudi TUTTI i terminali**
2. **Riapri un nuovo terminale**
3. **Esegui:**
   ```bash
   cd c:\scheduling\backend
   npm run dev
   ```

---

## 📝 Note Tecniche

- **SQLite** blocca il file `.db` quando è in uso
- **Prisma** non può modificare il database se è bloccato
- **Windows** blocca i file `.dll` quando sono caricati in memoria
- **Soluzione:** Fermare sempre il server prima di modificare il database
