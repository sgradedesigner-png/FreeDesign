# 🔧 Production Deployment Засварын План

**Төсөл:** E-commerce Platform with QPay Integration
**Огноо үүсгэсэн:** 2026-02-08
**Статус:** 🔴 NOT PRODUCTION READY
**Нийт хугацаа:** 2-3 долоо хоног

---

## 📋 Агуулга

1. [Phase 1: CRITICAL Fixes (1 долоо хоног)](#phase-1-critical-fixes)
2. [Phase 2: HIGH Priority Fixes (1 долоо хоног)](#phase-2-high-priority-fixes)
3. [Phase 3: Testing & Validation (3-5 хоног)](#phase-3-testing--validation)
4. [Phase 4: Production Deployment (2 хоног)](#phase-4-production-deployment)

---

## Phase 1: CRITICAL Fixes (1 долоо хоног)

### ✅ Task 1.1: Payment Polling Timeout (Өдөр 1-2)

**Файл:** `apps/store/src/pages/CheckoutPage.tsx`

#### Step 1: Polling хязгаар нэмэх
```typescript
// Line 90-98-ыг солих
useEffect(() => {
  if (!orderId || paymentStatus !== 'pending') return;

  let pollCount = 0;
  const MAX_POLLS = 60; // 5 минут (60 * 5 секунд)
  const startTime = Date.now();
  const MAX_DURATION = 5 * 60 * 1000; // 5 минут миллисекундээр

  const interval = setInterval(async () => {
    pollCount++;
    const elapsed = Date.now() - startTime;

    // Хугацаа хэтэрсэн эсэхийг шалгах
    if (pollCount >= MAX_POLLS || elapsed >= MAX_DURATION) {
      clearInterval(interval);
      setPaymentStatus('timeout');
      toast.error('Төлбөрийн баталгаажуулалт хугацаа хэтэрсэн. Дахин оролдоно уу.');
      return;
    }

    try {
      await checkPaymentStatus();
    } catch (error) {
      console.error('Payment check failed:', error);
      // Continue polling даруй зогсохгүй
    }
  }, 5000);

  return () => clearInterval(interval);
}, [orderId, paymentStatus, checkPaymentStatus]);
```

#### Step 2: Timeout UI нэмэх
```typescript
// Timeout харуулах JSX нэмэх
{paymentStatus === 'timeout' && (
  <div className="error-container">
    <p>Төлбөрийн баталгаажуулалт хугацаа хэтэрсэн</p>
    <button onClick={() => {
      setPaymentStatus('pending');
      checkPaymentStatus();
    }}>
      Дахин шалгах
    </button>
    <button onClick={() => navigate('/orders')}>
      Захиалгууд руу буцах
    </button>
  </div>
)}
```

#### Step 3: Exponential backoff нэмэх (Optional)
```typescript
const getBackoffDelay = (attempt: number) => {
  // 5s, 5s, 10s, 10s, 15s, 15s...
  return Math.min(5000 + Math.floor(attempt / 2) * 5000, 15000);
};

let nextDelay = getBackoffDelay(pollCount);
setTimeout(() => checkPaymentStatus(), nextDelay);
```

#### Шалгах:
- [ ] Polling 5 минутын дараа зогсдог
- [ ] Timeout бол хэрэглэгчид мэдэгдэл гарч байна
- [ ] "Дахин шалгах" товч ажиллаж байна
- [ ] Console warning байхгүй

---

### ✅ Task 1.2: Order Creation Race Condition (Өдөр 2-3)

**Файл:** `backend/src/routes/orders.ts`

#### Step 1: Transaction-д шилжүүлэх
```typescript
// Line 42-81-ыг бүхэлд нь солих

fastify.post('/api/orders', {
  preHandler: [userGuard]
}, async (request, reply) => {
  const userId = (request as any).user.id;
  const { items, shippingAddress, total } = request.body as any;

  try {
    // Transaction ашиглан race condition-ыг шийдэх
    const newOrder = await prisma.$transaction(async (tx) => {
      // 1. Pending orders-ыг олох
      const existingPending = await tx.order.findMany({
        where: {
          userId,
          status: 'PENDING',
          paymentStatus: {
            in: ['PENDING', 'UNPAID']
          }
        },
        select: {
          id: true,
          qpayInvoiceId: true
        }
      });

      // 2. Эхлээд CANCELLING статус өгөх (Race condition-ыг таслах)
      if (existingPending.length > 0) {
        await tx.order.updateMany({
          where: {
            id: {
              in: existingPending.map(o => o.id)
            }
          },
          data: {
            status: 'CANCELLING',
            updatedAt: new Date()
          }
        });
      }

      // 3. Шинэ order үүсгэх
      const orderItems = items.map((item: any) => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      const order = await tx.order.create({
        data: {
          userId,
          items: {
            create: orderItems
          },
          shippingAddress,
          total,
          status: 'PENDING',
          paymentStatus: 'PENDING'
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // 4. QPay invoice үүсгэх
      const qpayInvoice = await qpayService.createInvoice({
        amount: total,
        description: `Order #${order.id}`,
        orderId: order.id
      });

      // 5. Order-д invoice info нэмэх
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          qpayInvoiceId: qpayInvoice.invoice_id,
          qpayQrCode: qpayInvoice.qr_image,
          qpayDeeplinks: qpayInvoice.deeplinks || []
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // 6. Background process-д хуучин invoice-үүдийг цуцлах
      setImmediate(() => {
        existingPending.forEach(oldOrder => {
          if (oldOrder.qpayInvoiceId) {
            qpayService.cancelInvoiceWithTimeout(oldOrder.qpayInvoiceId, 5000)
              .then(() => {
                // Амжилттай цуцалсан бол CANCELLED статус өгөх
                prisma.order.update({
                  where: { id: oldOrder.id },
                  data: { status: 'CANCELLED' }
                }).catch(err => console.error('Failed to update cancelled order:', err));
              })
              .catch(err => {
                console.error('Failed to cancel old invoice:', err);
                // Invoice цуцлагдаагүй бол CANCELLATION_FAILED статус
                prisma.order.update({
                  where: { id: oldOrder.id },
                  data: { status: 'CANCELLATION_FAILED' }
                }).catch(e => console.error('Failed to mark cancellation failed:', e));
              });
          }
        });
      });

      return updatedOrder;
    }, {
      timeout: 15000, // 15 секундын timeout
      isolationLevel: 'Serializable' // Хамгийн сайн isolation level
    });

    return reply.send(newOrder);

  } catch (error) {
    console.error('Order creation failed:', error);

    if (error instanceof Error && error.message.includes('timeout')) {
      return reply.status(408).send({
        error: 'Order creation timeout',
        message: 'Захиалга үүсгэх хугацаа хэтэрсэн. Дахин оролдоно уу.'
      });
    }

    return reply.status(500).send({
      error: 'Failed to create order',
      message: 'Захиалга үүсгэхэд алдаа гарлаа'
    });
  }
});
```

#### Step 2: Order status ENUM-д шинэ төлвүүд нэмэх

**Файл:** `backend/prisma/schema.prisma`

```prisma
enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  CANCELLING      // ШИНЭ: Цуцлах процесст байгаа
  CANCELLATION_FAILED // ШИНЭ: Цуцлах амжилтгүй болсон
  FAILED
}
```

#### Step 3: Migration хийх
```bash
cd backend
npx prisma migrate dev --name add-cancelling-status
npx prisma generate
```

#### Шалгах:
- [ ] Checkout товчийг 2 удаа дарахад зөвхөн 1 order үүснэ
- [ ] Хуучин pending orders автоматаар CANCELLING статус авна
- [ ] QPay invoice цуцлалт background-д явагдана
- [ ] Transaction rollback хийгдэх үед бүх өөрчлөлт буцна
- [ ] 15 секундын timeout дээр 408 error буцаана

---

### ✅ Task 1.3: Webhook Idempotency (Өдөр 3-4)

**Файл:** `backend/prisma/schema.prisma`

#### Step 1: PaymentWebhookLog model үүсгэх
```prisma
model PaymentWebhookLog {
  id          String   @id @default(cuid())
  paymentId   String   @unique  // QPay-ээс ирсэн payment_id
  invoiceId   String
  orderId     String?
  status      String   // success, failed, duplicate
  payload     Json     // Бүх webhook data
  receivedAt  DateTime @default(now())
  processedAt DateTime?
  error       String?  // Алдааны мэдээлэл

  @@index([invoiceId])
  @@index([receivedAt])
  @@map("payment_webhook_logs")
}
```

#### Step 2: Migration хийх
```bash
npx prisma migrate dev --name add-webhook-idempotency
npx prisma generate
```

#### Step 3: Webhook handler засах

**Файл:** `backend/src/routes/payment.ts`

```typescript
// Line 26-127-ыг солих

