# Final Nike Description Split + Modal “View Product Details”.md
## Goal
Nike API-аас ирж буй урт `description` текстийг **3 хэсэг** болгон задлаад:
1) **Short Description** → product page дээр шууд харагдана  
2) **Benefits** → “View Product Details” товч дархад Modal дотор list хэлбэрээр гарна  
3) **Product Details** → мөн Modal дотор гарна

✅ **Анхаарах:** Энэ хувилбар дээр **Cloudflare R2 upload хийхгүй**. Зураг бол Nike URL-ээрээ (hotlink) явна.

---

## Current UI (given)
Store product page дээр одоо description урт нэг мөрөөр харагдаж байна. Үүнийг:
- Дээд хэсэгт: **богино description**
- Доор: **“View Product Details”** товч
- Товч дархад: **Modal Dialog** (Nike шиг) нээгдэж Benefits + Product Details гарна
гэдэг болгож шинэчилнэ.

---

# Architecture (recommended)
## Backend (source of truth)
Backend дээр Nike description parsing хийгээд store/admin-д **structured** өгөгдөл өгнө:

```ts
type NikeParsed = {
  shortDescription: string;
  benefits: string[];
  productDetails: string[];
};
DB (optional but recommended)
Product хадгалахдаа:

description = shortDescription

benefits = string[]

productDetails = string[]
гээд хадгална.

Хэрвээ одоохондоо DB schema өөрчлөхгүй бол store талд runtime parse хийж болно (гэхдээ backend parse нь илүү зөв).

Implementation Plan
PHASE 1 — Backend: parseNikeDescription helper
1.1 New file
Create:

backend/src/lib/parseNikeDescription.ts

1.2 Implementation requirements
“Benefits”, “Product Details” гэсэн heading-үүдийг case-insensitive танина

• bullet тэмдэгүүдийг арилгана

Empty мөрүүдийг үл тооно

Heading байхгүй тохиолдолд:

shortDescription = raw.trim()

benefits = []

productDetails = []

Output
export type ParsedNikeDescription = {
  shortDescription: string;
  benefits: string[];
  productDetails: string[];
};

export function parseNikeDescription(raw: string): ParsedNikeDescription;
PHASE 2 — Backend: nike.ts дээр parsing нэмэх
2.1 Remove undici
Хэрвээ import { fetch } from "undici" байвал устгана.
Node 18+ дээр global fetch ашиглана.

2.2 Update response shape
backend/src/routes/nike.ts дээр:

Nike API-с ирсэн description-ийг parse хийж:

shortDescription

benefits

productDetails
гээд response-д нэмнэ.

Backward compatibility (important)
Хэрвээ frontend/admin чинь одоогоор description field-ээс хамааралтай байвал:

description = shortDescription гэж хадгал (хуучин field name-ээ эвдэхгүй).

Recommended response:

{
  "sku": "...",
  "title": "...",
  "description": "...",        // shortDescription
  "shortDescription": "...",
  "benefits": ["..."],
  "productDetails": ["..."],
  "thumbnail": "https://static.nike.com/...",
  "gallery_images": ["https://static.nike.com/..."]
}
PHASE 3 — Backend: Prefill endpoint (if used) to return structured fields
Хэрвээ чи admin prefill ашиглаж байгаа бол:

/admin/prefill/nike?sku=...
response дээр:

description → shortDescription

benefits

productDetails
гэдгийг нэм.

Note: зураг re-host хийхгүй, Nike URL буцаана.

PHASE 4 — DB schema update (optional but recommended)
Option A: Postgres array
benefits       String[] @default([])
productDetails String[] @default([])
Option B: JSON fallback
benefits       Json @default("[]")
productDetails Json @default("[]")
Then migrate:

npx prisma migrate dev -n add_benefits_productDetails

Update create/update endpoints to accept these fields (optional).

PHASE 5 — Store: Product Page UI changes (Short desc + Modal)
5.1 Product page shows short description only
Store product detail component дээр:

product.description (shortDescription) л харуулна

5.2 Add “View Product Details” button
Description-ийн доор:

Button: View Product Details

On click:

open modal dialog

5.3 Modal content
Modal-д харуулах мэдээлэл:

Product title + price (header)

Benefits section:

product.benefits list

Product Details section:

product.productDetails list

Close button (X), ESC/backdrop close

Fallback:

benefits/details хоёулаа empty бол:

“No additional details available.”

UI guideline (Nike-like)
Modal background overlay dim

Card: rounded, white/clean

Header: thumbnail + title + price (optional)

PHASE 6 — Data wiring (types + API)
6.1 Product type update in store
Update TypeScript type used by store product page to include:

benefits: string[];
productDetails: string[];
shortDescription?: string;
6.2 Ensure product API includes these fields
If store fetches from your backend DB: ensure DB returns benefits/productDetails

If store fetches Nike route directly: ensure nike.ts response includes those fields

Mapping rules:

description already equals shortDescription (safe)

Prefer benefits and productDetails from API

Use [] defaults to avoid runtime errors

Acceptance Criteria (QA checklist)
 Product page description is short (no “Benefits” text inside)

 “View Product Details” button appears

 Clicking button opens modal

 Modal shows Benefits list

 Modal shows Product Details list

 Close button works, ESC works, backdrop click works

 No R2 upload occurs at any step

 If benefits/details missing, modal shows fallback message