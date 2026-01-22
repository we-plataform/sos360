# Guia Completo de Row-Level Security (RLS) - SOS360

## 📋 Resumo Executivo

Este guia documenta a implementação completa de Row-Level Security (RLS) no PostgreSQL/Neon para a plataforma SOS360, garantindo isolamento de dados multi-tenant no nível do banco de dados.

**Status:** ✅ Código SQL completo pronto para execução
**Tabelas cobertas:** 40 tabelas
**Políticas criadas:** ~150+ políticas RLS
**Funções auxiliares:** 6 funções no schema `auth`

---

## 🎯 O Que É RLS e Por Que Implementar?

### O Problema

Atualmente, o isolamento de dados multi-tenant da SOS360 depende **apenas** da camada de aplicação:

```typescript
// ANTES: Segurança APENAS na aplicação
const leads = await prisma.lead.findMany({
  where: { workspaceId: req.user.workspaceId } // Se esquecer isso = vazamento de dados!
});
```

**Riscos:**
- ❌ SQL injection pode acessar dados de outros tenants
- ❌ Bug na aplicação pode vazar dados entre workspaces
- ❌ Acesso direto ao banco ignora todas as proteções
- ❌ Não há última linha de defesa

### A Solução: RLS

Com RLS, o **banco de dados** garante o isolamento:

```typescript
// DEPOIS: Segurança no banco + aplicação (defesa em profundidade)
const leads = await prisma.lead.findMany({
  where: { workspaceId: req.user.workspaceId } // Filtro da aplicação
});
// + RLS garante que o PostgreSQL NUNCA retorna dados de outro workspace
```

**Benefícios:**
- ✅ Defesa em profundidade (banco + aplicação)
- ✅ Proteção contra SQL injection
- ✅ Proteção contra bugs da aplicação
- ✅ Fail-safe: queries sem contexto retornam zero resultados
- ✅ Compliance (SOC 2, GDPR, LGPD)

---

## 🏗️ Arquitetura da Solução

### Hierarquia Multi-Tenant

```
Company (entidade de billing)
  ├── Workspace 1 (boundary de isolamento)
  │   ├── Leads, Pipelines, Tags, etc.
  │   └── WorkspaceMembers (controle de acesso)
  ├── Workspace 2
  │   └── ...
  └── CompanyMembers (controle de acesso da company)
```

### Variáveis de Sessão

Cada requisição autenticada define 3 variáveis no PostgreSQL:

```typescript
SET LOCAL app.user_id = 'cuid_do_usuario';
SET LOCAL app.workspace_id = 'cuid_do_workspace';
SET LOCAL app.company_id = 'cuid_da_company';
```

Essas variáveis são usadas pelas políticas RLS para filtrar dados.

### Funções Auxiliares (Schema `auth`)

6 funções criadas para facilitar as políticas:

1. **`auth.user_id()`** - Retorna ID do usuário atual
2. **`auth.workspace_id()`** - Retorna ID do workspace atual
3. **`auth.company_id()`** - Retorna ID da company atual
4. **`auth.has_workspace_access(TEXT)`** - Verifica se o usuário é membro do workspace
5. **`auth.has_company_access(TEXT)`** - Verifica se o usuário é membro da company
6. **`auth.has_lead_access(TEXT)`** - Verifica se o usuário tem acesso ao lead (via workspace)

### Políticas RLS

Cada tabela tem 4 tipos de políticas (quando aplicável):

- **SELECT:** Quem pode ver os dados
- **INSERT:** Quem pode criar novos registros
- **UPDATE:** Quem pode modificar registros
- **DELETE:** Quem pode deletar registros

---

## 📊 Cobertura de Tabelas

### Tabelas de Hierarquia de Tenant (7 tabelas)

| Tabela | Escopo | Políticas |
|--------|--------|-----------|
| `companies` | Company | Membros veem suas companies |
| `company_members` | Company | Membros veem membros da company |
| `company_invitations` | Company | Admins gerenciam convites |
| `workspaces` | Company | Membros veem workspaces da company |
| `workspace_members` | Workspace | Membros veem membros do workspace |
| `users` | User | Usuário vê apenas seu próprio perfil |
| `refresh_tokens` | User | Usuário vê apenas seus próprios tokens |

### Tabelas de Workspace-Scoped (33 tabelas)

Todas seguem o padrão: **usuário acessa dados apenas do seu workspace**

**Pipeline:**
- `pipelines`
- `pipeline_stages`

**Leads e Perfis:**
- `leads`
- `social_profiles`
- `tags`
- `lead_tags` (junction)
- `lead_behaviors`
- `lead_addresses`

