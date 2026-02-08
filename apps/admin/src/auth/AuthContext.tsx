import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

// ✅ Type safety: Proper user type instead of 'any'
type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
};

type AuthState = {
  loading: boolean;
  ok: boolean;
  user: SupabaseUser | null;
  accessToken: string | null;
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // ✅ useCallback to prevent unnecessary re-renders
  const refresh = useCallback(async () => {
    // ✅ app load дээр 1 удаа session шалгана
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('sb-access-token');
      setLoading(false);
      return;
    }

    setUser(session.user as SupabaseUser);
    setAccessToken(session.access_token);
    localStorage.setItem('sb-access-token', session.access_token);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string, captchaToken?: string) => {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken,
      },
    });

    if (error) {
      setLoading(false);
      throw error;
    }

    setUser(data.user as SupabaseUser);
    setAccessToken(data.session?.access_token ?? null);
    if (data.session?.access_token) {
      localStorage.setItem('sb-access-token', data.session.access_token);
    }
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('sb-access-token');
  }, []);

  useEffect(() => {
    refresh(); // ✅ app load дээр 1 удаа

    // session өөрчлөгдвөл state sync
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user as SupabaseUser ?? null);
      setAccessToken(session?.access_token ?? null);

      // ✅ Persist token to localStorage for API interceptor
      if (session?.access_token) {
        localStorage.setItem('sb-access-token', session.access_token);
      } else {
        localStorage.removeItem('sb-access-token');
      }

      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const ok = !!user;

  // ✅ Fixed dependencies - include all functions
  const value = useMemo(
    () => ({ loading, ok, user, accessToken, login, logout, refresh }),
    [loading, ok, user, accessToken, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
