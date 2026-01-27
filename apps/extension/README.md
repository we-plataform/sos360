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

## ⚡ Performance

### Performance Guidelines

A extensão foi otimizada para garantir carga rápida e uso eficiente de memória:

- ✅ **Tempo de Carga**: ~36ms (meta: < 500ms)
- ✅ **Uso de Memória**: ~18MB (meta: < 50MB)
- ✅ **Tamanho do Bundle**: 181.46 KB (redução de 48.9%)
- ✅ **Carregamento Lazy**: Scripts carregados por plataforma

### Optimization Techniques

A extensão utiliza várias técnicas de otimização:

1. **Code Splitting**: Scripts divididos por plataforma e responsabilidade
2. **Lazy Loading**: Bootstrap orquestra carregamento sob demanda
3. **Selector Optimization**: Seletores CSS otimizados e centralizados
4. **Caching**: LRU cache para queries DOM frequentes
5. **Code Reduction**: Remoção de código duplicado e não utilizado

### Performance Monitoring

Para monitorar a performance em tempo de desenvolvimento:

```javascript
// No console do navegador em qualquer rede social:
// Ver uso de memória
performance.memory

// Ver tempo de execução dos scripts
performance.getEntriesByType('measure')

// Ver todas as entradas de performance
performance.getEntries()
```

Para métricas detalhadas e análise de performance, consulte [`PERFORMANCE.md`](./PERFORMANCE.md).

### Best Practices for Development

Ao adicionar novos recursos à extensão:

1. **Mantenha arquivos pequenos**: Divida código em módulos focados (< 30 KB se possível)
2. **Use lazy loading**: Carregue scripts apenas quando necessário
3. **Otimize seletores**: Use seletores CSS eficientes e específicos
4. **Evite DOM excessivo**: Minimize manipulações desnecessárias do DOM
5. **Implemente cache**: Use cache para operações repetitivas
6. **Teste performance**: Verifique o impacto antes de commitar

## 📚 Documentação Completa

### Documentação de Performance
- [`PERFORMANCE.md`](./PERFORMANCE.md) - Métricas detalhadas de performance e técnicas de otimização

### Documentação de Testes
- Veja [`TESTE_EXTENSAO.md`](../../TESTE_EXTENSAO.md) para guia completo de testes.

### Outros Recursos
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) - Solução de problemas comuns
- [`scripts/benchmark.js`](./scripts/benchmark.js) - Script de benchmark de performance
