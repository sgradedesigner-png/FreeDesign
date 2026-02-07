# ProductionQPayMongolia.md

## 1) Goal
This document explains:
- how QPay API flow works (based on `https://developer.qpay.mn`),
- whether your current backend can run in production by only replacing `.env`,
- what code changes are required for a safe production rollout.

---

## 2) What I read from QPay Developer Docs
From the menu and endpoint docs on `developer.qpay.mn`:
- Introduction
- Token request
- Token refresh request
- Create invoice
- Create test invoice
- Get invoice
- Cancel invoice
- Get payment
- Check payment
- Cancel payment
- Refund payment
- Payment list

Official sandbox base in docs:
- `https://merchant-sandbox.qpay.mn`

Main endpoints shown in docs:

### Auth
- `POST /v2/auth/token`
  - Basic auth with merchant username/password
  - returns `access_token`, `refresh_token`, `expires_in`
- `POST /v2/auth/refresh`
  - Bearer refresh token
  - returns new tokens

### Invoice
- `POST /v2/invoice`
  - request includes: `invoice_code`, `sender_invoice_no`, `invoice_receiver_code`, `invoice_description`, `amount`, `callback_url`
  - response includes: `invoice_id`, `qr_text`, `qr_image`, `qPay_shortUrl`, `urls[]`
- `GET /v2/invoice/{invoice_id}`
- `DELETE /v2/invoice/{invoice_id}`

### Payment
- `GET /v2/payment/{payment_id}`
- `POST /v2/payment/check`
  - uses object type/id and pagination object
- `GET /v2/payment/cancel/{payment_id}`
- `GET /v2/payment/refund/{payment_id}`
- `GET /v2/payment/list`

Important note for your code:
- QPay docs show `payment/refund` as `GET`, but your code currently uses `DELETE`.

---

## 3) Current code audit (your repo)

### Implemented files
- `backend/src/services/qpay.service.ts`
- `backend/src/routes/orders.ts`
- `backend/src/routes/payment.ts`
- `backend/prisma/schema.prisma`
- `apps/store/src/pages/CheckoutPage.tsx`

### Current env state
`backend/.env` currently has:
- sandbox URL
- test credentials
- `QPAY_MOCK_MODE=true`

So at this moment, your app is still in mock flow and not real QPay production flow.

### Good things already implemented
- token + refresh handling
- invoice creation
- payment status polling from frontend
- storing invoice/payment fields in `orders`

---

## 4) Can you run production by only replacing `.env`?

## Short answer
- **Partly yes for basic live payment attempts**
- **No for production-grade reliability/security**

If you only replace credentials and base URL, real calls can start. But there are critical gaps that should be fixed before going live.

---

## 5) Required changes before production

### A. Env and deployment (mandatory)
1. Set:
   - `QPAY_MOCK_MODE=false`
2. Set real merchant values:
   - `QPAY_BASE_URL`
   - `QPAY_USERNAME`
   - `QPAY_PASSWORD`
   - `QPAY_INVOICE_CODE`
3. Set public callback URL:
   - `QPAY_CALLBACK_URL=https://<your-domain>/api/payment/callback`
4. Ensure backend is publicly reachable with HTTPS.

### B. Fix endpoint method mismatch (mandatory)
File: `backend/src/services/qpay.service.ts`

Current:
- `refundPayment()` uses `DELETE /v2/payment/refund/{payment_id}`

Docs indicate:
- `GET /v2/payment/refund/{payment_id}`

Action:
- change refund request method to match QPay docs for your merchant environment.

### C. Callback hardening (mandatory)
File: `backend/src/routes/payment.ts`

Current callback route accepts only POST body fields.

Production action:
- accept both query and body payload keys (`payment_id`, `invoice_id`, `sender_invoice_no/order_id` variants)
- validate that paid amount equals order total before marking order as PAID
- store QPay response payload for audit
- keep idempotent update (do not double-process same payment)

### D. Protect manual verify endpoint (mandatory)
File: `backend/src/routes/payment.ts`

Current `/api/payment/verify` has no auth guard.

Risk:
- anyone can probe any order id.

Action:
- add `userGuard`
- verify order belongs to the current user

### E. Order+invoice consistency (mandatory)
File: `backend/src/routes/orders.ts`

Current flow creates DB order first, then calls QPay invoice.
If QPay fails, orphan PENDING order may remain.

Action options:
- wrap with transaction + rollback/cleanup on invoice failure
- or create order as `INITIATED`, then promote only after invoice success

### F. Production observability (mandatory)
- structured logs with `orderId`, `invoiceId`, `paymentId`
- alerting on callback failures and payment check errors
- retry policy for transient network errors

---

## 6) Recommended improvements (strongly recommended)
1. Add webhook authenticity control:
   - IP allowlist and/or signature validation if provided by QPay agreement.
2. Add payment timeout policy:
   - auto-cancel stale unpaid invoices/orders.
3. Add refund/cancel admin flows with strict role checks.
4. Add integration tests for token, invoice, payment-check, callback idempotency.

---

## 7) Step-by-step rollout plan

## Phase 1: Pre-production sandbox with real (non-mock) credentials
1. Request sandbox credentials from QPay.
2. Set `QPAY_MOCK_MODE=false`.
3. Use sandbox base URL.
4. Test full checkout + QR + payment check.
5. Verify DB fields (`qpayInvoiceId`, `paymentStatus`, `qpayPaymentId`, `paymentDate`).

## Phase 2: Code hardening
1. Fix refund method mismatch.
2. Harden callback parsing/validation.
3. Protect `/api/payment/verify` with user auth + ownership.
4. Add consistency handling for order create/invoice create.

## Phase 3: Production cutover
1. Set production QPay credentials.
2. Set production callback URL.
3. Deploy backend with HTTPS and monitoring.
4. Run low-value live transaction test.
5. Enable full traffic.

---

## 8) Example production env (template)
```env
QPAY_MOCK_MODE=false
QPAY_BASE_URL=https://merchant.qpay.mn
QPAY_USERNAME=<from-qpay>
QPAY_PASSWORD=<from-qpay>
QPAY_INVOICE_CODE=<from-qpay>
QPAY_CALLBACK_URL=https://api.yourdomain.com/api/payment/callback
```

Note:
- If QPay assigns a different production host for your merchant account, use that exact host from QPay onboarding, not a guessed value.

---

## 9) Final verdict for your current backend
You are close. The architecture is correct, but **do not go live by env swap only**.
Do this minimum first:
- disable mock mode,
- fix refund method,
- secure verify endpoint,
- harden callback + amount validation,
- handle order/invoice consistency.

After these, production rollout is realistic and safe.

---

## Sources
- QPay Developer Docs: `https://developer.qpay.mn/#intro`
- QPay endpoint sections:
  - `https://developer.qpay.mn/#auth-token`
  - `https://developer.qpay.mn/#auth-refresh`
  - `https://developer.qpay.mn/#invoice`
  - `https://developer.qpay.mn/#payment-check`
  - `https://developer.qpay.mn/#payment-refund`
  - `https://developer.qpay.mn/#payment-list`
