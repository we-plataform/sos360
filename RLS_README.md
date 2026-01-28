# Row-Level Security (RLS) - Instruções Rápidas

## 📦 Arquivos Incluídos

1. **`rls_implementation.sql`** - Script SQL completo (execute no Neon)
2. **`rls_verification.sql`** - Script de verificação (execute após o #1)
3. **`rls_middleware_update.md`** - Instruções para atualizar o código TypeScript
4. **`RLS_GUIA_COMPLETO.md`** - Documentação completa (leia para detalhes)

---

## ⚡ Execução Rápida (3 Passos)

### Passo 1: Executar SQL no Neon (5 min)

1. Acesse: https://console.neon.tech
2. Selecione o projeto Lia360
3. Vá em **SQL Editor**
4. Copie todo o conteúdo de `rls_implementation.sql`
5. Cole e execute
6. Aguarde confirmação (deve levar ~2 minutos)

**Verificar se funcionou:**

- Execute o script `rls_verification.sql` no mesmo SQL Editor
- Deve mostrar: ✅ 6 funções auth, ✅ 40 tabelas com RLS, ✅ 150+ políticas

---

### Passo 2: Atualizar Middleware (2 min)

Abra: `apps/api/src/middleware/auth.ts`

Adicione estas 3 linhas na função `authenticate()`, após validar `workspaceMember` e antes de definir `req.user`:

```typescript
// Definir variáveis de sessão do PostgreSQL para RLS
await prisma.$executeRaw`SET LOCAL app.user_id = ${payload.sub}`;
await prisma.$executeRaw`SET LOCAL app.workspace_id = ${payload.workspaceId}`;
await prisma.$executeRaw`SET LOCAL app.company_id = ${payload.companyId}`;
```

**Localização exata:** Entre as linhas 87 e 89 do arquivo atual.

**Instruções detalhadas:** `rls_middleware_update.md`

---

### Passo 3: Testar (3 min)

```bash
# Reiniciar API
npm run api:dev
```

**Teste básico:**

1. Faça login com Usuário A (Workspace W1)
2. Crie um lead
3. Faça login com Usuário B (Workspace W2)
4. Liste leads → Usuário B **NÃO** deve ver o lead do Usuário A ✅

---

## ✅ Checklist Mínimo

- [ ] SQL executado com sucesso no Neon
- [ ] Script de verificação passou (todas as ✅)
- [ ] Middleware atualizado (3 linhas adicionadas)
- [ ] API reiniciada
- [ ] Teste de isolamento entre workspaces funcionou

---

## 📚 Documentação

- **Guia completo:** `RLS_GUIA_COMPLETO.md`
- **Arquitetura, troubleshooting, exemplos:** Tudo no guia completo

---

## 🆘 Problemas?

### Erro: "unrecognized configuration parameter"

**Solução:** O Neon usa PostgreSQL 15+, isso não deve acontecer. Verifique se executou o SQL completo.

### Queries retornam zero resultados

**Solução:** Variáveis de sessão não foram definidas. Verifique se o middleware foi atualizado corretamente.

### RLS não está filtrando

**Solução:** Execute `rls_verification.sql` para verificar se todas as políticas foram criadas.

---

## 🔄 Rollback (Se Necessário)

Para desabilitar RLS temporariamente:

```sql
-- Desabilitar em todas as tabelas
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;
```

---

## 🎯 Benefícios Implementados

✅ **Defesa em profundidade** - Banco garante isolamento mesmo se a aplicação falhar
✅ **Proteção contra SQL injection** - Queries maliciosas não vazam dados
✅ **Proteção contra bugs** - Esqueceu de filtrar por workspace? RLS protege
✅ **Fail-safe** - Sem contexto = zero resultados
✅ **Compliance** - SOC 2, GDPR, LGPD

---

**Pronto para produção:** ✅
**Tempo total de implementação:** ~10 minutos
**Risco:** Baixo (pode reverter facilmente se necessário)
