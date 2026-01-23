# Railway Production Update Checklist

## Quick Checklist for Updating Production to Neon

### Pre-Update (Do First)

- [ ] Verify development environment is working: `npm run dev`
- [ ] Test local health endpoint: `curl http://localhost:3001/health`
- [ ] Copy Neon connection string (see below)
- [ ] Login to Railway: https://railway.app/

### Update Steps (5 minutes)

- [ ] Go to Railway → Select `lia360api-production` project
- [ ] Click on API service
- [ ] Go to **Variables** tab
- [ ] Update `DATABASE_URL`:
  ```
  postgresql://neondb_owner:npg_6Aerb1TskcCt@ep-floral-surf-ac2o21mi-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
  ```
- [ ] Update `DIRECT_URL`:
  ```
  postgresql://neondb_owner:npg_6Aerb1TskcCt@ep-floral-surf-ac2o21mi-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
  ```
- [ ] Remove these variables (if present):
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_KEY`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_DB_URL`
- [ ] Click **Save Changes** (Railway will auto-redeploy)

### Verify (5 minutes)

- [ ] Go to **Deployments** tab
- [ ] Wait for new deployment to complete (green checkmark)
- [ ] Click on latest deployment to view logs
- [ ] Verify logs show:
  ```
  [Database] ✓ Database connected successfully
  [Database] Hostname: ep-floral-surf-ac2o21mi-pooler.sa-east-1.aws.neon.tech
  Server is ready to accept connections
  ```
- [ ] Test health endpoint:
  ```bash
  curl https://lia360api-production.up.railway.app/health
  ```
  Expected: `{"status":"ok","timestamp":"..."}`
- [ ] Test authentication (use real credentials):
  ```bash
  curl -X POST https://lia360api-production.up.railway.app/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"your-email@example.com","password":"your-password"}'
  ```

### Post-Update (Monitor)

- [ ] Check Neon dashboard: https://console.neon.tech/
- [ ] Verify active connections in Neon metrics
- [ ] Monitor Railway logs for 1 hour
- [ ] Test key API endpoints:
  - [ ] Health: `/health`
  - [ ] Login: `/api/v1/auth/login`
  - [ ] Pipelines: `/api/v1/pipelines`
  - [ ] Leads: `/api/v1/leads`

### If Something Goes Wrong

**Rollback** (5 minutes):
- [ ] Go to Railway → Variables tab
- [ ] Restore Supabase `DATABASE_URL` from: `scripts/backup/.env.temp.supabase-backup`
- [ ] Click **Save Changes**
- [ ] Verify deployment recovers

**Get Help**:
- [ ] Read: `docs/PRODUCTION_DEPLOYMENT_NEON.md`
- [ ] Check: Railway deployment logs
- [ ] Check: Neon dashboard metrics
- [ ] Verify: Connection string has no typos

---

## Neon Connection String (Copy This)

```
DATABASE_URL=postgresql://neondb_owner:npg_6Aerb1TskcCt@ep-floral-surf-ac2o21mi-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

DIRECT_URL=postgresql://neondb_owner:npg_6Aerb1TskcCt@ep-floral-surf-ac2o21mi-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Note**: Both variables use the same connection string for Neon.

---

## Expected Timeline

- Pre-update verification: 2 minutes
- Update Railway variables: 3 minutes
- Wait for deployment: 2-3 minutes
- Verification tests: 5 minutes
- **Total**: ~15 minutes

---

## Current Production Status

**URL**: https://lia360api-production.up.railway.app
**Current Status**: ❌ 502 Bad Gateway (database connection failed)
**After Update**: ✅ Should return `{"status":"ok"}`
