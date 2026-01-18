# 🔧 Correção Rápida: Erro CORS em Produção

## 🔴 Problema Identificado

**Erro:** `Not allowed by CORS` ao tentar fazer login via produção

**Causa:** A variável `CORS_ORIGINS` na API (Render) não inclui a URL do frontend em produção.

---

## ✅ Solução Rápida

### 1. Obter URL do Frontend na Vercel

1. Acesse [Vercel Dashboard](https://vercel.com)
2. Selecione seu projeto
3. Na aba **Deployments**, copie a URL de produção:
   ```
   https://sos360-web-sigma.vercel.app
   ```
   (ou a URL do seu projeto)

### 2. Atualizar CORS_ORIGINS no Render

1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Selecione seu serviço da API
3. Vá em **Settings** → **Environment**
4. Encontre a variável `CORS_ORIGINS`
5. Clique em **Edit**

### 3. Adicionar URL do Frontend

**Formato correto:**
```
https://sos360-web-sigma.vercel.app,https://*.vercel.app,chrome-extension://*
```

**Ou se já tiver outras URLs:**
```
https://sos360-web-sigma.vercel.app,https://*.vercel.app,chrome-extension://*,https://outra-url.com
```

**Importante:**
- ✅ Inclua a URL **exata** do frontend
- ✅ Inclua wildcard do Vercel: `https://*.vercel.app` (para previews)
- ✅ Mantenha `chrome-extension://*` para a extensão funcionar
- ✅ Separe múltiplas URLs por **vírgula** (sem espaços)

### 4. Salvar e Aguardar Redeploy

1. Clique em **Save**
2. O Render fará redeploy automático
3. Aguarde alguns minutos para o deploy completar

---

## 🔍 Verificação

### 1. Verificar nos Logs do Render

Após o redeploy, verifique os logs. Deve aparecer:

```
[Config] CORS_ORIGINS: https://sos360-web-sigma.vercel.app, https://*.vercel.app, chrome-extension://*
```

### 2. Testar no Frontend

1. Acesse seu frontend em produção
2. Tente fazer login novamente
3. Abra o **Console do Navegador** (F12)
4. Não deve aparecer mais erros de CORS

### 3. Testar CORS Manualmente

No console do navegador, execute:

```javascript
fetch('https://sua-api.onrender.com/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'teste@teste.com',
    password: 'senha123'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

Se não der erro de CORS, está funcionando!

---

## 🐛 Se Ainda Não Funcionar

### Problema 1: URL não está correta

**Sintoma:** CORS ainda bloqueia mesmo após adicionar URL

**Solução:**
1. Verifique se a URL está **exatamente** como aparece no navegador
2. Inclua `https://` (não `http://`)
3. Não inclua barra no final (`/`)
4. Verifique se não há espaços extras

### Problema 2: Redeploy não aconteceu

**Sintoma:** Variável atualizada mas erro persiste

**Solução:**
1. Vá em **Manual Deploy** no Render
2. Selecione branch `main`
3. Clique em **Deploy**
4. Aguarde completar

### Problema 3: Múltiplas URLs do Vercel

**Sintoma:** Preview funciona mas produção não (ou vice-versa)

**Solução:**
Use wildcard do Vercel:
```
https://sos360-web-sigma.vercel.app,https://*.vercel.app,chrome-extension://*
```

Isso permite:
- ✅ Produção: `https://sos360-web-sigma.vercel.app`
- ✅ Previews: `https://sos360-web-sigma-git-*.vercel.app`
- ✅ Extensão Chrome

---

## 📋 Checklist

- [ ] URL do frontend obtida da Vercel
- [ ] `CORS_ORIGINS` atualizado no Render
- [ ] URL exata do frontend incluída
- [ ] Wildcard do Vercel incluído (`https://*.vercel.app`)
- [ ] `chrome-extension://*` mantido
- [ ] Redeploy completado
- [ ] Login testado e funcionando

---

## 💡 Exemplo Completo

**Variável `CORS_ORIGINS` no Render:**

```
https://sos360-web-sigma.vercel.app,https://*.vercel.app,chrome-extension://*
```

**Isso permite:**
- ✅ `https://sos360-web-sigma.vercel.app` (produção)
- ✅ `https://sos360-web-sigma-git-main.vercel.app` (preview)
- ✅ `https://sos360-web-sigma-git-feature.vercel.app` (preview de branch)
- ✅ `chrome-extension://abc123...` (extensão Chrome)

---

**Após corrigir, o login deve funcionar normalmente!** 🎉
