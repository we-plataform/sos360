# Requisitos de Segurança - SnapLeads MVP

Este documento define os requisitos mínimos de segurança para o MVP, cobrindo autenticação, autorização, proteção de dados e práticas de desenvolvimento seguro.

---

## 1. Autenticação

### 1.1 JWT (JSON Web Tokens)

#### Configuração

| Parâmetro | Valor MVP | Produção |
|-----------|-----------|----------|
| Algoritmo | HS256 | RS256 |
| Access Token TTL | 15 minutos | 15 minutos |
| Refresh Token TTL | 30 dias | 30 dias |
| Issuer | snapleads-api | snapleads-api |

#### Estrutura do Access Token

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "usr_abc123",
    "iat": 1705312800,
    "exp": 1705313700,
    "iss": "snapleads-api",
    "workspaceId": "ws_xyz789",
    "role": "admin"
  }
}
```

#### Fluxo de Refresh Token

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant R as Redis
    participant DB as PostgreSQL

    C->>A: POST /auth/refresh {refreshToken}
    A->>R: Busca token hash
    alt Token válido
        R-->>A: Token encontrado
        A->>A: Gera novo access token
        A->>R: Atualiza TTL do refresh
        A-->>C: {accessToken, expiresIn}
    else Token inválido/expirado
        R-->>A: Não encontrado
        A-->>C: 401 Unauthorized
    end
```

#### Armazenamento de Refresh Tokens

```typescript
// Redis key pattern
`refresh_token:${userId}:${tokenHash}`

// Estrutura
{
  userId: "usr_abc123",
  workspaceId: "ws_xyz789",
  deviceInfo: "Chrome/Windows",
  createdAt: "2025-01-15T10:00:00Z",
  expiresAt: "2025-01-22T10:00:00Z"
}
```

### 1.2 Senhas

| Requisito | Especificação |
|-----------|---------------|
| Comprimento mínimo | 8 caracteres |
| Complexidade | 1 maiúscula, 1 minúscula, 1 número |
| Hash algorithm | bcrypt |
| Salt rounds | 12 |
| Histórico | Não reutilizar últimas 3 senhas |

#### Implementação bcrypt

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### 1.3 Rate Limiting de Auth

| Endpoint | Limite | Janela | Ação |
|----------|--------|--------|------|
| POST /auth/login | 5 tentativas | 15 min | Block IP |
| POST /auth/register | 3 registros | 1 hora | Block IP |
| POST /auth/refresh | 30 requests | 1 min | Delay |
| POST /auth/forgot-password | 3 requests | 1 hora | Block email |

#### Implementação com Redis

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';

const loginLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_login',
  points: 5,
  duration: 900, // 15 minutos
  blockDuration: 900,
});

export async function checkLoginRateLimit(ip: string): Promise<void> {
  try {
    await loginLimiter.consume(ip);
  } catch (error) {
    throw new TooManyRequestsError('Muitas tentativas de login. Tente novamente em 15 minutos.');
  }
}
```

---

## 2. Autorização (RBAC)

### 2.1 Roles e Permissões

```mermaid
graph TB
    subgraph roles [Hierarquia de Roles]
        owner[Owner]
        admin[Admin]
        manager[Manager]
        agent[Agent]
        viewer[Viewer]
    end

    owner --> admin
    admin --> manager
    manager --> agent
    agent --> viewer
```

### 2.2 Matriz de Permissões

| Recurso | Owner | Admin | Manager | Agent | Viewer |
|---------|-------|-------|---------|-------|--------|
| **Workspace** |
| Editar configurações | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gerenciar billing | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Usuários** |
| Convidar usuários | ✅ | ✅ | ❌ | ❌ | ❌ |
| Remover usuários | ✅ | ✅ | ❌ | ❌ | ❌ |
| Alterar roles | ✅ | ✅* | ❌ | ❌ | ❌ |
| **Leads** |
| Visualizar todos | ✅ | ✅ | ✅ | ❌** | ✅ |
| Criar/Importar | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editar | ✅ | ✅ | ✅ | ✅** | ❌ |
| Deletar | ✅ | ✅ | ✅ | ❌ | ❌ |
| Atribuir | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Conversas** |
| Visualizar todas | ✅ | ✅ | ✅ | ❌** | ✅ |
| Enviar mensagens | ✅ | ✅ | ✅ | ✅** | ❌ |
| **Automações** |
| Criar/Editar | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ativar/Desativar | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Analytics** |
| Visualizar | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exportar | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Webhooks/API** |
| Gerenciar | ✅ | ✅ | ❌ | ❌ | ❌ |

\* Admin não pode alterar role de Owner
\** Agent só acessa recursos atribuídos a ele

### 2.3 Middleware de Autorização

```typescript
// middleware/authorize.ts

