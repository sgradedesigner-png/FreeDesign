# Unpaid Order Management - Industry Best Practices & Recommendations

**Date:** 2026-02-09
**Research Question:** How do major e-commerce platforms manage unpaid/pending orders?
**Goal:** Determine optimal policy for our QPay-based e-commerce platform

---

## 📊 Industry Research Findings

### 1. Amazon

**Pending Order Lifecycle:**
- **Initial Hold:** 30 minutes minimum (anti-fraud protection)
- **Payment Fix Window:** 7 days for customers to fix payment issues
- **Maximum Duration:** 21 days total
- **Auto-Cancellation:** After 21 days, order automatically cancelled
- **Stock Management:** Stock reserved during pending period

**Key Features:**
- ✅ Customer has multiple attempts (3x) to fix payment
- ✅ Clear expiration timeline
- ✅ Automatic cleanup after 21 days
- ✅ Order visible to customer during entire period

**Sources:**
- [Amazon Pending Orders - Seller Central](https://sellercentral.amazon.com/seller-forums/discussions/t/d03f61fe-22f7-439d-a7d7-b99313762107)
- [Amazon Orders Pending Guide](https://thrivemyway.com/amazon-orders-pending/)
- [Amazon Pending Orders Comprehensive Guide](https://blog.openbridge.com/amazon-pending-orders-a-comprehensive-guide-63bd8083dd9b)

---

### 2. Shopify

**Unpaid Order Management:**
- **Status System:** "Due / Expired / Unpaid" status when payment deadline passed
- **Payment Authorization:** 7-day authorization period for Shopify Payments
- **New Feature (2026):** "Expired" status for failed subscription payments
- **Manual Control:** Merchants can collect payment or cancel orders

**Key Features:**
- ✅ Flexible merchant control
- ✅ Deferred payment support
- ✅ Payment reminder apps available
- ✅ Recent improvements to expiration handling

**Sources:**
- [Shopify Order Status Documentation](https://help.shopify.com/en/manual/fulfillment/managing-orders/order-status)
- [Shopify Order History Guide 2026](https://www.shopify.com/blog/order-history-why-keeping-track-of-customers-previous-orders-can-help-you-make-more-sales)
- [New Order Status "Expired"](https://community.shopify.dev/t/new-order-status-expired-appearing-for-failed-subscription-payments/22459)
- [Managing Deferred Payments](https://help.shopify.com/en/manual/fulfillment/managing-orders/payments/deferred-payments)

---

### 3. Saleor (Open Source E-commerce)

**Order Expiration System:**
- **Auto-Expiration:** Orders automatically expire after configured timeframe
- **Status Change:** PENDING → EXPIRED
- **Stock Release:** Inventory automatically released when expired
- **Auto-Cleanup:** Expired orders deleted after X days
- **Configurable:** Merchants set their own expiration rules

**Key Features:**
- ✅ Automatic expiration based on configuration
- ✅ Stock management automation
- ✅ Expired orders eventually deleted
- ✅ Configurable retention policy

**Source:**
- [Saleor Order Expiration Documentation](https://docs.saleor.io/developer/order/order-expiration)

---

### 4. QR Code Payment Best Practices

**General Industry Standards:**

**Dynamic vs Static QR Codes:**
- **Dynamic QR Codes:** Can have expiration times (for invoices)
- **Static QR Codes:** Never expire but can become inactive

**Payment Gateway Expiration Times:**
- **Real-time Payments:** 30 seconds to 5 minutes (cryptocurrency, instant bank transfers)
- **Standard Invoices:** 24-48 hours typical
- **Extended Invoices:** 3-7 days for B2B
- **Once Paid:** QR code immediately expires (prevents reuse)

**Security Features:**
- ⏱️ Timestamp validation
- 🔒 One-time use after payment
- 🚫 Gateway closes after expiration
- ✅ Prevents duplication/fraud

**Sources:**
- [QR Code Payment Full Guide](https://www.mindgate.solutions/guides/qr-code-payments/)
- [QR Code Expiration Explained](https://www.qr-code-generator.com/blog/do-qr-codes-expire/)
- [World Bank QR Code Payments Focus Note](https://fastpayments.worldbank.org/sites/default/files/2021-10/QR_Codes_in_Payments_Final.pdf)
- [Stripe QR Code Payments](https://stripe.com/resources/more/qr-code-payments)

---

## 🔍 Current System Analysis

### What We Have Now (Problems)

**Database Schema:**
```prisma
model Order {
  id              String      @id @default(uuid())
  status          OrderStatus @default(PENDING)
  paymentStatus   String      @default("UNPAID")
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  // ❌ NO expiration field
  // ❌ NO invoice expiry tracking
}
```

**QPay Integration:**
```typescript
// backend/src/services/qpay.service.ts (line 501)
enable_expiry: 'false',  // ❌ Invoices NEVER expire
```

**Current Behavior:**
- ❌ Orders stored **indefinitely** (no cleanup)
- ❌ QPay invoices **never expire**
- ❌ No automatic cancellation
- ❌ No expiration warnings
- ❌ No cleanup job/cron
- ✅ Orders visible to users forever
- ✅ Admin can manually cancel (admin panel)

**Consequences:**
1. **Database Bloat:** Unpaid orders accumulate forever
2. **Stock Issues:** Inventory locked indefinitely
3. **Customer Confusion:** Old unpaid orders clutter order history
4. **Payment Gateway Risk:** QR codes work forever (security risk)
5. **No Urgency:** Customers have no deadline to pay

---

## 🎯 Recommended Solution

### Option 1: Industry Standard (Recommended)

**Timeline:**
```
Order Created
    ↓
[0-24 hours] - Active invoice, QR code works
    ↓
[24 hours] - Warning: "Invoice expires in 24 hours"
    ↓
[48 hours] - Invoice EXPIRED, order status → EXPIRED
    ↓
[7 days] - Order visible but marked expired
    ↓
[30 days] - Order archived/soft-deleted
    ↓
[90 days] - Order permanently deleted (optional)
```

**Implementation Details:**

**1. Database Schema Changes:**
```prisma
model Order {
  id                String      @id @default(uuid())
  status            OrderStatus @default(PENDING)
  paymentStatus     String      @default("UNPAID")

  // NEW FIELDS
  qpayInvoiceExpiresAt DateTime?   // QPay invoice expiration time
  expiredAt            DateTime?   // When order expired
  archivedAt           DateTime?   // When order archived

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([qpayInvoiceExpiresAt])
  @@index([expiredAt])
}

enum OrderStatus {
  PENDING
  PAID
  EXPIRED          // NEW: Invoice expired
  CANCELLED
  SHIPPED
  COMPLETED
  CANCELLING
  CANCELLATION_FAILED
}
```

**2. QPay Service Update:**
```typescript
// backend/src/services/qpay.service.ts
{
  invoice_code: params.invoiceCode,
  invoice_description: params.description,
  amount: params.amount,
  callback_url: params.callbackUrl,
  enable_expiry: 'true',     // ENABLE EXPIRY
  expiry_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
  allow_partial: false,
  allow_exceed: false,
}
```

**3. Order Creation Update:**
```typescript
// backend/src/routes/orders.ts
const qpayInvoiceExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

const updatedOrder = await prisma.order.update({
  where: { id: order.id },
  data: {
    qpayInvoiceId: qpayInvoice.invoice_id,
    qrCode: qpayInvoice.qr_image,
    qrCodeUrl: qpayInvoice.qPay_shortUrl,
    qrText: qpayInvoice.qr_text,
    qpayInvoiceExpiresAt: qpayInvoiceExpiresAt  // NEW
  }
});
```

**4. Cron Job for Expiration (Node-cron):**
```typescript
// backend/src/jobs/expireOrders.ts
import cron from 'node-cron';
import { prisma } from '../lib/prisma';

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('🔍 Checking for expired orders...');

  const now = new Date();

  // Find orders with expired invoices
  const expiredOrders = await prisma.order.findMany({
    where: {
      paymentStatus: 'UNPAID',
      status: 'PENDING',
      qpayInvoiceExpiresAt: {
        lte: now  // Expiry time passed
      }
    }
  });

  // Mark as EXPIRED
  for (const order of expiredOrders) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'EXPIRED',
        expiredAt: now
      }
    });

    console.log(`⏰ Order ${order.id} marked as EXPIRED`);
  }

  console.log(`✅ Marked ${expiredOrders.length} orders as expired`);
});

// Archive old expired orders (keep visible for 7 days)
cron.schedule('0 2 * * *', async () => {  // Run daily at 2 AM
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.order.updateMany({
    where: {
      status: 'EXPIRED',
      expiredAt: {
        lte: sevenDaysAgo
      },
      archivedAt: null
    },
    data: {
      archivedAt: new Date()
    }
  });

  console.log(`📦 Archived ${result.count} expired orders`);
});

// Optional: Delete very old archived orders (30+ days)
cron.schedule('0 3 * * 0', async () => {  // Run weekly on Sunday at 3 AM
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.order.deleteMany({
    where: {
      status: 'EXPIRED',
      archivedAt: {
        lte: thirtyDaysAgo
      }
    }
  });

  console.log(`🗑️ Deleted ${result.count} old expired orders`);
});
```

**5. Frontend Warning UI:**
```tsx
// apps/store/src/pages/OrderDetailPage.tsx
{order.paymentStatus === 'UNPAID' && order.qpayInvoiceExpiresAt && (
  <>
    {/* Calculate time remaining */}
    {(() => {
      const now = new Date();
      const expiresAt = new Date(order.qpayInvoiceExpiresAt);
      const hoursRemaining = Math.floor((expiresAt - now) / (1000 * 60 * 60));
      const isExpiringSoon = hoursRemaining <= 24 && hoursRemaining > 0;
      const isExpired = hoursRemaining <= 0;

      if (isExpired) {
        return (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border-2 border-red-500 rounded-lg mb-4">
            <p className="text-red-700 dark:text-red-300 font-semibold">
              ⚠️ Энэ захиалгын төлбөрийн хугацаа дууссан байна
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Шинэ захиалга үүсгэх шаардлагатай
            </p>
          </div>
        );
      }

      if (isExpiringSoon) {
        return (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-500 rounded-lg mb-4">
            <p className="text-yellow-700 dark:text-yellow-300 font-semibold">
              ⏰ Төлбөрийн хугацаа дуусахад {hoursRemaining} цаг үлдлээ
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              Та яаралтай төлбөрөө төлнө үү
            </p>
          </div>
        );
      }

      return (
        <p className="text-xs text-muted-foreground mb-2">
          Төлбөрийн хугацаа: {expiresAt.toLocaleString('mn-MN')}
        </p>
      );
    })()}
  </>
)}
```

---

### Option 2: Flexible Configuration (Advanced)

**Allow merchants to configure:**
- Invoice expiration time (24h, 48h, 72h, 7 days, never)
- Expired order visibility (hide immediately, 7 days, 30 days)
- Auto-delete policy (never, 30 days, 90 days)
- Stock release on expiration (yes/no)

**Implementation:**
```typescript
// backend/.env
QPAY_INVOICE_EXPIRY_HOURS=48          # Default: 48 hours
ORDER_EXPIRED_VISIBILITY_DAYS=7        # Show expired orders for 7 days
ORDER_AUTO_DELETE_DAYS=30              # Delete after 30 days
```

---

## 📋 Comparison Table

| Platform | Initial Hold | Max Duration | Auto-Cancel | Stock Release | Cleanup |
|----------|-------------|--------------|-------------|---------------|---------|
| **Amazon** | 30 min | 21 days | ✅ Yes | ✅ Yes | ✅ Auto |
| **Shopify** | Varies | 7-14 days | ⚠️ Manual | ✅ Yes | ⚠️ Manual |
| **Saleor** | Configurable | Configurable | ✅ Yes | ✅ Yes | ✅ Auto |
| **Our System (Current)** | None | ∞ Forever | ❌ No | ❌ No | ❌ No |
| **Recommended** | None | 48h expire, 7d visible, 30d delete | ✅ Yes | ✅ Yes | ✅ Auto |

---

## 💡 Recommendations Summary

### Immediate Actions (Phase 1 - This Week)

1. **Enable QPay Invoice Expiration**
   - Change `enable_expiry: 'true'`
   - Set expiry to 48 hours
   - Add `qpayInvoiceExpiresAt` field to Order model

2. **Add Frontend Warning**
   - Show expiration countdown
   - Warning when < 24 hours remain
   - Error message when expired

3. **Add Admin Dashboard Stats**
   - Count of unpaid orders
   - Count of expired orders
   - Orders expiring in next 24h

### Medium-Term (Phase 2 - Next 2 Weeks)

4. **Implement Cron Jobs**
   - Hourly: Mark expired orders
   - Daily: Archive old expired orders
   - Weekly: Delete very old orders

5. **Email Notifications**
   - 24h before expiry: "Complete your payment"
   - On expiry: "Your order expired"

6. **Order Regeneration**
   - "Create New Order" button for expired orders
   - Copy items from expired order
   - Generate new QPay invoice

### Long-Term (Phase 3 - Next Month)

7. **Analytics Dashboard**
   - Expiration rate tracking
   - Payment completion timeline analysis
   - Optimize expiration duration based on data

8. **Stock Management Integration**
   - Release stock on expiration
   - Reserve stock for active orders only
   - Low stock warnings

---

## 🎯 Recommended Timeline

**48 Hours** is the industry sweet spot:
- ✅ Gives customers enough time (2 days)
- ✅ Not too long (prevents database bloat)
- ✅ Creates urgency (encourages payment)
- ✅ Matches common payment gateway practices
- ✅ Aligns with QPay capabilities

**Why not longer?**
- 7 days: Too long, customers forget
- 21 days: Database bloat, stock issues
- Forever: System management nightmare

**Why not shorter?**
- 24 hours: Not enough time for some customers
- 12 hours: Too strict, high abandonment
- Real-time (5 min): Only for specific use cases

---

## 🚀 Implementation Priority

**High Priority (Do Now):**
- ✅ Enable QPay invoice expiration (48h)
- ✅ Add expiration field to database
- ✅ Show expiration warning to users

**Medium Priority (This Month):**
- ⚠️ Cron job for auto-expiration
- ⚠️ Email notifications
- ⚠️ Order regeneration feature

**Low Priority (Future):**
- 📊 Analytics dashboard
- 🔧 Configurable expiration times
- 📦 Advanced stock management

---

## 📚 Sources

**Amazon:**
- [Seller Central: Pending Orders Duration](https://sellercentral.amazon.com/seller-forums/discussions/t/d03f61fe-22f7-439d-a7d7-b99313762107)
- [Amazon Orders Pending Guide](https://thrivemyway.com/amazon-orders-pending/)
- [Comprehensive Amazon Pending Orders](https://blog.openbridge.com/amazon-pending-orders-a-comprehensive-guide-63bd8083dd9b)

**Shopify:**
- [Understanding Order Statuses](https://help.shopify.com/en/manual/fulfillment/managing-orders/order-status)
- [Order History Guide 2026](https://www.shopify.com/blog/order-history-why-keeping-track-of-customers-previous-orders-can-help-you-make-more-sales)
- [New Expired Order Status](https://community.shopify.dev/t/new-order-status-expired-appearing-for-failed-subscription-payments/22459)
- [Managing Deferred Payments](https://help.shopify.com/en/manual/fulfillment/managing-orders/payments/deferred-payments)

**Saleor:**
- [Order Expiration Documentation](https://docs.saleor.io/developer/order/order-expiration)

**QR Code Payments:**
- [QR Code Payment Full Guide](https://www.mindgate.solutions/guides/qr-code-payments/)
- [QR Code Expiration Explained](https://www.qr-code-generator.com/blog/do-qr-codes-expire/)
- [World Bank QR Payments Report](https://fastpayments.worldbank.org/sites/default/files/2021-10/QR_Codes_in_Payments_Final.pdf)
- [Stripe QR Code Payments](https://stripe.com/resources/more/qr-code-payments/)
- [QR Code Payments Best Practices](https://www.cs-cart.com/blog/qr-code-payments/)
- [MONEI QR Code Guide](https://monei.com/blog/qr-code-payments/)

---

**Prepared by:** Claude Sonnet 4.5
**Date:** 2026-02-09
**Status:** Research Complete - Ready for Implementation
**Recommended Action:** Implement Phase 1 (48h expiration) this week
