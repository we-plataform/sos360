# 🐳 Setup Docker - Lia 360

## Por que usar Docker?

✅ **Funciona offline** - Não depende de internet  
✅ **Ambiente isolado** - Não interfere com outras instalações  
✅ **Reproduzível** - Mesmo ambiente para todos os devs  
✅ **Controle total** - Você controla versões e configurações  
✅ **Gratuito** - Sem limites de uso

## 📋 Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop) instalado e rodando
- Node.js 20+ e npm 9+

## 🚀 Setup Rápido

### 1. Iniciar PostgreSQL e Redis

```bash
# Iniciar containers (PostgreSQL + Redis)
docker-compose up -d

# Verificar se estão rodando
docker-compose ps
```

**Deve mostrar:**

```
NAME                STATUS
lia360-postgres     Up (healthy)
lia360-redis        Up (healthy)
```

### 2. Configurar variáveis de ambiente

```bash
# Copiar arquivo de exemplo local
cp .env.local .env

# Ou criar manualmente (já existe .env.local)
```

O arquivo `.env.local` já tem todas as configurações para Docker!

### 3. Criar banco de dados

```bash
# Gerar Prisma Client
npm run db:generate

# Aplicar schema ao banco Docker
npm run db:push
```

### 4. Iniciar aplicação

```bash
# Terminal 1: API
npm run api:dev

# Terminal 2: Web (opcional)
npm run web:dev
```

## ✅ Verificar se está funcionando

### Testar PostgreSQL

```bash
# Conectar ao banco
docker exec -it lia360-postgres psql -U postgres -d lia360

# Dentro do psql:
\dt  # Listar tabelas
\q   # Sair
```

### Testar Redis

```bash
# Conectar ao Redis
docker exec -it lia360-redis redis-cli

# Dentro do redis-cli:
PING  # Deve retornar PONG
KEYS *  # Listar chaves
exit
```

### Testar API

```bash
# Health check
curl http://localhost:3001/health

# Deve retornar:
# {"status":"ok","timestamp":"..."}
```

## 📝 Comandos Úteis

### Docker Compose

```bash
# Iniciar (em background)
docker-compose up -d

# Parar (mantém dados)
docker-compose stop

# Parar e remover containers (mantém dados)
docker-compose down

# Parar e remover TUDO (apaga dados!)
docker-compose down -v

# Ver logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Ver logs de todos
docker-compose logs -f

# Reiniciar um serviço
docker-compose restart postgres
```

### Acessar containers

```bash
# PostgreSQL shell
docker exec -it lia360-postgres psql -U postgres -d lia360

# Redis CLI
docker exec -it lia360-redis redis-cli

# Bash no container PostgreSQL
docker exec -it lia360-postgres bash

# Bash no container Redis
docker exec -it lia360-redis sh
```

## 🔄 Alternar entre Docker e Supabase

### Usar Docker (local)

Use `.env` com:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lia360
REDIS_URL=redis://localhost:6379
```

### Usar Supabase (produção/cloud)

Use `.env` com:

```env
DATABASE_URL=postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
REDIS_URL=
```

## 🐛 Troubleshooting

### Erro: "port 5432 is already in use"

**Solução:**

```bash
# Parar PostgreSQL local (se tiver)
sudo service postgresql stop  # Linux
brew services stop postgresql  # macOS

# Ou usar porta diferente no docker-compose.yml:
ports:
  - "5433:5432"  # Acesse em localhost:5433
```

### Erro: "port 6379 is already in use"

**Solução:**

```bash
# Parar Redis local (se tiver)
sudo service redis-server stop  # Linux
brew services stop redis  # macOS

# Ou usar porta diferente no docker-compose.yml
```

### Resetar banco de dados

```bash
# Parar containers
docker-compose down -v

# Reiniciar
docker-compose up -d

# Recriar schema
npm run db:push
```

### Ver logs de erro

```bash
# Logs do PostgreSQL
docker-compose logs postgres

# Logs do Redis
docker-compose logs redis

# Logs em tempo real
docker-compose logs -f
```

### Limpar tudo e começar do zero

```bash
# ⚠️ ATENÇÃO: Apaga TODOS os dados!
docker-compose down -v
docker-compose up -d
npm run db:push
```

## 📊 Prisma Studio

```bash
# Abrir interface visual do banco
npm run db:studio
```

Acesse: http://localhost:5555

## 🔐 Credenciais Docker (padrão)

- **PostgreSQL:**
  - Host: `localhost`
  - Port: `5432`
  - User: `postgres`
  - Password: `postgres`
  - Database: `lia360`

- **Redis:**
  - Host: `localhost`
  - Port: `6379`
  - Sem senha (padrão)

> ⚠️ **Importante:** Essas credenciais são apenas para desenvolvimento local. Nunca use em produção!

## 🚀 Próximos Passos

Após configurar Docker:

1. ✅ Docker rodando (`docker-compose ps`)
2. ✅ `.env` configurado (copiado de `.env.local`)
3. ✅ Schema criado (`npm run db:push`)
4. ✅ API rodando (`npm run api:dev`)
5. ✅ Teste: `curl http://localhost:3001/health`

## 📚 Documentação Adicional

- [Docker Compose Docs](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)
