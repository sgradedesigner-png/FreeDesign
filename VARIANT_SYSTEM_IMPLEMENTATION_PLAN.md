# Full Product Variant System Implementation Plan
## Nike-style Variant System with Images

---

## Тойм (Overview)

Энэ төлөвлөгөө нь өнгөний дугуй оронд variant зургууд (thumbnail swatch) харуулах, Nike шиг бүрэн variant систем хэрэгжүүлэх дэлгэрэнгүй гарын авлага юм.

**Гол өөрчлөлтүүд:**
- ✅ Бүтээгдэхүүн бүр олон variant-тай болно
- ✅ Variant бүр өөрийн зураг, нэр, SKU, үнэ, stock-тай
- ✅ Admin дээр variant бүрийг тусдаа удирдах
- ✅ Store дээр variant зургийг thumbnail-аар харуулах
- ✅ Variant сонгоход үндсэн зураг солигдоно

---

## 1. Database Schema Өөрчлөлтүүд

### 1.1. Шинэ Prisma Schema

```prisma
// backend/prisma/schema.prisma

model Product {
  id                String    @id @default(cuid())
  title             String
  slug              String    @unique
  description       String?
  category_id       String?
  category          Category? @relation(fields: [category_id], references: [id])

  // Үндсэн мэдээлэл
  base_price        Float     @default(0)

  // УСТГАХ: Эдгээр талбаруудыг VARIANTS руу шилжүүлнэ
  // price             Float     @default(0)
  // originalPrice     Float?
  // colors            String[]  @default([])
  // sizes             String[]  @default([])
  // image_path        String?
  // gallery_paths     String[]  @default([])

  // Шинэ хамаарал
  variants          ProductVariant[]

  // Бусад
  rating            Float     @default(0)
  reviews           Int       @default(0)
  features          String[]  @default([])
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
}

model ProductVariant {
  id                String   @id @default(cuid())
  product_id        String
  product           Product  @relation(fields: [product_id], references: [id], onDelete: Cascade)

  // Variant мэдээлэл
  name              String   // e.g., "Black/Red", "Ocean Blue", "Sunset Orange"
  sku               String   @unique // e.g., "SHOE-BLK-41", "SHOE-WHT-42"

  // Үнэ (variant бүр өөр үнэтэй байж болно)
  price             Float
  originalPrice     Float?

  // Хэмжээ (энэ variant-д байгаа хэмжээнүүд)
  sizes             String[] @default([]) // e.g., ["41", "42", "43"]

  // Зураг
  image_path        String   // Үндсэн зураг (thumbnail-д харагдах)
  gallery_paths     String[] @default([]) // Дэлгэрэнгүй зургууд

  // Stock удирдлага (нэмэлт санаа)
  stock             Int      @default(0)
  is_available      Boolean  @default(true)

  // Дараалал
  sort_order        Int      @default(0)

  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  @@index([product_id])
}
```

### 1.2. Migration Strategy

```bash
# 1. Шинэ migration үүсгэх
cd backend
npx prisma migrate dev --name add_product_variants

# 2. Өгөгдөл шилжүүлэх script бичих (data migration)
# Одоогийн products-ийг variants руу хувиргах
```

### 1.3. Data Migration Script Example

```typescript
// backend/scripts/migrate-to-variants.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateProductsToVariants() {
  const products = await prisma.product.findMany();

  for (const product of products) {
    // Хэрвээ colors байвал, өнгө бүрээр variant үүсгэнэ
    if (product.colors && product.colors.length > 0) {
      for (let i = 0; i < product.colors.length; i++) {
        const color = product.colors[i];

        await prisma.productVariant.create({
          data: {
            product_id: product.id,
            name: color,
            sku: `${product.slug}-${color.toLowerCase()}-${i}`,
            price: product.price,
            originalPrice: product.originalPrice || null,
            sizes: product.sizes || [],
            image_path: product.image_path || '',
            gallery_paths: product.gallery_paths || [],
            stock: 100, // Default stock
            is_available: true,
            sort_order: i,
          },
        });
      }
    } else {
      // Өнгөгүй бол нэг default variant үүсгэнэ
      await prisma.productVariant.create({
        data: {
          product_id: product.id,
          name: 'Default',
          sku: `${product.slug}-default`,
          price: product.price,
          originalPrice: product.originalPrice || null,
          sizes: product.sizes || [],
          image_path: product.image_path || '',
          gallery_paths: product.gallery_paths || [],
          stock: 100,
          is_available: true,
          sort_order: 0,
        },
      });
    }
  }

  console.log('✅ Migration completed!');
}

migrateProductsToVariants()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 2. Backend API Өөрчлөлтүүд

### 2.1. Product Routes Update

```typescript
// backend/src/routes/admin/products.ts

