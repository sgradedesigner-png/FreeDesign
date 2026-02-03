# Store App Migration Plan
**Date:** 2026-02-02
**Issue:** Admin panel creating images at wrong path in R2

## Problem Analysis

### Current Situation

**R2 Bucket Structure:**
```
Bucket name: "products"

OLD products (from original store):
products/
├── 0ffe62b9-df66-4e97-93b5-197d9cbb8f33/
│   └── web/
│       └── image.jpg
├── 39d9d6fa-0d14-4bb8-ad0c-b684648ec82b/
│   └── web/
│       └── image.jpg
...

NEW products (from admin panel):
products/
└── products/  ← EXTRA FOLDER!
    └── 897ae9a7-9889-4174-910d-afe1dda87edc/
        └── web/
            └── image.jpg
```

**The Issue:**
- Bucket name: `products`
- Upload key: `products/{uuid}/web/file.jpg`
- Result: File stored at `products/products/{uuid}/web/file.jpg` ❌

**Root Cause:**
- Code in `backend/src/lib/r2-presigned.ts:121` adds "products/" prefix
- But bucket is already named "products"
- This creates double nesting

## Architecture Overview

### Backend (Current)
- **Framework:** Fastify + TypeScript
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **File Storage:** Cloudflare R2
- **Port:** 3000

**Key Files:**
- `backend/src/lib/r2-presigned.ts` - Presigned URL generation
- `backend/src/routes/admin/upload-presigned.ts` - Upload endpoint
- `backend/src/routes/admin/products.ts` - Product CRUD

### Admin Panel (Current)
- **Framework:** React + TypeScript
- **State Management:** React Hook Form
- **API Client:** Axios
- **UI:** Radix UI + Tailwind CSS
- **Port:** 5176

**Key Files:**
- `apps/admin/src/pages/ProductFormPage.tsx` - Product creation with deferred upload
- `apps/admin/src/components/ImageUpload.tsx` - Image upload component (edit mode only)

### Store App (Current)
- **Framework:** React + TypeScript
- **3D Engine:** Three.js + React Three Fiber
- **Data Fetching:** TanStack Query
- **Backend:** Supabase Client (direct database access)
- **Port:** Not specified in code

**Key Files:**
- `apps/store/src/data/products.api.ts` - Fetches products from Supabase
- `apps/store/src/data/products.ts` - Product mapping
- `apps/store/src/lib/supabase.ts` - Supabase client

**Important:** Store app does NOT use the Fastify backend API. It connects directly to Supabase database.

## Image URL Flow

### Old Products (Working)
```
1. Database: images = ["https://pub-...r2.dev/0ffe62b9-.../web/image.jpg"]
2. Store fetches from database
3. Maps to: image_path = "https://pub-...r2.dev/0ffe62b9-.../web/image.jpg"
4. R2 serves from: products/{uuid}/web/image.jpg ✅
5. Image displays correctly
```

### New Products (Broken)
```
1. Admin creates product
2. Uploads with key: products/{uuid}/web/image.jpg
3. R2 stores at: products/products/{uuid}/web/image.jpg ❌
4. Database: images = ["https://pub-...r2.dev/products/{uuid}/web/image.jpg"]
5. Store fetches from database
6. R2 tries to serve from: products/products/{uuid}/web/image.jpg
7. But public URL points to: products/{uuid}/web/image.jpg
8. 404 - Image not found ❌
```

## Required Changes

### Option 1: Fix Backend (Recommended)

**Change the upload key to remove "products/" prefix**

**File:** `backend/src/lib/r2-presigned.ts`

**Current (line 121):**
```typescript
const key = `products/${productId}/web/${timestamp}-${filename}`;
```

**New:**
```typescript
const key = `${productId}/web/${timestamp}-${filename}`;
```

**Why Recommended:**
- Minimal changes (1 line of code)
- No data migration needed
- Future uploads work correctly
- Old products continue working
- Matches original store structure

### Option 2: Rename Bucket (NOT Recommended)

**Change bucket name from "products" to something else**

**Why NOT Recommended:**
- Requires changing all environment variables
- Requires updating R2 configuration
- Requires data migration of all existing products
- More complex, more risk

### Option 3: Migrate Old Data (Complex)

**Move all old products to products/products/ path**

