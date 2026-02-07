# Deployment Guide: ECommerce Platform

## 🌐 Таны Domain: korean-goods.com

**Configured URLs:**
- 🛍️ **Store (Main Site):** https://korean-goods.com
- 👨‍💼 **Admin Panel:** https://admin.korean-goods.com
- 🔌 **Backend API:** https://api.korean-goods.com

---

## Тойм

Энэхүү гарын авлага нь eCommerce Platform-ийн 3 app-ийг **korean-goods.com** домайн ашиглан интернет рүү гаргах бүрэн заавар юм:

1. **Admin App** - React + Vite (Static SPA) → `admin.korean-goods.com`
2. **Store App** - React + Vite (Static SPA) → `korean-goods.com`
3. **Backend API** - Fastify + Node.js (Server) → `api.korean-goods.com`

---

## Архитектур & Платформ сонголт

### Санал болгож буй deployment платформууд:

| App | Platform | Үнэ | Шалтгаан |
|-----|----------|-----|----------|
| **Admin App** | Cloudflare Pages | Үнэгүй | Хурдан CDN, автомат deploy, тэр тэгш домайн |
| **Store App** | Cloudflare Pages | Үнэгүй | Хурдан CDN, автомат deploy, тэр тэгш домайн |
| **Backend API** | Railway | $5/сар | Хялбар setup, auto-deploy, database холболт |

### Бусад сонголтууд:

**Frontend (Admin & Store):**
- ✅ **Cloudflare Pages** (Recommended) - Үнэгүй, хурдан, GitHub интеграци
- ✅ **Vercel** - Үнэгүй, маш хялбар
- ✅ **Netlify** - Үнэгүй, олон features

**Backend:**
- ✅ **Railway** (Recommended) - $5/сар, хялбар, GitHub auto-deploy
- ✅ **Render** - Үнэгүй tier байдаг (холдох хэрэгтэй)
- ✅ **Fly.io** - Үнэгүй tier (256MB RAM)

---

## ⚡ Domain Setup: korean-goods.com

### Эхлээд: Domain-оо Cloudflare руу шилжүүлэх

**Анхаарах:** Энэ нь эхний алхам! Бусад deployment хийхийн өмнө domain Cloudflare-д байх ёстой.

#### Алхам 0.1: Cloudflare дээр domain нэмэх

1. **Cloudflare Dashboard руу очих:**
   ```
   https://dash.cloudflare.com/
   ```

2. **"Add a Site" дарах**

3. **Domain оруулах:**
   ```
   korean-goods.com
   ```

4. **Free plan сонгох**

5. **Cloudflare nameservers харуулна:**
   ```
   Example:
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```

6. **Domain registrar дээр nameservers солих:**
   - Таны domain худалдаж авсан газар (GoDaddy, Namecheap, etc.)
   - DNS/Nameservers settings руу очих
   - Cloudflare-ийн nameservers оруулах
   - Хадгалах

7. **Cloudflare дээр баталгаажуулалт хүлээх:**
   - 5-48 цаг хүртэл үргэлжилнэ (ихэвчлэн 1-2 цаг)
   - Email ирнэ "korean-goods.com is now active on Cloudflare"

8. **DNS хуудас руу очих:**
   - Cloudflare → korean-goods.com → DNS → Records

### Таны domain бэлэн болсны дараа:

**Production URLs (бэлэн болох):**
- ✅ https://korean-goods.com (Store - Main website)
- ✅ https://admin.korean-goods.com (Admin panel)
- ✅ https://api.korean-goods.com (Backend API)

Одоо deployment хийцгээе! ⬇️

---

## Part 1: Store App Deployment (Cloudflare Pages)

### Яагаад Cloudflare Pages?
- ✅ Үнэгүй (unlimited bandwidth)
- ✅ Global CDN (дэлхий даяар хурдан)
- ✅ GitHub автомат deploy
- ✅ Custom domain үнэгүй
- ✅ Automatic HTTPS

### Алхам 1.1: Cloudflare Pages дээр Store App deploy хийх

#### 1. Cloudflare account үүсгэх
```
https://dash.cloudflare.com/sign-up
```

