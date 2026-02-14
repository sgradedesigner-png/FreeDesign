DTF Хэвлэлийн Платформ руу Шилжүүлэх — Дэлгэрэнгүй Тайлан & Хэрэгжүүлэлтийн Төлөвлөгөө
Шинэчлэлт (2026-02-13): Cloudflare R2 → Cloudinary руу бүрэн шилжсэн. Backend 
.env
-д Cloudinary key-үүд бэлэн.

0. Pre-Requisite: R2 → Cloudinary Шилжилт
CAUTION

Одоогийн codebase нь R2 (S3-compatible) дээр бүрэн суурилсан. Cloudinary key-үүд 
.env
-д нэмэгдсэн ч R2 код хэвээр байна — backend эхлэхэд 
env.ts
 validation fail болно. DTF feature-ийг хэрэгжүүлэхээс өмнө энэ шилжилтийг дуусгах хэрэгтэй.

0.1 Одоогийн R2 Хэрэглээний Бүтэн Газрын Зураг
#	Файл	Хэрэглэж буй R2 функц	Нөлөөлөл
1	
r2.ts
uploadToR2()
, 
uploadProductImage()
, 
deleteFromR2()
, 
deleteR2Folder()
🔴 Backend core — бүрэн Cloudinary-аар солих
2	
r2-presigned.ts
generatePresignedUploadUrl()
, 
generatePresignedPost()
, 
generateProductImageUploadUrl()
🔴 Устгах — Cloudinary signed upload-аар солих
3	
remote-image-import.ts
importRemoteImageToR2()
, 
isR2PublicUrl()
🔴 importRemoteImageToCloudinary()-аар солих
4	
env.ts (backend)
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL validation	🔴 Cloudinary env-аар солих
5	
upload.ts
uploadProductImage()
 from r2.ts	🟡 Import-ыг cloudinary.ts-аас солих
6	
upload-presigned.ts
generateProductImageUploadUrl()
 from r2-presigned.ts	🟡 Cloudinary signed upload-аар солих
7	
products.ts (admin)
deleteR2Folder()
, 
deleteFromR2()
 from r2.ts	🟡 Cloudinary delete-аар солих
8	
test-r2.ts
R2 test file	🟢 Устгах/Cloudinary test-аар солих
9	
test-presigned.ts
R2 presigned test	🟢 Устгах
10	
r2.ts (store)
r2Url()
 helper — зураг URL prefix нэмнэ	🔴 imageUrl() helper-аар солих
11	
env.ts (store)
VITE_R2_PUBLIC_BASE_URL required + env.R2_PUBLIC_BASE_URL	🔴 Устгах (Cloudinary full URL буцаадаг)
12	Store components (7+ файл)	
r2Url(imagePath)
 дуудалтууд	🟡 imageUrl() руу солих эсвэл шууд URL ашиглах
13	
ImageUpload.tsx (admin)
Backend upload endpoint руу файл илгээнэ	🟡 Backend endpoint хэвээр →Cloudinary-руу redirect
14	
ProductFormPage.tsx (admin)
Image URL references	🟡 Cloudinary URL хэвээр ажиллана
0.2 Cloudinary .env Тохиргоо (Бэлэн)
env
# backend/.env — Аль хэдийн тохируулсан ✅
ASSET_STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=dttvcdgp0
CLOUDINARY_API_KEY=359531297219268
CLOUDINARY_API_SECRET=***REMOVED***
0.3 R2 → Cloudinary: Шинэ Backend Utility
[NEW] backend/src/lib/cloudinary.ts — R2-ийн 
r2.ts
 + 
r2-presigned.ts
-ыг бүрэн орлоно:

typescript
import { v2 as cloudinary } from 'cloudinary';
import { logger } from './logger';
// Cloudinary тохиргоо
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});
/** Бүтээгдэхүүний зураг upload */
export async function uploadProductImage(
  productId: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `products/${productId}`,
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) { reject(error); return; }
        resolve(result!.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}
