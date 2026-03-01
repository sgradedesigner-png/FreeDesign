/**
 * Runtime Environment Variable Validation
 *
 * Validates that all required environment variables are present at app startup.
 * Prevents silent failures due to missing configuration.
 */

const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_URL',
  'VITE_TURNSTILE_SITE_KEY',
] as const;

const optionalEnvVars: Record<string, string> = {
  VITE_ENV: 'development',
  VITE_ENABLE_ANALYTICS: 'false',
  VITE_ENABLE_ERROR_TRACKING: 'false',
  VITE_ENABLE_DEBUG_MODE: 'true',
  VITE_API_TIMEOUT: '30000',
  VITE_MAX_FILE_SIZE: '5242880',
  VITE_FF_DTF_NAV_V1: 'false',
  VITE_FF_CART_DB_V1: 'false',
  VITE_FF_UPLOAD_ASYNC_VALIDATION_V1: 'false',
  VITE_FF_BUILDER_MVP_V1: 'false',
  VITE_FF_CUSTOM_LAYOUT_TEMPLATE_STRICT: 'false',
  VITE_SENTRY_DSN: '',
  VITE_SENTRY_ENABLED: 'false',
  VITE_SENTRY_ENVIRONMENT: 'development',
  VITE_SENTRY_RELEASE: 'store@0.0.1',
};

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of requiredEnvVars) {
    if (!import.meta.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const errorMessage = [
      'Missing required environment variables',
      '',
      'The following environment variables are required but not found:',
      ...missing.map((key) => `  - ${key}`),
      '',
      'To fix this:',
      '1. Copy .env.example to .env',
      '2. Fill in required values',
      '3. Restart the dev server',
      '',
      'For production, configure these in Cloudflare Pages settings.',
    ].join('\n');

    throw new Error(errorMessage);
  }

  if (import.meta.env.DEV) {
    console.log('Environment validation passed');
    console.log(`Environment: ${import.meta.env.VITE_ENV || 'development'}`);
    console.log(`API URL: ${import.meta.env.VITE_API_URL}`);
  }
}

export function getEnv(key: string, defaultValue: string = ''): string {
  return import.meta.env[key] || optionalEnvVars[key] || defaultValue;
}

export function isProduction(): boolean {
  return import.meta.env.PROD || import.meta.env.VITE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENV === 'development';
}

const asFlag = (key: string, fallback = 'false') => getEnv(key, fallback) === 'true';

export const env = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string,

  API_URL: import.meta.env.VITE_API_URL as string,
  API_TIMEOUT: parseInt(getEnv('VITE_API_TIMEOUT', '30000'), 10),

  TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY as string,

  ENV: getEnv('VITE_ENV', 'development'),
  IS_PRODUCTION: isProduction(),
  IS_DEVELOPMENT: isDevelopment(),

  ENABLE_ANALYTICS: asFlag('VITE_ENABLE_ANALYTICS'),
  ENABLE_ERROR_TRACKING: asFlag('VITE_ENABLE_ERROR_TRACKING'),
  ENABLE_DEBUG_MODE: asFlag('VITE_ENABLE_DEBUG_MODE', 'true'),

  // Phase flags (client-visible, non-secret)
  FF_DTF_NAV_V1: asFlag('VITE_FF_DTF_NAV_V1'),
  FF_CART_DB_V1: asFlag('VITE_FF_CART_DB_V1'),
  FF_UPLOAD_ASYNC_VALIDATION_V1: asFlag('VITE_FF_UPLOAD_ASYNC_VALIDATION_V1'),
  FF_BUILDER_MVP_V1: asFlag('VITE_FF_BUILDER_MVP_V1'),
  FF_CUSTOM_LAYOUT_TEMPLATE_STRICT: asFlag('VITE_FF_CUSTOM_LAYOUT_TEMPLATE_STRICT'),

  MAX_FILE_SIZE: parseInt(getEnv('VITE_MAX_FILE_SIZE', '5242880'), 10),
} as const;
