import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, ok } = useAuth();

  if (loading) {
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

  return <>{children}</>;
}
