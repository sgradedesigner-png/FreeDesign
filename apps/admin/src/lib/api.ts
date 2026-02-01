import axios, { AxiosHeaders } from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

// ✅ Performance fix: Use localStorage instead of async getSession()
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sb-access-token');

  const headers = AxiosHeaders.from(config.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  config.headers = headers;
  return config;
});
