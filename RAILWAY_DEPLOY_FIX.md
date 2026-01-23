# Correção: Commit não chegando ao Railway

## 🔍 Verificações Necessárias

### 1. Verificar Repositório Conectado no Railway

1. Acesse [Railway Dashboard](https://railway.app)
2. Selecione seu projeto
3. Vá em **Settings** > **Service**
4. Verifique se o **Repository** está correto:
   - Deve ser: `we-plataform/lia360` ou `joaofarinelli/lia360`
   - Se estiver diferente, clique em **Disconnect** e reconecte

### 2. Verificar Branch Configurado

1. No Railway, vá em **Settings** > **Service**
2. Verifique o campo **Branch**:
   - Deve estar configurado para `main`
   - Se estiver em outro branch (ex: `master`), altere para `main`

### 3. Verificar Deploy Automático

1. No Railway, vá em **Settings** > **Service**
2. Verifique se **Auto Deploy** está habilitado:
   - Deve estar marcado como **Enabled**
   - Se estiver desabilitado, habilite

### 4. Verificar Root Directory

1. No Railway, vá em **Settings** > **Service**
2. Verifique o campo **Root Directory**:
   - Deve estar configurado como: `apps/api`
   - Se estiver diferente, corrija

---

## 🔧 Soluções

### Solução 1: Forçar Redeploy Manual

1. No Railway, vá para o serviço da API
2. Clique na aba **Deployments**
3. Clique nos **três pontos** (⋯) do último deployment
4. Selecione **Redeploy**
5. Isso vai buscar o último commit do GitHub

### Solução 2: Reconectar Repositório

Se o repositório estiver incorreto:

1. No Railway, vá em **Settings** > **Service**
2. Clique em **Disconnect** (se já estiver conectado)
3. Clique em **Connect GitHub Repo**
4. Selecione o repositório `lia360`
5. Configure:
   - **Root Directory**: `apps/api`
   - **Branch**: `main`
   - **Auto Deploy**: Enabled

### Solução 3: Verificar Webhook do GitHub

O Railway usa webhooks do GitHub para detectar commits. Verifique:

1. No GitHub, vá para o repositório `lia360`
2. Vá em **Settings** > **Webhooks**
3. Procure por webhooks do Railway
4. Se não existir ou estiver com erro, reconecte o repositório no Railway

### Solução 4: Verificar Build Command

Certifique-se de que o Build Command está correto:

1. No Railway, vá em **Settings** > **Build & Deploy**
2. Verifique o **Build Command**:
   ```bash
   npm run build --workspace=@lia360/shared && npm run build --workspace=@lia360/database && npm run build --workspace=@lia360/api
   ```
   Ou deixe vazio para usar o `prebuild` do package.json

3. Verifique o **Start Command**:
   ```bash
   npm run start --workspace=@lia360/api
   ```

---

## 📋 Checklist de Verificação

- [ ] Repositório conectado está correto (`we-plataform/lia360` ou `joaofarinelli/lia360`)
- [ ] Branch configurado é `main`
- [ ] Auto Deploy está habilitado
- [ ] Root Directory está como `apps/api`
- [ ] Build Command está correto (ou vazio para usar prebuild)
- [ ] Start Command está como `npm run start --workspace=@lia360/api`
- [ ] Webhook do GitHub está funcionando
- [ ] Último commit está no GitHub (`5aff404`)

---

## 🚀 Forçar Deploy Imediato

Se nada funcionar, você pode forçar um deploy:

### Opção A: Criar um commit vazio

```bash
git commit --allow-empty -m "chore: trigger Railway deploy"
git push origin main
```

### Opção B: Fazer um pequeno ajuste

```bash
# Fazer uma pequena mudança em qualquer arquivo
echo "# Railway deploy trigger" >> README.md
git add README.md
git commit -m "chore: trigger Railway deploy"
git push origin main
```

---

## 🔍 Verificar Logs do Railway

Para ver se o Railway está tentando fazer deploy:

1. No Railway, vá para o serviço da API
2. Clique na aba **Deployments**
3. Veja se há algum deployment em andamento ou falhado
4. Clique em um deployment para ver os logs
5. Verifique se há erros de conexão com GitHub

---

## ⚠️ Problemas Comuns

### Problema 1: Railway não detecta commits

**Solução**: Reconecte o repositório ou force um redeploy manual

### Problema 2: Build falha antes de chegar ao código

**Solução**: Verifique o Build Command e variáveis de ambiente

### Problema 3: Branch incorreto

**Solução**: Altere o branch no Railway para `main`

### Problema 4: Webhook do GitHub com erro

**Solução**: Reconecte o repositório no Railway para recriar o webhook

---

## 📞 Próximos Passos

1. **Verifique** todas as configurações acima
2. **Force um redeploy** manual no Railway
3. **Monitore os logs** do deployment
4. Se ainda não funcionar, **reconecte o repositório**

---

**Nota**: O commit `5aff404` está no GitHub e deve aparecer no Railway após verificar essas configurações.
