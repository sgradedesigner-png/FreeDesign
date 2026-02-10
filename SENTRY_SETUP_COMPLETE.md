# ✅ Sentry Setup Complete!

**Date:** 2026-02-10
**Status:** ✅ **CONFIGURED & READY TO TEST**

---

## 🎉 Your Sentry DSN is Configured!

Your Sentry error tracking is now fully set up with your DSN:

```
https://698e3734afe9640749a140348d1e45a2@o4510859559305216.ingest.de.sentry.io/4510859561730128
```

**Region:** 🇩🇪 Germany (de.sentry.io)

---

## 📁 Files Updated

| File | Status | Purpose |
|------|--------|---------|
| `.env.local` | ✅ Created | Development testing (Sentry enabled) |
| `.env.production` | ✅ Updated | Production configuration |
| `.env.staging` | ✅ Updated | Staging configuration |

---

## 🧪 Quick Test (Option 1: Simple HTML Test)

Open the test page to verify Sentry is working:

### Windows:
```cmd
cd apps\admin
start test-sentry.html
```

### Mac/Linux:
```bash
cd apps/admin
open test-sentry.html    # Mac
xdg-open test-sentry.html  # Linux
```

**What to do:**
1. Click any test button (Simple Error, User Context, etc.)
2. Open Sentry dashboard: https://sentry.io/issues/
3. Verify error appears within 2-5 seconds

---

## 🚀 Full Test (Option 2: Admin App)

Test Sentry with your actual admin app:

### Step 1: Start Dev Server
```bash
cd apps/admin
npm run dev
```

**Note:** Sentry is now **automatically enabled** in development (via `.env.local`)

### Step 2: Open Browser Console

Navigate to: http://localhost:5175

Open DevTools Console (F12) and run:

```javascript
// Test 1: Simple error
throw new Error('Test error from admin app');

// Test 2: Verify Sentry is initialized
console.log('Sentry DSN configured:', import.meta.env.VITE_SENTRY_DSN ? '✅' : '❌');
```

### Step 3: Check Sentry Dashboard

1. Go to: https://sentry.io/issues/
2. Look for error: "Test error from admin app"
3. Verify details:
   - Environment: `development`
   - Release: `admin@0.0.1`
   - Browser info
   - Stack trace

---

## 🎯 Test User Context

### Step 4: Login and Test

1. Login to admin panel
2. Open console and run:
   ```javascript
   throw new Error('Test error with user context');
   ```
3. Check Sentry dashboard
4. Verify error shows your email and user ID

---

## ✅ What to Verify in Sentry

Your Sentry dashboard should show:

```
╔══════════════════════════════════════════════════╗
║  Error: Test error from admin app                ║
╠══════════════════════════════════════════════════╣
║  Environment:  development                       ║
║  Release:      admin@0.0.1                       ║
║  Browser:      Chrome 131 / Windows 11           ║
║  User:         admin@example.com (after login)   ║
║                                                  ║
║  Stack Trace:                                    ║
║    at <anonymous>:1:7                           ║
║                                                  ║
║  Breadcrumbs:                                    ║
║    [INFO] Page loaded                           ║
║    [INFO] Environment validation passed          ║
║    [ERROR] Test error thrown                    ║
╚══════════════════════════════════════════════════╝
```

---

## 🔧 Configuration Summary

### Development (.env.local)
```bash
VITE_SENTRY_DSN=https://698e...@o4510...ingest.de.sentry.io/4510...
VITE_SENTRY_ENABLED=true           # ✅ Enabled for testing
VITE_SENTRY_ENVIRONMENT=development
VITE_SENTRY_RELEASE=admin@0.0.1
```

### Staging (.env.staging)
```bash
VITE_SENTRY_DSN=https://698e...@o4510...ingest.de.sentry.io/4510...
# VITE_SENTRY_ENABLED=true         # ✅ Auto-enabled (staging environment)
VITE_SENTRY_ENVIRONMENT=staging
VITE_SENTRY_RELEASE=admin@0.1.0-staging
```

### Production (.env.production)
```bash
VITE_SENTRY_DSN=https://698e...@o4510...ingest.de.sentry.io/4510...
# VITE_SENTRY_ENABLED=true         # ✅ Auto-enabled (production environment)
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_RELEASE=admin@1.0.0
```

---

## 📊 Sentry Dashboard Access

**Your Sentry Project:**
- Organization ID: `o4510859559305216`
- Project ID: `4510859561730128`
- Region: Germany (de.sentry.io)

**Quick Links:**
- Issues: https://sentry.io/issues/
- Performance: https://sentry.io/performance/
- Releases: https://sentry.io/releases/
- Settings: https://sentry.io/settings/

---

## 🎨 What You'll See in Sentry

### Issue Details
```
Error: Cannot read property 'title' of undefined
Location: ProductFormPage.tsx:125:15
First Seen: 2 minutes ago
Last Seen: Just now
Events: 3 occurrences
Users: 1 (admin@example.com)

Environment: development
Release: admin@0.0.1
Browser: Chrome 131.0.0
OS: Windows 11

Stack Trace:
  at ProductFormPage.handleSubmit
    ProductFormPage.tsx:125:15
  at onClick
    Button.tsx:45:10
  at HTMLButtonElement.callCallback
    react-dom.development.js:3942:14

Breadcrumbs (5):
  10:30:15 [INFO] User navigated to /products/new
  10:30:20 [INFO] User filled product title field
  10:30:25 [INFO] User clicked "Save" button
  10:30:25 [DEBUG] Validating product data
  10:30:25 [ERROR] Product save failed

User Context:
  ID: abc-123-def-456
  Email: admin@example.com
  Username: admin@example.com
```

