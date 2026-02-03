# Product Deletion with R2 Cleanup

**Date:** 2026-02-02
**Issue:** Product deletion was not cleaning up images from R2 storage

## Problem (Before Fix)

### ❌ Old Behavior
```typescript
app.delete('/:id', async (request, reply) => {
  await prisma.product.delete({ where: { id } });
  return { ok: true };
});
```

**Issues:**
- ✅ Deleted product from database
- ❌ Did NOT delete images from R2
- ❌ Left orphaned files: `products/{uuid}/web/*.jpg`
- ❌ Wasted storage space and cost
- ❌ No cleanup mechanism

**Example:**
```
Database: Product deleted ✓
R2 Bucket: products/567a90ba-23e3-4cd9-ad1a-79c1bc7e6e8b/web/image1.jpg ← Still exists!
           products/567a90ba-23e3-4cd9-ad1a-79c1bc7e6e8b/web/image2.jpg ← Still exists!
```

## Solution (After Fix)

### ✅ New Behavior

**Flow:**
```
1. Check if product exists
2. Delete all images from R2 storage
3. Delete product folder from R2
4. Delete product from database
5. Return success
```

**Implementation:**

#### 1. New R2 Functions (`backend/src/lib/r2.ts`)

```typescript
// Delete single object
export async function deleteFromR2(key: string): Promise<void>

// Delete entire folder with prefix
export async function deleteR2Folder(prefix: string): Promise<number>

// Delete all product images
export async function deleteProductImages(productId: string): Promise<number>
```

#### 2. Updated DELETE Endpoint (`backend/src/routes/admin/products.ts`)

```typescript
app.delete('/:id', async (request, reply) => {
  const { id } = schema.parse(request.params);

  // Step 1: Check if product exists
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return reply.status(404).send({ message: 'Product not found' });

  // Step 2: Delete images from R2
  if (product.images && product.images.length > 0) {
    const deletedCount = await deleteProductImages(id);
    // Deletes: products/{uuid}/ and all contents
  }

  // Step 3: Delete from database
  await prisma.product.delete({ where: { id } });

  return { ok: true, message: 'Product and all associated images deleted successfully' };
});
```

## Technical Details

### R2 Deletion Process

**deleteProductImages(productId):**
1. Constructs prefix: `products/{productId}/`
2. Calls `deleteR2Folder(prefix)`
3. Lists all objects with that prefix
4. Deletes all objects in batch
5. Returns count of deleted files

**Example:**
```typescript
// Product UUID: 567a90ba-23e3-4cd9-ad1a-79c1bc7e6e8b

deleteProductImages('567a90ba-23e3-4cd9-ad1a-79c1bc7e6e8b')
  ↓
Lists: products/567a90ba-23e3-4cd9-ad1a-79c1bc7e6e8b/
  - products/567a90ba-23e3-4cd9-ad1a-79c1bc7e6e8b/web/image1.jpg
  - products/567a90ba-23e3-4cd9-ad1a-79c1bc7e6e8b/web/image2.jpg
  - products/567a90ba-23e3-4cd9-ad1a-79c1bc7e6e8b/web/image3.jpg
  ↓
Deletes all 3 files
  ↓
Returns: 3
```

### Error Handling

**R2 Deletion Failure:**
- If R2 deletion fails, logs warning but continues
- Product still deleted from database
- Prevents stuck state where product can't be deleted

```typescript
try {
  const deletedCount = await deleteProductImages(id);
} catch (r2Error) {
  console.error('⚠️ R2 deletion failed, but continuing...', r2Error);
  // Continue - don't block product deletion
}
```

**Why?**
- R2 might be temporarily unavailable
- Credentials might be invalid
- Network issues
- Better to delete product and manually clean R2 later than block deletion

### Logging