fastify.post('/api/payment/callback', async (request, reply) => {
  const rawBody = request.body as any;

  console.log('=== QPay Webhook Received ===');
  console.log('Payload:', JSON.stringify(rawBody, null, 2));

  try {
    // 1. Payload шалгах
    const { payment_id, invoice_id, payment_status } = rawBody;

    if (!payment_id || !invoice_id) {
      return reply.status(400).send({
        error: 'Invalid webhook payload',
        message: 'payment_id болон invoice_id шаардлагатай'
      });
    }

    // 2. Idempotency шалгах - Transaction ашиглах
    const result = await prisma.$transaction(async (tx) => {
      // Webhook өмнө ирсэн эсэхийг шалгах
      const existingLog = await tx.paymentWebhookLog.findUnique({
        where: { paymentId: payment_id }
      });

      if (existingLog) {
        console.log('Duplicate webhook detected:', payment_id);
        return {
          isDuplicate: true,
          log: existingLog
        };
      }

      // Шинэ webhook log үүсгэх
      const webhookLog = await tx.paymentWebhookLog.create({
        data: {
          paymentId: payment_id,
          invoiceId: invoice_id,
          payload: rawBody,
          status: 'processing'
        }
      });

      // Order олох
      const order = await tx.order.findFirst({
        where: { qpayInvoiceId: invoice_id }
      });

      if (!order) {
        await tx.paymentWebhookLog.update({
          where: { id: webhookLog.id },
          data: {
            status: 'failed',
            error: 'Order not found',
            processedAt: new Date()
          }
        });

        throw new Error('Order not found for invoice: ' + invoice_id);
      }

      // Order update хийх
      if (payment_status === 'PAID' && order.paymentStatus !== 'PAID') {
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            status: 'PROCESSING',
            paidAt: new Date()
          }
        });

        // Webhook log-ыг амжилттай гэж тэмдэглэх
        await tx.paymentWebhookLog.update({
          where: { id: webhookLog.id },
          data: {
            orderId: order.id,
            status: 'success',
            processedAt: new Date()
          }
        });

        return {
          isDuplicate: false,
          order,
          webhookLog
        };
      }

      // Order аль хэдийн paid бол
      if (order.paymentStatus === 'PAID') {
        await tx.paymentWebhookLog.update({
          where: { id: webhookLog.id },
          data: {
            orderId: order.id,
            status: 'duplicate',
            error: 'Order already paid',
            processedAt: new Date()
          }
        });

        return {
          isDuplicate: true,
          order,
          webhookLog
        };
      }

      return {
        isDuplicate: false,
        order,
        webhookLog
      };
    });

    // Response буцаах
    if (result.isDuplicate) {
      return reply.send({
        status: 'duplicate',
        message: 'Webhook already processed',
        order_id: result.log?.orderId || result.order?.id
      });
    }

    return reply.send({
      status: 'success',
      message: 'Payment confirmed',
      order_id: result.order.id
    });

  } catch (error) {
    console.error('Webhook processing error:', error);

    return reply.status(500).send({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

#### Шалгах:
- [ ] Ижил payment_id давхар ирэхэд "duplicate" буцаана
- [ ] Webhook log database-д хадгалагдаж байна
- [ ] Order төлөв зөв шинэчлэгдэж байна
- [ ] Transaction rollback ажиллаж байна
- [ ] Webhook history харагдаж байна (admin panel-аас)

---

### ✅ Task 1.4: Database Connection Pooling (Өдөр 4)

**Файл:** `backend/src/lib/prisma.ts`

#### Step 1: Prisma client засах
```typescript
import { PrismaClient } from '@prisma/client';

// Singleton pattern
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Disconnecting Prisma...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Disconnecting Prisma...');
  await prisma.$disconnect();
  process.exit(0);
});

// Health check helper
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}
```

#### Step 2: .env засах
```bash
# DATABASE_URL дээр connection pool параметрүүд нэмэх

# Production
DATABASE_URL="postgresql://user:password@host:5432/dbname?connection_limit=20&pool_timeout=10&connect_timeout=5"

# Development
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?connection_limit=10&pool_timeout=10"
```

#### Step 3: Health check endpoint нэмэх

**Файл:** `backend/src/app.ts`

```typescript
// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const dbConnected = await checkDatabaseConnection();

  if (!dbConnected) {
    return reply.status(503).send({
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }

  return reply.send({
    status: 'healthy',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

// Readiness check (for Kubernetes/Docker)
fastify.get('/ready', async (request, reply) => {
  const dbConnected = await checkDatabaseConnection();

  if (!dbConnected) {
    return reply.status(503).send({ ready: false });
  }

  return reply.send({ ready: true });
});
```

#### Step 4: Давхардсан PrismaClient-үүдийг устгах

**Шалгах файлууд:**
```bash
# Бүх файлд "new PrismaClient()" хайх
grep -r "new PrismaClient" backend/src/
```

**Засварлах:** `new PrismaClient()` бүгдийг `import { prisma } from '../lib/prisma'` болгох

Жишээ (`backend/src/routes/products.ts:5`):
```typescript
// Хуучин - УСТГАХ
const prisma = new PrismaClient();

// Шинэ - АШИГЛАХ
import { prisma } from '../lib/prisma';
```

#### Шалгах:
- [ ] `/health` endpoint ажиллаж байна
- [ ] Connection pool limit ажиллаж байна (20 connections)
- [ ] Graceful shutdown ажиллаж байна (SIGTERM, SIGINT)
- [ ] Давхар PrismaClient instance байхгүй
- [ ] Development болон production environment хоёрт ажиллаж байна

---

### ✅ Task 1.5: Frontend Error Boundaries (Өдөр 5)

**Файл:** `apps/store/src/components/ErrorBoundary.tsx` (Шинэ)

#### Step 1: ErrorBoundary component үүсгэх
```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);

    // Production дээр Sentry-руу илгээх
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry
      // Sentry.captureException(error, { extra: errorInfo });
    }

    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h1 className="mt-4 text-2xl font-bold text-gray-900">
                Алдаа гарлаа
              </h1>
              <p className="mt-2 text-gray-600">
                Уучлаарай, ямар нэг алдаа гарсан байна.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500">
                    Алдааны дэлгэрэнгүй
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {this.state.error.toString()}
                    {'\n\n'}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              <div className="mt-6 space-y-3">
                <button
                  onClick={this.handleReset}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                >
                  Нүүр хуудас руу буцах
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300"
                >
                  Хуудас дахин ачаалах
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### Step 2: App.tsx-д нэмэх

**Файл:** `apps/store/src/App.tsx`

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <CartProvider>
        <Router>
          <Routes>
            {/* ... бүх routes ... */}
          </Routes>
        </Router>
      </CartProvider>
    </ErrorBoundary>
  );
}
```

#### Step 3: Route-specific error boundaries

**Файл:** `apps/store/src/pages/CheckoutPage.tsx`

```typescript
// CheckoutPage-ыг ErrorBoundary-д ороох
export default function CheckoutPageWrapper() {
  return (
    <ErrorBoundary
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <h2 className="text-red-800 font-semibold">Checkout алдаа</h2>
            <p className="text-red-600 mt-2">
              Төлбөрийн хуудас ачаалахад алдаа гарлаа.
            </p>
            <button
              onClick={() => window.location.href = '/cart'}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded"
            >
              Сагс руу буцах
            </button>
          </div>
        </div>
      }
    >
      <CheckoutPage />
    </ErrorBoundary>
  );
}
```

#### Шалгах:
- [ ] Component алдаа гарахад ErrorBoundary catch хийнэ
- [ ] Хэрэглэгч ойлгомжтой алдааны мэдэгдэл харна
- [ ] "Нүүр хуудас руу буцах" товч ажиллана
- [ ] Development дээр алдааны stack trace харагдана
- [ ] Production дээр stack trace харагдахгүй

---

### ✅ Task 1.6: useEffect Dependencies Засах (Өдөр 6-7)

#### Step 1: CheckoutPage dependencies засах

**Файл:** `apps/store/src/pages/CheckoutPage.tsx`

```typescript
// checkPaymentStatus function-ыг useCallback-д ороох
const checkPaymentStatus = useCallback(async () => {
  if (!orderId) return;

  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/orders/${orderId}/payment-status`,
      {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Payment status check failed');
    }

    const data = await response.json();

    if (data.paid) {
      setPaymentStatus('paid');

      try {
        clearCart();
      } catch (error) {
        console.error('Failed to clear cart:', error);
      }

      sessionStorage.removeItem('checkout-shipping-info');

      setTimeout(() => {
        if (orderId) {
          navigate(`/orders/${orderId}`);
        }
      }, 2000);
    }
  } catch (error) {
    console.error('Payment check error:', error);
    setPaymentStatus('failed');
    toast.error('Төлбөрийн төлөв шалгахад алдаа гарлаа');
  }
}, [orderId, session, clearCart, navigate]); // Бүх dependencies оруулах

