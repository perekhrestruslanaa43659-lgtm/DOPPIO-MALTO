# 🌐 Configurazione per scheduling.my

Vercel CLI richiede autenticazione manuale che non posso completare da qui senza browser.

Ecco l'istruzione esatta per configurare `scheduling.my`:

## 1. Su Vercel (Dashboard)
1. Vai su: **[Vercel Dashboard - Domains](https://vercel.com/dashboard)** (seleziona il tuo progetto)
2. Clicca su **Settings** > **Domains**.
3. Scrivi `scheduling.my` e clicca **Add**.

## 2. Sul pannello dove hai comprato il dominio (Registrar)
Devi impostare questi **Nameservers** (metodo consigliato) oppure i **Record DNS**.

### Opzione A: Cambiare i Nameservers (Più Facile)
Trova la sezione "Nameservers" o "NS" nel pannello del tuo provider (es. GoDaddy, Namecheap, MYNIC) e impostali a:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

*Questa opzione delega tutto a Vercel, molto più comodo.*

### Opzione B: Configurazione DNS Manuale (Record A)
Se preferisci mantenere i DNS attuali, aggiungi questo record:

| Tipo | Nome | Valore |
|---|---|---|
| **A** | `@` | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

---

> **Nota**: La propagazione può richiedere fino a 24-48 ore, ma spesso funziona in pochi minuti.
