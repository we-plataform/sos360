# Arquitetura do Sistema - SnapLeads Clone (MVP 3 meses)

## 1. Visão Geral

Este documento descreve a arquitetura técnica do sistema de prospecção outbound, cobrindo os componentes principais, fluxos de dados, decisões técnicas e padrões adotados para o MVP de 3 meses.

### 1.1 Objetivos do MVP

| Mês | Entregáveis |
|-----|-------------|
| 1 | Fundação: infraestrutura, auth, CRUD leads, importação CSV |
| 2 | Extensão Chrome (Instagram/Facebook/LinkedIn), sistema de tags |
| 3 | Inbox unificado, templates de mensagens, automação simples, analytics básico |

### 1.2 Princípios Arquiteturais

- **Simplicidade**: priorizar soluções comprovadas sobre complexidade prematura
- **Escalabilidade horizontal**: componentes stateless quando possível
- **Separação de responsabilidades**: cada serviço com escopo bem definido
- **API-first**: toda funcionalidade exposta via API REST
- **Observabilidade**: logs estruturados e métricas desde o início

---

## 2. Stack Tecnológico

### 2.1 Decisões Técnicas

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| **Monorepo** | Turborepo | Builds incrementais, cache compartilhado, gestão simplificada |
| **Backend** | Node.js 20 + Express | Ecossistema maduro, performance adequada, equipe familiarizada |
| **ORM** | Prisma | Type-safety, migrations, DX excelente |
| **Banco Relacional** | Neon (PostgreSQL) | ACID, JSONB, serverless, extensões |
| **Cache/Queue** | Redis 7 (opcional) | In-memory rápido, fallback para memória |
| **Frontend** | Next.js 14 (App Router) | SSR/SSG, RSC, ecossistema React |
| **UI** | Tailwind CSS + shadcn/ui | Customizável, componentes acessíveis |
| **State** | Zustand + TanStack Query | Leve, cache de servidor integrado |
| **Realtime** | Socket.io | Fallback automático, rooms, reconexão |
| **Extensão** | Chrome Manifest V3 | Padrão atual, service workers |
| **Infra** | Docker + Docker Compose | Desenvolvimento local consistente |

### 2.2 Estrutura do Monorepo

```
sos360/
├── apps/
│   ├── web/                 # Next.js frontend
│   ├── api/                 # Express backend
│   └── extension/           # Chrome extension
├── packages/
│   ├── database/            # Prisma schema e client
│   ├── shared/              # Types, utils, constants
│   └── ui/                  # Componentes compartilhados (shadcn)
├── docs/                    # Documentação
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## 3. Componentes do Sistema

### 3.1 Diagrama de Contexto (C4 Level 1)

```mermaid
C4Context
    title Sistema de Prospecção Outbound - Contexto

    Person(user, "Usuário", "Gerente de vendas, consultor, agência")
    
    System(snapleads, "SnapLeads", "Plataforma de prospecção outbound")
    
    System_Ext(social, "Redes Sociais", "Instagram, Facebook, LinkedIn")
    System_Ext(email, "Serviço de Email", "SendGrid/AWS SES")
    System_Ext(calendar, "Calendários", "Google Calendar, Outlook")
    
    Rel(user, snapleads, "Usa", "HTTPS")
    Rel(snapleads, social, "Importa leads, envia mensagens")
    Rel(snapleads, email, "Envia notificações")
    Rel(snapleads, calendar, "Sincroniza agendamentos")