**Why NOT Recommended:**
- Requires bulk file copy in R2
- Requires database URL updates
- Downtime during migration
- Risk of data loss
- Doesn't solve the underlying issue

## Implementation Plan

### Phase 1: Fix Backend Code ✅

**Step 1.1: Update r2-presigned.ts**
```typescript
// File: backend/src/lib/r2-presigned.ts

// OLD:
const key = `products/${productId}/web/${timestamp}-${filename}`;

// NEW:
const key = `${productId}/web/${timestamp}-${filename}`;
```

**Step 1.2: Update r2.ts (if using direct upload)**
```typescript
// File: backend/src/lib/r2.ts

// OLD (line 162):
const key = `products/${productId}/web/${filename}`;

// NEW:
const key = `${productId}/web/${filename}`;
```

**Step 1.3: Update delete functions**
```typescript
// File: backend/src/lib/r2.ts

// In deleteProductImages function (line ~235):
// OLD:
const prefix = `products/${productId}/`;

// NEW:
const prefix = `${productId}/`;
```

### Phase 2: Clean Up Existing Wrong Upload

**The Macbook product uploaded to wrong location:**

**Option A: Manual Fix (Quick)**
1. Go to R2 dashboard
2. Navigate to `products/products/897ae9a7.../`
3. Download the image
4. Upload to correct location: `products/897ae9a7.../web/`
5. Delete wrong folder
6. Update database URL if needed

**Option B: Programmatic Fix (Better)**
```typescript
// Create migration script
// backend/scripts/fix-double-path.ts

import { r2Client } from '../src/lib/r2';
import { CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

async function fixDoublePath() {
  // 1. List all objects under products/products/
  const prefix = 'products/';
  const listResult = await r2Client.send(new ListObjectsV2Command({
    Bucket: 'products',
    Prefix: prefix,
  }));

  for (const obj of listResult.Contents || []) {
    const oldKey = obj.Key!;

    // Only fix keys that start with products/
    if (oldKey.startsWith('products/')) {
      const newKey = oldKey.replace('products/', '');

      console.log(`Moving: ${oldKey} → ${newKey}`);

      // Copy to new location
      await r2Client.send(new CopyObjectCommand({
        Bucket: 'products',
        CopySource: `products/${oldKey}`,
        Key: newKey,
      }));

      // Delete old location
      await r2Client.send(new DeleteObjectCommand({
        Bucket: 'products',
        Key: oldKey,
      }));
    }
  }

  // 2. Update database URLs
  // Update all image URLs in database to remove the extra "products/" prefix
  await prisma.$executeRaw`
    UPDATE products
    SET images = ARRAY(
      SELECT regexp_replace(image_url, '/products/products/', '/products/', 'g')
      FROM unnest(images) AS image_url
    )
    WHERE EXISTS (
      SELECT 1 FROM unnest(images) AS img
      WHERE img LIKE '%/products/products/%'
    )
  `;
}
```

### Phase 3: Verify Store App Works

**No changes needed to Store App!**

The store app:
1. Fetches products from database
2. Gets image URLs from `images` column
3. Displays images using those URLs

As long as the URLs in the database are correct, the store app will work.

**Verification Steps:**
1. Create a new product from admin panel
2. Check R2 bucket structure
3. Verify images are at: `products/{uuid}/web/file.jpg` ✅
4. Check store app
5. Verify product displays with images ✅

### Phase 4: Documentation Update

**Update CURRENT_STATE.md:**
```markdown
## File Upload Flow

### Image Storage Path
- **Bucket:** products
- **Structure:** `{product-uuid}/web/{timestamp}-{filename}.jpg`
- **Full path:** `products/{product-uuid}/web/1234567890-image.jpg`
- **Public URL:** `https://pub-....r2.dev/{product-uuid}/web/1234567890-image.jpg`

