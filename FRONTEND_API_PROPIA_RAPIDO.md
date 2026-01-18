# ⚡ Frontend Produção - API Própria (Resumo Rápido)

## 🎯 Variáveis Necessárias na Vercel

### 1. Obter URL da API

**Render:**
- Dashboard → Settings → Networking
- **Public URL** → `NEXT_PUBLIC_API_URL`

### 2. Configurar na Vercel

**Settings** → **Environment Variables** → Adicionar:

```env
NEXT_PUBLIC_API_URL=https://sua-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://sua-api.onrender.com
```

### 3. Redeploy

**Deployments** → **Redeploy**

---

## ✅ Checklist

- [ ] Variáveis configuradas na Vercel
- [ ] Redeploy feito
- [ ] Frontend conecta à API
- [ ] Health check funciona

---

## ⚠️ Importante

- **NÃO** precisa de variáveis do Supabase
- Frontend se conecta **apenas** à API
- API gerencia o banco de dados

---

**Guia completo:** `CONFIGURAR_FRONTEND_API_PROPIA.md`
