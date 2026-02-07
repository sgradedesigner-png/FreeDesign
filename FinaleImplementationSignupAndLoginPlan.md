# Final Implementation Plan: Signup and Login System
## Customized for Current Codebase

---

## Project Status Overview

**Current Status Analysis (2026-02-07):**

### ✅ COMPLETED - Phases 1-4 (Already Implemented)

#### Phase 1: Foundation & Auth Infrastructure ✅
- [x] AuthContext provider (Store: `apps/store/src/context/AuthContext.tsx`)
- [x] AuthContext provider (Admin: `apps/admin/src/auth/AuthContext.tsx`)
- [x] Supabase client configuration
- [x] Header integration with auth UI (Store: `apps/store/src/components/layout/Header.tsx`)
- [x] App.tsx provider hierarchy properly set up

#### Phase 2: Core Authentication Components ✅
- [x] AuthModal with Login/Signup tabs (`apps/store/src/components/auth/AuthModal.tsx`)
- [x] LoginForm with validation (`apps/store/src/components/auth/LoginForm.tsx`)
- [x] SignupForm with password strength (`apps/store/src/components/auth/SignupForm.tsx`)
- [x] ForgotPasswordDialog (`apps/store/src/components/auth/ForgotPasswordDialog.tsx`)
- [x] Bilingual support (Mongolian/English) in all auth components

#### Phase 3: Password Reset Flow ✅
- [x] Password reset page (`apps/store/src/pages/AuthResetPassword.tsx`)
- [x] Route registered: `/auth/reset`
- [x] Session validation and new password form
- [x] Invalid/expired link handling

#### Phase 4: Checkout Authentication Gate ✅
- [x] useCheckoutGate hook (`apps/store/src/hooks/useCheckoutGate.ts`)
- [x] CartPage integration with checkout gate
- [x] AuthModal opens when not authenticated
- [x] Callback execution after successful login

#### Backend Authentication ✅
- [x] Supabase JWT verification (`backend/src/supabaseauth.ts`)
- [x] adminGuard middleware (validates admin role from profiles table)
- [x] Protected admin routes (products, categories, stats, upload)
- [x] Public product catalog routes

---

## 🎯 REMAINING WORK - Phases 5-8

### Phase 5: Backend Order & User Management Endpoints

**Goal:** Create API endpoints for customer orders and user profiles

---

#### 5.1 Create userGuard Middleware
**File:** `backend/src/middleware/userGuard.ts` (NEW FILE)

**Purpose:** Authenticate any confirmed user (not just admins)

**Implementation:**
```typescript
import { FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../supabase'

export async function userGuard(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized - No token provided' })
  }

  const token = authHeader.substring(7)

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }

    // Attach user to request object
    request.user = user
  } catch (err) {
    console.error('User authentication error:', err)
    return reply.code(500).send({ error: 'Authentication failed' })
  }
}
```

**Difference from adminGuard:**
- Does NOT check Profile.role
- Only verifies valid Supabase JWT and confirmed email
- Any authenticated customer can access

---

#### 5.2 Create Order Routes
**File:** `backend/src/routes/orders.ts` (NEW FILE)

**Purpose:** Handle order creation and retrieval

**Implementation:**
```typescript
import { FastifyInstance } from 'fastify'
import { userGuard } from '../middleware/userGuard'
import { prisma } from '../prisma'

export default async function orderRoutes(fastify: FastifyInstance) {

  // Create new order (authenticated customers only)
  fastify.post('/api/orders', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = request.user.id
    const { items, shippingAddress, total } = request.body

    // Validate items exist and have stock
    // Calculate total on server-side (don't trust client)

    try {
      const order = await prisma.order.create({
        data: {
          userId,
          total,
          status: 'PENDING',
          shippingAddress: JSON.stringify(shippingAddress),
          items: JSON.stringify(items),
        }
      })

      return reply.code(201).send({ order })
    } catch (error) {
      console.error('Order creation error:', error)
      return reply.code(500).send({ error: 'Failed to create order' })
    }
  })

  // Get user's orders
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

  // Get specific order details
  fastify.get('/api/orders/:id', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = request.user.id
    const { id } = request.params

    try {
      const order = await prisma.order.findFirst({
        where: {
          id,
          userId // Ensure user can only see their own orders
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
}
```

