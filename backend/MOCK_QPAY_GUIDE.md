# QPay Mock Mode - Testing Guide

## Overview

QPay sandbox credentials are not working (404 errors), so I've implemented **Mock Mode** to let you test the complete checkout flow without real QPay API calls.

## How It Works

### 1. Mock Invoice Creation
- When you create an order, the system generates a **fake QPay invoice** instantly
- Returns a mock QR code (SVG image with order amount)
- Provides fake banking app deep links (Khan Bank, TDB, Golomt, Most Money)
- No API call to QPay servers - everything is simulated locally

### 2. Mock Payment Simulation
- Order starts with status: `PENDING` and payment status: `UNPAID`
- Frontend polls `/api/orders/:id/payment-status` every 5 seconds
- **After 30 seconds**, the mock service automatically simulates a successful payment
- Order status changes to: `PAID` with mock payment ID
- Payment success screen displays

## Configuration

Mock mode is controlled by environment variable in `backend/.env`:

```env
# Enable mock mode for testing (set to 'true' to bypass real QPay API)
QPAY_MOCK_MODE=true
```

**To enable mock mode:** `QPAY_MOCK_MODE=true` (currently enabled)
**To disable mock mode:** `QPAY_MOCK_MODE=false` or remove the line

## Testing the Flow

1. **Start the backend** (restart if already running):
   ```bash
   cd backend
   npm run dev
   ```

2. **Add products to cart** in store frontend

3. **Go to checkout** and fill shipping information

4. **Click "Continue to Payment"**
   - Mock QR code will display (black square with order amount)
   - Banking app links will show
   - Payment polling starts automatically

5. **Wait 30 seconds**
   - Check backend console for: `🧪 Mock payment PAID for invoice MOCK_INV_...`
   - Frontend will detect payment and show success screen
   - Cart will be cleared
   - Order status updated to PAID

## What You'll See

### Backend Console
```
🧪 QPay Mock Mode Enabled - Using fake payment responses
🧪 Mock QPay invoice created: MOCK_INV_1738943123456 for order abc-123
🧪 Mock payment UNPAID for invoice MOCK_INV_1738943123456
🧪 Mock payment UNPAID for invoice MOCK_INV_1738943123456
... (repeated every 5 seconds)
🧪 Mock payment PAID for invoice MOCK_INV_1738943123456
```

### Frontend Payment Page
- ✅ QR Code displays (mock SVG with amount)
- ✅ Banking app buttons visible
- ✅ Payment status polling active
- ✅ After 30s: Success message + redirect to orders

## Switching to Real QPay

When you get production/sandbox credentials from QPay:

1. Set `QPAY_MOCK_MODE=false` in `.env`
2. Update credentials:
   ```env
   QPAY_BASE_URL=https://merchant.qpay.mn
   QPAY_USERNAME=your_real_username
   QPAY_PASSWORD=your_real_password
   QPAY_INVOICE_CODE=your_invoice_code
   ```
3. Restart backend

## Benefits of Mock Mode

✅ Test entire checkout flow end-to-end
✅ No dependency on external QPay sandbox
✅ Predictable payment timing (always 30 seconds)
✅ No network latency or timeout issues
✅ Perfect for development and demo purposes
✅ Easy to switch to real QPay later

## Next Steps

After verifying the checkout flow works with mock mode, you can:
1. Register for real QPay merchant account
2. Get production credentials
3. Test with real banking apps
4. Go live!
