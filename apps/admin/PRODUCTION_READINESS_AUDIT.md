# Admin App - Production Readiness Audit Report
**Generated:** 2026-02-10
**Application:** E-commerce Admin Panel (`apps/admin`)
**Auditor:** Claude Code

---

## Executive Summary

**Overall Status:** ⚠️ **Not Production Ready** - Critical security issues must be addressed

**Priority Issues:**
1. 🔴 **CRITICAL:** Missing security headers (CSP, HSTS, X-Frame-Options)
2. 🔴 **CRITICAL:** No CSRF protection
3. 🔴 **CRITICAL:** No global error boundary
4. 🔴 **HIGH:** Axios security vulnerability (CVE)
5. 🔴 **HIGH:** Console.log statements in production code
6. 🟡 **MEDIUM:** Large bundle size (1.2MB) - needs code splitting
7. 🟡 **MEDIUM:** Real credentials in committed .env file

---

## 1. Security Audit

### ✅ PASSING (9/15)

| Item | Status | Location |
|------|--------|----------|
| Authentication & Authorization | ✅ Ready | `src/auth/AuthContext.tsx`, `backend/src/supabaseauth.ts` |
| Role-based Access Control | ✅ Ready | `src/components/ProtectedRoute.tsx` - Admin role verification |
| API Key Management | ✅ Ready | No hardcoded secrets found |
| Input Validation | ✅ Ready | Zod schemas in `ProductFormPage.tsx`, `backend/src/schemas/` |
| SQL Injection Prevention | ✅ Ready | Prisma ORM with parameterized queries |
| Rate Limiting | ✅ Ready | Global (100 req/min) + route-specific limits |
| Password Security | ✅ Ready | Supabase handles hashing (bcrypt) |
| File Upload Validation | ✅ Ready | `ImageUpload.tsx:122-133` - Type & size checks (5MB limit) |
| CAPTCHA Protection | ✅ Ready | Cloudflare Turnstile on login |

### ❌ FAILING (6/15)

#### 🔴 CRITICAL: Missing Security Headers
**Priority:** CRITICAL
**Impact:** Vulnerable to clickjacking, XSS, MIME sniffing

**Issue:** No security headers configured in backend or frontend

**Required Headers:**
```typescript
// backend/src/app.ts - ADD THIS HOOK
app.addHook('onSend', async (request, reply) => {
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // HSTS (HTTPS only - enable after SSL setup)
  if (process.env.NODE_ENV === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // CSP - Adjust based on your needs
  reply.header('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com;"
  );
});
```

**Files to modify:**
- `backend/src/app.ts` (after line 128, before routes)

---

#### 🔴 CRITICAL: No CSRF Protection
**Priority:** CRITICAL
**Impact:** Vulnerable to cross-site request forgery attacks

**Issue:** Admin panel uses cookies/localStorage for auth but has no CSRF tokens

**Recommendation:**
```bash
npm install @fastify/csrf-protection --workspace=backend
```

```typescript
// backend/src/app.ts
import csrf from '@fastify/csrf-protection';

app.register(csrf, {
  cookieOpts: {
    signed: true,
    sameSite: 'strict',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
});
```

**Alternative (simpler):** Use `SameSite=Strict` cookie attribute + verify `Origin` header

---

#### 🔴 CRITICAL: No Global Error Boundary
**Priority:** CRITICAL
**Impact:** Crashes expose stack traces to users

**Issue:** No error boundary in React app - any component crash will show dev errors

**Fix:**
```typescript
// apps/admin/src/components/ErrorBoundary.tsx - CREATE THIS
import { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log to error tracking service (Sentry, etc.)
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold">Something went wrong</p>
              <p className="text-sm mt-2">Please refresh the page or contact support.</p>
              {process.env.NODE_ENV === 'development' && (
                <pre className="text-xs mt-2 overflow-auto">
                  {this.state.error?.message}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
```

```typescript
// apps/admin/src/main.tsx - WRAP APP
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* ... rest of app */}
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
```

---

#### 🔴 HIGH: Axios Security Vulnerability
**Priority:** HIGH
**Impact:** Denial of Service via __proto__ key

**Issue:**
```
axios  <=1.13.4
Severity: high
Axios is Vulnerable to Denial of Service via __proto__ Key in mergeConfig
CVE: GHSA-43fc-jf86-j433
```

**Fix:**
```bash
cd apps/admin
npm audit fix
```

**Verify:** Axios should upgrade to 1.13.5 or higher

---

