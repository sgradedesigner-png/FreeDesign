import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Icon from '@/components/ui/AppIcon'

export default function AuthResetPassword() {
  const { updatePassword } = useAuth()
  const { language } = useTheme()
  const navigate = useNavigate()

  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Check if there's a valid recovery session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setHasSession(true)
      } else {
        setHasSession(false)
      }
    }

    checkSession()
  }, [])

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return language === 'mn'
        ? 'Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой'
        : 'Password must be at least 8 characters'
    }

    if (!/[A-Z]/.test(pwd)) {
      return language === 'mn'
        ? 'Нууц үг том үсэг агуулсан байх ёстой'
        : 'Password must contain an uppercase letter'
    }

    if (!/[0-9]/.test(pwd)) {
      return language === 'mn'
        ? 'Нууц үг тоо агуулсан байх ёстой'
        : 'Password must contain a number'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate password
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    // Check password match
    if (password !== confirmPassword) {
      setError(language === 'mn' ? 'Нууц үг таарахгүй байна' : 'Passwords do not match')
      return
    }

    setLoading(true)

    const { error: updateError } = await updatePassword(password)

    if (updateError) {
      setError(
        language === 'mn'
          ? 'Нууц үг солих явцад алдаа гарлаа. Дахин оролдоно уу.'
          : 'Failed to update password. Please try again.'
      )
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  // Loading state while checking session
  if (hasSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">
                {language === 'mn' ? 'Уншиж байна...' : 'Loading...'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No session - invalid or expired link
  if (hasSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
                <Icon name="XCircleIcon" size={32} className="text-red-600 dark:text-red-400" />
              </div>
            </div>
            <CardTitle className="text-center">
              {language === 'mn' ? 'Хүчингүй холбоос' : 'Invalid Link'}
            </CardTitle>
            <CardDescription className="text-center">
              {language === 'mn'
                ? 'Нууц үг сэргээх холбоос хүчингүй эсвэл хугацаа дууссан байна.'
                : 'The password reset link is invalid or has expired.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  {language === 'mn'
                    ? 'Та дахин нууц үг сэргээх хүсэлт илгээх хэрэгтэй.'
                    : 'You need to request a new password reset link.'}
                </AlertDescription>
              </Alert>
              <Button onClick={() => navigate('/')} className="w-full">
                <Icon name="HomeIcon" size={18} className="mr-2" />
                {language === 'mn' ? 'Нүүр хуудас руу буцах' : 'Go to Homepage'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                <Icon name="CheckCircleIcon" size={32} className="text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle className="text-center">
              {language === 'mn' ? 'Амжилттай!' : 'Success!'}
            </CardTitle>
            <CardDescription className="text-center">
              {language === 'mn'
                ? 'Таны нууц үг амжилттай солигдлоо.'
                : 'Your password has been updated successfully.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {language === 'mn'
                    ? 'Та одоо шинэ нууц үгээрээ нэвтэрч болно.'
                    : 'You can now login with your new password.'}
                </AlertDescription>
              </Alert>
              <Button onClick={() => navigate('/')} className="w-full">
                <Icon name="HomeIcon" size={18} className="mr-2" />
                {language === 'mn' ? 'Нүүр хуудас руу буцаж нэвтрэх' : 'Go to Homepage & Login'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Password reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Icon name="LockClosedIcon" size={32} className="text-primary" />
            </div>
          </div>
          <CardTitle className="text-center">
            {language === 'mn' ? 'Шинэ нууц үг үүсгэх' : 'Create New Password'}
          </CardTitle>
          <CardDescription className="text-center">
            {language === 'mn'
              ? 'Шинэ нууц үгээ оруулна уу'
              : 'Enter your new password below'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">
                {language === 'mn' ? 'Шинэ нууц үг' : 'New Password'}
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder={language === 'mn' ? '8+ тэмдэгт, том үсэг, тоо' : '8+ chars, uppercase, number'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="new-password"
              />
              {password && (
                <div className="flex gap-1 mt-1">
                  <div
                    className={`h-1 flex-1 rounded ${
                      password.length >= 8 ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                  <div
                    className={`h-1 flex-1 rounded ${
                      /[A-Z]/.test(password) ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                  <div
                    className={`h-1 flex-1 rounded ${
                      /[0-9]/.test(password) ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">
                {language === 'mn' ? 'Нууц үг давтах' : 'Confirm New Password'}
              </Label>
              <Input
                id="confirm-new-password"
                type="password"
                placeholder={language === 'mn' ? 'Нууц үгээ давтан оруулна уу' : 'Re-enter your password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {language === 'mn' ? 'Шинэчилж байна...' : 'Updating...'}
                </>
              ) : (
                <>
                  <Icon name="CheckIcon" size={18} className="mr-2" />
                  {language === 'mn' ? 'Нууц үг солих' : 'Reset Password'}
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/')}
              className="w-full"
              disabled={loading}
            >
              {language === 'mn' ? 'Болих' : 'Cancel'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