### Create Mode
1. User selects images (preview only)
2. User submits form
3. Backend creates product → gets real UUID
4. Frontend uploads images to R2 with that UUID
5. Images stored at: `{uuid}/web/file.jpg` (inside "products" bucket)
6. Backend updates product with image URLs
```

## Testing Plan

### Test 1: Create New Product
1. Open admin panel
2. Click "Add Product"
3. Fill in product details
4. Upload 2-3 images
5. Click "Create Product"
6. **Expected:** Images upload successfully

### Test 2: Verify R2 Structure
1. Open Cloudflare R2 dashboard
2. Navigate to "products" bucket
3. Find the newly created product folder
4. **Expected:** Files at `{uuid}/web/filename.jpg` (NOT `products/{uuid}/...`)

### Test 3: Verify Store Display
1. Open store app
2. Navigate to products page
3. Find the newly created product
4. **Expected:** Product displays with images correctly

### Test 4: Delete Product
1. Open admin panel
2. Delete a test product
3. Check R2 bucket
4. **Expected:** Product folder completely removed

### Test 5: Edit Product Images
1. Edit existing product
2. Add/remove images
3. Save changes
4. **Expected:** Images update correctly in R2

## Migration Checklist

- [ ] **Phase 1: Fix Code**
  - [ ] Update `r2-presigned.ts` line 121
  - [ ] Update `r2.ts` line 162 (if exists)
  - [ ] Update `r2.ts` deleteProductImages function
  - [ ] Restart backend server
  - [ ] Test new product creation

- [ ] **Phase 2: Fix Existing Data**
  - [ ] Run migration script OR manually move files
  - [ ] Update database image URLs
  - [ ] Verify old products still work
  - [ ] Delete empty `products/products/` folder

- [ ] **Phase 3: Verification**
  - [ ] Create test product from admin
  - [ ] Verify R2 structure is correct
  - [ ] Check store app displays images
  - [ ] Test delete functionality
  - [ ] Test edit functionality

- [ ] **Phase 4: Documentation**
  - [ ] Update CURRENT_STATE.md
  - [ ] Update IMAGE_UPLOAD_FIX.md
  - [ ] Create this migration plan ✅

## Rollback Plan

If something goes wrong:

1. **Revert code changes** in `r2-presigned.ts` and `r2.ts`
2. **Restore old bucket structure** if migration was done
3. **Restore database backup** if URLs were updated

**Prevention:**
- Make database backup before migration
- Test with one product first
- Keep old files until verified working

## Environment Variables

**No changes needed!**

Store app already uses:
```env
VITE_SUPABASE_URL=https://miqlyriefwqmutlsxytk.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_sC8MYE4uSs5Ky02qKOZpYQ_qM90UmUZ
```

Admin and backend use same Supabase + R2 config (already configured).

## API Compatibility

### Current Backend Endpoints (Used by Admin)
```
POST   /admin/upload/presigned-url  - Get presigned URL for upload
GET    /admin/products              - List products
POST   /admin/products              - Create product
PUT    /admin/products/:id          - Update product
DELETE /admin/products/:id          - Delete product (+ R2 cleanup)
GET    /admin/categories            - List categories
```

### Store App Access (Direct Supabase)
```sql
-- Store app queries Supabase directly:
SELECT * FROM products
  JOIN categories ON products.categoryId = categories.id
  ORDER BY createdAt DESC
```

**No API changes needed!** Store app doesn't use backend API.

## Success Criteria

✅ New products created from admin panel have correct R2 structure
✅ Images stored at `{uuid}/web/file.jpg` inside "products" bucket
✅ Store app displays all products with images correctly
✅ Old products continue to work without issues
✅ Delete functionality removes files from R2
✅ No "products/products/" double nesting

## Timeline

- **Code fix:** 5 minutes
- **Testing:** 15 minutes
- **Migration script (if needed):** 30 minutes
- **Full verification:** 15 minutes

**Total:** ~1 hour

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | HIGH | Backup database and R2 first |
| Broken image URLs | MEDIUM | Keep old files until verified |
| Store app compatibility | LOW | Store uses database URLs directly |
| Backend downtime | LOW | Quick code change, auto-restart |

## Next Steps

1. ✅ Create this migration plan
2. ⏳ Review and approve plan
3. ⏳ Implement Phase 1 (fix code)
4. ⏳ Test with one product
5. ⏳ Run Phase 2 (fix existing data)
6. ⏳ Full verification
7. ⏳ Update documentation

## Contact & Support

If issues arise:
- Check backend logs: `C:\Users\hitech\AppData\Local\Temp\claude\...\tasks\*.output`
- Check browser console for frontend errors
- Verify R2 bucket structure in Cloudflare dashboard
- Check database with Prisma Studio: `npx prisma studio`
