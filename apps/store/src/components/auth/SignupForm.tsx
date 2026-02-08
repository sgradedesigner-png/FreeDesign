import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import TurnstileCaptcha from '@/components/auth/TurnstileCaptcha'
import { AuthError } from '@supabase/supabase-js'

interface SignupFormProps {
  onSuccess?: () => void
}

export default function SignupForm({ onSuccess }: SignupFormProps) {
  const { signup } = useAuth()
  const { language } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const getErrorMessage = (error: AuthError) => {
    const message = error.message.toLowerCase()

    if (message.includes('already registered') || message.includes('already exists')) {
      return language === 'mn'
        ? 'Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна'
        : 'This email is already registered'
    }

    if (message.includes('password') && message.includes('weak')) {
      return language === 'mn'
        ? 'Нууц үг хэтэрхий сул байна. 8-с дээш тэмдэгт, том үсэг, тоо орсон байх ёстой.'
        : 'Password is too weak. Must be 8+ characters with uppercase and numbers.'
    }

    if (message.includes('invalid email')) {
      return language === 'mn'
        ? 'Зөв имэйл хаяг оруулна уу'
        : 'Please enter a valid email address'
    }

    return language === 'mn'
      ? 'Алдаа гарлаа. Дахин оролдоно уу.'
      : 'An error occurred. Please try again.'
  }

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

    // Email validation
    if (!email || !email.includes('@')) {
      setError(language === 'mn' ? 'Зөв имэйл хаяг оруулна уу' : 'Please enter a valid email')
      return
    }

    // Password validation
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    // Password match validation
    if (password !== confirmPassword) {
      setError(language === 'mn' ? 'Нууц үг таарахгүй байна' : 'Passwords do not match')
      return
    }

    if (!captchaToken) {
      setError(
        language === 'mn'
          ? 'Captcha баталгаажуулалт хийж үргэлжлүүлнэ үү.'
          : 'Please complete CAPTCHA verification.'
      )
      return
    }
    setLoading(true)

    const { error: signupError } = await signup(email, password, captchaToken)

    if (signupError) {
      setCaptchaRefreshKey((prev) => prev + 1)
      setError(getErrorMessage(signupError))
      setLoading(false)
    } else {
      // Success - show confirmation message
      setSuccess(true)
      setLoading(false)

      // Auto close after 5 seconds
      setTimeout(() => {
        onSuccess?.()
      }, 5000)
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <AlertDescription className="text-green-800 dark:text-green-200">
            {language === 'mn' ? (
              <>
                <p className="font-semibold mb-1">Бүртгэл амжилттай үүслээ!</p>
                <p className="text-sm">Имэйл хаягаа шалгаад бүртгэлээ баталгаажуулна уу.</p>
              </>
            ) : (
              <>
                <p className="font-semibold mb-1">Account created successfully!</p>
                <p className="text-sm">Please check your email to confirm your account.</p>
              </>
            )}
          </AlertDescription>
        </Alert>
        <p className="text-sm text-center text-muted-foreground">
          {language === 'mn'
            ? 'Энэ цонх 5 секундын дараа хаагдана...'
            : 'This window will close in 5 seconds...'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="signup-email">
          {language === 'mn' ? 'Имэйл хаяг' : 'Email Address'}
        </Label>
        <Input
          id="signup-email"
          type="email"
          placeholder={language === 'mn' ? 'example@mail.com' : 'example@mail.com'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">
          {language === 'mn' ? 'Нууц үг' : 'Password'}
        </Label>
        <Input
          id="signup-password"
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
        <Label htmlFor="signup-confirm-password">
          {language === 'mn' ? 'Нууц үг давтах' : 'Confirm Password'}
        </Label>
        <Input
          id="signup-confirm-password"
          type="password"
          placeholder={language === 'mn' ? 'Нууц үгээ давтан оруулна уу' : 'Re-enter your password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          required
          autoComplete="new-password"
        />
      </div>

      <TurnstileCaptcha
        token={captchaToken}
        onTokenChange={setCaptchaToken}
        refreshKey={captchaRefreshKey}
      />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? language === 'mn'
            ? 'Бүртгэж байна...'
            : 'Creating account...'
          : language === 'mn'
          ? 'Бүртгүүлэх'
          : 'Sign Up'}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        {language === 'mn'
          ? 'Бүртгүүлснээр та манай үйлчилгээний нөхцөлийг зөвшөөрч байна'
          : 'By signing up, you agree to our terms of service'}
      </p>
    </form>
  )
}
