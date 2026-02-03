import { useState } from 'react'
import { useTheme } from '@/context/ThemeContext'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'
import ForgotPasswordDialog from './ForgotPasswordDialog'
import { toast } from 'sonner'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: 'login' | 'signup'
  onSuccess?: () => void
}

export default function AuthModal({
  isOpen,
  onClose,
  defaultTab = 'login',
  onSuccess
}: AuthModalProps) {
  const { language } = useTheme()
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const handleLoginSuccess = () => {
    toast.success(language === 'mn' ? 'Амжилттай нэвтэрлээ!' : 'Welcome back!')
    onClose()
    onSuccess?.()
  }

  const handleSignupSuccess = () => {
    onClose()
    onSuccess?.()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'mn' ? 'Тавтай морил' : 'Welcome'}
            </DialogTitle>
            <DialogDescription>
              {language === 'mn'
                ? 'Үргэлжлүүлэхийн тулд нэвтэрнэ үү эсвэл шинэ бүртгэл үүсгэнэ үү'
                : 'Login to your account or create a new one to continue'}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">
                {language === 'mn' ? 'Нэвтрэх' : 'Login'}
              </TabsTrigger>
              <TabsTrigger value="signup">
                {language === 'mn' ? 'Бүртгүүлэх' : 'Sign Up'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <LoginForm
                onSuccess={handleLoginSuccess}
                onForgotPassword={() => {
                  setShowForgotPassword(true)
                }}
              />
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <SignupForm onSuccess={handleSignupSuccess} />
            </TabsContent>
          </Tabs>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {language === 'mn' ? 'эсвэл' : 'or'}
              </span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {language === 'mn' ? (
              <>
                Манай <span className="text-primary font-medium">Korean Goods</span> дэлгүүрт
                тавтай морил
              </>
            ) : (
              <>
                Welcome to <span className="text-primary font-medium">Korean Goods</span> store
              </>
            )}
          </p>
        </DialogContent>
      </Dialog>

      <ForgotPasswordDialog
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  )
}
