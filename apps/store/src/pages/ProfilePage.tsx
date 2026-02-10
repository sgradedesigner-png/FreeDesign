import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import Icon from '@/components/ui/AppIcon'
import { logger } from '@/lib/logger'

export default function ProfilePage() {
  const { user } = useAuth()
  const { language } = useTheme()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
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
      if (!session?.access_token) return

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/profile`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch profile')
      }

      const { profile } = await response.json()

      // Parse address if it's stored as JSON (backward compatibility)
      let addressValue = ''
      if (profile.address) {
        try {
          const parsed = JSON.parse(profile.address)
          addressValue = parsed.street || parsed.address || profile.address
        } catch {
          // If not JSON, use as plain string
          addressValue = profile.address
        }
      }

      setFormData({
        name: profile.name || '',
        email: profile.email || user?.email || '',
        phone: profile.phone || '',
        address: addressValue
      })
    } catch (error) {
      logger.error('Failed to fetch profile:', error)
    } finally {
      setFetching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(language === 'mn' ? 'Нэвтэрч орно уу' : 'Please login')
        return
      }

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
            address: formData.address
          })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      toast.success(
        language === 'mn' ? 'Профайл амжилттай шинэчлэгдлээ' : 'Profile updated successfully'
      )
    } catch (error: any) {
      logger.error('Profile update error:', error)
      toast.error(
        language === 'mn'
          ? `Алдаа гарлаа: ${error.message}`
          : `Error: ${error.message}`
      )
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
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

  return (
    <div className="container mx-auto px-4 py-32 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          {language === 'mn' ? 'Миний профайл' : 'My Profile'}
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="UserIcon" size={20} />
              {language === 'mn' ? 'Хувийн мэдээлэл' : 'Personal Information'}
            </CardTitle>
            <CardDescription>
              {language === 'mn'
                ? 'Та өөрийн мэдээллээ шинэчлэх боломжтой'
                : 'Update your personal information'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  {language === 'mn' ? 'Имэйл' : 'Email'}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'mn'
                    ? 'Имэйл хаягийг өөрчлөх боломжгүй'
                    : 'Email address cannot be changed'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  {language === 'mn' ? 'Овог нэр' : 'Full Name'}
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={language === 'mn' ? 'Овог нэрээ оруулна уу' : 'Enter your full name'}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  {language === 'mn' ? 'Утасны дугаар' : 'Phone Number'}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={language === 'mn' ? 'Утасны дугаараа оруулна уу' : 'Enter your phone number'}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">
                  {language === 'mn' ? 'Хаяг' : 'Address'}
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={language === 'mn' ? 'Хаягаа оруулна уу' : 'Enter your address'}
                  disabled={loading}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {language === 'mn' ? 'Хадгалж байна...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Icon name="CheckCircleIcon" size={18} className="mr-2" />
                    {language === 'mn' ? 'Хадгалах' : 'Save Changes'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