---

#### 5.3 Create Admin Order Routes
**File:** `backend/src/routes/admin/orders.ts` (NEW FILE)

**Purpose:** Admin panel order management

**Implementation:**
```typescript
import { FastifyInstance } from 'fastify'
import { adminGuard } from '../../supabaseauth'
import { prisma } from '../../prisma'

export default async function adminOrderRoutes(fastify: FastifyInstance) {

  // Get all orders (admin only)
  fastify.get('/admin/orders', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    const { page = 1, limit = 20, status } = request.query

    const where = status ? { status } : {}

    try {
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.order.count({ where })
      ])

      return reply.send({
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    } catch (error) {
      console.error('Admin fetch orders error:', error)
      return reply.code(500).send({ error: 'Failed to fetch orders' })
    }
  })

  // Update order status
  fastify.put('/admin/orders/:id', {
    preHandler: [adminGuard]
  }, async (request, reply) => {
    const { id } = request.params
    const { status } = request.body

    // Validate status
    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({ error: 'Invalid status' })
    }

    try {
      const order = await prisma.order.update({
        where: { id },
        data: { status }
      })

      return reply.send({ order })
    } catch (error) {
      console.error('Update order error:', error)
      return reply.code(500).send({ error: 'Failed to update order' })
    }
  })
}
```

---

#### 5.4 Create User Profile Routes
**File:** `backend/src/routes/profile.ts` (NEW FILE)

**Purpose:** User profile management

**Implementation:**
```typescript
import { FastifyInstance } from 'fastify'
import { userGuard } from '../middleware/userGuard'
import { prisma } from '../prisma'

export default async function profileRoutes(fastify: FastifyInstance) {

  // Get user profile
  fastify.get('/api/profile', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = request.user.id

    try {
      let profile = await prisma.profile.findUnique({
        where: { id: userId }
      })

      // Create profile if doesn't exist
      if (!profile) {
        profile = await prisma.profile.create({
          data: {
            id: userId,
            email: request.user.email,
            role: 'CUSTOMER' // Default role
          }
        })
      }

      return reply.send({ profile })
    } catch (error) {
      console.error('Fetch profile error:', error)
      return reply.code(500).send({ error: 'Failed to fetch profile' })
    }
  })

  // Update user profile
  fastify.put('/api/profile', {
    preHandler: [userGuard]
  }, async (request, reply) => {
    const userId = request.user.id
    const { name, phone, address } = request.body

    try {
      const profile = await prisma.profile.upsert({
        where: { id: userId },
        update: {
          name,
          phone,
          address: address ? JSON.stringify(address) : null
        },
        create: {
          id: userId,
          email: request.user.email,
          name,
          phone,
          address: address ? JSON.stringify(address) : null,
          role: 'CUSTOMER'
        }
      })

      return reply.send({ profile })
    } catch (error) {
      console.error('Update profile error:', error)
      return reply.code(500).send({ error: 'Failed to update profile' })
    }
  })
}
```

---

#### 5.5 Update Database Schema
**File:** `backend/prisma/schema.prisma`

**Changes Required:**

```prisma
model Profile {
  id        String   @id // Supabase auth.users.id
  email     String?
  role      Role     @default(CUSTOMER)
  name      String?  // Add this
  phone     String?  // Add this
  address   String?  // JSON string for multiple addresses
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}

enum Role {
  ADMIN
  EDITOR
  CUSTOMER  // Add this
}

// Order model already exists - verify it has these fields
model Order {
  id              String   @id @default(cuid())
  userId          String
  total           Float
  status          String   @default("PENDING")
  shippingAddress String?  // JSON string
  items           String?  // JSON string of cart items
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
  @@index([status])
}
```

**Migration Command:**
```bash
cd backend
npx prisma migrate dev --name add_customer_profile_fields
```

---

#### 5.6 Register New Routes
**File:** `backend/src/app.ts`

**Changes:**

```typescript
// Add imports
import orderRoutes from './routes/orders'
import profileRoutes from './routes/profile'
import adminOrderRoutes from './routes/admin/orders'

// Register routes (add to existing route registrations)
await fastify.register(orderRoutes)
await fastify.register(profileRoutes)
await fastify.register(adminOrderRoutes)
```