import { Role } from '@prisma/client';

type Permission = 'leads:read' | 'leads:write' | 'leads:delete' | 'users:manage' | /* ... */;

const rolePermissions: Record<Role, Permission[]> = {
  owner: ['*'], // todas
  admin: ['leads:read', 'leads:write', 'leads:delete', 'users:manage', /* ... */],
  manager: ['leads:read', 'leads:write', 'leads:delete', /* ... */],
  agent: ['leads:read', 'leads:write:assigned', 'conversations:read:assigned', /* ... */],
  viewer: ['leads:read', 'conversations:read', 'analytics:read'],
};

export function authorize(...permissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const userPermissions = rolePermissions[user.role];
    
    // Owner tem todas as permissões
    if (userPermissions.includes('*')) {
      return next();
    }
    
    // Verifica se tem alguma das permissões necessárias
    const hasPermission = permissions.some(p => 
      userPermissions.includes(p) || 
      userPermissions.includes(p.replace(':assigned', ''))
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Para permissões ":assigned", adiciona filtro
    if (userPermissions.some(p => p.endsWith(':assigned'))) {
      req.resourceFilter = { assignedToId: user.id };
    }
    
    next();
  };
}

// Uso nas rotas
router.get('/leads', authenticate, authorize('leads:read'), leadsController.list);
router.delete('/leads/:id', authenticate, authorize('leads:delete'), leadsController.delete);
```

---

## 3. Proteção de Dados

### 3.1 Dados Sensíveis

| Campo | Classificação | Tratamento |
|-------|---------------|------------|
| password | Crítico | Hash bcrypt, nunca logar |
| refreshToken | Crítico | Hash SHA-256, Redis |
| email | PII | Criptografar em repouso |
| phone | PII | Criptografar em repouso |
| API keys | Secreto | Criptografar AES-256 |

### 3.2 Criptografia em Repouso

```typescript
// utils/encryption.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 3.3 Mascaramento de Dados

```typescript
// utils/masking.ts

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const maskedLocal = local.charAt(0) + '***' + local.charAt(local.length - 1);
  return `${maskedLocal}@${domain}`;
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{2})(\d+)(\d{2})/, '$1*****$3');
}

// Exemplo
// maskEmail('joao.silva@email.com') => 'j***a@email.com'
// maskPhone('+5511999999999') => '+55*****99'
```

### 3.4 Sanitização de Input

```typescript
// middleware/sanitize.ts

import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export function sanitizeInput(input: unknown): unknown {
  if (typeof input === 'string') {
    // Remove HTML/scripts
    let sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    // Trim whitespace
    sanitized = sanitized.trim();
    return sanitized;
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

// Validação específica
export const validators = {
  email: (value: string) => validator.isEmail(value),
  url: (value: string) => validator.isURL(value, { require_protocol: true }),
  phone: (value: string) => validator.isMobilePhone(value, 'any'),
  uuid: (value: string) => validator.isUUID(value),
};
```

---

## 4. Segurança de API

### 4.1 Headers de Segurança

```typescript
// middleware/security-headers.ts

import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.API_URL],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});
```

### 4.2 CORS

