# Setup Definitivo do Railway - Lia360 API

## Variáveis de Ambiente Obrigatórias

Configure estas variáveis no Railway (Settings > Variables):

### 1. DATABASE_URL (OBRIGATÓRIO)
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```
- Esta é a URL de conexão do PostgreSQL
- Se você está usando o Supabase, use a "Connection String" do painel do Supabase
- Formato: `postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`

### 2. JWT_SECRET (OBRIGATÓRIO)
```
JWT_SECRET=sua_chave_secreta_com_pelo_menos_32_caracteres_aqui
```
- Deve ter pelo menos 32 caracteres
- Use uma string aleatória e segura
- Exemplo: `openssl rand -base64 48` para gerar uma

### 3. NODE_ENV (RECOMENDADO)
```
NODE_ENV=production
```

### 4. CORS_ORIGINS (OBRIGATÓRIO)
```
CORS_ORIGINS=https://lia360-web-sigma.vercel.app
```
- URL do seu frontend na Vercel
- Para múltiplas origens: `https://app1.com,https://app2.com`

### 5. PORT (OPCIONAL)
```
PORT=8080
```
- O Railway geralmente injeta isso automaticamente
- Valor padrão: 3001 (será sobrescrito pelo Railway)

### 6. REDIS_URL (OPCIONAL)
```
REDIS_URL=
```
- Deixe vazio se não estiver usando Redis
- A API funciona sem Redis (usa memória)

## Verificação

Após configurar as variáveis, o deploy deve mostrar nos logs:

```
=== Lia360 API Starting ===
Node version: v20.x.x
Environment: production
PORT env: 8080
DATABASE_URL set: true
JWT_SECRET set: true
[Config] Validating environment variables...
[Config] Environment validated successfully
[Config] NODE_ENV: production
[Config] PORT: 8080
[Database] Initializing Prisma Client...
[Database] DATABASE_URL set: true
[Database] Prisma Client initialized successfully
=== Server running on 0.0.0.0:8080 ===
Server is ready to accept connections
```

## Se Ainda Houver Erros

### Erro: "DATABASE_URL is required"
- A variável DATABASE_URL não está configurada no Railway
- Verifique se foi adicionada em Settings > Variables

### Erro: "JWT_SECRET must be at least 32 characters"
- O JWT_SECRET está muito curto
- Use uma string com pelo menos 32 caracteres

### Erro: "Application failed to respond" (502)
1. Verifique os Deploy Logs para ver o erro específico
2. Certifique-se de que DATABASE_URL aponta para um banco acessível
3. Verifique se o banco de dados permite conexões externas

### Erro de conexão com banco de dados
- Verifique se a DATABASE_URL está correta
- Certifique-se de que `?sslmode=require` está no final da URL
- Verifique se o IP do Railway está permitido no firewall do banco

## Teste Manual

Após o deploy, teste:

```bash
curl https://SUA-URL.railway.app/health
```

Deve retornar:
```json
{"status":"ok","timestamp":"..."}
```