```

### 3.2 Diagrama de Containers (C4 Level 2)

```mermaid
C4Container
    title SnapLeads - Containers

    Person(user, "Usuário")
    
    Container_Boundary(client, "Cliente") {
        Container(webapp, "Web App", "Next.js", "Dashboard, inbox, analytics")
        Container(extension, "Extensão", "Chrome MV3", "Scraping de leads")
    }
    
    Container_Boundary(backend, "Backend") {
        Container(api, "API Server", "Express", "REST API, autenticação")
        Container(socket, "Socket Server", "Socket.io", "Eventos realtime")
        Container(worker, "Workers", "Bull", "Jobs assíncronos")
    }
    
    Container_Boundary(data, "Dados") {
        ContainerDb(postgres, "PostgreSQL", "Dados relacionais")
        ContainerDb(redis, "Redis", "Cache, filas, sessões")
    }
    
    Rel(user, webapp, "Acessa", "HTTPS")
    Rel(user, extension, "Usa no navegador")
    
    Rel(webapp, api, "Requisições", "HTTPS/REST")
    Rel(webapp, socket, "Eventos", "WSS")
    Rel(extension, api, "Importa leads", "HTTPS")
    
    Rel(api, postgres, "Lê/Escreve")
    Rel(api, redis, "Cache/Pub")
    Rel(worker, postgres, "Processa jobs")
    Rel(worker, redis, "Consome filas")
    Rel(socket, redis, "Pub/Sub")
```

### 3.3 Responsabilidades por Container

#### API Server (`apps/api`)
- Autenticação JWT (login, refresh, logout)
- CRUD de workspaces, usuários, leads, conversas
- Importação de leads (CSV, extensão)
- Validação e rate limiting
- Dispatch de jobs para workers

#### Socket Server (integrado ao API)
- Conexões WebSocket autenticadas
- Rooms por workspace/conversa
- Broadcast de eventos (nova mensagem, lead atualizado)
- Presence (online/offline)

#### Workers (`apps/api/workers`)
- Envio de mensagens (stub no MVP)
- Processamento de importação em lote
- Cálculo de lead scoring
- Execução de automações simples

#### Web App (`apps/web`)
- Dashboard com métricas
- Lista e Kanban de leads
- Inbox unificado de conversas
- Configurações e perfil
- Gestão de templates

#### Extensão (`apps/extension`)
- Content scripts por plataforma
- Popup para controle
- Comunicação com API
- Rate limiting local

---

## 4. Fluxos Principais

### 4.1 Fluxo de Autenticação

```mermaid
sequenceDiagram
    participant U as Usuário
    participant W as Web App
    participant A as API
    participant R as Redis
    participant P as PostgreSQL

    U->>W: Acessa /login
    W->>A: POST /auth/login {email, password}
    A->>P: Busca usuário por email
    P-->>A: User record
    A->>A: Verifica bcrypt hash
    A->>R: Armazena refresh token
    A-->>W: {accessToken, refreshToken, user}
    W->>W: Salva tokens (httpOnly cookies)
    W-->>U: Redireciona para dashboard
```

### 4.2 Fluxo de Importação via Extensão

```mermaid
sequenceDiagram
    participant E as Extensão
    participant S as Rede Social
    participant A as API
    participant Q as Fila (Redis)
    participant W as Worker
    participant P as PostgreSQL

    E->>S: Navega para página de seguidores
    E->>E: Extrai dados do DOM
    E->>A: POST /leads/import {platform, leads[]}
    A->>A: Valida e deduplica
    A->>Q: Enfileira processamento
    A-->>E: {jobId, status: queued}
    
    W->>Q: Consome job
    W->>P: Insere leads em batch
    W->>P: Atualiza contadores
    W-->>Q: Job completed
```

### 4.3 Fluxo de Mensagens (Inbox)

```mermaid
sequenceDiagram
    participant U as Usuário
    participant W as Web App
    participant SK as Socket
    participant A as API
    participant Q as Fila
    participant P as PostgreSQL

    U->>W: Envia mensagem para lead
    W->>A: POST /conversations/:id/messages
    A->>P: Salva mensagem
    A->>Q: Enfileira envio
    A->>SK: Emite evento new_message
    SK->>W: Broadcast para room
    W-->>U: Mensagem aparece no chat
    
    Note over Q: Worker processa envio
