# ⚡ Frontend Produção - Configuração Rápida

## 🎯 Variáveis Necessárias na Vercel

### 1. Obter Credenciais

**Supabase:**
- Dashboard → Settings → API
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**API (Render):**
- Dashboard → Settings → Networking
- **Public URL** → `NEXT_PUBLIC_API_URL`

### 2. Configurar na Vercel

**Settings** → **Environment Variables** → Adicionar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://doewttvwknkhjzhzceub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key-do-supabase]
NEXT_PUBLIC_API_URL=https://sua-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://sua-api.onrender.com
```

### 3. Redeploy

**Deployments** → **Redeploy**

---

## ✅ Checklist

- [ ] Variáveis configuradas na Vercel
- [ ] Redeploy feito
- [ ] Frontend conecta ao Supabase
- [ ] Frontend conecta à API

---

**Guia completo:** `CONFIGURAR_FRONTEND_PRODUCAO.md`
