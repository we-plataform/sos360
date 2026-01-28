# Deploy da API Lia360 para Produção

Este guia explica como fazer deploy da API em produção para que o frontend na Vercel possa se conectar.

## ⚠️ Antes de Começar

Você precisa:

- ✅ Frontend já deployado na Vercel
- ✅ URL do frontend (ex: `https://seu-app.vercel.app`)
- ✅ Credenciais do Supabase (DATABASE_URL, DIRECT_URL)
- ✅ Uma conta em uma plataforma de deploy (Railway, Render, ou Fly.io)

---

## 📋 Variáveis de Ambiente Necessárias

Antes de fazer deploy, prepare estas variáveis:

```env
# Ambiente
NODE_ENV=production
PORT=3001  # A plataforma pode sobrescrever isso

# Database (Supabase)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# JWT
JWT_SECRET=sua-chave-secreta-com-pelo-menos-32-caracteres
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS - IMPORTANTE: Adicione a URL do seu frontend Vercel
CORS_ORIGINS=https://seu-app.vercel.app,https://seu-app-git-*.vercel.app,chrome-extension://*

# Redis (Opcional)
REDIS_URL=rediss://...

# Supabase (Opcional)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key
```

**Nota sobre CORS_ORIGINS:**

- Adicione a URL do frontend na Vercel
- Inclua padrões wildcard do Vercel: `https://seu-app-git-*.vercel.app`
- Mantenha `chrome-extension://*` para a extensão funcionar

---

## 🚀 Opção 1: Railway (Recomendado - Mais Fácil)

Railway é a opção mais simples para monorepos.

### 1. Criar conta no Railway

1. Acesse [railway.app](https://railway.app)
2. Faça login com GitHub
3. Crie um novo projeto

### 2. Conectar repositório

1. Clique em "New Project"
2. Selecione "Deploy from GitHub repo"
3. Escolha o repositório `lia360`

### 3. Configurar serviço

1. Railway detecta o monorepo automaticamente
2. Selecione o **Root Directory**: `/apps/api`
3. Ou use o botão "Add Service" > "GitHub Repo" > Configure:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npm run build --workspace=@lia360/api`
   - **Start Command**: `npm run start --workspace=@lia360/api`

### 4. Configurar variáveis de ambiente

No Railway, vá em "Variables" e adicione todas as variáveis listadas acima.

### 5. Deploy

Railway faz deploy automaticamente após cada push no GitHub. A URL será algo como:

```
https://lia360-api-production.up.railway.app
```

### 6. Obter URL e atualizar frontend

1. Copie a URL gerada pelo Railway
2. No **Vercel**, vá em Settings > Environment Variables
3. Adicione/atualize:
   ```
   NEXT_PUBLIC_API_URL=https://lia360-api-production.up.railway.app
   ```
4. Faça redeploy do frontend na Vercel

---

## 🌐 Opção 2: Render

Render oferece plano gratuito limitado.

### 1. Criar conta no Render

1. Acesse [render.com](https://render.com)
2. Faça login com GitHub
3. Crie uma conta (free tier disponível)

### 2. Criar novo Web Service

1. Clique em "New" > "Web Service"
2. Conecte o repositório `lia360`
3. Configure:
   - **Name**: `lia360-api`
   - **Root Directory**: `apps/api`
   - **Environment**: `Node`
   - **Build Command**:
     ```bash
     npm install && npm run build --workspace=@lia360/api
     ```
   - **Start Command**:
     ```bash
     npm run start --workspace=@lia360/api
     ```
   - **Instance Type**: Free (ou pago para mais recursos)

### 3. Configurar variáveis de ambiente

No painel do Render, vá em "Environment" e adicione todas as variáveis.

### 4. Deploy

Render faz deploy automaticamente. A URL será:

```
https://lia360-api.onrender.com
```

**Nota:** No plano gratuito, o serviço "dorme" após 15min de inatividade. A primeira requisição pode demorar ~30s para acordar.

### 5. Atualizar frontend Vercel

Adicione a variável no Vercel:

```
NEXT_PUBLIC_API_URL=https://lia360-api.onrender.com
```

---

## ✈️ Opção 3: Fly.io

Fly.io oferece boa performance e suporta Docker.

### 1. Instalar Fly CLI

```bash
# macOS
brew install flyctl

# Ou via script
curl -L https://fly.io/install.sh | sh
```

### 2. Criar conta e fazer login

```bash
flyctl auth login
```

### 3. Criar app

```bash
cd apps/api
flyctl launch
```

Responda as perguntas:

- App name: `lia360-api` (ou o que preferir)
- Region: escolha próximo ao Brasil (ex: `gru`)
- PostgreSQL: Não (você já usa Supabase)
- Redis: Não (opcional)

### 4. Criar arquivo `fly.toml`

O Fly.io pode gerar automaticamente, mas você pode ajustar:

```toml
app = "lia360-api"
primary_region = "gru"

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  NODE_ENV = "production"
  PORT = "3001"

[[services]]
  internal_port = 3001
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.http_checks]]
    interval = "10s"
    timeout = "2s"
    grace_period = "5s"
    method = "GET"
    path = "/health"
