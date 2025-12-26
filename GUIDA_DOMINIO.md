# 🌐 Guida Configurazione Dominio Personalizzato su Vercel

Poiché l'accesso via terminale richiede autenticazione manuale, il metodo più semplice e veloce è configurare il dominio direttamente dalla Dashboard di Vercel.

## 1. Accedi al Pannello di Controllo
1. Visita [vercel.com/dashboard](https://vercel.com/dashboard)
2. Clicca sul tuo progetto (es. `scheduliuwa` o simile).

## 2. Aggiungi il Dominio
1. Clicca sulla tab **Settings** in alto.
2. Dal menu laterale sinistro, seleziona **Domains**.
3. Inserisci il tuo dominio (es. `miosito.it` o `app.miosito.it`) nel campo di testo.
4. Clicca **Add**.

## 3. Configura i DNS (presso il tuo Registrar)
Vercel ti mostrerà dei valori da inserire nel pannello di controllo dove hai comprato il dominio (es. Aruba, GoDaddy, Namecheap).

### Se usi un Dominio Principale (es. `miosito.it`):
Dovrai aggiungere un **Record A**:
- **Tipo**: `A`
- **Nome/Host**: `@` (oppure lascia vuoto)
- **Valore**: `76.76.21.21` (IP fisso di Vercel)

E un **Record CNAME** per il www:
- **Tipo**: `CNAME`
- **Nome/Host**: `www`
- **Valore**: `cname.vercel-dns.com`

### Se usi un Sottodominio (es. `app.miosito.it`):
Dovrai aggiungere un **Record CNAME**:
- **Tipo**: `CNAME`
- **Nome/Host**: `app`
- **Valore**: `cname.vercel-dns.com`

## 4. Attendi la Propagazione
Una volta inseriti i record, Vercel verificherà automaticamente la connessione.
- Può richiedere da pochi minuti a 24 ore (solitamente rapido).
- Quando vedi i pallini verdi su Vercel, il sito è online!

---

> **Hai bisogno di aiuto specifico?**
> Scrivimi quale dominio hai acquistato e dove (Aruba, GoDaddy, etc), e ti dirò esattamente quali valori inserire!
