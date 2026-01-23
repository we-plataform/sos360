# ⚡ Deploy Rápido no Render - Resumo

## 🎯 Configuração Essencial

### 1. Criar Web Service
- **New +** → **Web Service**
- Conecte repositório `lia360`
- **Root Directory**: `.` (vazio/raiz) ⚠️ **NÃO** `apps/api`

### 2. Build & Start Commands

**Build Command:**
```bash
npm install && npm run build:api
```

**Start Command:**
```bash
npm run start --workspace=@lia360/api
```

### 3. Variáveis de Ambiente Obrigatórias

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=sua-chave-32-caracteres-minimo
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGINS=https://lia360-web-sigma.vercel.app,https://*.vercel.app,chrome-extension://*
```

### 4. Variáveis Opcionais

```env
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=sb_secret_...
REDIS_URL=rediss://... (ou deixe vazio)
```

## ✅ Verificação Rápida

```bash
# Health check
curl https://sua-api.onrender.com/health

# Deve retornar:
# {"status":"ok","timestamp":"..."}
```

## 🐛 Problemas Comuns

| Problema | Solução |
|----------|---------|
| Prisma não inicializado | Verifique Root Directory = `.` e Build Command = `npm run build:api` |
| Workspace não encontrado | Root Directory deve ser raiz do projeto, não `apps/api` |
| CORS error | Adicione URL exata do frontend em `CORS_ORIGINS` |
| Serviço dorme | Free tier dorme após 15min - upgrade para Starter ($7/mês) |

## 📋 Checklist

- [ ] Root Directory = `.`
- [ ] Build Command = `npm install && npm run build:api`
- [ ] Start Command = `npm run start --workspace=@lia360/api`
- [ ] Todas variáveis configuradas
- [ ] Health check OK
- [ ] Frontend atualizado com URL da API

---

**Guia completo:** Veja `DEPLOY_RENDER.md` para detalhes.