#### 2. Cloudflare Pages руу очих
- Dashboard → Workers & Pages → Create Application
- **"Pages" tab сонгох**
- **"Connect to Git" дарах**

#### 3. GitHub repository холбох
- GitHub account authorize хийх
- Repository сонгох: `ECommerce-Final-Project`
- Branch сонгох: `master` (эсвэл `main`)

#### 4. Build settings тохируулах

```yaml
Project name: ecommerce-store
Production branch: master
Build command: cd apps/store && npm install && npm run build
Build output directory: apps/store/dist
Root directory: /
```

#### 5. Environment Variables нэмэх

**Production environment variables (korean-goods.com):**

```bash
VITE_API_URL=https://api.korean-goods.com
VITE_SUPABASE_URL=https://miqlyriefwqmutlsxytk.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_R2_PUBLIC_BASE_URL=https://pub-ae3ca9ca99644328a7c71402917f9dae.r2.dev
```

**⚠️ АНХААРАХ:**
- `VITE_API_URL` нь `https://api.korean-goods.com` байх (Backend deploy хийсний дараа)
- Эхлээд temporary Cloudflare Pages URL (`https://ecommerce-store.pages.dev`) ашиглаад дараа нь custom domain холбох

#### 6. Deploy хийх
- **"Save and Deploy" дарах**
- Build process ажиллана (2-3 минут)
- Амжилттай бол URL гарна: `https://ecommerce-store.pages.dev`

#### 7. Custom Domain холбох: korean-goods.com

**АНХААРАХ:** Энэ нь Store-ийн main domain болно!

1. **Cloudflare Pages → ecommerce-store → Settings → Custom domains**

2. **"Add a custom domain" дарах**

3. **Domain оруулах:**
   ```
   korean-goods.com
   ```
   (Subdomain биш, root domain!)

4. **DNS Record автоматаар үүснэ:**
   - Type: CNAME
   - Name: @ (root)
   - Target: ecommerce-store.pages.dev
   - Proxy: ON (orange cloud)

5. **HTTPS автоматаар идэвхжинэ (1-2 минут)**

6. **Verify:**
   ```
   https://korean-goods.com
   ```
   → Store app харагдах ёстой!

---

## Part 2: Admin App Deployment (Cloudflare Pages)

### Алхам 2.1: Admin App deploy хийх

Admin app нь Store app-тай ижил процесс, гэхдээ өөр project болгох:

#### 1. Шинэ Pages project үүсгэх
- Cloudflare Pages → Create Application
- Ижил repository сонгох
- Өөр project нэр өгөх

#### 2. Build settings

```yaml
Project name: ecommerce-admin
Production branch: master
Build command: cd apps/admin && npm install && npm run build
Build output directory: apps/admin/dist
Root directory: /
```

#### 3. Environment Variables (korean-goods.com)

```bash
VITE_API_URL=https://api.korean-goods.com
VITE_SUPABASE_URL=https://miqlyriefwqmutlsxytk.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_R2_PUBLIC_BASE_URL=https://pub-ae3ca9ca99644328a7c71402917f9dae.r2.dev
```

#### 4. Deploy хийх
- "Save and Deploy"
- URL гарна: `https://ecommerce-admin.pages.dev`

#### 5. Custom Domain холбох: admin.korean-goods.com

1. **Cloudflare Pages → ecommerce-admin → Settings → Custom domains**

2. **"Add a custom domain" дарах**

3. **Subdomain оруулах:**
   ```
   admin.korean-goods.com
   ```

4. **DNS Record автоматаар үүснэ:**
   - Type: CNAME
   - Name: admin
   - Target: ecommerce-admin.pages.dev
   - Proxy: ON

5. **Verify:**
   ```
   https://admin.korean-goods.com
   ```
   → Admin panel харагдах ёстой!

---

## Part 3: Backend API Deployment (Railway)

### Яагаад Railway?
- ✅ Хялбар setup (5 минут)
- ✅ GitHub auto-deploy
- ✅ Free $5/сар credit (trial)
- ✅ PostgreSQL (Supabase) холбогдоно
- ✅ Environment variables удирдлага
- ✅ Logs харах боломжтой