#### 🔴 HIGH: Console.log in Production Code
**Priority:** HIGH
**Impact:** Leaks debugging info, slows performance

**Files with console.log:**
- `apps/admin/src/components/ImageUpload.tsx` (24 occurrences)
- `apps/admin/src/pages/ProductFormPage.tsx`
- `apps/admin/src/pages/ProductsPage.tsx`
- `apps/admin/src/pages/CategoriesPage.tsx`
- `apps/admin/src/components/ProtectedRoute.tsx` (line 26)

**Fix:** Remove or wrap in environment check:
```typescript
// Replace all console.log with:
if (import.meta.env.DEV) {
  console.log('[Component]', data);
}

// Or use a logger utility:
// apps/admin/src/lib/logger.ts
export const logger = {
  log: (...args: any[]) => {
    if (import.meta.env.DEV) console.log(...args);
  },
  error: (...args: any[]) => {
    // Always log errors (send to monitoring service)
    console.error(...args);
  }
};
```

**Automated removal:**
```bash
cd apps/admin
# Remove all console.log (manual verification recommended)
grep -rl "console\.log" src/ | xargs sed -i '/console\.log/d'
```

---

#### 🟡 MEDIUM: Token Storage in localStorage
**Priority:** MEDIUM
**Impact:** XSS can steal tokens (though Supabase mitigates with short TTL)

**Issue:** Access tokens stored in localStorage are vulnerable to XSS

**Current:** `src/auth/AuthContext.tsx:45, 68, 90`
```typescript
localStorage.setItem('sb-access-token', session.access_token);
```

**Recommendation:**
- ✅ **Accept Risk:** Supabase tokens auto-expire (1 hour), reasonable tradeoff
- OR **Upgrade:** Use httpOnly cookies (requires backend proxy for Supabase)

**If upgrading:**
```typescript
// backend - Create /auth/session endpoint that sets httpOnly cookie
// frontend - Remove localStorage, use credentials: 'include'
```

---

## 2. Environment Configuration

### ✅ PASSING (3/5)

| Item | Status | Details |
|------|--------|---------|
| .env.example | ✅ Ready | Comprehensive template provided |
| Environment separation | ✅ Ready | `.env`, `.env.production`, `.env.staging` |
| VITE_ prefix | ✅ Ready | All env vars properly namespaced |

### ❌ FAILING (2/5)

#### 🔴 HIGH: Real Credentials in Committed .env
**Priority:** HIGH
**Impact:** Production credentials exposed in git history

**Issue:** `apps/admin/.env` contains real Supabase credentials
```
VITE_SUPABASE_ANON_KEY=sb_publishable_sC8MYE4uSs5Ky02qKOZpYQ_qM90UmUZ
VITE_SUPABASE_URL=https://miqlyriefwqmutlsxytk.supabase.co
```

**Fix:**
```bash
cd apps/admin

# 1. Remove from git history
git rm --cached .env
git commit -m "chore: Remove .env from git history"

# 2. Add to .gitignore (already done ✅)

# 3. Rotate credentials
# - Generate new Supabase anon key
# - Update .env.local (not tracked)

# 4. Use .env.local for dev
cp .env .env.local
git check-ignore .env.local  # Verify ignored
```

**Future:** Only commit `.env.example`, use `.env.local` for dev credentials

---

#### 🟡 MEDIUM: No Runtime Environment Validation
**Priority:** MEDIUM
**Impact:** App may fail silently if env vars missing

**Fix:**
```typescript
// apps/admin/src/lib/env.ts - CREATE THIS
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_URL',
  'VITE_TURNSTILE_SITE_KEY'
] as const;

export function validateEnv() {
  const missing = requiredEnvVars.filter(
    key => !import.meta.env[key]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.join('\n')}\n\n` +
      `Copy .env.example to .env and fill in values.`
    );
  }
}

// Call in main.tsx
validateEnv();
```

---

## 3. E-commerce Specific Standards

### ✅ PASSING (6/11)

| Item | Status | Details |
|------|--------|---------|
| Payment Integration | ✅ Ready | QPay with circuit breaker |
| Order Expiration | ✅ Ready | Cron job for 24-hour timeout |
| Transaction Logging | ✅ Ready | `PaymentWebhookLog` table |
| GDPR Email Masking | ✅ Ready | `backend/src/routes/orders.ts:16-30` |
| Input Validation | ✅ Ready | Zod schemas for orders/payments |
| User Data Protection | ✅ Ready | Role-based access control |

### ❌ FAILING (5/11)

#### 🟡 MEDIUM: No PCI Compliance Documentation
**Priority:** MEDIUM
**Impact:** May fail audit if processing credit cards

**Issue:** No PCI DSS compliance documentation

**Recommendation:**
- ✅ **You're SAQ-A compliant** (using QPay, no card data on server)
- **Action:** Document this in `SECURITY.md`:

```markdown
# PCI DSS Compliance