**Minimal Diff:** Just add 3 new route registrations after existing ones

---

### Phase 6: Store App - Order & Profile Pages

**Goal:** Create customer-facing pages for orders and profile management

---

#### 6.1 Update CheckoutPage with Real API Integration
**File:** `apps/store/src/pages/CheckoutPage.tsx`

**Current Status:** Has TODO comment "Call backend API to create order"

**Changes Required:**

```typescript
// Add to existing imports
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

// Replace TODO section with:
const handlePlaceOrder = async () => {
  setLoading(true)

  try {
    // Get access token
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      toast.error('Please login to place order')
      return
    }

    // Call backend API
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

    const { order } = await response.json()

    // Clear cart
    clearCart()

    // Show success
    toast.success(t('orderPlaced'))

    // Redirect to order confirmation
    navigate(`/orders/${order.id}`)

  } catch (error) {
    console.error('Order creation error:', error)
    toast.error(t('orderFailed'))
  } finally {
    setLoading(false)
  }
}
```

**Minimal Diff:** Replace existing TODO block with actual implementation, ~25 lines changed

---

#### 6.2 Create Orders Page
**File:** `apps/store/src/pages/OrdersPage.tsx` (NEW FILE)

**Purpose:** Display user's order history

**Implementation:**
```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { useLanguage } from '@/context/LanguageContext'

interface Order {
  id: string
  total: number
  status: string
  createdAt: string
  items: any[]
}

export default function OrdersPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const { orders } = await response.json()
      setOrders(orders)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="container py-8">Loading...</div>
  }

  if (orders.length === 0) {
    return (
      <div className="container py-8 text-center">
        <h2 className="text-2xl font-bold mb-4">{t('noOrders')}</h2>
        <Button asChild>
          <Link to="/products">{t('startShopping')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">{t('myOrders')}</h1>

      <div className="space-y-4">
        {orders.map(order => (
          <Card key={order.id} className="p-6">
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

            <Button asChild variant="outline" className="mt-4">
              <Link to={`/orders/${order.id}`}>{t('viewDetails')}</Link>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

---

#### 6.3 Create Order Detail Page
**File:** `apps/store/src/pages/OrderDetailPage.tsx` (NEW FILE)

**Purpose:** Show single order details

**Implementation:**
```typescript
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/context/LanguageContext'

export default function OrderDetailPage() {
  const { id } = useParams()
  const { t } = useLanguage()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrder()
  }, [id])

  const fetchOrder = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/orders/${id}`,
        {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }
      )

      const { order } = await response.json()
      setOrder(order)
    } catch (error) {
      console.error('Failed to fetch order:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="container py-8">Loading...</div>
  if (!order) return <div className="container py-8">Order not found</div>

  const items = JSON.parse(order.items || '[]')
  const shippingAddress = JSON.parse(order.shippingAddress || '{}')

  return (
    <div className="container py-8">
      <Button asChild variant="ghost" className="mb-4">
        <Link to="/orders">← {t('backToOrders')}</Link>
      </Button>

      <h1 className="text-3xl font-bold mb-6">
        {t('orderDetails')}
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">{t('orderInfo')}</h2>
          <div className="space-y-2 text-sm">
            <p><strong>{t('orderNumber')}:</strong> {order.id}</p>
            <p><strong>{t('date')}:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
            <p><strong>{t('status')}:</strong> {order.status}</p>
            <p><strong>{t('total')}:</strong> ₮{order.total.toLocaleString()}</p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">{t('shippingAddress')}</h2>
          <div className="space-y-1 text-sm">
            <p>{shippingAddress.name}</p>
            <p>{shippingAddress.address}</p>
            <p>{shippingAddress.city}, {shippingAddress.zipCode}</p>
            <p>{shippingAddress.phone}</p>
          </div>
        </Card>
      </div>

      <Card className="p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">{t('orderItems')}</h2>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="flex justify-between items-center">
              <div className="flex items-center gap-4">
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
        </div>
      </Card>
    </div>
  )
}
```

---

#### 6.4 Create Profile Page
**File:** `apps/store/src/pages/ProfilePage.tsx` (NEW FILE)

**Purpose:** User profile management

