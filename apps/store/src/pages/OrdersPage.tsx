import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Icon from '@/components/ui/AppIcon'
import { logger } from '@/lib/logger'

interface Order {
  id: string
  total: number
  status: string
  createdAt: string
  items: any
}

export default function OrdersPage() {
  const { user } = useAuth()
  const { language } = useTheme()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeExpanded, setActiveExpanded] = useState(true) // Active section expanded by default
  const [completedExpanded, setCompletedExpanded] = useState(false) // Completed section collapsed

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

      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }

      const { orders } = await response.json()
      setOrders(orders)
    } catch (error) {
      logger.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, {
      color: string;
      bgColor: string;
      icon: string;
      label: string;
      labelMn: string
    }> = {
      PENDING: {
        color: 'text-yellow-700 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        icon: 'ClockIcon',
        label: 'Pending',
        labelMn: 'Хүлээгдэж буй'
      },
      PAID: {
        color: 'text-emerald-700 dark:text-emerald-400',
        bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
        icon: 'CheckCircleIcon',
        label: 'Paid',
        labelMn: 'Төлөгдсөн'
      },
      SHIPPED: {
        color: 'text-blue-700 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        icon: 'TruckIcon',
        label: 'Shipped',
        labelMn: 'Илгээсэн'
      },
      COMPLETED: {
        color: 'text-green-700 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        icon: 'CheckBadgeIcon',
        label: 'Completed',
        labelMn: 'Дууссан'
      },
      CANCELLED: {
        color: 'text-red-700 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        icon: 'XCircleIcon',
        label: 'Cancelled',
        labelMn: 'Цуцлагдсан'
      },
      EXPIRED: {
        color: 'text-orange-700 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        icon: 'AlertTriangleIcon',
        label: 'Expired',
        labelMn: 'Хугацаа дууссан'
      },
    }

    const config = statusConfig[status] || statusConfig.PENDING
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-sm ${config.bgColor} ${config.color}`}>
        <Icon name={config.icon as any} size={16} />
        <span>{language === 'mn' ? config.labelMn : config.label}</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-32 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">
            {language === 'mn' ? 'Уншиж байна...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 min-h-screen">
        <Card className="max-w-md mx-auto text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Icon name="ShoppingBagIcon" size={48} className="text-muted-foreground" />
            </div>
            <CardTitle>
              {language === 'mn' ? 'Захиалга байхгүй байна' : 'No orders yet'}
            </CardTitle>
            <CardDescription>
              {language === 'mn'
                ? 'Та хараахан захиалга хийгээгүй байна'
                : "You haven't placed any orders yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/products">
                <Icon name="ShoppingBagIcon" size={18} className="mr-2" />
                {language === 'mn' ? 'Бүтээгдэхүүн үзэх' : 'Browse Products'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Split orders into active and completed
  const activeOrders = orders.filter(order =>
    ['PENDING', 'PAID', 'SHIPPED'].includes(order.status)
  )
  const completedOrders = orders.filter(order =>
    ['COMPLETED', 'EXPIRED', 'CANCELLED'].includes(order.status)
  )

  const renderOrderCard = (order: Order) => {
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
    const itemCount = Array.isArray(items) ? items.length : 0

    return (
      <Card key={order.id} className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-lg">
                  {language === 'mn' ? 'Захиалга' : 'Order'} #{order.id.substring(0, 8).toUpperCase()}
                </h3>
                {getStatusBadge(order.status)}
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <Icon name="CalendarIcon" size={14} className="inline mr-1" />
                  {new Date(order.createdAt).toLocaleDateString(language === 'mn' ? 'mn-MN' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                <p>
                  <Icon name="ShoppingBagIcon" size={14} className="inline mr-1" />
                  {itemCount} {language === 'mn' ? 'бараа' : 'items'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">
                  {language === 'mn' ? 'Нийт дүн' : 'Total'}
                </p>
                <p className="text-2xl font-bold text-primary">
                  ₮{Number(order.total).toLocaleString()}
                </p>
              </div>

              <Button asChild>
                <Link to={`/orders/${order.id}`}>
                  <Icon name="EyeIcon" size={18} className="mr-2" />
                  {language === 'mn' ? 'Дэлгэрэнгүй' : 'View Details'}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto px-4 py-32 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">
            {language === 'mn' ? 'Миний захиалгууд' : 'My Orders'}
          </h1>
          <Button asChild variant="outline">
            <Link to="/products">
              <Icon name="ShoppingBagIcon" size={18} className="mr-2" />
              {language === 'mn' ? 'Дахин худалдан авах' : 'Shop Again'}
            </Link>
          </Button>
        </div>

        <div className="space-y-6">
          {/* Active Orders Section */}
          {activeOrders.length > 0 && (
            <div>
              <button
                onClick={() => setActiveExpanded(!activeExpanded)}
                className="w-full flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors mb-4"
              >
                <div className="flex items-center gap-3">
                  <Icon
                    name={activeExpanded ? "ChevronDownIcon" : "ChevronRightIcon"}
                    size={20}
                    className="text-primary"
                  />
                  <h2 className="text-xl font-semibold">
                    {language === 'mn' ? '✓ Идэвхтэй захиалгууд' : '✓ Active Orders'}
                  </h2>
                  <Badge variant="secondary" className="ml-2">
                    {activeOrders.length}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === 'mn' ? 'Хүлээгдэж буй, Төлөгдсөн, Илгээгдсэн' : 'Pending, Paid, Shipped'}
                </p>
              </button>

              {activeExpanded && (
                <div className="space-y-4 pl-4">
                  {activeOrders.map(renderOrderCard)}
                </div>
              )}
            </div>
          )}

          {/* Completed Orders Section */}
          {completedOrders.length > 0 && (
            <div>
              <button
                onClick={() => setCompletedExpanded(!completedExpanded)}
                className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-lg transition-colors mb-4"
              >
                <div className="flex items-center gap-3">
                  <Icon
                    name={completedExpanded ? "ChevronDownIcon" : "ChevronRightIcon"}
                    size={20}
                    className="text-muted-foreground"
                  />
                  <h2 className="text-xl font-semibold">
                    {language === 'mn' ? '⊖ Дууссан захиалгууд' : '⊖ Completed Orders'}
                  </h2>
                  <Badge variant="outline" className="ml-2">
                    {completedOrders.length}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === 'mn' ? 'Дууссан, Хугацаа дууссан, Цуцлагдсан' : 'Completed, Expired, Cancelled'}
                </p>
              </button>

              {completedExpanded && (
                <div className="space-y-4 pl-4">
                  {completedOrders.map(renderOrderCard)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
