import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import TurnstileCaptcha from '@/components/auth/TurnstileCaptcha'
import { AuthError } from '@supabase/supabase-js'

interface LoginFormProps {
  onSuccess?: () => void
  onForgotPassword: () => void
}

export default function LoginForm({ onSuccess, onForgotPassword }: LoginFormProps) {
  const { login } = useAuth()
  const { language } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const getErrorMessage = (error: AuthError) => {
    const message = error.message.toLowerCase()

    if (message.includes('invalid') || message.includes('credentials')) {
      return language === 'mn'
        ? 'Имэйл эсвэл нууц үг буруу байна'
        : 'Invalid email or password'
    }

    if (message.includes('email not confirmed')) {
      return language === 'mn'
        ? 'Имэйл хаягаа баталгаажуулна уу'
        : 'Please confirm your email address'
    }

    if (message.includes('network') || message.includes('fetch')) {
      return language === 'mn'
        ? 'Холболт салсан байна. Дахин оролдоно уу.'
        : 'Connection failed. Please try again.'
    }

    return language === 'mn'
      ? 'Алдаа гарлаа. Дахин оролдоно уу.'
      : 'An error occurred. Please try again.'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side validation
    if (!email || !email.includes('@')) {
      setError(language === 'mn' ? 'Зөв имэйл хаяг оруулна уу' : 'Please enter a valid email')
      return
    }

    if (!password || password.length < 6) {
      setError(language === 'mn' ? 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой' : 'Password must be at least 6 characters')
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

    const { error: loginError } = await login(email, password, captchaToken)

    if (loginError) {
      setCaptchaRefreshKey((prev) => prev + 1)
      setError(getErrorMessage(loginError))
      setLoading(false)
    } else {
      // Success
      setLoading(false)
      onSuccess?.()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="login-email">
          {language === 'mn' ? 'Имэйл хаяг' : 'Email Address'}
        </Label>
        <Input
          id="login-email"
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
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">
            {language === 'mn' ? 'Нууц үг' : 'Password'}
          </Label>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs text-primary hover:underline"
            disabled={loading}
          >
            {language === 'mn' ? 'Нууц үг мартсан?' : 'Forgot password?'}
          </button>
        </div>
        <Input
          id="login-password"
          type="password"
          placeholder={language === 'mn' ? '••••••••' : '••••••••'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
          autoComplete="current-password"
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
            ? 'Нэвтэрч байна...'
            : 'Logging in...'
          : language === 'mn'
          ? 'Нэвтрэх'
          : 'Login'}
      </Button>
    </form>
  )
}