// GET /admin/products - Variants-тай хамт татах
router.get('/', async (req, res) => {
  const products = await prisma.product.findMany({
    include: {
      variants: {
        orderBy: { sort_order: 'asc' },
      },
      category: true,
    },
  });
  res.json(products);
});

// GET /admin/products/:id - Нэг product variants-тай
router.get('/:id', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      variants: {
        orderBy: { sort_order: 'asc' },
      },
      category: true,
    },
  });
  res.json(product);
});

// POST /admin/products - Variants-тай product үүсгэх
const createProductSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  category_id: z.string().optional(),
  base_price: z.number().default(0),
  variants: z.array(z.object({
    name: z.string(),
    sku: z.string(),
    price: z.number(),
    originalPrice: z.number().optional(),
    sizes: z.array(z.string()).default([]),
    image_path: z.string(),
    gallery_paths: z.array(z.string()).default([]),
    stock: z.number().default(0),
    sort_order: z.number().default(0),
  })).min(1), // Хамгийн багадаа 1 variant шаардлагатай
});

router.post('/', async (req, res) => {
  const body = createProductSchema.parse(req.body);

  const product = await prisma.product.create({
    data: {
      title: body.title,
      slug: body.slug,
      description: body.description,
      category_id: body.category_id,
      base_price: body.base_price,
      variants: {
        create: body.variants,
      },
    },
    include: {
      variants: true,
    },
  });

  res.json(product);
});

// PUT /admin/products/:id - Variants-тай хамт шинэчлэх
router.put('/:id', async (req, res) => {
  const body = createProductSchema.parse(req.body);

  // Өмнөх variants-г устгаад шинийг нь үүсгэнэ
  await prisma.productVariant.deleteMany({
    where: { product_id: req.params.id },
  });

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      title: body.title,
      slug: body.slug,
      description: body.description,
      category_id: body.category_id,
      base_price: body.base_price,
      variants: {
        create: body.variants,
      },
    },
    include: {
      variants: true,
    },
  });

  res.json(product);
});
```

### 2.2. Variant-specific Routes (нэмэлт)

```typescript
// backend/src/routes/admin/variants.ts

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /admin/variants/:id - Нэг variant
router.get('/:id', async (req, res) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: req.params.id },
    include: { product: true },
  });
  res.json(variant);
});

// PUT /admin/variants/:id - Variant шинэчлэх
router.put('/:id', async (req, res) => {
  const variant = await prisma.productVariant.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(variant);
});

// DELETE /admin/variants/:id - Variant устгах
router.delete('/:id', async (req, res) => {
  await prisma.productVariant.delete({
    where: { id: req.params.id },
  });
  res.json({ success: true });
});

export default router;
```

---

## 3. Admin Panel Өөрчлөлтүүд

### 3.1. ProductFormPage Update

```typescript
// apps/admin/src/pages/ProductFormPage.tsx

type VariantFormData = {
  id?: string; // Edit үед хэрэгтэй
  name: string;
  sku: string;
  price: number;
  originalPrice?: number;
  sizes: string[];
  image_path: string;
  gallery_paths: string[];
  stock: number;
  sort_order: number;
};

type ProductFormData = {
  title: string;
  slug: string;
  description?: string;
  category_id?: string;
  base_price: number;
  variants: VariantFormData[];
};

