import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';

// ✅ Type safety: Proper types instead of 'any'
type AdminPingResponse = {
  ok: boolean;
  user: {
    sub: string;
    email?: string;
  };
};

type ErrorResponse = {
  message: string;
};

export default function DashboardPage() {
  const nav = useNavigate();
  const { logout, user } = useAuth();

  const [apiResult, setApiResult] = useState<AdminPingResponse | null>(null);
  const [apiError, setApiError] = useState<ErrorResponse | null>(null);

  const onLogout = async () => {
    await logout();
    nav('/login', { replace: true });
  };

  useEffect(() => {
    // ✅ AbortController to cleanup on unmount
    const controller = new AbortController();

    // ADMIN protected endpoint test
    api.get('/admin/ping', { signal: controller.signal })
      .then((res) => {
        setApiResult(res.data);
        setApiError(null);
        console.log('ADMIN OK:', res.data);
      })
      .catch((err) => {
        if (err.name === 'CanceledError') return; // Ignore abort errors
        const payload = err?.response?.data ?? { message: err?.message };
        setApiError(payload);
        setApiResult(null);
        console.error('ADMIN ERROR:', payload);
      });

    return () => controller.abort();
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Admin Dashboard</h1>
      <button onClick={onLogout}>Logout</button>

      <h3 style={{ marginTop: 24 }}>Supabase user (from AuthContext)</h3>
      <pre style={{ marginTop: 10 }}>{JSON.stringify(user, null, 2)}</pre>

      <h3 style={{ marginTop: 24 }}>Backend /admin/ping result</h3>
      {apiResult && (
        <pre style={{ marginTop: 10, background: '#f5f5f5', padding: 12 }}>
          {JSON.stringify(apiResult, null, 2)}
        </pre>
      )}

      {apiError && (
        <pre style={{ marginTop: 10, background: '#ffecec', padding: 12, color: '#b00020' }}>
          {JSON.stringify(apiError, null, 2)}
        </pre>
      )}
    </div>
  );
}
