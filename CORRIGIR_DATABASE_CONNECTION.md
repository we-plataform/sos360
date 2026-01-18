# 🔧 Correção Definitiva: Erro de Conexão com Banco de Dados

## 🔴 Problema Identificado

**Erro:** `Can't reach database server at :5432`

**Causa:** A variável `DATABASE_URL` no Render está:
- ❌ Não configurada
- ❌ Vazia
- ❌ Malformada (sem hostname)

O Prisma está tentando conectar em `:5432` sem host, o que indica que a URL está incompleta.

---

## ✅ Solução Definitiva

### 1. Verificar DATABASE_URL no Render

1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Selecione seu serviço da API
3. Vá em **Settings** → **Environment**
4. Encontre a variável `DATABASE_URL`
5. Verifique se está configurada e não está vazia

### 2. Configurar DATABASE_URL Corretamente

A `DATABASE_URL` deve seguir o formato PostgreSQL:

```
postgresql://[usuario]:[senha]@[host]:[porta]/[database]?[opcoes]
```

#### Opção A: Se você tem PostgreSQL no Render

1. No Render, crie um **PostgreSQL Database**
2. Após criar, vá em **Info** → **Internal Database URL**
3. Copie a URL completa
4. Use essa URL como `DATABASE_URL`

#### Opção B: Se você usa PostgreSQL externo (Supabase, Railway, etc.)

Use a URL de conexão fornecida pelo serviço:

**Formato Supabase:**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Formato Railway PostgreSQL:**
```
postgresql://postgres:[PASSWORD]@[HOST]:5432/railway
```

**Formato PostgreSQL padrão:**
```
postgresql://postgres:senha@host:5432/database
```

### 3. Exemplo de DATABASE_URL Válida

```
postgresql://postgres:minhasenha123@dpg-abc123-a.oregon-postgres.render.com:5432/sos360_db
```

**Componentes:**
- `postgres` = usuário
- `minhasenha123` = senha
- `dpg-abc123-a.oregon-postgres.render.com` = hostname
- `5432` = porta
- `sos360_db` = nome do banco

### 4. Configurar no Render

1. No Render, vá em **Settings** → **Environment**
2. Encontre ou crie `DATABASE_URL`
3. Cole a URL completa (exemplo acima)
4. **IMPORTANTE:** Certifique-se de que:
   - ✅ Não há espaços no início ou fim
   - ✅ A URL está completa (com hostname)
   - ✅ A senha está correta
   - ✅ O hostname está acessível

### 5. Verificar DIRECT_URL (Opcional mas Recomendado)

Se você usa Supabase ou pgbouncer, também configure `DIRECT_URL`:

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Diferença:**
- `DATABASE_URL`: Usa porta `6543` com `?pgbouncer=true` (para operações normais)
- `DIRECT_URL`: Usa porta `5432` sem pgbouncer (para migrations)

### 6. Fazer Redeploy

Após configurar:

1. Salve as variáveis
2. O Render fará redeploy automático
3. Aguarde alguns minutos
4. Verifique os logs

---

## 🔍 Verificação nos Logs

Após o redeploy, verifique os logs. Deve aparecer:

```
[Database] Initializing Prisma Client...
[Database] DATABASE_URL set: true
[Database] DATABASE_URL length: [número maior que 0]
[Database] DATABASE_URL preview: postgresql://postgres:...
[Database] DATABASE_URL hostname: dpg-abc123-a.oregon-postgres.render.com
[Database] DATABASE_URL port: 5432
[Database] Prisma Client initialized successfully
```

**Se aparecer:**
- `DATABASE_URL set: false` → Variável não está configurada
- `DATABASE_URL length: 0` → Variável está vazia
- `DATABASE_URL hostname: (vazio)` → URL está malformada

---

## 🐛 Troubleshooting

### Problema 1: DATABASE_URL não está configurada

**Sintoma:** `DATABASE_URL set: false` nos logs

**Solução:**
1. Verifique se a variável existe no Render
2. Certifique-se de que o nome está correto: `DATABASE_URL` (maiúsculas)
3. Adicione a variável se não existir

### Problema 2: DATABASE_URL está vazia

**Sintoma:** `DATABASE_URL length: 0` nos logs

**Solução:**
1. Edite a variável no Render
2. Certifique-se de que há um valor
3. Não deixe espaços em branco

### Problema 3: DATABASE_URL malformada

**Sintoma:** `Invalid DATABASE_URL format` ou `missing hostname`

**Solução:**
1. Verifique o formato da URL
2. Certifique-se de que inclui:
   - ✅ Protocolo: `postgresql://`
   - ✅ Usuário: `postgres`
   - ✅ Senha: `senha`
   - ✅ Hostname: `host.com` (não pode estar vazio!)
   - ✅ Porta: `5432`
   - ✅ Database: `nome_do_banco`

### Problema 4: Hostname não acessível

**Sintoma:** `Can't reach database server at host:5432`

**Solução:**
1. Verifique se o banco está rodando
2. Verifique se o hostname está correto
3. Se usar Render PostgreSQL, use a **Internal Database URL** (não a pública)
4. Verifique firewall/security groups

### Problema 5: Senha incorreta

**Sintoma:** `password authentication failed`

**Solução:**
1. Verifique se a senha está correta
2. Se usar caracteres especiais, encode-os na URL:
   - `@` → `%40`
   - `#` → `%23`
   - Espaço → `%20` ou `+`

---

## 📋 Checklist de Correção

- [ ] `DATABASE_URL` existe no Render
- [ ] `DATABASE_URL` não está vazia
- [ ] `DATABASE_URL` tem formato correto: `postgresql://user:pass@host:port/db`
- [ ] `DATABASE_URL` inclui hostname (não está vazio)
- [ ] Senha está correta e codificada (se necessário)
- [ ] `DIRECT_URL` configurada (se usar pgbouncer)
- [ ] Redeploy feito
- [ ] Logs mostram `DATABASE_URL hostname: [hostname]`
- [ ] Logs mostram `Prisma Client initialized successfully`

---

## 💡 Exemplos de URLs Válidas

### Render PostgreSQL (Internal)
```
postgresql://postgres:senha@dpg-abc123-a.oregon-postgres.render.com:5432/sos360_db
```

### Supabase (com pgbouncer)
```
postgresql://postgres.abc123:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Railway PostgreSQL
```
postgresql://postgres:senha@containers-us-west-123.railway.app:5432/railway
```

### PostgreSQL Local/Docker
```
postgresql://postgres:postgres@localhost:5432/sos360?schema=public
```

---

## 🔒 Segurança

⚠️ **IMPORTANTE:**
- `DATABASE_URL` contém credenciais sensíveis
- **NUNCA** commite no Git
- Use apenas variáveis de ambiente
- Rotacione senhas regularmente

---

**Após corrigir, o erro de conexão deve ser resolvido!** 🎉