// useEffect-д найдваартай dependencies
useEffect(() => {
  if (!orderId || paymentStatus !== 'pending') return;

  let pollCount = 0;
  const MAX_POLLS = 60;

  const interval = setInterval(async () => {
    pollCount++;
    if (pollCount >= MAX_POLLS) {
      clearInterval(interval);
      setPaymentStatus('timeout');
      return;
    }
    await checkPaymentStatus();
  }, 5000);

  return () => clearInterval(interval);
}, [orderId, paymentStatus, checkPaymentStatus]); // checkPaymentStatus нэмсэн
```

#### Step 2: CartContext localStorage race condition засах

**Файл:** `apps/store/src/context/CartContext.tsx`

```typescript
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. Эхлээд localStorage-аас ачаалах
  useEffect(() => {
    const savedCart = localStorage.getItem('shopping-cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart) as CartItem[];
        setCart(parsed);
      } catch (error) {
        console.error('Failed to load cart:', error);
        localStorage.removeItem('shopping-cart');
      }
    }
    setIsInitialized(true); // Ачаалж дууссан
  }, []);

  // 2. Initialized болсны дараа л хадгалах
  useEffect(() => {
    if (!isInitialized) return; // Ачаалж дуустал бүү хадгала

    localStorage.setItem('shopping-cart', JSON.stringify(cart));
  }, [cart, isInitialized]);

  // ... бусад код ...
}
```

#### Step 3: SignupForm timer cleanup

**Файл:** `apps/store/src/components/auth/SignupForm.tsx`

```typescript
const [success, setSuccess] = useState(false);

