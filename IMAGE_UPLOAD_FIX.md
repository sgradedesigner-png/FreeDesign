# Image Upload File Structure Fix

**Date:** 2026-02-02
**Issue:** Images uploaded during product creation were using temporary IDs instead of real product UUIDs

## Problem

Previously, when creating a new product:
```
❌ OLD STRUCTURE:
products/temp-1770002698214/web/image.jpg  (temporary ID)
```

This happened because:
1. User selected images before product creation
2. Images uploaded immediately without a product UUID
3. Backend defaulted to `temp-{timestamp}` when no productId provided
4. Result: Poor file organization in R2 bucket

## Solution

Modified the product creation flow to ensure images always use real product UUIDs:

```
✅ NEW STRUCTURE:
products/a1b2c3d4-real-uuid-here/web/image.jpg  (real UUID)
```

## Implementation Details

### Changed Files

**apps/admin/src/pages/ProductFormPage.tsx**
- Added state for pending image files and preview URLs
- Added `uploadFileToR2()` function to upload files with specific productId
- Added `handlePendingFiles()` to store files locally in CREATE mode
- Added `removePendingFile()` to remove pending files
- Modified `onSubmit()` with new flow
- Updated JSX to show different UI for CREATE vs EDIT modes

### New Flow - CREATE Mode

**Before (OLD):**
```
1. User selects images
2. Images upload immediately → temp-{timestamp}
3. User submits form
4. Product created with temp image URLs
```

**After (NEW):**
```
1. User selects images → Stored as File objects with preview URLs
2. User submits form
3. Product created WITHOUT images → Get real UUID
4. Upload images to R2 using real UUID
5. Update product with image URLs
```

### Edit Mode Flow (Unchanged)

```
1. Product already exists with real UUID
2. User uploads images → Uses real UUID immediately
3. User updates product
```

## Technical Implementation

### CREATE Mode UI

- Custom file selector with drag & drop
- Local file storage using File objects
- Preview URLs using `URL.createObjectURL()`
- No upload until form submission
- Automatic cleanup of blob URLs

### EDIT Mode UI

- Uses existing `ImageUpload` component
- Immediate upload with real product UUID
- No changes to existing behavior

### Upload Process (CREATE Mode)

```typescript
// Step 1: Create product without images
const response = await api.post('/admin/products', {
  title, slug, description, price, stock, categoryId,
  images: [] // Empty initially
});

const newProductId = response.data.id; // Real UUID

// Step 2: Upload each file with real UUID
for (const file of pendingImageFiles) {
  // Request presigned URL with real productId
  const { uploadUrl, publicUrl } = await api.post('/admin/upload/presigned-url', {
    filename: file.name,
    contentType: file.type,
    productId: newProductId // ← Real UUID, not temp!
  });

  // Upload to R2
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
  });

  uploadedUrls.push(publicUrl);
}

// Step 3: Update product with image URLs
await api.put(`/admin/products/${newProductId}`, {
  ...payload,
  images: uploadedUrls
});
```

## File Structure in R2

### After This Fix

```
products/
├── a1b2c3d4-5678-90ab-cdef-1234567890ab/    ← Real product UUID
│   └── web/
│       ├── laptop-front.jpg
│       └── laptop-side.jpg
├── f9e8d7c6-5432-10ba-fedc-ba0987654321/    ← Real product UUID
│   └── web/
│       └── phone.jpg
```

### No More Temp Folders

```
❌ products/temp-1770002698214/web/...  (eliminated)
```

## Benefits

1. **Clean file organization** - All images organized by real product UUID
2. **Production-ready structure** - Proper folder hierarchy from day one
3. **Better traceability** - Easy to find images for any product
4. **No migration needed** - New products automatically use correct structure

## User Experience

### CREATE Mode

1. Click "Create Product"
2. Fill in product details
3. Select images (shows previews immediately)
4. Click "Create Product"
5. Backend creates product → uploads images with real UUID → redirects to product list

### EDIT Mode

1. Click "Edit" on existing product
2. Can upload/remove images immediately
3. Images use the existing product UUID
4. No changes to existing workflow

## Backend (No Changes Required)

The backend `upload-presigned.ts` already supports this:

```typescript
const productId = body.productId || `temp-${Date.now()}`;
```

- When `productId` provided: uses it (✅ real UUID)
- When `productId` missing: uses temp (only in old flow)

With this fix, `productId` is ALWAYS provided in CREATE mode.

## Testing

To verify the fix:

1. Create a new product with images
2. Check R2 bucket
3. Verify folder structure: `products/{real-uuid}/web/filename.jpg`
4. No `temp-` folders should be created

## Notes

- Preview URLs use browser's `URL.createObjectURL()` - no network cost
- Blob URLs automatically cleaned up on navigation
- File validation still occurs before adding to pending list
- Maximum 10 images enforced (same as before)
- Edit mode behavior completely unchanged

## Related Files

- `apps/admin/src/pages/ProductFormPage.tsx` - Main changes
- `apps/admin/src/components/ImageUpload.tsx` - Used in EDIT mode only
- `backend/src/routes/admin/upload-presigned.ts` - Presigned URL generation
- `backend/src/lib/r2-presigned.ts` - R2 upload utilities

## Migration of Old Data

Existing products with `temp-` folders:
- Can be manually migrated if needed
- New uploads will use correct structure
- Old URLs remain valid until files are moved
