# 🚀 Início Rápido - Teste da Extensão

## ⚡ Setup em 5 minutos

### 1. Inicie a API (obrigatório)

```bash
# Terminal 1
npm run api:dev
```

A API deve estar rodando em `http://localhost:3001`

### 2. Carregue a extensão no Chrome

1. Abra `chrome://extensions`
2. Ative **"Modo do desenvolvedor"** (toggle superior direito)
3. Clique **"Carregar sem compactação"**
4. Selecione: `apps/extension`
5. ✅ Extensão aparece na lista

### 3. Crie uma conta (se ainda não tem)

**Opção A: Via API**
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@sos360.com",
    "password": "senha123",
    "fullName": "Teste User",
    "workspaceName": "Meu Workspace"
  }'
```

**Opção B: Via Dashboard**
1. Acesse `http://localhost:3000/register`
2. Crie sua conta

### 4. Faça login na extensão

1. Clique no ícone da extensão (S360) na barra de ferramentas
2. Digite seu **email** e **senha**
3. Clique **"Entrar"**
4. ✅ Deve aparecer seu nome e email

### 5. Teste a importação

**Instagram:**
1. Abra `instagram.com` em nova aba
2. Faça login (se necessário)
3. Vá para qualquer perfil (ex: `/username/`)
4. Clique no ícone da extensão
5. Clique **"Importar Leads desta Página"**
6. ✅ Mensagem de sucesso aparece

**Verificar resultado:**
- Clique **"Abrir Dashboard"** na extensão
- Ou acesse: `http://localhost:3000/dashboard/leads`
- ✅ Leads importados aparecem na lista

## 🎯 Teste Rápido Completo

```bash
# Terminal 1: API
npm run api:dev

# Terminal 2: Frontend (opcional, mas recomendado para ver resultados)
npm run web:dev
```

1. ✅ API rodando em `localhost:3001`
2. ✅ Extensão carregada no Chrome
3. ✅ Login feito na extensão
4. ✅ Navegou para Instagram/Facebook/LinkedIn
5. ✅ Clicou "Importar Leads desta Página"
6. ✅ Verificou leads no dashboard

## ❗ Problemas Comuns

### "Plataforma não suportada"
→ Você não está em instagram.com, facebook.com ou linkedin.com

### "Erro ao fazer login"
→ API não está rodando ou credenciais incorretas

### "Nenhum lead encontrado"
→ Tente em uma página diferente (perfil, lista de seguidores, etc.)

## 📚 Documentação Completa

Para mais detalhes, veja: `TESTE_EXTENSAO.md`
