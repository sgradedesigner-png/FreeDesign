# Payment Integration Plan: QPay Mongolia
## Complete E-Commerce Payment System Implementation

---

## 🎯 Overview

**Goal:** Integrate QPay payment gateway into the checkout process for seamless QR code-based payments.

**Payment Flow:**
1. Customer completes checkout → Backend creates QPay invoice
2. Customer sees QR code → Scans with banking app
3. QPay notifies backend via webhook → Payment confirmed
4. Order status updated → Customer receives confirmation

**Test Environment:**
- **Base URL:** `https://merchant-sandbox.qpay.mn`
- **Username:** `TEST_MERCHANT`
- **Password:** `123456`
- **Invoice Code:** `TEST_INVOICE`

---

## 📊 QPay API Architecture

### Key Endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v2/auth/token` | POST | Get access token (expires after time) |
| `/v2/auth/refresh` | POST | Refresh expired token |
| `/v2/invoice` | POST | Create payment invoice (returns QR code) |
| `/v2/invoice/{id}` | DELETE | Cancel invoice |
| `/v2/payment/check` | POST | Check if payment completed |
| `/v2/payment/{id}` | GET | Get payment details |
| `/v2/payment/refund/{id}` | DELETE | Refund payment |
| `/v2/ebarimt/create` | POST | Generate electronic receipt |

### Authentication Flow:
```
1. POST /v2/auth/token with Basic Auth (username:password)
   → Returns: { access_token, refresh_token, expires_in }

2. Use Bearer {access_token} for all subsequent requests

3. When token expires → POST /v2/auth/refresh with Bearer {refresh_token}
   → Returns: new access_token
```

---

## Phase 1: Backend Infrastructure

### 1.1 Install Dependencies

**File:** `backend/package.json`

**Install:**
```bash
cd backend
npm install axios dotenv
```

**Dependencies:**
- `axios` - HTTP client for QPay API calls
- `dotenv` - Already installed (for env variables)

---

### 1.2 Add Environment Variables

**File:** `backend/.env`

**Add:**
```env
# QPay Configuration
QPAY_BASE_URL=https://merchant-sandbox.qpay.mn
QPAY_USERNAME=TEST_MERCHANT
QPAY_PASSWORD=123456
QPAY_INVOICE_CODE=TEST_INVOICE

# Callback URL (replace with your actual domain)
QPAY_CALLBACK_URL=http://localhost:3000/api/payment/callback

# Production (when ready)
# QPAY_BASE_URL=https://merchant.qpay.mn
# QPAY_USERNAME=your_production_username
# QPAY_PASSWORD=your_production_password
# QPAY_INVOICE_CODE=your_invoice_code
# QPAY_CALLBACK_URL=https://yourdomain.com/api/payment/callback
```

**Security Note:** Never commit `.env` file to git. Add to `.gitignore`.

---

### 1.3 Create QPay Service Module

**File:** `backend/src/services/qpay.service.ts` (NEW FILE)

**Purpose:** Centralized QPay API client with token management