**Implementation:**
```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useLanguage } from '@/context/LanguageContext'

export default function ProfilePage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    phone: '',
    address: ''
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/profile`,
        {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }
      )

      const { profile } = await response.json()

      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        address: profile.address ? JSON.parse(profile.address).street : ''
      })
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/profile`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
            address: { street: formData.address }
          })
        }
      )

      if (!response.ok) throw new Error('Failed to update profile')

      toast.success(t('profileUpdated'))
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error(t('profileUpdateFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">{t('myProfile')}</h1>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('emailCannotChange')}
            </p>
          </div>

          <div>
            <Label htmlFor="name">{t('name')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('enterName')}
            />
          </div>

          <div>
            <Label htmlFor="phone">{t('phone')}</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder={t('enterPhone')}
            />
          </div>

          <div>
            <Label htmlFor="address">{t('address')}</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder={t('enterAddress')}
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? t('saving') : t('saveChanges')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
```

---

#### 6.5 Add Routes for New Pages
**File:** `apps/store/src/App.tsx`

**Changes:**

```typescript
// Add imports
import OrdersPage from '@/pages/OrdersPage'
import OrderDetailPage from '@/pages/OrderDetailPage'
import ProfilePage from '@/pages/ProfilePage'

// Add routes (inside existing Routes component)
<Route path="/orders" element={<OrdersPage />} />
<Route path="/orders/:id" element={<OrderDetailPage />} />
<Route path="/profile" element={<ProfilePage />} />
```

**Minimal Diff:** Just add 3 route entries

---

#### 6.6 Update Translation Files
**File:** `apps/store/src/i18n/translations.ts` (or similar)

**Add translations for:**
```typescript
{
  en: {
    myOrders: 'My Orders',
    noOrders: 'No orders yet',
    orderNumber: 'Order Number',
    orderStatus: {
      pending: 'Pending',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled'
    },
    viewDetails: 'View Details',
    orderDetails: 'Order Details',
    orderInfo: 'Order Information',
    shippingAddress: 'Shipping Address',
    orderItems: 'Order Items',
    backToOrders: 'Back to Orders',
    myProfile: 'My Profile',
    profileUpdated: 'Profile updated successfully',
    profileUpdateFailed: 'Failed to update profile',
    emailCannotChange: 'Email cannot be changed',
    enterName: 'Enter your name',
    enterPhone: 'Enter phone number',
    enterAddress: 'Enter address',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    orderPlaced: 'Order placed successfully!',
    orderFailed: 'Failed to place order'
  },
  mn: {
    myOrders: 'Миний захиалгууд',
    noOrders: 'Захиалга байхгүй байна',
    // ... Mongolian translations
  }
}
```

---

### Phase 7: Admin App - Order Management

**Goal:** Create admin panel for managing customer orders

---

#### 7.1 Create Orders Page
**File:** `apps/admin/src/pages/OrdersPage.tsx` (NEW FILE)

**Purpose:** Admin order list and management

