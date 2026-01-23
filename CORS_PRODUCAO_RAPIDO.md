# ⚡ CORS Produção - Correção Rápida

## 🔴 Erro

`Not allowed by CORS` ao fazer login

## ✅ Solução

### 1. Obter URL do Frontend
- Vercel → Deployments → Copiar URL

### 2. Atualizar no Render
- Render → Settings → Environment
- Editar `CORS_ORIGINS`
- Adicionar: `https://sua-url.vercel.app,https://*.vercel.app,chrome-extension://*`

### 3. Aguardar Redeploy
- Render faz redeploy automático
- Aguardar ~2-3 minutos

### 4. Testar
- Tentar login novamente
- Não deve mais dar erro de CORS

---

## 📝 Formato Correto

```
https://lia360-web-sigma.vercel.app,https://*.vercel.app,chrome-extension://*
```

**Guia completo:** `CORRIGIR_CORS_PRODUCAO.md`
