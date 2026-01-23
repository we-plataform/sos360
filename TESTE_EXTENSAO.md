# Guia de Teste - Extensão de Mineração Lia 360

## 📋 Pré-requisitos

1. ✅ API rodando em `http://localhost:3001`
2. ✅ Banco de dados configurado no Supabase
3. ✅ Usuário criado no sistema (via `/register` ou API)
4. ✅ Chrome/Edge instalado

## 🚀 Passo 1: Carregar a Extensão

1. Abra o Chrome e acesse `chrome://extensions`
2. Ative o **"Modo do desenvolvedor"** (toggle no canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta: `apps/extension`
5. A extensão deve aparecer na lista

## 🔧 Passo 2: Verificar Configuração

### Verificar se a API está configurada corretamente:

Abra o arquivo `apps/extension/background.js` e verifique:

```javascript
const API_URL = 'http://localhost:3001';
```

Se sua API estiver em outro endereço, atualize esta linha.

### Verificar se o popup tem ícones:

A extensão espera ícones em `apps/extension/icons/`. Se não existirem:

```bash
# Criar pasta de ícones (opcional - extensão funciona sem ícones)
mkdir -p apps/extension/icons
```

## 🔐 Passo 3: Fazer Login na Extensão

1. Clique no ícone da extensão na barra de ferramentas do Chrome
2. Você verá um formulário de login
3. Use as mesmas credenciais que criou no sistema:
   - **Email**: seu email
   - **Senha**: sua senha
4. Clique em **"Entrar"**

**O que deve acontecer:**
- ✅ Formulário desaparece
- ✅ Aparece informações do usuário (nome, email)
- ✅ Status muda para "Plataforma não suportada" (se não estiver em rede social)

## 🌐 Passo 4: Testar em Redes Sociais

### Teste no Instagram:

1. Abra uma nova aba e acesse `instagram.com`
2. Faça login na sua conta do Instagram (se necessário)
3. Navegue para uma página com perfis (ex: seguidores, seguindo, comentários)
4. Clique no ícone da extensão novamente
5. **O que deve aparecer:**
   - ✅ Status: "Plataforma detectada"
   - ✅ Badge: "Instagram"
   - ✅ Botão "Importar Leads desta Página" habilitado

### Teste no Facebook:

1. Acesse `facebook.com`
2. Navegue para uma página de grupo, lista de membros, ou perfil
3. Abra a extensão
4. Deve detectar "Facebook"

### Teste no LinkedIn:

1. Acesse `linkedin.com`
2. Navegue para resultados de busca, conexões, ou perfil
3. Abra a extensão
4. Deve detectar "LinkedIn"

## 📥 Passo 5: Testar Importação de Leads

### Cenário 1: Importar da página atual

1. Certifique-se de estar em uma página do Instagram/Facebook/LinkedIn
2. Abra a extensão
3. Clique em **"Importar Leads desta Página"**
4. **O que deve acontecer:**
   - ✅ Botão muda para "Importando..."
   - ✅ Mensagem de sucesso aparece: "X leads importados com sucesso!"
   - ✅ Estatísticas atualizam (leads hoje/mês)

### Cenário 2: Verificar no Dashboard

1. Na extensão, clique em **"Abrir Dashboard"**
   - Ou acesse manualmente: `http://localhost:3000/dashboard/leads`
2. **O que deve aparecer:**
   - ✅ Lista de leads importados
   - ✅ Informações do perfil (nome, username, foto, etc.)
   - ✅ Plataforma correta (Instagram/Facebook/LinkedIn)

## 🧪 Testes Detalhados por Plataforma

### Instagram

**Páginas testáveis:**
- ✅ Perfil de usuário (`/username/`)
- ✅ Lista de seguidores (`/username/followers/`)
- ✅ Lista de seguindo (`/username/following/`)
- ✅ Comentários em posts
- ✅ Pessoas que curtiram (`/p/POST_ID/liked_by/`)

**Como testar:**
1. Navegue para uma dessas páginas
2. Abra a extensão → "Importar Leads desta Página"
3. Verifique no dashboard se os leads foram importados

### Facebook

**Páginas testáveis:**
- ✅ Perfil de usuário
- ✅ Membros de grupo
- ✅ Lista de amigos

**Como testar:**
1. Navegue para uma dessas páginas
2. Abra a extensão → "Importar Leads desta Página"
3. Verifique no dashboard

### LinkedIn

**Páginas testáveis:**
- ✅ Perfil de usuário
- ✅ Resultados de busca
- ✅ Conexões
- ✅ Membros de empresa

**Como testar:**
1. Navegue para uma dessas páginas
2. Abra a extensão → "Importar Leads desta Página"
3. Verifique no dashboard

## 🐛 Troubleshooting

### Erro: "Plataforma não suportada"

**Causas:**
- Não está em uma página de rede social
- URL não corresponde aos padrões esperados
- Content script não carregou

**Solução:**
1. Recarregue a página (F5)
2. Verifique se está em instagram.com, facebook.com ou linkedin.com
3. Recarregue a extensão em `chrome://extensions`

### Erro: "Nenhum lead encontrado nesta página"

**Causas:**
- A página não tem perfis visíveis
- Selectors do content script não estão encontrando elementos
- Página carregou parcialmente (muito rápido)

**Solução:**
1. Role a página para garantir que os perfis carregaram
2. Aguarde alguns segundos antes de clicar em "Importar"
3. Tente em uma página diferente (ex: lista de seguidores)

### Erro: "Erro ao fazer login"

**Causas:**
- API não está rodando
- Credenciais incorretas
- CORS bloqueando requisições

**Solução:**
1. Verifique se a API está rodando: `curl http://localhost:3001/health`
2. Verifique as credenciais
3. Verifique o console do background script:
   - `chrome://extensions` → Lia 360 → "service worker" → Console

### Erro: "Erro ao importar leads"

**Causas:**
- API não está rodando
- Token expirado
- Erro na API (banco, validação, etc.)

**Solução:**
1. Verifique logs da API
2. Faça logout e login novamente na extensão
3. Verifique o console do background script

## 🔍 Debug Avançado

### Ver logs do Service Worker (Background)

1. `chrome://extensions`
2. Encontre "Lia 360"
3. Clique em "service worker" (aparece como link)
4. Console abre com logs do background.js

### Ver logs do Content Script

1. Abra DevTools na página (F12)
2. Vá na aba "Console"
3. Os logs do content script aparecem lá

### Ver mensagens entre scripts

No DevTools, use:

```javascript
// Verificar se content script está rodando
console.log('Content script loaded');

// Testar extração manual (no console da página)
chrome.runtime.sendMessage({ action: 'extractLeads' }, console.log);
```

### Verificar Storage Local

No DevTools → Application → Storage → Local Storage

Ou no console:
```javascript
chrome.storage.local.get(null, console.log);
```

## ✅ Checklist de Teste Completo

- [ ] Extensão carrega sem erros
- [ ] Login funciona corretamente
- [ ] Detecção de plataforma funciona (Instagram/Facebook/LinkedIn)
- [ ] Importação funciona em perfil individual
- [ ] Importação funciona em lista de seguidores/seguindo
- [ ] Leads aparecem no dashboard após importação
- [ ] Estatísticas atualizam (leads hoje/mês)
- [ ] Logout funciona
- [ ] Botão "Abrir Dashboard" funciona

## 📝 Notas Importantes

1. **Limites de Rate**: Redes sociais podem limitar ações automatizadas. Use com moderação.

2. **Permissões**: A extensão precisa de:
   - `storage` - Para salvar token e dados locais
   - `activeTab` - Para acessar a página atual
   - `tabs` - Para detectar URL da aba
   - Host permissions para Instagram/Facebook/LinkedIn

3. **Segurança**: O token JWT é armazenado localmente. Nunca compartilhe sua extensão com tokens válidos.

4. **Próximos Passos**: Após validar a extensão, você pode:
   - Adicionar mais plataformas (Twitter, TikTok, etc.)
   - Melhorar selectors para diferentes layouts
   - Adicionar filtros de importação
   - Adicionar prévia dos leads antes de importar
