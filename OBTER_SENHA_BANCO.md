# Como Obter a Senha do Banco de Dados do Supabase

## ⚠️ IMPORTANTE

A **service key** (`sb_secret_...`) é para a API do Supabase, **NÃO** para conexão direta ao PostgreSQL!

Você precisa usar a **senha do banco de dados** que foi definida quando criou o projeto.

## Como Obter/Resetar a Senha

1. Acesse o [Dashboard do Supabase](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Settings > Database**
4. Role até a seção **Database Password**
5. Se você não lembra a senha:
   - Clique em **Reset database password**
   - Defina uma nova senha forte
   - **Copie e salve** a senha (você não conseguirá vê-la novamente!)

## Atualizar o arquivo .env

Depois de obter a senha, atualize o arquivo `.env` na raiz do projeto:

```env
# Database (SUBSTITUA [SENHA_DO_BANCO] pela senha real!)
DATABASE_URL=postgresql://postgres.doewttvwknkhjzhzceub:[SENHA_DO_BANCO]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.doewttvwknkhjzhzceub:[SENHA_DO_BANCO]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

**Exemplo** (se sua senha fosse `MinhaSenh@123`):
```env
DATABASE_URL=postgresql://postgres.doewttvwknkhjzhzceub:MinhaSenh@123@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.doewttvwknkhjzhzceub:MinhaSenh@123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

## Testar Conexão

Depois de atualizar o `.env`, teste:

```bash
npm run db:push
```

Se funcionar, você verá as tabelas sendo criadas no Supabase!