export default function ProductFormPage() {
  const [variants, setVariants] = useState<VariantFormData[]>([
    {
      name: '',
      sku: '',
      price: 0,
      sizes: [],
      image_path: '',
      gallery_paths: [],
      stock: 0,
      sort_order: 0,
    },
  ]);

  // Variant нэмэх
  const addVariant = () => {
    setVariants([
      ...variants,
      {
        name: '',
        sku: '',
        price: 0,
        sizes: [],
        image_path: '',
        gallery_paths: [],
        stock: 0,
        sort_order: variants.length,
      },
    ]);
  };

  // Variant устгах
  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  // Variant зураг upload
  const handleVariantImageUpload = async (index: number, file: File) => {
    // 1. Presigned URL авах
    const { uploadUrl, finalUrl } = await getPresignedUrl(file.name);

    // 2. R2 руу upload
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    // 3. Variant image_path шинэчлэх
    const updatedVariants = [...variants];
    updatedVariants[index].image_path = finalUrl;
    setVariants(updatedVariants);
  };

  return (
    <div>
      <h1>Product Information</h1>

      {/* Basic Fields */}
      <input name="title" placeholder="Product Title" />
      <input name="slug" placeholder="Slug" />
      <textarea name="description" placeholder="Description" />
      <input name="base_price" type="number" placeholder="Base Price" />

      {/* Variants Section */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Product Variants</h2>

        {variants.map((variant, index) => (
          <div key={index} className="border p-4 mb-4 rounded">
            <h3 className="font-semibold mb-2">Variant {index + 1}</h3>

            {/* Variant Name */}
            <input
              value={variant.name}
              onChange={(e) => {
                const updated = [...variants];
                updated[index].name = e.target.value;
                setVariants(updated);
              }}
              placeholder="Variant Name (e.g., Black/Red)"
            />

            {/* SKU */}
            <input
              value={variant.sku}
              onChange={(e) => {
                const updated = [...variants];
                updated[index].sku = e.target.value;
                setVariants(updated);
              }}
              placeholder="SKU (e.g., SHOE-BLK-41)"
            />

            {/* Price */}
            <input
              type="number"
              value={variant.price}
              onChange={(e) => {
                const updated = [...variants];
                updated[index].price = parseFloat(e.target.value);
                setVariants(updated);
              }}
              placeholder="Price"
            />

            {/* Image Upload */}
            <div className="mt-2">
              <label>Variant Image (Thumbnail)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVariantImageUpload(index, file);
                }}
              />
              {variant.image_path && (
                <img src={variant.image_path} alt="Preview" className="w-20 h-20 mt-2" />
              )}
            </div>

            {/* Sizes */}
            <div className="mt-2">
              <label>Sizes</label>
              <input
                value={variant.sizes.join(', ')}
                onChange={(e) => {
                  const updated = [...variants];
                  updated[index].sizes = e.target.value.split(',').map(s => s.trim());
                  setVariants(updated);
                }}
                placeholder="Sizes (comma separated: 41, 42, 43)"
              />
            </div>

            {/* Stock */}
            <input
              type="number"
              value={variant.stock}
              onChange={(e) => {
                const updated = [...variants];
                updated[index].stock = parseInt(e.target.value);
                setVariants(updated);
              }}
              placeholder="Stock"
            />

            {/* Remove Variant Button */}
            {variants.length > 1 && (
              <button onClick={() => removeVariant(index)} className="mt-2 text-red-500">
                Remove Variant
              </button>
            )}
          </div>
        ))}

        <button onClick={addVariant} className="bg-primary text-white px-4 py-2 rounded">
          + Add Variant
        </button>
      </div>

      {/* Submit */}
      <button type="submit">Save Product</button>
    </div>
  );
}
```

---

## 4. Store Frontend Өөрчлөлтүүд

### 4.1. Product Type Update

```typescript
// apps/store/src/data/types.ts

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: number;
  originalPrice?: number;
  sizes: string[];
  image_path: string;
  gallery_paths: string[];
  stock: number;
  is_available: boolean;
  sort_order: number;
};