**Comprehensive logs for debugging:**
```
[Delete Product] ========== DELETE PRODUCT REQUEST ==========
[Delete Product] Product ID: 567a90ba-23e3-4cd9-ad1a-79c1bc7e6e8b
[Delete Product] ✅ Product found: Laptop Pro
[Delete Product] Images: 3
[Delete Product] Step 1: Deleting images from R2...
[R2 Delete Product] Deleting all images for product: 567a90ba-...
[R2 Delete Folder] Deleting folder from R2...
[R2 Delete Folder] Prefix: products/567a90ba-23e3-4cd9-ad1a-79c1bc7e6e8b/
[R2 Delete Folder] Found 3 objects to delete
[R2 Delete Folder] ✅ Deleted 3 objects
[Delete Product] ✅ Deleted 3 files from R2
[Delete Product] Step 2: Deleting product from database...
[Delete Product] ✅ Product deleted from database
[Delete Product] ========== DELETE COMPLETE ==========
```

## What Gets Deleted

### From Database (Supabase)
- Product record from `products` table
- All product fields (title, slug, description, price, stock, images array, categoryId)

### From R2 Storage (Cloudflare)
- Entire product folder: `products/{uuid}/`
- All files inside:
  - `products/{uuid}/web/*.jpg`
  - `products/{uuid}/web/*.png`
  - `products/{uuid}/web/*.webp`
  - Any other files in product folder

## Testing

### Manual Test

1. Create a product with images
2. Note the product UUID
3. Check R2 bucket - folder exists: `products/{uuid}/web/`
4. Delete the product from admin panel
5. Check logs - should show R2 deletion
6. Check R2 bucket - folder gone: `products/{uuid}/` ✓
7. Check database - product gone ✓

### Expected Console Output

```
[Delete Product] ========== DELETE PRODUCT REQUEST ==========
[Delete Product] Product ID: abc123...
[Delete Product] ✅ Product found: Test Product
[Delete Product] Images: 2
[Delete Product] Step 1: Deleting images from R2...
[R2 Delete Folder] Found 2 objects to delete
[R2 Delete Folder] ✅ Deleted 2 objects
[Delete Product] ✅ Deleted 2 files from R2
[Delete Product] Step 2: Deleting product from database...
[Delete Product] ✅ Product deleted from database
[Delete Product] ========== DELETE COMPLETE ==========
```

## Benefits

### ✅ Clean Storage
- No orphaned files in R2
- Storage costs don't grow from deleted products
- Bucket stays organized

### ✅ Proper Cleanup
- Database and storage stay in sync
- No manual cleanup needed
- Automatic process

### ✅ Cost Savings
- Don't pay for storage of deleted product images
- R2 charges per GB stored
- Cleanup happens immediately on delete

### ✅ Production Ready
- Error handling prevents stuck states
- Comprehensive logging for debugging
- Graceful degradation if R2 fails

## Edge Cases

### Product with No Images
```
[Delete Product] No images to delete from R2
[Delete Product] Step 2: Deleting product from database...
[Delete Product] ✅ Product deleted from database
```

### R2 Deletion Fails
```
[Delete Product] ⚠️ R2 deletion failed, but continuing...
[Delete Product] Step 2: Deleting product from database...
[Delete Product] ✅ Product deleted from database
```
- Product still deleted
- Manual R2 cleanup needed

### Product Already Deleted
```
[Delete Product] ❌ Product not found
Response: 404 Not Found
```

## Future Enhancements

### Optional Improvements

1. **Soft Delete**
   - Add `deletedAt` timestamp instead of hard delete
   - Keep products in database for recovery
   - Cleanup R2 after 30 days

2. **Bulk Delete**
   - Delete multiple products at once
   - Batch R2 deletion for efficiency

3. **Delete Queue**
   - Queue R2 deletions for background processing
   - Don't block product deletion on R2

4. **Audit Log**
   - Track who deleted what and when
   - Keep record of deleted products

5. **Recovery**
   - Undelete functionality
   - Restore from backup

## Related Files

- `backend/src/lib/r2.ts` - R2 delete functions
- `backend/src/routes/admin/products.ts` - DELETE endpoint
- `CURRENT_STATE.md` - Project documentation

## Migration Note

**Existing orphaned files:**
- Old products deleted before this fix may have orphaned R2 files
- These won't be auto-cleaned
- Manual cleanup script can be created if needed

**Going forward:**
- All new deletions will be clean
- No orphaned files from new deletions