/** Design файл upload (DTF customization) */
export async function uploadDesignAsset(
  userId: string,
  buffer: Buffer,
  filename: string
): Promise<{ url: string; publicId: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `designs/${userId}`,
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
        resource_type: 'image',
        // Design-д auto optimization хийхгүй — эх чанарыг хадгална
      },
      (error, result) => {
        if (error) { reject(error); return; }
        resolve({
          url: result!.secure_url,
          publicId: result!.public_id,
          width: result!.width,
          height: result!.height,
        });
      }
    );
    uploadStream.end(buffer);
  });
}
/** Thumbnail URL үүсгэх (Cloudinary transformation) */
export function getThumbnailUrl(originalUrl: string, width = 200): string {
  return originalUrl.replace('/upload/', `/upload/w_${width},c_limit/`);
}
/** Зураг устгах */
export async function deleteImage(publicIdOrUrl: string): Promise<void> {
  const publicId = publicIdOrUrl.includes('/')
    ? extractPublicId(publicIdOrUrl)
    : publicIdOrUrl;
  await cloudinary.uploader.destroy(publicId);
}
/** Folder бүрэн устгах */
export async function deleteFolder(folderPath: string): Promise<void> {
  await cloudinary.api.delete_resources_by_prefix(folderPath);
  await cloudinary.api.delete_folder(folderPath);
}
/** Signed upload URL (frontend → Cloudinary шууд upload) */
export function generateSignedUploadParams(folder: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET!
  );
  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder,
  };
}
function extractPublicId(url: string): string {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
  return match?.[1] ?? url;
}
export default cloudinary;
0.4 Backend 
env.ts
 Өөрчлөлт
diff
- // Cloudflare R2 Storage
- R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
- R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
- R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
- R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
- R2_PUBLIC_BASE_URL: z.string().url('R2_PUBLIC_BASE_URL must be a valid URL'),
+ // Cloudinary Storage
+ CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
+ CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
+ CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
0.5 Store Frontend 
r2.ts
 → imageUrl.ts