// Auto-close timer-ыг useEffect-д оруулах
useEffect(() => {
  if (!success) return;

  const timer = setTimeout(() => {
    onSuccess?.();
  }, 5000);

  return () => clearTimeout(timer); // Cleanup
}, [success, onSuccess]);

// handleSubmit дотор
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // ... validation ...

  try {
    const result = await supabase.auth.signUp({...});

    if (signupError) {
      // ... error handling ...
    } else {
      setSuccess(true); // useEffect timer эхэлнэ
      setLoading(false);
      // setTimeout УСТГАХ - useEffect хариуцна
    }
  } catch (error) {
    // ... error handling ...
  }
};
```

#### Step 4: AuthCallbackPage race condition засах

**Файл:** `apps/store/src/pages/AuthCallbackPage.tsx`

```typescript
useEffect(() => {
  let redirectTimer: NodeJS.Timeout | null = null;
  let isProcessing = false;

  const handleCallback = async () => {
    if (isProcessing) return; // Prevent double processing
    isProcessing = true;

    try {
      // Set timeout
      redirectTimer = setTimeout(() => {
        if (!isProcessing) return;
        goLoginWithError('Google sign in timed out.');
      }, 3500);

      // Process callback
      const session = await finalizeSession();

      if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
      }

      if (session) {
        goHome();
      } else {
        goLoginWithError('Failed to finalize session');
      }
    } catch (error) {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
      }
      goLoginWithError('Authentication failed');
    }
  };

  handleCallback();

  return () => {
    if (redirectTimer) {
      clearTimeout(redirectTimer);
    }
  };
}, []);
```

#### Шалгах:
- [ ] React console-д dependency warning байхгүй
- [ ] Hot reload хийхэд алдаа гарахгүй
- [ ] Component unmount хийгдэхэд memory leak үүсэхгүй
- [ ] Polling зөв ажиллаж байна
- [ ] localStorage race condition шийдэгдсэн

---

## Phase 2: HIGH Priority Fixes (1 долоо хоног)

### ✅ Task 2.1: Input Validation with Zod (Өдөр 8-9)

#### Step 1: Zod суулгах
```bash
cd backend
npm install zod @fastify/type-provider-zod
```

#### Step 2: Validation schemas үүсгэх

**Файл:** `backend/src/schemas/order.schema.ts` (Шинэ)

```typescript
import { z } from 'zod';

export const createOrderItemSchema = z.object({
  id: z.string().uuid('Invalid product ID'),
  quantity: z.number()
    .int('Quantity must be integer')
    .positive('Quantity must be positive')
    .max(100, 'Max quantity is 100'),
  price: z.number()
    .positive('Price must be positive')
    .finite('Price must be finite')
});

export const shippingAddressSchema = z.object({
  fullName: z.string()
    .min(2, 'Name too short')
    .max(100, 'Name too long'),
  phone: z.string()
    .regex(/^[0-9]{8}$/, 'Invalid phone number'),
  city: z.string().min(2),
  district: z.string().min(2),
  address: z.string().min(5).max(500),
  zipCode: z.string().optional()
});

export const createOrderSchema = z.object({
  items: z.array(createOrderItemSchema)
    .min(1, 'At least one item required')
    .max(50, 'Too many items'),
  shippingAddress: shippingAddressSchema,
  total: z.number()
    .positive('Total must be positive')
    .finite('Total must be finite')
    .max(100000000, 'Total too large')
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
```

#### Step 3: Route-д validation нэмэх

**Файл:** `backend/src/routes/orders.ts`

```typescript
import { createOrderSchema, CreateOrderInput } from '../schemas/order.schema';

fastify.post('/api/orders', {
  preHandler: [userGuard]
}, async (request, reply) => {
  const userId = (request as any).user.id;

  // Validation
  let validatedData: CreateOrderInput;
  try {
    validatedData = createOrderSchema.parse(request.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    throw error;
  }

  const { items, shippingAddress, total } = validatedData;

  // ... order creation logic ...
});
```

#### Step 4: Бусад schemas үүсгэх

**Файл:** `backend/src/schemas/product.schema.ts`

```typescript
import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().min(10).max(5000),
  price: z.number().positive().finite(),
  categoryId: z.string().uuid(),
  stock: z.number().int().min(0),
  images: z.array(z.string().url()).min(1).max(10),
  specifications: z.record(z.string()).optional()
});

export const updateProductSchema = createProductSchema.partial();
```

**Файл:** `backend/src/schemas/user.schema.ts`

```typescript
import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^[0-9]{8}$/).optional(),
  avatarUrl: z.string().url().optional()
});
```

#### Шалгах:
- [ ] Invalid input бол 400 error буцаана
- [ ] Error message ойлгомжтой байна
- [ ] SQL injection боломжгүй болсон
- [ ] XSS боломжгүй болсон
- [ ] Type safety бэхжсэн (TypeScript)

---

### ✅ Task 2.2: Rate Limiting (Өдөр 9-10)

#### Step 1: Rate limiter суулгах
```bash
cd backend
npm install @fastify/rate-limit
```

#### Step 2: Global rate limiting

**Файл:** `backend/src/app.ts`

```typescript
import rateLimit from '@fastify/rate-limit';

