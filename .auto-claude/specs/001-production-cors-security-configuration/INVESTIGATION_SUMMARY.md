# Codebase Investigation Summary
## Production CORS Security Configuration

**Date:** 2026-01-28
**Investigator:** Planner Agent
**Task:** Implement proper CORS configuration using CHROME_EXTENSION_ID environment variable

---

## 1. Project Structure Analysis

### Project Type
- **Type:** Monorepo (Turborepo)
- **Language:** TypeScript
- **API Framework:** Express.js
- **Validation:** Zod schemas

### Services
1. **api** (`apps/api/`) - Express.js REST API + Socket.io
   - Port: 3001
   - Tech: TypeScript, Express, Helmet, CORS, Socket.io
   - Entry Point: `apps/api/src/index.ts`

2. **web** (`apps/web/`) - Next.js 14 frontend
   - Port: 3000
   - Tech: Next.js, React, Tailwind CSS

3. **extension** (`apps/extension/`) - Chrome Manifest V3 extension
   - Tech: Vanilla JavaScript
   - Manifest: `apps/extension/manifest.json`

4. **packages**
   - `packages/database/` - Prisma schema and client
   - `packages/shared/` - Zod schemas, types, constants

---

## 2. Security Vulnerability Identified

### Location
**File:** `apps/api/src/index.ts`
**Lines:** 76-79

### Vulnerable Code
```typescript
// Allow Chrome extensions (chrome-extension://)
if (origin.startsWith('chrome-extension://')) {
  return callback(null, true);
}
```

### Issue
The code allows **ANY** Chrome extension to make requests to the API, regardless of its extension ID. This is a critical security vulnerability in production.

### Impact
- Any malicious Chrome extension can access the API
- Data can be exfiltrated
- Unauthorized operations can be performed
- Bypasses all authentication/authorization for extension requests

---

## 3. Existing Patterns Analysis

### Environment Variable Pattern
**File:** `apps/api/src/config/env.ts`

**Pattern:**
- All environment variables validated using Zod schemas
- Schema validates, transforms (e.g., `.split()` for arrays)
- Exports typed `env` object
- Example from CORS_ORIGINS:
  ```typescript
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean))
  ```

**Application to CHROME_EXTENSION_ID:**
- Should use `.string().optional()` for development compatibility
- No transformation needed (single string value)
- Export as `env.CHROME_EXTENSION_ID`

### CORS Configuration Pattern
**File:** `apps/api/src/index.ts`

**Current Pattern:**
```typescript
const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    if (!origin) return callback(null, true);

    // VULNERABLE: Allows all chrome-extension:// origins
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    // Check configured origins
    const isAllowed = env.CORS_ORIGINS.some((allowedOrigin) => {
      // Exact match or wildcard logic
    });

    if (isAllowed || env.CORS_ORIGINS.includes('*')) {
      return callback(null, true);
    }

    // Development localhost fallback
    if (env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    callback(new Error('Not allowed by CORS'));
  }
}
```

**Required Change:**
Replace the vulnerable `startsWith('chrome-extension://')` check with:
```typescript
if (origin.startsWith('chrome-extension://')) {
  // In production, require specific extension ID
  if (env.NODE_ENV === 'production') {
    if (!env.CHROME_EXTENSION_ID) {
      logger.warn('Production mode: CHROME_EXTENSION_ID not set, rejecting all extension origins');
      return callback(new Error('Chrome extension ID not configured'));
    }
    const expectedOrigin = `chrome-extension://${env.CHROME_EXTENSION_ID}`;
    if (origin === expectedOrigin) {
      return callback(null, true);
    }
    logger.warn({ origin, expectedOrigin }, 'CORS: Extension ID mismatch');
    return callback(new Error('Not allowed by CORS'));
  }
  // In development, allow all extension origins for testing
  return callback(null, true);
}
```

---

## 4. Documentation Issues

### Files with Vulnerable Patterns

1. **DEPLOY_API.md** (Line 34)
   ```markdown
   CORS_ORIGINS=https://seu-app.vercel.app,https://seu-app-git-*.vercel.app,chrome-extension://*
   ```
   **Issue:** Recommends `chrome-extension://*` which perpetuates vulnerability

2. **DEPLOY_RENDER.md** (Lines 68, 83, 169, 251)
   ```markdown
   CORS_ORIGINS=https://seu-app.vercel.app,https://*.vercel.app,chrome-extension://*
   ```
   **Issue:** Multiple instances of `chrome-extension://*` pattern

3. **VARIAVEIS_RAILWAY.md** (needs verification)
   - Not yet read, likely contains same pattern

### Required Documentation Updates
1. Add `CHROME_EXTENSION_ID` to environment variables section
2. Remove `chrome-extension://*` from CORS_ORIGINS examples
3. Add instructions on how to obtain extension ID from `chrome://extensions/`
4. Add security warning about extension ID validation

---

## 5. Chrome Extension Context

