# TheDetailedInfoDuringQpayMongonliaTestingEnv.md

## 1) Баримтын зорилго
Энэ баримт нь QPay Mongolia V2 **sandbox/test** орчин дээр Store app-аас төлбөрийн урсгал туршсан явцад:
- ямар өөрчлөлтүүд хийсэн,
- ямар алдаа гарсан,
- ямар засвар хийж шийдсэн,
- эцэст нь ямар түвшний амжилттай болсон
гэдгийг нэг дор дэлгэрэнгүй нэгтгэнэ.

Хамрах хүрээ: QPay тест эхэлсэн үеэс одоогийн амжилттай урсгал бий болтол.

---

## 2) Эхний нөхцөл байдал
Тест эхлэх үед:
- Backend нь QPay-тай холбох суурь логиктой байсан.
- Mock mode болон real sandbox mode хооронд шилжих хэрэгтэй байсан.
- Checkout дээр төлбөр үүсгэх үед заримдаа `500` алдаа гарч байсан.
- Зарим үед QR зураг харагдахгүй байсан.
- Bank app list дээр логонууд зөв гарахгүй (үсгийн fallback) байсан.
- Callback URL localhost байсан үед sandbox орчинд webhook хүрэхгүй эрсдэлтэй байсан.

---

## 3) QPay тестийн үе шаттай явц (timeline)

## Phase A: QPay API ойлголт, production readiness audit
- `https://developer.qpay.mn` дээрх үндсэн V2 endpoint-уудыг шалгасан:
  - token,
  - refresh,
  - invoice create/get/cancel,
  - payment get/check/cancel/refund/list.
- Үүний үндсэн дээр production-д шууд `.env` солиод ажиллуулахад эрсдэлтэй цэгүүдийг гаргасан.
- Үр дүнд нь `ProductionQPayMongolia.md` баримт үүсгэсэн.

## Phase B: Sandbox real flow-д шилжүүлэх
- Sandbox credential ашиглан тест хийхээр тохируулсан:
  - `QPAY_BASE_URL=https://merchant-sandbox.qpay.mn`
  - `QPAY_USERNAME=TEST_MERCHANT`
  - `QPAY_PASSWORD=123456`
  - `QPAY_INVOICE_CODE=TEST_INVOICE`
  - `QPAY_MOCK_MODE=false`
- Sandbox туршилтын үе шатны checklist-ийг `QPaySandboxTestPhases.md` дээр бичсэн.

## Phase C: Invoice үүсгэх үеийн алдаанууд
Гол алдаанууд:
- `POST /api/orders` -> `500 Internal Server Error`
- QPay invoice create дээр:
  - `404 Not Found` (HTML nginx хариу),
  - `timeout of 20000ms exceeded`
- Order эхэлж DB-д бичигдээд, invoice fail бол orphan pending order үлдэх эрсдэлтэй байсан.

## Phase D: Backend hardening + resiliency засвар
- Orders route дээр callback URL validation нэмж, invoice fail үед order rollback/delete хийдэг болгосон.
- QPay service дээр:
  - base URL normalize,
  - timeout configurable болгох,
  - retry/backoff logic,
  - 404 үед sandbox fallback endpoint (`/v2/invoice/test`) турших,
  - алдааны дэлгэрэнгүй форматтай лог.

## Phase E: Frontend checkout QPay UI засвар
- `qr_image` raw base64 ирэх үед data URI prefix автоматаар нэмдэг болгосон.
- Bank logo URL normalize (`//`, `http://`) хийж `https` болгох.
- Logo ачааллахгүй бол graceful fallback (first letter) үлдээсэн.
- API error response-ийн `details`-ийг хэрэглэгчид харуулдаг болгосон.

## Phase F: Ngrok callback test setup
- Local backend (`localhost:3000`) руу QPay callback хүргэхийн тулд ngrok ашиглах заавар хийсэн (`UseNgrokOnBackend3000Port.md`).
- Гол зарчим:
  - `QPAY_CALLBACK_URL` нь public HTTPS байх ёстой.
  - 

## Phase G: Real sandbox invoice generation ажилласан үе
- PowerShell-аар шууд API дуудахад:
  - token авч,
  - invoice үүсэх нь батлагдсан (`invoice_id`, `qr_image`, `urls[]` ирсэн).
- Store checkout дээр:
  - QR code харагддаг болсон,
  - bank links/icons харагддаг болсон,
  - order summary + amount зөв үзэгддэг болсон.

---

