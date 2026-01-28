# Migrate to Neon PostgreSQL

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate database from Supabase PostgreSQL to Neon PostgreSQL while maintaining all data and functionality.

**Architecture:** Replace Supabase connection strings with Neon connection strings. Export data from Supabase, import to Neon. Update environment configuration. Verify connection and data integrity.

**Tech Stack:** Neon PostgreSQL, Prisma ORM, Node.js

---

## Prerequisites

**Before starting:**

- You must have created a Neon project
- Get your Neon connection strings from: https://console.neon.tech/
- Neon connection string format: `postgresql://[user]:[password]@[neon-host]/[database]?sslmode=require`

**Note:** Neon uses pooled connections by default (via pgBouncer), so `DATABASE_URL` from Neon is already optimized.

---

## Task 1: Export Data from Supabase

**Why:** Preserve existing data before switching databases.

**Files:**

- Read: `.env` (Supabase credentials)
- Create: `scripts/export-supabase-data.sql`

**Step 1: Create export directory**

```bash
mkdir -p scripts/backup
```

Expected: Directory created

**Step 2: Use pg_dump to export Supabase data**

```bash
# From project root
pg_dump "$DIRECT_URL" \
  --data-only \
  --column-inserts \
  --disable-triggers \
  --file=scripts/backup/supabase-data-$(date +%Y%m%d).sql \
  --table="Company" \
  --table="Workspace" \
  --table="User" \
  --table="Lead" \
  --table="Pipeline" \
  --table="Stage" \
  --table="AuditLog"
```

Expected: SQL file created with INSERT statements

**Step 3: Verify export file exists**

```bash
ls -lh scripts/backup/supabase-data-*.sql
```

Expected: File exists with size > 0

**Note:** If database is empty/new, skip to Task 2. No data to migrate.

---

## Task 2: Update Environment Variables

**Files:**

- Modify: `.env`

**Step 1: Get Neon connection strings**

From Neon console, copy:

- **Connection string** (with pooling) → will be `DATABASE_URL`
- **Connection string** (without pooling) → will be `DIRECT_URL`

Format should look like:

```
postgresql://[user]:[password]@[region].neon.tech/[database]?sslmode=require
```

**Step 2: Update .env file**

Replace lines 2-3 in `.env`:

```bash
# Old (Supabase):
# DATABASE_URL=postgres://postgres:xxx@db.supabase.co:6543/postgres
# DIRECT_URL=postgresql://postgres:xxx@db.supabase.co:5432/postgres?sslmode=require

# New (Neon):
DATABASE_URL=postgresql://[user]:[password]@[region].neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://[user]:[password]@[region].neon.tech/neondb?sslmode=require
```

**Important:** Get the actual connection strings from your Neon console:

- Go to https://console.neon.tech/
- Select your project
- Copy the connection strings from the dashboard

**Step 3: Remove Supabase-specific variables**

Edit `.env`, remove or comment lines 27-31:

```bash
# SUPABASE_URL=
# SUPABASE_SERVICE_KEY=
# SUPABASE_ANON_KEY=
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Step 4: Verify .env format**

```bash
cat .env | grep -E "^DATABASE_URL|^DIRECT_URL"
```

Expected: Output shows new Neon URLs

---

## Task 3: Update Database Configuration

**Files:**

- Modify: `packages/database/src/index.ts`
- Modify: `apps/api/src/config/env.ts`

**Step 1: Remove Supabase client initialization from database package**

Edit `packages/database/src/index.ts`, remove lines 267-293:

```typescript
// DELETE this entire section:
// ============================================
// SUPABASE CLIENT (OPTIONAL)
// ============================================

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).trim();
const supabaseKey = (
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ""
).trim();

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("[Database] Supabase Client initialized");
  } catch (error) {
    console.warn("[Database] Supabase initialization failed:", error);
    supabase = null;
  }
} else {
  console.log("[Database] Supabase not configured (optional)");
}

export { supabase };
```

Also remove the import at line 2:

```typescript
import { createClient } from "@supabase/supabase-js"; // DELETE THIS LINE
```

**Step 2: Remove Supabase from validation in API config**

Edit `apps/api/src/config/env.ts`, remove line 11 from the filter:

Before:

```typescript
k.startsWith("SUPABASE");
```

After: Remove that line entirely.

Also remove from schema (lines 37-38):

```typescript
// DELETE these lines:
SUPABASE_URL: z.string().optional(),
SUPABASE_SERVICE_KEY: z.string().optional(),
```

**Step 3: Update connection string validation for Neon**

Edit `packages/database/src/index.ts`, update the error message at lines 75-76:

Before:

```typescript
console.error("[Database] For Supabase with pgbouncer:");
console.error(
  "[Database]   postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true",
);
```

After:

```typescript
console.error("[Database] For Neon:");
console.error(
  "[Database]   postgresql://[user]:[password]@[region].neon.tech/neondb?sslmode=require",
);
```

Also update line 19 similarly:

```typescript
// Before: "For Supabase with pgbouncer, ensure:"
// After: "For Neon with connection pooling, ensure:"
```

And lines 20-21:

```typescript
// Before: DATABASE_URL=postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
// After: DATABASE_URL=postgresql://[user]:[password]@[region].neon.tech/neondb?sslmode=require
```

---

## Task 4: Push Schema to Neon

**Why:** Create all tables in the new Neon database.

**Files:**

- Run: `packages/database/prisma/schema.prisma`

**Step 1: Regenerate Prisma client**

```bash
npm run db:generate
```

Expected: Output shows "Prisma Client generated successfully"

**Step 2: Push schema to Neon**

```bash
npm run db:push
```

Expected:

```
✔ Enter Prisma schema to push...
The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20250121_XXXXX_init/
    └─ migration.sql

