# Solução Definitiva: Erro de Conexão Prisma com Banco de Dados

## Problema

```
PrismaClientInitializationError: Can't reach database server at '...:5432'
```

Este erro indica que o Prisma não consegue conectar ao banco de dados PostgreSQL.

---

## Causa Raiz

O erro ocorre quando a variável `DATABASE_URL` está:

- ❌ Não configurada no Render
- ❌ Vazia ou com valor incorreto
- ❌ Com formato inválido (sem hostname)
- ❌ Com credenciais incorretas
- ❌ Apontando para um banco inacessível

---

## Solução Passo a Passo

### 1. Verificar sua DATABASE_URL no Supabase

1. Acesse [app.supabase.com](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Settings** > **Database**
4. Role até **Connection string**
5. Copie a **URI** no modo **Transaction (Pooler)** para porta 6543

**Formato esperado:**

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 2. Configurar no Render

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Selecione seu serviço **lia360-api**
3. Vá em **Environment** (menu lateral)
4. Configure as seguintes variáveis:

| Variável       | Valor                                                                                                 | Obrigatório    |
| -------------- | ----------------------------------------------------------------------------------------------------- | -------------- |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[SENHA]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` | ✅ Sim         |
| `DIRECT_URL`   | `postgresql://postgres.[REF]:[SENHA]@aws-0-[REGION].pooler.supabase.com:5432/postgres`                | ⚠️ Recomendado |
| `JWT_SECRET`   | (string com 32+ caracteres)                                                                           | ✅ Sim         |
| `NODE_ENV`     | `production`                                                                                          | ✅ Sim         |
| `CORS_ORIGINS` | `https://lia360-web-black.vercel.app,https://*.vercel.app`                                            | ✅ Sim         |

### 3. Verificar a Senha

**IMPORTANTE:** Se sua senha contém caracteres especiais, você DEVE encodá-los:

| Caractere    | Encoded |
| ------------ | ------- |
| `@`          | `%40`   |
| `#`          | `%23`   |
| `!`          | `%21`   |
| `$`          | `%24`   |
| `%`          | `%25`   |
| `&`          | `%26`   |
| `=`          | `%3D`   |
| `+`          | `%2B`   |
| ` ` (espaço) | `%20`   |

**Exemplo:**

- Senha original: `Senha@123#`
- Senha encoded: `Senha%40123%23`

### 4. Fazer Deploy

Após salvar as variáveis:

1. O Render vai automaticamente fazer redeploy
2. Aguarde 2-3 minutos
3. Verifique os logs

### 5. Verificar se Funcionou

Acesse no navegador:

```
https://sua-api.onrender.com/health/detailed
```

**Resposta esperada (sucesso):**

```json
{
  "status": "healthy",
  "services": {
    "database": {
      "status": "healthy",
      "connected": true,
      "latency": 50
    }
  }
}
```

**Resposta com erro:**

```json
{
  "status": "unhealthy",
  "services": {
    "database": {
      "status": "unhealthy",
      "connected": false,
      "error": "Can't reach database server..."
    }
  }
}
```

---

## Checklist de Verificação

- [ ] `DATABASE_URL` está configurada no Render
- [ ] `DATABASE_URL` usa porta **6543** (não 5432) com `?pgbouncer=true`
- [ ] `DIRECT_URL` usa porta **5432** (sem pgbouncer)
- [ ] Senha está corretamente encoded (se tem caracteres especiais)
- [ ] O hostname está correto (não é placeholder)
- [ ] `NODE_ENV=production` está configurado
- [ ] `JWT_SECRET` tem pelo menos 32 caracteres

---

## Troubleshooting

### Erro: "DATABASE_URL is required but not set"

**Causa:** Variável não existe no Render
**Solução:** Adicione a variável DATABASE_URL no Environment do Render

### Erro: "DATABASE_URL missing hostname"

**Causa:** URL malformada
**Solução:** Verifique se a URL completa está no formato correto

### Erro: "password authentication failed"

**Causa:** Senha incorreta ou mal encoded
**Solução:**

1. Verifique a senha no Supabase
2. Encode caracteres especiais

### Erro: "Can't reach database server at host:5432"

**Causa:** Usando porta errada ou host inacessível
**Solução:**

1. Use porta **6543** com `?pgbouncer=true`
2. Verifique se o projeto Supabase está ativo

### Erro: "Connection refused"

**Causa:** Firewall ou rede bloqueando
**Solução:**

1. Verifique se o projeto Supabase está pausado
2. Verifique se há restrições de IP no Supabase

---

## Exemplo Completo de Configuração

### Supabase (seu banco)

- Project ref: `doewttvwknkhjzhzceub`
- Region: `sa-east-1`
- Senha: `MinhaSenh@Forte123`

### DATABASE_URL (porta 6543 + pgbouncer)

```
postgresql://postgres.doewttvwknkhjzhzceub:MinhaSenh%40Forte123@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### DIRECT_URL (porta 5432, para migrations)

```
postgresql://postgres.doewttvwknkhjzhzceub:MinhaSenh%40Forte123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

---

## Endpoints de Diagnóstico

| Endpoint               | Descrição                                |
| ---------------------- | ---------------------------------------- |
| `GET /health`          | Health check básico                      |
| `GET /health/detailed` | Health check detalhado com info do banco |
| `POST /health/test-db` | Testa conexão do banco com retry         |

---

## Suporte

Se o problema persistir após seguir todos os passos:

1. Verifique os logs completos no Render
2. Acesse `/health/detailed` para ver detalhes
3. Confirme que o projeto Supabase não está pausado
4. Verifique se há mensagens de erro específicas nos logs

**Logs importantes a procurar:**

```
[Database] DATABASE_URL validated:
[Database]   - Hostname: aws-0-sa-east-1.pooler.supabase.com
[Database]   - Port: 6543
[Database] ✓ Database connected successfully
```

Se vir:

```
[Database] ✗ Database connection failed after retries
```

Significa que as credenciais ou a rede estão impedindo a conexão.
