# Especificação da API - Lia 360 MVP

## Visão Geral

- **Base URL**: `https://api.lia360.com/v1`
- **Formato**: JSON
- **Autenticação**: Bearer Token (JWT)
- **Versionamento**: Via URL path (`/v1`)

---

## Autenticação

Todas as rotas (exceto `/auth/*`) requerem header:
```
Authorization: Bearer <access_token>
```

### Tokens

| Tipo | Duração | Uso |
|------|---------|-----|
| Access Token | 15 minutos | Requisições API |
| Refresh Token | 7 dias | Obter novo access token |

---

## Padrões de Resposta

### Sucesso

```json
{
  "success": true,
  "data": { ... }
}
```

### Sucesso com Paginação

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Erro (RFC 7807)

```json
{
  "success": false,
  "error": {
    "type": "validation_error",
    "title": "Validation Failed",
    "status": 400,
    "detail": "O campo 'email' é obrigatório",
    "instance": "/v1/leads",
    "errors": [
      {
        "field": "email",
        "message": "O campo 'email' é obrigatório"
      }
    ]
  }
}
```

---

## Endpoints

### Auth

#### POST /auth/register

Cria uma nova conta e workspace.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "fullName": "João Silva",
  "workspaceName": "Minha Empresa"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_abc123",
      "email": "user@example.com",
      "fullName": "João Silva",
      "role": "owner",
      "workspaceId": "ws_xyz789"
    },
    "workspace": {
      "id": "ws_xyz789",
      "name": "Minha Empresa",
      "plan": "trial"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

---

#### POST /auth/login

Autentica usuário existente.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_abc123",
      "email": "user@example.com",
      "fullName": "João Silva",
      "role": "owner",
      "workspaceId": "ws_xyz789",
      "avatarUrl": "https://..."
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

**Errors:**
- `401` - Credenciais inválidas
- `403` - Conta desativada

---

#### POST /auth/refresh

Renova o access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

---

#### POST /auth/logout

Invalida o refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logout realizado com sucesso"
  }
}
```

---

#### GET /auth/me

Retorna usuário autenticado.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "fullName": "João Silva",
    "role": "owner",
    "avatarUrl": "https://...",
    "workspace": {
      "id": "ws_xyz789",
      "name": "Minha Empresa",
      "plan": "professional",
      "settings": {}
    }
  }
}
```

---

### Leads

#### GET /leads

Lista leads com filtros e paginação.

**Query Parameters:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| page | int | 1 | Página atual |
| limit | int | 20 | Itens por página (max: 100) |
| platform | string | - | Filtro por plataforma |
| status | string | - | Filtro por status |
| tags | string | - | IDs de tags (comma-separated) |
| assignedTo | string | - | ID do usuário atribuído |
| search | string | - | Busca por nome/username |
| sort | string | -createdAt | Campo e direção de ordenação |
| scoreMin | int | - | Score mínimo |
| scoreMax | int | - | Score máximo |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead_abc123",
      "platform": "instagram",
      "username": "johndoe",
      "fullName": "John Doe",
      "profileUrl": "https://instagram.com/johndoe",
      "avatarUrl": "https://...",
      "bio": "Empreendedor | Marketing Digital",
      "email": "john@example.com",
      "phone": "+5511999999999",
      "location": "São Paulo, BR",
      "followersCount": 15000,
      "followingCount": 500,
      "verified": false,
      "score": 75,
      "status": "contacted",
      "assignedTo": {
        "id": "usr_xyz",
        "fullName": "Maria"
      },
      "tags": [
        { "id": "tag_1", "name": "Hot Lead", "color": "#FF5733" }
      ],
      "lastInteraction": "2025-01-15T10:30:00Z",
      "createdAt": "2025-01-10T08:00:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

#### POST /leads

Cria um novo lead.

**Request:**
```json
{
  "platform": "instagram",
  "username": "johndoe",
  "fullName": "John Doe",
  "profileUrl": "https://instagram.com/johndoe",
  "avatarUrl": "https://...",
  "bio": "Empreendedor",
  "email": "john@example.com",
  "phone": "+5511999999999",
  "location": "São Paulo",
  "followersCount": 15000,
  "tags": ["tag_1", "tag_2"],
  "customFields": {
    "empresa": "Acme Inc"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "lead_abc123",
    "platform": "instagram",
    "username": "johndoe",
    ...
  }
}
```

