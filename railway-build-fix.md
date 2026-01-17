# Correção do Build no Railway

O erro no Railway ocorre porque os pacotes `@sos360/shared` e `@sos360/database` não estão sendo construídos antes da API.

## Solução Rápida

No Railway, configure o **Build Command** para construir as dependências primeiro:

```bash
npm run build --workspace=@sos360/shared && npm run build --workspace=@sos360/database && npm run build --workspace=@sos360/api
```

**Ou** use o Turbo que já resolve dependências automaticamente:

```bash
npm install -g turbo && turbo build --filter=@sos360/api...
```

## Configuração no Railway

1. Vá em **Settings** > **Build & Deploy**
2. Em **Build Command**, use:
   ```bash
   npm run build --workspace=@sos360/shared && npm run build --workspace=@sos360/database && npm run build --workspace=@sos360/api
   ```
3. Em **Start Command**, mantenha:
   ```bash
   npm run start --workspace=@sos360/api
   ```

## Alternativa: Usar Turbo

Se o Railway tiver o Turbo instalado:

**Build Command:**
```bash
turbo build --filter=@sos360/api...
```

O Turbo automaticamente constrói todas as dependências (`@sos360/shared` e `@sos360/database`) antes da API.

## Erros de Tipo TypeScript

Os erros de tipos TypeScript já foram corrigidos no código. Se ainda aparecerem erros, faça commit das mudanças e faça redeploy.
