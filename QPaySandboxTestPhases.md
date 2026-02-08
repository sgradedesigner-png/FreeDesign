# QPay Sandbox Real Transaction Phases

This file is for testing **real QPay sandbox API flow** from your Store app (not mock mode).

## Phase 1 - Backend readiness (implemented)
- [x] Secure manual verify endpoint with `userGuard`
  - File: `backend/src/routes/payment.ts`
- [x] Harden callback parsing for body/query variations
  - File: `backend/src/routes/payment.ts`
- [x] Add paid amount consistency check before marking order paid
  - File: `backend/src/routes/payment.ts`
- [x] Prevent orphan pending order when invoice creation fails
  - File: `backend/src/routes/orders.ts`
- [x] Align refund endpoint method with QPay V2 docs (`GET /v2/payment/refund/{payment_id}`)
  - File: `backend/src/services/qpay.service.ts`

## Phase 2 - Sandbox env setup (implemented)
Use these values in `backend/.env`:

```env
QPAY_BASE_URL=https://merchant-sandbox.qpay.mn
QPAY_USERNAME=TEST_MERCHANT
QPAY_PASSWORD=123456
QPAY_INVOICE_CODE=TEST_INVOICE
QPAY_CALLBACK_URL=http://localhost:3000/api/payment/callback
QPAY_MOCK_MODE=false
```

- [x] `QPAY_MOCK_MODE` switched to `false` in `backend/.env`

## Phase 3 - Run apps locally
1. Start backend:
   - `cd backend`
   - `npm run dev`
2. Start store app:
   - `cd apps/store`
   - `npm run dev`
3. Open Store and login with a user account.
4. Add product(s) to cart and go to checkout.

Expected backend logs:
- QPay token success message
- invoice created message with `invoice_id`

## Phase 4 - Execute real sandbox payment test
1. Submit checkout form on Store.
2. Store should show:
   - QR image
   - bank app deep-links
   - order id / amount
3. Scan QR using a supported banking/wallet app that can read QPay dynamic QR.
4. Wait for Store polling (`/api/orders/:id/payment-status`) to confirm payment.

Expected result:
- UI moves to paid state
- redirects to order details

## Phase 5 - Validate database result
Check `orders` table row for the tested order:
- `qpayInvoiceId` is set
- `paymentStatus = PAID`
- `qpayPaymentId` is set
- `paymentDate` is set
- `status = PAID`

## Phase 6 - If callback is required from QPay to localhost
If QPay cannot reach localhost callback, keep polling-based confirmation OR expose backend temporarily:

1. Run tunnel (example):
   - `ngrok http 3000`
2. Update env:
   - `QPAY_CALLBACK_URL=https://<ngrok-id>.ngrok.io/api/payment/callback`
3. Restart backend.

This allows QPay webhook callback to reach your local server.

## Known notes
- `backend npm run build` currently fails due pre-existing TypeScript issues not related to QPay:
  - `prisma/seed.ts`
  - `src/auth.ts`
- QPay test flow itself is not blocked by those files when running `npm run dev`.