### Алхам 3.1: Railway дээр Backend deploy хийх

#### 1. Railway account үүсгэх
```
https://railway.app/
```
- "Login with GitHub" дарах

#### 2. Шинэ project үүсгэх
- Dashboard → "New Project"
- "Deploy from GitHub repo" сонгох
- Repository сонгох: `ECommerce-Final-Project`

#### 3. Service тохируулах

Railway автоматаар backend-г таньж болно, гэхдээ manual тохируулах:

**Settings → Service Settings:**

```yaml
Service Name: ecommerce-backend
Root Directory: /backend
Build Command: npm install
Start Command: npm start
Watch Paths: /backend/**
```

#### 4. Environment Variables нэмэх

Railway Dashboard → Variables tab:

```bash
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://miqlyriefwqmutlsxytk.supabase.co
SUPABASE_JWT_SECRET=your_jwt_secret
SUPABASE_ANON_KEY=your_anon_key

# Database (Supabase Postgres)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=ecommerce-images
R2_PUBLIC_BASE_URL=https://pub-ae3ca9ca99644328a7c71402917f9dae.r2.dev

# CORS (korean-goods.com Frontend URLs)
CORS_ORIGIN=https://korean-goods.com,https://admin.korean-goods.com

# АНХААРАХ: Эхлээд Cloudflare Pages URLs ашиглаад дараа нь custom domains холбосны дараа энийг ашиглах
# Development/Staging: https://ecommerce-store.pages.dev,https://ecommerce-admin.pages.dev
# Production: https://korean-goods.com,https://admin.korean-goods.com
```

**⚠️ АНХААРАХ:**
- `SUPABASE_JWT_SECRET` авах: Supabase Dashboard → Settings → API → JWT Secret
- `DATABASE_URL` авах: Supabase Dashboard → Settings → Database → Connection string (Pooler)
- `DIRECT_URL` авах: Supabase Dashboard → Settings → Database → Connection string (Direct)

#### 5. Deploy хийх
- Variables хадгалсны дараа Railway автоматаар deploy хийнэ
- Logs tab дээр явцыг харна
- Success болох: URL гарна `https://ecommerce-backend.up.railway.app`

#### 6. Custom Domain холбох: api.korean-goods.com

**Railway → Settings → Domains:**

1. **"Custom Domain" дарах**

2. **Domain оруулах:**
   ```
   api.korean-goods.com
   ```

3. **Railway CNAME target харуулна:**
   ```
   Example: ecommerce-backend.up.railway.app
   ```

4. **Cloudflare DNS руу очиж CNAME record нэмэх:**
   - Cloudflare → korean-goods.com → DNS → Records
   - Type: CNAME
   - Name: api
   - Target: ecommerce-backend.up.railway.app (Railway-с авсан)
   - Proxy: OFF (саарал булд - Railway-д шууд холбоход)
   - TTL: Auto
   - Save

5. **Verify (5-10 минут):**
   ```
   https://api.korean-goods.com/health
   ```
   → Backend health check ажиллах ёстой!

---

## Part 4: Final Configuration & Testing

### Алхам 4.1: Backend URL-г Frontend-д солих

Backend deploy хийсний дараа:

#### Store App (korean-goods.com):
1. Cloudflare Pages → ecommerce-store → Settings → Environment variables
2. `VITE_API_URL` засах:
   ```
   VITE_API_URL=https://api.korean-goods.com
   ```
3. Redeploy дарах

#### Admin App (admin.korean-goods.com):
1. Cloudflare Pages → ecommerce-admin → Settings → Environment variables
2. `VITE_API_URL` засах:
   ```
   VITE_API_URL=https://api.korean-goods.com
   ```
3. Redeploy дарах

---

### Алхам 4.2: CORS тохиргоо засах (korean-goods.com)

Backend-д CORS тохиргоо шинэчлэх:

1. **Railway → Environment Variables:**
   ```bash
   CORS_ORIGIN=https://korean-goods.com,https://admin.korean-goods.com
   ```

2. **Backend code шалгах** (`backend/src/index.ts`):
   ```typescript
   await fastify.register(cors, {
     origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
     credentials: true
   })
   ```

