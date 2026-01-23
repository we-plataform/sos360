# Correção de Variáveis de Ambiente no Railway

## ❌ Problemas Identificados

### 🔴 **CRÍTICO - Falta `CORS_ORIGINS`**
A API precisa desta variável para permitir requisições do frontend. **Sem ela, o frontend não conseguirá se conectar.**

### 🔴 **CRÍTICO - URLs com `localhost`**
As seguintes variáveis estão incorretas para produção:
- `API_URL=http://localhost:3001` ❌
- `NEXT_PUBLIC_API_URL=http://localhost:3001` ❌
- `NEXT_PUBLIC_WS_URL=ws://localhost:3001` ❌

**Problema**: `localhost` não funciona em produção. Essas variáveis devem apontar para a URL pública do Railway.

### 🟡 **Placeholders não resolvidos**
- `REDIS_URL=VALUE or ${{REF}}` - Placeholder não resolvido
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=VALUE or ${{REF}}` - Placeholder não resolvido

### 🟡 **Variáveis desnecessárias**
- `API_PORT=3001` - A API usa `PORT`, não `API_PORT`

### ⚠️ **Segurança**
- `JWT_SECRET` está reutilizando `SUPABASE_SERVICE_KEY` - Funciona, mas não é ideal de segurança

---

## ✅ Variáveis Corretas para Railway

### **Variáveis Obrigatórias da API:**

```env
# Ambiente
NODE_ENV=production
PORT=3001

# Database (Supabase) - ✅ Estão corretas
DATABASE_URL=postgresql://postgres.doewttvwknkhjzhzceub:Farinelli%4063@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.doewttvwknkhjzhzceub:Farinelli%4063@aws-0-sa-east-1.pooler.supabase.com:5432/postgres

# JWT - ✅ Está correta (mas idealmente deveria ser diferente de SUPABASE_SERVICE_KEY)
JWT_SECRET=sb_secret_Sbc7112MXDLBIL4vctr1SA_HGsoW3vx
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS - 🔴 FALTA ESTA VARIÁVEL!
CORS_ORIGINS=https://seu-app.vercel.app,https://*.vercel.app,chrome-extension://*

# Supabase - ✅ Estão corretas
SUPABASE_URL=https://doewttvwknkhjzhzceub.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_Sbc7112MXDLBIL4vctr1SA_HGsoW3vx

# Redis - Opcional (pode ficar vazio)
REDIS_URL=
```

### **Variáveis para Vercel (Frontend):**

```env
# API URLs - 🔴 CORRIGIR com a URL real do Railway
NEXT_PUBLIC_API_URL=https://lia360-api-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://lia360-api-production.up.railway.app

# Supabase - ✅ CORRIGIR o placeholder
NEXT_PUBLIC_SUPABASE_URL=https://doewttvwknkhjzhzceub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[OBTER DA SUPABASE - Settings > API > anon public key]

# Outras variáveis do frontend
API_URL=https://lia360-api-production.up.railway.app
```

---

## 📋 Passo a Passo para Corrigir

### 1. Obter a URL do Railway

1. No Railway, vá para o serviço da API
2. Na aba **Settings** > **Networking**
3. Copie a **Public Domain** (algo como `https://lia360-api-production.up.railway.app`)
4. **Use esta URL para todas as variáveis de API abaixo**

### 2. Obter a Supabase Anon Key

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Settings** > **API**
4. Copie a **anon public** key (não a service_role!)

### 3. Obter a URL do Frontend na Vercel

