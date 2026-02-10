# Security: Credential Rotation Guide

**Date:** 2026-02-10
**Status:** 🔴 **URGENT** - Credentials exposed in git history
**Priority:** CRITICAL

---

## ⚠️ Issue: Exposed Credentials

The following file was committed to git with real production credentials:

- **File:** `apps/admin/.env`
- **Exposed:** Supabase anon key, Supabase URL, Turnstile site key
- **Risk:** Anyone with access to the git repository can see these credentials

---

## 🚨 Immediate Actions Required

### Step 1: Remove .env from Git History

```bash
# Navigate to project root
cd /path/to/ecommerce-platform

# Remove .env from git history (but keep local file)
git rm --cached apps/admin/.env

# Commit the removal
git add apps/admin/.gitignore
git commit -m "security: Remove .env file from git tracking"

# Push to remote
git push origin pre-production
```

**Note:** This only removes from future commits. The credentials are still in git history.

---

### Step 2: Rotate Exposed Credentials

#### 2.1 Rotate Supabase Anon Key (Publishable Key)

**Current exposed key:** `sb_publishable_sC8MYE4uSs5Ky02qKOZpYQ_qM90UmUZ`

**Steps to rotate:**

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/miqlyriefwqmutlsxytk

2. Navigate to: **Settings** → **API** → **Project API keys**

3. Click **Generate new anon key** (or create a new publishable key)

4. Copy the new key

5. Update `.env.local` (NOT `.env`):
   ```bash
   # apps/admin/.env.local
   VITE_SUPABASE_ANON_KEY=<new_key_here>
   ```

6. Verify `.env.local` is gitignored:
   ```bash
   git check-ignore apps/admin/.env.local
   # Should output: apps/admin/.gitignore:33:.env
   ```

7. Revoke the old key in Supabase Dashboard

**⚠️ Impact:** Low - Anon keys are meant to be public, but rotation is recommended

---

#### 2.2 Rotate Cloudflare Turnstile Site Key

**Current exposed key:** `0x4AAAAAACZBUnokgdxWZlvo`

**Steps to rotate:**

1. Go to Cloudflare Dashboard: https://dash.cloudflare.com

2. Navigate to: **Turnstile** → **Site Keys**

3. Create a new site key for your domain

4. Copy the new site key

5. Update `.env.local`:
   ```bash
   VITE_TURNSTILE_SITE_KEY=<new_site_key>
   ```

6. Delete the old site key in Cloudflare Dashboard

**⚠️ Impact:** Low - Site keys are public by design

---

### Step 3: Use .env.local for Development

**From now on, use `.env.local` for local development credentials:**

```bash
# DO NOT EDIT apps/admin/.env
# INSTEAD, create apps/admin/.env.local

cd apps/admin
cp .env.example .env.local

# Edit .env.local with your actual credentials
# This file is already gitignored and will NOT be committed
```

**Verify it's ignored:**
```bash
git check-ignore .env.local
# Should output: .gitignore:33:.env
```

---

## 📋 Best Practices Going Forward

### Development Environment

1. ✅ **Use `.env.local`** for local credentials (gitignored)
2. ✅ **Keep `.env.example`** as a template (committed to git)
3. ❌ **Never edit `.env`** directly
4. ❌ **Never commit real credentials**

### File Structure

```
apps/admin/
├── .env.example       ✅ Committed (template with dummy values)
├── .env.local         ✅ Gitignored (your real dev credentials)
├── .env.production    ✅ Template only (fill in production)
└── .env               ❌ DELETE or use for CI/CD only
```

### Credential Storage

**Development:**
- Store in `.env.local` (gitignored)

**Production:**
- Use hosting platform's environment variables:
  - Vercel: Project Settings → Environment Variables
  - Netlify: Site Settings → Build & Deploy → Environment
  - Cloudflare Pages: Workers & Pages → Settings → Environment Variables
  - AWS: Parameter Store / Secrets Manager
  - Docker: Docker secrets or environment files

**Never:**
- ❌ Commit credentials to git
- ❌ Share credentials in Slack/Email
- ❌ Store credentials in screenshots
- ❌ Hardcode credentials in source code

---

## 🔒 Credential Rotation Schedule

| Credential Type | Rotation Frequency | Last Rotated | Next Rotation |
|----------------|-------------------|--------------|---------------|
| Supabase Anon Key | After exposure | 2026-02-10 (PENDING) | Immediate |
| Turnstile Site Key | After exposure | 2026-02-10 (PENDING) | Immediate |
| Backend API Key | Every 90 days | Never | 2026-05-10 |
| Database Password | Every 90 days | Never | 2026-05-10 |

---

## 🚀 Post-Rotation Checklist

After rotating credentials:

- [ ] Remove `.env` from git tracking
- [ ] Rotate Supabase anon key
- [ ] Rotate Turnstile site key
- [ ] Update `.env.local` with new keys
- [ ] Test admin app login
- [ ] Test image upload
- [ ] Test CAPTCHA on login page
- [ ] Verify old keys no longer work
- [ ] Update production environment variables
- [ ] Document rotation in git commit message
- [ ] Notify team of credential rotation

---

## 📞 Support

If you encounter issues during rotation:

1. **Supabase Issues:** Check Supabase Dashboard → API Settings
2. **Turnstile Issues:** Verify domain whitelist in Cloudflare
3. **Build Issues:** Run `npm run build` to verify no errors
4. **Runtime Issues:** Check browser console for validation errors

---

## 🔗 Related Documentation

- [Supabase API Keys Documentation](https://supabase.com/docs/guides/api/api-keys)
- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

**Last Updated:** 2026-02-10
**Next Review:** After credential rotation complete
