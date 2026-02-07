# FINAL-IMPLEMENTATION-PLAN.md
## Feature: Add Product by SKU (Nike Prefill → “Pre-upload” Preview → Create Product)
**Key requirement:** Nike-аас ирсэн зурагнуудыг **Cloudflare R2 руу upload хийхгүй**. Зөвхөн **URL-уудыг form дээр “pre-upload” шиг preview** болгон харуулна. Admin “Create Product” дарсны дараа DB-д хадгална.

---

## 0) Repo Context (given)
### Admin
- `apps/admin/src/pages/ProductsPage.tsx`
- `apps/admin/src/pages/ProductFormPage.tsx`
- `apps/admin/src/lib/api.ts`
- `apps/admin/src/components/ImageUpload.tsx` (thumbnail + gallery upload/preview)

### Backend
- `backend/src/app.ts`
- `backend/src/routes/nike.ts` ✅ (already added)
- `backend/src/routes/admin/*` (admin routes)
- `backend/src/lib/prisma.ts` (DB)
- Existing product create route (likely `backend/src/routes/admin/products.ts`)

---

# PHASE 1 — Backend: Prefill endpoint (NO image upload)
## Goal
Add an endpoint that returns Nike data normalized for admin form autofill.
**Do not** download or upload images to R2. Only return Nike image URLs.

### 1.1 Create admin prefill route file
Create file:
- `backend/src/routes/admin/prefill.ts`

Implement Fastify route:
- `GET /admin/prefill/nike?sku=IO9571-400`

