import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/AppIcon';

type CallbackStatus = 'loading' | 'error';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { language } = useTheme();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;
    let redirected = false;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const goHome = () => {
      if (!isActive || redirected) return;
      redirected = true;
      navigate('/', { replace: true });
    };

    const goLoginWithError = (message?: string) => {
      if (!isActive || redirected) return;
      redirected = true;
      setStatus('error');
      setErrorMessage(
        message ||
          (language === 'mn'
            ? 'Google authentication failed. Redirecting to login...'
            : 'Google authentication failed. Redirecting to login...')
      );

      window.setTimeout(() => {
        if (!isActive) return;
        navigate('/login?oauth_error=callback_failed', { replace: true });
      }, 1200);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        if (redirectTimer) {
          clearTimeout(redirectTimer);
        }
        goHome();
      }
    });

    const finalizeSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isActive || redirected) return;

      if (error) {
        if (redirectTimer) {
          clearTimeout(redirectTimer);
        }
        goLoginWithError(
          language === 'mn'
            ? 'Unable to complete Google sign in.'
            : 'Unable to complete Google sign in.'
        );
        return;
      }

      if (data.session) {
        if (redirectTimer) {
          clearTimeout(redirectTimer);
        }
        goHome();
      }
    };

    // Give Supabase auth exchange a short window before failing back to /login
    redirectTimer = setTimeout(() => {
      goLoginWithError(
        language === 'mn'
          ? 'Google sign in timed out.'
          : 'Google sign in timed out.'
      );
    }, 3500);

    void finalizeSession();

    return () => {
      isActive = false;
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
      subscription.unsubscribe();
    };
  }, [navigate, language]);

  return (
    <div className="container mx-auto px-4 py-32 min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              {status === 'loading' ? (
                <Icon name="ArrowPathIcon" size={28} className="text-primary animate-spin" />
              ) : (
                <Icon name="XMarkIcon" size={28} className="text-destructive" />
              )}
            </div>
          </div>
          <CardTitle>
            {status === 'loading'
              ? (language === 'mn' ? 'Completing sign in...' : 'Completing sign in...')
              : (language === 'mn' ? 'Sign in failed' : 'Sign in failed')}
          </CardTitle>
          <CardDescription>
            {status === 'loading'
              ? (language === 'mn'
                  ? 'Please wait while we finish your Google authentication.'
                  : 'Please wait while we finish your Google authentication.')
              : errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          {status === 'loading'
            ? (language === 'mn' ? 'You will be redirected automatically.' : 'You will be redirected automatically.')
            : (language === 'mn' ? 'Redirecting to login...' : 'Redirecting to login...')}
        </CardContent>
      </Card>
    </div>
  );
}

