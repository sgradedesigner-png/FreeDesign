import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const nav = useNavigate();
  const { login, ok } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ok) nav('/', { replace: true });
  }, [ok, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // ✅ Navigation handled by useEffect automatically - removed duplicate nav()
    } catch {
      setErr('Email эсвэл password буруу байна');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ padding: 40, border: '1px solid #ddd', borderRadius: 8, minWidth: 320 }}>
        <h1>Admin Login</h1>
        <form onSubmit={onSubmit}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={{ width: '100%', marginBottom: 8 }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            style={{ width: '100%', marginBottom: 8 }}
          />
          <button type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
        {err && <p style={{ color: 'red', marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  );
}
