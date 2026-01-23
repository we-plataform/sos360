# 🚀 Configurar Frontend para Produção - Vercel

Este guia explica como configurar o frontend na Vercel para usar o banco de produção (Supabase) e a API em produção (Render).

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter:

- ✅ Frontend deployado na Vercel
- ✅ API deployada no Render (ou outra plataforma)
- ✅ Projeto Supabase configurado
- ✅ Credenciais do Supabase (URL e Anon Key)

---

## 🔍 Variáveis Necessárias

O frontend precisa das seguintes variáveis de ambiente:

### Variáveis Obrigatórias

| Variável | Descrição | Onde Obter |
|----------|-----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_API_URL` | URL da API em produção | Render Dashboard → Settings → Networking |
| `NEXT_PUBLIC_WS_URL` | URL WebSocket da API | Mesma URL da API, mas com `wss://` |

### Variáveis Opcionais

| Variável | Descrição | Quando Usar |
|----------|-----------|-------------|
| `API_URL` | URL da API (para uso interno) | Se houver código server-side usando |

---

## 📝 Passo a Passo

### 1. Obter Credenciais do Supabase

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie os seguintes valores:

   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     ```
     https://doewttvwknkhjzhzceub.supabase.co
     ```

   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```
   
   ⚠️ **IMPORTANTE**: Use a chave **anon public**, NÃO a **service_role** (secret)!

### 2. Obter URL da API (Render)

1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Selecione seu serviço da API
3. Vá em **Settings** → **Networking**
4. Copie a **Public URL**:
   ```
   https://lia360-api.onrender.com
   ```
   
   Ou se estiver usando Railway:
   ```
   https://lia360-api-production.up.railway.app
   ```

### 3. Configurar Variáveis na Vercel

1. Acesse [Vercel Dashboard](https://vercel.com)
2. Selecione seu projeto do frontend
3. Vá em **Settings** → **Environment Variables**
4. Adicione/atualize as seguintes variáveis:

#### Para Produção (Production)

```env
# Supabase - Banco de Produção
NEXT_PUBLIC_SUPABASE_URL=https://doewttvwknkhjzhzceub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API - URL da API em produção
NEXT_PUBLIC_API_URL=https://lia360-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://lia360-api.onrender.com

# Opcional (se necessário)
API_URL=https://lia360-api.onrender.com
```

#### Para Preview (Opcional - se quiser testar)

Você pode configurar as mesmas variáveis para **Preview** e **Development** se quiser que os previews também usem produção, ou configure URLs diferentes para testes.

### 4. Configurar Ambiente

Para cada variável:

1. Clique em **Add New**
2. Digite o **Name** (ex: `NEXT_PUBLIC_SUPABASE_URL`)
3. Digite o **Value** (ex: `https://doewttvwknkhjzhzceub.supabase.co`)
4. Selecione os **Environments** onde aplicar:
   - ✅ **Production** (obrigatório)
   - ⚠️ **Preview** (opcional - para testar)
   - ⚠️ **Development** (opcional - geralmente usa localhost)

5. Clique em **Save**

### 5. Fazer Redeploy

Após adicionar/atualizar as variáveis:

1. Vá em **Deployments**
2. Encontre o último deployment
3. Clique nos **três pontos** (⋯)
4. Selecione **Redeploy**
5. Aguarde o deploy completar

---

## ✅ Verificação

Após o redeploy, verifique se está funcionando:

### 1. Verificar no Console do Navegador

