# 🚀 Guia Completo: Deploy da API Lia360 no Render

Este guia detalha passo a passo como fazer deploy da API no Render, incluindo todas as configurações necessárias para um monorepo com workspaces.

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter:

- ✅ Conta no Render ([render.com](https://render.com))
- ✅ Repositório GitHub conectado ao Render
- ✅ Credenciais do Supabase (DATABASE_URL, DIRECT_URL)
- ✅ URL do frontend (se já estiver deployado)
- ✅ Node.js 20+ instalado localmente (para testes)

---

## 🔍 Análise da Estrutura

### Estrutura do Projeto

```
lia360/
├── apps/
│   └── api/          # API principal
├── packages/
│   ├── shared/       # Pacote compartilhado (deve ser buildado primeiro)
│   └── database/     # Pacote com Prisma (deve ser buildado segundo)
└── package.json      # Root com workspaces
```

### Dependências de Build

A API depende de dois pacotes que precisam ser buildados antes:

1. `@lia360/shared` → primeiro
2. `@lia360/database` → segundo (executa `prisma generate`)
3. `@lia360/api` → por último

### Scripts Importantes

- **Build**: `npm run build:api` (do root) ou `npm run build --workspace=@lia360/api` (que executa prebuild automaticamente)
- **Start**: `npm run start --workspace=@lia360/api` (executa `node dist/index.js`)

---

## 📝 Passo 1: Preparar Variáveis de Ambiente

Antes de criar o serviço, prepare todas as variáveis necessárias:

### Variáveis Obrigatórias

```env
# Ambiente
NODE_ENV=production
PORT=3001

# Database (Supabase)
DATABASE_URL=postgresql://usuario:senha@host:porta/database?pgbouncer=true
DIRECT_URL=postgresql://usuario:senha@host:porta/database

# JWT
JWT_SECRET=sua-chave-secreta-com-pelo-menos-32-caracteres-aleatorios
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d

# CORS - IMPORTANTE: Adicione a URL do seu frontend
CORS_ORIGINS=https://seu-app.vercel.app,https://*.vercel.app,chrome-extension://*

# Supabase (Opcional, mas recomendado)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key

# Redis (Opcional - pode ficar vazio se não usar)
REDIS_URL=
```

### ⚠️ Notas Importantes sobre Variáveis

1. **CORS_ORIGINS**:
   - Deve incluir a URL exata do frontend
   - Inclua wildcards do Vercel: `https://*.vercel.app`
   - Mantenha `chrome-extension://*` para a extensão funcionar
   - Separe múltiplas URLs por vírgula

2. **JWT_SECRET**:
   - Mínimo de 32 caracteres
   - Use uma chave aleatória e segura
   - NÃO reutilize outras chaves (como SUPABASE_SERVICE_KEY)

3. **DATABASE_URL vs DIRECT_URL**:
   - `DATABASE_URL`: Use com pgbouncer (porta 6543) para conexões normais
   - `DIRECT_URL`: Use porta 5432 para migrations e operações diretas

---

## 🎯 Passo 2: Criar Web Service no Render

### 2.1 Acessar o Dashboard

1. Acesse [render.com](https://render.com)
2. Faça login com sua conta GitHub
3. Clique em **"New +"** no canto superior direito
4. Selecione **"Web Service"**

### 2.2 Conectar Repositório

1. Se for a primeira vez, autorize o Render a acessar seus repositórios GitHub
2. Selecione o repositório `lia360`
3. Clique em **"Connect"**

### 2.3 Configurar o Serviço

Preencha os seguintes campos:

#### Informações Básicas

- **Name**: `lia360-api` (ou o nome que preferir)
- **Region**: Escolha a região mais próxima (ex: `Oregon (US West)` ou `Frankfurt (EU)` para melhor latência)
- **Branch**: `main` (ou a branch que você usa para produção)
- **Root Directory**: **DEIXE VAZIO** ou use `.` (raiz do projeto)
  - ⚠️ **NÃO** use `apps/api` - isso quebra o monorepo!

#### Configurações de Build e Deploy

- **Environment**: `Node`
- **Build Command**:

  ```bash
  npm install && npm run build:api
  ```

  Ou alternativamente:

  ```bash
  npm install && npm run build --workspace=@lia360/shared && npm run build --workspace=@lia360/database && npm run build --workspace=@lia360/api
  ```

- **Start Command**:
  ```bash
  npm run start --workspace=@lia360/api
  ```

#### Instância

- **Instance Type**:
  - **Free**: Para testes e desenvolvimento (limitações: dorme após 15min, 512MB RAM)
  - **Starter ($7/mês)**: Para produção pequena (nunca dorme, 512MB RAM)
  - **Standard ($25/mês)**: Para produção (nunca dorme, 2GB RAM)

> 💡 **Recomendação**: Comece com **Free** para testes, depois migre para **Starter** em produção.

---

## 🔐 Passo 3: Configurar Variáveis de Ambiente

### 3.1 Adicionar Variáveis no Render

1. No painel do serviço criado, vá em **"Environment"** (menu lateral)
2. Clique em **"Add Environment Variable"**
3. Adicione cada variável uma por uma:

| Chave                      | Valor                                                                  | Obrigatório    |
| -------------------------- | ---------------------------------------------------------------------- | -------------- |
| `NODE_ENV`                 | `production`                                                           | ✅ Sim         |
| `PORT`                     | `3001`                                                                 | ✅ Sim         |
| `DATABASE_URL`             | `postgresql://...`                                                     | ✅ Sim         |
| `DIRECT_URL`               | `postgresql://...`                                                     | ⚠️ Recomendado |
| `JWT_SECRET`               | `sua-chave-32-chars`                                                   | ✅ Sim         |
| `JWT_EXPIRES_IN`           | `15m`                                                                  | ✅ Sim         |
| `REFRESH_TOKEN_EXPIRES_IN` | `30d`                                                                  | ✅ Sim         |
| `CORS_ORIGINS`             | `https://seu-app.vercel.app,https://*.vercel.app,chrome-extension://*` | ✅ Sim         |
| `SUPABASE_URL`             | `https://...supabase.co`                                               | ⚠️ Opcional    |
| `SUPABASE_SERVICE_KEY`     | `sb_secret_...`                                                        | ⚠️ Opcional    |
| `REDIS_URL`                | `rediss://...` ou deixe vazio                                          | ⚠️ Opcional    |

### 3.2 Dica: Importar de Arquivo

Se você tem um arquivo `.env.production`, pode copiar e colar as variáveis diretamente no Render (mas **NUNCA** commite o `.env` no Git!).

---

## 🚀 Passo 4: Fazer o Deploy

### 4.1 Deploy Automático

1. Após configurar tudo, clique em **"Create Web Service"**
2. O Render iniciará automaticamente:
   - Instalação de dependências (`npm install`)
   - Build do projeto (`npm run build:api`)
   - Start do servidor (`npm run start --workspace=@lia360/api`)

### 4.2 Monitorar o Deploy

1. Na aba **"Logs"**, acompanhe o progresso:
   - ✅ Instalação de dependências
   - ✅ Build dos pacotes (`@lia360/shared`, `@lia360/database`, `@lia360/api`)
   - ✅ Geração do Prisma Client (`prisma generate`)
   - ✅ Compilação TypeScript
   - ✅ Inicialização do servidor

### 4.3 Verificar Sucesso

Procure por estas mensagens nos logs:

```
✓ Server running on 0.0.0.0:3001
✓ Environment: production
✓ CORS origins: https://seu-app.vercel.app, ...
```

Se aparecer algo como:

```
✗ Error: @prisma/client did not initialize yet
```

Veja a seção de **Troubleshooting** abaixo.

---

## 🌐 Passo 5: Obter URL e Configurar Frontend

### 5.1 Obter URL da API

1. No painel do Render, vá em **"Settings"**
2. Role até **"Public Networking"**
3. Copie a **"Public URL"** (algo como `https://lia360-api.onrender.com`)

### 5.2 Atualizar Frontend (Vercel)

Se você tem um frontend na Vercel:

1. Acesse o painel da Vercel
2. Vá em **Settings** > **Environment Variables**
3. Adicione/atualize:

```env
NEXT_PUBLIC_API_URL=https://lia360-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://lia360-api.onrender.com
API_URL=https://lia360-api.onrender.com
```

> ⚠️ **Importante**: Use `wss://` (WebSocket seguro) para `NEXT_PUBLIC_WS_URL`, não `ws://`

4. Faça um **redeploy** do frontend

### 5.3 Atualizar CORS_ORIGINS (se necessário)

Se você adicionou uma nova URL do frontend, atualize `CORS_ORIGINS` no Render:

1. Vá em **Environment** no Render
2. Edite `CORS_ORIGINS`
3. Adicione a nova URL: `https://sua-url.vercel.app,https://*.vercel.app,chrome-extension://*`
4. O Render fará redeploy automaticamente

---

## ✅ Passo 6: Testar o Deploy

### 6.1 Health Check

Teste se a API está respondendo:

```bash
curl https://lia360-api.onrender.com/health
```

Deve retornar:

```json
{ "status": "ok", "timestamp": "2025-01-15T10:30:00.000Z" }
```

### 6.2 Testar Endpoint Root

```bash
curl https://lia360-api.onrender.com/
```

Deve retornar:

```json
{
  "name": "Lia360 API",
  "version": "0.0.1",
  "status": "running",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 6.3 Testar CORS

No console do navegador (no frontend), teste:

```javascript
fetch("https://lia360-api.onrender.com/api/v1/auth/me", {
  headers: {
    Authorization: "Bearer seu-token",
  },
})
  .then((r) => r.json())
  .then(console.log)
  .catch(console.error);
```

Não deve ter erros de CORS.

### 6.4 Verificar WebSocket

Se você usa Socket.io, teste a conexão:

```javascript
import io from "socket.io-client";

const socket = io("https://lia360-api.onrender.com", {
  auth: { token: "Bearer seu-token" },
});

socket.on("connect", () => {
  console.log("✅ WebSocket conectado!");
});
```

---

## 🐛 Troubleshooting

### Problema 1: Build Falha - Prisma Client não inicializado

**Erro:**

```
Error: @prisma/client did not initialize yet. Please run "prisma generate"
```

**Solução:**

1. Verifique se o **Root Directory** está vazio ou como `.` (não `apps/api`)
2. Verifique se o **Build Command** inclui o build do `@lia360/database`:
   ```bash
   npm install && npm run build:api
   ```
3. Verifique os logs do build - deve aparecer:
   ```
   > @lia360/database@0.0.1 prebuild
   > prisma generate --schema=packages/database/prisma/schema.prisma
   ```

### Problema 2: Build Falha - Workspace não encontrado

**Erro:**

```
npm ERR! Could not resolve workspace: @lia360/shared
```

**Solução:**

1. Certifique-se de que o **Root Directory** está vazio (raiz do projeto)
2. O Render deve executar `npm install` na raiz, não em `apps/api`

### Problema 3: Servidor não inicia - Porta em uso

**Erro:**

```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solução:**

1. O Render injeta automaticamente a variável `PORT` - não precisa definir manualmente
2. Remova `PORT=3001` das variáveis de ambiente OU deixe como está (o código usa `process.env.PORT` primeiro)
3. O código já está preparado para usar `process.env.PORT` que o Render injeta

### Problema 4: CORS Error no Frontend

**Erro:**

```
Access to fetch at 'https://lia360-api.onrender.com/...' from origin 'https://seu-app.vercel.app' has been blocked by CORS policy
```

**Solução:**

1. Verifique se `CORS_ORIGINS` inclui a URL exata do frontend
2. Inclua wildcards do Vercel: `https://*.vercel.app`
3. Formato correto: `https://seu-app.vercel.app,https://*.vercel.app,chrome-extension://*`
4. Após atualizar, aguarde o redeploy automático

### Problema 5: Serviço "dorme" no Free Tier

**Sintoma:** Primeira requisição demora ~30 segundos

**Explicação:** No plano Free, o Render coloca o serviço em "sleep" após 15 minutos de inatividade.

**Soluções:**

1. **Aguardar**: A primeira requisição após dormir leva ~30s para "acordar"
2. **Upgrade**: Migre para Starter ($7/mês) que nunca dorme
3. **Keep-alive**: Configure um cron job externo para fazer requisições periódicas (não recomendado)

### Problema 6: Erro de Conexão com Banco

**Erro:**

```
Error connecting to database
```

**Solução:**

1. Verifique se `DATABASE_URL` está correto (formato PostgreSQL)
2. Verifique se o Supabase permite conexões externas
3. Teste a conexão localmente com as mesmas credenciais
4. Verifique se há firewall bloqueando (geralmente não é o caso no Supabase)

### Problema 7: Build demora muito

**Sintoma:** Build leva mais de 10 minutos

**Solução:**

1. Verifique se não está instalando dependências desnecessárias
2. O Render cacheia `node_modules` entre builds - pode melhorar após o primeiro deploy
3. Considere usar `.dockerignore` ou otimizar dependências

---

## 📊 Comparação: Render vs Railway vs Fly.io

| Característica | Render Free | Render Starter | Railway        | Fly.io        |
| -------------- | ----------- | -------------- | -------------- | ------------- |
| **Custo**      | Grátis      | $7/mês         | $5 crédito/mês | 3 apps grátis |
| **Sleep**      | Sim (15min) | Não            | Não            | Não           |
| **RAM**        | 512MB       | 512MB          | 512MB          | 256MB         |
| **Build Time** | ~5-10min    | ~5-10min       | ~3-5min        | ~2-4min       |
| **Facilidade** | ⭐⭐⭐⭐    | ⭐⭐⭐⭐       | ⭐⭐⭐⭐⭐     | ⭐⭐⭐        |
| **Monorepo**   | ✅ Sim      | ✅ Sim         | ✅ Sim         | ⚠️ Com Docker |

**Recomendação:**

- **Testes**: Render Free
- **Produção pequena**: Render Starter ($7/mês)
- **Produção média**: Railway ($5 crédito + uso)
- **Produção grande**: Fly.io ou Railway pago

---

## 🔒 Segurança

### Checklist de Segurança

- [ ] `JWT_SECRET` tem pelo menos 32 caracteres e é aleatório
- [ ] `DATABASE_URL` não está commitado no Git
- [ ] `SUPABASE_SERVICE_KEY` não está commitado
- [ ] `CORS_ORIGINS` não inclui `*` (exceto para `chrome-extension://*`)
- [ ] HTTPS está ativado (automático no Render)
- [ ] Variáveis sensíveis estão apenas no Render (não no código)

### Boas Práticas

1. **Rotacione secrets regularmente**: Especialmente `JWT_SECRET`
2. **Use diferentes secrets por ambiente**: Dev, Staging, Production
3. **Monitore logs**: Configure alertas para erros críticos
4. **Backup do banco**: Configure backups automáticos no Supabase

---

## 📈 Monitoramento e Logs

### Visualizar Logs no Render

1. No painel do serviço, vá em **"Logs"**
2. Os logs são em tempo real
3. Você pode filtrar por nível (Info, Warning, Error)

### Logs Importantes para Monitorar

- ✅ `Server running on 0.0.0.0:PORT`
- ✅ `Environment: production`
- ⚠️ `Error connecting to database`
- ⚠️ `CORS error`
- ⚠️ `JWT validation failed`

### Configurar Alertas (Opcional)

No Render, você pode configurar:

- Email notifications para deploy failures
- Webhooks para integrações externas

---

## 🔄 Deploy Contínuo (CI/CD)

O Render faz deploy automático quando você faz push para a branch configurada (geralmente `main`).

### Fluxo Automático

1. Você faz push para `main` no GitHub
2. Render detecta a mudança
3. Executa `npm install`
4. Executa `Build Command`
5. Executa `Start Command`
6. Serviço fica online

### Deploy Manual

Se precisar fazer deploy manual:

1. No painel do Render, vá em **"Manual Deploy"**
2. Selecione a branch/commit desejado
3. Clique em **"Deploy"**

---

## 📝 Checklist Final

Antes de considerar o deploy completo:

- [ ] ✅ Serviço criado no Render
- [ ] ✅ Root Directory configurado como `.` (raiz)
- [ ] ✅ Build Command configurado: `npm install && npm run build:api`
- [ ] ✅ Start Command configurado: `npm run start --workspace=@lia360/api`
- [ ] ✅ Todas as variáveis de ambiente configuradas
- [ ] ✅ `CORS_ORIGINS` inclui URL do frontend
- [ ] ✅ Deploy bem-sucedido (ver logs)
- [ ] ✅ Health check retorna `{"status":"ok"}`
- [ ] ✅ Frontend atualizado com URL da API
- [ ] ✅ CORS funcionando (testado no navegador)
- [ ] ✅ WebSocket funcionando (se aplicável)
- [ ] ✅ Autenticação funcionando (teste login)

---

## 🎉 Próximos Passos

Após deploy bem-sucedido:

1. **Configure domínio customizado** (opcional):
   - No Render, vá em **Settings** > **Custom Domain**
   - Adicione seu domínio (ex: `api.lia360.com`)

2. **Configure monitoramento**:
   - Integre com serviços como Sentry, Datadog, etc.

3. **Configure backups**:
   - Configure backups automáticos no Supabase

4. **Documente para equipe**:
   - Compartilhe a URL da API
   - Documente variáveis de ambiente necessárias

---

## 📚 Referências

- [Documentação Render](https://render.com/docs)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Render Web Services](https://render.com/docs/web-services)

---

**Precisa de ajuda?** Verifique os logs no Render ou consulte a documentação oficial.