**Implementation:**
```typescript
import axios, { AxiosInstance } from 'axios'

interface QPayConfig {
  baseURL: string
  username: string
  password: string
  invoiceCode: string
}

interface QPayTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

interface QPayInvoiceRequest {
  invoice_code: string
  sender_invoice_no: string
  invoice_receiver_code: string
  invoice_description: string
  amount: number
  callback_url: string
  sender_branch_code?: string
  lines?: any[] // For detailed line items
}

interface QPayInvoiceResponse {
  invoice_id: string
  qr_text: string
  qr_image: string
  qPay_shortUrl: string
  urls: Array<{
    name: string
    description: string
    logo: string
    link: string
  }>
}

interface QPayPaymentCheckRequest {
  object_type: 'INVOICE'
  object_id: string
  offset: {
    page_number: number
    page_limit: number
  }
}

interface QPayPaymentCheckResponse {
  count: number
  paid_amount: number
  rows: Array<{
    payment_id: string
    payment_status: string
    payment_amount: number
    payment_date: string
    customer_name: string
    payment_wallet: string
  }>
}

export class QPayService {
  private client: AxiosInstance
  private config: QPayConfig
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private tokenExpiry: Date | null = null

  constructor() {
    this.config = {
      baseURL: process.env.QPAY_BASE_URL || '',
      username: process.env.QPAY_USERNAME || '',
      password: process.env.QPAY_PASSWORD || '',
      invoiceCode: process.env.QPAY_INVOICE_CODE || ''
    }

    this.client = axios.create({
      baseURL: this.config.baseURL,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(async (config) => {
      // Skip auth for token endpoint
      if (config.url?.includes('/auth/token')) {
        return config
      }

      // Ensure we have a valid token
      await this.ensureValidToken()

      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`
      }

      return config
    })

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // If 401 and haven't retried yet, refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            await this.refreshAccessToken()
            originalRequest.headers.Authorization = `Bearer ${this.accessToken}`
            return this.client(originalRequest)
          } catch (refreshError) {
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * Get access token from QPay
   */
  private async getToken(): Promise<void> {
    try {
      const response = await this.client.post<QPayTokenResponse>(
        '/v2/auth/token',
        {},
        {
          auth: {
            username: this.config.username,
            password: this.config.password
          }
        }
      )

      this.accessToken = response.data.access_token
      this.refreshToken = response.data.refresh_token

      // Set token expiry (expires_in is in seconds)
      const expiresIn = response.data.expires_in || 3600
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)

      console.log('✅ QPay token obtained successfully')
    } catch (error) {
      console.error('❌ Failed to get QPay token:', error)
      throw new Error('QPay authentication failed')
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      return this.getToken()
    }

    try {
      const response = await this.client.post<QPayTokenResponse>(
        '/v2/auth/refresh',
        {},
        {
          headers: {
            Authorization: `Bearer ${this.refreshToken}`
          }
        }
      )

      this.accessToken = response.data.access_token
      this.refreshToken = response.data.refresh_token

      const expiresIn = response.data.expires_in || 3600
      this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)

      console.log('✅ QPay token refreshed successfully')
    } catch (error) {
      console.error('❌ Failed to refresh token, getting new one:', error)
      await this.getToken()
    }
  }

  /**
   * Ensure we have a valid token before making requests
   */
  private async ensureValidToken(): Promise<void> {
    // If no token or token expired, get new one
    if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
      await this.getToken()
    }
  }

  /**
   * Create QPay invoice (simple mode)
   */
  async createInvoice(params: {
    orderNumber: string
    amount: number
    description: string
    callbackUrl?: string
  }): Promise<QPayInvoiceResponse> {
    try {
      const invoiceRequest: QPayInvoiceRequest = {
        invoice_code: this.config.invoiceCode,
        sender_invoice_no: params.orderNumber,
        invoice_receiver_code: 'terminal', // Generic customer
        invoice_description: params.description,
        amount: params.amount,
        callback_url: params.callbackUrl || process.env.QPAY_CALLBACK_URL || '',
        sender_branch_code: 'ONLINE'
      }

      const response = await this.client.post<QPayInvoiceResponse>(
        '/v2/invoice',
        invoiceRequest
      )

      console.log('✅ QPay invoice created:', response.data.invoice_id)
      return response.data
    } catch (error: any) {
      console.error('❌ Failed to create QPay invoice:', error.response?.data || error.message)
      throw new Error('Failed to create payment invoice')
    }
  }

  /**
   * Create detailed invoice with line items (for ebarimt integration)
   */
  async createDetailedInvoice(params: {
    orderNumber: string
    amount: number
    description: string
    customerInfo?: {
      register?: string
      name?: string
      email?: string
      phone?: string
    }
    lineItems: Array<{
      description: string
      quantity: number
      unitPrice: number
      taxProductCode?: string
    }>
    callbackUrl?: string
  }): Promise<QPayInvoiceResponse> {
    try {
      const lines = params.lineItems.map(item => ({
        tax_product_code: item.taxProductCode || '6401',
        line_description: item.description,
        line_quantity: item.quantity.toString(),
        line_unit_price: item.unitPrice.toString(),
        note: '-',
        discounts: [],
        surcharges: [],
        taxes: []
      }))

      const invoiceRequest = {
        invoice_code: this.config.invoiceCode,
        sender_invoice_no: params.orderNumber,
        invoice_receiver_code: params.customerInfo?.register ? '83' : 'terminal',
        invoice_description: params.description,
        amount: params.amount,
        callback_url: params.callbackUrl || process.env.QPAY_CALLBACK_URL || '',
        sender_branch_code: 'ONLINE',
        enable_expiry: 'false',
        allow_partial: false,
        allow_exceed: false,
        invoice_receiver_data: params.customerInfo || {},
        lines
      }

      const response = await this.client.post<QPayInvoiceResponse>(
        '/v2/invoice',
        invoiceRequest
      )

      console.log('✅ QPay detailed invoice created:', response.data.invoice_id)
      return response.data
    } catch (error: any) {
      console.error('❌ Failed to create detailed invoice:', error.response?.data || error.message)
      throw new Error('Failed to create payment invoice')
    }
  }

  /**
   * Check if invoice has been paid
   */
  async checkPayment(invoiceId: string): Promise<QPayPaymentCheckResponse> {
    try {
      const request: QPayPaymentCheckRequest = {
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: {
          page_number: 1,
          page_limit: 100
        }
      }

      const response = await this.client.post<QPayPaymentCheckResponse>(
        '/v2/payment/check',
        request
      )

      return response.data
    } catch (error: any) {
      console.error('❌ Failed to check payment:', error.response?.data || error.message)
      throw new Error('Failed to check payment status')
    }
  }

  /**
   * Get payment details by payment ID
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/payment/${paymentId}`)
      return response.data
    } catch (error: any) {
      console.error('❌ Failed to get payment:', error.response?.data || error.message)
      throw new Error('Failed to get payment details')
    }
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string): Promise<void> {
    try {
      await this.client.delete(`/v2/invoice/${invoiceId}`)
      console.log('✅ Invoice cancelled:', invoiceId)
    } catch (error: any) {
      console.error('❌ Failed to cancel invoice:', error.response?.data || error.message)
      throw new Error('Failed to cancel invoice')
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId: string): Promise<void> {
    try {
      await this.client.delete(`/v2/payment/refund/${paymentId}`)
      console.log('✅ Payment refunded:', paymentId)
    } catch (error: any) {
      console.error('❌ Failed to refund payment:', error.response?.data || error.message)
      throw new Error('Failed to refund payment')
    }
  }

  /**
   * Create electronic receipt (ebarimt)
   */
  async createEbarimt(paymentId: string, receiverType: 'CITIZEN' | 'ORGANIZATION' = 'CITIZEN'): Promise<any> {
    try {
      const response = await this.client.post('/v2/ebarimt/create', {
        payment_id: paymentId,
        ebarimt_receiver_type: receiverType
      })

      console.log('✅ Ebarimt created for payment:', paymentId)
      return response.data
    } catch (error: any) {
      console.error('❌ Failed to create ebarimt:', error.response?.data || error.message)
      throw new Error('Failed to create electronic receipt')
    }
  }
}