3. **Redeploy:** Railway автоматаар redeploy хийнэ

---

### Алхам 4.3: Supabase Authentication URLs шинэчлэх (korean-goods.com)

1. **Supabase Dashboard руу очих:**
   ```
   https://supabase.com/dashboard/project/miqlyriefwqmutlsxytk
   ```

2. **Authentication → URL Configuration:**
   ```
   Site URL: https://korean-goods.com
   ```

3. **Redirect URLs нэмэх:**
   ```
   https://korean-goods.com/auth/reset
   https://admin.korean-goods.com/auth/reset
   ```

4. **Save дарах**

**АНХААРАХ:** Password reset email-ний холбоос одоо korean-goods.com domain ашиглана!

---

### Алхам 4.4: Testing (korean-goods.com)

#### 1. Store App тест:
```
https://korean-goods.com
```

**Шалгах:**
- ✅ Хуудас нээгдэнэ (Korean Goods logo харагдана)
- ✅ Products харагдана (Backend холбогдсон)
- ✅ Signup/Login ажиллана (Supabase холбогдсон)
- ✅ Cart functionality
- ✅ Checkout flow (Auth gate ажиллана)
- ✅ Images харагдана (R2 холбогдсон)
- ✅ Dark mode toggle
- ✅ МН/EN language toggle

#### 2. Admin App тест:
```
https://admin.korean-goods.com
```

**Шалгах:**
- ✅ Login ажиллана (ADMIN role шаардлагатай)
- ✅ Dashboard харагдана
- ✅ Products CRUD ажиллана
- ✅ Categories CRUD ажиллана
- ✅ Image upload ажиллана (R2)
- ✅ Statistics харагдана

#### 3. Backend API тест:
```
https://api.korean-goods.com/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected"
}
```

---

## Part 5: Automatic Deployments

### GitHub автомат deployment тохируулах

**Одоо байгаа setup:**
- ✅ Cloudflare Pages: `master` branch рүү push → auto deploy
- ✅ Railway: `master` branch рүү push → auto deploy

**Workflow:**

```bash
# 1. Local дээр өөрчлөлт хийх
git add .
git commit -m "feat: add new feature"

# 2. Push to GitHub
git push origin master

# 3. Автоматаар deploy хийгдэнэ:
#    - Cloudflare Pages: Store + Admin apps
#    - Railway: Backend API
#    - 2-5 минутын дараа бэлэн

# 4. Verify
# Visit production URLs
```

---

## Part 6: Domain Setup (korean-goods.com)

### ✅ Таны domain: korean-goods.com

**Final Production URLs:**
- Store: `https://korean-goods.com`
- Admin: `https://admin.korean-goods.com`
- API: `https://api.korean-goods.com`

### Дэлгэрэнгүй Setup:

#### Алхам 6.1: Cloudflare DNS Records шалгах

Cloudflare → korean-goods.com → DNS → Records дээр дараах CNAME records байх ёстой:

**1. Root Domain (Store App):**
```
Type: CNAME
Name: @ (эсвэл korean-goods.com)
Target: ecommerce-store.pages.dev
Proxy: ON (orange cloud ⚡)
TTL: Auto
```

**2. Admin Subdomain:**
```
Type: CNAME
Name: admin
Target: ecommerce-admin.pages.dev
Proxy: ON (orange cloud ⚡)
TTL: Auto
```

**3. API Subdomain:**
```
Type: CNAME
Name: api
Target: ecommerce-backend.up.railway.app
Proxy: OFF (саарал булд ☁️ - Railway direct connection)
TTL: Auto
```

**АНХААРАХ:**
- Store болон Admin: Proxy **ON** (Cloudflare CDN ашиглана)
- API: Proxy **OFF** (Railway шууд холболт)

#### Алхам 6.2: SSL/TLS Settings

Cloudflare → korean-goods.com → SSL/TLS:

**Mode сонгох:**
```
Full (strict) - Recommended
```

**Always Use HTTPS:**
```
ON - HTTP → HTTPS автоматаар redirect
```

**Minimum TLS Version:**
```
TLS 1.2 (эсвэл 1.3)
```

#### Алхам 6.3: Custom Domains баталгаажуулах