Your database is now in sync with your schema.
```

**Step 3: Verify tables created**

You can verify in Neon console:

1. Go to https://console.neon.tech/
2. Select your project
3. Click "SQL Editor"
4. Run: `\dt`

Expected: List of tables (Company, Workspace, User, Lead, Pipeline, Stage, etc.)

---

## Task 5: Import Data to Neon (if applicable)

**Why:** Restore exported data from Supabase.

**Files:**

- Use: `scripts/backup/supabase-data-*.sql` (from Task 1)

**Step 1: Import data using psql**

```bash
psql "$DATABASE_URL" < scripts/backup/supabase-data-*.sql
```

Expected: No errors, or "INSERT 0 X" messages

**Note:** If you skipped Task 1 (no data to export), skip this step.

**Step 2: Verify data in Neon**

In Neon SQL Editor, run:

```sql
SELECT COUNT(*) FROM "Company";
SELECT COUNT(*) FROM "Workspace";
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Lead";
```

Expected: Counts match your data

**Note:** If database was empty, all counts should be 0 (that's OK).

---

## Task 6: Test Connection and Functionality

**Why:** Verify everything works with the new Neon database.

**Files:**

- Test: `apps/api/src/config/env.ts`
- Test: `packages/database/src/index.ts`

**Step 1: Start API server**

```bash
npm run api:dev
```

Expected output:

```
[Config] Environment validated successfully
[Database] =======================================
[Database] Initializing Database Connection...
[Database] =======================================
[Database] DATABASE_URL validated:
[Database]   - Protocol: postgresql:
[Database]   - Hostname: [region].neon.tech
[Database]   - Port: 5432 (default)
[Database]   - Database: neondb
[Database]   - Has pgbouncer: false
[Database] Creating Prisma Client...
[Database] Prisma Client created successfully
[Database] ✓ Database connected successfully (latency: XXms)
```

**Step 2: Test database query**

In another terminal, run:

```bash
node -e "
  const { PrismaClient } = require('@packages/database');
  const prisma = new PrismaClient();
  prisma.\$connect().then(() => {
    console.log('✓ Connected to Neon');
    return prisma.company.count();
  }).then(count => {
    console.log('✓ Companies count:', count);
    process.exit(0);
  }).catch(err => {
    console.error('✗ Error:', err.message);
    process.exit(1);
  });
"
```

Expected: `✓ Connected to Neon` and count shown

**Step 3: Test API endpoint**

```bash
curl http://localhost:3001/api/v1/health
```

Or if health endpoint doesn't exist:

```bash
curl http://localhost:3001/api/v1/pipelines -H "Authorization: Bearer test-token"
```

Expected: API response (possibly 401 if no valid token, but that's OK - means API is running)

**Step 4: Start web application**

```bash
npm run web:dev
```

Expected: Web app starts at http://localhost:3000

**Step 5: Test full application flow**

1. Open http://localhost:3000
2. Login to your account
3. Navigate to Leads
4. Check that data loads correctly
5. Create a test lead
6. Verify it appears in the list

Expected: All functionality works as before

---

## Task 7: Update Documentation

**Why:** Keep documentation accurate for future developers.

**Files:**

- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Update CLAUDE.md**

Edit `CLAUDE.md`, section "Database", replace lines about Supabase:

Before:

```markdown
### Database

- PostgreSQL hosted on Supabase (connection pooling via pgBouncer)
- `DATABASE_URL`: pooled connection (port 6543)
- `DIRECT_URL`: direct connection for migrations (port 5432)
```

After:

```markdown
### Database

- PostgreSQL hosted on Neon (serverless PostgreSQL)
- `DATABASE_URL`: primary connection with SSL
- `DIRECT_URL`: direct connection for migrations (same as DATABASE_URL for Neon)
```

Also update in "Environment Variables" section:

````markdown
Required for development:

```env
DATABASE_URL=postgresql://...      # Neon connection string
DIRECT_URL=postgresql://...        # Same as DATABASE_URL for Neon
JWT_SECRET=<min 32 chars>
NEXT_PUBLIC_API_URL=http://localhost:3001
```
````

**Step 2: Update README.md**

Find and replace any mention of Supabase with Neon in the README.

**Step 3: Update schema.prisma comment**

Edit `packages/database/prisma/schema.prisma`, line 15-20:

Before:

```prisma
// NOTE: For Supabase with pgbouncer, ensure:
// DATABASE_URL=postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
// DIRECT_URL=postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