### Extension Manifest
**File:** `apps/extension/manifest.json`

**Key Details:**
- Version: 1.0.1
- Manifest V3
- No extension ID hardcoded (will be assigned on publish)

### Extension ID Acquisition
**Development:**
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Load unpacked extension from `apps/extension/`
4. Copy the Extension ID shown

**Production:**
1. Publish to Chrome Web Store
2. Extension ID assigned by store
3. Use the store-assigned ID

### Extension Origin Format
```
chrome-extension://<EXTENSION_ID>
```

Example: `chrome-extension://abcdefghijklmnopabcdefghijlkmno`

---

## 6. Socket.io CORS Considerations

**Location:** `apps/api/src/index.ts` lines 54-58

```typescript
io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS,
    credentials: true,
  },
});
```

**Issue:** Socket.io uses `env.CORS_ORIGINS` array, which doesn't include extension-specific validation

**Solution Options:**
1. **Option A:** Add chrome-extension origin to CORS_ORIGINS dynamically
   - Pro: Reuses existing array
   - Con: Mixes origins with different validation logic

2. **Option B:** Use function-based origin for Socket.io
   - Pro: Consistent with Express CORS
   - Con: More complex setup

3. **Option C:** Accept that Socket.io CORS uses CORS_ORIGINS and document it
   - Pro: Simplest implementation
   - Con: Inconsistent security between HTTP and WebSocket

**Recommendation:** Option C for simplicity, but document that Socket.io connections must be authenticated separately via Socket.io auth mechanism (not just CORS).

---

## 7. Testing Strategy

### Development Mode Testing
- Must work without CHROME_EXTENSION_ID set
- Must allow localhost origins
- Must allow chrome-extension:// origins for local testing

### Production Mode Testing
- Must require CHROME_EXTENSION_ID to be set
- Must reject chrome-extension:// origins that don't match
- Must allow specific chrome-extension://<ID> origin
- Must log rejected origins for debugging

### Verification Commands
```bash
# Build test
cd apps/api && npm run build

# Development mode test
NODE_ENV=development npm run build

# Security scan
grep -r 'chrome-extension://\*' --include='*.ts' --include='*.md' .

# Environment variable check
grep 'CHROME_EXTENSION_ID' apps/api/src/config/env.ts
```

---

## 8. Implementation Phases

### Phase 1: Add Environment Variable
- Add `CHROME_EXTENSION_ID` to Zod schema in `apps/api/src/config/env.ts`
- Make it optional (`.optional()`) for development compatibility
- Update `.env.temp` with placeholder and instructions

### Phase 2: Update CORS Logic
- Replace vulnerable `startsWith('chrome-extension://')` check
- Add production mode validation against `env.CHROME_EXTENSION_ID`
- Keep development mode permissive for local testing
- Ensure TypeScript compilation succeeds

### Phase 3: Update Documentation
- Update `DEPLOY_API.md`
- Update `DEPLOY_RENDER.md`
- Update `VARIAVEIS_RAILWAY.md` (if exists)
- Check for other deployment docs
- Remove all `chrome-extension://*` patterns
- Add `CHROME_EXTENSION_ID` documentation

### Phase 4: Test and Verify
- Start API in development mode
- Verify localhost origins work
- Verify extension origins work in dev
- Test production mode with CHROME_EXTENSION_ID set
- Verify Socket.io CORS configuration

### Phase 5: Finalize and Clean
- Verify vulnerable code is removed
- Create security fix summary
- Document testing instructions
- Verify no remaining permissive patterns

---

## 9. Risk Assessment

### Risk Level: **HIGH**

**Reasons:**
1. Security-critical code modification
2. Breaking change for existing extensions if not done carefully
3. Affects both HTTP and WebSocket connections
4. Must maintain development mode functionality
5. Production deployment requires real extension ID

**Mitigation:**
- Implement in stages with testing at each phase
- Keep development mode permissive
- Require staging deployment before production
- Security scanning for remaining permissive patterns
- Comprehensive testing with real extension ID

---

## 10. Success Criteria

### Must Have
- [ ] CHROME_EXTENSION_ID environment variable added
- [ ] CORS logic validates specific extension ID in production
- [ ] Development mode still works without extension ID
- [ ] All deployment documentation updated
- [ ] No `chrome-extension://*` patterns remain
- [ ] TypeScript compilation succeeds
- [ ] All existing tests pass

### Should Have
- [ ] Security fix summary created
- [ ] Testing instructions documented
- [ ] Socket.io CORS addressed or documented

### Nice to Have
- [ ] Automated tests for CORS validation
- [ ] Integration test with real extension

---

## Conclusion

This investigation identified a **critical security vulnerability** in the CORS configuration. The fix requires careful implementation across environment variables, CORS logic, and documentation. The refactor workflow approach with staged implementation ensures no breaking changes during deployment while maintaining security and functionality.

**Next Steps:** Proceed to implementation using the created `implementation_plan.json`.
