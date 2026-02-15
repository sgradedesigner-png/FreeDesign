import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import Icon from '@/components/ui/AppIcon'
import { toast } from 'sonner'
import { imageUrl } from '@/lib/imageUrl'
import { logger } from '@/lib/logger'

interface PaymentInfo {
  qrCode: string
  qrCodeUrl: string
  qrText?: string // QR text URL for sandbox testing
  bankUrls: Array<{
    name: string
    description: string
    logo: string
    link: string
  }>
  invoiceId: string
}

const normalizeQrCodeSrc = (raw: string): string => {
  const value = (raw || '').trim()
  if (!value) return ''
  if (/^data:image\//i.test(value)) return value
  if (/^https?:\/\//i.test(value)) return value
  return `data:image/png;base64,${value}`
}

const normalizeBankLogoUrl = (raw: string): string => {
  const value = (raw || '').trim()
  if (!value) return ''
  if (value.startsWith('//')) return `https:${value}`
  if (/^http:\/\//i.test(value)) return value.replace(/^http:\/\//i, 'https://')
  if (/^https?:\/\//i.test(value)) return value
  return ''
}

function CheckoutPage() {
  const navigate = useNavigate()
  const { cart, cartTotal, clearCart } = useCart()
  const { user } = useAuth()
  const { language } = useTheme()

  const [loading, setLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'paid' | 'failed' | 'timeout'>('pending')
  const [brokenBankLogos, setBrokenBankLogos] = useState<Record<string, boolean>>({})
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // Try to restore shipping info from sessionStorage
  const getInitialShippingInfo = () => {
    const saved = sessionStorage.getItem('checkout-shipping-info')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return { fullName: '', phone: '', address: '', city: '', zipCode: '' }
      }
    }
    return { fullName: '', phone: '', address: '', city: '', zipCode: '' }
  }

  const [shippingInfo, setShippingInfo] = useState(getInitialShippingInfo())
  const [savedAddress, setSavedAddress] = useState<any>(null)
  const rushFeeTotal = cart.reduce((sum, item: any) => sum + Number(item.rushFee || 0), 0)
  const addOnFeeTotal = cart.reduce((sum, item: any) => sum + Number(item.addOnFees || 0), 0)

  // Save shipping info to sessionStorage whenever it changes
  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.setItem('checkout-shipping-info', JSON.stringify(shippingInfo))
    }, 500)
    return () => clearTimeout(timer)
  }, [shippingInfo])

  // Fetch user's saved profile address when logged in
  useEffect(() => {
    if (user) {
      fetchProfileAddress()
    }
  }, [user])

  // Define checkPaymentStatus before it's used in useEffect
  const checkPaymentStatus = useCallback(async () => {
    if (!orderId) return

    setPaymentStatus('checking')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        logger.warn('No session token available')
        return
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/orders/${orderId}/payment-status`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Payment status check failed')
      }

      const data = await response.json()

      if (data.paid) {
        setPaymentStatus('paid')
        toast.success(language === 'en' ? 'Payment successful!' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€ Ð°Ð¼Ð¶Ð¸Ð»Ñ‚Ñ‚Ð°Ð¹!')

        // Clear cart
        try {
          clearCart()
        } catch (error) {
          logger.error('Failed to clear cart:', error)
        }

        sessionStorage.removeItem('checkout-shipping-info')

        // Redirect to order details after 2 seconds
        setTimeout(() => {
          if (orderId) {
            navigate(`/orders/${orderId}`)
          }
        }, 2000)
      } else {
        setPaymentStatus('pending')
      }

    } catch (error) {
      logger.error('Payment check error:', error)
      setPaymentStatus('failed')
      const errorMsg = language === 'en' ? 'Failed to check payment status' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ‚Ó©Ð»Ó©Ð² ÑˆÐ°Ð»Ð³Ð°Ñ…Ð°Ð´ Ð°Ð»Ð´Ð°Ð° Ð³Ð°Ñ€Ð»Ð°Ð°'
      setPaymentError(errorMsg)
      toast.error(errorMsg)
    }
  }, [orderId, language, clearCart, navigate])

  // Poll for payment status with timeout protection
  useEffect(() => {
    if (!orderId || paymentStatus !== 'pending') return

    let pollCount = 0
    const MAX_POLLS = 60 // 60 polls Ã— 5 seconds = 5 minutes max
    const startTime = Date.now()
    const MAX_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

    const interval = setInterval(async () => {
      pollCount++
      const elapsed = Date.now() - startTime

      // Check if we've exceeded the maximum polling time
      if (pollCount >= MAX_POLLS || elapsed >= MAX_DURATION) {
        clearInterval(interval)
        setPaymentStatus('timeout')
        toast.error(
          language === 'en'
            ? 'Payment verification timed out. Please check your order status manually.'
            : 'Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ð±Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶ÑƒÑƒÐ»Ð°Ð»Ñ‚ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ñ…ÑÑ‚ÑÑ€ÑÑÐ½. Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ñ‚Ó©Ð»Ð²Ð¸Ð¹Ð³ Ð³Ð°Ñ€Ð°Ð°Ñ€ ÑˆÐ°Ð»Ð³Ð°Ð½Ð° ÑƒÑƒ.'
        )
        logger.warn(`Payment polling timed out after ${pollCount} attempts (${Math.round(elapsed / 1000)}s)`)
        return
      }

      try {
        await checkPaymentStatus()
      } catch (error) {
        logger.error('Payment polling error:', error)
        // Continue polling even if one check fails
      }
    }, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [orderId, paymentStatus, checkPaymentStatus, language])

  const fetchProfileAddress = async () => {
    if (!user) return

    setLoadingProfile(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.profile?.address && data.profile?.phone && data.profile?.name) {
          // Parse address if it's a JSON string
          let addressValue = data.profile.address
          try {
            const parsed = JSON.parse(data.profile.address)
            addressValue = parsed.street || parsed.address || data.profile.address
          } catch {
            addressValue = data.profile.address
          }

          setSavedAddress({
            fullName: data.profile.name,
            phone: data.profile.phone,
            address: addressValue,
            city: '',
            zipCode: ''
          })
        }
      }
    } catch (error) {
      logger.error('Failed to fetch profile:', error)
    } finally {
      setLoadingProfile(false)
    }
  }

  const useSavedAddress = () => {
    if (savedAddress) {
      setShippingInfo(savedAddress)
      toast.success(language === 'en' ? 'Saved address loaded' : 'Ð¥Ð°Ð´Ð³Ð°Ð»ÑÐ°Ð½ Ñ…Ð°ÑÐ³ Ð°Ñ‡Ð°Ð°Ð»Ð»Ð°Ð³Ð´Ð»Ð°Ð°')
    }
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate cart is not empty
      if (!cart || cart.length === 0) {
        toast.error(language === 'en' ? 'Your cart is empty' : 'Ð¢Ð°Ð½Ñ‹ ÑÐ°Ð³Ñ Ñ…Ð¾Ð¾ÑÐ¾Ð½ Ð±Ð°Ð¹Ð½Ð°')
        setLoading(false)
        navigate('/products')
        return
      }

      // Validate form
      if (!shippingInfo.fullName || !shippingInfo.phone || !shippingInfo.address) {
        toast.error(language === 'en' ? 'Please complete all required fields' : 'Ð‘Ò¯Ñ… ÑˆÐ°Ð°Ñ€Ð´Ð»Ð°Ð³Ð°Ñ‚Ð°Ð¹ Ñ‚Ð°Ð»Ð±Ð°Ñ€Ñ‹Ð³ Ð±Ó©Ð³Ð»Ó©Ð½Ó© Ò¯Ò¯')
        setLoading(false)
        return
      }

      // Validate address length (minimum 5 characters)
      if (shippingInfo.address.trim().length < 5) {
        toast.error(
          language === 'en'
            ? 'Address is too short. Please enter at least 5 characters'
            : 'Ð¥Ð°ÑÐ³ Ñ…ÑÑ‚ Ð±Ð¾Ð³Ð¸Ð½Ð¾ Ð±Ð°Ð¹Ð½Ð°. Ð”Ð¾Ð¾Ð´ Ñ‚Ð°Ð» Ð½ÑŒ 5 Ñ‚ÑÐ¼Ð´ÑÐ³Ñ‚ Ð¾Ñ€ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ'
        )
        setLoading(false)
        return
      }

      // Validate phone number (8 digits for Mongolia)
      if (!/^\d{8}$/.test(shippingInfo.phone)) {
        toast.error(
          language === 'en'
            ? 'Phone number must be 8 digits'
            : 'Ð£Ñ‚Ð°ÑÐ½Ñ‹ Ð´ÑƒÐ³Ð°Ð°Ñ€ 8 Ð¾Ñ€Ð¾Ð½Ñ‚Ð¾Ð¹ Ð±Ð°Ð¹Ñ… Ñ‘ÑÑ‚Ð¾Ð¹'
        )
        setLoading(false)
        return
      }

      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(language === 'en' ? 'Please login to continue' : 'ÐÑÐ²Ñ‚ÑÑ€Ñ‡ Ð¾Ñ€Ð½Ð¾ ÑƒÑƒ')
        const returnTo = encodeURIComponent(window.location.pathname)
        navigate(`/login?returnTo=${returnTo}`)
        return
      }

      // Create order with QPay invoice
      // Convert cart items to proper format for backend
      const orderItems = cart.map((item) => ({
        id: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        variantPrice: Number(item.variantPrice),
        quantity: item.quantity,
        imagePath: item.variantImage,
        addOns: item.addOns?.map((addOn) => ({
          id: addOn.id,
          name: addOn.name,
          fee: Number(addOn.fee),
        })),
        customizations: item.customizations?.map((customization) => ({
          printAreaId: customization.printAreaId,
          printSizeTierId: customization.printSizeTierId,
          assetId: customization.assetId,
          printFee: Number(customization.printFee),
          placementConfig: customization.placementConfig,
        })),
      }));

      const rushOrder = cart.some((item) => item.rushOrder);
      const rushFee = cart.reduce((sum, item) => sum + Number(item.rushFee || 0), 0);
      const addOnFees = cart.reduce((sum, item) => sum + Number(item.addOnFees || 0), 0);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          items: orderItems,
          shippingAddress: shippingInfo,
          rushOrder,
          rushFee,
          addOnFees,
          total: Number(cartTotal)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()

        // Handle validation errors with specific field messages
        if (errorData.error === 'Validation failed' && errorData.details) {
          const validationErrors = errorData.details
            .map((err: any) => err.message || `${err.field}: validation error`)
            .join(', ')
          throw new Error(validationErrors)
        }

        throw new Error(errorData.details || errorData.error || 'Failed to create order')
      }

      const { order, payment } = await response.json()

      setOrderId(order.id)
      setPaymentInfo(payment)
      toast.success(language === 'en' ? 'Order created! Please complete payment' : 'Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ò¯Ò¯ÑÐ³ÑÐ³Ð´Ð»ÑÑ! Ð¢Ó©Ð»Ð±Ó©Ñ€Ó©Ó© Ñ‚Ó©Ð»Ð½Ó© Ò¯Ò¯')

      // Start checking payment status
      setPaymentStatus('pending')

    } catch (error: any) {
      logger.error('Order creation error:', error)
      const errorMsg = error.message || (language === 'en' ? 'Failed to create order' : 'Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° Ò¯Ò¯ÑÐ³ÑÑ…ÑÐ´ Ð°Ð»Ð´Ð°Ð° Ð³Ð°Ñ€Ð»Ð°Ð°')
      setCheckoutError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // Show payment QR code screen
  if (paymentInfo && orderId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 pt-20 md:pt-24 pb-6 md:pb-12">
        <div className="container max-w-6xl px-4">
          {/* Header with Progress - PAYMENT STEP */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              {language === 'en' ? 'Checkout' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€ Ñ‚Ó©Ð»Ó©Ñ…'}
            </h1>

            {/* Progress Steps - Step 2 Active */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 opacity-60">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white font-bold text-sm">
                  <Icon name="Check" className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-muted-foreground">
                  {language === 'en' ? 'Shipping Info' : 'Ð¥Ò¯Ñ€Ð³ÑÐ»Ñ‚Ð¸Ð¹Ð½ Ð¼ÑÐ´ÑÑÐ»ÑÐ»'}
                </span>
              </div>
              <div className="h-[2px] flex-1 bg-primary"></div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold text-sm">
                  2
                </div>
                <span className="text-sm font-semibold">
                  {language === 'en' ? 'Payment' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€'}
                </span>
              </div>
            </div>

            {/* Back Button */}
            <Button
              variant="outline"
              onClick={() => {
                setPaymentInfo(null)
                setOrderId(null)
                setPaymentStatus('pending')
              }}
              size="sm"
            >
              <Icon name="ArrowLeft" className="mr-2 h-4 w-4" />
              {language === 'en' ? 'Back to Shipping Info' : 'Ð‘ÑƒÑ†Ð°Ñ…'}
            </Button>
          </div>

          {/* Page Title & Status */}
          <div className="text-center mb-6 md:mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              {language === 'en' ? 'Complete Your Payment' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€Ó©Ó© Ñ‚Ó©Ð»Ó©Ñ…'}
            </h2>

            {/* Large Status Badge */}
            {paymentStatus === 'paid' ? (
              <div className="inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 bg-green-500 text-white rounded-full font-semibold text-sm md:text-lg animate-pulse">
                <Icon name="CheckCircle2" className="h-5 w-5 md:h-6 md:w-6" />
                {language === 'en' ? 'Payment Confirmed!' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€ Ð±Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶Ð»Ð°Ð°!'}
              </div>
            ) : paymentStatus === 'timeout' ? (
              <div className="inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 bg-orange-500 text-white rounded-full font-semibold text-sm md:text-lg">
                <Icon name="AlertCircle" className="h-5 w-5 md:h-6 md:w-6" />
                {language === 'en' ? 'Verification Timed Out' : 'Ð¥ÑƒÐ³Ð°Ñ†Ð°Ð° Ñ…ÑÑ‚ÑÑ€ÑÑÐ½'}
              </div>
            ) : paymentStatus === 'checking' ? (
              <div className="inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 bg-blue-500 text-white rounded-full font-semibold text-sm md:text-lg">
                <Icon name="Loader2" className="h-5 w-5 md:h-6 md:w-6 animate-spin" />
                {language === 'en' ? 'Checking Payment...' : 'Ð¨Ð°Ð»Ð³Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...'}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 bg-yellow-500 text-white rounded-full font-semibold text-sm md:text-lg">
                <Icon name="Clock" className="h-5 w-5 md:h-6 md:w-6 animate-pulse" />
                {language === 'en' ? 'Waiting for Payment' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€ Ñ…Ò¯Ð»ÑÑÐ¶ Ð±Ð°Ð¹Ð½Ð°'}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* LEFT: QR Code Section */}
            <Card className="p-4 md:p-8">
              <div className="text-center">
                <div className="mb-4 md:mb-6">
                  <h2 className="text-xl md:text-2xl font-bold mb-2">
                    {language === 'en' ? 'Scan QR Code' : 'QR ÐºÐ¾Ð´ ÑƒÐ½ÑˆÑƒÑƒÐ»Ð°Ñ…'}
                  </h2>
                  <p className="text-sm md:text-base text-muted-foreground">
                    {language === 'en'
                      ? 'Use your banking app to scan and pay'
                      : 'Ð‘Ð°Ð½ÐºÐ½Ñ‹ Ð°Ð¿Ð¿-Ð°Ð°Ñ€Ð°Ð° ÑƒÐ½ÑˆÑƒÑƒÐ»Ð¶ Ñ‚Ó©Ð»Ð½Ó© Ò¯Ò¯'}
                  </p>
                </div>

                {/* Large QR Code with animation */}
                <div className="flex justify-center mb-6 md:mb-8">
                  <div className={`relative p-4 md:p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-4 ${
                    paymentStatus === 'paid' ? 'border-green-500' : 'border-primary'
                  } transition-all duration-500`}>
                    <img
                      data-testid="qpay-qr-code"
                      src={normalizeQrCodeSrc(paymentInfo.qrCode)}
                      alt="Payment QR Code"
                      className="w-64 h-64 md:w-80 md:h-80 rounded-lg"
                    />

                    {/* Paid Overlay */}
                    {paymentStatus === 'paid' && (
                      <div className="absolute inset-0 bg-green-500/90 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <div className="text-center text-white">
                          <Icon name="CheckCircle2" className="h-16 w-16 md:h-24 md:w-24 mx-auto mb-4 animate-bounce" />
                          <p className="text-xl md:text-2xl font-bold">
                            {language === 'en' ? 'Payment Complete!' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€ Ñ‚Ó©Ð»Ó©Ð³Ð´Ð»Ó©Ó©!'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Number & Amount */}
                <div className="mb-4 md:mb-6 p-4 md:p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl">
                  <p className="text-xs md:text-sm text-muted-foreground mb-2">
                    {language === 'en' ? 'Order #' : 'Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ð° #'}
                  </p>
                  <p className="text-base md:text-lg font-mono font-semibold mb-3">
                    {orderId.substring(0, 13).toUpperCase()}
                  </p>
                  <div className="text-3xl md:text-4xl font-bold text-primary">
                    â‚®{Number(cartTotal || 0).toLocaleString()}
                  </div>
                </div>

                {/* QR Text URL for Sandbox Testing (if available) */}
                {paymentInfo.qrText && (
                  <div className="mb-4 md:mb-6 p-3 md:p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="Link" className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <p className="text-xs md:text-sm font-semibold text-blue-900 dark:text-blue-100">
                        {language === 'en' ? 'QR Text URL (For Testing)' : 'QR Ð¢ÐµÐºÑÑ‚ URL (Ð¢ÐµÑÑ‚Ð»ÑÑ…ÑÐ´)'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded border border-blue-200 dark:border-blue-700 p-2 md:p-3 break-all">
                      <p className="text-xs md:text-sm font-mono text-blue-800 dark:text-blue-200">
                        {paymentInfo.qrText}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(paymentInfo.qrText!)
                        toast.success(language === 'en' ? 'QR Text URL copied!' : 'QR Ñ‚ÐµÐºÑÑ‚ Ñ…ÑƒÑƒÐ»Ð°Ð³Ð´Ð»Ð°Ð°!')
                      }}
                    >
                      <Icon name="Copy" className="mr-2 h-3 w-3" />
                      {language === 'en' ? 'Copy QR Text' : 'QR Ñ‚ÐµÐºÑÑ‚ Ñ…ÑƒÑƒÐ»Ð°Ñ…'}
                    </Button>
                  </div>
                )}

                {/* Banking App Quick Links */}
                {paymentInfo.bankUrls && paymentInfo.bankUrls.length > 0 && (
                  <div className="mb-4 md:mb-6">
                    <p className="text-xs md:text-sm font-semibold mb-3 md:mb-4 text-left">
                      {language === 'en' ? 'Quick Pay with Banking App:' : 'Ð‘Ð°Ð½ÐºÐ½Ñ‹ Ð°Ð¿Ð¿-Ð°Ð°Ñ€ ÑˆÑƒÑƒÐ´ Ñ‚Ó©Ð»Ó©Ñ…:'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      {paymentInfo.bankUrls.map((bank, index) => {
                        const bankKey = `${bank.name}-${index}`
                        const logoSrc = normalizeBankLogoUrl(bank.logo)
                        const showLogo = Boolean(logoSrc) && !brokenBankLogos[bankKey]

                        return (
                          <a
                            key={bankKey}
                            href={bank.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-2 p-3 md:p-4 border-2 rounded-xl hover:border-primary hover:bg-primary/5 transition-all duration-300 hover:scale-105 cursor-pointer active:scale-95"
                          >
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-md overflow-hidden">
                              {showLogo ? (
                                <img
                                  src={logoSrc}
                                  alt={bank.name}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={() => {
                                    setBrokenBankLogos((prev) => ({ ...prev, [bankKey]: true }))
                                  }}
                                />
                              ) : (
                                <span className="text-xl md:text-2xl font-bold text-primary">
                                  {(bank.name || '?').charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="text-xs md:text-sm font-semibold text-center">{bank.name}</span>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 md:space-y-3">
                  {/* Timeout Message */}
                  {paymentStatus === 'timeout' && (
                    <Alert data-testid="payment-timeout-message" className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                      <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                        <div className="flex items-start gap-2">
                          <Icon name="AlertCircle" className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold mb-1">
                              {language === 'en' ? 'Verification Timeout' : 'Ð‘Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶ÑƒÑƒÐ»Ð°Ð»Ñ‚ Ñ…ÑƒÐ³Ð°Ñ†Ð°Ð° Ñ…ÑÑ‚ÑÑ€ÑÑÐ½'}
                            </p>
                            <p className="text-xs">
                              {language === 'en'
                                ? 'Automatic verification has timed out after 5 minutes. If you completed the payment, please click "Check Payment Status" below or check your order history.'
                                : '5 Ð¼Ð¸Ð½ÑƒÑ‚Ñ‹Ð½ Ð´Ð°Ñ€Ð°Ð° Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚ ÑˆÐ°Ð»Ð³Ð°Ð»Ñ‚ Ð·Ð¾Ð³ÑÑÐ¾Ð½. Ð¥ÑÑ€ÑÐ² Ñ‚Ð° Ñ‚Ó©Ð»Ð±Ó©Ñ€Ó©Ó© Ñ‚Ó©Ð»ÑÓ©Ð½ Ð±Ð¾Ð» "Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ‚Ó©Ð»Ó©Ð² ÑˆÐ°Ð»Ð³Ð°Ñ…" Ñ‚Ð¾Ð²Ñ‡Ð¸Ð¹Ð³ Ð´Ð°Ñ€Ð°Ñ… ÑÑÐ²ÑÐ» Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ñ‚Ò¯Ò¯Ñ…ÑÑ ÑˆÐ°Ð»Ð³Ð°Ð½Ð° ÑƒÑƒ.'}
                            </p>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Payment Error Display */}
                  {paymentError && (
                    <div data-testid="payment-error" className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <p className="text-red-600 text-sm">{paymentError}</p>
                    </div>
                  )}

                  <Button
                    data-testid="payment-polling"
                    onClick={() => {
                      setPaymentStatus('pending')
                      checkPaymentStatus()
                    }}
                    disabled={paymentStatus === 'checking' || paymentStatus === 'paid'}
                    className="w-full h-11 md:h-12"
                  >
                    {paymentStatus === 'checking' ? (
                      <>
                        <Icon name="Loader2" className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                        <span className="text-sm md:text-base">
                          {language === 'en' ? 'Checking...' : 'Ð¨Ð°Ð»Ð³Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð°...'}
                        </span>
                      </>
                    ) : paymentStatus === 'paid' ? (
                      <>
                        <Icon name="CheckCircle2" className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                        <span className="text-sm md:text-base">
                          {language === 'en' ? 'Payment Confirmed' : 'Ð‘Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶ÑÐ°Ð½'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Icon name="RefreshCw" className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                        <span className="text-sm md:text-base">
                          {language === 'en' ? 'Check Payment Status' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ‚Ó©Ð»Ó©Ð² ÑˆÐ°Ð»Ð³Ð°Ñ…'}
                        </span>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => navigate('/orders')}
                    className="w-full h-10 md:h-11"
                  >
                    <Icon name="Package" className="mr-2 h-4 w-4" />
                    <span className="text-sm md:text-base">
                      {language === 'en' ? 'View My Orders' : 'ÐœÐ¸Ð½Ð¸Ð¹ Ð·Ð°Ñ…Ð¸Ð°Ð»Ð³ÑƒÑƒÐ´'}
                    </span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* RIGHT: Order Summary */}
            <div className="space-y-4 md:space-y-6">
              <Card className="p-4 md:p-6">
                <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 flex items-center gap-2">
                  <Icon name="ShoppingBag" className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  {language === 'en' ? 'Order Summary' : 'Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ð´ÑÐ»Ð³ÑÑ€ÑÐ½Ð³Ò¯Ð¹'}
                </h3>

                <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                  {cart && cart.map((item: any) => (
                    <div key={item.cartKey} className="flex gap-3 md:gap-4 pb-3 md:pb-4 border-b last:border-0">
                      <img
                        src={imageUrl(item.variantImage) || '/placeholder.png'}
                        alt={item.productName}
                        className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg shadow-sm flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm md:text-base truncate">{item.productName}</p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">{item.variantName}</p>
                        {item.size && item.size !== 'none' && (
                          <p className="text-xs text-muted-foreground">Size: {item.size}</p>
                        )}
                        {item.customizations?.length ? (
                          <p className="text-xs text-muted-foreground">
                            Custom areas: {item.customizations.length}
                          </p>
                        ) : null}
                        {/* Phase 2: Display upload info if present */}
                        {(item.optionPayload?.uploadAssetId || item.selectedOptions?.uploadAssetId) && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs">
                            <Icon name="FileImage" size={14} className="text-primary flex-shrink-0" />
                            <span className="text-primary font-medium truncate">
                              {item.optionPayload?.uploadFileName || item.selectedOptions?.uploadFileName || (language === 'en' ? 'File uploaded' : 'Upload хийсэн')}
                            </span>
                            {item.optionPayload?.gangSheetLength && (
                              <Badge variant="secondary" className="text-xs py-0 px-1.5 h-4">
                                {item.optionPayload.gangSheetLength}cm
                              </Badge>
                            )}
                          </div>
                        )}
                        <p className="text-xs md:text-sm font-semibold mt-1 text-primary">
                          â‚®{Number(item.variantPrice).toLocaleString()} Ã— {item.quantity}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-base md:text-lg">
                          â‚®{(Number(item.variantPrice) * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="pt-3 md:pt-4 border-t-2">
                  <div className="flex justify-between items-center">
                    <span className="text-base md:text-lg font-semibold">
                      {language === 'en' ? 'Total Amount' : 'ÐÐ¸Ð¹Ñ‚ Ð´Ò¯Ð½'}
                    </span>
                    <span className="text-2xl md:text-3xl font-bold text-primary">
                      â‚®{Number(cartTotal || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Payment Instructions */}
              <Card className="p-4 md:p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                <h4 className="font-bold mb-3 flex items-center gap-2 text-blue-900 dark:text-blue-100 text-sm md:text-base">
                  <Icon name="Info" className="h-4 w-4 md:h-5 md:w-5" />
                  {language === 'en' ? 'How to Pay' : 'Ð¢Ó©Ð»Ó©Ñ… Ð·Ð°Ð°Ð²Ð°Ñ€'}
                </h4>
                <ol className="space-y-2 text-xs md:text-sm text-blue-800 dark:text-blue-200">
                  <li className="flex gap-2">
                    <span className="font-bold flex-shrink-0">1.</span>
                    <span>
                      {language === 'en'
                        ? 'Open your banking app (Khan Bank, TDB, Golomt, etc.)'
                        : 'Ð‘Ð°Ð½ÐºÐ½Ñ‹ Ð°Ð¿Ð¿-Ð°Ð° Ð½ÑÑÐ½Ñ Ò¯Ò¯ (Ð¥Ð°Ð°Ð½ Ð±Ð°Ð½Ðº, Ð¥Ð¥Ð‘, Ð“Ð¾Ð»Ð¾Ð¼Ñ‚ Ð³ÑÑ… Ð¼ÑÑ‚)'}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold flex-shrink-0">2.</span>
                    <span>
                      {language === 'en'
                        ? 'Find the QR code scanner feature'
                        : 'QR ÐºÐ¾Ð´ ÑƒÐ½ÑˆÐ¸Ð³Ñ‡ Ñ…ÑÑÐ³Ð¸Ð¹Ð³ Ð¾Ð»Ð¾Ð½Ð¾ ÑƒÑƒ'}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold flex-shrink-0">3.</span>
                    <span>
                      {language === 'en'
                        ? 'Scan the QR code shown above'
                        : 'Ð”ÑÑÑ€Ñ… QR ÐºÐ¾Ð´Ñ‹Ð³ ÑƒÐ½ÑˆÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ'}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold flex-shrink-0">4.</span>
                    <span>
                      {language === 'en'
                        ? 'Confirm the payment in your banking app'
                        : 'Ð‘Ð°Ð½ÐºÐ½Ñ‹ Ð°Ð¿Ð¿ Ð´ÑÑÑ€ÑÑ Ñ‚Ó©Ð»Ð±Ó©Ñ€Ó©Ó© Ð±Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ'}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold flex-shrink-0">5.</span>
                    <span>
                      {language === 'en'
                        ? 'Wait for confirmation (usually instant)'
                        : 'Ð‘Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶ÑƒÑƒÐ»Ð°Ð»Ñ‚ Ñ…Ò¯Ð»ÑÑÐ½Ñ Ò¯Ò¯ (Ð¸Ñ…ÑÐ²Ñ‡Ð»ÑÐ½ ÑˆÑƒÑƒÐ´)'}
                    </span>
                  </li>
                </ol>
              </Card>

              {/* Timer/Auto-check info */}
              <Card className="p-3 md:p-4 bg-muted/50">
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2 flex-wrap">
                  <Icon name="Clock" className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                  <span className="text-center">
                    {language === 'en'
                      ? 'Payment status is automatically checked every 5 seconds (max 5 minutes)'
                      : 'Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ‚Ó©Ð»Ó©Ð² 5 ÑÐµÐºÑƒÐ½Ð´ Ñ‚ÑƒÑ‚Ð°Ð¼Ð´ Ð°Ð²Ñ‚Ð¾Ð¼Ð°Ñ‚Ð°Ð°Ñ€ ÑˆÐ°Ð»Ð³Ð°Ð³Ð´Ð°Ð¶ Ð±Ð°Ð¹Ð½Ð° (Ð´ÑÑÐ´ Ñ‚Ð°Ð» Ð½ÑŒ 5 Ð¼Ð¸Ð½ÑƒÑ‚)'}
                  </span>
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show checkout form
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 pt-20 md:pt-24 pb-8 md:pb-12">
      <div className="container max-w-6xl px-4">
        {/* Header with Progress */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {language === 'en' ? 'Checkout' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€ Ñ‚Ó©Ð»Ó©Ñ…'}
          </h1>

          {/* Progress Steps */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold text-sm">
                1
              </div>
              <span className="text-sm font-semibold">
                {language === 'en' ? 'Shipping Info' : 'Ð¥Ò¯Ñ€Ð³ÑÐ»Ñ‚Ð¸Ð¹Ð½ Ð¼ÑÐ´ÑÑÐ»ÑÐ»'}
              </span>
            </div>
            <div className="h-[2px] flex-1 bg-muted"></div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold text-sm">
                2
              </div>
              <span className="text-sm text-muted-foreground">
                {language === 'en' ? 'Payment' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* LEFT: Shipping Form */}
          <Card className="p-6 md:p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="Truck" className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold">
                {language === 'en' ? 'Shipping Information' : 'Ð¥Ò¯Ñ€Ð³ÑÐ»Ñ‚Ð¸Ð¹Ð½ Ð¼ÑÐ´ÑÑÐ»ÑÐ»'}
              </h2>
            </div>

            {/* Saved Address Card */}
            {savedAddress && (
              <div className="mb-6 p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="MapPin" className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">
                      {language === 'en' ? 'Saved Address Available' : 'Ð¥Ð°Ð´Ð³Ð°Ð»ÑÐ°Ð½ Ñ…Ð°ÑÐ³ Ð±Ð°Ð¹Ð½Ð°'}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={useSavedAddress}
                  disabled={loadingProfile}
                  size="sm"
                  className="w-full"
                >
                  <Icon name="Check" className="mr-2 h-4 w-4" />
                  {language === 'en' ? 'Use Saved Address' : 'Ð¥Ð°Ð´Ð³Ð°Ð»ÑÐ°Ð½ Ñ…Ð°ÑÐ³ Ð°ÑˆÐ¸Ð³Ð»Ð°Ñ…'}
                </Button>
              </div>
            )}

            {/* Checkout Error Display */}
            {checkoutError && (
              <div data-testid="checkout-error" className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-600 text-sm">{checkoutError}</p>
              </div>
            )}

            <form onSubmit={handlePlaceOrder} className="space-y-5">
            {/* Full Name */}
            <div>
              <Label htmlFor="fullName" className="flex items-center gap-2 mb-2">
                <Icon name="User" className="h-4 w-4 text-primary" />
                {language === 'en' ? 'Full Name' : 'ÐžÐ²Ð¾Ð³ Ð½ÑÑ€'} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fullName"
                data-testid="shipping-name"
                value={shippingInfo.fullName}
                onChange={(e) => setShippingInfo({ ...shippingInfo, fullName: e.target.value })}
                placeholder={language === 'en' ? 'Enter your full name' : 'ÐžÐ²Ð¾Ð³ Ð½ÑÑ€ÑÑ Ð¾Ñ€ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ'}
                required
                className="h-11"
              />
            </div>

            {/* Phone Number */}
            <div>
              <Label htmlFor="phone" className="flex items-center gap-2 mb-2">
                <Icon name="Phone" className="h-4 w-4 text-primary" />
                {language === 'en' ? 'Phone Number' : 'Ð£Ñ‚Ð°ÑÐ½Ñ‹ Ð´ÑƒÐ³Ð°Ð°Ñ€'} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                data-testid="shipping-phone"
                type="tel"
                value={shippingInfo.phone}
                onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                placeholder={language === 'en' ? '99119911' : '99119911'}
                required
                className="h-11"
              />
            </div>

            {/* Address */}
            <div>
              <Label htmlFor="address" className="flex items-center gap-2 mb-2">
                <Icon name="MapPin" className="h-4 w-4 text-primary" />
                {language === 'en' ? 'Address' : 'Ð¥Ð°ÑÐ³'} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="address"
                data-testid="shipping-address"
                value={shippingInfo.address}
                onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                placeholder={
                  language === 'en'
                    ? 'e.g., Bayangol District, 5th Khoroo, Peace Avenue 123'
                    : 'Ð–Ð¸ÑˆÑÑ: Ð‘Ð°ÑÐ½Ð³Ð¾Ð» Ð´Ò¯Ò¯Ñ€ÑÐ³, 5-Ñ€ Ñ…Ð¾Ñ€Ð¾Ð¾, Ð­Ð½Ñ…Ñ‚Ð°Ð¹Ð²Ð½Ñ‹ Ó©Ñ€Ð³Ó©Ð½ Ñ‡Ó©Ð»Ó©Ó© 123'
                }
                required
                minLength={5}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'en'
                  ? 'Minimum 5 characters required'
                  : 'Ð”Ð¾Ð¾Ð´ Ñ‚Ð°Ð» Ð½ÑŒ 5 Ñ‚ÑÐ¼Ð´ÑÐ³Ñ‚ ÑˆÐ°Ð°Ñ€Ð´Ð»Ð°Ð³Ð°Ñ‚Ð°Ð¹'}
              </p>
            </div>

            {/* City & Zip Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city" className="flex items-center gap-2 mb-2">
                  <Icon name="Building" className="h-4 w-4 text-primary" />
                  {language === 'en' ? 'City' : 'Ð¥Ð¾Ñ‚'}
                </Label>
                <Input
                  id="city"
                  value={shippingInfo.city}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                  placeholder={language === 'en' ? 'City' : 'Ð¥Ð¾Ñ‚'}
                  className="h-11"
                />
              </div>

              <div>
                <Label htmlFor="zipCode" className="flex items-center gap-2 mb-2">
                  <Icon name="Hash" className="h-4 w-4 text-primary" />
                  {language === 'en' ? 'Zip Code' : 'Ð—Ð¸Ð¿ ÐºÐ¾Ð´'}
                </Label>
                <Input
                  id="zipCode"
                  value={shippingInfo.zipCode}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, zipCode: e.target.value })}
                  placeholder={language === 'en' ? 'Zip code' : 'Ð—Ð¸Ð¿ ÐºÐ¾Ð´'}
                  className="h-11"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                data-testid="submit-order-btn"
                size="lg"
                className="w-full h-12 text-base font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
                    {language === 'en' ? 'Processing...' : 'Ð‘Ð¾Ð»Ð¾Ð²ÑÑ€ÑƒÑƒÐ»Ð¶ Ð±Ð°Ð¹Ð½Ð°...'}
                  </>
                ) : (
                  <>
                    <Icon name="ArrowRight" className="mr-2 h-5 w-5" />
                    {language === 'en' ? 'Continue to Payment' : 'Ð¢Ó©Ð»Ð±Ó©Ñ€ Ñ‚Ó©Ð»Ó©Ñ…'}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                {language === 'en'
                  ? 'You will be redirected to payment page'
                  : 'Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ…ÑƒÑƒÐ´Ð°Ñ Ñ€ÑƒÑƒ ÑˆÐ¸Ð»Ð¶Ð¸Ñ… Ð±Ð¾Ð»Ð½Ð¾'}
              </p>
            </div>
          </form>
        </Card>

        {/* RIGHT: Order Summary */}
        <div className="space-y-6">
          {/* Order Items */}
          <Card className="p-6 md:p-8 shadow-lg sticky top-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="ShoppingCart" className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold">
                {language === 'en' ? 'Order Summary' : 'Ð—Ð°Ñ…Ð¸Ð°Ð»Ð³Ñ‹Ð½ Ð´ÑÐ»Ð³ÑÑ€ÑÐ½Ð³Ò¯Ð¹'}
              </h2>
            </div>

            {/* Items List */}
            <div className="space-y-4 mb-6">
              {cart && cart.map((item: any) => (
                <div key={item.cartKey} className="flex gap-4 pb-4 border-b last:border-0">
                  <div className="relative">
                    <img
                      src={imageUrl(item.variantImage) || '/placeholder.png'}
                      alt={item.productName}
                      className="w-20 h-20 object-cover rounded-lg shadow-sm"
                    />
                    <div className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                      {item.quantity}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.variantName}</p>
                    {item.size && item.size !== 'none' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <Icon name="Ruler" className="inline h-3 w-3 mr-1" />
                        Size: {item.size}
                      </p>
                    )}
                    {item.customizations?.length ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        <Icon name="Palette" className="inline h-3 w-3 mr-1" />
                        Custom areas: {item.customizations.length}
                      </p>
                    ) : null}
                    {item.addOns?.length ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        <Icon name="SparklesIcon" className="inline h-3 w-3 mr-1" />
                        Add-ons: {item.addOns.length}
                      </p>
                    ) : null}
                    {/* Phase 2: Display upload info if present */}
                    {(item.optionPayload?.uploadAssetId || item.selectedOptions?.uploadAssetId) && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        <Icon name="FileImage" size={14} className="text-primary flex-shrink-0" />
                        <span className="text-primary font-medium truncate">
                          {item.optionPayload?.uploadFileName || item.selectedOptions?.uploadFileName || (language === 'en' ? 'File uploaded' : 'Upload хийсэн')}
                        </span>
                        {item.optionPayload?.gangSheetLength && (
                          <Badge variant="secondary" className="text-xs py-0 px-1.5 h-4">
                            {item.optionPayload.gangSheetLength}cm
                          </Badge>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-primary font-semibold mt-1">
                      â‚®{Number(item.variantPrice || 0).toLocaleString()} Ã— {item.quantity}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-lg">
                      â‚®{(Number(item.variantPrice || 0) * item.quantity).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Price Breakdown */}
            <div className="space-y-3 pt-4 border-t-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {language === 'en' ? 'Subtotal' : 'Ð”ÑÐ´ Ð´Ò¯Ð½'}
                </span>
                <span className="font-semibold">
                  â‚®{Number(cartTotal || 0).toLocaleString()}
                </span>
              </div>
              {addOnFeeTotal > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {language === 'en' ? 'Add-ons' : 'ÐÑÐ¼ÑÐ»Ñ‚ ÑÐ¾Ð½Ð³Ð¾Ð»Ñ‚ÑƒÑƒÐ´'}
                  </span>
                  <span className="font-semibold">
                    â‚®{Number(addOnFeeTotal || 0).toLocaleString()}
                  </span>
                </div>
              ) : null}
              {rushFeeTotal > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {language === 'en' ? 'Rush fee' : 'Ð¯Ð°Ñ€Ð°Ð»Ñ‚Ð°Ð¹ Ò¯Ð¹Ð»Ñ‡Ð¸Ð»Ð³ÑÑ'}
                  </span>
                  <span className="font-semibold">
                    â‚®{Number(rushFeeTotal || 0).toLocaleString()}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {language === 'en' ? 'Shipping' : 'Ð¥Ò¯Ñ€Ð³ÑÐ»Ñ‚'}
                </span>
                <span className="font-semibold text-green-600">
                  {language === 'en' ? 'FREE' : 'Ò®Ð½ÑÐ³Ò¯Ð¹'}
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">
                    {language === 'en' ? 'Total' : 'ÐÐ¸Ð¹Ñ‚ Ð´Ò¯Ð½'}
                  </span>
                  <span className="text-2xl md:text-3xl font-bold text-primary">
                    â‚®{Number(cartTotal || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Security Info */}
          <Card className="p-4 md:p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <Icon name="Shield" className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold mb-1 text-green-900 dark:text-green-100 text-sm">
                  {language === 'en' ? 'Secure Checkout' : 'ÐÐ°Ð¹Ð´Ð²Ð°Ñ€Ñ‚Ð°Ð¹ Ñ‚Ó©Ð»Ð±Ó©Ñ€'}
                </h4>
                <p className="text-xs text-green-800 dark:text-green-200">
                  {language === 'en'
                    ? 'Your payment information is encrypted and secure. We never store your card details.'
                    : 'Ð¢Ð°Ð½Ñ‹ Ñ‚Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ð¼ÑÐ´ÑÑÐ»ÑÐ» ÑˆÐ¸Ñ„Ñ€Ð»ÑÐ³Ð´ÑÑÐ½, Ð½Ð°Ð¹Ð´Ð²Ð°Ñ€Ñ‚Ð°Ð¹ Ñ…Ð°Ð´Ð³Ð°Ð»Ð°Ð³Ð´Ð°Ð½Ð°. ÐšÐ°Ñ€Ñ‚Ñ‹Ð½ Ð¼ÑÐ´ÑÑÐ»Ð»Ð¸Ð¹Ð³ Ð±Ð¸Ð´ Ñ…ÑÐ·ÑÑ Ñ‡ Ñ…Ð°Ð´Ð³Ð°Ð»Ð´Ð°Ð³Ð³Ò¯Ð¹.'}
                </p>
              </div>
            </div>
          </Card>

          {/* Support Card */}
          <Card className="p-4 md:p-6 bg-muted/50">
            <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <Icon name="HelpCircle" className="h-4 w-4 text-primary" />
              {language === 'en' ? 'Need Help?' : 'Ð¢ÑƒÑÐ»Ð°Ð¼Ð¶ Ñ…ÑÑ€ÑÐ³Ñ‚ÑÐ¹ ÑŽÑƒ?'}
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              {language === 'en'
                ? 'Contact our support team if you have any questions.'
                : 'ÐÑÑƒÑƒÐ»Ñ‚ Ð±Ð°Ð¹Ð²Ð°Ð» Ð¼Ð°Ð½Ð°Ð¹ Ð´ÑÐ¼Ð¶Ð»ÑÐ³Ð¸Ð¹Ð½ Ð±Ð°Ð³Ñ‚Ð°Ð¹ Ñ…Ð¾Ð»Ð±Ð¾Ð³Ð´Ð¾Ð½Ð¾ ÑƒÑƒ.'}
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Icon name="Mail" className="h-3 w-3 text-primary" />
                <span className="text-primary font-medium">support@koreangoods.mn</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="Phone" className="h-3 w-3 text-primary" />
                <span className="text-primary font-medium">+976 7799-9999</span>
              </div>
            </div>
          </Card>

          {/* What's Next Section */}
          <Card className="p-4 md:p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <h4 className="font-bold mb-4 text-sm flex items-center gap-2">
              <Icon name="Info" className="h-4 w-4 text-primary" />
              {language === 'en' ? "What's Next?" : 'Ð”Ð°Ñ€Ð°Ð°Ð³Ð¸Ð¹Ð½ Ð°Ð»Ñ…Ð°Ð¼'}
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-xs">1</span>
                </div>
                <div>
                  <p className="font-semibold mb-1">
                    {language === 'en' ? 'Complete shipping information' : 'Ð¥Ò¯Ñ€Ð³ÑÐ»Ñ‚Ð¸Ð¹Ð½ Ð¼ÑÐ´ÑÑÐ»ÑÐ» Ð±Ó©Ð³Ð»Ó©Ñ…'}
                  </p>
                  <p className="text-muted-foreground">
                    {language === 'en'
                      ? 'Fill out the form with your delivery details'
                      : 'Ð¥Ò¯Ñ€Ð³ÑÐ»Ñ‚Ð¸Ð¹Ð½ Ñ…Ð°ÑÐ³Ð°Ð° Ð¾Ñ€ÑƒÑƒÐ»Ð½Ð° ÑƒÑƒ'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-xs">2</span>
                </div>
                <div>
                  <p className="font-semibold mb-1">
                    {language === 'en' ? 'Scan QR code to pay' : 'QR ÐºÐ¾Ð´ ÑƒÐ½ÑˆÑƒÑƒÐ»Ð¶ Ñ‚Ó©Ð»Ó©Ñ…'}
                  </p>
                  <p className="text-muted-foreground">
                    {language === 'en'
                      ? 'Use your banking app to complete payment'
                      : 'Ð‘Ð°Ð½ÐºÐ½Ñ‹ Ð°Ð¿Ð¿-Ð°Ð°Ñ€Ð°Ð° Ñ‚Ó©Ð»Ð±Ó©Ñ€Ó©Ó© Ñ‚Ó©Ð»Ð½Ó©'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-xs">3</span>
                </div>
                <div>
                  <p className="font-semibold mb-1">
                    {language === 'en' ? 'Receive confirmation' : 'Ð‘Ð°Ñ‚Ð°Ð»Ð³Ð°Ð°Ð¶ÑƒÑƒÐ»Ð°Ð»Ñ‚ Ñ…Ò¯Ð»ÑÑÐ½ Ð°Ð²Ð°Ñ…'}
                  </p>
                  <p className="text-muted-foreground">
                    {language === 'en'
                      ? 'Get instant confirmation once payment is complete'
                      : 'Ð¢Ó©Ð»Ð±Ó©Ñ€ Ð°Ð¼Ð¶Ð¸Ð»Ñ‚Ñ‚Ð°Ð¹ Ð±Ð¾Ð»ÑÐ½Ñ‹ Ð´Ð°Ñ€Ð°Ð° Ð±Ð°Ñ‚Ð°Ð»Ð³Ð°Ð° Ð°Ð²Ð½Ð°'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      </div>
    </div>
  )
}

// Wrap CheckoutPage with ErrorBoundary to handle errors gracefully
export default function CheckoutPageWithErrorBoundary() {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 pt-20 md:pt-24 pb-8 md:pb-12">
          <div className="container max-w-2xl px-4 mx-auto">
            <div className="bg-red-50 dark:bg-red-950 border-2 border-red-200 dark:border-red-800 rounded-lg p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">
                    Checkout Ð°Ð»Ð´Ð°Ð°
                  </h2>
                  <p className="text-red-700 dark:text-red-300 mb-4">
                    Ð¢Ó©Ð»Ð±Ó©Ñ€Ð¸Ð¹Ð½ Ñ…ÑƒÑƒÐ´Ð°Ñ Ð°Ñ‡Ð°Ð°Ð»Ð°Ñ…Ð°Ð´ Ð°Ð»Ð´Ð°Ð° Ð³Ð°Ñ€Ð»Ð°Ð°. Ð¢Ð°Ð½Ñ‹ ÑÐ°Ð³ÑÐ°Ð½ Ð´Ð°Ñ…ÑŒ Ð±Ð°Ñ€Ð°Ð°Ð½ÑƒÑƒÐ´ Ñ…Ð°Ð´Ð³Ð°Ð»Ð°Ð³Ð´ÑÐ°Ð½ Ð±Ð°Ð¹Ð³Ð°Ð°.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      Ð”Ð°Ñ…Ð¸Ð½ Ð¾Ñ€Ð¾Ð»Ð´Ð¾Ñ…
                    </button>
                    <button
                      onClick={() => window.location.href = '/cart'}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold transition-colors"
                    >
                      Ð¡Ð°Ð³Ñ Ñ€ÑƒÑƒ Ð±ÑƒÑ†Ð°Ñ…
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <CheckoutPage />
    </ErrorBoundary>
  )
}

