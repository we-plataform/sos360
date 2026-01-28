# Production Deployment - Neon Migration

## Production Deployment Status

**Current Production URL**: `https://lia360api-production.up.railway.app`

**Status**: Currently returning 502 errors (database connection issue)

**Action Required**: Update Railway environment variables to use Neon instead of Supabase

---

## Why Production Needs Update

The production deployment is currently failing with 502 errors. This is likely because:

1. It's still configured to use Supabase database credentials
2. The Supabase database may have been deprecated or connection failed
3. Neon migration was completed in development but not yet applied to production

---

## Updating Production Environment Variables on Railway

### Step 1: Access Railway Dashboard

1. Go to: https://railway.app/
2. Login to your account
3. Select project: `lia360api-production`

### Step 2: Update Database Variables

1. Click on your API service
2. Go to the **Variables** tab
3. Update the following variables:

**Current Neon Connection String** (copy these):

```env
DATABASE_URL=postgresql://neondb_owner:npg_6Aerb1TskcCt@ep-floral-surf-ac2o21mi-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

DIRECT_URL=postgresql://neondb_owner:npg_6Aerb1TskcCt@ep-floral-surf-ac2o21mi-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Step 3: Remove Supabase Variables

Delete these variables if they exist:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`

### Step 4: Verify Other Variables

Make sure these are still set:

- `NODE_ENV=production`
- `JWT_SECRET` (your existing secret)
- `PORT` (Railway auto-sets this, typically 8080 or 3001)
- `CORS_ORIGINS` (if configured)

### Step 5: Trigger Deployment

Railway will automatically redeploy when you save variables. You can also:

1. Go to the **Deployments** tab
2. Click **Redeploy** on the latest deployment

---

## Verification Steps

### 1. Check Deployment Logs

Go to Railway → Your Service → Deployments → Click on latest deployment

**Look for successful connection logs:**

```
[Database] ✓ Database connected successfully
[Database] Hostname: ep-floral-surf-ac2o21mi-pooler.sa-east-1.aws.neon.tech
Server is ready to accept connections
```

**Error logs to avoid:**

```
Error: Can't reach database server
PrismaClientInitializationError: Connection refused
```

### 2. Test Production Health Endpoint

```bash
curl https://lia360api-production.up.railway.app/health
```

**Expected response:**

```json
{ "status": "ok", "timestamp": "2025-01-21T..." }
```

### 3. Test Authentication

```bash
curl -X POST https://lia360api-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"your-email@example.com",
    "password":"your-password"
  }'
```

**Expected response:**

```json
{
  "data": {
    "user": {...},
    "tokens": {
      "accessToken": "...",
      "refreshToken": "..."
    }
  }
}
```

### 4. Test a Protected Endpoint

```bash
curl https://lia360api-production.up.railway.app/api/v1/pipelines \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected response:**

```json
{
  "data": [...],
  "pagination": {...}
}
```

### 5. Monitor Neon Dashboard

1. Go to: https://console.neon.tech/
2. Select project: `neondb`
3. Check **Metrics** tab:
   - Active connections should increase
   - Query latency should be < 100ms
   - No errors in the logs

---

## Rollback Procedure

If production has issues after migration:

### Option 1: Restore Supabase Connection

1. Go to Railway → Variables tab
2. Restore `DATABASE_URL` and `DIRECT_URL` to Supabase values
3. Find backup in: `scripts/backup/.supabase-backup`
4. Redeploy

### Option 2: Check Development Environment

1. Verify development still works with Neon:

   ```bash
   npm run dev
   curl http://localhost:3001/health
   ```

2. If development works, the issue is likely:
   - Missing environment variable in production
   - Railway-specific configuration
   - Network/firewall issue

---

## Pre-Deployment Checklist

Before updating production:

- [x] Development environment fully tested with Neon
- [x] All features working with Neon locally
- [ ] Backup of production Supabase data created (if needed)
- [x] Rollback procedure documented
- [ ] Team notified of deployment
- [ ] Production database migration applied (see below)

---

## Production Database Migration

### Applying Prisma Migrations to Neon

If you need to run migrations on production Neon:

```bash
# Option 1: Using direct connection (recommended for migrations)
DATABASE_URL="postgresql://neondb_owner:npg_6Aerb1TskcCt@ep-floral-surf-ac2o21mi.sa-east-1.aws.neon.tech/neondb?sslmode=require" \
npx prisma migrate deploy