### 1.2 Prefill response shape
Return JSON:
```ts
type NikePrefillResponse = {
  title: string;
  slug: string;
  description: string;
  variantName: string; // from nike.colorway
  sku: string;
  priceUsd?: number;
  thumbnailUrl: string | null; // nike.thumbnail
  galleryImages: string[];      // nike.gallery_images
};
1.3 Prefill logic (no R2)
Inside the route:

Validate sku is present (string)

Call your Nike service inside backend:

Use the code you already have in backend/src/routes/nike.ts (import function or reuse handler logic)

Normalize to NikePrefillResponse

Create slug from title (simple slugify helper)

Return response

1.4 Add slug helper
Create:

backend/src/lib/slug.ts

Export:

slugify(title: string): string

Rules:

lowercase

replace non-alphanumeric with -

collapse multiple -

trim -

1.5 Register route
In backend/src/app.ts (or wherever admin routes are registered):

app.register(prefillRoutes) (ensure correct prefix)
Example expectation:

If admin routes are under /admin, then this route becomes /admin/prefill/nike

1.6 Backend acceptance test
Run backend and test:

curl "http://localhost:<BACKEND_PORT>/admin/prefill/nike?sku=IO9571-400"
Expected:

200 response

thumbnailUrl is a https://static.nike.com/... URL (NOT R2)

galleryImages is array of Nike URLs

PHASE 2 — Admin: API client method
Goal
Admin app can call backend prefill endpoint.

2.1 Add API function
File:

apps/admin/src/lib/api.ts

Add:

getNikePrefill(sku: string): Promise<NikePrefillResponse>

Implementation:

GET /admin/prefill/nike?sku=...

Ensure auth headers/cookies match your existing api.ts patterns

2.2 Quick check
In browser devtools (or temporary test):

getNikePrefill("IO9571-400") returns correct data

PHASE 3 — Admin: ProductsPage button + SKU dialog
Goal
Add a button next to Export CSV. Clicking opens dialog. Submitting navigates to create product page with query params.

3.1 Add button
File:

apps/admin/src/pages/ProductsPage.tsx

Add button near:

Export CSV

Add Product

Button text:

Add Product SKU

3.2 Create dialog component
Create:

apps/admin/src/components/AddProductSkuDialog.tsx

UI:

Dialog title: “Add product by SKU”

Input: SKU (placeholder IO9571-400)

Buttons: Cancel / Continue

On Continue:

navigate("/products/new?prefill=nike&sku=" + encodeURIComponent(sku))

3.3 Wire dialog into ProductsPage
State: open/close

Button opens dialog

3.4 Admin acceptance test
Open Products page

Click Add Product SKU

Enter sku and continue

URL becomes:

/products/new?prefill=nike&sku=IO9571-400

PHASE 4 — Admin: ProductFormPage autofill on load
Goal
When /products/new?prefill=nike&sku=... loads, the form autofills these fields:

Product Title

URL Slug

Description

Variant Name

SKU

Thumbnail image (preview)

Gallery images (preview)

4.1 Read query params
File:

apps/admin/src/pages/ProductFormPage.tsx

Use:

useSearchParams() or useLocation() parsing

Trigger condition:

prefill === "nike" && sku

4.2 Fetch prefill data and set form values
Call:

api.getNikePrefill(sku)

Then set values using react-hook-form:

setValue("title", data.title)

setValue("slug", data.slug)

setValue("description", data.description)

setValue("variants.0.name", data.variantName)

setValue("variants.0.sku", data.sku)

setValue("thumbnailUrl", data.thumbnailUrl) (or your actual field name)

setValue("galleryImages", data.galleryImages) (or your actual field name)

IMPORTANT:

Only run once per SKU (useEffect deps: [prefill, sku])

Don’t override fields if user already typed (optional safety):

Only set if current value is empty

Show loading state while fetching

On error show toast (or alert)

4.3 Admin acceptance test
Visit /products/new?prefill=nike&sku=IO9571-400

Verify:

Title/Slug/Description filled

Variant Name filled

SKU filled

Thumbnail preview visible

Gallery previews visible (grid)

PHASE 5 — “Pre-upload” preview behavior in ImageUpload
Goal
ImageUpload shows previews for URL values without uploading anything.

5.1 Ensure ImageUpload supports URL values
File:

apps/admin/src/components/ImageUpload.tsx

Must support:

Thumbnail: value as string URL

Gallery: value as string[] URLs

Behavior:

If value is URL(s), render <img src="..."> preview(s)

Keep upload dropzone available so admin can override by uploading new images

Provide remove buttons (optional)

5.2 Ensure form fields match ImageUpload props
In ProductFormPage, ensure:

Thumbnail component receives thumbnailUrl value

Gallery component receives galleryImages value

5.3 Acceptance test
Prefill page load shows previews

No network calls to R2 upload endpoints happen during prefill

PHASE 6 — Create Product (Final Save) uses URLs as-is
Goal
When admin clicks Create Product, the existing product create endpoint stores:

title, slug, description

variant name, sku

thumbnailUrl (Nike URL)

galleryImages (Nike URLs)
No uploading to R2.

6.1 Validate backend product create DTO supports URLs
Check backend create product route (likely backend/src/routes/admin/products.ts):

Ensure it accepts thumbnailUrl: string | null

Ensure it accepts galleryImages: string[]

If your DB schema uses a separate ProductImage table:

create rows for each URL instead of storing array

6.2 Acceptance test
Submit Create Product

DB record stores Nike URLs

Storefront can render images from Nike URLs

PHASE 7 — QA Checklist
 ProductsPage shows “Add Product SKU” next to Export CSV

 Dialog opens, validates empty SKU

 Continue navigates to /products/new?prefill=nike&sku=...

 ProductFormPage calls backend prefill

 Form fields autofill correctly

 Thumbnail + gallery previews show without uploading

 Clicking Create Product saves to DB with Nike URLs

 No Cloudflare R2 upload calls happen during prefill

 Error handling shows toast and page doesn’t break

Notes / Future Improvements (optional)
Add checkbox on Create Product:

“Re-host images to R2 on create” (default OFF)

Add caching on backend prefill (SKU → response) for 10 min

Add duplicate SKU detection before creating variant


