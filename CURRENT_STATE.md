# E-Commerce Platform - Current State

**Last Updated:** 2026-02-02

## Project Overview
Full-stack e-commerce platform with admin panel for product management, built with React (frontend) and Fastify (backend).

## Architecture

### Backend Stack
- **Framework:** Fastify (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL (via Supabase)
- **ORM:** Prisma
- **Authentication:** Supabase Auth with JWT
- **File Storage:** Cloudflare R2
- **Port:** 3000 (http://localhost:3000)

### Frontend Stack
- **Framework:** React
- **Port:** 5176 (http://localhost:5176)
- **CORS:** Configured to allow frontend origin

## Database Schema (Prisma)

### Main Models:
1. **profiles** - User profiles with roles (ADMIN, USER)
2. **categories** - Product categories
3. **products** - Product listings (linked to categories)

## API Endpoints

### Admin Routes (Protected by adminGuard)

#### Categories
- `GET /admin/categories` - List all categories
- `POST /admin/categories` - Create new category
- `PUT /admin/categories/:id` - Update category
- `DELETE /admin/categories/:id` - Delete category

#### Products
- `GET /admin/products` - List all products
- `POST /admin/products` - Create new product
- `PUT /admin/products/:id` - Update product
- `DELETE /admin/products/:id` - Delete product

#### File Uploads
- `POST /admin/upload/product-image` - Upload single product image
- `POST /admin/upload/product-images` - Upload multiple product images

## ✅ Previous Issues (RESOLVED)

### ~~🚨 CRITICAL: SSL/TLS Handshake Failure on R2 Upload~~ **FIXED: 2026-02-02**

**Original Error:**
```
Error: SignatureDoesNotMatch - Invalid R2 credentials
Error: CORS policy blocking browser uploads
```

**Resolution:**
1. ✅ **New R2 API Token created** with correct permissions (Object Read & Write)
2. ✅ **CORS Policy configured** with lowercase specific headers:
   ```json
   {
     "AllowedOrigins": ["http://localhost:5176", ...],
     "AllowedMethods": ["GET", "PUT", "HEAD"],
     "AllowedHeaders": ["content-type", "content-length"],
     "ExposeHeaders": ["etag"],
     "MaxAgeSeconds": 3600
   }
   ```
3. ✅ **Presigned URL approach** implemented - browser uploads directly to R2
4. ✅ **ContentType signing removed** from presigned URL generation
5. ✅ **Credentials updated** in .env file

**Date Resolved:** 2026-02-02
**Solution Details:** See `RepairCorsError.md` for complete troubleshooting guide

### ~~🔧 File Organization: Images Using Temp IDs Instead of Real UUIDs~~ **FIXED: 2026-02-02**

**Original Issue:**
```
❌ products/temp-1770002698214/web/image.jpg  (temporary timestamp ID)
```

**Resolution:**
1. ✅ **Modified product creation flow** - Images no longer upload during form filling
2. ✅ **Deferred upload implementation** - Files stored locally with previews until product creation
3. ✅ **Real UUID usage** - Product created first → images uploaded with real UUID → product updated
4. ✅ **Proper file structure** - All new products use `products/{real-uuid}/web/filename.jpg`

**Date Resolved:** 2026-02-02
**Solution Details:** See `IMAGE_UPLOAD_FIX.md` for complete implementation details

## Environment Variables

### Required (.env)
```
NODE_ENV=development
PORT=3000
NODE_TLS_REJECT_UNAUTHORIZED=0

# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# CORS
CORS_ORIGIN=http://localhost:5176

# Supabase Auth
SUPABASE_URL=https://...supabase.co
SUPABASE_JWT_SECRET=...
SUPABASE_ANON_KEY=...

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=products
R2_PUBLIC_DOMAIN=pub-....r2.dev
```

## Authentication Flow

1. Admin logs in via Supabase Auth
2. JWT token issued
3. Frontend sends token in Authorization header
4. Backend validates token using `adminGuard` middleware
5. User profile fetched from database
6. Role checked (must be 'ADMIN')
7. Request allowed/denied

## File Upload Flow

1. Frontend sends multipart/form-data with image
2. adminGuard validates JWT and admin role
3. File validation (type, size)
4. Buffer extracted from multipart data
5. **[FAILING HERE]** Upload to R2 via AWS S3 SDK
6. Return public URL

## Development Setup

### Running Backend
```bash
cd backend
npm run dev  # Uses nodemon + ts-node
```

### Database Migrations
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

## File Structure

```
ecommerce-platform/
├── backend/
│   ├── src/
│   │   ├── app.ts                 # Main application entry
│   │   ├── auth.ts                # Auth utilities
│   │   ├── supabaseauth.ts        # Admin guard middleware
│   │   ├── lib/
│   │   │   ├── prisma.ts          # Prisma client
│   │   │   └── r2.ts              # R2/S3 client [ERROR HERE]
│   │   └── routes/
│   │       └── admin/
│   │           ├── categories.ts
│   │           ├── products.ts
│   │           └── upload.ts      # Upload endpoints
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env
│   └── package.json
├── apps/                          # Frontend application
└── package.json
```

## Logging Configuration

- **Logger:** Pino (JSON structured logging)
- **Request IDs:** Auto-generated for tracking
- **Log Level:** 30 (info)

## Next Steps / TODO

1. **URGENT:** Fix R2 SSL/TLS handshake error
   - Try alternative S3 SDK configuration
   - Test with different TLS versions
   - Consider using HTTP proxy
   - Try presigned URL approach

2. **Add comprehensive logging:**
   - SSL/TLS connection details
   - Request/response debugging
   - R2 client initialization logging

3. **Testing:**
   - Test uploads on Linux/Mac environment
   - Verify R2 credentials are valid
   - Test direct curl upload to R2

4. **Alternative solutions:**
   - Use Cloudflare Workers for upload proxy
   - Switch to different storage provider
   - Use presigned URLs from frontend

## Known Working Features

✅ Authentication and authorization
✅ Category CRUD operations
✅ Product CRUD operations **WITH IMAGES** ✨
✅ Database connections
✅ CORS configuration
✅ Admin middleware protection
✅ Request logging
✅ **Image upload to R2 storage via presigned URLs** ✨
✅ **Direct browser-to-R2 uploads** ✨
✅ **Proper file organization with real product UUIDs** ✨ (Fixed 2026-02-02)
✅ **Automatic R2 cleanup on product deletion** ✨ (Fixed 2026-02-02)

## Known Issues

⚠️ NODE_TLS_REJECT_UNAUTHORIZED=0 warning (expected in dev - Windows SSL workaround)

## Development Notes

- Running on Windows environment
- Using Supabase connection pooling (pgbouncer)
- Prisma queries visible in logs (good for debugging)
- All admin endpoints require valid JWT token
