# Diagramas C4 - SnapLeads MVP

Este documento contém os diagramas C4 detalhados do sistema, organizados por nível de abstração.

---

## Level 1: Diagrama de Contexto

Visão de alto nível do sistema e suas interações com usuários e sistemas externos.

```mermaid
flowchart TB
    subgraph users [Usuários]
        sales[Gerente de Vendas]
        consultant[Consultor/Freelancer]
        agency[Agência de Marketing]
    end

    subgraph snapleads [SnapLeads System]
        system[Sistema de Prospecção Outbound]
    end

    subgraph external [Sistemas Externos]
        subgraph social [Redes Sociais]
            instagram[Instagram]
            facebook[Facebook]
            linkedin[LinkedIn]
        end
        
        subgraph services [Serviços]
            sendgrid[SendGrid]
            gcal[Google Calendar]
        end
    end

    sales --> system
    consultant --> system
    agency --> system

    system <--> instagram
    system <--> facebook
    system <--> linkedin
    system --> sendgrid
    system <--> gcal
```

### Atores

| Ator | Descrição | Interações Principais |
|------|-----------|----------------------|
| Gerente de Vendas | Gerencia equipe, analisa métricas | Dashboard, relatórios, gestão de equipe |
| Consultor/Freelancer | Prospecção individual | Importação, inbox, automações |
| Agência de Marketing | Multi-clientes, alto volume | Workspaces múltiplos, white-label |

### Sistemas Externos

| Sistema | Tipo | Integração |
|---------|------|------------|
| Instagram | Rede Social | Scraping via extensão, API Graph (limitada) |
| Facebook | Rede Social | Scraping via extensão, API Graph |
| LinkedIn | Rede Social | Scraping via extensão |
| SendGrid | Email | API REST para notificações |
| Google Calendar | Calendário | OAuth2, API REST |

---

## Level 2: Diagrama de Containers

Decomposição do sistema em containers de aplicação e dados.

```mermaid
flowchart TB
    subgraph client [Cliente - Browser]
        webapp[Web Application<br/>Next.js 14]
        extension[Chrome Extension<br/>Manifest V3]
    end

    subgraph backend [Backend - API Layer]
        api[API Server<br/>Express + Node.js]
        socket[WebSocket Server<br/>Socket.io]
        workers[Background Workers<br/>Bull + Redis]
    end

    subgraph data [Data Layer]
        postgres[(PostgreSQL 15<br/>Dados Relacionais)]
        redis[(Redis 7<br/>Cache + Queues)]
    end

    subgraph storage [Storage]
        s3[(S3/R2<br/>Arquivos + Uploads)]
    end

    %% User interactions
    user((Usuário))
    user --> webapp
    user --> extension

    %% Client to Backend
    webapp -->|REST API| api
    webapp -->|WebSocket| socket
    extension -->|REST API| api

    %% Backend to Data
    api --> postgres
    api --> redis
    api --> s3
    workers --> postgres
    workers --> redis
    socket --> redis

    %% Internal communication
    api -.->|Pub/Sub| socket
    api -.->|Enqueue Jobs| workers
```

### Container: Web Application

| Aspecto | Detalhe |
|---------|---------|
| **Tecnologia** | Next.js 14, React 18, TypeScript |
| **Responsabilidades** | UI do dashboard, inbox, analytics |
| **Comunicação** | REST API, WebSocket |
| **Estado** | Zustand (local), TanStack Query (servidor) |

### Container: Chrome Extension

| Aspecto | Detalhe |
|---------|---------|
| **Tecnologia** | Manifest V3, TypeScript |
| **Responsabilidades** | Scraping de leads, UI popup |
| **Comunicação** | REST API com bearer token |
| **Armazenamento** | chrome.storage para config |

### Container: API Server

| Aspecto | Detalhe |
|---------|---------|
| **Tecnologia** | Express 4, Node.js 20, TypeScript |
| **Responsabilidades** | REST endpoints, auth, validação |
| **Comunicação** | HTTP/REST, integrado com Socket.io |
| **Padrões** | Controller-Service-Repository |

### Container: WebSocket Server

| Aspecto | Detalhe |
|---------|---------|
| **Tecnologia** | Socket.io 4 |
| **Responsabilidades** | Eventos realtime, presence |
| **Comunicação** | WebSocket com fallback |
| **Scaling** | Redis adapter para multi-instance |

### Container: Background Workers

