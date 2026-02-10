import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { logger } from '../lib/logger';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, ok, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!ok) {
      setChecking(false);
      return;
    }

    // Verify user is admin by calling a protected route
    const checkAdminRole = async () => {
      try {
        // Call any admin-only endpoint to verify role
        await api.get('/admin/stats');
        setIsAdmin(true);
      } catch (error: any) {
        logger.error('Admin role check failed:', error);
        // Show user-friendly error message
        toast.error('Access Denied', {
          description: 'You do not have permission to access the admin panel.',
          duration: 5000,
        });
        // User is not admin - sign them out
        await supabase.auth.signOut();
        localStorage.removeItem('sb-access-token');
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    };

    checkAdminRole();
  }, [ok]);

  if (loading || checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontSize: 16,
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  if (!ok) return <Navigate to="/login" replace />;

  // If user is authenticated but not admin, redirect to login with denied param
  if (isAdmin === false) {
    return <Navigate to="/login?denied=true" replace />;
  }

  return <>{children}</>;
}