# Option 2: Using the DIRECT_URL
DIRECT_URL="postgresql://neondb_owner:npg_6Aerb1TskcCt@ep-floral-surf-ac2o21mi.sa-east-1.aws.neon.tech/neondb?sslmode=require" \
npx prisma db push
```

### Verify Schema Synchronized

```bash
# Check if schema matches
npx prisma db pull
git diff packages/database/prisma/schema.prisma
```

---

## Post-Deployment Checklist

After updating production:

- [ ] Deployment logs show Neon connection
- [ ] API health check passing (200 OK)
- [ ] Authentication working (login returns tokens)
- [ ] CRUD operations working (create/read/update/delete)
- [ ] Neon dashboard shows active connections
- [ ] Monitor for 24-48 hours
- [ ] Check error rates in Railway logs
- [ ] Verify no data loss occurred

---

## Common Issues and Solutions

### Issue 1: 502 Bad Gateway After Update

**Cause**: Database connection not established yet

**Solution**:

1. Wait 2-3 minutes for Neon to accept connection
2. Check Railway deployment logs
3. Verify `DATABASE_URL` is correct (no typos)
4. Check Neon dashboard for connection issues

### Issue 2: Connection Timeout

**Cause**: Neon requires SSL or firewall blocking

**Solution**:

- Ensure `?sslmode=require` is in connection string
- Check Railway's network settings
- Verify Neon allows connections from Railway's IPs

### Issue 3: Prisma Errors

**Cause**: Schema not synchronized

**Solution**:

```bash
# From local machine with production DATABASE_URL
DATABASE_URL="..." npx prisma db push --skip-generate
```

### Issue 4: High Latency

**Cause**: Neon region is far from Railway

**Current**: Neon is in `sa-east-1` (São Paulo, Brazil)
**Railway**: Typically in US-East

**Solution**: Consider creating Neon project closer to Railway, or vice versa

---

## Monitoring Production

### Key Metrics to Watch

1. **Railway Dashboard**:
   - CPU usage
   - Memory usage
   - Restart count
   - Response times

2. **Neon Dashboard**:
   - Active connections
   - Query latency
   - Storage used
   - Write throughput

3. **API Health**:
   ```bash
   # Continuous health check
   watch -n 30 'curl -s https://lia360api-production.up.railway.app/health | jq'
   ```

---

## Support Resources

If you encounter issues:

1. **Neon Console**: https://console.neon.tech/
   - Check project metrics
   - Review query logs
   - Verify connection string

2. **Railway Console**: https://railway.app/
   - Review deployment logs
   - Check environment variables
   - Monitor service health

3. **Documentation**:
   - Migration plan: `docs/plans/2025-01-21-migrate-to-neon.md`
   - Completion report: `docs/NEON_MIGRATION_COMPLETE.md`
   - Supabase cleanup: `SUPABASE_CLEANUP_GUIDE.md`

4. **Rollback**:
   - Supabase backup: `scripts/backup/.supabase-backup`
   - Use this if critical issues occur

---

## Next Steps

1. **Immediate**: Update Railway environment variables with Neon connection string
2. **Verify**: Test all endpoints and monitor logs
3. **Monitor**: Check Railway and Neon dashboards for 24-48 hours
4. **Optimize**: Review query performance and Neon metrics after 1 week
5. **Clean up**: Remove Supabase resources after successful migration (see `SUPABASE_CLEANUP_GUIDE.md`)

---

## Quick Reference: Neon Connection String

```
DATABASE_URL=postgresql://neondb_owner:npg_6Aerb1TskcCt@ep-floral-surf-ac2o21mi-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

DIRECT_URL=postgresql://neondb_owner:npg_6Aerb1TskcCt@ep-floral-surf-ac2o21mi-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Note**: Use the same string for both `DATABASE_URL` and `DIRECT_URL` for Neon.
