# ✅ Implementação: Frontend Usando API Própria

## 🎯 Objetivo

Configurar o frontend na Vercel para usar:
- ✅ API de produção (Render)
- ✅ API gerencia o banco de dados (PostgreSQL via Docker)

---

## 📋 Checklist de Implementação

### 1. Obter URL da API

#### API (Render)
- [ ] Acessar Render Dashboard
- [ ] Settings → Networking
- [ ] Copiar **Public URL** → `NEXT_PUBLIC_API_URL`

### 2. Configurar Vercel

- [ ] Acessar Vercel Dashboard
- [ ] Selecionar projeto do frontend
- [ ] Settings → Environment Variables
- [ ] Adicionar todas as variáveis (ver abaixo)
- [ ] Selecionar ambiente **Production**
- [ ] Salvar

### 3. Variáveis a Configurar

```env
# Supabase (Banco de Produção)
NEXT_PUBLIC_SUPABASE_URL=https://doewttvwknkhjzhzceub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key-do-supabase]

# API (Render)
NEXT_PUBLIC_API_URL=https://sua-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://sua-api.onrender.com
```

### 4. Redeploy

- [ ] Deployments → Redeploy
- [ ] Aguardar deploy completar
- [ ] Verificar logs

### 5. Testar

- [ ] Acessar site em produção
- [ ] Verificar console do navegador (sem erros)
- [ ] Testar login/registro
- [ ] Verificar se dados aparecem no Supabase

---

## 🔍 Verificação Rápida

### No Console do Navegador

```javascript
// Verificar variável
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

// Testar API
fetch(process.env.NEXT_PUBLIC_API_URL + '/health')
  .then(r => r.json())
  .then(console.log);
```

---

## ⚠️ Pontos Importantes

1. **Frontend NÃO precisa de variáveis do Supabase** - apenas da API
2. **Use `wss://` para WebSocket** (não `ws://`) em produção
3. **Use `https://` para API** (não `http://`) em produção
4. **Faça redeploy após alterar variáveis**
5. **API gerencia o banco de dados** - frontend não acessa diretamente

---

## 📚 Documentação Completa

- **Guia Completo**: `CONFIGURAR_FRONTEND_API_PROPIA.md`
- **Resumo Rápido**: `FRONTEND_API_PROPIA_RAPIDO.md`

---

## 🆘 Se Algo Der Errado

1. Verifique se as variáveis estão configuradas corretamente
2. Verifique se fez redeploy após alterar variáveis
3. Verifique os logs na Vercel
4. Verifique o console do navegador para erros
5. Consulte `CONFIGURAR_FRONTEND_PRODUCAO.md` → Troubleshooting

---

**Status:** ✅ Pronto para implementar
