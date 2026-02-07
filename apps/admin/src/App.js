import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    return _jsx(Navigate, { to: ok ? '/' : '/login', replace: true });
}
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsxs(Route, { element: _jsx(ProtectedRoute, { children: _jsx(AdminLayout, {}) }), children: [_jsx(Route, { path: "/", element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "/products", element: _jsx(ProductsPage, {}) }), _jsx(Route, { path: "/products/new", element: _jsx(ProductFormPage, {}) }), _jsx(Route, { path: "/products/:id", element: _jsx(ProductFormPage, {}) }), _jsx(Route, { path: "/categories", element: _jsx(CategoriesPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(NotFoundRedirect, {}) })] }));
}