// Register rate limiter
await fastify.register(rateLimit, {
  global: true,
  max: 100, // 100 requests
  timeWindow: '1 minute',
  cache: 10000,
  allowList: ['127.0.0.1'], // Whitelist localhost
  redis: process.env.REDIS_URL ? {
    // Production дээр Redis ашиглах
    // Энэ нь distributed rate limiting өгнө
    // npm install ioredis хийх
  } : undefined,
  errorResponseBuilder: (request, context) => {
    return {
      error: 'Rate limit exceeded',
      message: `Хэт олон хүсэлт илгээсэн байна. ${context.after} дараа дахин оролдоно уу.`,
      retryAfter: context.after
    };
  }
});
```

#### Step 3: Route-specific rate limits

**Файл:** `backend/src/routes/payment.ts`

```typescript
// Payment webhook - strict rate limit
fastify.post('/api/payment/callback', {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute'
    }
  }
}, async (request, reply) => {
  // ... webhook handler ...
});
```

**Файл:** `backend/src/routes/orders.ts`

```typescript
// Order creation - moderate limit
fastify.post('/api/orders', {
  preHandler: [userGuard],
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute'
    }
  }
}, async (request, reply) => {
  // ... order creation ...
});
```

**Файл:** `backend/src/routes/auth.ts`

```typescript
// Login - strict limit
fastify.post('/api/auth/login', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '5 minutes'
    }
  }
}, async (request, reply) => {
  // ... login logic ...
});
```

#### Шалгах:
- [ ] Хэт олон хүсэлт илгээхэд 429 error буцаана
- [ ] Retry-After header зөв байна
- [ ] Different routes өөр өөр limit-тэй
- [ ] Rate limit reset хугацаа зөв ажиллаж байна

---

### ✅ Task 2.3: Comprehensive Error Handling (Өдөр 10-11)

#### Step 1: Error handler middleware

**Файл:** `backend/src/middleware/errorHandler.ts` (Шинэ)

```typescript
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  console.error('Error caught by handler:', error);

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'Validation Error',
      details: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Давхардсан утга байна'
        });
      case 'P2025':
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Өгөгдөл олдсонгүй'
        });
      case 'P2003':
        return reply.status(400).send({
          error: 'Foreign Key Constraint',
          message: 'Холбоотой өгөгдөл олдсонгүй'
        });
      default:
        return reply.status(500).send({
          error: 'Database Error',
          message: process.env.NODE_ENV === 'development'
            ? error.message
            : 'Өгөгдлийн санд алдаа гарлаа'
        });
    }
  }

  // Fastify errors
  if ('statusCode' in error) {
    return reply.status(error.statusCode || 500).send({
      error: error.name,
      message: error.message
    });
  }

  // Generic errors
  return reply.status(500).send({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development'
      ? error.message
      : 'Серверт алдаа гарлаа'
  });
}
```

#### Step 2: App.ts-д error handler бүртгэх

**Файл:** `backend/src/app.ts`

```typescript
import { errorHandler } from './middleware/errorHandler';

// Error handler бүртгэх
fastify.setErrorHandler(errorHandler);
```

#### Step 3: Try-catch нэмэх бүх route-д

**Жишээ:** `backend/src/routes/products.ts`

```typescript
fastify.get('/api/products', async (request, reply) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true
      }
    });
    return reply.send(products);
  } catch (error) {
    // Error handler автоматаар барина
    throw error;
  }
});
```

#### Шалгах:
- [ ] Бүх uncaught exception-ууд error handler-д очно
- [ ] Error response format consistent байна
- [ ] Production дээр sensitive data leak хийхгүй
- [ ] Development дээр stack trace харагдана

---

### ✅ Task 2.4: QPay Circuit Breaker (Өдөр 11-12)

#### Step 1: Circuit breaker library суулгах
```bash
cd backend
npm install opossum
```

#### Step 2: QPay service дээр circuit breaker нэмэх

**Файл:** `backend/src/services/qpay.service.ts`

```typescript
import CircuitBreaker from 'opossum';

class QPayService {
  private client: AxiosInstance;
  private config: QPayConfig;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  // Circuit breaker
  private createInvoiceBreaker: CircuitBreaker;
  private checkInvoiceBreaker: CircuitBreaker;

