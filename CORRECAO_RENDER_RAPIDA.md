# ⚡ Correção Rápida - Erros no Render

## 🔴 Problemas Identificados

1. **JWT_SECRET tem apenas 30 caracteres** (precisa de 32+)
2. **Comando start falhando** (`node dist/index.js` não encontrado)

---

## ✅ Correções Imediatas

### 1. Atualizar JWT_SECRET no Render

1. Acesse: Render Dashboard → Seu Serviço → Settings → Environment
2. Encontre `JWT_SECRET`
3. Substitua por esta chave (64 caracteres):
   ```
   35ac4034f290bd81be283dba946b45a74b7fd00d2f25109a013f3b931a29ac6c
   ```
4. Salve

### 2. Verificar Configurações do Render

#### Root Directory
- **Settings** → **Service** → **Root Directory**
- **DEVE estar VAZIO** ou `.`
- **NÃO pode ser** `apps/api`

#### Build Command
- **Settings** → **Build & Deploy** → **Build Command**
- Deve ser: `npm install && npm run build:api`

#### Start Command  
- **Settings** → **Build & Deploy** → **Start Command**
- **Opção 1 (preferido):** `npm run start --workspace=@lia360/api`
- **Opção 2 (alternativa):** `node apps/api/dist/index.js`

### 3. Fazer Novo Deploy

1. Após corrigir, vá em **Manual Deploy**
2. Selecione branch `main`
3. Clique em **Deploy**
4. Monitore os logs

---

## ✅ Checklist

- [ ] JWT_SECRET atualizado (64 caracteres)
- [ ] Root Directory = vazio ou `.`
- [ ] Build Command = `npm install && npm run build:api`
- [ ] Start Command = `npm run start --workspace=@lia360/api`
- [ ] Novo deploy iniciado
- [ ] Logs verificados

---

**Guia completo:** Veja `CORRIGIR_RENDER.md`
