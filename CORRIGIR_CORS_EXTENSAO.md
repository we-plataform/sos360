# 🔧 Corrigir CORS para Extensão Chrome

## Problema

Extensões Chrome fazem requisições de `chrome-extension://[id]`, que não é um origin tradicional. O CORS precisa permitir essas requisições.

## ✅ Correções Aplicadas

### 1. CORS Configurado para Extensões Chrome

O CORS agora permite:
- ✅ Requisições sem origin (extensões Chrome em alguns casos)
- ✅ Requisições de `chrome-extension://`
- ✅ Requisições de localhost em desenvolvimento
- ✅ Origins configurados no `.env`

### 2. Helmet Ajustado

- Desabilitado CSP (não necessário para API REST)
- Configurado `crossOriginResourcePolicy: "cross-origin"`

### 3. Logs de Debug Adicionados

A extensão agora loga:
- Requisições sendo feitas
- Status das respostas
- Erros detalhados

## 🔍 Como Verificar

### 1. Verificar Service Worker Console

1. Abra `chrome://extensions`
2. Encontre "Lia 360"
3. Clique em "service worker" (link azul)
4. Tente fazer login
5. Veja os logs no console

**Logs esperados:**
```
[Lia 360] API Request: http://localhost:3001/api/v1/auth/login { method: 'POST' }
[Lia 360] API Response: 200 OK
```

### 2. Verificar API está Respondendo

```bash
# Testar health check
curl http://localhost:3001/health

# Testar login (deve retornar erro de credenciais, não CORS)
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234"}'
```

### 3. Verificar CORS Headers

```bash
curl -X OPTIONS http://localhost:3001/api/v1/auth/login \
  -H "Origin: chrome-extension://test" \
  -H "Access-Control-Request-Method: POST" \
  -v 2>&1 | grep -i "access-control"
```

Deve retornar headers `Access-Control-Allow-Origin`.

## 🐛 Se Ainda Não Funcionar

### Verificar API está Rodando

```bash
# Verificar processo
lsof -i :3001

# Ou testar diretamente
curl http://localhost:3001/health
```

### Verificar Logs da API

Na saída da API, procure por:
- Requisições chegando
- Erros de CORS
- Erros de validação

### Verificar Console do Service Worker

1. `chrome://extensions` → Lia 360 → "service worker"
2. Veja erros específicos
3. Copie mensagem de erro completa

### Possíveis Problemas

1. **API não está rodando**
   - Solução: `npm run api:dev`

2. **Porta diferente**
   - Verifique `API_URL` no `background.js`
   - Verifique `API_PORT` no `.env`

3. **Firewall bloqueando**
   - macOS pode bloquear conexões locais
   - Verifique configurações de firewall

4. **Cache do Chrome**
   - Recarregue a extensão completamente
   - Limpe cache do Chrome

## 📝 Próximos Passos

Após corrigir CORS:

1. ✅ Recarregar extensão
2. ✅ Tentar login novamente
3. ✅ Verificar logs no service worker
4. ✅ Verificar logs da API