1. Acesse [Vercel Dashboard](https://vercel.com)
2. Selecione seu projeto
3. Na aba **Deployments**, copie a URL (algo como `https://seu-app.vercel.app`)

### 4. Configurar Variáveis no Railway (API)

No Railway, adicione/corrija:

```env
# Adicionar (FALTA!)
CORS_ORIGINS=https://seu-app.vercel.app,https://*.vercel.app,chrome-extension://*

# Remover (desnecessária)
API_PORT ❌

# Manter como está (opcional, pode ficar vazio)
REDIS_URL= (pode ficar vazio se não usar Redis)

# Manter como está
NODE_ENV=production
PORT=3001
DATABASE_URL=[mantenha]
DIRECT_URL=[mantenha]
JWT_SECRET=[mantenha]
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
SUPABASE_URL=[mantenha]
SUPABASE_SERVICE_KEY=[mantenha]
```

**Nota**: `CORS_ORIGINS` deve incluir:
- URL do frontend na Vercel
- Padrões wildcard do Vercel (`https://*.vercel.app`)
- `chrome-extension://*` para a extensão funcionar

### 5. Configurar Variáveis na Vercel (Frontend)

Na Vercel, adicione/corrija:

```env
# Corrigir (substituir localhost pela URL do Railway)
NEXT_PUBLIC_API_URL=https://lia360-api-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://lia360-api-production.up.railway.app
API_URL=https://lia360-api-production.up.railway.app

# Corrigir (substituir placeholder pela chave real)
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon public key do Supabase]

# Manter
NEXT_PUBLIC_SUPABASE_URL=https://doewttvwknkhjzhzceub.supabase.co
```

**Importante**: Use `wss://` (WebSocket seguro) para `NEXT_PUBLIC_WS_URL`, não `ws://`

### 6. Redeploy

Após corrigir as variáveis:
1. **Railway**: O deploy é automático, mas você pode forçar um redeploy
2. **Vercel**: Faça um redeploy manual do frontend

---

## 🔍 Verificação

Após configurar, verifique:

1. **API no Railway está rodando?**
   ```bash
   curl https://sua-api-railway.up.railway.app/health
   ```
   Deve retornar: `{"status":"ok",...}`

2. **CORS está funcionando?**
   - Tente fazer uma requisição do frontend
   - Se funcionar, CORS está OK
   - Se der erro de CORS, verifique `CORS_ORIGINS`

3. **Frontend consegue conectar?**
   - Abra o console do navegador
   - Verifique se há erros de conexão

---

## 📝 Resumo das Ações Necessárias

| Variável | Status Atual | Ação Necessária |
|----------|-------------|-----------------|
| `CORS_ORIGINS` | ❌ Não existe | ✅ **Adicionar** com URL do Vercel |
| `NEXT_PUBLIC_API_URL` | ❌ localhost | ✅ **Corrigir** para URL do Railway |
| `NEXT_PUBLIC_WS_URL` | ❌ localhost | ✅ **Corrigir** para wss://URL do Railway |
| `API_URL` | ❌ localhost | ✅ **Corrigir** para URL do Railway |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ❌ Placeholder | ✅ **Corrigir** com chave real |
| `REDIS_URL` | ⚠️ Placeholder | ℹ️ Pode ficar vazio se não usar Redis |
| `API_PORT` | ⚠️ Não usado | ❌ **Remover** (não é necessária) |
| `JWT_SECRET` | ⚠️ Reusa service key | ℹ️ Funciona, mas ideal seria diferente |

---

## ✅ Checklist Final

- [ ] Obter URL pública do Railway
- [ ] Adicionar `CORS_ORIGINS` no Railway com URL do Vercel
- [ ] Corrigir `NEXT_PUBLIC_API_URL` na Vercel
- [ ] Corrigir `NEXT_PUBLIC_WS_URL` na Vercel
- [ ] Corrigir `API_URL` na Vercel (se necessário)
- [ ] Obter Supabase Anon Key
- [ ] Corrigir `NEXT_PUBLIC_SUPABASE_ANON_KEY` na Vercel
- [ ] Remover `API_PORT` (se existir)
- [ ] Configurar `REDIS_URL` (ou deixar vazio)
- [ ] Fazer redeploy do Railway
- [ ] Fazer redeploy do Vercel
- [ ] Testar conexão do frontend com a API

---

**Depois de corrigir essas variáveis, a API deve funcionar corretamente no Railway!**
