// App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import ProductFormPage from './pages/ProductFormPage';
import CategoriesPage from './pages/CategoriesPage';
import ProtectedRoute from './components/ProtectedRoute';
import { AdminLayout } from './components/layout/AdminLayout';
import { useAuth } from './auth/AuthContext';

// ✅ Conditional redirect for 404 based on auth status
function NotFoundRedirect() {
  const { ok } = useAuth();
  return <Navigate to={ok ? '/' : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes with AdminLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/new" element={<ProductFormPage />} />
        <Route path="/products/:id" element={<ProductFormPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        {/* More routes will be added here */}
      </Route>

      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
  );
}
