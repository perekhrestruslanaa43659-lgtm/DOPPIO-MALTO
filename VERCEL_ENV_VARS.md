# Variabili d'Ambiente per Vercel

## 🔑 JWT Secret Generato
```
cb1468d29c3b75b2092abc3f1477e01482228dac331cf3078d21651c2f9595d6
```

## 📋 Configurazione Vercel Dashboard

Vai su: https://vercel.com/perekhrestruslanaa43659-lgtm-pr/scheduliflow/settings/environment-variables

Aggiungi queste variabili:

### DATABASE_URL
**Nome:** `DATABASE_URL`
**Valore:** Ottieni da Supabase Dashboard → Settings → Database → Connection String (URI)
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### JWT_SECRET
**Nome:** `JWT_SECRET`
**Valore:**
```
cb1468d29c3b75b2092abc3f1477e01482228dac331cf3078d21651c2f9595d6
```

### NODE_ENV (Opzionale)
**Nome:** `NODE_ENV`
**Valore:** `production`

---

## ✅ Checklist

- [ ] Copiato DATABASE_URL da Supabase
- [ ] Aggiunto DATABASE_URL su Vercel
- [ ] Aggiunto JWT_SECRET su Vercel
- [ ] Salvato le variabili
- [ ] Re-deploy dal Dashboard
- [ ] Eseguito migrazioni database
- [ ] Testato l'applicazione

## 🔗 Link Rapidi

- [Supabase Dashboard](https://supabase.com/dashboard/project/_)
- [Vercel Dashboard](https://vercel.com/perekhrestruslanaa43659-lgtm-pr/scheduliflow)
- [Vercel Settings](https://vercel.com/perekhrestruslanaa43659-lgtm-pr/scheduliflow/settings/environment-variables)
