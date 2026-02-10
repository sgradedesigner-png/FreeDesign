import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import Icon from '@/components/ui/AppIcon'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface Order {
  id: string
  total: number
  status: string
  createdAt: string
  items: any
  shippingAddress: any
  // Payment fields (returned by API but previously not used)
  paymentStatus?: string      // 'UNPAID', 'PAID', 'REFUNDED'
  qpayInvoiceId?: string      // QPay invoice ID
  qrCode?: string             // QR code image (base64)
  qrCodeUrl?: string          // QPay short URL
  qrText?: string             // QR text URL (for sandbox testing)
  // Phase 1: Expiration management
  qpayInvoiceExpiresAt?: string  // ISO date string - when invoice expires
  expiredAt?: string             // ISO date string - when order was marked expired
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { language } = useTheme()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [autoCheckCount, setAutoCheckCount] = useState(0)

  useEffect(() => {
    fetchOrder()
  }, [id])

  // Auto-refresh every 10 seconds if order is unpaid and not expired
  useEffect(() => {
    // Don't auto-refresh if:
    // 1. Order not loaded
    // 2. Payment already completed
    // 3. Order status is EXPIRED
    // 4. Invoice expiration time has passed
    if (!order ||
        order.paymentStatus === 'PAID' ||
        order.status === 'EXPIRED' ||
        (order.qpayInvoiceExpiresAt && new Date(order.qpayInvoiceExpiresAt) < new Date())
    ) {
      return
    }

    const interval = setInterval(() => {
      setAutoCheckCount(prev => prev + 1)
      setLastChecked(new Date())
      fetchOrder()
    }, 10000) // 10 seconds

    return () => clearInterval(interval)
  }, [order?.id, order?.paymentStatus, order?.status, order?.qpayInvoiceExpiresAt])

  const fetchOrder = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setRefreshing(true)

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

      const { order: fetchedOrder } = await response.json()

      // If manual refresh button clicked, show appropriate notification
      if (showRefreshToast) {
        // Check if payment status changed from UNPAID to PAID
        if (order && order.paymentStatus === 'UNPAID' && fetchedOrder.paymentStatus === 'PAID') {
          toast.success(
            language === 'mn'
              ? '🎉 Төлбөр амжилттай төлөгдлөө!'
              : '🎉 Payment confirmed!'
          )
        }
        // Payment still pending
        else if (fetchedOrder.paymentStatus === 'UNPAID') {
          toast.info(
            language === 'mn'
              ? '⏱️ Төлбөр хүлээгдэж байна. QR код уншуулж төлнө үү.'
              : '⏱️ Payment pending. Please scan the QR code to pay.',
            { duration: 4000 }
          )
        }
        // Already paid
        else if (fetchedOrder.paymentStatus === 'PAID') {
          toast.success(
            language === 'mn'
              ? '✅ Төлбөр төлөгдсөн байна'
              : '✅ Payment already completed'
          )
        }
        // Other status
        else {
          toast.info(
            language === 'mn'
              ? 'Мэдээлэл шинэчлэгдлээ'
              : 'Order refreshed'
          )
        }
      }
      // Auto-refresh (background): only notify on payment confirmation
      else if (order && order.paymentStatus === 'UNPAID' && fetchedOrder.paymentStatus === 'PAID') {
        toast.success(
          language === 'mn'
            ? '🎉 Төлбөр амжилттай төлөгдлөө!'
            : '🎉 Payment confirmed!'
        )
      }

      setOrder(fetchedOrder)

    } catch (error) {
      logger.error('Failed to fetch order:', error)
      if (showRefreshToast) {
        toast.error(
          language === 'mn'
            ? '❌ Төлвийг шалгахад алдаа гарлаа. Дахин оролдоно уу.'
            : '❌ Failed to check payment status. Please try again.'
        )
      }
    } finally {
      setLoading(false)
      if (showRefreshToast) setRefreshing(false)
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

        {/* ⭐ NEW: Payment Section - Show QR for Unpaid Orders (NOT expired) */}
        {order.paymentStatus === 'UNPAID' &&
         order.qrCode &&
         order.qpayInvoiceId &&
         order.status !== 'EXPIRED' &&
         !(order.qpayInvoiceExpiresAt && new Date(order.qpayInvoiceExpiresAt) < new Date()) && (
          <Card className="mt-6 border-2 border-primary shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Icon name="CreditCardIcon" size={20} />
                {language === 'mn' ? 'Төлбөр төлөх' : 'Complete Payment'}
              </CardTitle>
              <CardDescription>
                {language === 'mn'
                  ? 'QR код уншуулж төлбөрөө төлнө үү'
                  : 'Scan QR code with your banking app to complete payment'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                {/* Phase 1: Expiration Warning */}
                {order.qpayInvoiceExpiresAt && (() => {
                  const now = new Date();
                  const expiresAt = new Date(order.qpayInvoiceExpiresAt);
                  const hoursRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
                  const isExpiringSoon = hoursRemaining <= 24 && hoursRemaining > 0;
                  const isExpired = hoursRemaining <= 0;

                  if (isExpired) {
                    return (
                      <div className="w-full p-4 bg-red-50 dark:bg-red-950/30 border-2 border-red-500 rounded-lg">
                        <p className="text-red-700 dark:text-red-300 font-semibold flex items-center gap-2">
                          <Icon name="AlertTriangleIcon" size={20} />
                          {language === 'mn'
                            ? '⚠️ Энэ захиалгын төлбөрийн хугацаа дууссан байна'
                            : '⚠️ This order\'s payment deadline has expired'}
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                          {language === 'mn'
                            ? 'QR код идэвхгүй болсон. Шинэ захиалга үүсгэх шаардлагатай.'
                            : 'QR code is inactive. Please create a new order.'}
                        </p>
                        <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                          {language === 'mn'
                            ? `Хугацаа дууссан: ${expiresAt.toLocaleString('mn-MN')}`
                            : `Expired at: ${expiresAt.toLocaleString()}`}
                        </p>
                      </div>
                    );
                  }

                  if (isExpiringSoon) {
                    return (
                      <div className="w-full p-4 bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-500 rounded-lg">
                        <p className="text-yellow-700 dark:text-yellow-300 font-semibold flex items-center gap-2">
                          <Icon name="ClockIcon" size={20} />
                          {language === 'mn'
                            ? `⏰ Төлбөрийн хугацаа дуусахад ${hoursRemaining} цаг үлдлээ`
                            : `⏰ ${hoursRemaining} hours remaining to pay`}
                        </p>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                          {language === 'mn'
                            ? 'Та яаралтай төлбөрөө төлнө үү. Хугацаа дууссаны дараа QR код идэвхгүй болно.'
                            : 'Please pay urgently. QR code will become inactive after expiration.'}
                        </p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                          {language === 'mn'
                            ? `Хугацаа дуусах: ${expiresAt.toLocaleString('mn-MN')}`
                            : `Expires at: ${expiresAt.toLocaleString()}`}
                        </p>
                      </div>
                    );
                  }

                  // More than 24 hours remaining - show subtle info
                  return (
                    <p className="text-xs text-muted-foreground w-full text-center">
                      {language === 'mn'
                        ? `Төлбөрийн хугацаа: ${expiresAt.toLocaleString('mn-MN')}`
                        : `Payment deadline: ${expiresAt.toLocaleString()}`}
                    </p>
                  );
                })()}

                {/* QR Code Display */}
                <div className="p-4 md:p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border-4 border-primary">
                  <img
                    src={order.qrCode.startsWith('data:') ? order.qrCode : `data:image/png;base64,${order.qrCode}`}
                    alt="Payment QR Code"
                    className="w-64 h-64 md:w-80 md:h-80 rounded-lg"
                  />
                </div>

                {/* Amount Display */}
                <div className="text-center p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl w-full">
                  <p className="text-sm text-muted-foreground mb-1">
                    {language === 'mn' ? 'Төлөх дүн' : 'Amount to Pay'}
                  </p>
                  <p className="text-3xl md:text-4xl font-bold text-primary">
                    ₮{Number(order.total).toLocaleString()}
                  </p>
                </div>

                {/* Instructions */}
                <div className="w-full p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100 text-center">
                    {language === 'mn'
                      ? '💡 Банкны апп нээж QR код уншуулна уу. Төлбөр төлөгдсөн даруй автоматаар баталгаажна.'
                      : '💡 Open your banking app and scan the QR code. Payment will be confirmed automatically.'}
                  </p>
                </div>

                {/* QR Text URL for Sandbox Testing */}
                {order.qrText && (
                  <div className="w-full p-3 md:p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="LinkIcon" size={16} className="text-blue-600 dark:text-blue-400" />
                      <p className="text-xs md:text-sm font-semibold text-blue-900 dark:text-blue-100">
                        {language === 'mn' ? 'QR Текст URL (Тестлэхэд)' : 'QR Text URL (For Testing)'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded border border-blue-200 dark:border-blue-700 p-2 md:p-3 mb-2">
                      <p className="text-xs md:text-sm font-mono text-blue-800 dark:text-blue-200 break-all">
                        {order.qrText}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(order.qrText!)
                        toast.success(language === 'mn' ? 'QR текст хуулагдлаа!' : 'QR Text copied!')
                      }}
                    >
                      <Icon name="CopyIcon" size={14} className="mr-2" />
                      {language === 'mn' ? 'QR текст хуулах' : 'Copy QR Text'}
                    </Button>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col md:flex-row gap-3 w-full">
                  {/* QPay Link Button (if available) */}
                  {order.qrCodeUrl && (
                    <Button asChild className="flex-1" size="lg">
                      <a href={order.qrCodeUrl} target="_blank" rel="noopener noreferrer">
                        <Icon name="ExternalLinkIcon" size={18} className="mr-2" />
                        {language === 'mn' ? 'QPay-ээр нээх' : 'Open in QPay'}
                      </a>
                    </Button>
                  )}

                  {/* Manual Refresh Button */}
                  <Button
                    variant="outline"
                    onClick={() => fetchOrder(true)}
                    disabled={refreshing}
                    className="flex-1"
                    size="lg"
                  >
                    {refreshing ? (
                      <>
                        <Icon name="Loader2Icon" size={18} className="mr-2 animate-spin" />
                        {language === 'mn' ? 'Шалгаж байна...' : 'Checking...'}
                      </>
                    ) : (
                      <>
                        <Icon name="RefreshCwIcon" size={18} className="mr-2" />
                        {language === 'mn' ? 'Төлвийг шалгах' : 'Check Payment Status'}
                      </>
                    )}
                  </Button>
                </div>

                {/* Auto-refresh indicator with real-time info */}
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    {language === 'mn'
                      ? 'Автомат шалгалт идэвхтэй (10 сек тутамд)'
                      : 'Auto-refresh active (every 10 seconds)'}
                  </p>
                  {lastChecked && (
                    <p className="text-xs text-muted-foreground/70">
                      {language === 'mn' ? 'Сүүлд шалгасан' : 'Last checked'}:{' '}
                      {lastChecked.toLocaleTimeString(language === 'mn' ? 'mn-MN' : 'en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                      {autoCheckCount > 0 && ` (${autoCheckCount}x)`}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expired Order Message */}
        {(order.status === 'EXPIRED' || (order.paymentStatus === 'UNPAID' && order.qpayInvoiceExpiresAt && new Date(order.qpayInvoiceExpiresAt) < new Date())) && (
          <Card className="mt-6 border-2 border-red-500 bg-red-50 dark:bg-red-950/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
                <Icon name="XCircleIcon" size={24} />
                <div>
                  <p className="font-semibold text-lg">
                    {language === 'mn' ? 'Захиалгын хугацаа дууссан' : 'Order Expired'}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-500">
                    {language === 'mn'
                      ? 'Төлбөрийн хугацаа дууссан тул энэ захиалга цуцлагдсан байна. Та дахин захиалга өгнө үү.'
                      : 'This order has been cancelled due to payment timeout. Please create a new order.'}
                  </p>
                  {order.qpayInvoiceExpiresAt && (
                    <p className="text-xs text-red-500 dark:text-red-600 mt-1">
                      {language === 'mn'
                        ? `Хугацаа дууссан: ${new Date(order.qpayInvoiceExpiresAt).toLocaleString('mn-MN')}`
                        : `Expired at: ${new Date(order.qpayInvoiceExpiresAt).toLocaleString()}`}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Confirmed Message */}
        {order.paymentStatus === 'PAID' && (
          <Card className="mt-6 border-2 border-green-500 bg-green-50 dark:bg-green-950/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
                <Icon name="CheckCircle2Icon" size={24} />
                <div>
                  <p className="font-semibold text-lg">
                    {language === 'mn' ? 'Төлбөр төлөгдсөн' : 'Payment Confirmed'}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    {language === 'mn'
                      ? 'Таны захиалга амжилттай төлөгдлөө. Удахгүй илгээх болно.'
                      : 'Your payment has been confirmed. We will ship your order soon.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