**Cloudflare Pages (Store) - korean-goods.com:**
1. Pages → ecommerce-store → Settings → Custom domains
2. "korean-goods.com" байгаа эсэхийг шалгах
3. Status: "Active" байх ёстой (ногоон)

**Cloudflare Pages (Admin) - admin.korean-goods.com:**
1. Pages → ecommerce-admin → Settings → Custom domains
2. "admin.korean-goods.com" байгаа эсэхийг шалгах
3. Status: "Active" байх ёстой

**Railway (Backend) - api.korean-goods.com:**
1. Railway → ecommerce-backend → Settings → Domains
2. "api.korean-goods.com" нэмэх
3. CNAME verification (5-10 минут)

#### Алхам 6.4: Domain баталгаажилт тест

**Store тест:**
```bash
curl -I https://korean-goods.com
# HTTP/2 200 харах ёстой
```

**Admin тест:**
```bash
curl -I https://admin.korean-goods.com
# HTTP/2 200 харах ёстой
```

**API тест:**
```bash
curl https://api.korean-goods.com/health
# {"status":"ok",...} харах ёстой
```

#### Алхам 6.5: SEO & Performance

**Cloudflare Settings шинэчлэх:**

**Speed → Optimization:**
- Auto Minify: ON (HTML, CSS, JS)
- Brotli: ON
- Rocket Loader: OFF (React conflict)

**Caching → Configuration:**
- Caching Level: Standard
- Browser Cache TTL: 4 hours

**АНХААРАХ:** korean-goods.com одоо бүрэн ажиллах бэлэн! 🎉

---

## Part 7: Database Migration

### Production Database setup

**Суурь:** Та аль хэдийн Supabase ашиглаж байгаа тул production database бэлэн байна!

Гэхдээ хэрэв шинэ production database үүсгэх бол:

#### Option 1: Supabase Project ашиглах (Recommended)

Одоогийн development Supabase project-оо production болгох:

1. **Supabase Dashboard → Project Settings**
2. **Pause/Resume project** (maintenance)
3. **Production environment variables шинэчлэх**

#### Option 2: Шинэ Production Supabase Project үүсгэх

1. **Supabase шинэ project үүсгэх:**
   - Project name: `ecommerce-production`
   - Password үүсгэх
   - Region сонгох (closest to users)

2. **Schema migrate хийх:**
   ```bash
   # Development-с schema export
   cd backend
   npx prisma db pull
   npx prisma migrate dev --name init

   # Production DATABASE_URL солих
   # .env.production:
   DATABASE_URL=your_production_supabase_url

   # Migrate хийх
   npx prisma migrate deploy
   ```

3. **Data seed хийх:**
   ```bash
   npm run seed:prod
   ```

---

## Part 8: Monitoring & Logs

### Cloudflare Pages Logs

**Real-time logs:**
- Cloudflare Pages → Deployment → View logs
- Build logs, deployment status

**Analytics:**
- Cloudflare Pages → Analytics
- Page views, requests, bandwidth

### Railway Logs

**Live logs:**
- Railway → Deployments → View logs
- Real-time server logs
- Error tracking

**Metrics:**
- Railway → Metrics
- CPU, Memory, Network usage

### Error Tracking (Optional)

**Sentry суулгах:**

```bash
npm install @sentry/react @sentry/node
```

**Frontend (Store/Admin):**
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
});
```

**Backend:**
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
});
```

---

## Part 9: Environment Variables Checklist

### Frontend (.env.production)

```bash
# Store & Admin Apps
VITE_API_URL=https://api.yourdomain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev
```

### Backend (.env.production)

```bash
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your_jwt_secret
SUPABASE_ANON_KEY=your_anon_key

# Database
DATABASE_URL=postgresql://...?pgbouncer=true
DIRECT_URL=postgresql://...

# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=ecommerce-images
R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev

# CORS
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

# Optional
SENTRY_DSN=your_sentry_dsn
```

---

## Part 10: Security Checklist

### Production-д гаргахын өмнө:

