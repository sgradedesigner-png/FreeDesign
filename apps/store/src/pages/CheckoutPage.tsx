import { useState } from 'react'
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

export default function CheckoutPage() {
  const { user } = useAuth()
  const { cart, cartTotal, clearCart } = useCart()
  const { language } = useTheme()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    zipCode: '',
  })

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

    // TODO: Call backend API to create order
    // For now, just simulate order creation
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Clear cart
      clearCart()

      // Show success message
      toast.success(
        language === 'mn' ? 'Захиалга амжилттай илгээгдлээ!' : 'Order placed successfully!'
      )

      // Redirect to home or order confirmation page
      navigate('/')
    } catch (error) {
      toast.error(language === 'mn' ? 'Алдаа гарлаа. Дахин оролдоно уу.' : 'An error occurred. Please try again.')
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
                    <AlertDescription>
                      <strong>{language === 'mn' ? 'Нэвтэрсэн:' : 'Logged in as:'}</strong> {user?.email}
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
