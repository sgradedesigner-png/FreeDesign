# Railway Deployment Guide

This guide covers deploying the backend API to Railway with proper environment configuration, monitoring, and logging.

---

## Why Railway (No Docker Needed)?

**Railway natively supports Node.js** and auto-detects the project:
- ✅ Automatically runs `npm install` and `npm run build`
- ✅ Uses `npm start` from package.json to launch the app
- ✅ Handles environment variables securely
- ✅ Provides free PostgreSQL (or connect to Supabase)
- ✅ Auto-generates HTTPS domains
- ✅ Built-in logging and metrics

**No Docker configuration required** - Railway's native Node.js deployment is simpler and sufficient for this project.

---

## Prerequisites

1. **Railway account**: [Sign up at railway.app](https://railway.app)
2. **GitHub repository**: Connected to Railway for auto-deployments
3. **Supabase project**: For PostgreSQL database (production)
4. **Sentry project**: For error tracking (production monitoring)

---

## Required Environment Variables

Set these in Railway's **Variables** tab for your service:

### 1. Node Environment

```bash
NODE_ENV=production
PORT=3000  # Railway auto-assigns, but good to set default
```

### 2. Database (Supabase PostgreSQL)

```bash
# Pooled connection (for app queries)
DATABASE_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true

# Direct connection (for Prisma migrations)
DIRECT_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Where to find these:**
- Supabase Dashboard → Project Settings → Database
- Copy "Connection pooling" string for `DATABASE_URL`
- Copy "Connection string" for `DIRECT_URL`

### 3. Supabase Auth

```bash
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase
```

**Where to find these:**
- Supabase Dashboard → Project Settings → API
- Copy "URL" and "JWT Secret"

### 4. Session & Cookies

```bash
# Generate with: openssl rand -base64 32
COOKIE_SECRET=your-strong-32-character-secret-here
```

**IMPORTANT:** Must be at least 32 characters. Generate a strong random value:

```bash
openssl rand -base64 32
```

### 5. QPay Payment Gateway (Production)

```bash
QPAY_BASE_URL=https://merchant.qpay.mn/v2
QPAY_USERNAME=your_production_qpay_username
QPAY_PASSWORD=your_production_qpay_password
QPAY_INVOICE_CODE=your_production_invoice_code
QPAY_CALLBACK_URL=https://your-railway-domain.railway.app/api/payment/callback
```

**IMPORTANT:** Use production credentials, NOT sandbox values.

### 6. Email (Resend)

```bash
RESEND_API_KEY=re_your_production_api_key
FROM_EMAIL=noreply@yourdomain.com
```

**Where to find:**
- [Resend Dashboard](https://resend.com/api-keys) → Create API Key
- Use verified domain for `FROM_EMAIL`

### 7. Cloudflare R2 Storage

```bash
R2_ACCOUNT_ID=your_production_account_id
R2_ACCESS_KEY_ID=your_production_access_key
R2_SECRET_ACCESS_KEY=your_production_secret_key
R2_BUCKET_NAME=your-production-bucket
R2_PUBLIC_BASE_URL=https://your-production-bucket.r2.dev
```

**Where to find:**
- Cloudflare Dashboard → R2 → Manage R2 API Tokens
- Create API token with read/write permissions

### 8. Sentry Error Tracking (Required for Production)

```bash
SENTRY_DSN=https://d459cc9dc45c15ec8154a3dcca8d4b17@o4510859559305216.ingest.de.sentry.io/4510859937972304
SENTRY_ENABLED=true  # Optional: auto-enabled when NODE_ENV=production
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=backend@1.0.0
```

**Your Sentry DSN (already configured):**
```
https://d459cc9dc45c15ec8154a3dcca8d4b17@o4510859559305216.ingest.de.sentry.io/4510859937972304
```

### 9. Rate Limiting (Optional)

```bash
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### 10. Cron Jobs (Optional)

```bash
CRON_RUN_ON_STARTUP=false  # Set to true only for testing
CRON_EXPIRATION_WARNING_ENABLED=true
CRON_EXPIRED_CHECK_ENABLED=true
```

### 11. Performance (Optional)

```bash
ENABLE_RESPONSE_CACHE=true
CACHE_TTL=60000  # 60 seconds
CACHE_MAX_ENTRIES=100
```

### 12. Logging (Optional)

```bash
LOG_LEVEL=info  # Options: debug, info, warn, error
```

### 13. CORS (Optional)

```bash
# Comma-separated list of allowed origins
CORS_ORIGIN=https://ecommerce-final-project.pages.dev,https://korean-goods.com,https://www.korean-goods.com,https://admin.korean-goods.com
```

---

## Deployment Steps

### Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will auto-detect Node.js

### Step 2: Configure Build Settings

Railway auto-detects from `package.json`, but verify:

- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Root Directory**: `backend` (if monorepo)

### Step 3: Add Environment Variables

1. Go to your service → **Variables** tab
2. Click **"New Variable"**
3. Add all required variables from the list above
4. Click **"Deploy"**

### Step 4: Run Database Migrations

After first deployment, open Railway's **Terminal** tab and run:

```bash
npx prisma migrate deploy
```

Or if using `db push`:

```bash
npx prisma db push
```

### Step 5: Verify Deployment

Check these endpoints:

```bash
# Health check
curl https://your-app.railway.app/health

# Should return:
# {
#   "status": "healthy",
#   "timestamp": "...",
#   "database": { "connected": true },
#   "uptime": 123.45,
#   "memory": { ... }
# }

# Readiness check
curl https://your-app.railway.app/ready

# Should return: { "ready": true }
```

---

## Production Logging Verification

Railway automatically captures logs. Here's what you'll see:

### 1. Startup Logs

```
✅ Environment validation passed
✅ Sentry initialized (production)
Server is running at http://localhost:3000
```

**What this means:**
- ✅ All required environment variables are valid
- ✅ Sentry error tracking is active
- ✅ Server started successfully

### 2. JSON Structured Logs (Production)

In production (`NODE_ENV=production`), logs are in JSON format:

```json
{
  "level": "info",
  "timestamp": "2026-02-10T12:34:56.789Z",
  "method": "POST",
  "url": "/api/orders",
  "statusCode": 201,
  "responseTime": "45ms",
  "requestId": "req-1234567890-abc123",
  "msg": "Request completed"
}
```

**Benefits:**
- ✅ Easy to search/filter in Railway logs
- ✅ Structured data for log aggregation
- ✅ No emoji/colors (clean for log systems)

### 3. Pretty Logs (Development Only)

In development (`NODE_ENV=development`), logs are colorized:

```
[12:34:56.789] INFO (12345): Request completed
    method: "POST"
    url: "/api/orders"
    statusCode: 201
    responseTime: "45ms"
```

**Railway logs use JSON in production** - pretty printing is disabled automatically.

---

## Sentry Error Tracking Verification

### 1. Test Error Endpoint (Development Only)

If you have a test endpoint, trigger an error:

```bash
curl https://your-app.railway.app/test-error
```

### 2. Check Sentry Dashboard

1. Go to [Sentry Dashboard](https://sentry.io)
2. Select your project: **backend** (o4510859559305216)
3. Navigate to **Issues** tab
4. You should see the error captured with:
   - Stack trace
   - Request URL
   - User ID (if authenticated)
   - Environment: `production`
   - Release: `backend@1.0.0`

### 3. Automatic Error Capture

Sentry automatically captures:
- ✅ Unhandled exceptions
- ✅ Route handler errors
- ✅ Database errors
- ✅ Payment processing failures
- ✅ QPay API errors

**Example captured error:**

```
Error: Order creation failed
  at createOrder (routes/orders.ts:123)
  at async handler (routes/orders.ts:95)

Extra Context:
  - url: /api/orders
  - method: POST
  - userId: 123e4567-e89b-12d3-a456-426614174000
  - requestId: req-1234567890-abc123
```

### 4. Sentry Guards

Sentry is **automatically enabled** when:
- `NODE_ENV=production` (Railway auto-sets this)
- `SENTRY_DSN` is configured

You can manually disable with:
```bash
SENTRY_ENABLED=false
```

---

## Monitoring & Observability

### Railway Built-in Monitoring

Railway provides:
1. **Logs**: Real-time structured logs (JSON in production)
2. **Metrics**: CPU, Memory, Network usage
3. **Deployments**: Git commit history, rollback support

### Health Check Endpoints

Monitor these endpoints with external services (UptimeRobot, Better Uptime, etc.):

```bash
# Basic health (always 200 if app is running)
GET /health

# Readiness (503 if database is down)
GET /ready

# Detailed metrics
GET /metrics

# Circuit breaker status
GET /circuit-breakers
```

### Sentry Alerts

Configure alerts in Sentry Dashboard:
1. **Issues** → **Alert Rules**
2. Create rule: "When error count > 10 in 5 minutes"
3. Send notification to: Email, Slack, PagerDuty

---

## Troubleshooting

### Issue: "Environment validation failed"

**Symptom:** App crashes on startup with error list

**Solution:** Check Railway logs for missing variables:
```
❌ Environment validation failed:
  • DATABASE_URL: Required
  • COOKIE_SECRET: Must be at least 32 characters
```

Fix: Add missing variables in Railway **Variables** tab

---

### Issue: "Sentry DSN not configured"

**Symptom:** Logs show "Sentry DSN not configured, error tracking disabled"

**Solution:** Add `SENTRY_DSN` environment variable in Railway

---

### Issue: Database connection failed

**Symptom:** `/health` returns 503 with "database_disconnected"

**Solution:**
1. Verify `DATABASE_URL` is correct (use pooled connection)
2. Check Supabase project is not paused
3. Verify IP whitelist in Supabase (Railway IPs may change)

---

### Issue: Logs are not structured (still pretty)

**Symptom:** Railway logs show colorized output instead of JSON

**Solution:** Verify `NODE_ENV=production` is set in Railway variables

---

### Issue: QPay webhook not working

**Symptom:** Payments not being marked as paid

**Solution:**
1. Verify `QPAY_CALLBACK_URL` matches Railway domain
2. Check Railway logs for webhook errors
3. Verify QPay production credentials (not sandbox)

---

## Security Checklist

Before deploying to production:

- [ ] `COOKIE_SECRET` is at least 32 characters (generate with `openssl rand -base64 32`)
- [ ] `NODE_ENV=production` is set
- [ ] `SENTRY_DSN` is configured for error tracking
- [ ] `DATABASE_URL` uses pooled connection (PgBouncer)
- [ ] QPay credentials are production values (not sandbox)
- [ ] `QPAY_CALLBACK_URL` uses HTTPS Railway domain
- [ ] Resend API key is production key
- [ ] R2 credentials are for production bucket
- [ ] CORS origins include Cloudflare Pages domains
- [ ] All environment variables are set in Railway (not hardcoded)

---

## Rollback

If deployment fails, Railway provides one-click rollback:

1. Go to **Deployments** tab
2. Find last successful deployment
3. Click **"Rollback to this deploy"**

---

## Support

- **Railway Docs**: https://docs.railway.app
- **Sentry Docs**: https://docs.sentry.io/platforms/node/
- **Supabase Docs**: https://supabase.com/docs

---

## Quick Reference

```bash
# Required Environment Variables (Production)
NODE_ENV=production
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_JWT_SECRET=...
COOKIE_SECRET=...  # Generate with: openssl rand -base64 32
QPAY_USERNAME=...
QPAY_PASSWORD=...
QPAY_INVOICE_CODE=...
QPAY_CALLBACK_URL=https://your-app.railway.app/api/payment/callback
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_BASE_URL=https://...
SENTRY_DSN=https://d459cc9dc45c15ec8154a3dcca8d4b17@o4510859559305216.ingest.de.sentry.io/4510859937972304

# Health Check URLs
https://your-app.railway.app/health
https://your-app.railway.app/ready
https://your-app.railway.app/metrics

# Sentry Dashboard
https://sentry.io/organizations/your-org/projects/backend/
```

---

**Questions?** Check Railway logs first, then review the troubleshooting section above.
