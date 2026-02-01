# Database Migration Summary

## Огноо: 2026-02-01

## Зорилго
Store app-г Nicroni's Project Supabase database-с EcommerceAdmin Supabase database руу шилжүүлэх.

---

## ✅ Хийгдсэн Өөрчлөлтүүд

### 1. Store App Code Changes

#### `apps/store/src/data/types.ts`
- ✅ `BackendProduct` type нэмэгдсэн (Backend schema-тай нийцтэй)
- ✅ `EcommerceProduct` type үлдээсэн (legacy support)

#### `apps/store/src/data/products.ts`
- ✅ `mapProductFromBackend()` mapper нэмэгдсэн
- ✅ Backend schema (title, images[], category relation) дэмжих боломжтой болсон
- ✅ `mapProductFromDb()` legacy mapper үлдээсэн

#### `apps/store/src/data/products.api.ts`
- ✅ `products` table-с өгөгдөл татах (өмнө: `ecommerce_product`)
- ✅ `categories` join хийх
- ✅ `mapProductFromBackend()` ашиглана

### 2. Environment Configuration

#### `apps/store/.env`
```diff
- VITE_SUPABASE_URL=https://tvgbcyomqcsnwkjebumv.supabase.co
- VITE_SUPABASE_ANON_KEY=eyJhbG...
+ VITE_SUPABASE_URL=https://miqlyriefwqmutlsxytk.supabase.co
+ VITE_SUPABASE_ANON_KEY=sb_publishable_sC8MYE4uSs5Ky02qKOZpYQ_qM90UmUZ
```

R2_PUBLIC_BASE_URL хэвээр үлдсэн (зургууд R2 дээр хэвээр байна).

### 3. Migration Script

#### `migration-script.ts`
- ✅ Nicroni's Project-с өгөгдөл export хийх
- ✅ `backup-nicroni-products.json` нөөцлөлт үүсгэх
- ✅ Schema трансформ хийх (ecommerce_product → products)
- ✅ Категори үүсгэх эсвэл олох
- ✅ EcommerceAdmin database-д import хийх
- ✅ Үр дүнгийн тайлан гаргах

---

## 🔄 Database Schema Mapping

| Old Schema (ecommerce_product) | New Schema (products) | Тэмдэглэл |
|--------------------------------|----------------------|-----------|
| `uuid` | `id` | Primary key болсон |
| `name` | `title` | Нэр өөрчлөгдсөн |
| `category` (string) | `categoryId` → `categories.name` | Relation болсон |
| `image_path` + `gallery_paths[]` | `images[]` | Нэгдсэн array |
| `price` | `price` | Decimal type |
| `description` | `description` | Хэвээр |
| `slug` | `slug` | Хэвээр |
| - | `stock` | Шинэ field (default: 100) |
| `original_price` | - | Backend schema-д байхгүй |
| `rating` | - | Backend-д reviews систем хараахан байхгүй |
| `reviews` | - | Backend-д reviews систем хараахан байхгүй |
| `sizes[]` | - | Backend schema-д байхгүй (цаашид нэмнэ) |
| `colors[]` | - | Backend schema-д байхгүй (цаашид нэмнэ) |
| `features[]` | - | Backend schema-д байхгүй (цаашид нэмнэ) |
| `is_new` | `createdAt` < 30 хоног | Тооцоолох логик ашиглана |

---

## 🚀 Migration Ажиллуулах Дараалал

### Бэлтгэл
```bash
# 1. Dependencies суулгах
npm install --save-dev @supabase/supabase-js tsx @types/node

# 2. Backend Prisma migration
cd backend
npx prisma migrate dev --name add_products_and_categories
npx prisma generate
cd ..
```

### Migration
```bash
# 3. Өгөгдөл шилжүүлэх
npx tsx migration-script.ts
```

### Тест
```bash
# 4. Store app ажиллуулах
cd apps/store
npm run dev
```

Browser-с `http://localhost:5173` руу орж шалгах.

---

## ⚠️ Санамж

1. **Backup**: Migration script автоматаар `backup-nicroni-products.json` үүсгэнэ
2. **Nicroni's Project**: Migration дууссаны дараа ч Nicroni's Project өгөгдөл хэвээр үлдэнэ (устахгүй)
3. **Rollback**: Хэрэв асуудал гарвал `.env` файлыг буцааж засаад хуучин код дээрээ буцаж болно
4. **Images**: R2 зургууд хэвээр үлдэх (шилжүүлэх шаардлагагүй)

---

## 📊 Үр Дүн

Migration амжилттай болсны дараа:
- ✅ Store app EcommerceAdmin database ашиглана
- ✅ Admin панелаас нэмсэн бүтээгдэхүүн store app дээр шууд харагдана
- ✅ Backend API store app-тай нэгтгэх боломжтой болно
- ✅ Нэг database, нэг schema - илүү сайн удирдлага

---

## 🔮 Цаашдын Хөгжүүлэлт

1. **Reviews System**: Backend-д rating/reviews table нэмэх
2. **Product Variants**: Backend-д sizes, colors, features нэмэх
3. **Stock Management**: Store app дээр stock харуулах
4. **API Integration**: Store app-г backend API ашиглуулах (Supabase client биш)

---

## 👤 Migration Хийсэн
Claude Code - 2026-02-01

## 📞 Асуудал Гарвал
Migration script дахин ажиллуулж болно. Давхардлаас сэргийлэх логик (slug unique constraint) байгаа.
