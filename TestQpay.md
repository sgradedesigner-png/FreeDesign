# TestQpay.md — QPay Sandbox олон pending invoice үүсгэх үед checkout гацах шалтгаан оношлох (CODEX Audit)

## Context
Манай Store checkout дээр нэг user-аар олон удаа тест хийгээд:
- Invoice QR code гарч ирснийг баталгаажуулна
- Тэгээд төлбөрийг sandbox дээр бодитоор дуусгахгүй (payment completion хийгдэхгүй)
- Дараа нь өөр бараа сонгоод дахин invoice үүсгэх гэж оролдоход
  - Зарим user дээр checkout “боловсруулж байна…” дээр гацах
  - Зарим user дээр хэвийн QR гарч ирэх

Бидэнд тодорхой болгох зүйл:
1) Нэг user дээр олон pending invoice/order үлдсэнээс болж систем өөрөө block хийж байна уу?
2) Эсвэл backend-ийн order/payment logic-д bug байгаа юу?
3) Frontend loading state error үед reset хийхгүйгээс “гацалт” үүсэж байна уу?

## Goal (What Codex must deliver)
1) Repo audit хийж QPay invoice үүсгэх flow, order хадгалалт, pending order reuse/cancel logic-ийг тодорхойл.
2) “Нэг user дээр олон pending order байхад” яаж handle хийж байгааг кодоор нотолж тайлбарла.
3) Checkout гацах үед network request юу болж байгааг (status code/pending) тогтоох instrumentation санал болго.
4) Concrete fix санал болго:
   - Reuse existing pending order? cancel old ones? limit per user?
   - Frontend error үед loading state reset + error toast
5) Нэмэлтээр: sandbox нөхцөлд “түр тестийн зөв workflow” санал болго (mock mode, cleanup script гэх мэт).

## Repo Recon (Codex: do this first)
### Find key files
Search:
- QPay service:
  - `backend/src/services/qpay.service.ts` (or similar)
- Orders routes:
  - `backend/src/routes/orders.ts` (or similar)
- Payment callback:
  - `backend/src/routes/payment.ts` / `backend/src/routes/payment/callback` / `qpay callback`
- Order model (Prisma):
  - `backend/prisma/schema.prisma` order fields: `paymentStatus`, `qpayInvoiceId`, `qrCode`, `qrCodeUrl`, `status`
- Frontend checkout:
  - `apps/store/src/pages/CheckoutPage.tsx` (or similar)
  - checkout submit handler `handlePlaceOrder`, `createOrder`, `createPaymentInvoice`
- Any “pending order reuse” logic:
  - search: `PENDING`, `paymentStatus`, `qpayInvoiceId`, `qrCode`, `cancel`, `delete order`, `cleanup`

Output the exact file paths you found.

## Hypotheses to Verify (must confirm with code evidence)
H1) Backend allows multiple pending orders per user and does NOT enforce limit → eventually UI can select wrong pending order or block.
H2) Backend enforces single pending per user (by querying latest pending) → but bug occurs when old pending exists (e.g., returns old QR incorrectly or tries to create new but fails).
H3) On QPay invoice create failure (timeout/502/TLS) backend deletes newly created order; frontend remains in loading state (missing finally).
H4) There’s an order creation transaction pattern:
- create order in DB
- call QPay invoice
- if fail → delete order
This is OK, but frontend must handle non-200 responses properly.
H5) Sandbox cannot complete payments so callback never updates statuses; “polling” might be stuck waiting for status change and blocks new order.

Codex must conclude which hypothesis is true with evidence.

## What to Inspect in Backend
### 1) Order creation flow
- In `orders` route, locate logic that:
  - validates user
  - creates order row
  - calls `QPayService.createInvoice(...)`
  - stores `qpayInvoiceId`, `qrCode`, `qrCodeUrl`
  - on error: deletes the order (as shown in logs previously)
- Check whether it does:
  - `findFirst` existing pending order for user and reuse it
  - or always create a new one

### 2) Pending order behavior
- Look for queries like:
  - `where: { userId, status: 'PENDING' }`
  - `paymentStatus: 'PENDING'`
- Check if there’s any unique constraint or enforcement.

### 3) Payment status update / callback
- Find callback route that receives QPay update.
- Confirm what it updates in DB:
  - `paymentStatus`, `paymentDate`, `status`
- Confirm how store “waiting payment” page checks status (polling endpoint?).

### 4) Timeouts + retries
- In QPayService: find config fields:
  - `requestTimeoutMs`
  - `invoiceMaxRetries`
- Identify where they come from (env/hardcode).
- Confirm axios/fetch timeout usage.

### 5) Network/TLS issues
We have observed on Windows:
- `curl.exe -I https://merchant-sandbox.qpay.mn` => `CRYPT_E_NO_REVOCATION_CHECK`
- PowerShell IWR => `Bad Gateway`
This implies environment/network can cause invoice create to timeout.
Codex: treat this as external factor; code must gracefully handle it.

## What to Inspect in Frontend
### 1) Checkout submit handler
- Locate the function that calls backend order creation.
- Confirm it wraps await in try/catch/finally.
- If request fails:
  - does it show error toast?
  - does it set `isLoading=false` in `finally`?
  - does it leave UI in “боловсруулж байна…”?

### 2) Response parsing
- If backend returns non-200, does frontend throw properly?
- Does it rely on specific JSON shape?

### 3) Multi pending orders
- If store has “payment page” route, does it read last order from localStorage?
- If so, old pending orders can cause wrong redirect.

## Required Diagnostics Output (Codex must add, minimal)
Add safe logging (no secrets) to confirm flow:
- backend order route:
  - log userId, created orderId, attempt number, invoice create start/end, error codes (timeout vs 502)
- frontend checkout:
  - log response status code + error message mapping

Do NOT print supabase keys / secrets / QPay password.

## Proposed Fix Options (Codex must recommend 1 and implement)
Pick ONE clear strategy (with reasoning):

### Option A — Enforce single pending order per user
Before creating a new invoice:
- query latest pending order for user within last X minutes (e.g., 30 min)
- if exists and has qrCodeUrl: return it instead of creating new
- else create a new one
Also add endpoint “Cancel pending order” for user, or auto-cancel old pending older than X minutes.

### Option B — Always create new order, but auto-cancel old pending
On create:
- mark existing pending orders for user as `CANCELLED/EXPIRED`
- then create new order+invoice

### Option C — Sandbox testing mode
Add `QPAY_MOCK_MODE=true` to fully bypass QPay network and generate fake invoice/qr for UI tests.
Also add admin script to cleanup pending orders.

Codex must implement one option in backend + required frontend adjustments.

## Acceptance Criteria
1) One user can repeatedly create invoices without UI getting stuck in “боловсруулж байна…”
2) If QPay network fails (timeout/502), frontend shows clear error and loader resets.
3) Pending orders do not accumulate indefinitely (either reuse, cancel, or expire).
4) Payment waiting page is consistent (shows the intended latest order).

## Deliverables
Codex must output:
1) Changed files list + short reason each
2) Key diffs/snippets (not whole files)
3) How to test manually:
   - create invoice multiple times with same user
   - simulate fail by disconnecting internet or setting QPay baseURL invalid
   - verify UI behavior + backend logs
4) Optional: a DB cleanup SQL snippet:
   - delete/cancel pending orders for a specific userId/email for testing

## Notes / Constraints
- Keep existing auth/role logic unchanged.
- Do not modify DB schema unless absolutely necessary; prefer code-level handling.
- Do not invent new files unless needed (if needed, keep minimal).