**Implementation:**
```typescript
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Order {
  id: string
  userId: string
  total: number
  status: string
  createdAt: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchOrders()
  }, [filter])

  const fetchOrders = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const { data } = await api.get('/admin/orders', { params })
      setOrders(data.orders)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/admin/orders/${orderId}`, { status: newStatus })
      fetchOrders() // Refresh list
    } catch (error) {
      console.error('Failed to update order:', error)
    }
  }

  if (loading) {
    return <div className="p-8">Уншиж байна...</div>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Захиалгууд</h1>

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Статусаар шүүх" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүгд</SelectItem>
            <SelectItem value="PENDING">Хүлээгдэж буй</SelectItem>
            <SelectItem value="PROCESSING">Боловсруулж буй</SelectItem>
            <SelectItem value="SHIPPED">Илгээсэн</SelectItem>
            <SelectItem value="DELIVERED">Хүргэсэн</SelectItem>
            <SelectItem value="CANCELLED">Цуцалсан</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Захиалгын дугаар</TableHead>
              <TableHead>Огноо</TableHead>
              <TableHead>Дүн</TableHead>
              <TableHead>Статус</TableHead>
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
                <TableCell>
                  <Select
                    value={order.status}
                    onValueChange={(status) => updateOrderStatus(order.id, status)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Хүлээгдэж буй</SelectItem>
                      <SelectItem value="PROCESSING">Боловсруулж буй</SelectItem>
                      <SelectItem value="SHIPPED">Илгээсэн</SelectItem>
                      <SelectItem value="DELIVERED">Хүргэсэн</SelectItem>
                      <SelectItem value="CANCELLED">Цуцалсан</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {/* Navigate to order details */}}
                  >
                    Дэлгэрэнгүй
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

---

#### 7.2 Add Route for Orders Page
**File:** `apps/admin/src/App.tsx`

**Changes:**

```typescript
// Add import
import OrdersPage from '@/pages/OrdersPage'

// Add route (inside ProtectedRoute wrapper)
<Route path="/orders" element={<OrdersPage />} />
```

---

#### 7.3 Update Sidebar Navigation
**File:** `apps/admin/src/components/layout/Sidebar.tsx` (or wherever navigation is)

**Add navigation link:**
```typescript
<Link to="/orders">
  <ShoppingCart className="mr-2" />
  Захиалгууд
</Link>
```

---

### Phase 8: Testing & Polish

**Goal:** Ensure everything works end-to-end

---

#### 8.1 End-to-End Testing Checklist

**Customer Flow:**
- [ ] Signup → email confirmation → login ✅ (already working)
- [ ] Add products to cart
- [ ] Click checkout → login if needed ✅ (already working)
- [ ] Fill shipping form → place order
- [ ] See order in "My Orders" page
- [ ] View order details

**Admin Flow:**
- [ ] Login to admin panel ✅ (already working)
- [ ] See new order in Orders page
- [ ] Update order status
- [ ] Filter orders by status

**Profile Management:**
- [ ] Customer updates profile (name, phone, address)
- [ ] Profile data persists
- [ ] Profile data shown in checkout

---

#### 8.2 Environment Variables Verification

**Store (.env):**
```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3000
```

**Backend (.env):**
```env
SUPABASE_URL=your-project-url
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=your-database-url
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

---

#### 8.3 Database Migration Steps

```bash
# 1. Navigate to backend
cd backend

# 2. Update schema.prisma with new fields (already shown in 5.5)

# 3. Create migration
npx prisma migrate dev --name add_order_and_profile_system

# 4. Generate Prisma client
npx prisma generate

# 5. (Optional) Seed test data
npx prisma db seed
```

---

## Implementation Order

### Week 1: Backend Foundation
**Day 1:**
- [ ] Create userGuard middleware (5.1)
- [ ] Update database schema (5.5)
- [ ] Run migrations

**Day 2:**
- [ ] Create order routes (5.2)
- [ ] Create admin order routes (5.3)
- [ ] Register routes in app.ts (5.6)
- [ ] Test with Postman/Thunder Client

**Day 3:**
- [ ] Create profile routes (5.4)
- [ ] Test profile endpoints
- [ ] Verify all auth guards work

### Week 2: Store App Frontend
**Day 4:**
- [ ] Update CheckoutPage with API integration (6.1)
- [ ] Test order creation flow

**Day 5:**
- [ ] Create OrdersPage (6.2)
- [ ] Create OrderDetailPage (6.3)
- [ ] Add routes to App.tsx (6.5)

**Day 6:**
- [ ] Create ProfilePage (6.4)
- [ ] Update translation files (6.6)
- [ ] Test all customer pages

### Week 3: Admin App & Polish
**Day 7:**
- [ ] Create admin OrdersPage (7.1)
- [ ] Add route and navigation (7.2, 7.3)
- [ ] Test admin order management

**Day 8-9:**
- [ ] End-to-end testing (8.1)
- [ ] Bug fixes
- [ ] UI polish

**Day 10:**
- [ ] Final testing
- [ ] Documentation
- [ ] Deployment preparation

---

## Success Criteria

### Must Have ✅
- [x] Authentication system (Phases 1-4) ✅ ALREADY DONE
- [ ] Users can place orders through checkout
- [ ] Users can view their order history
- [ ] Users can update their profile
- [ ] Admins can view all orders
- [ ] Admins can update order status
- [ ] Order status filters in admin
- [ ] Profile data persists correctly
- [ ] All pages support Mongolian/English

### Nice to Have (Post-MVP)
- [ ] Email notifications for order status changes
- [ ] Order tracking page with timeline
- [ ] Multiple shipping addresses
- [ ] Payment gateway integration (Stripe, PayPal)
- [ ] Invoice generation (PDF)
- [ ] Reorder functionality
- [ ] Order search in admin

---

## File Changes Summary

### NEW Files to Create (12 files)

**Backend:**
1. `backend/src/middleware/userGuard.ts`
2. `backend/src/routes/orders.ts`
3. `backend/src/routes/admin/orders.ts`
4. `backend/src/routes/profile.ts`

**Store:**
5. `apps/store/src/pages/OrdersPage.tsx`
6. `apps/store/src/pages/OrderDetailPage.tsx`
7. `apps/store/src/pages/ProfilePage.tsx`

**Admin:**
8. `apps/admin/src/pages/OrdersPage.tsx`

### Files to MODIFY (Minimal Changes)

**Backend:**
1. `backend/prisma/schema.prisma` - Add CUSTOMER role, name/phone fields
2. `backend/src/app.ts` - Register 3 new route files (~3 lines)

**Store:**
3. `apps/store/src/pages/CheckoutPage.tsx` - Replace TODO with API call (~25 lines)
4. `apps/store/src/App.tsx` - Add 3 routes (~3 lines)
5. `apps/store/src/i18n/translations.ts` - Add new translation keys

**Admin:**
6. `apps/admin/src/App.tsx` - Add 1 route (~1 line)
7. `apps/admin/src/components/layout/Sidebar.tsx` - Add navigation link (~3 lines)

**Total Modified:** 7 files with minimal diffs
**Total New:** 12 files

---

## Risk Mitigation

### Potential Issues & Solutions

**Issue 1:** Order creation fails due to validation
- **Solution:** Add proper error handling and validation in backend
- **Test:** Try submitting empty cart, invalid items, tampered prices

**Issue 2:** Token expiry during checkout
- **Solution:** Already handled by existing AuthContext token refresh
- **Test:** Wait for token to expire, then checkout

**Issue 3:** CORS issues when calling order API
- **Solution:** CORS already configured for localhost:5173 in backend
- **Verify:** Check `CORS_ORIGIN` in backend .env

**Issue 4:** Order items not displaying correctly
- **Solution:** Ensure JSON parsing handles edge cases (empty arrays, malformed JSON)
- **Test:** Create order with various item combinations

---

## Performance Considerations

1. **Pagination:** Admin orders page already includes pagination (limit: 20)
2. **Indexes:** Database schema includes indexes on userId and status
3. **Lazy Loading:** Consider lazy loading OrderDetailPage
4. **Caching:** Profile data can be cached in memory for session

---

## Security Checklist

- [x] JWT verification via userGuard ✅
- [x] User can only see their own orders (userId filter) ✅
- [x] Admin-only routes protected by adminGuard ✅
- [ ] Server-side total calculation (don't trust client)
- [ ] Input validation on all endpoints
- [ ] Rate limiting on order creation (prevent spam)
- [ ] SQL injection protection (Prisma handles this)
- [ ] XSS protection (React auto-escapes)

---

## Appendix

### A. Database Schema Reference

```prisma
model Profile {
  id        String   @id
  email     String?
  role      Role     @default(CUSTOMER)
  name      String?
  phone     String?
  address   String?  // JSON
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  ADMIN
  EDITOR
  CUSTOMER
}

model Order {
  id              String   @id @default(cuid())
  userId          String
  total           Float
  status          String   @default("PENDING")
  shippingAddress String?  // JSON
  items           String?  // JSON
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### B. API Endpoints Summary

**Public:**
- `GET /api/products/...` (no auth required)

**Authenticated Customers:**
- `POST /api/orders` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order details
- `GET /api/profile` - Get profile
- `PUT /api/profile` - Update profile

**Admins:**
- `GET /admin/orders` - List all orders
- `PUT /admin/orders/:id` - Update order status
- `GET /admin/products/...` (existing)
- `POST /admin/products/...` (existing)

---

**End of Final Implementation Plan**

**Estimated Effort:** 10 days (1 developer)

**Current Status:** Phases 1-4 Complete ✅

**Next Steps:** Start with Phase 5 (Backend Order System)

**Priority:** High

**Target Completion:** 2 weeks from start
