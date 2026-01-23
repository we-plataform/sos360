# 🔧 Correção de Erros no Deploy Render

## 🔴 Problemas Identificados nos Logs

### Problema 1: JWT_SECRET com menos de 32 caracteres

**Erro nos logs:**
```
JWT_SECRET: set (30 chars)
```

**Requisito:** Mínimo de 32 caracteres

**Solução:** Atualizar `JWT_SECRET` no Render com pelo menos 32 caracteres.

---

### Problema 2: Comando start falhando

**Erro nos logs:**
```
npm error command sh -c node dist/index.js
npm error path /opt/render/project/src/apps/api
```

**Possíveis causas:**
1. Root Directory configurado incorretamente
2. Build não gerou o arquivo `dist/index.js`
3. Comando start executando no diretório errado

---

## ✅ Soluções Passo a Passo

### 1. Corrigir JWT_SECRET

#### 1.1 Gerar uma nova chave segura

Execute no terminal local:

```bash
# Gerar chave aleatória de 64 caracteres (recomendado)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Chave gerada (use esta ou gere uma nova):**
```
35ac4034f290bd81be283dba946b45a74b7fd00d2f25109a013f3b931a29ac6c
```

Ou use este gerador online: https://generate-secret.vercel.app/64

#### 1.2 Atualizar no Render

1. Acesse o painel do Render
2. Vá em **Settings** > **Environment**
3. Encontre `JWT_SECRET`
4. Clique em **Edit**
5. Cole a nova chave (mínimo 32 caracteres)
6. Salve

**⚠️ IMPORTANTE:** Se você já tem usuários autenticados, ao mudar o `JWT_SECRET`, todos os tokens existentes serão invalidados. Os usuários precisarão fazer login novamente.

---

### 2. Corrigir Configuração do Build

#### 2.1 Verificar Root Directory

1. No Render, vá em **Settings** > **Service**
2. Verifique o campo **Root Directory**
3. **DEVE estar VAZIO** ou como `.` (ponto)
4. **NÃO deve ser** `apps/api`

#### 2.2 Verificar Build Command

1. Vá em **Settings** > **Build & Deploy**
2. **Build Command** deve ser:
   ```bash
   npm install && npm run build:api
   ```
   
   Ou alternativamente:
   ```bash
   npm install && npm run build --workspace=@lia360/shared && npm run build --workspace=@lia360/database && npm run build --workspace=@lia360/api
   ```

#### 2.3 Verificar Start Command

1. Na mesma página **Build & Deploy**
2. **Start Command** deve ser:
   ```bash
   npm run start --workspace=@lia360/api
   ```

#### 2.4 Verificar se o Build está gerando dist/

Após o build, verifique nos logs se aparece algo como:
```
> @lia360/api@0.0.1 build
> tsc
```

E se o arquivo `dist/index.js` foi criado. Se não aparecer, o problema pode ser:

- **TypeScript não está compilando**: Verifique se há erros de TypeScript nos logs
- **Dependências não foram buildadas**: Verifique se `@lia360/shared` e `@lia360/database` foram buildados antes

---

### 3. Solução Alternativa: Usar caminho direto no Start Command

Se o problema persistir, tente usar o caminho direto (como no `nixpacks.toml`):

**Start Command (Alternativa 1):**
```bash
node apps/api/dist/index.js
```

**Start Command (Alternativa 2):**
```bash
cd apps/api && node dist/index.js
```

**Start Command (Alternativa 3 - se estiver na raiz):**
```bash
npm run start --workspace=@lia360/api
```

> 💡 **Recomendação**: Tente primeiro `node apps/api/dist/index.js` que é mais direto e não depende de workspaces.

---

### 4. Verificar Estrutura de Diretórios após Build

Nos logs do build, procure por mensagens como:

```
✓ Built @lia360/shared
✓ Built @lia360/database  
✓ Built @lia360/api
```

E verifique se o diretório `apps/api/dist/` foi criado.

---

## 🧪 Testar Localmente Antes de Deploy

Para garantir que tudo funciona, teste localmente:

```bash
# Na raiz do projeto
npm install
npm run build:api

# Verificar se dist/index.js foi criado
ls -la apps/api/dist/index.js

# Testar start
npm run start --workspace=@lia360/api
```

Se funcionar localmente mas não no Render, o problema é de configuração do Render.

---

## 📋 Checklist de Correção

- [ ] **JWT_SECRET atualizado** com pelo menos 32 caracteres
- [ ] **Root Directory** está vazio ou `.` (não `apps/api`)
- [ ] **Build Command** está correto: `npm install && npm run build:api`
- [ ] **Start Command** está correto: `npm run start --workspace=@lia360/api`
- [ ] Build local funciona (`npm run build:api`)
- [ ] `dist/index.js` existe após build local
- [ ] Todas as variáveis de ambiente estão configuradas

---

## 🔄 Após Corrigir

1. **Salve todas as alterações** no Render
2. **Faça um Manual Deploy**:
   - Vá em **Manual Deploy**
   - Selecione a branch `main`
   - Clique em **Deploy**
3. **Monitore os logs** para verificar se:
   - Build completa com sucesso
   - `dist/index.js` é encontrado
   - Servidor inicia corretamente

---

## 🐛 Se Ainda Não Funcionar

### Opção 1: Verificar logs completos do build

Nos logs, procure por:
- Erros de TypeScript
- Erros de dependências faltando
- Erros de Prisma generate

### Opção 2: Criar arquivo render.yaml

Crie um arquivo `render.yaml` na raiz do projeto:

```yaml
services:
  - type: web
    name: lia360-api
    env: node
    buildCommand: npm install && npm run build:api
    startCommand: npm run start --workspace=@lia360/api
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
```

### Opção 3: Usar Docker (último recurso)

Se nada funcionar, considere criar um `Dockerfile` na raiz:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/

RUN npm install

COPY . .

RUN npm run build:api

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

---

## 📞 Próximos Passos

1. Corrija o `JWT_SECRET` primeiro (mais crítico)
2. Verifique a configuração do Root Directory
3. Faça um novo deploy
4. Se ainda falhar, compartilhe os logs completos do build

---

**Última atualização:** Baseado nos logs de erro do Render de 17/01/2025
