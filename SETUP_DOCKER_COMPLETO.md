# 🐳 Setup Completo Docker - SOS 360

## ⚡ Passos Rápidos

### 1. Atualizar `.env` para Docker

O `.env` atual está configurado para Supabase. Atualize para Docker:

```bash
# Editar .env manualmente OU executar:

cat > .env << 'EOF'
# Database (PostgreSQL via Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sos360?schema=public
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/sos360?schema=public

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

### 2. Verificar Docker está rodando

```bash
docker-compose ps
```

Deve mostrar `sos360-postgres` e `sos360-redis` como `Up (healthy)`

Se não estiver rodando:

```bash
docker-compose up -d
```

### 3. Criar Tabelas no Banco Docker

```bash
# Gerar Prisma Client
npm run db:generate

# Criar todas as tabelas no banco Docker
npm run db:push
```

### 4. Reiniciar API

```bash
# Parar API atual (se estiver rodando) - Ctrl+C
# Reiniciar
npm run api:dev
```

### 5. Testar Registro

Acesse `http://localhost:3000/register` e crie uma conta.

**Dados de exemplo:**
- Nome: João Silva
- Email: joao@teste.com
- Senha: `Senha123` (8+ chars, com maiúscula, minúscula e número)
- Workspace: Meu Workspace

## ✅ Checklist

- [ ] `.env` atualizado para Docker
- [ ] Docker rodando (`docker-compose ps`)
- [ ] Tabelas criadas (`npm run db:push`)
- [ ] API reiniciada (`npm run api:dev`)
- [ ] Testado registro (`http://localhost:3000/register`)

## 🐛 Erro 400 no Registro?

### Verificar Requisitos da Senha

A senha deve ter:
- ✅ Mínimo 8 caracteres
- ✅ Pelo menos 1 letra maiúscula (A-Z)
- ✅ Pelo menos 1 letra minúscula (a-z)
- ✅ Pelo menos 1 número (0-9)

**Exemplos válidos:**
- `Senha123`
- `MinhaSenha123`
- `Teste@2024`

**Exemplos inválidos:**
- `senha123` (sem maiúscula)
- `SENHA123` (sem minúscula)
- `SenhaABC` (sem número)
- `Senh123` (menos de 8 caracteres)

### Verificar Tabelas Criadas

```bash
# Verificar tabelas no banco
docker exec sos360-postgres psql -U postgres -d sos360 -c "\dt"

# Deve listar todas as tabelas:
# - workspaces
# - users
# - leads
# - etc...
```

Se não tiver tabelas:

```bash
npm run db:push
```

### Verificar Logs da API

Os logs da API mostram o erro específico. Verifique:

```bash
# Na saída da API, procure por:
# - "Validation Failed" - erro de validação
# - "Error occurred" - outro tipo de erro
```

## 📚 Documentação Adicional

- **Docker Setup:** [`DOCKER_SETUP.md`](DOCKER_SETUP.md)
- **Início Rápido:** [`INICIO_RAPIDO.md`](INICIO_RAPIDO.md)
