# Diagnóstico: Erro 502 Connection Refused

## 🔴 Problema

A API está retornando erro **502 Bad Gateway** com "connection refused" no Railway.

## ✅ Correções Aplicadas

1. **Servidor escutando em `0.0.0.0`** - Agora aceita conexões externas
2. **Tratamento de erros** - Erros durante inicialização são logados
3. **Handlers de erros não capturados** - Previne crashes silenciosos

## 🔍 Como Diagnosticar no Railway

### 1. Verificar Deploy Logs

No Railway:

1. Vá para o serviço da API
2. Clique na aba **Deploy Logs**
3. Procure por:
   - ✅ `Server running on 0.0.0.0:3001` - Servidor iniciou corretamente
   - ❌ `Invalid environment variables` - Variáveis faltando
   - ❌ `Failed to initialize` - Erro durante setup
   - ❌ `Uncaught Exception` - Erro não tratado
   - ❌ `Prisma Client did not initialize` - Prisma não gerado

### 2. Verificar HTTP Logs

Na aba **HTTP Logs**, veja:

- **Status 502** - Indica que o servidor não está respondendo
- **upstreamErrors** - Mostra erros específicos de conexão

### 3. Verificar Variáveis de Ambiente

No Railway, vá em **Settings** > **Variables** e verifique:

**Obrigatórias:**

- ✅ `NODE_ENV=production`
- ✅ `PORT=3001` (ou deixe Railway definir automaticamente)
- ✅ `DATABASE_URL` - Deve estar configurada
- ✅ `JWT_SECRET` - Mínimo 32 caracteres
- ✅ `CORS_ORIGINS` - URLs do frontend separadas por vírgula

**Verificar se estão corretas:**

- `DATABASE_URL` - Formato correto do Supabase
- `JWT_SECRET` - Não está vazio e tem pelo menos 32 caracteres
- `CORS_ORIGINS` - Inclui a URL do frontend Vercel

### 4. Verificar Build Logs

Na aba **Build Logs**, verifique:

- ✅ `prisma generate` foi executado
- ✅ `Generated Prisma Client` aparece nos logs
- ✅ Build completou sem erros
- ✅ `tsc` compilou sem erros

---

## 🛠️ Soluções por Problema

### Problema 1: Servidor não inicia

**Sintoma**: Logs mostram erro durante inicialização

**Solução**:

1. Verifique variáveis de ambiente (especialmente `DATABASE_URL` e `JWT_SECRET`)
2. Verifique se `CORS_ORIGINS` está configurada
3. Veja os logs de deploy para erros específicos

### Problema 2: Prisma Client não gerado

**Sintoma**: `Prisma Client did not initialize`

**Solução**:

1. Verifique Build Command no Railway:
   ```bash
   npm run build:api
   ```
2. Ou configure explicitamente:
   ```bash
   npm run build --workspace=@lia360/shared && npm run build --workspace=@lia360/database && npm run build --workspace=@lia360/api
   ```

### Problema 3: Porta incorreta

**Sintoma**: Servidor não escuta na porta correta

**Solução**:

- Railway injeta `PORT` automaticamente via variável de ambiente
- O código agora escuta em `0.0.0.0:${PORT}`
- Verifique se `PORT` está definida ou deixe Railway definir automaticamente

### Problema 4: Variáveis de ambiente inválidas

**Sintoma**: `Invalid environment variables` nos logs

**Solução**:

- Verifique `VARIAVEIS_RAILWAY.md` para lista completa
- Certifique-se de que todas as variáveis obrigatórias estão configuradas
- Verifique formato das URLs (especialmente `DATABASE_URL`)

---

## 📋 Checklist de Verificação

- [ ] Build completou com sucesso (ver Build Logs)
- [ ] Prisma Client foi gerado (procure "Generated Prisma Client" nos logs)
- [ ] Deploy completou sem erros (ver Deploy Logs)
- [ ] Servidor iniciou (procure "Server running on 0.0.0.0" nos logs)
- [ ] Variáveis de ambiente estão configuradas
- [ ] `DATABASE_URL` está correta e acessível
- [ ] `JWT_SECRET` tem pelo menos 32 caracteres
- [ ] `CORS_ORIGINS` inclui URL do frontend
- [ ] Health check responde: `curl https://sua-api.up.railway.app/health`

---

## 🧪 Testar Health Check

Após o deploy, teste:

```bash
curl https://sua-api-railway.up.railway.app/health
```

Deve retornar:

```json
{ "status": "ok", "timestamp": "2026-01-17T..." }
```

Se retornar 502, verifique os Deploy Logs para ver o erro específico.

---

## 📞 Próximos Passos

1. **Verifique os Deploy Logs** no Railway
2. **Procure por erros** durante a inicialização
3. **Verifique variáveis de ambiente** estão todas configuradas
4. **Teste o health check** após o deploy
5. **Compartilhe os logs** se o problema persistir

---

**As correções aplicadas devem resolver o problema. Se persistir, os logs agora mostrarão o erro específico que está causando o crash.**
