# Setup - Lia 360 com Supabase

## 1. Configuração do Supabase

### Criar projeto

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Clique em "New Project"
3. Escolha uma organização e nome para o projeto
4. Defina uma senha forte para o banco de dados
5. Selecione a região mais próxima (ex: `South America (São Paulo)`)
6. Aguarde o projeto ser criado (~2 minutos)

### Obter credenciais

No dashboard do Supabase:

1. **Project URL**: Settings > API > Project URL
   ```
   https://seu-projeto.supabase.co
   ```

2. **Service Key (secret)**: Settings > API > service_role (secret)
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Anon Key (public)**: Settings > API > anon (public)
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Database URLs**: Settings > Database > Connection String
   - **IMPORTANTE**: Use a senha do banco de dados (não a service key!)
   - Se esqueceu a senha: Settings > Database > Reset database password
   - **Transaction (pooler)** - porta 6543 (para Prisma):
     ```
     postgresql://postgres.[ref]:[SENHA_DO_BANCO]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - **Session (direct)** - porta 5432 (para migrations):
     ```
     postgresql://postgres.[ref]:[SENHA_DO_BANCO]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
     ```
   
   **Formato alternativo** (se o formato acima não funcionar):
   ```
   postgresql://postgres:[SENHA_DO_BANCO]@db.[ref].supabase.co:5432/postgres
   ```

## 2. Configurar variáveis de ambiente

Crie o arquivo `.env` na raiz do projeto:

```bash
# Supabase
SUPABASE_URL=https://doewttvwknkhjzhzceub.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_Sbc71l2MXDLBlL4vctr1SA_HGsoW3vx
SUPABASE_ANON_KEY=sua-anon-key-aqui

# Database (SUBSTITUA [SENHA_DO_BANCO] pela senha real do seu banco!)
# IMPORTANTE: Use a senha do banco de dados, NÃO a service key!
DATABASE_URL=postgresql://postgres.doewttvwknkhjzhzceub:[SENHA_DO_BANCO]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.doewttvwknkhjzhzceub:[SENHA_DO_BANCO]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres

# Redis (opcional - deixe vazio para usar memória)
REDIS_URL=

# Auth
JWT_SECRET=sb_secret_Sbc71l2MXDLBlL4vctr1SA_HGsoW3vx
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# API
API_PORT=3001
API_URL=http://localhost:3001

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://doewttvwknkhjzhzceub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui

# CORS
CORS_ORIGINS=http://localhost:3000
```

## 3. Instalar dependências e configurar banco

```bash
# Instalar dependências
npm install

# Gerar cliente Prisma
npm run db:generate

# Criar tabelas no Supabase
npm run db:push
```

## 4. Verificar conexão

```bash
# Abre interface visual do banco
npm run db:studio
```

Se abrir o Prisma Studio e mostrar as tabelas, a conexão está funcionando!

## 5. Iniciar desenvolvimento

```bash
# Iniciar API e Web simultaneamente
npm run dev

# Ou iniciar separadamente:
npm run api:dev    # Apenas API
npm run web:dev    # Apenas Web
```

- **API**: http://localhost:3001
- **Web**: http://localhost:3000

## 6. Criar primeiro usuário

1. Acesse http://localhost:3000/register
2. Preencha os dados e crie sua conta
3. Faça login e acesse o dashboard

## Troubleshooting

### Erro de conexão com banco

- **IMPORTANTE**: Use a senha do banco de dados, não a service key!
- Se esqueceu a senha: Settings > Database > Reset database password
- Verifique se as URLs do banco estão corretas
- Use `?pgbouncer=true` na `DATABASE_URL` (porta 6543)
- Use a porta 5432 para `DIRECT_URL` (sem pgbouncer)
- Se receber "Tenant or user not found", a senha está incorreta

### Erro de migração

```bash
# Se der erro, tente resetar
npm run db:push -- --force-reset
```

### Prisma Studio não conecta

- Verifique se `DIRECT_URL` está configurada (usa conexão direta)
- Confirme que o IP não está bloqueado no Supabase

### Redis não conecta

O sistema funciona sem Redis! Ele usa armazenamento em memória automaticamente.
Se quiser Redis, use [Upstash](https://upstash.com) (gratuito).
