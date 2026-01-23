# Correção Definitiva: Prisma Generate no Railway

## 🔴 Problema

O Prisma Client não está sendo gerado durante o build no Railway, causando o erro:
```
Error: @prisma/client did not initialize yet. Please run "prisma generate"
```

## ✅ Solução Definitiva

### Opção 1: Configurar Build Command no Railway (RECOMENDADO)

No Railway, configure o **Build Command** explicitamente:

1. Vá em **Settings** > **Build & Deploy**
2. Em **Build Command**, use:
   ```bash
   npm run build:api
   ```
3. Em **Start Command**, mantenha:
   ```bash
   npm run start --workspace=@lia360/api
   ```

**OU** se o Railway não reconhecer o script do root:

```bash
npm run build --workspace=@lia360/shared && npm run build --workspace=@lia360/database && npm run build --workspace=@lia360/api
```

### Opção 2: Usar arquivo railway.json (ALTERNATIVA)

O arquivo `railway.json` foi criado na raiz do projeto. O Railway deve detectá-lo automaticamente.

Se não funcionar, configure manualmente no Railway Dashboard.

---

## 🔍 Verificações

### 1. Verificar Root Directory

No Railway:
- **Root Directory**: Deve estar vazio ou como `.` (raiz do projeto)
- **NÃO** deve ser `apps/api` - isso quebra o monorepo

### 2. Verificar Build Command

O Build Command deve executar na ordem:
1. `@lia360/shared` primeiro
2. `@lia360/database` segundo (que executa `prisma generate` via `prebuild`)
3. `@lia360/api` por último

### 3. Verificar se Prisma está instalado

O `prisma` está em `devDependencies` do `@lia360/database`. Certifique-se de que o Railway não está usando `--production` flag que exclui devDependencies.

---

## 📋 Configuração Completa no Railway

### Settings > Service
- **Root Directory**: `.` (vazio ou raiz)
- **Branch**: `main`
- **Auto Deploy**: Enabled

### Settings > Build & Deploy
- **Build Command**: 
  ```bash
  npm run build:api
  ```
  Ou:
  ```bash
  npm run build --workspace=@lia360/shared && npm run build --workspace=@lia360/database && npm run build --workspace=@lia360/api
  ```

- **Start Command**: 
  ```bash
  npm run start --workspace=@lia360/api
  ```

### Settings > Variables
- Todas as variáveis de ambiente necessárias (ver `VARIAVEIS_RAILWAY.md`)

---

## 🧪 Testar Localmente

Para testar se o build funciona localmente:

```bash
# Limpar builds anteriores
rm -rf packages/database/dist packages/shared/dist apps/api/dist
rm -rf node_modules/.prisma

# Executar build
npm run build:api

# Verificar se Prisma Client foi gerado
ls -la node_modules/.prisma/client
```

Se o Prisma Client foi gerado, o build está correto.

---

## ⚠️ Problemas Comuns

### Problema 1: Railway executa build em `apps/api`

**Sintoma**: Build Command não encontra `@lia360/database`

**Solução**: Configure Root Directory como `.` (raiz) no Railway

### Problema 2: Prisma não está instalado

**Sintoma**: `prisma: command not found`

**Solução**: Certifique-se de que o Railway não está usando `npm ci --production`. O Prisma está em `devDependencies` e precisa estar disponível durante o build.

### Problema 3: Schema.prisma não encontrado

**Sintoma**: `Error: Could not find Prisma schema`

**Solução**: O `prisma generate` precisa ser executado no diretório `packages/database`. O script `prebuild` faz isso automaticamente.

---

## ✅ Checklist Final

- [ ] Root Directory no Railway está como `.` (raiz do projeto)
- [ ] Build Command está configurado como `npm run build:api`
- [ ] Start Command está como `npm run start --workspace=@lia360/api`
- [ ] Variáveis de ambiente estão configuradas
- [ ] Build local funciona (`npm run build:api`)
- [ ] Prisma Client é gerado durante build local

---

**Após configurar, faça um redeploy no Railway e verifique os logs do build para confirmar que `prisma generate` está sendo executado.**
