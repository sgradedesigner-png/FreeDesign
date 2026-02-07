import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LogOut, User, Moon, Sun, Menu } from 'lucide-react';
export function TopBar({ onMenuClick }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [theme, setTheme] = useState('light');
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const initialTheme = savedTheme || 'light';
        setTheme(initialTheme);
        document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    }, []);
    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };
    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };
    return (_jsxs("header", { className: "h-16 border-b border-border bg-card px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-4", children: [_jsx("div", { className: "flex items-center gap-2", children: _jsx(Button, { variant: "ghost", size: "icon", className: "lg:hidden", onClick: onMenuClick, "aria-label": "Open menu", children: _jsx(Menu, { className: "w-5 h-5" }) }) }), _jsxs("div", { className: "flex items-center gap-2 sm:gap-4", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: toggleTheme, children: theme === 'light' ? (_jsx(Moon, { className: "w-4 h-4" })) : (_jsx(Sun, { className: "w-4 h-4" })) }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "sm", className: "gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center", children: _jsx(User, { className: "w-4 h-4 text-primary" }) }), _jsx("span", { className: "hidden sm:inline text-sm font-medium", children: user?.email?.split('@')[0] || 'Admin' })] }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-56", children: [_jsx(DropdownMenuLabel, { children: "My Account" }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { disabled: true, children: [_jsx(User, { className: "w-4 h-4 mr-2" }), "Profile"] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onClick: handleLogout, className: "text-destructive", children: [_jsx(LogOut, { className: "w-4 h-4 mr-2" }), "Logout"] })] })] })] })] }));
}