- [ ] Environment variables production утгууд бөглөсөн
- [ ] HTTPS enabled (Cloudflare автоматаар өгнө)
- [ ] CORS зөв тохируулсан (зөвхөн production domains)
- [ ] Supabase RLS (Row Level Security) идэвхжүүлсэн
- [ ] Supabase Auth rate limiting enabled
- [ ] Sensitive data .env файлд (NEVER commit to git)
- [ ] API rate limiting (Fastify rate-limit plugin)
- [ ] SQL injection prevention (Prisma ORM автоматаар хамгаална)
- [ ] XSS prevention (React автоматаар escape хийнэ)
- [ ] Admin panel зөвхөн ADMIN role-той хэрэглэгч
- [ ] Password strength requirements
- [ ] Email confirmation enabled
- [ ] Helmet.js суулгасан (HTTP headers security)

**Helmet.js нэмэх:**

```bash
cd backend
npm install @fastify/helmet
```

```typescript
// backend/src/index.ts
import helmet from '@fastify/helmet'

await fastify.register(helmet, {
  contentSecurityPolicy: false // R2 images-ийн төлөө
})
```

---

## Part 11: Performance Optimization

### Frontend Optimization

1. **Build optimization:**
   ```bash
   # Vite автоматаар minify, tree-shake, code-split хийнэ
   npm run build
   ```

2. **Image optimization:**
   - R2-д upload хийхийн өмнө image resize/optimize
   - WebP format ашиглах
   - Lazy loading (`<img loading="lazy">`)

3. **Code splitting:**
   ```typescript
   // Route-based code splitting
   const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
   ```

### Backend Optimization

1. **Database indexes:**
   ```prisma
   model Product {
     @@index([slug])
     @@index([categoryId])
   }
   ```

2. **Caching:**
   ```typescript
   import fastifyRedis from '@fastify/redis'

   await fastify.register(fastifyRedis, {
     host: 'your-redis-host'
   })
   ```

3. **Connection pooling:**
   - Prisma автоматаар connection pool удирдана
   - Supabase pgBouncer ашиглах (`?pgbouncer=true`)

---

## Part 12: Backup Strategy

### Database Backup

**Supabase:**
- Automatic daily backups (Free plan: 7 days)
- Manual backup: Supabase Dashboard → Database → Backups

**Manual backup script:**

```bash
# Export database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Upload to cloud storage
# (AWS S3, Cloudflare R2, etc.)
```

### Code Backup

- ✅ GitHub repository (already backed up)
- ✅ Git tags for releases:
  ```bash
  git tag -a v1.0.0 -m "Production release 1.0.0"
  git push origin v1.0.0
  ```

---

## Part 13: Cost Breakdown

### Үнэгүй хувилбар (Free Tier):

| Service | Plan | Үнэ |
|---------|------|-----|
| Cloudflare Pages (Store) | Free | $0 |
| Cloudflare Pages (Admin) | Free | $0 |
| Railway (Backend) | Trial | $5 credit |
| Supabase | Free | $0 |
| Cloudflare R2 | Free | $0 (10GB storage) |
| **TOTAL** | | **$0/month** (trial дууссаны дараа $5) |

### Төлбөртэй хувилбар (Production):

| Service | Plan | Үнэ |
|---------|------|-----|
| Cloudflare Pages | Free/Pro | $0-20/сар |
| Railway | Hobby | $5/сар |
| Supabase | Pro | $25/сар |
| Cloudflare R2 | Pay-as-you-go | ~$1-5/сар |
| Custom Domain | Varies | $10-20/жил |
| **TOTAL** | | **$30-50/month** |

---

## Part 14: Troubleshooting

### Common Issues:

#### 1. "CORS Error" Frontend-ээс Backend руу request явуулахад

**Solution (korean-goods.com):**
```bash
# Railway → Environment Variables шинэчлэх
CORS_ORIGIN=https://korean-goods.com,https://admin.korean-goods.com

# Backend код шалгах (backend/src/index.ts)
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(','),
  credentials: true
})

# Railway Redeploy дарах
```

#### 2. "Cannot connect to database"

**Solution:**
```bash
# DATABASE_URL зөв эсэхийг шалгах
# Railway logs шалгах:
# - Connection string correct?
# - Supabase project running?
# - Firewall/IP whitelist?
```

