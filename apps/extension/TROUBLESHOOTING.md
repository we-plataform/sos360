# 🔧 Troubleshooting - Extensão Chrome

## Erros Comuns e Soluções

### 1. Erro: "Could not load manifest"

**Causas:**
- JSON inválido (vírgulas extras, sintaxe incorreta)
- Arquivos referenciados não existem
- Permissões inválidas

**Solução:**
```bash
# Validar JSON
python3 -m json.tool manifest.json

# Verificar arquivos existem
ls -la background.js popup.html popup.js
ls -la content-scripts/*.js
```

### 2. Erro: "Cannot access chrome.contextMenus"

**Causa:** Falta permissão `contextMenus` no manifest

**Solução:** Já adicionada! Verifique se o manifest tem:
```json
"permissions": [
  "storage",
  "activeTab",
  "tabs",
  "contextMenus"
]
```

### 3. Erro: "Failed to fetch" ou CORS

**Causa:** API não está rodando ou bloqueio de CORS

**Solução:**
1. Verifique se API está rodando: `curl http://localhost:3001/health`
2. Verifique CORS na API permite `http://localhost:3000`
3. Verifique `API_URL` no `background.js` está correto

### 4. Erro: "Service worker registration failed"

**Causas:**
- Erro de sintaxe no `background.js`
- Uso de APIs não suportadas

**Solução:**
1. Abra `chrome://extensions`
2. Clique em "service worker" na extensão
3. Veja o erro no console

### 5. Erro: "Content script failed to load"

**Causas:**
- Erro de sintaxe nos content scripts
- Caminho incorreto no manifest

**Solução:**
1. Verifique console da página (F12)
2. Verifique se arquivos existem em `content-scripts/`
3. Verifique paths no manifest estão corretos

## 🔍 Debug Passo a Passo

### 1. Verificar Service Worker

```
chrome://extensions → Lia 360 → "service worker" (link)
```

Console mostra erros do `background.js`

### 2. Verificar Content Scripts

1. Abra uma página do Instagram/Facebook/LinkedIn
2. Pressione F12 (DevTools)
3. Vá na aba "Console"
4. Procure por: "Lia 360 ... content script loaded"

### 3. Verificar Popup

1. Clique no ícone da extensão
2. Se não abrir, verifique console do service worker
3. Se abrir mas não funcionar, verifique console do popup:
   - Clique direito no popup → "Inspecionar"

### 4. Verificar Storage

No console do service worker:
```javascript
chrome.storage.local.get(null, console.log);
```

### 5. Testar API Manualmente

No console do service worker:
```javascript
fetch('http://localhost:3001/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## ✅ Checklist de Validação

- [ ] Manifest.json é JSON válido
- [ ] Todos os arquivos referenciados existem
- [ ] Permissões corretas no manifest
- [ ] API rodando em `http://localhost:3001`
- [ ] CORS configurado na API
- [ ] Service worker carrega sem erros
- [ ] Content scripts carregam nas páginas corretas

## 📝 Logs Úteis

### Service Worker
```javascript
// Adicionar no background.js para debug
console.log('API_URL:', API_URL);
console.log('Request:', endpoint, options);
```

### Content Scripts
```javascript
// Já existe nos scripts:
console.log('Lia 360 Instagram content script loaded');
```

## 🆘 Se Nada Funcionar

1. **Remova e recarregue a extensão:**
   - `chrome://extensions`
   - Remova Lia 360
   - Carregue novamente

2. **Verifique versão do Chrome:**
   - Manifest V3 requer Chrome 88+
   - `chrome://version` para verificar

3. **Teste em modo incógnito:**
   - Pode ser conflito com outras extensões

4. **Verifique logs completos:**
   - Service worker console
   - Page console (F12)
   - Network tab (para ver requisições)
