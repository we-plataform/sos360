# Setup do Banco de Dados - SQL Manual

## Como Executar

1. Acesse o [Dashboard do Supabase](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. Clique em **New Query**
5. Cole todo o conteúdo do arquivo `database.sql`
6. Clique em **Run** (ou pressione `Ctrl+Enter` / `Cmd+Enter`)

## O que o Script Faz

✅ Cria todos os **ENUMs** (Plan, Role, Platform, etc)  
✅ Cria todas as **tabelas** (workspaces, users, leads, etc)  
✅ Cria todos os **índices** para performance  
✅ Cria **triggers** para atualizar `updatedAt` automaticamente  
✅ Habilita extensão **pg_trgm** para busca full-text  
✅ Cria índices **GIN** para busca em JSONB  

## Verificar se Funcionou

Depois de executar, verifique:

```sql
-- Listar todas as tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Contar tabelas (deve retornar 15)
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';
```

## Depois de Executar

1. **Gerar Prisma Client**:
   ```bash
   npm run db:generate
   ```

2. **Verificar no Prisma Studio**:
   ```bash
   npm run db:studio
   ```

## Troubleshooting

### Erro: "type already exists"
- Significa que alguns ENUMs já existem
- Remova manualmente os ENUMs existentes ou ignore o erro

### Erro: "relation already exists"
- Significa que algumas tabelas já existem
- Você pode dropar tudo primeiro:
  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres;
  GRANT ALL ON SCHEMA public TO public;
  ```
  **CUIDADO**: Isso apaga TODOS os dados!

### Erro: "extension pg_trgm does not exist"
- O Supabase pode não ter essa extensão habilitada
- Remova a linha `CREATE EXTENSION IF NOT EXISTS pg_trgm;` e os índices relacionados

## Estrutura Criada

- **15 tabelas** principais
- **11 ENUMs** para tipos
- **20+ índices** para performance
- **7 triggers** para updatedAt automático
- **Índices GIN** para busca em JSONB

## Próximos Passos

Após executar o SQL:

1. ✅ Banco criado
2. ✅ Execute `npm run db:generate` para gerar Prisma Client
3. ✅ Execute `npm run db:studio` para visualizar os dados
4. ✅ Inicie o desenvolvimento: `npm run dev`
