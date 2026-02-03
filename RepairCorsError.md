# Cloudflare R2 CORS Алдааг Засах Төлөвлөгөө

**Огноо:** 2026-02-02
**Асуудал:** R2 presigned URL ашиглан browser-с upload хийхэд CORS алдаа гарч байна
**Алдаа:** `Access-Control-Allow-Origin header missing` + `403 Forbidden`

---

## 🔍 Олдсон Гол Асуудлууд

Интернэт судалгаанаас олсон **критик асуудлууд**:

### 1. ⚠️ **КРИТИК: AllowedHeaders буруу тохируулагдсан**

**Асуудал:**
```json
"AllowedHeaders": ["*"]  // ❌ R2 дээр ажиллахгүй!
```

**Зөв тохиргоо:**
```json
"AllowedHeaders": ["content-type", "content-length"]  // ✅ Lowercase, тодорхой
```

**Тайлбар:**
- AWS S3 дээр `*` (wildcard) ажиллана
- **R2 дээр `*` АЖИЛЛАХГҮЙ** - тодорхой header нэрүүд шаардлагатай
- **Lowercase** байх ёстой: `content-type` NOT `Content-Type`

**Эх сурвалж:**
- [How To Fix CORS Error on R2](https://dev.to/ehteshamdev/how-to-fix-cors-error-while-uploading-files-on-cloudflare-r2-using-presigned-urls-21dm)
- [Configuring CORS on R2](https://kian.org.uk/configuring-cors-on-cloudflare-r2/)

---

### 2. 🔑 **API Token эрх хүрэлцэхгүй байх**

**Асуудал:**
- R2 API Token нь зөвхөн "Read" эрхтэй байх
- Token хугацаа дууссан байх

**Шалгах:**
1. Cloudflare Dashboard → R2 → **Manage R2 API Tokens**
2. Таны token-г сонгоно
3. Permissions: **Read & Write** эрхтэй эсэхийг шалгана
4. Expiration: Хугацаа дуусаагүй эсэхийг шалгана

**Эх сурвалж:**
- [403 Error with Presigned URL](https://community.cloudflare.com/t/403-error-when-uploading-to-r2-bucket-from-client-via-a-pre-signed-url/637373)

---

### 3. 📝 **Presigned URL үүсгэхдээ Content-Type sign хийхгүй байх**

**Асуудал:**
- Presigned URL үүсгэхдээ `Content-Type` header-г sign хийвэл R2 unsigned header гэж үзээд block хийнэ
- Browser автоматаар Content-Type илгээдэг тул code-оос илгээх шаардлаггүй

**Зөв код:**
```javascript
// ❌ Буруу - Content-Type sign хийж байна
const command = new PutObjectCommand({
  Bucket: BUCKET,
  Key: key,
  ContentType: contentType,  // ❌ Энийг sign хийхгүй
});

// ✅ Зөв - Presigned URL үүсгэхдээ ContentType оруулахгүй
const command = new PutObjectCommand({
  Bucket: BUCKET,
  Key: key,
  // ContentType оруулахгүй эсвэл signed headers-с хасах
});
```

**Эх сурвалж:**
- [R2 Presigned URL with Hono](https://lirantal.com/blog/cloudflare-r2-presigned-url-uploads-hono)
- [Presigned URLs Docs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

---

### 4. 🌐 **CORS Policy тодорхой тохиргоо**

**Одоогийн буруу тохиргоо:**
```json
[
  {
    "AllowedOrigins": ["http://localhost:5176", ...],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],  // ❌ АСУУДАЛ ЭНД!
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3000
  }
]
```

**Зөв тохиргоо:**
```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5176",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": [
      "content-type",
      "content-length",
      "x-amz-date",
      "authorization",
      "x-amz-content-sha256"
    ],
    "ExposeHeaders": ["etag", "content-length"],
    "MaxAgeSeconds": 3600
  }
]
```

**Тайлбар:**
- ✅ Headers бүгд **lowercase**
- ✅ Тодорхой header нэрүүд (`*` биш)
- ✅ AWS signature headers нэмсэн (`x-amz-*`)

**Эх сурвалж:**
- [Cloudflare R2 CORS Configuration](https://developers.cloudflare.com/r2/buckets/cors/)
- [CORS Issue with R2 Presigned URL](https://community.cloudflare.com/t/cors-issue-with-r2-presigned-url/428567)

---

## 🔧 Засварын Алхмууд

### Алхам 1: CORS Policy шинэчлэх

**Cloudflare Dashboard дээр:**

1. R2 → Buckets → **products** bucket
2. Settings → **CORS Policy** → **Edit**
3. Дараах зөв тохиргоог оруулна:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5176",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5176"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": [
      "content-type",
      "content-length"
    ],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

4. **Save** дарна
5. **2-3 минут хүлээнэ** (propagation)

---

### Алхам 2: API Token эрх шалгах

1. Cloudflare Dashboard → R2 → **Manage R2 API Tokens**
2. Одоогийн token-г шалгана:
   - ✅ **Permissions: Read & Write**
   - ✅ **Expiration: Active**
3. Хэрэв эрх дутуу бол шинээр үүсгэнэ:
   - **Permission: Object Read & Write**
   - **TTL: 1 year** (эсвэл тохиромжтой хугацаа)
4. Шинэ credentials-г `.env` файлд шинэчилнэ

---

### Алхам 3: Backend код засах

**File:** `backend/src/lib/r2-presigned.ts`

**Одоогийн код:**
```typescript
const command = new PutObjectCommand({
  Bucket: R2_BUCKET_NAME,
  Key: key,
  Body: file,
  ContentType: contentType,  // ❌ Энийг устгах
});
```

**Засварласан код:**
```typescript
const command = new PutObjectCommand({
  Bucket: R2_BUCKET_NAME,
  Key: key,
  // ContentType-г presigned URL-д оруулахгүй
  // Browser өөрөө илгээнэ
});
```

**Эсвэл илүү сайн арга:**
```typescript
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  console.log('[R2 Presigned] Generating presigned URL...');

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    // Зөвхөн Bucket болон Key, ContentType-г sign хийхгүй
  });

  const signedUrl = await getSignedUrl(r2SigningClient, command, {
    expiresIn,
    // unhoistableHeaders эсвэл signableHeaders тохируулж болно
    unhoistableHeaders: new Set(['content-type']), // Content-Type-г sign-аас хасах
  });

  return signedUrl;
}
```

---

### Алхам 4: Frontend fetch тохиргоо

**File:** `apps/admin/src/components/ImageUpload.tsx`

**Одоогийн код:**
```typescript
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type,  // ⚠️ Энийг хасах эсвэл үлдээх
  },
});
```

**Засварласан код (Option 1 - Header устгах):**
```typescript
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  // headers устгах - browser автоматаар нэмнэ
});
```

**Засварласан код (Option 2 - Header үлдээх):**
```typescript
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type,
  },
  mode: 'cors', // Тодорхой зааж өгнө
});
```

---

### Алхам 5: Туршилт хийх

1. Backend server restart:
   ```bash
   cd backend
   npm run dev
   ```

2. Frontend refresh: `Ctrl + F5`

3. Зураг upload туршина

4. Browser Console (F12) дээр logs шалгана:
   ```
   [ImageUpload] Step 1: Requesting presigned URL... ✅
   [ImageUpload] Step 2: Uploading to R2... ✅
   ```

5. Хэрвээ одоо ч алдаа гарвал:
   - Network tab дээр request/response headers харах
   - CORS preflight (OPTIONS) request амжилттай эсэхийг шалгах

---

## 🎯 Хамгийн Магадлалтай Шийдэл

Хэрвээ дээрх бүх арга ажиллахгүй бол:

### **Supabase Storage руу шилжих**

**Учир:**
- ✅ CORS автоматаар ажиллана
- ✅ SSL асуудал байхгүй (Windows дээр)
- ✅ Та аль хэдийн Supabase ашиглаж байгаа
- ✅ Хялбар тохиргоо
- ✅ Баталгаатай ажиллана

**Шилжих хугацаа:** 5-10 минут

**Код бэлэн байна:** `backend/src/lib/supabase-storage.ts`

---

## 📊 Статистик болон Туршилтын Үр Дүн

| Шалгах зүйл | Статус | Засварлах шаардлагатай эсэх |
|-------------|--------|------------------------------|
| CORS Policy AllowedHeaders | ❌ Буруу (`*`) | ✅ Заавал (`content-type`) |
| API Token Permissions | ⏳ Шалгаагүй | ⚠️ Шалгах |
| Presigned URL ContentType Sign | ⚠️ Магадгүй | ⚠️ Шалгах/засах |
| Frontend fetch headers | ✅ Зөв | 🤔 Туршилт хийх |
| CORS Propagation | ✅ 10+ минут хүлээсэн | ✅ Хангалттай |

---

## 🔗 Эх Сурвалжууд

- [How To Fix - CORS Error on R2 with Presigned URLs](https://dev.to/ehteshamdev/how-to-fix-cors-error-while-uploading-files-on-cloudflare-r2-using-presigned-urls-21dm)
- [Configuring CORS on Cloudflare R2](https://kian.org.uk/configuring-cors-on-cloudflare-r2/)
- [Cloudflare R2 CORS Documentation](https://developers.cloudflare.com/r2/buckets/cors/)
- [R2 Presigned URLs Documentation](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [403 Error with Presigned URL - Community](https://community.cloudflare.com/t/403-error-when-uploading-to-r2-bucket-from-client-via-a-pre-signed-url/637373)
- [CORS Issue with R2 Presigned URL - Community](https://community.cloudflare.com/t/cors-issue-with-r2-presigned-url/428567)
- [Building R2 Presigned URL Uploads with Hono](https://lirantal.com/blog/cloudflare-r2-presigned-url-uploads-hono)
- [Pre-signed URLs & CORS on R2 - Medium](https://mikeesto.medium.com/pre-signed-urls-cors-on-cloudflare-r2-c90d43370dc4)

---

## ✅ Дараагийн Алхам

**Яг одоо хийх:**
1. ✅ CORS Policy-г **AllowedHeaders** lowercase болгож засах
2. ⏳ API Token эрх шалгах
3. 🔧 Presigned URL код засах (ContentType sign хийхгүй)
4. 🧪 Туршилт хийх

**Хэрвээ ажиллахгүй бол:**
- 🔄 Supabase Storage руу шилжих (баталгаатай шийдэл)

---

**Засвар хийсний дараа энэ файлыг шинэчлэх:** Ямар алхам ажилласан/ажиллаагүйг тэмдэглэнэ.