  constructor(config?: Partial<QPayConfig>) {
    this.config = {
      baseURL: process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn/v2',
      username: process.env.QPAY_USERNAME || '',
      password: process.env.QPAY_PASSWORD || '',
      invoiceCode: process.env.QPAY_INVOICE_CODE || '',
      requestTimeoutMs: Number(process.env.QPAY_REQUEST_TIMEOUT_MS) || 45000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.requestTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupCircuitBreakers();
  }

  private setupCircuitBreakers() {
    const breakerOptions = {
      timeout: 30000, // 30 секундын timeout
      errorThresholdPercentage: 50, // 50% алдаа гарвал circuit нээнэ
      resetTimeout: 30000, // 30 секундын дараа дахин оролдоно
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: 'qpay-service'
    };

    // Create invoice circuit breaker
    this.createInvoiceBreaker = new CircuitBreaker(
      this.createInvoiceInternal.bind(this),
      {
        ...breakerOptions,
        name: 'qpay-create-invoice'
      }
    );

    // Check invoice circuit breaker
    this.checkInvoiceBreaker = new CircuitBreaker(
      this.checkInvoiceInternal.bind(this),
      {
        ...breakerOptions,
        name: 'qpay-check-invoice'
      }
    );

    // Event listeners
    this.createInvoiceBreaker.on('open', () => {
      console.error('⚠️  QPay createInvoice circuit breaker OPENED');
    });

    this.createInvoiceBreaker.on('halfOpen', () => {
      console.warn('🔄 QPay createInvoice circuit breaker HALF-OPEN');
    });

    this.createInvoiceBreaker.on('close', () => {
      console.log('✅ QPay createInvoice circuit breaker CLOSED');
    });
  }

  // Original create invoice (private)
  private async createInvoiceInternal(params: any): Promise<any> {
    // ... existing implementation ...
  }

  // Public method with circuit breaker
  async createInvoice(params: any): Promise<any> {
    try {
      return await this.createInvoiceBreaker.fire(params);
    } catch (error) {
      if (error.message === 'Breaker is open') {
        throw new Error('QPay service unavailable. Please try again later.');
      }
      throw error;
    }
  }

  // ... same pattern for other methods ...
}
```

#### Step 3: Fallback logic нэмэх

**Файл:** `backend/src/routes/orders.ts`

```typescript
try {
  const qpayInvoice = await qpayService.createInvoice({
    amount: total,
    description: `Order #${order.id}`,
    orderId: order.id
  });

  // ... normal flow ...

} catch (error) {
  // Circuit breaker open бол
  if (error instanceof Error && error.message.includes('unavailable')) {
    // Order-ыг PAYMENT_PENDING статуст хадгалах
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAYMENT_PENDING',
        paymentStatus: 'PENDING_QPAY'
      }
    });

    return reply.status(503).send({
      error: 'Payment service temporarily unavailable',
      message: 'Төлбөрийн систем түр хугацаагаар ажиллахгүй байна. Та дараа дахин оролдоно уу.',
      orderId: order.id
    });
  }

  throw error;
}
```

#### Шалгах:
- [ ] QPay down болоход circuit breaker нээгдэнэ
- [ ] 30 секундын дараа half-open болно
- [ ] Success болоход circuit хаагдана
- [ ] Хэрэглэгч ойлгомжтой алдааны мэдэгдэл харна

---

### ✅ Task 2.5: Logging System (Өдөр 12-13)

#### Step 1: Pino logger суулгах
```bash
cd backend
npm install pino pino-pretty
```

#### Step 2: Logger тохируулах

**Файл:** `backend/src/lib/logger.ts` (Шинэ)

```typescript
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress
    }),
    res: (res) => ({
      statusCode: res.statusCode
    }),
    err: pino.stdSerializers.err
  }
});
```

#### Step 3: Fastify logger-тэй холбох

**Файл:** `backend/src/app.ts`

```typescript
import { logger } from './lib/logger';

const fastify = Fastify({
  logger: logger,
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
  requestIdHeader: 'x-request-id'
});
```

#### Step 4: Request/Response logging

**Файл:** `backend/src/middleware/requestLogger.ts` (Шинэ)

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';

export async function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const start = Date.now();

  reply.addHook('onSend', async (request, reply, payload) => {
    const duration = Date.now() - start;

    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      userId: (request as any).user?.id
    }, 'Request completed');

    return payload;
  });
}
```

**App.ts-д нэмэх:**
```typescript
fastify.addHook('onRequest', requestLogger);
```

#### Step 5: Error logging сайжруулах

**Файл:** `backend/src/middleware/errorHandler.ts`

```typescript
export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log error with context
  request.log.error({
    err: error,
    method: request.method,
    url: request.url,
    userId: (request as any).user?.id,
    body: request.body,
    query: request.query
  }, 'Request error');

  // ... rest of error handling ...
}
```

#### Шалгах:
- [ ] Бүх request/response log-логдож байна
- [ ] Error-үүд stack trace-тай log-логдож байна
- [ ] Development дээр ойлгомжтой format
- [ ] Production дээр JSON format
- [ ] Request ID track хийгдэж байна

---

### ✅ Task 2.6: N+1 Query Optimization (Өдөр 13-14)

#### Step 1: Categories with product count засах

**Файл:** `backend/src/routes/products.ts`

```typescript
// ХУУЧИН - N+1 query
const categoriesWithCount = await Promise.all(
  categories.map(async (category) => {
    const productCount = await prisma.product.count({
      where: { categoryId: category.id },
    });
    return { ...category, productCount };
  })
);

// ШИНЭ - Single query
const categories = await prisma.category.findMany({
  include: {
    _count: {
      select: { products: true }
    }
  }
});

const categoriesWithCount = categories.map(cat => ({
  ...cat,
  productCount: cat._count.products
}));
```

#### Step 2: Orders with items optimization

**Файл:** `backend/src/routes/orders.ts`

```typescript
// User orders-ыг efficiently fetch хийх
fastify.get('/api/orders', {
  preHandler: [userGuard]
}, async (request, reply) => {
  const userId = (request as any).user.id;

  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              price: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 50 // Limit results
  });

  return reply.send(orders);
});
```

#### Step 3: Database indexes нэмэх

**Файл:** `backend/prisma/schema.prisma`

```prisma
model Order {
  id              String   @id @default(cuid())
  userId          String
  status          OrderStatus
  paymentStatus   PaymentStatus
  qpayInvoiceId   String?  @unique
  createdAt       DateTime @default(now())

  // Indexes for performance
  @@index([userId, createdAt])
  @@index([status])
  @@index([paymentStatus])
  @@index([qpayInvoiceId])
}

model Product {
  id         String   @id @default(cuid())
  categoryId String
  name       String
  price      Float
  createdAt  DateTime @default(now())

  @@index([categoryId])
  @@index([createdAt])
}

model OrderItem {
  id        String @id @default(cuid())
  orderId   String
  productId String

  @@index([orderId])
  @@index([productId])
}
```

