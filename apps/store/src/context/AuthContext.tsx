import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { setSentryUser } from '@/lib/sentry'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  login: (
    email: string,
    password: string,
    captchaToken?: string
  ) => Promise<{ error: AuthError | null }>
  signup: (
    email: string,
    password: string,
    captchaToken?: string
  ) => Promise<{ error: AuthError | null }>
  logout: () => Promise<void>
  resetPassword: (email: string, captchaToken?: string) => Promise<{ error: AuthError | null }>
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      // Set Sentry user context
      if (session?.user) {
        setSentryUser({
          id: session.user.id,
          email: session.user.email,
        })
      }
    })

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // Update Sentry user context on auth state change
        if (session?.user) {
          setSentryUser({
            id: session.user.id,
            email: session.user.email,
          })
        } else {
          setSentryUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken,
      },
    })
    return { error }
  }

  const signup = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken,
      },
    })
    return { error }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string, captchaToken?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
      captchaToken,
    })
    return { error }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    return { error }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        login,
        signup,
        logout,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