// Export singleton instance
export const qpayService = new QPayService()
```

**Key Features:**
- ✅ Automatic token management (get, refresh, expire check)
- ✅ Request interceptor adds Bearer token automatically
- ✅ Response interceptor handles 401 (auto-refresh)
- ✅ Simple and detailed invoice creation
- ✅ Payment verification
- ✅ Refund and cancellation
- ✅ E-receipt (ebarimt) generation

---

### 1.4 Update Database Schema

**File:** `backend/prisma/schema.prisma`

**Add new fields to Order model:**
```prisma
model Order {
  id              String   @id @default(cuid())
  userId          String
  total           Float
  status          String   @default("PENDING")
  shippingAddress String?  // JSON
  items           String?  // JSON

  // QPay Payment Fields (ADD THESE)
  qpayInvoiceId   String?  @unique  // QPay invoice_id
  qpayPaymentId   String?  @unique  // QPay payment_id (after paid)
  paymentStatus   String   @default("UNPAID") // UNPAID, PAID, REFUNDED
  paymentMethod   String?  // "QPAY", "CASH", etc.
  qrCode          String?  @db.Text // QR code text (base64 image)
  qrCodeUrl       String?  // QPay short URL
  paymentDate     DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
  @@index([status])
  @@index([qpayInvoiceId])
  @@index([qpayPaymentId])
  @@index([paymentStatus])
}
```

**Run Migration:**
```bash
cd backend
npx prisma migrate dev --name add_qpay_payment_fields
npx prisma generate
```

---

### 1.5 Update Order Routes with QPay Integration

**File:** `backend/src/routes/orders.ts`

**Modify the existing POST /api/orders endpoint:**

```typescript
import { FastifyInstance } from 'fastify'
import { userGuard } from '../middleware/userGuard'
import { prisma } from '../prisma'
import { qpayService } from '../services/qpay.service'