#### Step 4: Migration хийх
```bash
npx prisma migrate dev --name add-performance-indexes
```

#### Шалгах:
- [ ] Query ашиглах бүх газар include ашиглаж байна
- [ ] N+1 query байхгүй
- [ ] Database indexes үүссэн
- [ ] Response time сайжирсан

---

## Phase 3: Testing & Validation (3-5 хоног)

### ✅ Task 3.1: Unit Tests (Өдөр 15-16)

#### Step 1: Testing framework суулгах
```bash
cd backend
npm install --save-dev vitest @vitest/ui supertest @types/supertest
```

#### Step 2: Vitest config

**Файл:** `backend/vitest.config.ts` (Шинэ)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.test.ts'
      ]
    }
  }
});
```

#### Step 3: Test utilities

**Файл:** `backend/src/tests/setup.ts` (Шинэ)

```typescript
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';

beforeAll(async () => {
  // Test database connection
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean database before each test
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});
```

#### Step 4: Payment webhook tests

**Файл:** `backend/src/tests/payment.test.ts` (Шинэ)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { build } from '../app';
import { prisma } from '../lib/prisma';

describe('Payment Webhook', () => {
  let app: any;

  beforeEach(async () => {
    app = await build();
  });

  it('should handle duplicate webhooks (idempotency)', async () => {
    // Create test order
    const order = await prisma.order.create({
      data: {
        userId: 'test-user',
        total: 10000,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        qpayInvoiceId: 'test-invoice-123',
        items: {
          create: [{
            productId: 'test-product',
            quantity: 1,
            price: 10000
          }]
        },
        shippingAddress: {}
      }
    });

    const webhookPayload = {
      payment_id: 'payment-123',
      invoice_id: 'test-invoice-123',
      payment_status: 'PAID'
    };

    // First webhook - should succeed
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/payment/callback',
      payload: webhookPayload
    });

    expect(response1.statusCode).toBe(200);
    expect(response1.json().status).toBe('success');

    // Second webhook (duplicate) - should return duplicate
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/payment/callback',
      payload: webhookPayload
    });

    expect(response2.statusCode).toBe(200);
    expect(response2.json().status).toBe('duplicate');

    // Verify order paid only once
    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id }
    });

    expect(updatedOrder?.paymentStatus).toBe('PAID');
  });

  it('should reject invalid webhook payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/payment/callback',
      payload: {
        // Missing required fields
        invalid: 'data'
      }
    });

    expect(response.statusCode).toBe(400);
  });
});
```

#### Step 5: Order creation race condition test

**Файл:** `backend/src/tests/orders.test.ts` (Шинэ)

```typescript
import { describe, it, expect } from 'vitest';
import { build } from '../app';
import { prisma } from '../lib/prisma';

describe('Order Creation', () => {
  it('should prevent race condition on double-click', async () => {
    const app = await build();

    const orderPayload = {
      items: [
        { id: 'product-1', quantity: 1, price: 10000 }
      ],
      shippingAddress: {
        fullName: 'Test User',
        phone: '99999999',
        city: 'UB',
        district: 'Test',
        address: 'Test address'
      },
      total: 10000
    };

    // Simulate concurrent requests (double-click)
    const [response1, response2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: orderPayload
      }),
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: {
          authorization: 'Bearer test-token'
        },
        payload: orderPayload
      })
    ]);

    // Only one should succeed
    const successCount = [response1, response2].filter(
      r => r.statusCode === 200
    ).length;

    expect(successCount).toBeLessThanOrEqual(1);

    // Verify only one order created
    const orders = await prisma.order.findMany({
      where: { userId: 'test-user' }
    });

    expect(orders.length).toBe(1);
  });
});
```

#### Шалгах:
- [ ] `npm test` амжилттай ажиллаж байна
- [ ] Test coverage 70%+ байна
- [ ] Critical paths бүгд test хийгдсэн
- [ ] CI/CD-д test нэмэгдсэн

---

### ✅ Task 3.2: Frontend E2E Tests (Өдөр 17)

#### Step 1: Playwright суулгах
```bash
cd apps/store
npm install --save-dev @playwright/test
npx playwright install
```

#### Step 2: Checkout flow test