---

#### POST /leads/import

Importa leads em lote (CSV ou extensão).

**Request:**
```json
{
  "source": "extension",
  "platform": "instagram",
  "sourceUrl": "https://instagram.com/empresa/followers",
  "leads": [
    {
      "username": "user1",
      "fullName": "User One",
      "profileUrl": "https://instagram.com/user1",
      "avatarUrl": "https://...",
      "bio": "Bio do usuário",
      "followersCount": 1000
    },
    {
      "username": "user2",
      "fullName": "User Two",
      "profileUrl": "https://instagram.com/user2"
    }
  ],
  "tags": ["tag_import_jan"],
  "autoAssign": false
}
```

**Response (202):**
```json
{
  "success": true,
  "data": {
    "jobId": "job_xyz789",
    "status": "queued",
    "totalLeads": 50,
    "message": "Importação em processamento"
  }
}
```

---

#### GET /leads/import/:jobId

Consulta status de importação.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "jobId": "job_xyz789",
    "status": "completed",
    "progress": 100,
    "result": {
      "total": 50,
      "imported": 45,
      "duplicates": 3,
      "errors": 2
    },
    "completedAt": "2025-01-15T10:35:00Z"
  }
}
```

---

#### GET /leads/:id

Retorna um lead específico com detalhes.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "lead_abc123",
    "platform": "instagram",
    "username": "johndoe",
    "fullName": "John Doe",
    "profileUrl": "https://instagram.com/johndoe",
    "avatarUrl": "https://...",
    "bio": "Empreendedor | Marketing Digital",
    "email": "john@example.com",
    "phone": "+5511999999999",
    "location": "São Paulo, BR",
    "website": "https://johndoe.com",
    "followersCount": 15000,
    "followingCount": 500,
    "postsCount": 230,
    "verified": false,
    "score": 75,
    "status": "contacted",
    "assignedTo": {
      "id": "usr_xyz",
      "fullName": "Maria",
      "avatarUrl": "https://..."
    },
    "tags": [
      { "id": "tag_1", "name": "Hot Lead", "color": "#FF5733" }
    ],
    "customFields": {
      "empresa": "Acme Inc",
      "cargo": "CEO"
    },
    "notes": "Lead muito engajado, respondeu rápido",
    "sourceUrl": "https://instagram.com/empresa/followers",
    "lastInteraction": "2025-01-15T10:30:00Z",
    "createdAt": "2025-01-10T08:00:00Z",
    "updatedAt": "2025-01-15T10:30:00Z",
    "activities": [
      {
        "id": "act_1",
        "type": "status_change",
        "from": "new",
        "to": "contacted",
        "userId": "usr_abc",
        "createdAt": "2025-01-12T09:00:00Z"
      }
    ]
  }
}
```

---

#### PATCH /leads/:id

Atualiza um lead.

**Request:**
```json
{
  "status": "qualified",
  "score": 85,
  "notes": "Lead qualificado, agendar call",
  "customFields": {
    "empresa": "Acme Inc Updated"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "lead_abc123",
    ...
  }
}
```

---

#### DELETE /leads/:id

Remove um lead.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Lead removido com sucesso"
  }
}
```

---

#### POST /leads/:id/tags

Adiciona tags a um lead.

**Request:**
```json
{
  "tagIds": ["tag_1", "tag_2"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "lead_abc123",
    "tags": [
      { "id": "tag_1", "name": "Hot Lead", "color": "#FF5733" },
      { "id": "tag_2", "name": "Instagram", "color": "#E1306C" }
    ]
  }
}
```

---

#### DELETE /leads/:id/tags/:tagId

Remove tag de um lead.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Tag removida com sucesso"
  }
}
```

---

#### POST /leads/:id/assign

Atribui lead a um usuário.

**Request:**
```json
{
  "userId": "usr_xyz789"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "lead_abc123",
    "assignedTo": {
      "id": "usr_xyz789",
      "fullName": "Maria Silva"
    }
  }
}
```