## Scope: SAQ-A (Merchant Level 4)
- Payment processing outsourced to QPay (PCI DSS Level 1 certified)
- No cardholder data stored on our servers
- No card data in logs or database

## Compliance Checklist:
- [x] Use PCI-compliant payment processor (QPay)
- [x] HTTPS enforced (production only)
- [x] No card data in database
- [x] No card data in logs
- [ ] Annual PCI SAQ-A questionnaire
- [ ] Quarterly network scans
```

---

#### 🟡 MEDIUM: No Price Manipulation Prevention
**Priority:** MEDIUM
**Impact:** Admin could manipulate prices without audit trail

**Issue:** Product price changes not logged

**Fix:**
```typescript
// backend/src/routes/admin/products.ts - ADD AUDIT LOG
import { prisma } from '../../lib/prisma';

// Before updating product
const oldProduct = await prisma.product.findUnique({
  where: { id },
  select: { basePrice: true }
});

// After update
if (oldProduct.basePrice !== data.basePrice) {
  await prisma.auditLog.create({
    data: {
      userId: (request as any).user.id,
      action: 'PRICE_CHANGE',
      entityType: 'PRODUCT',
      entityId: id,
      oldValue: oldProduct.basePrice.toString(),
      newValue: data.basePrice.toString(),
      timestamp: new Date()
    }
  });
}
```

**Schema:**
```prisma
// backend/prisma/schema.prisma - ADD THIS
model AuditLog {
  id         String   @id @default(uuid())
  userId     String
  action     String   // PRICE_CHANGE, ORDER_CANCEL, etc.
  entityType String   // PRODUCT, ORDER, etc.
  entityId   String
  oldValue   String?
  newValue   String?
  timestamp  DateTime @default(now())

  user       Profile  @relation(fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
}
```

---

#### 🟡 MEDIUM: No Order Modification Audit Trail
**Priority:** MEDIUM
**Impact:** No visibility into who changed order status

**Fix:** Use same `AuditLog` model above for order status changes

---

#### 🟡 LOW: No Inventory Accuracy Checks
**Priority:** LOW
**Impact:** Stock could become negative

**Fix:**
```typescript
// backend/src/routes/orders.ts - ADD STOCK CHECK
const variant = await prisma.productVariant.findUnique({
  where: { id: item.variantId },
  select: { stock: true }
});

if (variant.stock < item.quantity) {
  throw new BadRequestError(
    `Insufficient stock for variant ${item.variantId}`
  );
}

// Decrement stock atomically
await prisma.productVariant.update({
  where: { id: item.variantId },
  data: { stock: { decrement: item.quantity } }
});
```

---

#### ⚠️ INFO: Cart Security
**Status:** ✅ Server-side validation present

**Current:** Backend validates cart items on order creation (✅ Good!)

---

## 4. Performance & Scalability

### ✅ PASSING (4/6)

| Item | Status | Details |
|------|--------|---------|
| Database Optimization | ✅ Ready | N+1 queries fixed, response caching (99.4% faster) |
| Caching Strategy | ✅ Ready | LRU cache (60s TTL), React Query |
| Compression | ✅ Ready | gzip/deflate enabled |
| Image Optimization | ✅ Ready | 5MB limit, type validation |

### ❌ FAILING (2/6)

#### 🟡 MEDIUM: Large Bundle Size (Code Splitting Needed)
**Priority:** MEDIUM
**Impact:** Slow initial page load (1.2MB JS)

**Issue:**
```
dist/assets/index-CJInr4GT.js   1,232.78 kB │ gzip: 370.10 kB
⚠️ Chunk larger than 500 kB after minification
```

**Fix:** Implement route-based code splitting
```typescript
// apps/admin/src/App.tsx - REPLACE IMPORTS
import { lazy, Suspense } from 'react';

// Replace static imports with lazy
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductFormPage = lazy(() => import('./pages/ProductFormPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Wrap routes in Suspense
<Suspense fallback={<div>Loading...</div>}>
  <Routes>
    {/* routes */}
  </Routes>
</Suspense>
```

**Expected result:** Main bundle < 500KB, per-route chunks ~100-200KB

---

#### ❌ MISSING: CDN Configuration
**Priority:** LOW (for now)
**Impact:** Slower asset delivery

**Recommendation:**
```typescript
// vite.config.js - ADD FOR PRODUCTION
export default defineConfig({
  base: process.env.NODE_ENV === 'production'
    ? 'https://cdn.yourdomain.com/admin/'
    : '/',

  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Stable chunk names for CDN caching
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
});
```

---

## 5. Error Handling & Monitoring

### ✅ PASSING (3/5)

| Item | Status | Details |
|------|--------|---------|
| Custom Error Classes | ✅ Ready | `backend/src/utils/errors.ts` |
| Error Handler Middleware | ✅ Ready | `backend/src/middleware/errorHandler.ts` |
| Toast Notifications | ✅ Ready | Sonner for user feedback |

### ❌ FAILING (2/5)

#### 🔴 CRITICAL: No Global Error Boundary
**Already covered in Security section**

---

#### 🟡 MEDIUM: No Error Tracking Service
**Priority:** MEDIUM
**Impact:** Production errors go unnoticed

**Recommendation:** Integrate Sentry
```bash
npm install @sentry/react --workspace=admin
```

```typescript
// apps/admin/src/main.tsx
import * as Sentry from '@sentry/react';

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENV || 'production',
    tracesSampleRate: 0.1, // 10% performance monitoring
    beforeSend(event) {
      // Don't send events in dev
      if (import.meta.env.DEV) return null;
      return event;
    }
  });
}
```

---

## 6. Build & Deployment

### ✅ PASSING (3/6)

| Item | Status | Details |
|------|--------|---------|
| TypeScript Strict Mode | ✅ Ready | `tsconfig.json:8` |
| Build Process | ✅ Ready | `npm run build` successful |
| Source Maps Disabled | ✅ Ready | No .map files in production build |

### ❌ FAILING (3/6)

#### 🟡 MEDIUM: No CI/CD Pipeline
**Priority:** MEDIUM
**Impact:** Manual deployments error-prone

**Recommendation:** GitHub Actions workflow
```yaml
# .github/workflows/deploy-admin.yml - CREATE THIS
name: Deploy Admin