```

### 4.4 Fluxo de Automação Simples

```mermaid
sequenceDiagram
    participant T as Trigger (novo lead)
    participant A as API
    participant Q as Fila
    participant W as Worker
    participant P as PostgreSQL

    T->>A: Evento lead.created
    A->>P: Busca automações ativas
    P-->>A: Automações matching
    
    loop Para cada automação
        A->>Q: Enfileira execução
    end
    
    W->>Q: Consome job
    W->>W: Avalia condições
    alt Condições satisfeitas
        W->>W: Executa ações sequenciais
        W->>P: Registra log de execução
    else Condições não satisfeitas
        W->>P: Registra skip
    end
```

---

## 5. Comunicação entre Componentes

### 5.1 Extensão ↔ Backend

| Aspecto | Decisão |
|---------|---------|
| Protocolo | HTTPS REST |
| Autenticação | Bearer token (mesmo JWT do web) |
| Rate Limit | 100 req/min por usuário |
| Payload máximo | 5MB (importação em lote) |
| Retry | Exponential backoff (3 tentativas) |

### 5.2 Frontend ↔ Backend

| Aspecto | Decisão |
|---------|---------|
| REST API | Endpoints convencionais, JSON |
| WebSocket | Socket.io com autenticação |
| Estado | TanStack Query para cache/sync |
| Erros | Padrão RFC 7807 (Problem Details) |

### 5.3 Backend ↔ Banco de Dados

| Aspecto | Decisão |
|---------|---------|
| Connection Pool | 20 conexões (ajustável) |
| Timeout | 30s para queries |
| Transactions | Prisma `$transaction` para operações compostas |
| Migrations | Prisma Migrate |

### 5.4 Eventos Internos

| Evento | Produtor | Consumidor | Canal |
|--------|----------|------------|-------|
| `lead.created` | API | Workers, Socket | Redis Pub/Sub |
| `lead.updated` | API | Socket | Redis Pub/Sub |
| `message.created` | API | Workers, Socket | Redis Pub/Sub |
| `automation.triggered` | API | Workers | Bull Queue |

---

## 6. Deployment e Infraestrutura

### 6.1 Ambientes

| Ambiente | Propósito | Infraestrutura |
|----------|-----------|----------------|
| Local | Desenvolvimento | Docker Compose |
| Staging | Testes e QA | AWS (single instance) |
| Production | Produção | AWS (auto-scaling) |

### 6.2 Docker Compose (Local)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: snapleads
      POSTGRES_USER: snapleads
      POSTGRES_PASSWORD: snapleads
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://snapleads:snapleads@postgres:5432/snapleads
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret-change-in-production
    depends_on:
      - postgres
      - redis

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
      NEXT_PUBLIC_WS_URL: ws://localhost:3001
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

### 6.3 AWS (Production MVP)

```mermaid
flowchart TB
    subgraph internet [Internet]
        users[Usuários]
        extension[Extensão Chrome]
    end

    subgraph aws [AWS]
        subgraph public [Public Subnet]
            alb[Application Load Balancer]
            cf[CloudFront CDN]
        end
        
        subgraph private [Private Subnet]
            ecs[ECS Fargate]
            subgraph ecs_services [Serviços]
                api_svc[API Service]
                web_svc[Web Service]
                worker_svc[Worker Service]
            end
        end
        
        subgraph data [Data Layer]
            rds[(RDS PostgreSQL)]
            elasticache[(ElastiCache Redis)]
            s3[(S3 Bucket)]
        end
    end

    users --> cf
    extension --> alb
    cf --> alb
    alb --> api_svc
    alb --> web_svc
    api_svc --> rds
    api_svc --> elasticache
    worker_svc --> rds
    worker_svc --> elasticache
    web_svc --> s3
```

---

## 7. Referências

- [C4 Model](https://c4model.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Bull Queue](https://docs.bullmq.io/)
- [Socket.io](https://socket.io/docs/v4/)
