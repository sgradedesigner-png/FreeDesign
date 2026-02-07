import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
export default function LoginPage() {
    const nav = useNavigate();
    const { login, ok } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [err, setErr] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    useEffect(() => {
        if (ok)
            nav('/', { replace: true });
    }, [ok, nav]);
    const onSubmit = async (e) => {
        e.preventDefault();
        setErr(null);
        setSubmitting(true);
        try {
            await login(email, password);
        }
        catch {
            setErr('Email эсвэл password буруу байна');
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsxs("div", { className: "min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4", children: [_jsxs("div", { className: "absolute inset-0 overflow-hidden pointer-events-none", children: [_jsx("div", { className: "absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" }), _jsx("div", { className: "absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" })] }), _jsxs("div", { className: "relative w-full max-w-md", children: [_jsxs("div", { className: "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50 p-8 space-y-6", children: [_jsxs("div", { className: "text-center space-y-2", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 shadow-lg shadow-primary/25 mb-2", children: _jsx(ShoppingBag, { className: "w-8 h-8 text-white" }) }), _jsx("h1", { className: "text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent", children: "Admin Panel" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Sign in to manage your e-commerce store" })] }), _jsxs("form", { onSubmit: onSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email", className: "text-sm font-medium", children: "Email Address" }), _jsxs("div", { className: "relative", children: [_jsx(Mail, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" }), _jsx(Input, { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "admin@example.com", className: "pl-10 h-11", required: true, disabled: submitting })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "password", className: "text-sm font-medium", children: "Password" }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" }), _jsx(Input, { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", className: "pl-10 h-11", required: true, disabled: submitting })] })] }), err && (_jsxs("div", { className: "flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-in fade-in slide-in-from-top-2", children: [_jsx(AlertCircle, { className: "w-4 h-4 flex-shrink-0" }), _jsx("p", { children: err })] })), _jsx(Button, { type: "submit", disabled: submitting, className: "w-full h-11 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-lg shadow-primary/25 transition-all", children: submitting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), "Logging in..."] })) : ('Sign In') })] }), _jsx("div", { className: "text-center text-xs text-muted-foreground pt-4 border-t border-border/50", children: _jsx("p", { children: "Secured admin access only" }) })] }), _jsx("div", { className: "absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 blur-xl" })] })] }));
}
