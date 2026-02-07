import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

export default function LoginPage() {
  const { login } = useAuth();
  const { language } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: loginError } = await login(email, password);

    if (loginError) {
      console.error('Login error:', loginError);
      setError(loginError.message || (language === 'mn' ? 'Нэвтрэх үед алдаа гарлаа' : 'Login failed'));
      setLoading(false);
      return;
    }

    toast.success(language === 'mn' ? 'Амжилттай нэвтэрлээ!' : 'Login successful!');

    // Redirect to checkout if there was a pending checkout, otherwise home
    const returnTo = new URLSearchParams(window.location.search).get('returnTo');
    navigate(returnTo || '/');
  };

  return (
    <div className="container mx-auto px-4 py-32 min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon name="UserIcon" size={32} className="text-primary" />
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
                disabled={loading}
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
                disabled={loading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {language === 'mn' ? 'Нэвтэрч байна...' : 'Logging in...'}
                </>
              ) : (
                <>
                  <Icon name="ArrowRightIcon" size={18} className="mr-2" />
                  {language === 'mn' ? 'Нэвтрэх' : 'Login'}
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