export type Product = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  category: string;
  base_price: number;
  variants: ProductVariant[]; // Шинэ
  rating: number;
  reviews: number;
  features: string[];

  // DEPRECATED - Compatibility layer
  // Эдгээр талбаруудыг first variant-аас авна
  get name(): string; // = title
  get price(): number; // = variants[0].price
  get colors(): string[]; // = variants.map(v => v.name)
  get sizes(): string[]; // = selected variant.sizes
  get image_path(): string; // = selected variant.image_path
  get gallery_paths(): string[]; // = selected variant.gallery_paths
};
```

### 4.2. ProductInfo Component - Variant Selector

```typescript
// apps/store/src/components/product/ProductInfo.tsx

export default function ProductInfo({ product }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [selectedSize, setSelectedSize] = useState(selectedVariant.sizes[0] ?? '');

  return (
    <div>
      {/* Product Title */}
      <h1>{product.title}</h1>

      {/* Price from selected variant */}
      <div className="text-3xl font-bold">${selectedVariant.price.toFixed(2)}</div>

      {/* Variant Selector (Thumbnail Images) */}
      <div className="mt-6">
        <label className="text-sm font-bold mb-3 block">Color / Style</label>
        <div className="flex gap-3">
          {product.variants.map((variant) => (
            <button
              key={variant.id}
              onClick={() => {
                setSelectedVariant(variant);
                setSelectedSize(variant.sizes[0] ?? '');
              }}
              className={`relative w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${
                selectedVariant.id === variant.id
                  ? 'border-primary ring-2 ring-primary/20 scale-110'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <img
                src={variant.image_path}
                alt={variant.name}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Selected: {selectedVariant.name}
        </p>
      </div>

      {/* Size Selector (from selected variant) */}
      <div className="mt-6">
        <label className="text-sm font-bold mb-3 block">Size</label>
        <div className="flex gap-2 flex-wrap">
          {selectedVariant.sizes.map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`px-5 py-2.5 rounded-xl border ${
                selectedSize === size
                  ? 'border-primary bg-primary text-white'
                  : 'border-border hover:border-primary'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Info */}
      {selectedVariant.stock > 0 ? (
        <p className="text-green-600 text-sm mt-2">In Stock ({selectedVariant.stock} available)</p>
      ) : (
        <p className="text-red-600 text-sm mt-2">Out of Stock</p>
      )}

      {/* Add to Cart */}
      <button
        onClick={() => addToCart(product, selectedVariant, selectedSize)}
        disabled={selectedVariant.stock === 0}
        className="mt-6 w-full bg-primary text-white py-3 rounded-xl"
      >
        ADD TO CART
      </button>
    </div>
  );
}
```

### 4.3. ProductGallery Component Update

```typescript
// apps/store/src/components/product/ProductGallery.tsx

export default function ProductGallery({
  product,
  selectedVariant
}: {
  product: Product;
  selectedVariant: ProductVariant;
}) {
  // Selected variant-н зургуудыг харуулна
  const images = selectedVariant.gallery_paths?.length
    ? selectedVariant.gallery_paths
    : [selectedVariant.image_path];

  const [activeImage, setActiveImage] = useState(images[0]);

  // Variant солигдоход зургийг шинэчлэх
  useEffect(() => {
    const newImages = selectedVariant.gallery_paths?.length
      ? selectedVariant.gallery_paths
      : [selectedVariant.image_path];
    setActiveImage(newImages[0]);
  }, [selectedVariant.id]);

  return (
    <div className="flex gap-4">
      {/* Thumbnails */}
      <div className="flex flex-col gap-4">
        {images.map((img, idx) => (
          <button
            key={idx}
            onClick={() => setActiveImage(img)}
            className={`w-20 h-20 border-2 rounded ${
              activeImage === img ? 'border-primary' : 'border-border'
            }`}
          >
            <img src={img} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Main Image */}
      <div className="flex-1">
        <img src={activeImage} alt={product.title} className="w-full aspect-square object-cover rounded-2xl" />
      </div>
    </div>
  );
}
```

---

## 5. Алхам дараалал (Step-by-Step Implementation)

### Phase 1: Database & Backend (1-2 өдөр)

1. ✅ Prisma schema шинэчлэх (`ProductVariant` model нэмэх)
2. ✅ Migration үүсгэх: `npx prisma migrate dev --name add_product_variants`
3. ✅ Data migration script бичих (одоогийн products → variants)
4. ✅ Backend API шинэчлэх (variants дэмжих)
5. ✅ Variant CRUD endpoints нэмэх
6. ✅ Тест хийх (Postman/Thunder Client)

### Phase 2: Admin Panel (2-3 өдөр)

1. ✅ ProductFormPage дээр variant section нэмэх
2. ✅ Variant бүрт зураг upload хийх функц
3. ✅ Variant нэмэх/хасах/засах
4. ✅ Product list дээр variants харуулах
5. ✅ Form validation
6. ✅ Testing

### Phase 3: Store Frontend (2-3 өдөр)

1. ✅ Product type шинэчлэх
2. ✅ ProductInfo дээр variant thumbnail selector нэмэх
3. ✅ ProductGallery шинэчлэх (selected variant-н зургууд)
4. ✅ Cart system шинэчлэх (variant мэдээлэл хадгалах)
5. ✅ Product list/catalog дээр default variant харуулах
6. ✅ Responsive design
7. ✅ Testing

### Phase 4: Migration & Deployment (1 өдөр)

1. ✅ Production database backup
2. ✅ Data migration ажиллуулах
3. ✅ Regression testing
4. ✅ Deploy to production
5. ✅ Monitor for issues

---

## 6. Нэмэлт Features (Optional)

### 6.1. Variant Combination Matrix

Хэрвээ өнгө БА хэмжээ хоёулаа variant болгох бол:
- Өнгө: Black, Blue, White
- Хэмжээ: 41, 42, 43
- = 9 variant (Black-41, Black-42, Black-43, Blue-41, ...)

### 6.2. Bulk Variant Creation

Admin дээр "Generate Variants" товч нэмж, өнгө болон хэмжээний бүх хослолыг автоматаар үүсгэх.

### 6.3. Variant-specific Pricing

Variant бүр өөр үнэтэй байх (жишээ: том хэмжээ илүү үнэтэй).

### 6.4. Low Stock Alert

Stock < 5 бол admin panel дээр анхааруулга харуулах.

---

## 7. Testing Checklist

### Backend
- [ ] Product variants-тай үүсгэх API test
- [ ] Variant update/delete API test
- [ ] Data migration test (local)
- [ ] Variant image upload test

### Admin Panel
- [ ] Product үүсгэх (олон variants)
- [ ] Variant нэмэх/хасах
- [ ] Зураг upload
- [ ] Form validation
- [ ] Edit existing product with variants

### Store
- [ ] Variant selector харагдах
- [ ] Variant сонгоход зураг солигдох
- [ ] Price update variant бүрд
- [ ] Size selector variant дээр үндэслэх
- [ ] Cart-д зөв variant хадгалагдах
- [ ] Product list дээр variant thumbnails

---

## 8. Rollback Plan

Хэрвээ асуудал гарвал:

1. Database backup-аас сэргээх
2. Хуучин код руу git revert
3. Prisma migration буцаах: `npx prisma migrate resolve --rolled-back <migration_name>`

---

## 9. Estimated Timeline

- **Phase 1 (Backend):** 1-2 өдөр
- **Phase 2 (Admin):** 2-3 өдөр
- **Phase 3 (Store):** 2-3 өдөр
- **Phase 4 (Migration/Deploy):** 1 өдөр

**Total: 6-9 өдөр** (өдөрт 4-6 цаг ажиллавал)

---

## 10. Resources

- Prisma Docs: https://www.prisma.io/docs
- Cloudflare R2 Upload: https://developers.cloudflare.com/r2/
- React Hook Form: https://react-hook-form.com/
- Nike Product Page (reference): Nike.com

---

**Анхаарал:** Энэ том өөрчлөлт учир development branch дээр эхлээд хийж, бүрэн test хийсний дараа production руу merge хийх хэрэгтэй!

**Next Steps:**
1. Development branch үүсгэх: `git checkout -b feature/variant-system`
2. Phase 1-ээс эхлэх
3. Phase бүрийг дуусгасны дараа commit хийх
4. Эцэст нь master руу PR үүсгэж merge хийх