| Aspecto | Detalhe |
|---------|---------|
| **Tecnologia** | Bull (BullMQ), Node.js |
| **Responsabilidades** | Jobs assíncronos, processamento em lote |
| **Filas** | imports, messages, automations, scoring |
| **Retry** | Exponential backoff, dead letter queue |

---

## Level 3: Diagrama de Componentes

### API Server - Componentes

```mermaid
flowchart TB
    subgraph api [API Server]
        subgraph routes [Routes Layer]
            auth_routes[Auth Routes]
            lead_routes[Lead Routes]
            conv_routes[Conversation Routes]
            auto_routes[Automation Routes]
            analytics_routes[Analytics Routes]
        end

        subgraph middleware [Middleware]
            auth_mw[Auth Middleware]
            rate_mw[Rate Limiter]
            validate_mw[Validator]
            error_mw[Error Handler]
        end

        subgraph services [Service Layer]
            auth_svc[Auth Service]
            lead_svc[Lead Service]
            conv_svc[Conversation Service]
            auto_svc[Automation Service]
            analytics_svc[Analytics Service]
            platform_svc[Platform Service]
        end

        subgraph repos [Repository Layer]
            user_repo[User Repository]
            lead_repo[Lead Repository]
            conv_repo[Conversation Repository]
            auto_repo[Automation Repository]
        end
    end

    subgraph external [External]
        prisma[Prisma Client]
        redis_client[Redis Client]
        bull_queue[Bull Queue]
    end

    %% Flow
    auth_routes --> auth_mw --> auth_svc --> user_repo
    lead_routes --> auth_mw --> rate_mw --> lead_svc --> lead_repo
    conv_routes --> auth_mw --> conv_svc --> conv_repo
    
    %% External connections
    user_repo --> prisma
    lead_repo --> prisma
    conv_repo --> prisma
    
    lead_svc --> bull_queue
    platform_svc --> redis_client
```

### Componentes do API Server

| Componente | Responsabilidade |
|------------|------------------|
| **Auth Routes** | Login, logout, refresh, registro |
| **Lead Routes** | CRUD leads, importação, tagging |
| **Conversation Routes** | Listar conversas, enviar mensagens |
| **Automation Routes** | CRUD automações, toggle, logs |
| **Analytics Routes** | Métricas, funil, relatórios |
| **Auth Service** | JWT, bcrypt, validação de sessão |
| **Lead Service** | Lógica de negócio de leads |
| **Conversation Service** | Gestão de conversas e mensagens |
| **Platform Service** | Abstração de envio por plataforma |

---

## Level 3: Extension - Componentes

```mermaid
flowchart TB
    subgraph extension [Chrome Extension]
        subgraph bg [Background]
            sw[Service Worker]
            api_client[API Client]
            rate_limiter[Rate Limiter]
        end

        subgraph content [Content Scripts]
            ig_script[Instagram Script]
            fb_script[Facebook Script]
            li_script[LinkedIn Script]
        end

        subgraph ui [UI]
            popup[Popup]
            options[Options Page]
        end

        subgraph storage [Storage]
            local[chrome.storage.local]
            sync[chrome.storage.sync]
        end
    end

    subgraph webpage [Página Web]
        dom[DOM da Rede Social]
    end

    subgraph backend [Backend]
        api[API Server]
    end

    %% Flows
    popup --> sw
    options --> sync
    
    ig_script --> dom
    fb_script --> dom
    li_script --> dom
    
    ig_script --> sw
    fb_script --> sw
    li_script --> sw
    
    sw --> rate_limiter --> api_client --> api
    sw --> local
```

### Componentes da Extensão

| Componente | Responsabilidade |
|------------|------------------|
| **Service Worker** | Orquestra comunicação, mantém estado |
| **API Client** | Comunicação HTTP com backend |
| **Rate Limiter** | Controle local de rate limiting |
| **Instagram Script** | Extração de dados do Instagram |
| **Facebook Script** | Extração de dados do Facebook |
| **LinkedIn Script** | Extração de dados do LinkedIn |
| **Popup** | Interface rápida, status, ações |
| **Options Page** | Configurações, login |

---

## Fluxos de Dados Detalhados

### Fluxo: Importação de Leads via Extensão