## 4) Хийгдсэн кодын өөрчлөлтүүд (файл тус бүр)

## 4.1 `backend/src/routes/orders.ts`
Хийсэн зүйл:
- `QPAY_CALLBACK_URL` шалгалт:
  - `QPAY_MOCK_MODE=false` үед callback URL заавал байх.
  - localhost/127.0.0.1 байвал шууд `500` буцааж хориглох.
- Invoice fail үед orphan order үлдээхгүй засвар:
  - Order-г эхлээд үүсгэнэ.
  - Invoice үүсгэхийг try/catch-д оруулна.
  - Invoice fail бол тухайн үүссэн order-г delete хийгээд алдааг дахин throw хийнэ.

Үр дүн:
- DB дээр хуурамч pending orders овоорох асуудлыг зогсоосон.

## 4.2 `backend/src/routes/payment.ts`
Хийсэн зүйл:
- Callback parsing robust болгосон:
  - `payment_id/paymentId`, `invoice_id/invoiceId`, `order_id/orderId/sender_invoice_no` хувилбаруудыг дэмжсэн.
- Callback дээр payment amount consistency check нэмсэн.
- Idempotent update хадгалсан (`PAID` болсон order-г дахин боловсруулахгүй).
- `/api/payment/verify` endpoint-ийг `userGuard`-аар хамгаалсан.
- Verify endpoint дээр order ownership шалгалт нэмж, зөвхөн тухайн user өөрийн order-оо verify хийдэг болгосон.

Үр дүн:
- Callback болон verify endpoint найдвартай, аюулгүй болсон.

## 4.3 `backend/src/services/qpay.service.ts`
Хийсэн зүйл:
- Config өргөтгөсөн:
  - `requestTimeoutMs`,
  - `invoiceMaxRetries`.
- `QPAY_BASE_URL` normalize:
  - trailing slash арилгах,
  - `/v2` давхар орсон бол арилгах.
- Старт үед `[QPlocalhost callback нь sandbox callback-д тохирохгүй.ay Config]` structured log нэмсэн.
- Error formatter нэмсэн (`formatAxiosError`) — endpoint + status + message + data.
- Retryable error detector нэмсэн (`isRetryableAxiosError`).
- Invoice create дээр retry/backoff (`1s`, `2s`, `3s` гэх мэт) нэмсэн.
- `404` үед sandbox fallback endpoint (`/v2/invoice/test`) турших засвар нэмсэн.
- Callback URL localhost байвал warning log гаргадаг болгосон.
- `sender_branch_code: 'ONLINE'`-г payload-аас хассан.
- Refund endpoint method:
  - `DELETE /v2/payment/refund/{id}` -> `GET /v2/payment/refund/{id}` болгосон.

Үр дүн:
- Invoice create transient алдаанд илүү тэсвэртэй болсон.
- Sandbox endpoint behavior-тэй нийцэх чадвар сайжирсан.

## 4.4 `apps/store/src/pages/CheckoutPage.tsx`
Хийсэн зүйл:
- `normalizeQrCodeSrc()`:
  - raw base64 бол `data:image/png;base64,...` prefix нэмнэ.
- `normalizeBankLogoUrl()`:
  - `//` болон `http://` URL-уудыг normalize хийж `https` болгоно.
- `brokenBankLogos` state:
  - logo load fail үед fallback үсэг рүү шилжүүлнэ.
- Order create fail үед `errorData.details`-ийг давуу харуулна.

Үр дүн:
- QR үл харагдах асуудал арилсан.
- Bank logos зөв харагдах чанар сайжирсан.
- Алдааны мэдээлэл илүү ойлгомжтой болсон.

---

## 5) Тестийн үеэр гарсан гол алдаанууд ба шийдлүүд

## Алдаа 1: `/api/orders` дээр 500
Илрэл:
- Frontend console: `Failed to create order`
- Backend: `Failed to create QPay invoice`

Шалтгаан:
- QPay invoice endpoint 404/timeout,
- callback/env тохиргоо дутуу,
- error handling сул.

Шийдэл:
- QPay service retry + fallback endpoint,
- timeout-ыг config-оор өсгөсөн,
- orders route дээр fail үед order cleanup,
- frontend дээр `details` харуулдаг болгосон.

## Алдаа 2: QPay invoice endpoint 404
Илрэл:
- HTML `404 Not Found` (nginx) backend log дээр.

Шийдэл:
- Base URL normalize.
- `/v2/invoice` 404 бол sandbox-д `/v2/invoice/test` fallback турших.