#### 3. "Images not loading"

**Solution:**
```bash
# R2_PUBLIC_BASE_URL зөв эсэх
# R2 bucket public эсэх
# CORS configuration R2 bucket дээр

# Cloudflare R2 → Bucket → Settings → CORS
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"]
  }
]
```

#### 4. "Build failed on Cloudflare Pages"

**Solution:**
```bash
# Build command дахин шалгах:
cd apps/store && npm install && npm run build

# Build output directory:
apps/store/dist

# Node version:
# Cloudflare Pages → Settings → Environment variables
NODE_VERSION=18
```

#### 5. "Railway deployment failed"

**Solution:**
```bash
# Logs шалгах: Railway → Deployments → Failed → View logs
# Common issues:
# - Missing environment variables
# - Build command wrong
# - Port configuration (Railway PORT env автоматаар set хийнэ)
# - Dependencies missing in package.json
```

---

## Part 15: Scaling Strategy

### Traffic ихэссэн үед:

#### Level 1: Free Tier (0-10k хэрэглэгч/сар)
- ✅ Cloudflare Pages (unlimited bandwidth)
- ✅ Railway Hobby ($5)
- ✅ Supabase Free

#### Level 2: Small Business (10k-100k хэрэглэгч/сар)
- ✅ Cloudflare Pages Pro ($20)
- ✅ Railway Pro ($20)
- ✅ Supabase Pro ($25)
- Total: ~$65/сар

#### Level 3: Growing Business (100k-1M хэрэглэгч/сар)
- ✅ Cloudflare Pages Business ($200)
- ✅ Railway Team ($99)
- ✅ Supabase Team ($599)
- ✅ Redis caching (Upstash $10)
- ✅ CDN for images
- Total: ~$900/сар

#### Level 4: Enterprise (1M+ хэрэглэгч/сар)
- Custom infrastructure
- Load balancers
- Multiple regions
- Dedicated support

---

## Part 16: CI/CD Pipeline (Advanced)

### GitHub Actions ашиглан автомат test + deploy:

`.github/workflows/deploy.yml` үүсгэх:

```yaml
name: Deploy

on:
  push:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      # Backend tests
      - name: Test Backend
        run: |
          cd backend
          npm install
          npm test

      # Store tests
      - name: Test Store
        run: |
          cd apps/store
          npm install
          npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy notification
        run: echo "Tests passed! Deploying..."

      # Cloudflare & Railway автоматаар deploy хийнэ
```

---

## 🎯 korean-goods.com Deployment Checklist

### Эцсийн шалгалтын жагсаалт:

#### Domain & DNS ✅
- [ ] korean-goods.com Cloudflare-д нэмэгдсэн
- [ ] Nameservers Cloudflare руу шилжсэн
- [ ] DNS CNAME records үүссэн:
  - [ ] @ → ecommerce-store.pages.dev (Proxy ON)
  - [ ] admin → ecommerce-admin.pages.dev (Proxy ON)
  - [ ] api → ecommerce-backend.up.railway.app (Proxy OFF)

#### Store App (korean-goods.com) ✅
- [ ] Cloudflare Pages deploy хийгдсэн
- [ ] Custom domain: korean-goods.com холбогдсон
- [ ] Environment variables:
  - [ ] VITE_API_URL=https://api.korean-goods.com
  - [ ] VITE_SUPABASE_URL configured
  - [ ] VITE_R2_PUBLIC_BASE_URL configured
- [ ] Test: https://korean-goods.com ажиллана

#### Admin App (admin.korean-goods.com) ✅
- [ ] Cloudflare Pages deploy хийгдсэн
- [ ] Custom domain: admin.korean-goods.com холбогдсон
- [ ] Environment variables:
  - [ ] VITE_API_URL=https://api.korean-goods.com
  - [ ] VITE_SUPABASE_URL configured
- [ ] Test: https://admin.korean-goods.com ажиллана

#### Backend API (api.korean-goods.com) ✅
- [ ] Railway deploy хийгдсэн
- [ ] Custom domain: api.korean-goods.com холбогдсон
- [ ] Environment variables:
  - [ ] CORS_ORIGIN=https://korean-goods.com,https://admin.korean-goods.com
  - [ ] SUPABASE_URL configured
  - [ ] DATABASE_URL configured
  - [ ] R2 credentials configured