---

## 🔔 Recommended Sentry Settings

### 1. Set Up Alerts

Go to: https://sentry.io/alerts/rules/

**Recommended Alerts:**
- ✅ New Issue Created (notify on first occurrence)
- ✅ Issue Frequency (> 10 events in 1 hour)
- ✅ Regression (error reappears after being resolved)

**Notification Channels:**
- Email: Your email
- Slack (optional): Connect Slack workspace
- Discord (optional): Webhook integration

### 2. Configure Team Access

Go to: https://sentry.io/settings/teams/

**Add Team Members:**
1. Invite developers
2. Set appropriate permissions (Admin, Member, Viewer)
3. Configure notification preferences

### 3. Enable Source Maps (Optional - For Production)

**Requirements:**
1. Sentry auth token
2. Organization & project slugs

**Setup:**
```bash
# Generate auth token: https://sentry.io/settings/account/api/auth-tokens/
# Scopes needed: project:releases, org:read

# Add to .env.local:
VITE_SENTRY_ORG=your-org-slug
VITE_SENTRY_PROJECT=your-project-slug
VITE_SENTRY_AUTH_TOKEN=sntrys_your_token_here
```

**Then build:**
```bash
npm run build
# Source maps will be automatically uploaded
```

---

## 📋 Checklist

**Immediate Testing:**
- [ ] Open `test-sentry.html` in browser
- [ ] Click "Simple Error" button
- [ ] Verify error appears in Sentry dashboard
- [ ] Check error details (environment, release, stack trace)

**Admin App Testing:**
- [ ] Start admin dev server (`npm run dev`)
- [ ] Verify Sentry initialization in console
- [ ] Throw test error in browser console
- [ ] Verify error in Sentry dashboard
- [ ] Login to admin panel
- [ ] Throw error again
- [ ] Verify error shows your user email

**Production Preparation:**
- [ ] Verify `.env.production` has correct DSN
- [ ] Set production release version (e.g., `admin@1.0.0`)
- [ ] Generate Sentry auth token (for source maps)
- [ ] Add token to `.env.local` (don't commit!)
- [ ] Test production build locally (`npm run build && npm run preview`)
- [ ] Configure Sentry alerts (email/Slack)
- [ ] Add team members to Sentry project
- [ ] Deploy to production
- [ ] Monitor Sentry for real errors

---

## 🎓 Learning Resources

**Official Docs:**
- Quick Start: https://docs.sentry.io/platforms/javascript/guides/react/
- Error Handling: https://docs.sentry.io/platforms/javascript/guides/react/enriching-events/
- Performance: https://docs.sentry.io/product/performance/
- Source Maps: https://docs.sentry.io/platforms/javascript/sourcemaps/

**Best Practices:**
- Filter Noise: https://docs.sentry.io/platforms/javascript/configuration/filtering/
- User Context: https://docs.sentry.io/platforms/javascript/enriching-events/identify-user/
- Breadcrumbs: https://docs.sentry.io/platforms/javascript/enriching-events/breadcrumbs/

---

## 💡 Pro Tips

### 1. Filter Out Noise in Production

Edit `src/lib/sentry.ts` to ignore more errors:

```typescript
ignoreErrors: [
  // Add patterns that appear in your logs
  'NetworkError',
  'Failed to fetch',
  'ChunkLoadError', // Webpack/Vite chunk loading
]
```

### 2. Add Context to Errors

```typescript
import { captureException } from '@/lib/sentry';

try {
  await api.delete(`/products/${id}`);
} catch (error) {
  captureException(error, {
    context: {
      productId: id,
      action: 'delete',
      timestamp: new Date().toISOString()
    }
  });
}
```

### 3. Use Meaningful Release Names

Update on each deploy:

```bash
# .env.production
VITE_SENTRY_RELEASE=admin@1.2.3

# Or use git commit SHA
VITE_SENTRY_RELEASE=admin@${git rev-parse --short HEAD}
```

### 4. Monitor Performance

Sentry also tracks:
- Page load times
- API request latency
- Database query performance
- Component render times

Enable in dashboard: https://sentry.io/performance/

---

## 🆘 Troubleshooting

### "No errors appearing in Sentry"

**Checklist:**
1. ✅ Verify DSN is correct in `.env.local`
2. ✅ Verify `VITE_SENTRY_ENABLED=true`
3. ✅ Restart dev server after changing `.env`
4. ✅ Check browser console for Sentry errors
5. ✅ Check Sentry dashboard filters (environment, date range)
6. ✅ Try the HTML test page (`test-sentry.html`)

### "Sentry not initialized"

**Solution:** Check console for initialization message:
```javascript
console.log('Sentry DSN:', import.meta.env.VITE_SENTRY_DSN);
```

Should output your DSN. If empty, `.env.local` not loaded.

### "Source maps not working"

**Solution:** Source maps only work in production builds:
```bash
npm run build
# Check for: "✓ Source maps uploaded to Sentry"
```

---

## 🎉 You're All Set!

Sentry is now fully configured and ready to track errors.

**Next Steps:**
1. ✅ Test with HTML page or admin app
2. ✅ Verify errors appear in dashboard
3. ✅ Configure alerts and notifications
4. ✅ Add team members
5. ✅ Deploy to production with confidence!

**Need Help?**
- Full Guide: `SENTRY_INTEGRATION_GUIDE.md` (800+ lines)
- Sentry Docs: https://docs.sentry.io
- Sentry Support: https://sentry.io/support/

---

**Setup Date:** 2026-02-10
**DSN Region:** 🇩🇪 Germany
**Status:** ✅ Ready to Track Errors
**Your Dashboard:** https://sentry.io/issues/