## Алдаа 3: QPay invoice timeout (20s)
Илрэл:
- `status=N/A message=timeout of 20000ms exceeded`

Шийдэл:
- `QPAY_REQUEST_TIMEOUT_MS` default-ийг нэмэгдүүлсэн (45000).
- Retry/backoff нэмсэн (`QPAY_INVOICE_MAX_RETRIES`).

## Алдаа 4: QR зураг хоосон/алдаатай харагдах
Илрэл:
- Checkout payment page дээр QR хэсэг зөв render болохгүй.

Шийдэл:
- raw base64-г `data:image/png;base64,` хэлбэрт normalize хийдэг болгосон.

## Алдаа 5: Bank app зурагнууд зөв харагдахгүй
Илрэл:
- Зарим банк үсгээр гарч байсан.

Шийдэл:
- `logo` URL normalize + fallback зураг ачаалалт сайжруулалт.

## Алдаа 6: Mobile app scan хийхэд `QP2009` (“Нэхэмжлэл олдсонгүй”)
Илрэл:
- Утасны банк app дээр QR уншуулахад invoice олдохгүй мессеж.

Магадлалтай шалтгаан:
- Sandbox invoice-ийг production scanner/tab-аар уншуулах,
- test merchant орчинд дэмжигдээгүй замаар scan хийсэн,
- invoice хугацаа, app context mismatch.

Тэмдэглэл:
- API-level invoice үүсэлт амжилттай болсныг PowerShell тест баталсан.

---

## 6) Яагаад PowerShell-аар invoice үүсэж, app дотор заримдаа fail болсон бэ?
PowerShell туршилт амжилттай байсан шалтгаан:
- Token хүсэлт зөв.
- Invoice body-д шаардлагатай талбарууд (`invoice_receiver_code`, `invoice_code`, `amount`) зөв.
- QPay endpoint рүү шууд цэвэр call хийсэн.

App талд fail үүсгэсэн хүчин зүйлс:
- Callback URL localhost байх үе.
- Endpoint/network timeout (sandbox latency).
- Error/retry сул байсан анхны implementation.

Дараа нь хийсэн засваруудаар энэ зөрүүг багасгасан.

---

## 7) Амжилттай болсон эцсийн төлөв (одоогийн state)
Одоогийн хүрсэн үр дүн:
- Store checkout -> backend order -> QPay invoice create урсгал ажиллаж байна.
- Payment page дээр:
  - QR code харагдаж байна,
  - банк app-уудын list/links гарч байна,
  - order amount/summary зөв харагдаж байна.
- Backend дээр:
  - token авах логик тогтвортой,
  - invoice create retry/fallback орсон,
  - callback/verify endpoint хамгаалалт сайжирсан,
  - invoice fail үед DB cleanup хийгддэг.

---

## 8) Тест орчинд ашигласан үндсэн тохиргоо (summary)
Тест credential:
- `QPAY_BASE_URL=https://merchant-sandbox.qpay.mn`
- `QPAY_USERNAME=TEST_MERCHANT`
- `QPAY_PASSWORD=123456`
- `QPAY_INVOICE_CODE=TEST_INVOICE`

Ашигласан runtime зайлшгүй тохиргоо:
- `QPAY_MOCK_MODE=false`
- `QPAY_CALLBACK_URL=https://<public-ngrok-domain>/api/payment/callback`
- `QPAY_REQUEST_TIMEOUT_MS` (ихэвчлэн 45000)
- `QPAY_INVOICE_MAX_RETRIES` (ихэвчлэн 3)

---

## 9) Одооноос цааш production руу шилжихийн өмнө хийх зөвлөмж
1. Callback URL-г тогтмол production HTTPS domain болгох (ngrok биш).
2. Sandbox app scan болон real app scan ялгааг merchant талаас дахин баталгаажуулах.
3. QPay callback payload-д ирэх бүх хувилбарыг prod-д логжуулж хянах.
4. Payment success/failure monitoring + alert нэмэх.
5. Full end-to-end test case (create -> pay -> callback -> order status) автоматжуулах.

---

## 10) Товч дүгнэлт
QPay тест эхэлсэн үеийн гол саад нь endpoint/timeout/callback болон UI parse алдаанууд байсан.
Эдгээрийг backend ба frontend дээр системтэй зассанаар sandbox invoice flow тогтворжиж, Store app-аас тест гүйлгээний үндсэн урсгал ажиллах түвшинд хүрсэн.