**Enriquecimento LinkedIn (16 tabelas):**
- `lead_experiences`
- `lead_educations`
- `lead_certifications`
- `lead_skills`
- `lead_languages`
- `lead_recommendations`
- `lead_volunteers`
- `lead_publications`
- `lead_patents`
- `lead_projects`
- `lead_courses`
- `lead_honors`
- `lead_organizations`
- `lead_featured`
- `lead_contact_info`
- `lead_posts`

**Comunicação:**
- `conversations`
- `messages`

**Workflow:**
- `templates`
- `automations`
- `automation_logs`

**Infraestrutura:**
- `audiences`
- `webhooks`
- `import_jobs`
- `activities`

---

## 🚀 Como Implementar

### Passo 1: Executar o SQL no Neon

1. Acesse o console do Neon: https://console.neon.tech
2. Selecione seu projeto SOS360
3. Vá em **SQL Editor**
4. Copie e cole o conteúdo do arquivo `rls_implementation.sql`
5. Execute o script completo
6. Aguarde a confirmação de sucesso

**Tempo estimado:** 2-3 minutos

### Passo 2: Atualizar o Middleware de Autenticação

1. Abra o arquivo: `apps/api/src/middleware/auth.ts`

2. Localize a função `authenticate()`, após a validação do `workspaceMember`

3. Adicione estas 3 linhas **ANTES** de definir `req.user`:

```typescript
// Definir variáveis de sessão do PostgreSQL para RLS
await prisma.$executeRaw`SET LOCAL app.user_id = ${payload.sub}`;
await prisma.$executeRaw`SET LOCAL app.workspace_id = ${payload.workspaceId}`;
await prisma.$executeRaw`SET LOCAL app.company_id = ${payload.companyId}`;
```

4. Salve o arquivo

**Arquivo completo com instruções:** `rls_middleware_update.md`

### Passo 3: Reiniciar e Testar

```bash
# Reiniciar o servidor API
npm run api:dev
```

**Testes básicos:**

1. Faça login com Usuário A (Workspace W1)
2. Crie alguns leads
3. Faça login com Usuário B (Workspace W2)
4. Verifique que Usuário B **NÃO** vê leads do Usuário A
5. Tente acessar diretamente um ID de lead do Workspace W1 com token do Workspace W2 - deve retornar 404 ou acesso negado

---

## 🧪 Testes e Verificação

### Verificar Políticas Criadas

Execute no console do Neon:

```sql
-- Listar todas as políticas RLS criadas
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Deve retornar **~150+ políticas**.

### Verificar Funções Criadas

```sql
-- Listar funções do schema auth
SELECT proname, proargnames
FROM pg_proc
WHERE pronamespace = 'auth'::regnamespace;
```

Deve retornar **6 funções**.

### Teste de Isolamento

```sql
-- 1. SEM variáveis de sessão (deve retornar 0)
SELECT COUNT(*) FROM leads;

-- 2. COM variáveis de sessão (deve retornar leads do workspace)
SET LOCAL app.user_id = 'seu_user_id';
SET LOCAL app.workspace_id = 'seu_workspace_id';
SET LOCAL app.company_id = 'sua_company_id';
SELECT COUNT(*) FROM leads;
```

### Teste de Cross-Workspace

```sql
-- Tentar acessar workspace diferente (deve retornar 0)
SET LOCAL app.user_id = 'user_do_workspace_A';
SET LOCAL app.workspace_id = 'workspace_A';

SELECT COUNT(*) FROM leads WHERE "workspaceId" = 'workspace_B';
-- Deve retornar 0 (RLS bloqueia acesso)
```

---

## 🔒 Segurança e Boas Práticas

### ✅ O Que Foi Implementado

- **Variáveis de sessão sanitizadas** via `$executeRaw` (template literals)
- **Funções SECURITY DEFINER** para verificar membros
- **Fail-safe por padrão:** queries sem contexto retornam zero resultados
- **Logs imutáveis:** `automation_logs` e `activities` não permitem UPDATE/DELETE

### ⚠️ Considerações de Performance

**Overhead esperado:** <5ms por query

**Otimizações:**
- Índices existentes em `workspaceId` aceleram o filtro RLS
- Funções STABLE são cachadas durante a transação
- `SET LOCAL` afeta apenas a transação atual (não há overhead global)

**Monitoramento:**

```sql
-- Ver queries lentas
SELECT query, mean_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- queries >100ms
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 🚨 Cenários de Rollback

Se algo der errado, você pode reverter:

**Opção 1: Desabilitar RLS em uma tabela específica**
```sql
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
```

