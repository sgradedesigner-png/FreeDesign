import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
export default function ProtectedRoute({ children }) {
    const { loading, ok } = useAuth();
    if (loading) {
        return (_jsx("div", { style: {
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                fontSize: 16,
            }, children: _jsx("div", { children: "Loading..." }) }));
    }
    if (!ok)
        return _jsx(Navigate, { to: "/login", replace: true });
    return _jsx(_Fragment, { children: children });
}