diff
- // src/lib/r2.ts
- const R2_PUBLIC_BASE = import.meta.env.VITE_R2_PUBLIC_BASE_URL;
-
- export function r2Url(pathOrUrl?: string | null) {
-   if (!pathOrUrl) return "";
-   if (pathOrUrl.startsWith("http")) return pathOrUrl;
-   if (!R2_PUBLIC_BASE) return "";
-   const base = R2_PUBLIC_BASE.replace(/\/$/, "");
-   const path = pathOrUrl.replace(/^\//, "");
-   return `${base}/${path}`;
- }
+ // src/lib/imageUrl.ts
+ /** Cloudinary нь full URL буцаадаг тул prefix нэмэх шаардлагагүй */
+ export function imageUrl(pathOrUrl?: string | null): string {
+   if (!pathOrUrl) return "";
+   if (pathOrUrl.startsWith("http")) return pathOrUrl;
+   // Legacy relative path fallback (хуучин бүтээгдэхүүний зурагт)
+   return pathOrUrl;
+ }
+
+ /** Backwards compatibility alias */
+ export const r2Url = imageUrl;
0.6 Store Frontend 
env.ts
 Өөрчлөлт
diff
const requiredEnvVars = [
   'VITE_SUPABASE_URL',
   'VITE_SUPABASE_ANON_KEY',
   'VITE_API_URL',
-  'VITE_R2_PUBLIC_BASE_URL',
   'VITE_TURNSTILE_SITE_KEY'
 ] as const;
 export const env = {
   // ...
-  // R2 Storage
-  R2_PUBLIC_BASE_URL: import.meta.env.VITE_R2_PUBLIC_BASE_URL as string,
+  // (R2 устгагдсан — Cloudinary full URL ашиглана)
   // ...
 } as const;
0.7 Шилжүүлэх Файлуудын Хураангуй
Файл	Үйлдэл	Тайлбар
backend/src/lib/cloudinary.ts	[NEW]	R2 utility-ийг бүрэн орлоно
backend/src/lib/r2.ts
[DELETE]	Cloudinary-аар солигдсон
backend/src/lib/r2-presigned.ts
[DELETE]	Cloudinary signed upload-аар солигдсон
backend/src/lib/env.ts
[MODIFY]	R2 → Cloudinary env validation
backend/src/lib/remote-image-import.ts
[MODIFY]	
uploadProductImage
 import → cloudinary.ts
backend/src/routes/admin/upload.ts
[MODIFY]	Import → cloudinary.ts
backend/src/routes/admin/upload-presigned.ts
[MODIFY]	Cloudinary signed upload params
backend/src/routes/admin/products.ts
[MODIFY]	
deleteR2Folder
 → deleteFolder
backend/src/test-r2.ts
[DELETE]	Хэрэггүй
backend/src/test-presigned.ts
[DELETE]	Хэрэггүй
apps/store/src/lib/r2.ts
 → imageUrl.ts	[RENAME+MODIFY]	Шинэ helper + backwards alias
apps/store/src/lib/env.ts
[MODIFY]	R2 env устгах
Store components (7+ файл)	[MODIFY]	
r2Url()
 → imageUrl() (эсвэл alias-аар хэвээр)
backend/package.json
[MODIFY]	npm install cloudinary, R2 packages optional устгах
0.8 npm Dependency Өөрчлөлт
diff
# backend/package.json
+  "cloudinary": "^2.5.0",            # Нэмэх
   "@aws-sdk/client-s3": "...",        # Одоогоор хэвээр (бусад хэрэглэж магадгүй)
   "@aws-sdk/lib-storage": "...",      # Хэвээр
   "@aws-sdk/s3-presigned-post": "...", # Хэвээр
   "@aws-sdk/s3-request-presigner": "..." # Хэвээр
TIP

R2 → Cloudinary шилжилт нь DTF feature-ийг хэрэгжүүлэхтэй зэрэгцээ хийж болно. Шилжилтийг Phase 0-ийн хамгийн эхэнд хийхийг зөвлөж байна.

1. Одоогийн Байдлын Тойм
1.1 Аппликацийн Бүтэц
Компонент	Технологи	Байршил
Store Frontend	Vite + React + TypeScript + TailwindCSS	apps/store/
Admin Frontend	Vite + React + TypeScript + TailwindCSS	apps/admin/
Backend API	Fastify + TypeScript (CommonJS)	backend/
Database	PostgreSQL (Supabase) + Prisma ORM	backend/prisma/schema.prisma
File Storage	Cloudflare R2 → Cloudinary (шилжиж байгаа)	backend/src/lib/cloudinary.ts
Payment	QPay Mongolia (QR-based)	backend/src/services/qpay.service.ts
Email	Resend API	backend/src/services/email.service.ts
Deployment	Frontend → Cloudflare Pages, Backend → Railway	—
1.2 Одоогийн Database Schema
has
has
places
Profile
string
id
PK
Role
role
string
email
string
name
Category
string
id
PK
string
name
string
slug
UK
Product
string
id
PK
string
title
string
slug
UK
decimal
basePrice
string
categoryId
FK
ProductVariant
string
id
PK
string
productId
FK
string
name
string
sku
UK
decimal
price
string
imagePath
int
stock
Order
string
id
PK
string
userId
FK
decimal
total
OrderStatus
status
json
items
string
qpayInvoiceId
UK
1.3 Checkout Flow (Одоогийн)
Хэрэглэгч → Сагсанд нэмнэ (Cart Context / localStorage)
  → /checkout → Хүргэлтийн мэдээлэл оруулна
  → POST /api/orders (items + shippingAddress + total)
    → Prisma order.create() → QPay invoice → QR код буцаана
  → Frontend QR скан, 5 сек polling
  → QPay callback → order PAID → Confirmation email
IMPORTANT

Order.items нь JSON snapshot (productName, variantName, variantPrice, quantity, imagePath). DTF-д customization data нэмэх шаардлагатай.

2. Gap Analysis (Дутагдлын Шинжилгээ)
DTF Шаардлага	Одоогийн Байдал	Нэн Тэргүүлэх Эсэх
R2 → Cloudinary шилжилт	❌ R2 код байсаар, Cloudinary keys бэлэн	🔴 Нэн тэргүүлэх
Customization Flow	❌ Байхгүй	🔴 Нэн тэргүүлэх
Design Upload (хэрэглэгч)	❌ Зөвхөн admin upload	🔴 Нэн тэргүүлэх
Print Area / Placement	❌ Байхгүй	🔴 Нэн тэргүүлэх
Dynamic Pricing Engine	❌ Зөвхөн variant price	🔴 Нэн тэргүүлэх
Mockup Preview	❌ Байхгүй	🟡 Phase 1 static
Production Pipeline	❌ Зөвхөн PENDING→PAID→SHIPPED	🔴 Нэн тэргүүлэх
Print Pack Download	❌ Байхгүй	🟡 Phase 1
Quantity Discounts	❌ Байхгүй	🟡 Phase 1
Canvas Editor	❌ Байхгүй	🟢 Phase 2
Гол дутагдал:

A. Customization Module бүрэн шинээр бүтээх
B. Pricing Engine: variant.price × quantity → base + print_fee(area, size) + extras + discounts
C. Production Pipeline: 8 шатлалт (NEW → ART_CHECK → READY_TO_PRINT → PRINTING → QC → PACKED → SHIPPED → DONE)
D. Storage: R2 → Cloudinary шилжилт (бүрэн)
3. Зорилтот Архитектур
External Services
Backend API
Store Frontend
upload design
store file
get assets
create order
read rules
Admin Frontend
ProductionDashboard
PricingRulesPage
CustomizePage
DesignUploader
PlacementSelector
LivePriceDisplay
MockupPreview
customization.ts routes
pricing.service.ts
asset.service.ts
cloudinary.ts (NEW)
orders.ts (enhanced)
admin/production.ts
printpack.service.ts
PostgreSQL / Supabase
☁️ Cloudinary
Өгөгдлийн Урсгал
1. Хэрэглэгч → /customize/:productSlug
2. Base garment + variant сонголт
3. Design upload → POST /api/customization/upload-design
   → Cloudinary upload → thumbnail auto-generate → asset record
4. Print area + size tier сонголт
5. Real-time price quote → POST /api/customization/price-quote
6. "Сагсанд нэмэх" → CartContext-д customization data
7. Checkout → POST /api/orders → QPay
8. Admin → ProductionDashboard → статус pipeline
9. Admin → Print Pack татах (Cloudinary URL-ууд)
4. Database Schema Proposal
NOTE

Одоогийн Product, ProductVariant, Order, Profile, Category хүснэгтүүд хэвээр. Доорх шинээр нэмэгдэнэ.

Шинэ Prisma Models
prisma
enum ProductionStatus {
  NEW
  ART_CHECK
  READY_TO_PRINT
  PRINTING
  QC
  PACKED
  SHIPPED
  DONE
}
model PrintArea {
  id          String   @id @default(uuid())
  name        String   // "front", "back", "left_chest"
  label       String   // "Урд тал", "Ар тал"
  labelEn     String?
  maxWidthCm  Float
  maxHeightCm Float
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  productPrintAreas ProductPrintArea[]
  customizations    OrderItemCustomization[]
  @@map("print_areas")
}
model ProductPrintArea {
  id          String    @id @default(uuid())
  productId   String
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  printAreaId String
  printArea   PrintArea @relation(fields: [printAreaId], references: [id], onDelete: Cascade)
  isDefault   Boolean   @default(false)
  @@unique([productId, printAreaId])
  @@map("product_print_areas")
}
model PrintSizeTier {
  id       String  @id @default(uuid())
  name     String  // "S", "M", "L", "XL"
  label    String  // "Жижиг (15×15cm)"
  widthCm  Float
  heightCm Float
  sortOrder Int    @default(0)
  isActive Boolean @default(true)
  pricingRules   PricingRule[]
  customizations OrderItemCustomization[]
  @@map("print_size_tiers")
}
model PricingRule {
  id              String  @id @default(uuid())
  name            String
  ruleType        String  // "PRINT_FEE", "EXTRA_SIDE", "QUANTITY_DISCOUNT", "RUSH_FEE"
  printSizeTierId String?
  printSizeTier   PrintSizeTier? @relation(fields: [printSizeTierId], references: [id])
  printAreaId     String?
  minQuantity     Int?
  maxQuantity     Int?
  price           Decimal
  discountPercent Float?
  isActive        Boolean @default(true)
  @@map("pricing_rules")
}
model CustomizationAsset {
  id            String   @id @default(uuid())
  userId        String
  originalUrl   String   // Cloudinary secure_url
  thumbnailUrl  String?  // Cloudinary thumbnail transformation URL
  cloudinaryId  String?  // Cloudinary public_id (устгах, transform-д)
  fileName      String
  mimeType      String
  fileSizeBytes Int
  widthPx       Int?
  heightPx      Int?
  dpi           Int?
  isValid       Boolean  @default(false)
  createdAt     DateTime @default(now())
  customizations OrderItemCustomization[]
  @@index([userId])
  @@map("customization_assets")
}
model OrderItemCustomization {
  id              String    @id @default(uuid())
  orderId         String
  order           Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderItemIndex  Int
  printAreaId     String
  printArea       PrintArea @relation(fields: [printAreaId], references: [id])
  printSizeTierId String
  printSizeTier   PrintSizeTier @relation(fields: [printSizeTierId], references: [id])
  assetId         String
  asset           CustomizationAsset @relation(fields: [assetId], references: [id])
  placementConfig Json?     // { offsetX, offsetY, rotation, scale }
  printFee        Decimal
  createdAt       DateTime  @default(now())
  @@index([orderId])
  @@map("order_item_customizations")
}
model ProductionStatusEvent {
  id         String           @id @default(uuid())
  orderId    String
  order      Order            @relation(fields: [orderId], references: [id], onDelete: Cascade)
  fromStatus ProductionStatus?
  toStatus   ProductionStatus
  changedBy  String
  notes      String?
  createdAt  DateTime         @default(now())
  @@index([orderId])
  @@map("production_status_events")
}
Одоогийн Models-д Нэмэлт
diff
model Product {
   // ... existing ...
+  isCustomizable   Boolean            @default(false)
+  mockupImagePath  String?     // Cloudinary mockup URL
+  printAreas       ProductPrintArea[]
 }
 model Order {
   // ... existing ...
+  productionStatus    ProductionStatus @default(NEW)
+  isCustomOrder       Boolean          @default(false)
+  rushFee             Decimal?
+  addOnFees           Decimal?
+  customizations      OrderItemCustomization[]
+  productionEvents    ProductionStatusEvent[]
 }
5. API Design
5.1 Design Upload (Cloudinary)
POST /api/customization/upload-design
Authorization: Bearer <token>
Content-Type: multipart/form-data (file: PNG/SVG, max 20MB)
Response 201:
{
  "asset": {
    "id": "uuid",
    "originalUrl": "https://res.cloudinary.com/dttvcdgp0/image/upload/v.../designs/user123/abc.png",
    "thumbnailUrl": "https://res.cloudinary.com/dttvcdgp0/image/upload/w_200,c_limit/designs/user123/abc.png",
    "cloudinaryId": "designs/user123/1707800000-abc",
    "widthPx": 3000, "heightPx": 3000,
    "dpi": 300, "isValid": true
  }
}
TIP

Cloudinary thumbnail нь originalUrl-д /upload/ хэсэгт w_200,c_limit transformation нэмэхэд л автоматаар үүсдэг — тусдаа файл хадгалах шаардлагагүй.

5.2 Price Quote
POST /api/customization/price-quote
Body: { variantId, customizations: [{ printAreaId, printSizeTierId }], quantity, rushOrder }
Response 200:
{
  "breakdown": {
    "basePrice": 45000,
    "printFees": [{ "area": "Урд тал", "sizeTier": "Дунд", "fee": 15000 }],
    "quantityDiscount": { "percent": 10, "amount": -4500 },
    "grandTotal": 55500
  }
}
5.3 Create Order (Өргөтгөсөн)
diff
POST /api/orders
 Body:
 {
   "items": [{
     "id": "variant-uuid",
     "quantity": 5,
     "variantPrice": 45000,
+    "customizations": [{
+      "printAreaId": "uuid",
+      "printSizeTierId": "uuid",
+      "assetId": "uuid",
+      "printFee": 15000
+    }]
   }],
   "shippingAddress": { ... },
   "total": 300000
 }
5.4 Admin Production
PUT  /api/admin/orders/:id/production-status  { status, notes }
GET  /api/admin/orders/:id/print-pack         → design URLs + specs
GET  /api/admin/orders?productionStatus=NEW    → filtered list + statusCounts
5.5 Backend Route Files
Endpoint	File	Тайлбар
Design upload + price quote	backend/src/routes/customization.ts [NEW]	Cloudinary upload
Order creation	backend/src/routes/orders.ts [MODIFY]	Custom items
Production pipeline	backend/src/routes/admin/production.ts [NEW]	Status updates
Pricing rules CRUD	backend/src/routes/admin/pricing.ts [NEW]	Admin pricing
6. Frontend UX Plan (Store)
CustomizePage (/customize/:productSlug)
┌──────────────────────────────────────────┐
│  ← Буцах   DTF Футболк - Захиалга       │
├───────────────────┬──────────────────────┤
│   MOCKUP PREVIEW  │ 1. Өнгө & Хэмжээ    │
│   ┌────────────┐  │ 2. Дизайн Upload     │
│   │  [Design   │  │    + Зураг оруулах   │
│   │   overlay] │  │    PNG, 200+ DPI     │
│   └────────────┘  │ 3. Хэвлэх Байрлал   │
│   Front ○ Back ○  │ 4. Хэвлэлийн Хэмжээ │
├───────────────────┴──────────────────────┤
│ Нийт: ₮60,000  Тоо:[5]  ₮300,000       │
│           [ 🛒 Сагсанд нэмэх ]          │
└──────────────────────────────────────────┘
Шинэ Компонентууд
Компонент	File
DesignUploader	components/customize/DesignUploader.tsx [NEW]
PlacementSelector	components/customize/PlacementSelector.tsx [NEW]
SizeTierSelector	components/customize/SizeTierSelector.tsx [NEW]
MockupPreview	components/customize/MockupPreview.tsx [NEW]
PriceBreakdown	components/customize/PriceBreakdown.tsx [NEW]
Одоогийн Файлуудын Өөрчлөлт
Файл	Өөрчлөлт
ProductDetails.tsx	"Customize" товч нэмэх
CartContext.tsx	customizations[] field нэмэх
CheckoutPage.tsx	Custom order data payload
OrderDetailPage.tsx	Customization + status timeline
App.tsx	/customize/:productSlug route
7. Admin Panel Өөрчлөлтүүд
Шинэ Хуудсууд
Хуудас	Route	Тайлбар
ProductionDashboardPage	/production	Kanban / status pipeline
OrderProductionDetailPage	/production/:id	Design files, status timeline, print pack
PricingRulesPage	/pricing	Print fee matrix, quantity discounts
8. Security & Compliance
Хамгаалалт	R2 (хуучин)	Cloudinary (шинэ)
File upload	Server → S3 PUT	Server → Cloudinary SDK upload
Signed URL	S3 presigned URL (1hr)	Cloudinary signed upload params
Access control	R2 bucket policy	Cloudinary upload preset + signed delivery
File validation	Server-side type/size check	Хэвээр + Cloudinary format check
Thumbnail	Manual (тусдаа upload)	Автомат — URL transformation
CDN	R2 public domain	Cloudinary CDN (auto)
Delete	S3 DeleteObject	cloudinary.uploader.destroy()
Rate limiting	Fastify rate-limit	Хэвээр: 10 req/min per user
9. Хэрэгжүүлэлтийн Төлөвлөгөө (Phased)
Phase 0: R2→Cloudinary + MVP DTF (2-3 долоо хоног)
#	Даалгавар	Файл
0.0	cloudinary npm package суулгах	backend/package.json
0.1	cloudinary.ts utility бичих	backend/src/lib/cloudinary.ts [NEW]
0.2	env.ts — R2 → Cloudinary validation	backend/src/lib/env.ts [MODIFY]
0.3	upload.ts — import cloudinary.ts	backend/src/routes/admin/upload.ts [MODIFY]
0.4	upload-presigned.ts — Cloudinary signed	backend/src/routes/admin/upload-presigned.ts [MODIFY]
0.5	products.ts — deleteFolder → Cloudinary	backend/src/routes/admin/products.ts [MODIFY]
0.6	remote-image-import.ts — Cloudinary	backend/src/lib/remote-image-import.ts [MODIFY]
0.7	Store imageUrl.ts helper	apps/store/src/lib/imageUrl.ts [NEW]
0.8	Store env.ts — R2 ref устгах	apps/store/src/lib/env.ts [MODIFY]
0.9	Store components — r2Url → imageUrl	7+ файл [MODIFY]
0.10	R2 файлууд устгах	r2.ts, r2-presigned.ts, test файлууд [DELETE]
0.11	DB schema шинэчлэх (Prisma migration)	backend/prisma/schema.prisma
0.12	Seed data (PrintArea, PrintSizeTier, PricingRule)	backend/prisma/seed.ts
0.13	Asset service (Cloudinary upload + validate)	backend/src/services/asset.service.ts [NEW]
0.14	Customization routes (upload-design, price-quote)	backend/src/routes/customization.ts [NEW]
0.15	Pricing service	backend/src/services/pricing.service.ts [NEW]
0.16	Order creation — customization data	backend/src/routes/orders.ts [MODIFY]
0.17	CustomizePage + components (store)	apps/store/src/pages/CustomizePage.tsx + 5 components [NEW]
0.18	CartContext + CheckoutPage + ProductDetails өөрчлөлт	[MODIFY]
Phase 1: Production Pipeline + Multi-Area (2-3 долоо хоног)
#	Даалгавар
1.1	Олон print area support
1.2	Production status pipeline (backend)
1.3	ProductionDashboardPage (admin)
1.4	Print pack download (Cloudinary URLs)
1.5	PricingRulesPage (admin CRUD)
1.6	Quantity discount + extra side fees
1.7	Email notifications
Phase 2: Advanced Features (3-4 долоо хоног)
#	Даалгавар
2.1	2D Canvas editor (Konva.js)
2.2	Auto mockup render (Cloudinary overlay transformation)
2.3	Rush fee + add-ons
2.4	Batch operations (admin)
TIP

Phase 2 давуу тал: Cloudinary нь overlay transformation дэмждэг тул mockup render-ыг server-side хийхгүйгээр URL transformation-аар автоматаар үүсгэх боломжтой — R2-ээс давуу!

10. Repo-Specific Patch Suggestions
10.1 Бүтээх Файлууд (17 файл)
#	Файл	Тайлбар
1	backend/src/lib/cloudinary.ts	Cloudinary utility (R2 орлоно)
2	backend/src/routes/customization.ts	Design upload + price quote
3	backend/src/services/pricing.service.ts	Pricing engine
4	backend/src/services/asset.service.ts	Cloudinary file validation + upload
5	backend/src/services/printpack.service.ts	Print pack generation
6	backend/src/routes/admin/production.ts	Production pipeline admin
7	backend/src/routes/admin/pricing.ts	Pricing rules CRUD
8	backend/src/schemas/customization.schema.ts	Zod schemas
9	apps/store/src/lib/imageUrl.ts	Image URL helper (R2 орлоно)
10	apps/store/src/pages/CustomizePage.tsx	Main customizer page
11–14	apps/store/src/components/customize/	DesignUploader, PlacementSelector, SizeTierSelector, MockupPreview, PriceBreakdown
15	apps/admin/src/pages/ProductionDashboardPage.tsx	Production dashboard
16	apps/admin/src/pages/OrderProductionDetailPage.tsx	Production details
17	apps/admin/src/pages/PricingRulesPage.tsx	Pricing admin
10.2 Засах Файлууд (14 файл)
#	Файл	Өөрчлөлт
1	backend/prisma/schema.prisma	Шинэ models + enum
2	backend/src/lib/env.ts	R2 → Cloudinary validation
3	backend/src/app.ts	Шинэ routes register
4	backend/src/routes/orders.ts	Customization data
5	backend/src/schemas/order.schema.ts	Customization items schema
6	backend/src/routes/admin/upload.ts	Import → cloudinary
7	backend/src/routes/admin/upload-presigned.ts	Cloudinary signed
8	backend/src/routes/admin/products.ts	deleteFolder → Cloudinary
9	backend/src/lib/remote-image-import.ts	→ Cloudinary import
10	apps/store/src/lib/env.ts	R2 ref устгах
11	apps/store/src/App.tsx	/customize route
12	apps/store/src/context/CartContext.tsx	Customization fields
13	apps/store/src/pages/ProductDetails.tsx	"Customize" товч
14	apps/store/src/pages/CheckoutPage.tsx	Custom order payload
10.3 Устгах Файлууд (4 файл)
#	Файл
1	backend/src/lib/r2.ts
2	backend/src/lib/r2-presigned.ts
3	backend/src/test-r2.ts
4	backend/src/test-presigned.ts
Verification Plan
Cloudinary Шилжилт Шалгах
bash
# 1. Backend эхлэх (env validation шалгах)
cd backend && npm run dev
# 2. Admin → Product → зураг upload → Cloudinary URL буцах эсэх
# 3. Store → product image → Cloudinary URL зөв render хийх эсэх
DTF Feature Шалгах
bash
# Unit tests
cd backend && npm test
# Prisma migration
cd backend && npx prisma migrate dev --create-only --name dtf_cloudinary
Manual
Design upload → Cloudinary-д хадгалагдсан эсэх шалгах
Customize flow → price quote → order → QPay → бүрэн flow
Admin → Production dashboard → status update → print pack download