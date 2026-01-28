# Atualização do Middleware de Autenticação para RLS

Este arquivo contém as instruções para atualizar o middleware de autenticação (`apps/api/src/middleware/auth.ts`) para definir as variáveis de sessão do PostgreSQL necessárias para as políticas RLS.

## Modificação Necessária

Adicione o seguinte código na função `authenticate()`, logo **APÓS** a validação do workspace member e **ANTES** de definir `req.user`:

```typescript
// Definir variáveis de sessão do PostgreSQL para RLS
// IMPORTANTE: Usar Prisma.$executeRaw com template literal para evitar SQL injection
await prisma.$executeRaw`SET LOCAL app.user_id = ${payload.sub}`;
await prisma.$executeRaw`SET LOCAL app.workspace_id = ${payload.workspaceId}`;
await prisma.$executeRaw`SET LOCAL app.company_id = ${payload.companyId}`;
```

## Localização Exata no Código

Inserir entre as linhas 87 e 89 do arquivo atual. O código final ficará assim:

```typescript
if (!workspaceMember) {
  throw new UnauthorizedError("Usuário não tem acesso a este workspace");
}

// Definir variáveis de sessão do PostgreSQL para RLS
// IMPORTANTE: Usar Prisma.$executeRaw com template literal para evitar SQL injection
await prisma.$executeRaw`SET LOCAL app.user_id = ${payload.sub}`;
await prisma.$executeRaw`SET LOCAL app.workspace_id = ${payload.workspaceId}`;
await prisma.$executeRaw`SET LOCAL app.company_id = ${payload.companyId}`;

req.user = {
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  companyId: payload.companyId,
  companyRole: companyMember.role as CompanyRole,
  workspaceId: payload.workspaceId,
  workspaceRole: workspaceMember.role as WorkspaceRole,
};
```

## Segurança

**✅ Correto:** Usar `prisma.$executeRaw` com template literals (backticks)

- O Prisma sanitiza automaticamente os valores
- Evita SQL injection mesmo se o JWT for comprometido

**❌ NUNCA USAR:** `prisma.$executeRawUnsafe` com interpolação de strings

```typescript
// NÃO FAÇA ISSO - vulnerável a SQL injection!
await prisma.$executeRawUnsafe(`SET LOCAL app.user_id = '${payload.sub}'`);
```

## Como Testar

Após fazer a modificação:

1. Reinicie o servidor API: `npm run api:dev`

2. Faça login via API e pegue um token JWT válido

3. Faça uma requisição autenticada para qualquer endpoint (ex: GET /api/v1/leads)

4. No console do Neon, execute:

```sql
-- Verificar se as variáveis de sessão foram definidas
SELECT
  current_setting('app.user_id', true) as user_id,
  current_setting('app.workspace_id', true) as workspace_id,
  current_setting('app.company_id', true) as company_id;
```

5. Verifique se retorna os valores corretos do JWT

## Troubleshooting

**Problema:** Queries retornam zero resultados após implementar RLS

**Causa:** Variáveis de sessão não foram definidas

**Solução:**

- Verifique se o middleware foi atualizado corretamente
- Confirme que as requisições passam pelo middleware `authenticate`
- Execute a query de teste acima para confirmar os valores

**Problema:** Erro "unrecognized configuration parameter"

**Causa:** PostgreSQL não permite variáveis customizadas por padrão

**Solução:** As variáveis com prefixo `app.` são permitidas por padrão no PostgreSQL 9.2+. O Neon usa PostgreSQL 15+, então deve funcionar sem problemas.

## Reversão

Para desabilitar RLS temporariamente (em caso de problemas):

```sql
-- Desabilitar RLS em todas as tabelas
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;
-- ... (repetir para todas as tabelas)
```

Ou execute:

```sql
-- Desabilitar RLS em TODAS as tabelas do schema public
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

## Próximos Passos

Após implementar:

1. ✅ Executar `rls_implementation.sql` no console do Neon
2. ✅ Atualizar o middleware conforme este documento
3. ✅ Testar com usuários de diferentes workspaces
4. ✅ Verificar logs de aplicação para erros
5. ✅ Executar testes E2E se disponíveis
6. ✅ Monitorar performance (overhead esperado <5ms por query)
