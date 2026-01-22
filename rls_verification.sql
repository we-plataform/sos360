-- ============================================
-- SCRIPT DE VERIFICAÇÃO RLS
-- Execute este script APÓS aplicar rls_implementation.sql
-- ============================================

-- ============================================
-- 1. VERIFICAR FUNÇÕES AUTH
-- ============================================
\echo '=== Verificando Funções Auth ==='
SELECT
  proname as "Nome da Função",
  pg_get_function_arguments(oid) as "Argumentos",
  pg_get_functiondef(oid) as "Definição"
FROM pg_proc
WHERE pronamespace = 'auth'::regnamespace
ORDER BY proname;

-- Esperado: 6 funções
-- - user_id()
-- - workspace_id()
-- - company_id()
-- - has_workspace_access(TEXT)
-- - has_company_access(TEXT)
-- - has_lead_access(TEXT)

\echo ''
\echo '=== Resumo de Funções Auth ==='
SELECT
  COUNT(*) as "Total de Funções",
  array_agg(proname ORDER BY proname) as "Funções Criadas"
FROM pg_proc
WHERE pronamespace = 'auth'::regnamespace;

-- ============================================
-- 2. VERIFICAR RLS HABILITADO NAS TABELAS
-- ============================================
\echo ''
\echo '=== Verificando RLS Habilitado por Tabela ==='
SELECT
  schemaname as "Schema",
  tablename as "Tabela",
  rowsecurity as "RLS Habilitado"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

\echo ''
\echo '=== Resumo RLS ==='
SELECT
  COUNT(*) as "Total de Tabelas",
  SUM(CASE WHEN rowsecurity THEN 1 ELSE 0 END) as "Tabelas com RLS",
  SUM(CASE WHEN NOT rowsecurity THEN 1 ELSE 0 END) as "Tabelas sem RLS"
FROM pg_tables
WHERE schemaname = 'public';

-- Esperado: 40 tabelas com RLS habilitado

-- ============================================
-- 3. VERIFICAR POLÍTICAS CRIADAS
-- ============================================
\echo ''
\echo '=== Políticas RLS por Tabela ==='
SELECT
  tablename as "Tabela",
  COUNT(*) as "Nº de Políticas",
  array_agg(policyname ORDER BY policyname) as "Nomes das Políticas"
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

\echo ''
\echo '=== Políticas por Tipo de Comando ==='
SELECT
  cmd as "Comando",
  COUNT(*) as "Nº de Políticas"
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY cmd
ORDER BY cmd;

-- Esperado: SELECT, INSERT, UPDATE, DELETE

\echo ''
\echo '=== Total de Políticas ==='
SELECT
  COUNT(*) as "Total de Políticas RLS"
FROM pg_policies
WHERE schemaname = 'public';

-- Esperado: ~150+ políticas

-- ============================================
-- 4. VERIFICAR POLÍTICAS ESPECÍFICAS CRÍTICAS
-- ============================================
\echo ''
\echo '=== Verificando Políticas Críticas ==='

-- Verificar políticas da tabela leads
SELECT
  'leads' as "Tabela",
  COUNT(*) as "Políticas",
  array_agg(policyname) as "Nomes"
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'leads';

-- Verificar políticas da tabela users
SELECT
  'users' as "Tabela",
  COUNT(*) as "Políticas",
  array_agg(policyname) as "Nomes"
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users';

-- Verificar políticas da tabela companies
SELECT
  'companies' as "Tabela",
  COUNT(*) as "Políticas",
  array_agg(policyname) as "Nomes"
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'companies';

-- ============================================
-- 5. TESTAR FUNÇÕES AUTH (SEM CONTEXTO)
-- ============================================
\echo ''
\echo '=== Testando Funções Auth (sem contexto) ==='

SELECT
  'auth.user_id()' as "Função",
  auth.user_id() as "Resultado",
  CASE WHEN auth.user_id() IS NULL THEN '✅ OK (NULL esperado)' ELSE '❌ ERRO' END as "Status";

SELECT
  'auth.workspace_id()' as "Função",
  auth.workspace_id() as "Resultado",
  CASE WHEN auth.workspace_id() IS NULL THEN '✅ OK (NULL esperado)' ELSE '❌ ERRO' END as "Status";

SELECT
  'auth.company_id()' as "Função",
  auth.company_id() as "Resultado",
  CASE WHEN auth.company_id() IS NULL THEN '✅ OK (NULL esperado)' ELSE '❌ ERRO' END as "Status";

-- ============================================
-- 6. VERIFICAR TABELAS SEM RLS (DEVE SER VAZIO)
-- ============================================
\echo ''
\echo '=== Tabelas SEM RLS (deve estar vazio) ==='
SELECT
  tablename as "Tabela sem RLS"
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;

-- Esperado: 0 resultados

-- ============================================
-- 7. VERIFICAR TABELAS SEM POLÍTICAS (DEVE SER VAZIO)
-- ============================================
\echo ''
\echo '=== Tabelas com RLS mas SEM Políticas (deve estar vazio) ==='
SELECT
  t.tablename as "Tabela sem Políticas"
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.policyname IS NULL
GROUP BY t.tablename;

-- Esperado: 0 resultados

-- ============================================
-- 8. RELATÓRIO FINAL
-- ============================================
\echo ''
\echo '========================================='
\echo 'RELATÓRIO FINAL DE VERIFICAÇÃO RLS'
\echo '========================================='

WITH stats AS (
  SELECT
    (SELECT COUNT(*) FROM pg_proc WHERE pronamespace = 'auth'::regnamespace) as funcs_auth,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity) as tables_with_rls,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
    (SELECT COUNT(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') as tables_with_policies
)
SELECT
  funcs_auth as "Funções Auth",
  CASE WHEN funcs_auth = 6 THEN '✅' ELSE '❌' END as "Status Funções",
  total_tables as "Total Tabelas",
  tables_with_rls as "Tabelas c/ RLS",
  CASE WHEN tables_with_rls = 40 THEN '✅' ELSE '❌' END as "Status RLS",
  total_policies as "Total Políticas",
  CASE WHEN total_policies >= 150 THEN '✅' ELSE '❌' END as "Status Políticas",
  tables_with_policies as "Tabelas c/ Políticas",
  CASE WHEN tables_with_policies = tables_with_rls THEN '✅' ELSE '❌' END as "Status Cobertura"
FROM stats;

\echo ''
\echo '========================================='
\echo 'PRÓXIMOS PASSOS:'
\echo '1. Atualizar middleware de autenticação'
\echo '2. Reiniciar servidor API'
\echo '3. Testar com usuários reais'
\echo '========================================='

-- ============================================
-- TESTE ADICIONAL: SIMULAÇÃO DE ISOLAMENTO
-- ============================================
\echo ''
\echo '=== TESTE DE ISOLAMENTO (Opcional) ==='
\echo 'Execute os comandos abaixo manualmente para testar:'
\echo ''
\echo '-- 1. Sem contexto (deve retornar 0)'
\echo 'SELECT COUNT(*) as "Leads sem contexto" FROM leads;'
\echo ''
\echo '-- 2. Com contexto (substitua IDs reais)'
\echo 'SET LOCAL app.user_id = ''seu_user_id'';'
\echo 'SET LOCAL app.workspace_id = ''seu_workspace_id'';'
\echo 'SET LOCAL app.company_id = ''sua_company_id'';'
\echo 'SELECT COUNT(*) as "Leads com contexto" FROM leads;'
\echo ''
\echo '-- 3. Limpar contexto'
\echo 'RESET app.user_id;'
\echo 'RESET app.workspace_id;'
\echo 'RESET app.company_id;'
