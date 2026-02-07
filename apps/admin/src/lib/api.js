import axios, { AxiosHeaders } from 'axios';
import { supabase } from './supabase';
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});
// ✅ Performance fix: Use localStorage instead of async getSession()
async function getAccessToken() {
    const cachedToken = localStorage.getItem('sb-access-token');
    if (cachedToken)
        return cachedToken;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (token) {
        localStorage.setItem('sb-access-token', token);
    }
    return token;
}
api.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    const headers = AxiosHeaders.from(config.headers);
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    else {
        headers.delete('Authorization');
    }
    config.headers = headers;
    return config;
});
api.interceptors.response.use((response) => response, async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    if (status !== 401 || !originalRequest || originalRequest._retryAuth) {
        return Promise.reject(error);
    }
    originalRequest._retryAuth = true;
    const { data } = await supabase.auth.getSession();
    const refreshedToken = data.session?.access_token ?? null;
    if (!refreshedToken) {
        localStorage.removeItem('sb-access-token');
        return Promise.reject(error);
    }
    localStorage.setItem('sb-access-token', refreshedToken);
    const headers = AxiosHeaders.from(originalRequest.headers);
    headers.set('Authorization', `Bearer ${refreshedToken}`);
    originalRequest.headers = headers;
    return api.request(originalRequest);
});
export async function getNikePrefill(sku) {
    const { data } = await api.get('/admin/prefill/nike', {
        params: { sku },
    });
    return data;
}
