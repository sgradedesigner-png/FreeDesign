import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import Icon from '@/components/ui/AppIcon'

interface Order {
  id: string
  total: number
  status: string
  createdAt: string
  items: any
  shippingAddress: any
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { language } = useTheme()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrder()
  }, [id])

  const fetchOrder = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        navigate('/login')
        return
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/orders/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch order')
      }

      const { order } = await response.json()
      setOrder(order)
    } catch (error) {
      console.error('Failed to fetch order:', error)
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

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-32 min-h-screen">
        <Card className="max-w-md mx-auto text-center">
          <CardHeader>
            <CardTitle>
              {language === 'mn' ? 'Захиалга олдсонгүй' : 'Order not found'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/orders">
                {language === 'mn' ? 'Буцах' : 'Back to Orders'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
  const shippingAddress = order.shippingAddress
    ? typeof order.shippingAddress === 'string'
      ? JSON.parse(order.shippingAddress)
      : order.shippingAddress
    : null

  return (
    <div className="container mx-auto px-4 py-32 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Button asChild variant="ghost" className="mb-6">
          <Link to="/orders">
            <Icon name="ArrowLeftIcon" size={18} className="mr-2" />
            {language === 'mn' ? 'Буцах' : 'Back to Orders'}
          </Link>
        </Button>

        {/* Order Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {language === 'mn' ? 'Захиалгын дэлгэрэнгүй' : 'Order Details'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'mn' ? 'Захиалгын дугаар' : 'Order ID'}: {order.id.substring(0, 8).toUpperCase()}
            </p>
          </div>
          {getStatusBadge(order.status)}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="ShoppingBagIcon" size={20} />
                {language === 'mn' ? 'Захиалгын мэдээлэл' : 'Order Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'mn' ? 'Огноо' : 'Date'}
                </p>
                <p className="font-medium">
                  {new Date(order.createdAt).toLocaleDateString(language === 'mn' ? 'mn-MN' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === 'mn' ? 'Нийт дүн' : 'Total Amount'}
                </p>
                <p className="text-2xl font-bold text-primary">
                  ₮{Number(order.total).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="MapPinIcon" size={20} />
                  {language === 'mn' ? 'Хүргэлтийн хаяг' : 'Shipping Address'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="font-medium">{shippingAddress.fullName}</p>
                <p className="text-sm text-muted-foreground">{shippingAddress.phone}</p>
                <p className="text-sm text-muted-foreground">{shippingAddress.address}</p>
                <p className="text-sm text-muted-foreground">
                  {shippingAddress.city} {shippingAddress.zipCode}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Items */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="PackageIcon" size={20} />
              {language === 'mn' ? 'Захиалсан бараа' : 'Order Items'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.isArray(items) && items.map((item: any, index: number) => (
                <div key={index} className="flex items-center gap-4">
                  {item.imagePath && (
                    <img
                      src={item.imagePath}
                      alt={item.productName}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium">{item.productName}</h4>
                    <p className="text-sm text-muted-foreground">{item.variantName}</p>
                    <p className="text-sm text-muted-foreground">
                      {language === 'mn' ? 'Тоо ширхэг' : 'Quantity'}: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      ₮{(item.variantPrice * item.quantity).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ₮{item.variantPrice.toLocaleString()} × {item.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="flex justify-between items-center text-lg font-bold">
              <span>{language === 'mn' ? 'Нийт' : 'Total'}</span>
              <span className="text-primary">₮{Number(order.total).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <Button asChild variant="outline" className="flex-1">
            <Link to="/products">
              <Icon name="ShoppingBagIcon" size={18} className="mr-2" />
              {language === 'mn' ? 'Дахин худалдан авах' : 'Shop Again'}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
