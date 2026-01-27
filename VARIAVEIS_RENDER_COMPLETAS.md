# 📋 Variáveis de Ambiente Completas para Render

## ✅ Variáveis Obrigatórias

### 1. DATABASE_URL (CRÍTICO)

**Formato:**
```
postgresql://[usuario]:[senha]@[host]:[porta]/[database]?[opcoes]
```

**Exemplo Render PostgreSQL:**
```
postgresql://postgres:senha123@dpg-abc123-a.oregon-postgres.render.com:5432/lia360_db
```

**Exemplo Supabase:**
```
postgresql://postgres.abc123:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**⚠️ IMPORTANTE:**
- ✅ Deve incluir hostname completo
- ✅ Deve incluir porta
- ✅ Deve incluir nome do banco
- ❌ NÃO pode estar vazia
- ❌ NÃO pode ter espaços

### 2. JWT_SECRET (CRÍTICO)

**Formato:**
```
[chave-aleatoria-com-pelo-menos-32-caracteres]
```

**Exemplo:**
```
35ac4034f290bd81be283dba946b45a74b7fd00d2f25109a013f3b931a29ac6c
```

**⚠️ IMPORTANTE:**
- ✅ Mínimo 32 caracteres
- ✅ Use chave aleatória e segura
- ❌ NÃO reutilize outras chaves

### 3. CORS_ORIGINS (CRÍTICO)

**Formato:**
```
https://url-frontend.vercel.app,https://*.vercel.app,chrome-extension://*
```

**Exemplo:**
```
https://lia360-web-black.vercel.app,https://*.vercel.app,chrome-extension://*
```

**⚠️ IMPORTANTE:**
- ✅ Inclua URL exata do frontend
- ✅ Inclua wildcard do Vercel para previews
- ✅ Mantenha `chrome-extension://*` para extensão
- ✅ Separe múltiplas URLs por vírgula

### 4. NODE_ENV (Recomendado)

```
production
```

### 5. PORT (Opcional - Render injeta automaticamente)

```
3001
```

---

## ⚠️ Variáveis Opcionais

### DIRECT_URL

**Quando usar:** Se você usa Supabase ou pgbouncer

**Formato:**
```
postgresql://postgres.abc123:senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

**Diferença de DATABASE_URL:**
- `DATABASE_URL`: Porta `6543` com `?pgbouncer=true`
- `DIRECT_URL`: Porta `5432` sem pgbouncer

### REDIS_URL

**Quando usar:** Se você usa Redis (opcional)

**Formato:**
```
redis://localhost:6379
```

**Ou deixe vazio** se não usar Redis (a API funciona sem Redis)

### JWT_EXPIRES_IN

```
15m
```

### REFRESH_TOKEN_EXPIRES_IN

```
30d
```

---

## 📋 Checklist de Configuração

### No Render Dashboard

1. **Settings** → **Environment**
2. Adicione/verifique cada variável:

- [ ] `DATABASE_URL` - ✅ Configurada e não vazia
- [ ] `JWT_SECRET` - ✅ Mínimo 32 caracteres
- [ ] `CORS_ORIGINS` - ✅ Inclui URL do frontend
- [ ] `NODE_ENV` - ✅ `production`
- [ ] `DIRECT_URL` - ⚠️ Opcional (se usar Supabase)
- [ ] `REDIS_URL` - ⚠️ Opcional (pode ficar vazio)
- [ ] `JWT_EXPIRES_IN` - ⚠️ Opcional (padrão: `15m`)
- [ ] `REFRESH_TOKEN_EXPIRES_IN` - ⚠️ Opcional (padrão: `30d`)

---

## 🔍 Verificação nos Logs

Após configurar, verifique os logs. Deve aparecer:

```
=== Lia360 API Starting ===
DATABASE_URL set: true
JWT_SECRET set: true
[Config] Environment validated successfully
[Config] NODE_ENV: production
[Config] PORT: [porta]
[Config] CORS_ORIGINS: https://...
[Database] Initializing Prisma Client...
[Database] DATABASE_URL set: true
[Database] DATABASE_URL length: [número > 0]
[Database] DATABASE_URL preview: postgresql://postgres:...
[Database] DATABASE_URL hostname: [hostname]
[Database] DATABASE_URL port: 5432
[Database] Prisma Client initialized successfully
[Database] Successfully connected to database
=== Server running on 0.0.0.0:[porta] ===
```

---

## 🐛 Problemas Comuns

### DATABASE_URL vazia ou malformada

**Sintoma:** `Can't reach database server at :5432`

**Solução:** Verifique se `DATABASE_URL` está completa com hostname

### CORS bloqueando requisições

**Sintoma:** `Not allowed by CORS`

**Solução:** Adicione URL do frontend em `CORS_ORIGINS`

### JWT_SECRET muito curto

**Sintoma:** `JWT_SECRET must be at least 32 characters`

**Solução:** Use chave com pelo menos 32 caracteres

---

## 📚 Referências

- **Correção Database:** `CORRIGIR_DATABASE_CONNECTION.md`
- **Correção CORS:** `CORRIGIR_CORS_PRODUCAO.md`
- **Deploy Render:** `DEPLOY_RENDER.md`

---

**Após configurar todas as variáveis, a API deve funcionar corretamente!** 🎉