1. Acesse seu site na Vercel
2. Abra o **Console do Desenvolvedor** (F12)
3. Verifique se não há erros relacionados a:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_API_URL`
   - Conexão com Supabase
   - Conexão com API

### 2. Testar Conexão com Supabase

No console do navegador, execute:

```javascript
// Verificar se Supabase está configurado
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
```

> ⚠️ **Nota**: Variáveis `NEXT_PUBLIC_*` são expostas ao cliente. Não coloque secrets aqui!

### 3. Testar Conexão com API

No console do navegador, execute:

```javascript
// Testar health check da API
fetch(process.env.NEXT_PUBLIC_API_URL + '/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

Deve retornar:
```json
{"status":"ok","timestamp":"2025-01-17T..."}
```

### 4. Testar Login/Registro

1. Tente fazer login ou registro no frontend
2. Verifique se os dados são salvos no Supabase:
   - Acesse Supabase Dashboard
   - Vá em **Table Editor**
   - Verifique se os dados aparecem nas tabelas

---

## 🔒 Segurança

### ⚠️ Importante

- **NUNCA** coloque a `SUPABASE_SERVICE_KEY` (secret) em variáveis `NEXT_PUBLIC_*`
- Use apenas a **anon public key** para o frontend
- A `service_role` key deve estar apenas na API (backend)

### Variáveis Seguras vs Públicas

| Variável | Tipo | Onde Usar |
|----------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | Frontend (Vercel) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública | Frontend (Vercel) |
| `SUPABASE_SERVICE_KEY` | **Secret** | **Apenas API (Render)** |
| `DATABASE_URL` | **Secret** | **Apenas API (Render)** |

---

## 🐛 Troubleshooting

### Problema 1: Frontend não conecta ao Supabase

**Erro:** `Invalid API key` ou `Failed to fetch`

**Solução:**
1. Verifique se `NEXT_PUBLIC_SUPABASE_URL` está correto (sem barra no final)
2. Verifique se `NEXT_PUBLIC_SUPABASE_ANON_KEY` é a chave **anon**, não a service_role
3. Verifique se fez redeploy após adicionar as variáveis

### Problema 2: Frontend não conecta à API

**Erro:** `CORS error` ou `Failed to fetch`

**Solução:**
1. Verifique se `NEXT_PUBLIC_API_URL` está correto
2. Verifique se a API está rodando (teste `/health`)
3. Verifique se `CORS_ORIGINS` na API inclui a URL do Vercel
4. Use `https://` (não `http://`) para produção

### Problema 3: Variáveis não aparecem no frontend

**Sintoma:** `process.env.NEXT_PUBLIC_*` retorna `undefined`

**Solução:**
1. Certifique-se de que o nome da variável começa com `NEXT_PUBLIC_`
2. Faça um redeploy completo (não apenas rebuild)
3. Limpe o cache do navegador
4. Verifique se a variável está configurada para o ambiente correto (Production)

### Problema 4: Dados não aparecem no Supabase

**Sintoma:** Login/registro funciona, mas dados não aparecem

**Solução:**
1. Verifique se está usando o projeto correto do Supabase
2. Verifique se as tabelas existem (rode migrations se necessário)
3. Verifique se as políticas RLS (Row Level Security) permitem acesso
4. Verifique os logs do Supabase em **Logs** → **API Logs**

---

## 📊 Comparação: Desenvolvimento vs Produção

### Desenvolvimento (Local)

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://doewttvwknkhjzhzceub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Produção (Vercel)

```env
# Environment Variables na Vercel
NEXT_PUBLIC_SUPABASE_URL=https://doewttvwknkhjzhzceub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=https://lia360-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://lia360-api.onrender.com
```

**Diferenças:**
- API usa `https://` em produção (não `http://`)
- WebSocket usa `wss://` em produção (não `ws://`)
- URLs apontam para serviços públicos, não localhost

---

## 📋 Checklist Final

Antes de considerar completo:

- [ ] ✅ `NEXT_PUBLIC_SUPABASE_URL` configurado na Vercel
- [ ] ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurado (anon key, não service_role)
- [ ] ✅ `NEXT_PUBLIC_API_URL` configurado com URL da API em produção
- [ ] ✅ `NEXT_PUBLIC_WS_URL` configurado com `wss://` (WebSocket seguro)
- [ ] ✅ Variáveis configuradas para ambiente **Production**
- [ ] ✅ Redeploy feito na Vercel
- [ ] ✅ Frontend conecta ao Supabase (testado)
- [ ] ✅ Frontend conecta à API (testado)
- [ ] ✅ Login/Registro funcionando
- [ ] ✅ Dados aparecem no Supabase

---

## 🎯 Próximos Passos

Após configurar:

1. **Testar todas as funcionalidades** no frontend de produção
2. **Monitorar logs** na Vercel e Supabase
3. **Configurar domínio customizado** (opcional)
4. **Configurar analytics** (opcional)

---

## 📚 Referências

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)

---

**Precisa de ajuda?** Verifique os logs na Vercel ou consulte a documentação oficial.