export default async function orderRoutes(fastify: FastifyInstance) {

  // Create new order with QPay invoice
  fastify.post('/api/orders', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = request.user.id
    const { items, shippingAddress, total } = request.body

    try {
      // 1. Create order in database (status: PENDING, paymentStatus: UNPAID)
      const order = await prisma.order.create({
        data: {
          userId,
          total,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          paymentMethod: 'QPAY',
          shippingAddress: JSON.stringify(shippingAddress),
          items: JSON.stringify(items),
        }
      })

      // 2. Create QPay invoice
      const qpayInvoice = await qpayService.createInvoice({
        orderNumber: order.id,
        amount: total,
        description: `Order #${order.id.substring(0, 8)} - ${items.length} items`,
        callbackUrl: `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/payment/callback`
      })

      // 3. Update order with QPay invoice details
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          qpayInvoiceId: qpayInvoice.invoice_id,
          qrCode: qpayInvoice.qr_image, // Base64 QR image
          qrCodeUrl: qpayInvoice.qPay_shortUrl
        }
      })

      // 4. Return order with payment info
      return reply.code(201).send({
        order: updatedOrder,
        payment: {
          qrCode: qpayInvoice.qr_image,
          qrCodeUrl: qpayInvoice.qPay_shortUrl,
          bankUrls: qpayInvoice.urls, // Deep links to banking apps
          invoiceId: qpayInvoice.invoice_id
        }
      })

    } catch (error: any) {
      console.error('Order creation error:', error)
      return reply.code(500).send({
        error: 'Failed to create order',
        details: error.message
      })
    }
  })

  // Get user's orders (existing - no changes needed)
  fastify.get('/api/orders', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = request.user.id

    try {
      const orders = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      })

      return reply.send({ orders })
    } catch (error) {
      console.error('Fetch orders error:', error)
      return reply.code(500).send({ error: 'Failed to fetch orders' })
    }
  })

  // Get specific order details (existing - no changes needed)
  fastify.get('/api/orders/:id', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = request.user.id
    const { id } = request.params

    try {
      const order = await prisma.order.findFirst({
        where: {
          id,
          userId
        }
      })

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' })
      }

      return reply.send({ order })
    } catch (error) {
      console.error('Fetch order error:', error)
      return reply.code(500).send({ error: 'Failed to fetch order' })
    }
  })

  // Check order payment status (NEW)
  fastify.get('/api/orders/:id/payment-status', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = request.user.id
    const { id } = request.params

    try {
      const order = await prisma.order.findFirst({
        where: { id, userId }
      })

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' })
      }

      // If already paid, return current status
      if (order.paymentStatus === 'PAID') {
        return reply.send({
          paid: true,
          paymentDate: order.paymentDate,
          paymentId: order.qpayPaymentId
        })
      }

      // Check with QPay if payment completed
      if (order.qpayInvoiceId) {
        const paymentCheck = await qpayService.checkPayment(order.qpayInvoiceId)

        if (paymentCheck.count > 0 && paymentCheck.rows[0].payment_status === 'PAID') {
          // Payment found! Update order
          const payment = paymentCheck.rows[0]

          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              qpayPaymentId: payment.payment_id,
              paymentDate: new Date(payment.payment_date),
              status: 'PROCESSING' // Move to next stage
            }
          })

          return reply.send({
            paid: true,
            paymentDate: payment.payment_date,
            paymentId: payment.payment_id
          })
        }
      }

      return reply.send({ paid: false })

    } catch (error) {
      console.error('Payment status check error:', error)
      return reply.code(500).send({ error: 'Failed to check payment status' })
    }
  })
}
```

**Changes Made:**
- ✅ Order creation now includes QPay invoice generation
- ✅ QR code and payment URLs stored in order
- ✅ New endpoint to check payment status

---

### 1.6 Create Payment Callback Route

**File:** `backend/src/routes/payment.ts` (NEW FILE)

**Purpose:** Webhook endpoint for QPay to notify when payment is completed

**Implementation:**
```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma'
import { qpayService } from '../services/qpay.service'

export default async function paymentRoutes(fastify: FastifyInstance) {

  /**
   * QPay Payment Callback Webhook
   * QPay calls this when customer completes payment
   *
   * Expected query params:
   * - payment_id: QPay payment ID
   * - invoice_id: QPay invoice ID (optional)
   * - order_id: Our order ID (from sender_invoice_no)
   */
  fastify.post('/api/payment/callback', async (request, reply) => {
    try {
      const { payment_id, invoice_id, order_id } = request.body

      console.log('📥 QPay callback received:', { payment_id, invoice_id, order_id })

      // Verify payment with QPay
      let paymentData
      try {
        paymentData = await qpayService.getPayment(payment_id)
      } catch (error) {
        console.error('Failed to verify payment with QPay:', error)
        return reply.code(400).send({ error: 'Invalid payment ID' })
      }

      // Find order by invoice ID or order ID
      const order = await prisma.order.findFirst({
        where: order_id ? { id: order_id } : { qpayInvoiceId: invoice_id }
      })

      if (!order) {
        console.error('Order not found for payment:', { payment_id, order_id, invoice_id })
        return reply.code(404).send({ error: 'Order not found' })
      }

      // Check if already processed
      if (order.paymentStatus === 'PAID') {
        console.log('⚠️ Payment already processed for order:', order.id)
        return reply.send({ status: 'already_processed' })
      }

      // Update order with payment info
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          qpayPaymentId: payment_id,
          paymentDate: new Date(),
          status: 'PROCESSING' // Start processing the order
        }
      })

      console.log('✅ Payment confirmed for order:', order.id)

      // TODO: Send confirmation email to customer
      // TODO: Notify admin about new paid order

      return reply.send({
        status: 'success',
        order_id: order.id,
        payment_id: payment_id
      })

    } catch (error) {
      console.error('❌ Payment callback error:', error)
      return reply.code(500).send({ error: 'Payment processing failed' })
    }
  })

  /**
   * Manual payment verification endpoint
   * For polling from frontend if callback fails
   */
  fastify.post('/api/payment/verify', async (request, reply) => {
    const { orderId } = request.body

    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId }
      })

      if (!order || !order.qpayInvoiceId) {
        return reply.code(404).send({ error: 'Order not found' })
      }

      // Check payment status with QPay
      const paymentCheck = await qpayService.checkPayment(order.qpayInvoiceId)

      if (paymentCheck.count > 0 && paymentCheck.rows[0].payment_status === 'PAID') {
        const payment = paymentCheck.rows[0]

        // Update order
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            qpayPaymentId: payment.payment_id,
            paymentDate: new Date(payment.payment_date),
            status: 'PROCESSING'
          }
        })

        return reply.send({
          paid: true,
          payment_id: payment.payment_id
        })
      }

      return reply.send({ paid: false })

    } catch (error) {
      console.error('Payment verification error:', error)
      return reply.code(500).send({ error: 'Failed to verify payment' })
    }
  })
}
```

**Key Features:**
- ✅ QPay webhook handler (callback URL)
- ✅ Payment verification with QPay API
- ✅ Order status update after payment
- ✅ Manual verification endpoint (for polling)

---

### 1.7 Register Payment Routes

**File:** `backend/src/app.ts`

**Add:**
```typescript
// Import payment routes
import paymentRoutes from './routes/payment'

