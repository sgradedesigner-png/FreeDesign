import axios, { AxiosHeaders } from 'axios';
import { supabase } from './supabase';
import { logger } from './logger';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  withCredentials: true, // Enable cookies for CSRF protection
});

// ✅ Performance fix: Use localStorage instead of async getSession()
async function getAccessToken() {
  const cachedToken = localStorage.getItem('sb-access-token');
  if (cachedToken) return cachedToken;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;

  if (token) {
    localStorage.setItem('sb-access-token', token);
  }

  return token;
}

// CSRF token management
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  // If we already have a token, return it
  if (csrfToken) return csrfToken;

  // If a fetch is in progress, wait for it
  if (csrfTokenPromise) return csrfTokenPromise;

  // Fetch new CSRF token
  csrfTokenPromise = (async () => {
    try {
      const response = await axios.get<{ csrfToken: string }>(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/csrf-token`,
        { withCredentials: true }
      );
      csrfToken = response.data.csrfToken;
      return csrfToken;
    } catch (error) {
      logger.error('Failed to fetch CSRF token:', error);
      throw error;
    } finally {
      csrfTokenPromise = null;
    }
  })();

  return csrfTokenPromise;
}

// Reset CSRF token (e.g., after 403 errors)
function resetCsrfToken() {
  csrfToken = null;
  csrfTokenPromise = null;
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  const headers = AxiosHeaders.from(config.headers);

  // Add Authorization header
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.delete('Authorization');
  }

  // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
  const method = config.method?.toUpperCase();
  if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    try {
      const csrf = await getCsrfToken();
      headers.set('X-CSRF-Token', csrf);
    } catch (error) {
      logger.error('Failed to add CSRF token to request:', error);
      // Continue without CSRF token - server will reject if required
    }
  }

  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as
      | (typeof error.config & {
          _retryAuth?: boolean;
          headers?: unknown;
        })
      | undefined;
    const status = error?.response?.status;

    // Handle 403 Forbidden - could be CSRF error or not admin
    if (status === 403) {
      // Check if it's a CSRF error
      const errorMessage = error?.response?.data?.message || '';
      if (errorMessage.toLowerCase().includes('csrf')) {
        logger.error('CSRF validation failed, fetching new token');
        resetCsrfToken();

        // Retry request with new CSRF token
        if (!originalRequest._retryAuth) {
          originalRequest._retryAuth = true;
          try {
            const csrf = await getCsrfToken();
            const headers = AxiosHeaders.from(originalRequest.headers);
            headers.set('X-CSRF-Token', csrf);
            originalRequest.headers = headers;
            return api.request(originalRequest);
          } catch (csrfError) {
            logger.error('Failed to retry with new CSRF token:', csrfError);
            return Promise.reject(error);
          }
        }
      }

      // Not a CSRF error - user is not admin
      logger.error('403 Forbidden: User is not an admin');
      localStorage.removeItem('sb-access-token');
      // Don't redirect here - let ProtectedRoute handle it
      return Promise.reject(error);
    }

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
  }
);

export type NikePrefillResponse = {
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  subtitle?: string;
  variantName: string;
  sku: string;
  priceUsd?: number;
  thumbnailUrl: string | null;
  galleryImages: string[];
  benefits: string[];
  productDetails: string[];
};

export async function getNikePrefill(sku: string): Promise<NikePrefillResponse> {
  const { data } = await api.get<NikePrefillResponse>('/admin/prefill/nike', {
    params: { sku },
  });
  return data;
}

