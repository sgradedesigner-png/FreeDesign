import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ForgotPasswordDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function ForgotPasswordDialog({ isOpen, onClose }: ForgotPasswordDialogProps) {
  const { resetPassword } = useAuth()
  const { language } = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!email || !email.includes('@')) {
      setError(language === 'mn' ? 'Зөв имэйл хаяг оруулна уу' : 'Please enter a valid email')
      setLoading(false)
      return
    }

    const { error: resetError } = await resetPassword(email)

    if (resetError) {
      setError(language === 'mn' ? 'Алдаа гарлаа. Дахин оролдоно уу.' : 'An error occurred. Please try again.')
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      // Close dialog after 3 seconds
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setEmail('')
      }, 3000)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
      setEmail('')
      setError(null)
      setSuccess(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'mn' ? 'Нууц үг сэргээх' : 'Reset Password'}
          </DialogTitle>
          <DialogDescription>
            {language === 'mn'
              ? 'Бүртгэлтэй имэйл хаягаа оруулна уу. Бид танд нууц үг сэргээх холбоос илгээх болно.'
              : 'Enter your registered email address. We will send you a password reset link.'}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <AlertDescription className="text-green-800 dark:text-green-200">
              {language === 'mn'
                ? 'Нууц үг сэргээх холбоос илгээлээ. Имэйлээ шалгана уу.'
                : 'Password reset link sent! Please check your email.'}
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="reset-email">
                {language === 'mn' ? 'Имэйл хаяг' : 'Email Address'}
              </Label>
              <Input
                id="reset-email"
                type="email"
                placeholder={language === 'mn' ? 'example@mail.com' : 'example@mail.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="flex-1"
              >
                {language === 'mn' ? 'Болих' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading
                  ? language === 'mn'
                    ? 'Илгээж байна...'
                    : 'Sending...'
                  : language === 'mn'
                  ? 'Илгээх'
                  : 'Send Reset Link'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