on:
  push:
    branches: [main, production]
    paths:
      - 'apps/admin/**'
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Lint
        run: npm run lint --workspace=admin

      - name: Build
        run: npm run build --workspace=admin
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy apps/admin/dist --project-name=ecommerce-admin
```

---

#### ❌ MISSING: Rollback Strategy
**Priority:** LOW
**Impact:** No quick recovery from bad deploys

**Recommendation:**
- Use Cloudflare Pages (built-in rollback to previous deployments)
- OR tag releases in git: `git tag v1.0.0 && git push --tags`

---

#### ❌ MISSING: Database Migration Safety
**Priority:** MEDIUM (when applicable)
**Impact:** Schema changes could break app

**Current:** Using `prisma db push` (⚠️ not safe for production)

**Fix:**
```bash
# backend/package.json - UPDATE SCRIPTS
{
  "scripts": {
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",  # Use this in production
    "migrate:status": "prisma migrate status"
  }
}

# Production deployment
npm run migrate:deploy --workspace=backend
```

---

## 7. Code Quality

### ✅ PASSING (3/4)

| Item | Status | Details |
|------|--------|---------|
| TypeScript Strict Mode | ✅ Ready | `tsconfig.json` - strict: true |
| Dead Code Removal | ✅ Ready | Vite tree-shaking enabled |
| No Hardcoded Secrets | ✅ Ready | All secrets in .env |

### ❌ FAILING (1/4)

#### 🔴 HIGH: Console.log in Production
**Already covered in Security section**

**Audit:**
```bash
npm audit --production
# 1 high severity vulnerability (axios)
```

**Fix:** `npm audit fix`

---

## Priority Action Plan

### 🔴 CRITICAL - Fix Before Production (7 items)

1. **Add Security Headers** (1-2 hours)
   - File: `backend/src/app.ts`
   - Add `onSend` hook with CSP, HSTS, X-Frame-Options, etc.

2. **Implement CSRF Protection** (2-3 hours)
   - Install `@fastify/csrf-protection`
   - Configure in `backend/src/app.ts`

3. **Add Global Error Boundary** (30 minutes)
   - Create `apps/admin/src/components/ErrorBoundary.tsx`
   - Wrap app in `main.tsx`

4. **Fix Axios Vulnerability** (5 minutes)
   - Run `npm audit fix` in `apps/admin`

5. **Remove Console.log Statements** (30 minutes)
   - Replace with logger utility or remove

6. **Rotate Exposed Credentials** (15 minutes)
   - Generate new Supabase keys
   - Remove `.env` from git history

7. **Add Environment Validation** (20 minutes)
   - Create `apps/admin/src/lib/env.ts`
   - Validate on app start

### 🟡 HIGH - Fix Within 1 Week (4 items)

8. **Implement Code Splitting** (2-3 hours)
   - Use React.lazy() for routes
   - Reduce bundle from 1.2MB to <500KB

9. **Add Audit Logging** (3-4 hours)
   - Create `AuditLog` model
   - Log price changes, order modifications

10. **Setup Error Tracking** (1 hour)
    - Integrate Sentry
    - Test error reporting

11. **Create CI/CD Pipeline** (2-3 hours)
    - GitHub Actions workflow
    - Automated builds + tests

### 🟢 MEDIUM - Fix Within 1 Month (3 items)

12. **PCI Compliance Documentation** (1 hour)
13. **Inventory Validation** (2 hours)
14. **Migration Strategy** (1 hour)

---

## Production Deployment Checklist

Before deploying to production, ensure:

### Environment
- [ ] `.env.production` configured with real production credentials
- [ ] All secrets stored in secure vault (not committed)
- [ ] CORS_ORIGIN includes production domain
- [ ] `VITE_ENV=production` set

### Security
- [ ] Security headers implemented (CSP, HSTS, etc.)
- [ ] CSRF protection enabled
- [ ] Error boundary implemented
- [ ] Axios vulnerability fixed
- [ ] All console.log removed
- [ ] HTTPS enforced (redirect HTTP → HTTPS)

### Performance
- [ ] Bundle size < 500KB (code splitting)
- [ ] Response caching enabled
- [ ] Compression enabled
- [ ] Images optimized

### Monitoring
- [ ] Error tracking setup (Sentry)
- [ ] Logging configured (Pino)
- [ ] Health check endpoint tested
- [ ] Rate limiting verified

### Database
- [ ] Migration strategy implemented
- [ ] Backup strategy configured
- [ ] Connection pooling configured

### Testing
- [ ] All unit tests passing
- [ ] Manual QA completed
- [ ] Load testing performed
- [ ] Security scan completed

### Deployment
- [ ] CI/CD pipeline tested
- [ ] Rollback strategy documented
- [ ] Deployment runbook created
- [ ] On-call rotation setup

---

## Estimated Time to Production Ready

**Total effort:** 18-24 hours
**Timeline:** 1-2 weeks (with 1 developer)

**Week 1 (Critical):**
- Days 1-2: Security fixes (headers, CSRF, error boundary)
- Days 3-4: Code splitting, audit logging
- Day 5: Testing + validation

**Week 2 (High/Medium):**
- Days 1-2: CI/CD pipeline
- Days 3-4: Error tracking, monitoring
- Day 5: Final QA + documentation

---

## Contacts & Resources

**Security References:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Fastify Security Best Practices](https://fastify.dev/docs/latest/Guides/Security/)
- [React Security Checklist](https://react.dev/learn/security)

**PCI Compliance:**
- [PCI DSS SAQ-A](https://www.pcisecuritystandards.org/document_library/)

**Performance:**
- [Web.dev Performance](https://web.dev/performance/)
- [Vite Build Optimization](https://vitejs.dev/guide/build.html)

---

## Appendix: File Locations

### Critical Files
- Authentication: `apps/admin/src/auth/AuthContext.tsx`
- API Client: `apps/admin/src/lib/api.ts`
- Backend Auth: `backend/src/supabaseauth.ts`
- Backend Config: `backend/src/app.ts`
- Rate Limiting: `backend/src/app.ts:94-128`

### Configuration Files
- TypeScript: `apps/admin/tsconfig.json`
- Vite: `apps/admin/vite.config.js`
- Environment: `apps/admin/.env.example`
- Git Ignore: `apps/admin/.gitignore`, `backend/.gitignore`

### Security-Sensitive
- Image Upload: `apps/admin/src/components/ImageUpload.tsx`
- Product Form: `apps/admin/src/pages/ProductFormPage.tsx`
- Order Routes: `backend/src/routes/orders.ts`
- Payment Routes: `backend/src/routes/payment.ts`

---

**END OF AUDIT REPORT**
