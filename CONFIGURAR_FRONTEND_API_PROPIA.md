# 🚀 Configurar Frontend para Produção - Apenas API Própria

Este guia explica como configurar o frontend na Vercel para usar **apenas a API própria** (sem Supabase). O frontend se conecta diretamente à API, que gerencia o banco de dados via Docker/PostgreSQL.

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter:

- ✅ Frontend deployado na Vercel
- ✅ API deployada no Render (ou outra plataforma) com banco PostgreSQL
- ✅ URL pública da API

---

## 🔍 Arquitetura

```
Frontend (Vercel)
    ↓ HTTP/WebSocket
API Própria (Render)
    ↓ Prisma
PostgreSQL (Docker/Produção)
```

**O frontend NÃO se conecta diretamente ao banco de dados.** Toda comunicação passa pela API.

---

## 📝 Variáveis Necessárias

O frontend precisa **apenas** destas variáveis de ambiente:

| Variável | Descrição | Onde Obter |
|----------|-----------|------------|
| `NEXT_PUBLIC_API_URL` | URL da API em produção | Render Dashboard → Settings → Networking |
| `NEXT_PUBLIC_WS_URL` | URL WebSocket da API | Mesma URL da API, mas com `wss://` |

### Variáveis Opcionais

| Variável | Descrição | Quando Usar |
|----------|-----------|-------------|
| `API_URL` | URL da API (para uso interno) | Se houver código server-side usando |

---

## 🎯 Passo a Passo

### 1. Obter URL da API (Render)

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

### 2. Configurar Variáveis na Vercel

1. Acesse [Vercel Dashboard](https://vercel.com)
2. Selecione seu projeto do frontend
3. Vá em **Settings** → **Environment Variables**
4. Adicione/atualize as seguintes variáveis:

#### Para Produção (Production)

```env
# API - URL da API em produção
NEXT_PUBLIC_API_URL=https://lia360-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://lia360-api.onrender.com
```

#### Para Preview (Opcional)

Você pode configurar as mesmas variáveis para **Preview** e **Development** se quiser que os previews também usem produção, ou configure URLs diferentes para testes.

### 3. Configurar Ambiente

Para cada variável:

1. Clique em **Add New**
2. Digite o **Name** (ex: `NEXT_PUBLIC_API_URL`)
3. Digite o **Value** (ex: `https://lia360-api.onrender.com`)
4. Selecione os **Environments** onde aplicar:
   - ✅ **Production** (obrigatório)
   - ⚠️ **Preview** (opcional - para testar)
   - ⚠️ **Development** (opcional - geralmente usa localhost)

5. Clique em **Save**

### 4. Fazer Redeploy

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
   - `NEXT_PUBLIC_API_URL`
   - Conexão com API

### 2. Testar Conexão com API

No console do navegador, execute:

```javascript
// Verificar variável
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

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

### 3. Testar Login/Registro

1. Tente fazer login ou registro no frontend
2. Verifique se os dados são salvos:
   - A API gerencia o banco de dados
   - Os dados são salvos no PostgreSQL via API
   - Você pode verificar os dados através da API ou logs

### 4. Verificar WebSocket (se aplicável)

Se você usa Socket.io, teste a conexão:

```javascript
import io from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_WS_URL, {
  auth: { token: 'Bearer seu-token' }
});

socket.on('connect', () => {
  console.log('✅ WebSocket conectado!');
});
```

---

## 🔒 Segurança

### ⚠️ Importante

- **NUNCA** exponha credenciais de banco de dados no frontend
- O frontend **NÃO** tem acesso direto ao banco
- Toda autenticação e acesso a dados passa pela API
- Use HTTPS em produção (`https://` e `wss://`)

### Variáveis Seguras

| Variável | Tipo | Onde Usar |
|----------|------|-----------|
| `NEXT_PUBLIC_API_URL` | Pública | Frontend (Vercel) |
| `NEXT_PUBLIC_WS_URL` | Pública | Frontend (Vercel) |
| `DATABASE_URL` | **Secret** | **Apenas API (Render)** |
| `JWT_SECRET` | **Secret** | **Apenas API (Render)** |

---

## 🐛 Troubleshooting

### Problema 1: Frontend não conecta à API

**Erro:** `Failed to fetch` ou `CORS error`

**Solução:**
1. Verifique se `NEXT_PUBLIC_API_URL` está correto
2. Verifique se a API está rodando (teste `/health`)
3. Verifique se `CORS_ORIGINS` na API inclui a URL do Vercel
4. Use `https://` (não `http://`) para produção

### Problema 2: CORS Error

**Erro:** `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solução:**
1. Verifique se `CORS_ORIGINS` na API inclui a URL exata do Vercel
2. Inclua wildcards do Vercel: `https://*.vercel.app`
3. Formato correto: `https://seu-app.vercel.app,https://*.vercel.app,chrome-extension://*`
4. Após atualizar na API, aguarde o redeploy automático

### Problema 3: Variáveis não aparecem no frontend

**Sintoma:** `process.env.NEXT_PUBLIC_API_URL` retorna `undefined`

**Solução:**
1. Certifique-se de que o nome da variável começa com `NEXT_PUBLIC_`
2. Faça um redeploy completo (não apenas rebuild)
3. Limpe o cache do navegador
4. Verifique se a variável está configurada para o ambiente correto (Production)

### Problema 4: WebSocket não conecta

**Erro:** `WebSocket connection failed`

**Solução:**
1. Verifique se `NEXT_PUBLIC_WS_URL` usa `wss://` (não `ws://`)
2. Verifique se a API suporta WebSocket (Socket.io)
3. Verifique se o CORS na API permite WebSocket connections
4. Verifique os logs da API para erros de conexão

---

## 📊 Comparação: Desenvolvimento vs Produção

### Desenvolvimento (Local)

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Produção (Vercel)

```env
# Environment Variables na Vercel
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

- [ ] ✅ `NEXT_PUBLIC_API_URL` configurado na Vercel
- [ ] ✅ `NEXT_PUBLIC_WS_URL` configurado com `wss://` (WebSocket seguro)
- [ ] ✅ Variáveis configuradas para ambiente **Production**
- [ ] ✅ Redeploy feito na Vercel
- [ ] ✅ Frontend conecta à API (testado)
- [ ] ✅ Health check da API funciona
- [ ] ✅ Login/Registro funcionando
- [ ] ✅ WebSocket funcionando (se aplicável)

---

## 🎯 Próximos Passos

Após configurar:

1. **Testar todas as funcionalidades** no frontend de produção
2. **Monitorar logs** na Vercel e Render
3. **Configurar domínio customizado** (opcional)
4. **Configurar analytics** (opcional)

---

## 📚 Referências

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Socket.io Client](https://socket.io/docs/v4/client-api/)

---

**Precisa de ajuda?** Verifique os logs na Vercel ou consulte a documentação oficial.
