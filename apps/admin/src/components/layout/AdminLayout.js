import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
export function AdminLayout() {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    return (_jsxs("div", { className: "flex min-h-screen bg-background", children: [_jsx(Sidebar, { isMobileOpen: isMobileSidebarOpen, onMobileClose: () => setIsMobileSidebarOpen(false) }), _jsxs("div", { className: "flex min-h-screen w-full flex-1 flex-col overflow-hidden", children: [_jsx(TopBar, { onMenuClick: () => setIsMobileSidebarOpen(true) }), _jsx("main", { className: "flex-1 overflow-y-auto p-4 sm:p-6", children: _jsx(Outlet, {}) })] })] }));
}