```

### 5. Configurar variáveis de ambiente

```bash
# Configurar variáveis uma por uma
flyctl secrets set DATABASE_URL="postgresql://..."
flyctl secrets set JWT_SECRET="sua-chave-secreta"
flyctl secrets set CORS_ORIGINS="https://seu-app.vercel.app,chrome-extension://*"

# Ou todas de uma vez via arquivo
flyctl secrets import < .env.production
```

### 6. Deploy

```bash
# A partir do root do projeto
flyctl deploy --config apps/api/fly.toml
```

A URL será:

```
https://lia360-api.fly.dev
```

### 7. Atualizar frontend Vercel

```
NEXT_PUBLIC_API_URL=https://lia360-api.fly.dev
```

---

## 🔧 Configuração Final no Frontend (Vercel)

Após fazer deploy da API:

1. Acesse o painel da Vercel
2. Vá em **Settings** > **Environment Variables**
3. Adicione/atualize:
   ```
   NEXT_PUBLIC_API_URL=https://sua-api-url.com
   ```
4. Faça redeploy do frontend:
   - Vá em **Deployments**
   - Clique nos três pontos do último deployment
   - Selecione **Redeploy**

---

## ✅ Testar Deploy

Após configurar tudo, teste se está funcionando:

### 1. Testar health check

```bash
curl https://sua-api-url.com/health
```

Deve retornar:

```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

### 2. Testar CORS

No console do navegador (no frontend Vercel), faça uma requisição:

```javascript
fetch("https://sua-api-url.com/api/v1/auth/me", {
  headers: {
    Authorization: "Bearer seu-token",
  },
});
```

Não deve ter erros de CORS.

### 3. Verificar logs

- **Railway**: Aba "Deployments" > Selecione deployment > Ver logs
- **Render**: Aba "Logs"
- **Fly.io**: `flyctl logs -a lia360-api`

---

## 🐛 Troubleshooting

### Erro de CORS

**Problema:** `Access-Control-Allow-Origin` error

**Solução:**

1. Verifique se `CORS_ORIGINS` inclui a URL exata do frontend
2. No Vercel, URLs de preview podem ser diferentes - adicione wildcards:
   ```
   CORS_ORIGINS=https://seu-app.vercel.app,https://*.vercel.app,chrome-extension://*
   ```

### Erro de conexão com banco

**Problema:** `Error connecting to database`

**Solução:**

1. Verifique se `DATABASE_URL` e `DIRECT_URL` estão corretos
2. No Supabase, certifique-se de que o banco permite conexões externas
3. Verifique se as credenciais estão no formato correto

### API não responde

**Problema:** Timeout ou 502

**Solução:**

1. Verifique logs na plataforma de deploy
2. Confirme que o `PORT` está configurado (algumas plataformas injetam automaticamente)
3. No Render free tier, aguarde ~30s na primeira requisição após dormir

### Build falha

**Problema:** Erro no build

**Solução:**

1. Certifique-se de que o build funciona localmente:
   ```bash
   npm run build --workspace=@lia360/api
   ```
2. Verifique se todas as dependências estão no `package.json`
3. Monorepos podem precisar de configuração especial - use `--workspace`

---

## 📊 Comparação das Plataformas

| Plataforma  | Free Tier      | Performance | Facilidade | Recomendado Para         |
| ----------- | -------------- | ----------- | ---------- | ------------------------ |
| **Railway** | $5 crédito/mês | ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐ | Início rápido, monorepos |
| **Render**  | Limitado       | ⭐⭐⭐      | ⭐⭐⭐⭐   | Testes, desenvolvimento  |
| **Fly.io**  | 3 apps grátis  | ⭐⭐⭐⭐⭐  | ⭐⭐⭐     | Produção, escalabilidade |

**Recomendação:** Comece com **Railway** pela facilidade, depois considere **Fly.io** para produção com mais tráfego.

---

## 🔐 Segurança

⚠️ **IMPORTANTE:**

- NUNCA commite arquivos `.env` no Git
- Use variáveis de ambiente da plataforma de deploy
- `JWT_SECRET` deve ter pelo menos 32 caracteres e ser aleatório
- Ative HTTPS em todas as plataformas (geralmente automático)

---

## 📚 Próximos Passos

Após deploy bem-sucedido:

1. ✅ Configure monitoramento (opcional)
2. ✅ Configure domínio customizado (opcional)
3. ✅ Configure CI/CD para deploy automático
4. ✅ Documente a URL da API para sua equipe

---

**Precisa de ajuda?** Verifique os logs na plataforma de deploy ou abra uma issue no repositório.
