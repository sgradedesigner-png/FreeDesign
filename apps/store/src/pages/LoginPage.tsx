import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TurnstileCaptcha from '@/components/auth/TurnstileCaptcha';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export default function LoginPage() {
  const { login } = useAuth();
  const { language } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthError = params.get('oauth_error');
    if (!oauthError) return;

    setError(
      language === 'mn'
        ? 'Google login failed or was canceled. Please try again.'
        : 'Google login failed or was canceled. Please try again.'
    );
  }, [location.search, language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!captchaToken) {
      setError(
        language === 'mn'
          ? 'Captcha баталгаажуулалт хийж үргэлжлүүлнэ үү.'
          : 'Please complete CAPTCHA verification.'
      );
      return;
    }
    setLoading(true);

    const { error: loginError } = await login(email, password, captchaToken);

    if (loginError) {
      logger.error('Login error:', loginError);
      setError(loginError.message || (language === 'mn' ? 'Нэвтрэх үед алдаа гарлаа' : 'Login failed'));
      setCaptchaRefreshKey((prev) => prev + 1);
      setLoading(false);
      return;
    }

    toast.success(language === 'mn' ? 'Амжилттай нэвтэрлээ!' : 'Login successful!');

    // Redirect to checkout if there was a pending checkout, otherwise home
    const returnTo = new URLSearchParams(window.location.search).get('returnTo');
    navigate(returnTo || '/');
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(
        language === 'mn'
          ? 'Google login failed. Please try again.'
          : 'Google login failed. Please try again.'
      );
      setGoogleLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-32 min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon name="UserCircleIcon" size={32} className="text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {language === 'mn' ? 'Нэвтрэх' : 'Login'}
          </CardTitle>
          <CardDescription>
            {language === 'mn'
              ? 'Өөрийн бүртгэлээр нэвтэрнэ үү'
              : 'Enter your credentials to access your account'}
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
                disabled={loading || googleLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{language === 'mn' ? 'Нууц үг' : 'Password'}</Label>
                <Link
                  to="/auth/reset"
                  className="text-sm text-primary hover:underline"
                >
                  {language === 'mn' ? 'Мартсан уу?' : 'Forgot?'}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || googleLoading}
                required
              />
            </div>

            <TurnstileCaptcha
              token={captchaToken}
              onTokenChange={setCaptchaToken}
              refreshKey={captchaRefreshKey}
            />

            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {language === 'mn' ? 'Нэвтэрч байна...' : 'Logging in...'}
                </>
              ) : (
                <>
                  <Icon name="ArrowRightOnRectangleIcon" size={18} className="mr-2" />
                  {language === 'mn' ? 'Нэвтрэх' : 'Login'}
                </>
              )}
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {language === 'mn' ? 'or' : 'or'}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  {language === 'mn' ? 'Redirecting to Google...' : 'Redirecting to Google...'}
                </>
              ) : (
                <>
                  <span className="mr-2 font-semibold">G</span>
                  {language === 'mn' ? 'Continue with Google' : 'Continue with Google'}
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              {language === 'mn' ? 'Бүртгэлгүй юу?' : "Don't have an account?"}{' '}
              <Link to="/signup" className="text-primary font-medium hover:underline">
                {language === 'mn' ? 'Бүртгүүлэх' : 'Sign up'}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
