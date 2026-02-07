**Issue Summary**
The `/nike/sku` endpoint returned the wrong product images for some SKUs (e.g., `HQ2593-502` showed another colorway or failed to load), and gallery results contained duplicate images in two sizes.

**Root Cause**
1. The Nike product feed returned `imageUrls` as an object (`productImageUrl` on `secure-images.nike.com`) instead of an array for some SKUs. That domain was not resolvable in the local network (NXDOMAIN), so image URLs were unusable.
2. The code fell back to `publishedContent` and generic galleries, which often pointed to a different colorway’s hero images.
3. The fallback that scraped Nike’s product page pulled both `portrait` and `squarish` URLs, producing duplicate entries.

**Fix Applied**
1. Updated `looksLikeNikeCdn` to accept `secure-images.nike.com/is/image` URLs.
2. Added parsing for `imageUrls.productImageUrl` and built an image set from that base URL.
3. Added a page-scrape fallback using the product page slug (`/t/<slug>`) to extract SKU-specific `contentImages` from `__NEXT_DATA__` when only `secure-images` URLs were available.
4. Restricted the gallery selection to a single image type (`portrait` preferred; `squarish` only if `portrait` missing) to avoid duplicates.

**Verification**
1. Called the API with `HQ2593-502` and confirmed gallery images returned from `static.nike.com` with the correct colorway.
2. Confirmed that `secure-images.nike.com` URLs were no longer required in the response (avoiding NXDOMAIN).
3. Verified the gallery list no longer contained duplicate portrait/squarish pairs.