- [ ] Test: https://api.korean-goods.com/health ажиллана

#### Supabase Configuration ✅
- [ ] Site URL: https://korean-goods.com
- [ ] Redirect URLs:
  - [ ] https://korean-goods.com/auth/reset
  - [ ] https://admin.korean-goods.com/auth/reset
- [ ] Email confirmation: Configured
- [ ] RLS policies: Enabled

#### Final Testing ✅
- [ ] Store signup/login ажиллана
- [ ] Store products харагдана
- [ ] Store checkout flow ажиллана
- [ ] Admin login ажиллана (ADMIN role)
- [ ] Admin CRUD operations ажиллана
- [ ] Images (R2) харагдана
- [ ] Dark mode toggle ажиллана
- [ ] Language toggle (МН/EN) ажиллана

**Бүх checkbox-г ✅ хийсэн бол production бэлэн!** 🚀

---

## Quick Start Summary

### 🚀 5 минутын deployment:

```bash
# 1. Cloudflare Pages (Store)
- GitHub холбох
- Build: cd apps/store && npm install && npm run build
- Output: apps/store/dist
- Deploy!

# 2. Cloudflare Pages (Admin)
- GitHub холбох
- Build: cd apps/admin && npm install && npm run build
- Output: apps/admin/dist
- Deploy!

# 3. Railway (Backend)
- GitHub холбох
- Root: /backend
- Start: npm start
- Env variables оруулах
- Deploy!

# 4. URLs шинэчлэх
- Backend URL → Frontend env variables
- CORS → Backend env variables
- Supabase URLs шинэчлэх

# 5. Test!
```

---

## Support & Resources

### Documentation:
- Cloudflare Pages: https://developers.cloudflare.com/pages
- Railway: https://docs.railway.app
- Supabase: https://supabase.com/docs
- Vite: https://vitejs.dev/guide/build.html
- Fastify: https://www.fastify.io/docs/latest/

### Community:
- Cloudflare Discord
- Railway Discord
- Supabase Discord

---

## Дүгнэлт

### 🎉 korean-goods.com Production URLs:

```
🛍️  Store:   https://korean-goods.com
👨‍💼  Admin:   https://admin.korean-goods.com
🔌  API:     https://api.korean-goods.com
```

### Таны платформ одоо:

✅ **Store App (korean-goods.com)** - Global CDN, дэлхий даяар хурдан
✅ **Admin App (admin.korean-goods.com)** - Secure, ADMIN role protection
✅ **Backend API (api.korean-goods.com)** - Scalable, auto-deploy
✅ **Database** - Supabase PostgreSQL (automatic backup)
✅ **Images** - Cloudflare R2 CDN
✅ **HTTPS** - Automatic SSL certificates
✅ **Authentication** - Supabase Auth (email/password)
✅ **Dark Mode** - Supported
✅ **Multilingual** - Mongolian/English

### Deployment Statistics:

**Total deployment time:** 30-60 минут
**Monthly cost:** $5-30/сар (traffic-аас хамаарна)
**Uptime:** 99.9%+ (Cloudflare + Railway)
**Global availability:** 200+ datacenters (Cloudflare CDN)

### Дараагийн алхмууд:

1. **SEO Optimization:**
   - Google Search Console нэмэх
   - Sitemap үүсгэх
   - Meta tags шинэчлэх

2. **Analytics:**
   - Google Analytics суулгах
   - Cloudflare Analytics харах
   - User behavior tracking

3. **Performance:**
   - Lighthouse audit ажиллуулах
   - Image optimization
   - Code splitting

4. **Marketing:**
   - Social media integration
   - Email marketing (newsletter)
   - Promotional campaigns

5. **Scale up:**
   - Railway Pro ($20/сар) - илүү их resources
   - Supabase Pro ($25/сар) - илүү их database capacity
   - CDN optimization

---

**korean-goods.com одоо дэлхий нийтээр хүртээмжтэй! 🌍🚀**

**Амжилт хүсье!** 🎉
