import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Package, FolderTree, ShoppingCart, Settings, X, } from 'lucide-react';
const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/products', icon: Package, label: 'Products' },
    { path: '/categories', icon: FolderTree, label: 'Categories' },
    { path: '/orders', icon: ShoppingCart, label: 'Orders' },
    { path: '/settings', icon: Settings, label: 'Settings' },
];
export function Sidebar({ isMobileOpen = false, onMobileClose }) {
    const location = useLocation();
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "hidden w-64 shrink-0 border-r border-border bg-card lg:flex lg:flex-col", children: [_jsx("div", { className: "h-16 border-b border-border px-6 flex items-center", children: _jsx("h1", { className: "text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent", children: "Admin Panel" }) }), _jsx("nav", { className: "flex-1 p-4 space-y-2", children: menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (_jsxs(Link, { to: item.path, className: cn('flex items-center gap-3 px-3 py-2 rounded-lg transition-colors', isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'), children: [_jsx(Icon, { className: "w-5 h-5" }), _jsx("span", { className: "font-medium", children: item.label })] }, item.path));
                        }) }), _jsx("div", { className: "p-4 border-t border-border", children: _jsx("p", { className: "text-xs text-muted-foreground text-center", children: "E-commerce Admin v1.0" }) })] }), _jsxs("div", { className: cn('fixed inset-0 z-50 lg:hidden', isMobileOpen ? 'block' : 'hidden'), "aria-hidden": !isMobileOpen, children: [_jsx("button", { type: "button", className: "absolute inset-0 bg-black/40", onClick: onMobileClose, "aria-label": "Close menu overlay" }), _jsxs("div", { className: "relative flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl", children: [_jsxs("div", { className: "h-16 border-b border-border px-4 flex items-center justify-between", children: [_jsx("h1", { className: "text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent", children: "Admin Panel" }), _jsx("button", { type: "button", onClick: onMobileClose, className: "p-2 rounded-md hover:bg-accent", "aria-label": "Close menu", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsx("nav", { className: "flex-1 p-4 space-y-2", children: menuItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location.pathname === item.path;
                                    return (_jsxs(Link, { to: item.path, onClick: onMobileClose, className: cn('flex items-center gap-3 px-3 py-2 rounded-lg transition-colors', isActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'), children: [_jsx(Icon, { className: "w-5 h-5" }), _jsx("span", { className: "font-medium", children: item.label })] }, item.path));
                                }) }), _jsx("div", { className: "p-4 border-t border-border", children: _jsx("p", { className: "text-xs text-muted-foreground text-center", children: "E-commerce Admin v1.0" }) })] })] })] }));
}
