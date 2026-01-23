# Correção de Validação de Importação de Leads

## Problema Identificado

A API estava retornando erro 400 (Bad Request) ao tentar importar leads via extensão Chrome. O problema estava relacionado à validação de schemas Zod que não aceitavam valores `null`, strings vazias ou `undefined` para campos opcionais como `avatarUrl`, `profileUrl`, `email`, etc.

## Correções Aplicadas

### 1. Schema de Validação (`packages/shared/src/schemas/index.ts`)

**Antes:**
- Campos como `profileUrl`, `avatarUrl`, `email` usavam `.url()` ou `.email()` diretamente, falhando quando recebiam `null` ou strings vazias.

**Depois:**
- Criados helpers `urlOrEmpty` e `emailOrEmpty` que usam `z.union()` para aceitar:
  - URLs/emails válidos
  - Strings vazias (`''`)
  - `null`
  - `undefined`
- Usam `.transform()` para normalizar strings vazias e `null` para `null` antes de salvar no banco.

**Exemplo:**
```typescript
const urlOrEmpty = z.union([
  z.string().url(),
  z.literal(''),
  z.null(),
  z.undefined(),
]).transform((val) => (val === '' || val === null || val === undefined ? null : val));
```

### 2. Tratamento de Erros (`apps/api/src/middleware/error-handler.ts`)

**Melhorias:**
- Adicionado log detalhado de erros de validação
- Incluído campo `received` mostrando o valor que causou o erro
- Melhor tratamento de tipos TypeScript para evitar erros de spread

### 3. Middleware de Validação (`apps/api/src/middleware/validate.ts`)

**Melhorias:**
- Usa `safeParseAsync()` em vez de `parseAsync()` para obter erros mais detalhados
- Passa erros Zod diretamente para o error handler

### 4. Processamento de Leads (`apps/api/src/routes/leads.ts`)

**Melhorias:**
- Limpeza explícita de dados antes de salvar no banco
- Garantia de que valores `null` sejam tratados corretamente
- Logs de erro mais detalhados durante importação

## Campos Suportados Agora

O schema `importLeadDataSchema` agora aceita corretamente:
- `username`: string, string vazia, null, undefined
- `fullName`: string, string vazia, null, undefined
- `profileUrl`: URL válida, string vazia, null, undefined
- `avatarUrl`: URL válida, string vazia, null, undefined
- `bio`: string, string vazia, null, undefined
- `email`: email válido, string vazia, null, undefined
- `phone`: string, string vazia, null, undefined
- `followersCount`: número inteiro >= 0, null, undefined
- `followingCount`: número inteiro >= 0, null, undefined
- `postsCount`: número inteiro >= 0, null, undefined
- `verified`: boolean, null, undefined
- `location`: string, string vazia, null, undefined
- `website`: URL válida, string vazia, null, undefined

## Como Testar

1. **Reconstruir o pacote shared:**
   ```bash
   npm run build --workspace=@lia360/shared
   ```

2. **Reiniciar a API:**
   ```bash
   npm run api:dev
   ```

3. **Recarregar a extensão no Chrome:**
   - Vá para `chrome://extensions/`
   - Clique em "Recarregar" na extensão Lia 360

4. **Testar importação:**
   - Faça login na extensão
   - Navegue para uma página do Instagram
   - Clique em "Importar Leads desta Página"
   - Verifique se a importação funciona sem erros 400

## Mensagens de Erro Melhoradas

Agora, se houver erro de validação, a resposta incluirá:
```json
{
  "success": false,
  "error": {
    "type": "validation_error",
    "title": "Validation Failed",
    "status": 400,
    "errors": [
      {
        "field": "leads.0.avatarUrl",
        "message": "Invalid url",
        "code": "invalid_string",
        "received": "invalid-url-value"
      }
    ]
  }
}
```

## Próximos Passos

Se ainda houver erros:
1. Verifique os logs da API para ver os detalhes do erro
2. Verifique o console do service worker da extensão (chrome://extensions/ → Detalhes → Service worker)
3. Verifique o formato dos dados sendo enviados pela extensão