**Opção 2: Desabilitar RLS em TODAS as tabelas**
```sql
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

**Opção 3: Dropar políticas mas manter RLS ativo**
```sql
-- Dropar todas as políticas de uma tabela
DROP POLICY IF EXISTS lead_workspace_select ON leads;
DROP POLICY IF EXISTS lead_workspace_insert ON leads;
-- etc...
```

---

## 📝 Exemplos Práticos

### Exemplo 1: Lead Isolation

```typescript
// Usuário A (Workspace W1) tenta acessar lead do Workspace W2

// JWT do Usuário A define:
// app.workspace_id = 'W1'

const lead = await prisma.lead.findUnique({
  where: { id: 'lead_do_workspace_W2' }
});

// Resultado: lead === null
// RLS bloqueou porque o lead não pertence ao workspace W1
```

### Exemplo 2: Bug na Aplicação

```typescript
// Bug: desenvolvedor esqueceu de filtrar por workspaceId
const allLeads = await prisma.lead.findMany();

// SEM RLS: retorna TODOS os leads de TODOS os workspaces (vazamento!)
// COM RLS: retorna apenas leads do workspace atual (seguro!)
```

### Exemplo 3: SQL Injection

```typescript
// Ataque de SQL injection
const maliciousInput = "'; DROP TABLE leads; --";

// SEM RLS: poderia dropar a tabela
// COM RLS: mesmo que a query seja executada, as políticas RLS limitam o acesso
```

---

## 📚 Documentação Adicional

### Arquivos Criados

1. **`rls_implementation.sql`** - Script SQL completo (execute no Neon)
2. **`rls_middleware_update.md`** - Instruções para atualizar o middleware
3. **`RLS_GUIA_COMPLETO.md`** - Este documento

### Próximos Passos Sugeridos

1. ✅ **Executar SQL no Neon** (obrigatório)
2. ✅ **Atualizar middleware** (obrigatório)
3. ✅ **Testar isolamento** (recomendado)
4. ⬜ **Criar testes E2E** para RLS (opcional)
5. ⬜ **Documentar no README principal** (recomendado)
6. ⬜ **Adicionar monitoramento de performance** (opcional)

### Recursos Úteis

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Neon PostgreSQL Guide](https://neon.tech/docs)
- [Prisma Raw Queries](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access)

---

## 🆘 Troubleshooting

### Problema: Queries retornam zero resultados

**Causa:** Variáveis de sessão não foram definidas

**Solução:**
1. Verifique se o middleware foi atualizado
2. Confirme que a requisição passa pelo middleware `authenticate`
3. Execute no Neon:
```sql
SELECT current_setting('app.user_id', true);
```
Se retornar vazio, o middleware não está definindo as variáveis.

### Problema: Erro "permission denied for schema auth"

**Causa:** Schema auth não foi criado ou usuário não tem permissões

**Solução:**
```sql
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO public;
```

### Problema: Performance degradada

**Causa:** Políticas RLS complexas ou falta de índices

**Solução:**
1. Analise queries lentas:
```sql
EXPLAIN ANALYZE SELECT * FROM leads WHERE "workspaceId" = 'xxx';
```
2. Verifique índices:
```sql
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public';
```
3. Se necessário, adicione índices em colunas usadas nas políticas

### Problema: RLS não está sendo aplicado

**Causa:** RLS não foi habilitado na tabela

**Solução:**
```sql
-- Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Habilitar RLS se necessário
ALTER TABLE nome_da_tabela ENABLE ROW LEVEL SECURITY;
```

---

## ✅ Checklist de Implementação

Antes de marcar como concluído:

- [ ] SQL executado com sucesso no Neon
- [ ] Funções `auth.*` criadas e testadas
- [ ] Middleware de autenticação atualizado
- [ ] Servidor API reiniciado
- [ ] Teste básico de isolamento funcionando
- [ ] Verificação de políticas (150+ políticas criadas)
- [ ] Teste com 2+ usuários de diferentes workspaces
- [ ] Performance aceitável (<5ms overhead)
- [ ] Documentação revisada
- [ ] Equipe informada sobre mudanças

---

## 📞 Suporte

Em caso de dúvidas ou problemas:

1. Consulte a seção **Troubleshooting** acima
2. Verifique os logs da aplicação
3. Execute os comandos de verificação SQL
4. Revise o código do middleware de autenticação

**Importante:** Não remova ou desabilite RLS sem consultar a equipe de segurança/arquitetura.

---

**Última atualização:** 2026-01-22
**Versão:** 1.0
**Status:** Pronto para implementação
