# ⚡ Erro Database Connection - Correção Rápida

## 🔴 Erro

`Can't reach database server at :5432`

## ✅ Solução

### 1. Verificar DATABASE_URL no Render
- Render → Settings → Environment
- Verificar se `DATABASE_URL` existe e não está vazia

### 2. Formato Correto

```
postgresql://usuario:senha@host:5432/database
```

**Exemplo:**
```
postgresql://postgres:senha123@dpg-abc123-a.oregon-postgres.render.com:5432/lia360_db
```

### 3. Verificar nos Logs

Deve aparecer:
```
[Database] DATABASE_URL hostname: [hostname]
[Database] Prisma Client initialized successfully
```

### 4. Se não aparecer hostname

- URL está malformada
- Adicione hostname completo na URL

---

**Guia completo:** `CORRIGIR_DATABASE_CONNECTION.md`
