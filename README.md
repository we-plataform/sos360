# SOS 360 - Plataforma de Prospecção Outbound

Sistema completo de prospecção outbound que permite importar, gerenciar, engajar e converter leads das principais redes sociais.

## Stack Tecnológico

- **Monorepo**: Turborepo
- **Backend**: Node.js + Express + Prisma + Socket.io
- **Frontend**: Next.js 14 + Tailwind CSS + TanStack Query
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis (opcional, fallback para memória)
- **Extension**: Chrome Manifest V3

## Estrutura do Projeto

```
sos360/
├── apps/
│   ├── api/           # Backend Express
│   ├── web/           # Frontend Next.js
│   └── extension/     # Chrome Extension
├── packages/
│   ├── database/      # Prisma schema + Supabase client
│   └── shared/        # Types, utils, constants
├── docs/
│   └── architecture/  # Documentação técnica
└── docker-compose.yml # Apenas Redis (banco no Supabase)
```

## Pré-requisitos

- Node.js 20+
- npm 9+
- Docker Desktop (recomendado) ou conta no Supabase

### Opção 1: Docker (Recomendado para desenvolvimento local)
- ✅ Funciona offline
- ✅ Ambiente isolado
- ✅ Controle total

### Opção 2: Supabase (Para produção/cloud)
- ✅ Managed service
- ✅ Sem instalação local

## Setup Rápido

### Opção A: Docker (Recomendado) 🐳

#### 1. Iniciar PostgreSQL e Redis

```bash
# Iniciar containers
docker-compose up -d

# Verificar se estão rodando
docker-compose ps
```

#### 2. Configurar variáveis de ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example.local .env

# Editar .env se necessário (já está configurado para Docker)
```

#### 3. Instalar dependências e configurar banco

```bash
# Instalar dependências
npm install

# Gerar Prisma Client
npm run db:generate

# Criar tabelas no banco Docker
npm run db:push
```

#### 4. Iniciar aplicação

```bash
# Iniciar API e Web simultaneamente
npm run dev

# Ou iniciar separadamente:
npm run api:dev    # API em http://localhost:3001
npm run web:dev    # Web em http://localhost:3000
```

📚 **Documentação completa:** Veja [`DOCKER_SETUP.md`](DOCKER_SETUP.md)

---

### Opção B: Supabase ☁️

#### 1. Configurar Supabase

1. Crie um projeto no [Supabase Dashboard](https://app.supabase.com)
2. Vá em **Settings > Database** para obter as credenciais
3. Copie o arquivo de exemplo e configure:

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais do Supabase:

```env
# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key

# Database URLs (encontre em Settings > Database > Connection String)
DATABASE_URL=postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres

# JWT (pode usar a service key do Supabase)
JWT_SECRET=sua-service-key-ou-outro-secret
```

### 3. Configurar banco de dados

```bash
# Gerar cliente Prisma
npm run db:generate

# Aplicar schema ao Supabase
npm run db:push
```

### 4. Iniciar em desenvolvimento

```bash
# Iniciar API e Web simultaneamente
npm run dev

# Ou iniciar separadamente:
npm run api:dev    # API em http://localhost:3001
npm run web:dev    # Web em http://localhost:3000
```

## Redis (Opcional)

O Redis é usado para cache e rate limiting, mas o sistema funciona sem ele usando armazenamento em memória.

### Opção 1: Usar Upstash (Redis serverless gratuito)

1. Crie uma conta em [upstash.com](https://upstash.com)
2. Crie um banco Redis
3. Adicione a URL no `.env`:

```env
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
```

### Opção 2: Redis local com Docker

```bash
docker-compose up redis -d
```

### Opção 3: Sem Redis

Simplesmente não configure `REDIS_URL` - o sistema usará armazenamento em memória automaticamente.

## Extensão Chrome

### Carregar extensão em modo desenvolvedor

1. Abra `chrome://extensions`
2. Ative "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `apps/extension`

## Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia todos os apps em desenvolvimento
npm run build            # Build de todos os pacotes

# Database
npm run db:generate      # Gera cliente Prisma
npm run db:push          # Aplica schema ao banco
npm run db:migrate       # Cria e aplica migrations
npm run db:studio        # Abre Prisma Studio

# Apps individuais
npm run api:dev          # Inicia apenas a API
npm run web:dev          # Inicia apenas o frontend

# Linting e formatação
npm run lint             # Executa linter
npm run format           # Formata código com Prettier
```

## Verificar conexão com Supabase

Após configurar, teste a conexão:

```bash
# Abrir Prisma Studio (conecta ao Supabase)
npm run db:studio
```

Se abrir corretamente, a conexão está funcionando!

## API Endpoints

A documentação completa da API está em `/docs/architecture/API-SPEC.md`.

### Principais endpoints:

- `POST /api/v1/auth/register` - Criar conta
- `POST /api/v1/auth/login` - Fazer login
- `GET /api/v1/leads` - Listar leads
- `POST /api/v1/leads/import` - Importar leads
- `GET /api/v1/conversations` - Listar conversas
- `GET /api/v1/analytics/overview` - Métricas do dashboard

## Funcionalidades MVP

- [x] Autenticação JWT
- [x] CRUD de leads
- [x] Importação de leads via extensão
- [x] Sistema de tags
- [x] Inbox unificado de conversas
- [x] Analytics básico
- [x] Extensão Chrome (Instagram, Facebook, LinkedIn)
- [x] Integração com Supabase

## Documentação

- [Arquitetura](docs/architecture/ARCHITECTURE.md)
- [Diagramas C4](docs/architecture/C4-DIAGRAMS.md)
- [Especificação da API](docs/architecture/API-SPEC.md)
- [Modelo de Dados](docs/architecture/DATA-MODEL.md)
- [Segurança](docs/architecture/SECURITY.md)

## Deploy

### API (Render, Railway, Fly.io)

```bash
# Build
npm run build --workspace=@sos360/api

# Start
npm run start --workspace=@sos360/api
```

### Frontend (Vercel)

```bash
# Deploy para Vercel
cd apps/web
vercel
```

## Licença

Proprietary - Todos os direitos reservados.