After:

```prisma
// NOTE: For Neon, ensure:
// DATABASE_URL=postgresql://[user]:[password]@[region].neon.tech/neondb?sslmode=require
// DIRECT_URL=postgresql://[user]:[password]@[region].neon.tech/neondb?sslmode=require
```

**Step 4: Remove Supabase package dependency**

```bash
npm uninstall @supabase/supabase-js
```

Expected: Package removed from package.json and node_modules

---

## Task 8: Cleanup Supabase Resources

**Why:** Remove old infrastructure and avoid confusion.

**Step 1: Backup old connection strings**

Create a reference file (optional):

```bash
echo "SUPABASE_OLD_URL=$DIRECT_URL" >> scripts/backup/.supabase-backup
```

**Step 2: Delete Supabase project (optional)**

If you're sure everything works:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Project Settings → General
4. Click "Pause project" or "Delete project"

**Note:** Keep the Supabase project for a few days as a backup until you're confident Neon is working perfectly.

---

## Task 9: Verify Production Deployment (if applicable)

**Why:** Ensure production environment also uses Neon.

**Files:**

- Update: Render/Railway/your-host environment variables

**Step 1: Update production environment variables**

In your hosting platform (Render, Railway, etc.):

1. Go to Environment Variables section
2. Update `DATABASE_URL` to your Neon connection string
3. Update `DIRECT_URL` to your Neon connection string
4. Remove any `SUPABASE_*` variables

**Step 2: Redeploy application**

Trigger a new deployment in your hosting platform.

**Step 3: Test production**

1. Access your production URL
2. Login and verify functionality
3. Check logs for database connection errors

Expected: Application works normally with Neon

---

## Task 10: Commit Changes

**Why:** Version control for the migration.

**Step 1: Review all changes**

```bash
git status
```

Expected: Shows modified files (.env, config files, docs)

**Step 2: Add changes to git**

```bash
git add .env packages/database/src/index.ts apps/api/src/config/env.ts CLAUDE.md README.md packages/database/prisma/schema.prisma
```

**Step 3: Commit migration**

```bash
git commit -m "feat: migrate database from Supabase to Neon

- Update DATABASE_URL and DIRECT_URL to Neon
- Remove Supabase client initialization
- Update configuration validation
- Update documentation
- Remove @supabase/supabase-js dependency
"
```

Expected: Commit created successfully

**Step 4: Create tag for reference (optional)**

```bash
git tag -a v0.1.0-neon-migration -m "Migrate to Neon PostgreSQL"
git push origin main --tags
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] `.env` has Neon connection strings
- [ ] API starts without errors
- [ ] Database connection test passes
- [ ] All data migrated successfully (if existed)
- [ ] Application features work (login, leads, pipelines)
- [ ] Documentation updated
- [ ] Supabase client code removed
- [ ] No Supabase references in codebase (except this migration plan)
- [ ] Production deployed with Neon (if applicable)
- [ ] Old Supabase project backed up/paused

---

## Troubleshooting

**Connection fails:**

- Verify DATABASE_URL is correct (copy from Neon console)
- Check SSL mode is enabled (`?sslmode=require`)
- Ensure Neon project is active (not suspended)

**Data import errors:**

- Check if export file exists and is valid SQL
- Verify tables were created with `npm run db:push`
- Check Neon logs in console

**API errors:**

- Check API logs for database connection errors
- Verify Prisma client was regenerated: `npm run db:generate`
- Test database connection manually with psql

**Performance issues:**

- Neon uses connection pooling by default
- Check Neon metrics dashboard for connection limits
- Consider upgrading Neon plan if hitting limits

---

## Next Steps (Optional Future Enhancements)

After successful migration, consider:

1. **Enable Neon branching** for development/staging environments
2. **Set up automated backups** in Neon console
3. **Configure connection pooling limits** based on traffic
4. **Monitor Neon metrics** for performance optimization
5. **Set up alerts** for database issues

---

## Rollback Plan (if needed)

If migration fails:

1. **Restore .env from backup:**

   ```bash
   git checkout HEAD -- .env
   # Then manually restore Supabase URLs from your backup
   ```

2. **Restore Supabase client code:**

   ```bash
   git checkout HEAD -- packages/database/src/index.ts apps/api/src/config/env.ts
   ```

3. **Reinstall Supabase package:**

   ```bash
   npm install @supabase/supabase-js
   ```

4. **Restart application**

The Supabase database should still be available for rollback (unless deleted).