**Файл:** `apps/store/tests/checkout.spec.ts` (Шинэ)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('should complete checkout successfully', async ({ page }) => {
    // Go to home
    await page.goto('http://localhost:5173');

    // Add product to cart
    await page.click('[data-testid="product-card"]:first-child');
    await page.click('[data-testid="add-to-cart"]');

    // Go to cart
    await page.click('[data-testid="cart-icon"]');
    expect(await page.locator('[data-testid="cart-item"]').count()).toBe(1);

    // Proceed to checkout
    await page.click('[data-testid="checkout-button"]');

    // Fill shipping info
    await page.fill('[name="fullName"]', 'Test User');
    await page.fill('[name="phone"]', '99999999');
    await page.fill('[name="city"]', 'Ulaanbaatar');
    await page.fill('[name="district"]', 'Bayanzurkh');
    await page.fill('[name="address"]', 'Test address 123');

    // Submit
    await page.click('[data-testid="place-order"]');

    // Should show QPay QR code
    await expect(page.locator('[data-testid="qpay-qr"]')).toBeVisible();

    // Should show polling status
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Pending');
  });

  test('should timeout after 5 minutes', async ({ page }) => {
    // ... setup checkout ...

    // Wait 5 minutes (use faster timeout for testing)
    await page.waitForTimeout(5 * 60 * 1000);

    // Should show timeout message
    await expect(page.locator('[data-testid="payment-timeout"]')).toBeVisible();
  });
});
```

#### Шалгах:
- [ ] E2E tests ажиллаж байна
- [ ] Critical user flows covered
- [ ] Timeout scenarios tested

---

### ✅ Task 3.3: Load Testing (Өдөр 18)

#### Step 1: K6 суулгах
```bash
# Install k6
# https://k6.io/docs/getting-started/installation/
```

#### Step 2: Load test script

**Файл:** `backend/tests/load/checkout.js` (Шинэ)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up
    { duration: '3m', target: 100 }, // Peak load
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% under 500ms
    http_req_failed: ['rate<0.01'],   // <1% errors
  },
};

export default function () {
  const payload = JSON.stringify({
    items: [{ id: 'test-product', quantity: 1, price: 10000 }],
    shippingAddress: {
      fullName: 'Test User',
      phone: '99999999',
      city: 'UB',
      district: 'Test',
      address: 'Test'
    },
    total: 10000
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
  };

  const response = http.post('http://localhost:3000/api/orders', payload, params);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

#### Step 3: Run load test
```bash
k6 run backend/tests/load/checkout.js
```

#### Шалгах:
- [ ] 100 concurrent users дээр stable байна
- [ ] Response time 500ms доор байна
- [ ] Error rate < 1%
- [ ] Database connection pool хангалттай

---

## Phase 4: Production Deployment (2 хоног)

### ✅ Task 4.1: Environment Configuration (Өдөр 19)

#### Step 1: Production .env

**Файл:** `backend/.env.production`

```bash
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL="postgresql://user:pass@prod-db:5432/ecommerce?connection_limit=20&pool_timeout=10&connect_timeout=5"

# QPay
QPAY_BASE_URL=https://merchant.qpay.mn/v2
QPAY_USERNAME=your_production_username
QPAY_PASSWORD=your_production_password
QPAY_INVOICE_CODE=your_invoice_code
QPAY_REQUEST_TIMEOUT_MS=30000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1m

# Redis (optional for distributed rate limiting)
# REDIS_URL=redis://localhost:6379
```

#### Step 2: Docker configuration

**Файл:** `backend/Dockerfile`

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start:migrate:prod"]
```

**Package.json:**
```json
{
  "scripts": {
    "start:migrate:prod": "npx prisma migrate deploy && node dist/server.js"
  }
}
```

#### Step 3: Docker Compose

**Файл:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env.production
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=ecommerce
      - POSTGRES_PASSWORD=your_secure_password
      - POSTGRES_DB=ecommerce
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
```

#### Шалгах:
- [ ] Docker build амжилттай
- [ ] Container-үүд ажиллаж байна
- [ ] Environment variables зөв байна
- [ ] Database migrations автоматаар ажиллана

---

### ✅ Task 4.2: Monitoring Setup (Өдөр 20)

#### Step 1: Health check monitoring

**Script:** `scripts/health-check.sh`

```bash
#!/bin/bash

BACKEND_URL="http://localhost:3000"
HEALTH_ENDPOINT="/health"

response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL$HEALTH_ENDPOINT")

if [ "$response" == "200" ]; then
  echo "✅ Backend is healthy"
  exit 0
else
  echo "❌ Backend is unhealthy (HTTP $response)"
  exit 1
fi
```

#### Step 2: Monitoring cronjob

**Crontab:**
```bash
# Check every 5 minutes
*/5 * * * * /path/to/scripts/health-check.sh || echo "Backend down!" | mail -s "Alert: Backend Down" admin@example.com
```

#### Step 3: Sentry setup (Optional)

```bash
cd backend
npm install @sentry/node @sentry/profiling-node
```

**Файл:** `backend/src/lib/sentry.ts`

```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new ProfilingIntegration(),
    ],
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
  });
}

export { Sentry };
```

#### Шалгах:
- [ ] Health checks ажиллаж байна
- [ ] Alerts тохируулагдсан
- [ ] Error tracking ажиллаж байна

---

### ✅ Task 4.3: Deployment Checklist (Өдөр 20)

#### Pre-deployment:
- [ ] Бүх tests амжилттай
- [ ] Load testing хийгдсэн
- [ ] Security audit хийгдсэн
- [ ] Database backup бэлэн байна
- [ ] Rollback plan бэлэн байна

#### Deployment:
- [ ] Database migrations deploy хийх
- [ ] Backend deploy хийх
- [ ] Frontend deploy хийх
- [ ] Health checks ажиллаж байна эсэхийг шалгах

#### Post-deployment:
- [ ] Smoke tests ажиллуулах
- [ ] Monitoring dashboard шалгах
- [ ] Error rate хэвийн байна эсэхийг шалгах
- [ ] User feedback цуглуулах

---

## 🎯 Амжилтын Шалгуур

### Technical Metrics:
- [ ] 99.9% uptime
- [ ] < 500ms response time (p95)
- [ ] < 0.1% error rate
- [ ] Zero payment data loss
- [ ] Zero race conditions

### Business Metrics:
- [ ] 100% payment accuracy
- [ ] < 5min checkout time
- [ ] < 1% abandoned carts due to errors
- [ ] Zero security incidents

---

## 📞 Дэмжлэг

**Асуудал гарвал:**
1. Logs шалгах: `docker logs backend`
2. Database шалгах: `/health` endpoint
3. Error tracking: Sentry dashboard
4. Rollback: `git revert` + redeploy

**Холбоо барих:**
- Technical Lead: [Name]
- DevOps: [Name]
- QPay Support: [Contact]

---

## ✅ ДҮГНЭЛТ

Энэ план дагуу бүх засварыг хийвэл:
- ✅ Production-ready болно
- ✅ Scalable болно
- ✅ Secure болно
- ✅ Maintainable болно

**Estimated Timeline:** 18-20 working days
**Team Size:** 2-3 developers
**Risk Level:** Medium (with proper testing)

---

**Last Updated:** 2026-02-08
**Version:** 1.0
**Status:** 🟡 Ready for Implementation