```mermaid
sequenceDiagram
    autonumber
    participant User as Usuário
    participant Ext as Extensão
    participant DOM as Página Social
    participant SW as Service Worker
    participant API as API Server
    participant Queue as Bull Queue
    participant Worker as Worker
    participant DB as PostgreSQL

    User->>Ext: Clica "Importar Leads"
    Ext->>DOM: Injeta content script
    DOM-->>Ext: Dados extraídos do DOM
    Ext->>SW: chrome.runtime.sendMessage
    SW->>SW: Valida e formata dados
    SW->>API: POST /api/v1/leads/import
    API->>API: Autenticação JWT
    API->>API: Validação de payload
    API->>Queue: Enfileira job de importação
    API-->>SW: {jobId, status: "queued"}
    SW-->>Ext: Notifica progresso
    
    Worker->>Queue: Consome job
    Worker->>DB: Deduplica por profile_url
    Worker->>DB: INSERT batch de leads
    Worker->>DB: UPDATE workspace.lead_count
    Worker-->>Queue: Job completed
    
    Note over User,DB: WebSocket notifica conclusão
```

### Fluxo: Envio de Mensagem

```mermaid
sequenceDiagram
    autonumber
    participant User as Usuário
    participant Web as Web App
    participant Socket as WebSocket
    participant API as API Server
    participant DB as PostgreSQL
    participant Queue as Bull Queue
    participant Worker as Worker
    participant Platform as Platform Service

    User->>Web: Digita e envia mensagem
    Web->>API: POST /conversations/:id/messages
    API->>DB: INSERT message (status: pending)
    API->>Queue: Enfileira envio
    API->>Socket: Emit "message:created"
    Socket->>Web: Broadcast para room
    API-->>Web: {messageId, status: "pending"}
    Web-->>User: Mensagem aparece (pending)

    Worker->>Queue: Consome job
    Worker->>Platform: Envia via plataforma
    alt Sucesso
        Platform-->>Worker: OK
        Worker->>DB: UPDATE message status = "sent"
        Worker->>Socket: Emit "message:sent"
        Socket->>Web: Update status
    else Falha
        Platform-->>Worker: Error
        Worker->>DB: UPDATE message status = "failed"
        Worker->>Socket: Emit "message:failed"
        Worker->>Queue: Retry ou DLQ
    end
```

---

## Diagrama de Deployment (Produção)

```mermaid
flowchart TB
    subgraph internet [Internet]
        users[Usuários]
        extension[Extensão Chrome]
    end

    subgraph cloudflare [CloudFlare]
        cf_dns[DNS]
        cf_waf[WAF]
        cf_cdn[CDN]
    end

    subgraph aws [AWS us-east-1]
        subgraph vpc [VPC]
            subgraph public_subnet [Public Subnet]
                alb[ALB<br/>Application Load Balancer]
                nat[NAT Gateway]
            end

            subgraph private_subnet_a [Private Subnet A]
                ecs_api_a[ECS Task<br/>API + Socket]
                ecs_web_a[ECS Task<br/>Web App]
            end

            subgraph private_subnet_b [Private Subnet B]
                ecs_api_b[ECS Task<br/>API + Socket]
                ecs_worker[ECS Task<br/>Workers]
            end

            subgraph data_subnet [Data Subnet]
                rds[(RDS PostgreSQL<br/>Multi-AZ)]
                elasticache[(ElastiCache<br/>Redis Cluster)]
            end
        end

        s3[(S3 Bucket<br/>Uploads + Backups)]
        secrets[Secrets Manager]
        cloudwatch[CloudWatch<br/>Logs + Metrics]
    end

    users --> cf_dns
    extension --> cf_dns
    cf_dns --> cf_waf
    cf_waf --> cf_cdn
    cf_cdn --> alb
    
    alb --> ecs_api_a
    alb --> ecs_api_b
    alb --> ecs_web_a
    
    ecs_api_a --> rds
    ecs_api_b --> rds
    ecs_worker --> rds
    
    ecs_api_a --> elasticache
    ecs_api_b --> elasticache
    ecs_worker --> elasticache
    
    ecs_api_a --> s3
    ecs_web_a --> s3
    
    ecs_api_a --> secrets
    ecs_api_b --> secrets
    ecs_worker --> secrets
    
    ecs_api_a --> cloudwatch
    ecs_api_b --> cloudwatch
    ecs_worker --> cloudwatch
```

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| Retângulo | Container/Componente |
| Cilindro | Banco de Dados/Storage |
| Seta sólida | Comunicação síncrona |
| Seta tracejada | Comunicação assíncrona |
| Subgraph | Agrupamento lógico |

---

## Referências

- [C4 Model - Simon Brown](https://c4model.com/)
- [Mermaid C4 Diagrams](https://mermaid.js.org/syntax/c4.html)
- [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/)