---

### Tags

#### GET /tags

Lista todas as tags do workspace.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "tag_1",
      "name": "Hot Lead",
      "color": "#FF5733",
      "leadsCount": 25,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "tag_2",
      "name": "Instagram",
      "color": "#E1306C",
      "leadsCount": 150,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

#### POST /tags

Cria uma nova tag.

**Request:**
```json
{
  "name": "Qualificado",
  "color": "#22C55E"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "tag_xyz",
    "name": "Qualificado",
    "color": "#22C55E",
    "leadsCount": 0,
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

---

#### PATCH /tags/:id

Atualiza uma tag.

**Request:**
```json
{
  "name": "Super Qualificado",
  "color": "#16A34A"
}
```

**Response (200):** Tag atualizada.

---

#### DELETE /tags/:id

Remove uma tag (desvincula de leads).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Tag removida com sucesso"
  }
}
```

---

### Conversations

#### GET /conversations

Lista conversas do workspace.

**Query Parameters:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| page | int | 1 | Página atual |
| limit | int | 20 | Itens por página |
| status | string | active | active, archived, all |
| unread | bool | - | Apenas não lidas |
| platform | string | - | Filtro por plataforma |
| assignedTo | string | - | Filtro por responsável |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv_abc123",
      "lead": {
        "id": "lead_xyz",
        "username": "johndoe",
        "fullName": "John Doe",
        "avatarUrl": "https://...",
        "platform": "instagram"
      },
      "platform": "instagram",
      "status": "active",
      "unreadCount": 2,
      "assignedTo": {
        "id": "usr_abc",
        "fullName": "Maria"
      },
      "lastMessage": {
        "id": "msg_xyz",
        "content": "Olá, tudo bem?",
        "senderType": "lead",
        "sentAt": "2025-01-15T10:30:00Z"
      },
      "createdAt": "2025-01-10T08:00:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

#### GET /conversations/:id

Retorna conversa com mensagens.

**Query Parameters:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| messagesLimit | int | 50 | Número de mensagens |
| messagesBefore | string | - | Cursor para paginação |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "conv_abc123",
    "lead": {
      "id": "lead_xyz",
      "username": "johndoe",
      "fullName": "John Doe",
      "avatarUrl": "https://...",
      "platform": "instagram",
      "profileUrl": "https://instagram.com/johndoe"
    },
    "platform": "instagram",
    "status": "active",
    "unreadCount": 0,
    "assignedTo": {
      "id": "usr_abc",
      "fullName": "Maria"
    },
    "messages": [
      {
        "id": "msg_1",
        "content": "Oi! Vi que você curtiu nosso post",
        "senderType": "agent",
        "senderId": "usr_abc",
        "messageType": "text",
        "status": "sent",
        "sentAt": "2025-01-14T10:00:00Z",
        "readAt": "2025-01-14T10:05:00Z"
      },
      {
        "id": "msg_2",
        "content": "Olá! Sim, achei muito interessante",
        "senderType": "lead",
        "messageType": "text",
        "sentAt": "2025-01-14T11:00:00Z"
      }
    ],
    "hasMoreMessages": true,
    "createdAt": "2025-01-10T08:00:00Z"
  }
}
```

---

#### POST /conversations/:id/messages

Envia mensagem em uma conversa.

**Request:**
```json
{
  "content": "Que bom que gostou! Posso te explicar melhor?",
  "messageType": "text"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "msg_xyz",
    "content": "Que bom que gostou! Posso te explicar melhor?",
    "senderType": "agent",
    "senderId": "usr_abc",
    "messageType": "text",
    "status": "pending",
    "sentAt": "2025-01-15T10:35:00Z"
  }
}
```

---

#### POST /conversations/:id/read

Marca conversa como lida.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "conv_abc123",
    "unreadCount": 0
  }
}
```

---

#### POST /conversations/:id/assign

Atribui conversa a um usuário.

**Request:**
```json
{
  "userId": "usr_xyz"
}
```

**Response (200):** Conversa atualizada.

---

#### POST /conversations/:id/archive

