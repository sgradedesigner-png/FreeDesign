// App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import ProductFormPage from './pages/ProductFormPage';
import ProductWizardPage from './pages/ProductWizardPage';
import CategoriesPage from './pages/CategoriesPage';
import CollectionsPage from './pages/CollectionsPage';
import OrdersPage from './pages/OrdersPage';
import SettingsPage from './pages/SettingsPage';
import EmailTestPage from './pages/EmailTestPage';
import ProductionDashboardPage from './pages/ProductionDashboardPage';
import PricingRulesPage from './pages/PricingRulesPage';
import UploadModerationPage from './pages/UploadModerationPage';
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
        {/* Wizard routes */}
        <Route path="/product-wizard" element={<ProductWizardPage />} />
        <Route path="/product-wizard/:id" element={<ProductWizardPage />} />
        <Route path="/products/new-legacy" element={<ProductFormPage />} />
        <Route path="/products/new" element={<ProductWizardPage />} />
        {/* Catch-all parameterized route */}
        <Route path="/products/:id" element={<ProductFormPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/production" element={<ProductionDashboardPage />} />
        <Route path="/pricing" element={<PricingRulesPage />} />
        <Route path="/moderation" element={<UploadModerationPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/email-test" element={<EmailTestPage />} />
        {/* More routes will be added here */}
      </Route>

      <Route path="*" element={<NotFoundRedirect />} />
    </Routes>
  );
}
