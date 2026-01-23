# 🔧 Atualizar .env para Docker

## Problema

O arquivo `.env` ainda está configurado para Supabase, mas você quer usar Docker.

## Solução Rápida

### Opção 1: Substituir completamente (Recomendado)

```bash
# Fazer backup do .env atual
cp .env .env.supabase.backup

# Criar novo .env para Docker
cat > .env << 'EOF'
# Database (PostgreSQL via Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lia360?schema=public
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/lia360?schema=public

# Redis (via Docker)
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=local-dev-secret-key-min-32-chars-required-here-for-jwt
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# API
API_PORT=3001
API_URL=http://localhost:3001

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# CORS
CORS_ORIGINS=http://localhost:3000

NODE_ENV=development

# Supabase (deixe vazio para usar Docker)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
EOF
```

### Opção 2: Editar manualmente

Edite o arquivo `.env` e substitua as linhas `DATABASE_URL` e `REDIS_URL`:

```env
# Antes (Supabase)
DATABASE_URL=postgresql://postgres.doewttvwknkhjzhzceub:...
DIRECT_URL=postgresql://postgres.doewttvwknkhjzhzceub:...
REDIS_URL=

# Depois (Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lia360?schema=public
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/lia360?schema=public
REDIS_URL=redis://localhost:6379
```

## Depois de Atualizar

### 1. Certifique-se que Docker está rodando

```bash
docker-compose ps
```

Deve mostrar `lia360-postgres` e `lia360-redis` como `Up (healthy)`

### 2. Criar tabelas no banco Docker

```bash
# Gerar Prisma Client (se ainda não fez)
npm run db:generate

# Aplicar schema ao banco Docker
npm run db:push
```

### 3. Reiniciar API

```bash
# Parar API atual (Ctrl+C)
# Reiniciar
npm run api:dev
```

### 4. Testar Registro

Acesse `http://localhost:3000/register` e tente criar uma conta.

**Dados de teste:**
- Nome: João Silva
- Email: joao@teste.com
- Senha: Senha123 (min 8 chars, com maiúscula, minúscula e número)
- Workspace: Meu Workspace

## Verificar se Está Funcionando

### Testar Conexão com Banco

```bash
# Verificar tabelas
docker exec lia360-postgres psql -U postgres -d lia360 -c "\dt"

# Deve listar todas as tabelas criadas
```

### Testar API

```bash
# Health check
curl http://localhost:3001/health

# Testar registro (via curl)
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@teste.com",
    "password": "Senha123",
    "fullName": "Teste User",
    "workspaceName": "Meu Workspace"
  }'
```

## Erro 400 no Registro?

Se ainda receber erro 400, verifique:

1. **Senha atende requisitos:**
   - Mínimo 8 caracteres
   - Pelo menos 1 letra maiúscula
   - Pelo menos 1 letra minúscula
   - Pelo menos 1 número

2. **Campos obrigatórios:**
   - `email`: email válido
   - `password`: conforme regras acima
   - `fullName`: mínimo 2 caracteres
   - `workspaceName`: mínimo 2 caracteres

3. **Banco tem tabelas criadas:**
   ```bash
   npm run db:push
   ```

4. **Logs da API:** Verifique os logs para ver o erro específico