Arquiva uma conversa.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "conv_abc123",
    "status": "archived"
  }
}
```

---

### Templates

#### GET /templates

Lista templates de mensagem.

**Query Parameters:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| platform | string | Filtro por plataforma |
| category | string | Filtro por categoria |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "tpl_abc",
      "name": "Primeiro Contato Instagram",
      "content": "Oi {{nome}}! Vi que você curtiu nosso conteúdo sobre {{assunto}}. Posso te contar mais?",
      "platform": "instagram",
      "category": "first_contact",
      "variables": ["nome", "assunto"],
      "stats": {
        "sent": 150,
        "responseRate": 0.45
      },
      "createdBy": {
        "id": "usr_abc",
        "fullName": "Maria"
      },
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

#### POST /templates

Cria novo template.

**Request:**
```json
{
  "name": "Follow-up Semana",
  "content": "Oi {{nome}}, tudo bem? Lembra que conversamos sobre {{assunto}}? Ainda tenho interesse?",
  "platform": "instagram",
  "category": "followup"
}
```

**Response (201):** Template criado.

---

#### PATCH /templates/:id

Atualiza template.

---

#### DELETE /templates/:id

Remove template.

---

### Automations (MVP Simples)

#### GET /automations

Lista automações do workspace.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "auto_abc",
      "name": "Tag automática para novos leads Instagram",
      "description": "Adiciona tag 'Instagram' para leads importados",
      "triggerType": "lead_created",
      "triggerConfig": {
        "platform": "instagram"
      },
      "actions": [
        {
          "type": "add_tag",
          "config": {
            "tagId": "tag_instagram"
          }
        }
      ],
      "enabled": true,
      "stats": {
        "runs": 500,
        "success": 498,
        "failed": 2
      },
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

#### POST /automations

Cria automação simples (MVP: trigger + action única).

**Request:**
```json
{
  "name": "Boas-vindas automático",
  "description": "Envia mensagem de boas-vindas",
  "triggerType": "lead_created",
  "triggerConfig": {
    "platform": "instagram"
  },
  "actions": [
    {
      "type": "send_message",
      "config": {
        "templateId": "tpl_welcome",
        "delay": 3600
      }
    }
  ]
}
```

**Response (201):** Automação criada.

---

#### PATCH /automations/:id

Atualiza automação.

---

#### POST /automations/:id/toggle

Ativa/desativa automação.

**Request:**
```json
{
  "enabled": false
}
```

---

#### GET /automations/:id/logs

Logs de execução da automação.

**Query Parameters:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| page | int | Página |
| limit | int | Itens por página |
| status | string | success, failed, skipped |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "log_xyz",
      "automationId": "auto_abc",
      "leadId": "lead_123",
      "lead": {
        "username": "johndoe",
        "fullName": "John Doe"
      },
      "status": "success",
      "actionsExecuted": 1,
      "executedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### Analytics

#### GET /analytics/overview

Métricas gerais do workspace.

**Query Parameters:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| startDate | date | -30 days | Data inicial |
| endDate | date | hoje | Data final |
| platform | string | - | Filtro por plataforma |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2024-12-15",
      "end": "2025-01-15"
    },
    "leads": {
      "total": 1500,
      "new": 250,
      "growth": 0.20
    },
    "conversations": {
      "total": 800,
      "started": 180,
      "responseRate": 0.65
    },
    "scheduled": {
      "total": 45,
      "completed": 38
    },
    "byPlatform": {
      "instagram": 600,
      "linkedin": 500,
      "facebook": 400
    },
    "byStatus": {
      "new": 500,
      "contacted": 400,
      "responded": 300,
      "qualified": 150,
      "scheduled": 100,
      "closed": 50
    }
  }
}
```

---

#### GET /analytics/funnel