```typescript
// config/cors.ts

import cors from 'cors';

const allowedOrigins = [
  process.env.WEB_URL,           // https://app.snapleads.com
];

export const corsConfig = cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (mobile apps, Postman)
    if (!origin) return callback(null, true);

    // Permite requests da extensão Chrome (validado por ID, não por origin)
    if (origin?.startsWith('chrome-extension://')) {
      const extensionId = process.env.CHROME_EXTENSION_ID;
      if (extensionId) {
        // Valida que o origin bate com o ID da extensão configurado
        const expectedOrigin = `chrome-extension://${extensionId}`;
        if (origin === expectedOrigin) {
          return callback(null, true);
        }
      }
      return callback(new Error('Invalid extension ID'));
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 horas
});
```

**Nota de Segurança:**
- ❌ **NÃO** use `chrome-extension://*` no CORS - isso permitiria que qualquer extensão acesse sua API
- ✅ Use `CHROME_EXTENSION_ID` para validar que apenas sua extensão específica pode fazer requests
- ✅ A API valida o `Origin` header dos requests da extensão contra o ID configurado

### 4.3 Rate Limiting Global

```typescript
// middleware/rate-limit.ts

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

export const globalRateLimit = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto
  message: {
    success: false,
    error: {
      type: 'rate_limited',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Você excedeu o limite de requisições. Tente novamente em breve.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usa user ID se autenticado, senão IP
    return req.user?.id || req.ip;
  },
});

// Rate limits específicos
export const importRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Limite de importações atingido' },
});

export const messageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Limite de mensagens atingido' },
});
```

### 4.4 Request Validation

```typescript
// middleware/validate.ts

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validate<T extends z.ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Failed',
            status: 400,
            errors: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }
      next(error);
    }
  };
}

// Schemas de exemplo
export const createLeadSchema = z.object({
  body: z.object({
    platform: z.enum(['instagram', 'facebook', 'linkedin', /* ... */]),
    username: z.string().min(1).max(100).optional(),
    fullName: z.string().min(1).max(200).optional(),
    profileUrl: z.string().url().optional(),
    email: z.string().email().optional(),
    phone: z.string().regex(/^\+?[\d\s-]+$/).optional(),
  }),
});
```

---

## 5. Logging e Auditoria

### 5.1 Structured Logging

```typescript
// utils/logger.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    env: process.env.NODE_ENV,
    service: 'snapleads-api',
  },
  redact: {
    paths: [
      'password',
      'passwordHash',
      'refreshToken',
      'accessToken',
      'authorization',
      '*.password',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
});

// Uso
logger.info({ userId: 'usr_123', action: 'login' }, 'User logged in');
logger.error({ err, requestId: 'req_456' }, 'Failed to process request');
```

### 5.2 Audit Trail

```typescript
// services/audit.ts

interface AuditEvent {
  action: string;
  userId: string;
  workspaceId: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  ip: string;
  userAgent: string;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  await prisma.auditLog.create({
    data: {
      ...event,
      timestamp: new Date(),
    },
  });
  
  // Também envia para sistema de logs externo
  logger.info({ audit: true, ...event }, `Audit: ${event.action}`);
}

// Uso
await logAuditEvent({
  action: 'lead.deleted',
  userId: req.user.id,
  workspaceId: req.user.workspaceId,
  resourceType: 'lead',
  resourceId: leadId,
  ip: req.ip,
  userAgent: req.headers['user-agent'] || 'unknown',
});
```

### 5.3 Request Logging Middleware

```typescript
// middleware/request-logger.ts

import { v4 as uuidv4 } from 'uuid';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const startTime = Date.now();
  
  // Adiciona request ID ao request e response
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Log na entrada
  logger.info({
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userId: req.user?.id,
    ip: req.ip,
  }, 'Request started');
  
  // Log na saída
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
    }, 'Request completed');
  });
  
  next();
}
```

---

## 6. Segurança da Extensão

### 6.1 Content Security Policy

```json
// manifest.json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### 6.2 Comunicação Segura

```typescript
// extension/background/api-client.ts

const API_URL = 'https://api.snapleads.com/v1';

class SecureApiClient {
  private token: string | null = null;
  
