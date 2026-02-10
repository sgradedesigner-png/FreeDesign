import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TurnstileCaptcha from '@/components/auth/TurnstileCaptcha';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export default function SignupPage() {
  const { signup } = useAuth();
  const { language } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError(language === 'mn' ? 'Нууц үг таарахгүй байна' : 'Passwords do not match');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError(language === 'mn' ? 'Нууц үг 6-аас дээш тэмдэгт байх ёстой' : 'Password must be at least 6 characters');
      return;
    }

    if (!captchaToken) {
      setError(
        language === 'mn'
          ? 'Captcha баталгаажуулалт хийж үргэлжлүүлнэ үү.'
          : 'Please complete CAPTCHA verification.'
      );
      return;
    }

    setLoading(true);

    const { error: signupError } = await signup(email, password, captchaToken);

    if (signupError) {
      logger.error('Signup error:', signupError);
      setError(signupError.message || (language === 'mn' ? 'Бүртгэл үүсгэхэд алдаа гарлаа' : 'Signup failed'));
      setCaptchaRefreshKey((prev) => prev + 1);
      setLoading(false);
      return;
    }

    toast.success(
      language === 'mn'
        ? 'Бүртгэл амжилттай! Имэйлээ шалгана уу.'
        : 'Signup successful! Please check your email.'
    );
    navigate('/login');
  };

  return (
    <div className="container mx-auto px-4 py-32 min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon name="UserPlusIcon" size={32} className="text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {language === 'mn' ? 'Бүртгүүлэх' : 'Sign Up'}
          </CardTitle>
          <CardDescription>
            {language === 'mn'
              ? 'Шинэ бүртгэл үүсгэх'
              : 'Create a new account to get started'}
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
              <Label htmlFor="email">{language === 'mn' ? 'Имэйл' : 'Email'}</Label>
              <Input
                id="email"
                type="email"
                placeholder={language === 'mn' ? 'name@example.com' : 'name@example.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{language === 'mn' ? 'Нууц үг' : 'Password'}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'mn' ? '6-аас дээш тэмдэгт' : 'At least 6 characters'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {language === 'mn' ? 'Нууц үг баталгаажуулах' : 'Confirm Password'}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <TurnstileCaptcha
              token={captchaToken}
              onTokenChange={setCaptchaToken}
              refreshKey={captchaRefreshKey}
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {language === 'mn' ? 'Бүртгүүлж байна...' : 'Signing up...'}
                </>
              ) : (
                <>
                  <Icon name="UserPlusIcon" size={18} className="mr-2" />
                  {language === 'mn' ? 'Бүртгүүлэх' : 'Sign Up'}
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              {language === 'mn' ? 'Бүртгэлтэй юу?' : 'Already have an account?'}{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                {language === 'mn' ? 'Нэвтрэх' : 'Login'}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