Funil de conversão.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "stages": [
      { "name": "Importado", "count": 1500, "rate": 1.0 },
      { "name": "Contatado", "count": 800, "rate": 0.53 },
      { "name": "Respondeu", "count": 500, "rate": 0.33 },
      { "name": "Qualificado", "count": 150, "rate": 0.10 },
      { "name": "Agendado", "count": 50, "rate": 0.033 },
      { "name": "Fechado", "count": 20, "rate": 0.013 }
    ],
    "conversionRates": {
      "contactedToResponded": 0.625,
      "respondedToQualified": 0.30,
      "qualifiedToScheduled": 0.33,
      "scheduledToClosed": 0.40
    }
  }
}
```

---

#### GET /analytics/timeline

Atividade ao longo do tempo.

**Query Parameters:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| interval | string | day | hour, day, week, month |
| metric | string | leads | leads, conversations, messages |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "interval": "day",
    "metric": "leads",
    "points": [
      { "date": "2025-01-01", "value": 50 },
      { "date": "2025-01-02", "value": 75 },
      { "date": "2025-01-03", "value": 60 }
    ]
  }
}
```

---

### Users (Workspace Team)

#### GET /users

Lista usuários do workspace.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "usr_abc",
      "email": "maria@empresa.com",
      "fullName": "Maria Silva",
      "role": "admin",
      "avatarUrl": "https://...",
      "stats": {
        "leadsAssigned": 150,
        "conversationsActive": 30
      },
      "lastLogin": "2025-01-15T09:00:00Z",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

#### POST /users/invite

Convida usuário para o workspace.

**Request:**
```json
{
  "email": "joao@empresa.com",
  "role": "agent"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "inv_xyz",
    "email": "joao@empresa.com",
    "role": "agent",
    "status": "pending",
    "expiresAt": "2025-01-22T00:00:00Z"
  }
}
```

---

#### PATCH /users/:id

Atualiza usuário (role, etc).

**Request:**
```json
{
  "role": "manager"
}
```

---

#### DELETE /users/:id

Remove usuário do workspace.

---

### Webhooks

#### GET /webhooks

Lista webhooks configurados.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "wh_abc",
      "url": "https://api.exemplo.com/webhook",
      "events": ["lead.created", "conversation.message_received"],
      "enabled": true,
      "lastTriggered": "2025-01-15T10:00:00Z",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

#### POST /webhooks

Cria webhook.

**Request:**
```json
{
  "url": "https://api.exemplo.com/webhook",
  "events": ["lead.created", "conversation.message_received"],
  "secret": "optional-secret-for-signature"
}
```

---

#### DELETE /webhooks/:id

Remove webhook.

---

#### POST /webhooks/:id/test

Testa webhook (envia payload de exemplo).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "delivered": true,
    "statusCode": 200,
    "responseTime": 150
  }
}
```

---

## Eventos WebSocket

### Conexão

```javascript
const socket = io('wss://api.snapleads.com', {
  auth: { token: 'Bearer <access_token>' }
});

socket.on('connect', () => {
  // Entrar nas rooms do workspace
  socket.emit('join:workspace', workspaceId);
});
```

### Eventos Emitidos pelo Servidor

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `lead:created` | `{ lead }` | Novo lead criado |
| `lead:updated` | `{ lead }` | Lead atualizado |
| `lead:deleted` | `{ leadId }` | Lead removido |
| `conversation:new_message` | `{ conversationId, message }` | Nova mensagem recebida |
| `conversation:message_sent` | `{ conversationId, messageId, status }` | Status de envio |
| `import:progress` | `{ jobId, progress, status }` | Progresso de importação |
| `import:completed` | `{ jobId, result }` | Importação concluída |

---

## Rate Limiting

| Endpoint | Limite | Janela |
|----------|--------|--------|
| `/auth/*` | 10 req | 1 min |
| `/leads/import` | 5 req | 1 min |
| `/conversations/*/messages` | 60 req | 1 min |
| `Outros` | 100 req | 1 min |

**Headers de Resposta:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312800
```

---

## Códigos de Erro

| Código | Tipo | Descrição |
|--------|------|-----------|
| 400 | validation_error | Dados inválidos |
| 401 | unauthorized | Token inválido ou expirado |
| 403 | forbidden | Sem permissão |
| 404 | not_found | Recurso não encontrado |
| 409 | conflict | Conflito (ex: email duplicado) |
| 429 | rate_limited | Rate limit excedido |
| 500 | internal_error | Erro interno do servidor |
