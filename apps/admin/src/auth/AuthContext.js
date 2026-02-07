import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    // ✅ useCallback to prevent unnecessary re-renders
    const refresh = useCallback(async () => {
        // ✅ app load дээр 1 удаа session шалгана
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
            setUser(null);
            setAccessToken(null);
            localStorage.removeItem('sb-access-token');
            setLoading(false);
            return;
        }
        setUser(session.user);
        setAccessToken(session.access_token);
        localStorage.setItem('sb-access-token', session.access_token);
        setLoading(false);
    }, []);
    const login = useCallback(async (email, password) => {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            setLoading(false);
            throw error;
        }
        setUser(data.user);
        setAccessToken(data.session?.access_token ?? null);
        if (data.session?.access_token) {
            localStorage.setItem('sb-access-token', data.session.access_token);
        }
        setLoading(false);
    }, []);
    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        setAccessToken(null);
        localStorage.removeItem('sb-access-token');
    }, []);
    useEffect(() => {
        refresh(); // ✅ app load дээр 1 удаа
        // session өөрчлөгдвөл state sync
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setAccessToken(session?.access_token ?? null);
            // ✅ Persist token to localStorage for API interceptor
            if (session?.access_token) {
                localStorage.setItem('sb-access-token', session.access_token);
            }
            else {
                localStorage.removeItem('sb-access-token');
            }
            setLoading(false);
        });
        return () => sub.subscription.unsubscribe();
    }, [refresh]);
    const ok = !!user;
    // ✅ Fixed dependencies - include all functions
    const value = useMemo(() => ({ loading, ok, user, accessToken, login, logout, refresh }), [loading, ok, user, accessToken, login, logout, refresh]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
