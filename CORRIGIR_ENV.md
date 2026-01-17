# Correção do arquivo .env

## ⚠️ Problema

Se sua senha do banco de dados contém caracteres especiais como `@`, `#`, `%`, etc., você precisa codificar a senha na URL do banco de dados.

## 🔧 Solução

### Se sua senha é `Farinelli@63`:

A senha codificada é: `Farinelli%4063`

Atualize seu `.env`:

```env
DATABASE_URL=postgresql://postgres.doewttvwknkhjzhzceub:Farinelli%4063@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.doewttvwknkhjzhzceub:Farinelli%4063@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

### Outros caracteres especiais:

- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- `/` → `%2F`
- `:` → `%3A`
- `?` → `%3F`
- `&` → `%26`
- `=` → `%3D`
- ` ` (espaço) → `%20`

### Como codificar sua senha:

```bash
# No terminal
node -e "console.log(encodeURIComponent('SUA_SENHA_AQUI'))"
```

Ou use uma ferramenta online: https://www.urlencoder.org/

## ✅ Depois de corrigir

1. Salve o arquivo `.env`
2. Reinicie a API: `npm run api:dev`
