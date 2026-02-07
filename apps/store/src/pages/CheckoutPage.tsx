import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useTheme } from '@/context/ThemeContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Icon from '@/components/ui/AppIcon'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function CheckoutPage() {
  const { user } = useAuth()
  const { cart, cartTotal, clearCart } = useCart()
  const { language } = useTheme()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)

  // Try to restore shipping info from sessionStorage (preserves guest input)
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

  // Save shipping info to sessionStorage whenever it changes (preserve guest input)
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
            // If not JSON, use as-is
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
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoadingProfile(false)
    }
  }

  const useSavedAddress = () => {
    if (savedAddress) {
      setShippingInfo(savedAddress)
      toast.success(language === 'mn' ? 'Хадгалагдсан хаяг ашиглагдлаа' : 'Saved address loaded')
    }
  }

  // If cart is empty, redirect to cart page
  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 min-h-screen">
        <Card className="max-w-md mx-auto text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Icon name="ShoppingBagIcon" size={48} className="text-muted-foreground" />
            </div>
            <CardTitle>{language === 'mn' ? 'Таны сагс хоосон байна' : 'Your cart is empty'}</CardTitle>
            <CardDescription>
              {language === 'mn'
                ? 'Захиалга хийхийн тулд бүтээгдэхүүн нэмнэ үү'
                : 'Add some products to place an order'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/products')} className="w-full">
              <Icon name="ShoppingBagIcon" size={18} className="mr-2" />
              {language === 'mn' ? 'Бүтээгдэхүүн үзэх' : 'Browse Products'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Validate shipping info
    if (!shippingInfo.fullName || !shippingInfo.phone || !shippingInfo.address) {
      toast.error(language === 'mn' ? 'Бүх талбарыг бөглөнө үү' : 'Please fill all fields')
      setLoading(false)
      return
    }

    try {
      // Get access token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(language === 'mn' ? 'Нэвтэрч орно уу' : 'Please login')
        navigate('/login?returnTo=/checkout')
        setLoading(false)
        return
      }

      // Prepare order items
      const items = cart.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        variantPrice: item.variantPrice,
        quantity: item.quantity,
        imagePath: item.imagePath
      }))

      // Call backend API to create order
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          items,
          shippingAddress: shippingInfo,
          total: cartTotal
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create order')
      }

      const { order } = await response.json()

      // Clear cart
      clearCart()

      // Clear saved shipping info from sessionStorage
      sessionStorage.removeItem('checkout-shipping-info')

      // Show success message
      toast.success(
        language === 'mn' ? 'Захиалга амжилттай үүслээ!' : 'Order created successfully!'
      )

      // Redirect to order detail page
      navigate(`/orders/${order.id}`)
    } catch (error: any) {
      console.error('Order creation error:', error)
      toast.error(
        language === 'mn'
          ? `Алдаа гарлаа: ${error.message}`
          : `Error: ${error.message}`
      )
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-32 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          {language === 'mn' ? 'Захиалга баталгаажуулах' : 'Checkout'}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Shipping Information Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{language === 'mn' ? 'Хүргэлтийн мэдээлэл' : 'Shipping Information'}</CardTitle>
                <CardDescription>
                  {language === 'mn'
                    ? 'Хүргэлтийн хаягаа оруулна уу'
                    : 'Enter your shipping details below'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Alert>
                    <AlertDescription className="flex items-center justify-between">
                      <div>
                        <strong>{language === 'mn' ? 'Нэвтэрсэн:' : 'Logged in as:'}</strong> {user?.email}
                      </div>
                      {savedAddress && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={useSavedAddress}
                          disabled={loadingProfile}
                        >
                          <Icon name="MapPinIcon" size={14} className="mr-1" />
                          {language === 'mn' ? 'Хадгалсан хаяг' : 'Use saved address'}
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">
                      {language === 'mn' ? 'Овог нэр' : 'Full Name'}
                    </Label>
                    <Input
                      id="fullName"
                      placeholder={language === 'mn' ? 'Овог нэр' : 'Full Name'}
                      value={shippingInfo.fullName}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, fullName: e.target.value })}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">{language === 'mn' ? 'Утасны дугаар' : 'Phone Number'}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder={language === 'mn' ? '99887766' : '99887766'}
                      value={shippingInfo.phone}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">{language === 'mn' ? 'Хаяг' : 'Address'}</Label>
                    <Input
                      id="address"
                      placeholder={language === 'mn' ? 'Гудамж, байр, тоот' : 'Street, Building, Apartment'}
                      value={shippingInfo.address}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">{language === 'mn' ? 'Хот' : 'City'}</Label>
                      <Input
                        id="city"
                        placeholder={language === 'mn' ? 'Улаанбаатар' : 'Ulaanbaatar'}
                        value={shippingInfo.city}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">{language === 'mn' ? 'Зип код' : 'Zip Code'}</Label>
                      <Input
                        id="zipCode"
                        placeholder="14200"
                        value={shippingInfo.zipCode}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, zipCode: e.target.value })}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {language === 'mn' ? 'Захиалж байна...' : 'Placing order...'}
                      </>
                    ) : (
                      <>
                        <Icon name="CheckCircleIcon" size={18} className="mr-2" />
                        {language === 'mn' ? 'Захиалга баталгаажуулах' : 'Place Order'}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>{language === 'mn' ? 'Захиалгын дэлгэрэнгүй' : 'Order Summary'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.cartKey} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.productName} ({item.variantName}) × {item.quantity}
                      </span>
                      <span className="font-medium">₮{(item.variantPrice * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {language === 'mn' ? 'Дэд дүн' : 'Subtotal'}
                    </span>
                    <span>₮{cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {language === 'mn' ? 'Хүргэлт' : 'Shipping'}
                    </span>
                    <span>{language === 'mn' ? 'Үнэгүй' : 'Free'}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>{language === 'mn' ? 'Нийт' : 'Total'}</span>
                    <span className="text-primary">₮{cartTotal.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
