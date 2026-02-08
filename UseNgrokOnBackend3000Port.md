# UseNgrokOnBackend3000Port.md

## Зорилго

Local дээр ажиллаж байгаа backend (`http://localhost:3000`) руу **гадаад сервисүүд (ж: QPay sandbox)** webhook/callback request илгээх боломжгүй байдаг.  
Тиймээс **ngrok** ашиглаад `localhost:3000`-ийг түр хугацаанд **public HTTPS URL** болгоно.

---

## Одоо яг юу болж байна вэ? (Таны screenshot дээр)

ngrok ажиллаж байна:

- **Local backend:** `http://localhost:3000`
- **Public URL (ngrok):** `https://bacteriologic-christine-uncontemptibly.ngrok-free.dev`
- **Forwarding:** public URL руу орж ирсэн HTTP/HTTPS request-ууд → таны local backend руу дамжина

Өөрөөр хэлбэл:

```
QPay sandbox (internet)
        |
        v
https://bacteriologic-christine-uncontemptibly.ngrok-free.dev
        |
        v
http://localhost:3000   (танай backend)
```

---

## Яагаад ngrok хэрэгтэй вэ?

QPay зэрэг webhook явуулдаг системүүд нь **internet дээрх public URL** руу л callback илгээж чадна.  
`localhost` бол таны компьютерт л харагддаг тул QPay хүрч чаддаггүй.

ngrok → таны local server-г түр хугацаанд интернетэд “харагддаг” болгож өгдөг.

---

## 1) Шаардлага

- Backend чинь **3000 порт дээр ажиллаж байх**
- ngrok authtoken тохируулсан байх (free plan OK)

---

## 2) Ngrok ажиллуулах (Backend 3000 порт)

> Анхаарах: ngrok terminal-ийг хааж болохгүй. Хаавал URL унана.

### 2.1 Backend асаалттай эсэх
Backend terminal дээр:

```bash
cd backend
npm run dev
```

Console дээр:
- `Server listening on http://localhost:3000` гэх мэт гарсан байх.

### 2.2 Ngrok tunnel асаах
ngrok terminal дээр:

```bash
ngrok http 3000
```

Амжилттай бол ийм гарна:

- `Forwarding https://<random>.ngrok-free.dev -> http://localhost:3000`
- Web interface: `http://127.0.0.1:4040`

---

## 3) QPay callback URL-ээ ngrok домэйн руу тохируулах

Backend-ийн `.env` дээр:

```env
QPAY_MOCK_MODE=false
QPAY_CALLBACK_URL=https://bacteriologic-christine-uncontemptibly.ngrok-free.dev/api/payment/callback
```

> **Callback path** нь танай backend дээр яг байгаа route-тэй таарах ёстой:
- зөв: `/api/payment/callback`
- буруу: `/api/qpay/callback`

### 3.1 Backend restart (заавал)
`.env` өөрчилсөн тул backend restart хийнэ:

```bash
# backend terminal дээр
Ctrl + C
npm run dev
```

---

## 4) Тест flow (Checkout → QPay → Callback)

1. Store дээр checkout хийж invoice үүсгэнэ
2. QPay QR гарна
3. Хэрэглэгч (sandbox) төлнө
4. QPay таны `.env` дээр заасан `QPAY_CALLBACK_URL` руу webhook илгээнэ
5. Webhook request → ngrok → `localhost:3000/api/payment/callback` дээр ирнэ
6. Backend төлбөрийг баталгаажуулаад:
   - order/payment status-оо **PAID** болгож update хийнэ

---

## 5) Callback орж ирж байгаа эсэхийг харах (ngrok inspector)

Browser дээр:

- `http://127.0.0.1:4040`

Эндээс:
- incoming requests
- response status
- payload body/headers

бүгдийг харж болно. (Webhooks debug хийхэд хамгийн хэрэгтэй.)

---

## 6) Browser дээр ngrok “warning page” гарч ирэх тухай

Public URL-ийг browser-оор анх нээхэд ngrok free plan дээр хамгаалалтын **warning page** гарч болно.  
Энэ нь **browser-д л** хамаатай. Webhook системүүдэд (QPay) ерөнхийдөө нөлөөлөхгүй.

---

## 7) Түгээмэл асуудал ба шийдэл

### A) “Cannot GET /api/payment/callback”
- Энэ бол **GET** хүсэлтээр ороход гардаг хэвийн зүйл.
- Webhook нь ихэнхдээ **POST**-оор орж ирдэг.

### B) QPay callback огт ирэхгүй байвал
Шалгах дараалал:

1. `.env` дээрх `QPAY_CALLBACK_URL` нь ngrok домэйнтэй яг таарч байна уу?
2. Backend restart хийсэн үү?
3. `ngrok http 3000` ажиллаж байна уу? (terminal хаагдаагүй юу?)
4. `http://127.0.0.1:4040` дээр request орж ирж байна уу?
5. Backend route чинь зөв үү: `/api/payment/callback`?

### C) Ngrok URL өөрчлөгдөх
Free plan дээр ngrok restart хийх бүрт public URL өөрчлөгдөх магадлалтай.  
Тэгэхээр:
- шинэ URL гармагц `.env` дээрх `QPAY_CALLBACK_URL`-ээ шинэчилнэ
- backend restart хийнэ

---

## 8) Claude (эсвэл AI dev tool)-д ойлгуулах “товч тайлбар”

Claude-д дараахыг хэлж ойлгуулна:

- “Би local backend-аа `localhost:3000` дээр ажиллуулж байгаа”
- “QPay sandbox webhook нь localhost руу хүрэхгүй, тиймээс ngrok ашиглаж public URL гаргасан”
- “Одоогийн ngrok forwarding URL: `https://bacteriologic-christine-uncontemptibly.ngrok-free.dev`”
- “.env дээр `QPAY_CALLBACK_URL=<ngrok-url>/api/payment/callback` гэж тохируулсан”
- “Webhook орж ирж байгааг ngrok inspector `127.0.0.1:4040` дээр шалгана”
- “Төлбөр төлөгдсөн үед callback route order/payment статусыг PAID болгох ёстой”

---

## 9) Checklist (copy/paste)

```bash
# 1) Backend start
cd backend
npm run dev

# 2) Ngrok start (new terminal)
ngrok http 3000

# 3) backend/.env
QPAY_MOCK_MODE=false
QPAY_CALLBACK_URL=https://<ngrok-domain>/api/payment/callback

# 4) Backend restart
Ctrl + C
npm run dev

# 5) Debug inspector
# open http://127.0.0.1:4040
```

---

## 10) Security note (түр тест)

ngrok URL бол public тул:
- зөвхөн sandbox/test дээр ашигла
- production дээр webhook бол Railway/Cloudflare Worker зэрэг public server дээр байрлуулж “stable” callback URL хэрэглэ
