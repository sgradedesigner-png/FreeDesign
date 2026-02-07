# FrontEndStorePublicRead.md

## Зорилго
Front Store нь backend-ээр дамжихгүйгээр Supabase Postgres-оос **public catalog** датагаа шууд (anon key) уншдаг болно.

- Store: Supabase views (`v_products_public_list`, `v_product_variants_public`) + categories (public)
- Admin: Product Create/Edit дээр `is_published`-ийг **Toggle switch**-ээр удирдана (Draft/Published).
- Backend: Admin CRUD хэвээр (Prisma + routes). `is_published`-ийг create/update payload-оор хүлээж авдаг болно.
- DB: RLS + policies + views already set (verify only; do not recreate unless missing).

## Орчны бодит байдал (repo audit дээр суурилсан)
- Store/Admin нь Supabase-г Auth дээр ашиглаж байна.
- Store/Admin data access нь одоогоор backend REST endpoints ашигладаг.
- DB дээр `public.products` column-ууд: `title`, `slug`, `description`, `categoryId`, `basePrice`, `rating`, `reviews`, `features`, `benefits`, `productDetails`, `createdAt`, `updatedAt`, мөн шинээр `is_published` нэмсэн.
- `public.product_variants` column-ууд: `productId`, `name`, `sku`, `price`, `originalPrice`, `sizes`, `imagePath`, `galleryPaths`, `stock`, `isAvailable`, `sortOrder`, `createdAt`.

## DB тал (зөвхөн шалгалт/баталгаажуулалт)
### Шаардлагатай объектууд
DB дээр дараахууд байх ёстой:
- Column: `public.products.is_published boolean default false`
- RLS: products/categories/product_variants дээр enable
- Policies:
  - products: public select only where is_published=true
  - variants: public select only where product is_published=true
  - categories: public select
  - public writes (insert/update/delete) blocked on these tables
   - Хэрвээ Prisma field нь `isPublished` бол `@map("is_published")` байх ёстой.
   - Prisma field нь шууд `is_published` байж болно.
2. `backend/src/routes/products.ts` (эсвэл эквивалент route) дээр create/update handler payload schema/validation хэсэгт `is_published?: boolean` нэмэх.
3. Prisma create/update дээр тухайн field-ийг map хийж хадгалах.

### 2) Admin: Product Create/Edit form дээр Toggle switch нэмэх
#### UI шаардлага
- Toggle label: `Published`
- Toggle ON => `true`, OFF => `false`
- New Product default: OFF (false)
- Edit Product дээр одоо байгаа утгыг preload хийж ON/OFF болгоно
- Product list дээр Published status-ийг:
  - Toggle биш, текст/Badge байдлаар: `Published` / `Draft` (эсвэл Yes/No) харуулж болно

#### Компонент
Хэрвээ shadcn/ui ашиглаж байгаа бол `Switch` ашиглана:
- `import { Switch } from "@/components/ui/switch"`
- `checked={published}`
- `onCheckedChange={setPublished}`

#### Payload нэршил
API payload дээр `is_published`-ийг ашиглана (snake_case) — backend үүнийг хүлээж авна.
Хэрвээ admin codebase нь camelCase ашигладаг бол request body дээр map хийж `is_published` болгон явуул.

### 3) Store: Backend API-аас биш Supabase views-ээс уншдаг болгох
#### Шаардлага
- Product list:
  - `from("v_products_public_list")`
- Product detail:
  - slug-аар `.eq("slug", slug).single()`
- Variants:
  - `from("v_product_variants_public").eq("productId", productId).order("sortOrder")`
- Categories:
  - `from("categories").select(...)` (public select policy байгаа гэж үзнэ)

#### Миграци хийх файлууд (repo-аас олж зөв газарт нь зас)
- `apps/store/src/data/products.api.ts` → Supabase read рүү шилжүүлэх
- `apps/store/src/data/categories.api.ts` → Supabase read рүү шилжүүлэх
- Product detail page/service → Supabase read рүү шилжүүлэх
- Variant fetch logic → Supabase read рүү шилжүүлэх

#### Үнэ гаргалт (existing logic-ийг хадгал)
- Variant байгаа бол `variant.price` / `variant.originalPrice`
- Variant байхгүй бол `product.basePrice` fallback

#### Image URL
- Variant дээр `imagePath`, `galleryPaths` нь R2 public URL-тай join хийх хэрэгтэй байж магадгүй.
- Store дээр байгаа `r2Url(...)` helper-ийг үргэлжлүүлэн ашигла.

## Acceptance Criteria (гар ажиллагаатай тест)
### Admin
1) Admin Login OK
2) Create Product:
   - Published toggle OFF → save → DB дээр `is_published=false`
3) Edit Product:
   - Toggle ON → save → DB дээр `is_published=true`
4) Product list:
   - Published/Draft status зөв харагдана

### Store
1) Store Home бүтээгдэхүүнүүд харагдана (Supabase views-ээс)
2) Published=false бүтээгдэхүүн Store дээр харагдахгүй
3) Published=true бүтээгдэхүүн Store дээр харагдана
4) Product detail дээр features/benefits/productDetails list дээр харагдана
5) Variant pricing:
   - variant байвал price/originalPrice зөв
   - variant байхгүй бол basePrice зөв

## Codex Instructions (шууд ажиллуулах)
You are Codex. Implement the spec in this repo.

### Required output
- Provide a list of changed files with explanation
- Provide key code diffs/snippets
- Ensure TypeScript types compile
- Do not invent files; use existing project structure

### Steps
1) Find existing Product form in Admin (ProductFormPage.tsx or similar) and add `Published` Switch with default false on create and prefilled on edit.
2) Ensure Admin API client sends `is_published` boolean.
3) Update backend product routes + validation + prisma writes to accept/store `is_published`.
4) Update Store data fetching to read from Supabase views:
   - `v_products_public_list`
   - `v_product_variants_public`
   - `categories`
5) Keep price logic and image URL logic intact.
6) Provide manual test checklist.
