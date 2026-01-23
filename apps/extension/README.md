# 🧩 Extensão Chrome - Lia 360

## 📦 Estrutura

```
extension/
├── manifest.json          # Configuração da extensão
├── background.js          # Service worker (API calls, auth)
├── popup.html            # Interface do popup
├── popup.js              # Lógica do popup
└── content-scripts/      # Scripts para extrair dados
    ├── instagram.js
    ├── facebook.js
    └── linkedin.js
```

## 🚀 Carregar Extensão

1. Abra o Chrome e acesse `chrome://extensions`
2. Ative **"Modo do desenvolvedor"** (toggle superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta: `apps/extension`
5. ✅ Extensão deve aparecer na lista

## 🔧 Configuração

### Verificar API URL

Abra `background.js` e verifique:

```javascript
const API_URL = 'http://localhost:3001';
```

Se sua API estiver em outro endereço, atualize esta linha.

## 🎨 Ícones (Opcional)

Atualmente a extensão funciona sem ícones. Para adicionar ícones:

1. Crie a pasta `icons/` dentro de `apps/extension/`
2. Adicione ícones PNG nas resoluções:
   - `icon16.png` (16x16)
   - `icon32.png` (32x32)
   - `icon48.png` (48x48)
   - `icon128.png` (128x128)
3. Descomente as linhas de ícones no `manifest.json`:

```json
{
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

## 📚 Documentação Completa

Veja [`TESTE_EXTENSAO.md`](../../TESTE_EXTENSAO.md) para guia completo de testes.