// Register routes
await fastify.register(paymentRoutes)
```

---

## Phase 2: Store App Frontend

### 2.1 Update CheckoutPage with QPay Payment UI

**File:** `apps/store/src/pages/CheckoutPage.tsx`

**Complete Replacement:**

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface PaymentInfo {
  qrCode: string
  qrCodeUrl: string
  bankUrls: Array<{
    name: string
    description: string
    logo: string
    link: string
  }>
  invoiceId: string
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { cart, clearCart } = useCart()
  const { user } = useAuth()
  const { t } = useLanguage()

  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'paid' | 'failed'>('pending')

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    zipCode: ''
  })

  // Poll for payment status
  useEffect(() => {
    if (orderId && paymentStatus === 'pending') {
      const interval = setInterval(() => {
        checkPaymentStatus()
      }, 5000) // Check every 5 seconds

      return () => clearInterval(interval)
    }
  }, [orderId, paymentStatus])

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate form
      if (!formData.name || !formData.phone || !formData.address) {
        toast.error(t('pleaseCompleteAllFields'))
        setLoading(false)
        return
      }

      // Get access token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(t('pleaseLogin'))
        navigate('/login')
        return
      }

      // Create order with QPay invoice
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          items: cart.items,
          shippingAddress: formData,
          total: cart.total
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create order')
      }

      const { order, payment } = await response.json()

      setOrderId(order.id)
      setPaymentInfo(payment)
      toast.success(t('orderCreated'))

      // Start checking payment status
      setPaymentStatus('pending')

    } catch (error) {
      console.error('Order creation error:', error)
      toast.error(t('orderFailed'))
    } finally {
      setLoading(false)
    }
  }

  const checkPaymentStatus = async () => {
    if (!orderId) return

    setPaymentStatus('checking')

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/orders/${orderId}/payment-status`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      const data = await response.json()

      if (data.paid) {
        setPaymentStatus('paid')
        toast.success(t('paymentSuccessful'))

        // Clear cart
        clearCart()

        // Redirect to success page after 2 seconds
        setTimeout(() => {
          navigate(`/orders/${orderId}`)
        }, 2000)
      } else {
        setPaymentStatus('pending')
      }

    } catch (error) {
      console.error('Payment check error:', error)
      setPaymentStatus('failed')
    }
  }

  // Show payment QR code screen
  if (paymentInfo && orderId) {
    return (
      <div className="container py-8 max-w-2xl">
        <Card className="p-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">
              {t('scanToPayTitle')}
            </h1>
            <p className="text-muted-foreground mb-6">
              {t('scanToPayDescription')}
            </p>

            {/* Payment Status */}
            {paymentStatus === 'paid' ? (
              <Alert className="mb-6 bg-green-50 border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <AlertDescription className="text-green-800">
                  {t('paymentConfirmed')}
                </AlertDescription>
              </Alert>
            ) : paymentStatus === 'checking' ? (
              <Alert className="mb-6 bg-blue-50 border-blue-200">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <AlertDescription className="text-blue-800">
                  {t('checkingPayment')}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="mb-6">
                <AlertDescription>
                  {t('waitingForPayment')}
                </AlertDescription>
              </Alert>
            )}

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <img
                src={paymentInfo.qrCode}
                alt="Payment QR Code"
                className="w-64 h-64 border-4 border-primary rounded-lg"
              />
            </div>

            {/* Order Details */}
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {t('orderNumber')}: {orderId.substring(0, 8)}
              </p>
              <p className="text-2xl font-bold mt-2">
                ₮{cart.total.toLocaleString()}
              </p>
            </div>

            {/* Banking App Links */}
            <div className="mb-6">
              <p className="text-sm font-medium mb-3">{t('openInBankApp')}</p>
              <div className="grid grid-cols-2 gap-3">
                {paymentInfo.bankUrls.map((bank, index) => (
                  <a
                    key={index}
                    href={bank.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted transition"
                  >
                    <img
                      src={bank.logo}
                      alt={bank.name}
                      className="w-8 h-8 object-contain"
                    />
                    <span className="text-sm font-medium">{bank.name}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Manual Check Button */}
            <Button
              onClick={checkPaymentStatus}
              disabled={paymentStatus === 'checking' || paymentStatus === 'paid'}
              className="w-full"
            >
              {paymentStatus === 'checking' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('checking')}
                </>
              ) : paymentStatus === 'paid' ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('paid')}
                </>
              ) : (
                t('checkPaymentStatus')
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() => navigate('/orders')}
              className="w-full mt-2"
            >
              {t('viewOrders')}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Show checkout form
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">{t('checkout')}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Shipping Form */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">{t('shippingInfo')}</h2>

          <form onSubmit={handlePlaceOrder} className="space-y-4">
            <div>
              <Label htmlFor="name">{t('fullName')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="address">{t('address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">{t('city')}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="zipCode">{t('zipCode')}</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                t('continueToPayment')
              )}
            </Button>
          </form>
        </Card>

        {/* Order Summary */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">{t('orderSummary')}</h2>

          <div className="space-y-4">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <div className="flex gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('quantity')}: {item.quantity}
                    </p>
                  </div>
                </div>
                <p className="font-semibold">
                  ₮{(item.price * item.quantity).toLocaleString()}
                </p>
              </div>
            ))}

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>{t('total')}</span>
                <span>₮{cart.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
```

**Key Features:**
- ✅ Checkout form with shipping details
- ✅ Order creation with QPay invoice
- ✅ QR code display with payment instructions
- ✅ Banking app deep links
- ✅ Automatic payment status polling (every 5 seconds)
- ✅ Manual payment check button
- ✅ Success state and redirect to order details

---

### 2.2 Update Translation Files

**File:** `apps/store/src/i18n/translations.ts`

**Add:**
```typescript
{
  en: {
    // ... existing translations

    // Payment
    scanToPayTitle: 'Scan to Pay',
    scanToPayDescription: 'Scan this QR code with your banking app to complete payment',
    paymentConfirmed: 'Payment confirmed! Redirecting...',
    checkingPayment: 'Checking payment status...',
    waitingForPayment: 'Waiting for payment...',
    openInBankApp: 'Or open in your banking app:',
    checkPaymentStatus: 'Check Payment Status',
    paymentSuccessful: 'Payment successful!',
    continueToPayment: 'Continue to Payment',
    pleaseCompleteAllFields: 'Please complete all fields',
    shippingInfo: 'Shipping Information',
    fullName: 'Full Name',
    zipCode: 'Zip Code',
    processing: 'Processing...',
    paid: 'Paid',
    checking: 'Checking...',
  },

  mn: {
    // ... existing translations

    // Payment
    scanToPayTitle: 'QR кодоор төлөх',
    scanToPayDescription: 'Төлбөрөө төлөхийн тулд банкны апп-аараа QR кодыг уншуулна уу',
    paymentConfirmed: 'Төлбөр баталгаажлаа! Шилжүүлж байна...',
    checkingPayment: 'Төлбөрийн төлөв шалгаж байна...',
    waitingForPayment: 'Төлбөр хүлээж байна...',
    openInBankApp: 'Эсвэл банкны апп-аар нээх:',
    checkPaymentStatus: 'Төлбөрийн төлөв шалгах',
    paymentSuccessful: 'Төлбөр амжилттай!',
    continueToPayment: 'Төлбөр төлөх',
    pleaseCompleteAllFields: 'Бүх талбарыг бөглөнө үү',
    shippingInfo: 'Хүргэлтийн мэдээлэл',
    fullName: 'Овог нэр',
    zipCode: 'Зип код',
    processing: 'Боловсруулж байна...',
    paid: 'Төлсөн',
    checking: 'Шалгаж байна...',
  }
}
```

---

### 2.3 Update OrdersPage to Show Payment Status

**File:** `apps/store/src/pages/OrdersPage.tsx`

**Modify order card to show payment status:**

```typescript
// Add payment status badge
<div className="flex justify-between items-start">
  <div>
    <p className="text-sm text-muted-foreground">
      {t('orderNumber')}: {order.id}
    </p>
    <p className="text-sm text-muted-foreground">
      {new Date(order.createdAt).toLocaleDateString()}
    </p>
    <p className="text-lg font-semibold mt-2">
      ₮{order.total.toLocaleString()}
    </p>

    {/* Payment Status Badge (ADD THIS) */}
    <span className={`inline-block px-2 py-1 rounded text-xs mt-2 ${
      order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' :
      order.paymentStatus === 'REFUNDED' ? 'bg-gray-100 text-gray-800' :
      'bg-yellow-100 text-yellow-800'
    }`}>
      {t(`paymentStatus.${order.paymentStatus.toLowerCase()}`)}
    </span>
  </div>

  <div>
    <span className={`px-3 py-1 rounded-full text-sm ${
      order.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
      order.status === 'SHIPPED' ? 'bg-blue-100 text-blue-800' :
      order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
      'bg-yellow-100 text-yellow-800'
    }`}>
      {t(`orderStatus.${order.status.toLowerCase()}`)}
    </span>
  </div>
</div>
```

**Add translations:**
```typescript
{
  en: {
    paymentStatus: {
      unpaid: 'Unpaid',
      paid: 'Paid',
      refunded: 'Refunded'
    }
  },
  mn: {
    paymentStatus: {
      unpaid: 'Төлөгдөөгүй',
      paid: 'Төлсөн',
      refunded: 'Буцаасан'
    }
  }
}
```

---

## Phase 3: Admin Panel Payment Management

### 3.1 Update Admin OrdersPage with Payment Info

**File:** `apps/admin/src/pages/OrdersPage.tsx`

**Add payment status column:**

```typescript
<TableHeader>
  <TableRow>
    <TableHead>Захиалгын дугаар</TableHead>
    <TableHead>Огноо</TableHead>
    <TableHead>Дүн</TableHead>
    <TableHead>Төлбөрийн төлөв</TableHead> {/* NEW COLUMN */}
    <TableHead>Захиалгын төлөв</TableHead>
    <TableHead>Үйлдэл</TableHead>
  </TableRow>
</TableHeader>
<TableBody>
  {orders.map((order) => (
    <TableRow key={order.id}>
      <TableCell className="font-mono text-sm">
        {order.id}
      </TableCell>
      <TableCell>
        {new Date(order.createdAt).toLocaleDateString('mn-MN')}
      </TableCell>
      <TableCell className="font-semibold">
        ₮{order.total.toLocaleString()}
      </TableCell>

      {/* Payment Status (NEW) */}
      <TableCell>
        <span className={`px-2 py-1 rounded text-xs ${
          order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' :
          order.paymentStatus === 'REFUNDED' ? 'bg-gray-100 text-gray-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {order.paymentStatus === 'PAID' ? 'Төлсөн' :
           order.paymentStatus === 'UNPAID' ? 'Төлөгдөөгүй' :
           'Буцаасан'}
        </span>
        {order.qpayPaymentId && (
          <p className="text-xs text-muted-foreground mt-1">
            ID: {order.qpayPaymentId.substring(0, 8)}
          </p>
        )}
      </TableCell>

      <TableCell>
        {/* Existing order status select */}
      </TableCell>
      <TableCell>
        {/* Existing actions */}
      </TableCell>
    </TableRow>
  ))}
</TableBody>
```

---

### 3.2 Add Refund Functionality (Admin)

**File:** `backend/src/routes/admin/orders.ts`

**Add refund endpoint:**

```typescript
import { qpayService } from '../../services/qpay.service'

// Refund order payment
fastify.post('/admin/orders/:id/refund', {
  preHandler: [adminGuard]
}, async (request, reply) => {
  const { id } = request.params

  try {
    const order = await prisma.order.findUnique({
      where: { id }
    })

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' })
    }

    if (order.paymentStatus !== 'PAID') {
      return reply.code(400).send({ error: 'Order not paid yet' })
    }

    if (!order.qpayPaymentId) {
      return reply.code(400).send({ error: 'No payment ID found' })
    }

    // Process refund with QPay
    await qpayService.refundPayment(order.qpayPaymentId)

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        paymentStatus: 'REFUNDED',
        status: 'CANCELLED'
      }
    })

    return reply.send({
      order: updatedOrder,
      message: 'Refund successful'
    })

  } catch (error: any) {
    console.error('Refund error:', error)
    return reply.code(500).send({
      error: 'Failed to process refund',
      details: error.message
    })
  }
})
```

---

## Phase 4: Testing

### 4.1 Local Testing Checklist

**Backend:**
- [ ] QPay authentication works (get token)
- [ ] Invoice creation returns QR code
- [ ] Payment callback endpoint receives data
- [ ] Payment verification works
- [ ] Order status updates correctly

**Frontend:**
- [ ] Checkout form collects shipping info
- [ ] QR code displays properly
- [ ] Banking app links work
- [ ] Payment status polls every 5 seconds
- [ ] Success page shows after payment

**Test Flow:**
1. Add products to cart
2. Go to checkout
3. Fill shipping form
4. Place order → see QR code
5. Use QPay sandbox app or test payment
6. Verify order status updates to PAID
7. Check order appears in "My Orders"

---

### 4.2 Production Deployment Checklist

**Environment Variables:**
- [ ] Update `QPAY_BASE_URL` to production
- [ ] Replace test credentials with production credentials from QPay
- [ ] Set correct `QPAY_CALLBACK_URL` with your domain
- [ ] Verify `QPAY_INVOICE_CODE` matches QPay merchant settings

**QPay Configuration:**
- [ ] Register production merchant account
- [ ] Get production `username` and `password`
- [ ] Configure callback URL in QPay merchant panel
- [ ] Test in QPay production environment

**Database:**
- [ ] Run migrations on production
- [ ] Verify indexes are created

**Security:**
- [ ] Webhook callback should verify request origin (QPay IP whitelist)
- [ ] Add rate limiting to payment endpoints
- [ ] Log all payment transactions for audit

---

## Phase 5: Advanced Features (Optional)

### 5.1 Electronic Receipt (Ebarimt) Integration

**When to generate ebarimt:**
After payment is confirmed, generate electronic receipt for tax compliance.

**Implementation:**

```typescript
// In payment callback, after updating order status:
if (order.paymentStatus === 'PAID' && order.qpayPaymentId) {
  try {
    await qpayService.createEbarimt(order.qpayPaymentId, 'CITIZEN')
    console.log('✅ Ebarimt generated for payment:', order.qpayPaymentId)
  } catch (error) {
    console.error('Failed to generate ebarimt:', error)
    // Don't fail the order, just log the error
  }
}
```

---

### 5.2 Email Notifications

**Install:**
```bash
npm install nodemailer
```

**Send email after payment:**
```typescript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  // Configure your email provider
})

// After payment confirmed:
await transporter.sendMail({
  from: 'noreply@yourstore.com',
  to: customer.email,
  subject: 'Payment Confirmed - Order #' + order.id,
  html: `
    <h1>Thank you for your payment!</h1>
    <p>Your order #${order.id} has been confirmed.</p>
    <p>Total: ₮${order.total}</p>
  `
})
```

---

### 5.3 Payment Timeout & Expiry

**Automatically cancel unpaid orders after 30 minutes:**

```typescript
// Scheduled job (use node-cron or similar)
import cron from 'node-cron'

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

  const expiredOrders = await prisma.order.findMany({
    where: {
      paymentStatus: 'UNPAID',
      createdAt: {
        lt: thirtyMinutesAgo
      }
    }
  })

  for (const order of expiredOrders) {
    if (order.qpayInvoiceId) {
      try {
        await qpayService.cancelInvoice(order.qpayInvoiceId)
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' }
        })
        console.log('❌ Cancelled expired order:', order.id)
      } catch (error) {
        console.error('Failed to cancel order:', error)
      }
    }
  }
})
```

---

## Summary

### Files Created (7 new files):
1. `backend/src/services/qpay.service.ts` - QPay API client
2. `backend/src/routes/payment.ts` - Payment webhook & verification
3. `backend/src/middleware/userGuard.ts` - User authentication (from previous plan)
4. Updated: `backend/src/routes/orders.ts` - Order creation with QPay
5. Updated: `apps/store/src/pages/CheckoutPage.tsx` - Complete payment UI
6. Updated: `apps/store/src/pages/OrdersPage.tsx` - Payment status display
7. Updated: `backend/prisma/schema.prisma` - Payment fields

### Files Modified (Minimal changes):
- `backend/src/app.ts` - Register payment routes (~2 lines)
- `backend/.env` - Add QPay credentials (~5 lines)
- `apps/store/src/i18n/translations.ts` - Add payment translations (~20 lines)

### Implementation Time:
- **Backend:** 1-2 days
- **Frontend:** 1-2 days
- **Testing:** 1 day
- **Total:** 3-5 days

### Key Features Implemented:
✅ Complete QPay integration
✅ QR code payment
✅ Banking app deep links
✅ Automatic payment verification
✅ Real-time payment status polling
✅ Webhook callback handling
✅ Admin payment management
✅ Refund functionality
✅ Electronic receipt (ebarimt)

---

**Ready to implement? Start with Phase 1.1!**