  async setToken(token: string): Promise<void> {
    this.token = token;
    // Armazena de forma segura
    await chrome.storage.local.set({ 
      authToken: await this.encryptToken(token) 
    });
  }
  
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        'X-Extension-Version': chrome.runtime.getManifest().version,
        ...options.headers,
      },
    });
    
    if (response.status === 401) {
      // Token expirado, tenta refresh
      await this.refreshToken();
      return this.request(endpoint, options);
    }
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return response.json();
  }
  
  private async encryptToken(token: string): Promise<string> {
    // Usa Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Retorna IV + encrypted como base64
    return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
  }
}
```

### 6.3 Rate Limiting Local

```typescript
// extension/utils/rate-limiter.ts

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const PLATFORM_LIMITS: Record<string, RateLimitConfig> = {
  instagram: { maxRequests: 100, windowMs: 3600000 }, // 100/hora
  facebook: { maxRequests: 100, windowMs: 3600000 },
  linkedin: { maxRequests: 50, windowMs: 3600000 },   // Mais restritivo
};

class LocalRateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  async canMakeRequest(platform: string): Promise<boolean> {
    const config = PLATFORM_LIMITS[platform];
    if (!config) return true;
    
    const key = platform;
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Recupera requests do storage
    const stored = await chrome.storage.local.get(`rl_${key}`);
    let requests: number[] = stored[`rl_${key}`] || [];
    
    // Filtra requests dentro da janela
    requests = requests.filter(t => t > windowStart);
    
    if (requests.length >= config.maxRequests) {
      return false;
    }
    
    // Registra novo request
    requests.push(now);
    await chrome.storage.local.set({ [`rl_${key}`]: requests });
    
    return true;
  }
  
  async getRemainingRequests(platform: string): Promise<number> {
    const config = PLATFORM_LIMITS[platform];
    if (!config) return Infinity;
    
    const stored = await chrome.storage.local.get(`rl_${platform}`);
    const requests: number[] = stored[`rl_${platform}`] || [];
    const windowStart = Date.now() - config.windowMs;
    const validRequests = requests.filter(t => t > windowStart);
    
    return Math.max(0, config.maxRequests - validRequests.length);
  }
}
```

---

## 7. Checklist de Segurança MVP

### 7.1 Antes do Deploy

- [ ] Todas as variáveis de ambiente sensíveis estão configuradas
- [ ] JWT_SECRET é uma string aleatória de pelo menos 32 bytes
- [ ] ENCRYPTION_KEY é uma chave AES-256 válida
- [ ] DATABASE_URL usa SSL (sslmode=require)
- [ ] CORS está configurado apenas para domínios permitidos
- [ ] Rate limiting está ativo em todos os endpoints
- [ ] Logs não contêm dados sensíveis
- [ ] Todas as senhas são hasheadas com bcrypt
- [ ] HTTPS está forçado (redirect de HTTP)

### 7.2 Monitoramento Contínuo

- [ ] Alertas para tentativas de login falhadas (>10/min)
- [ ] Alertas para rate limit excedido (>5% das requests)
- [ ] Alertas para erros 5xx (>1% das requests)
- [ ] Logs de auditoria acessíveis para revisão
- [ ] Backup de banco de dados verificado

### 7.3 Revisão Periódica

| Item | Frequência |
|------|------------|
| Rotação de JWT_SECRET | 90 dias |
| Revisão de permissões | 30 dias |
| Audit log review | Semanal |
| Dependency update | Semanal |
| Penetration test | Pré-produção |

---

## 8. Variáveis de Ambiente

```bash
# .env.example

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/snapleads?sslmode=require"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
JWT_SECRET="your-super-secret-jwt-key-at-least-32-chars"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="30d"

# Encryption
ENCRYPTION_KEY="64-char-hex-string-for-aes-256"

# CORS
WEB_URL="https://app.snapleads.com"
CHROME_EXTENSION_ID="your-extension-id-here"

# Rate Limiting
RATE_LIMIT_WINDOW_MS="60000"
RATE_LIMIT_MAX="100"

# Logging
LOG_LEVEL="info"
```

---

## 9. Recursos Adicionais

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Chrome Extension Security](https://developer.chrome.com/docs/extensions/mv3/security/)
