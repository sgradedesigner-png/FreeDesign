/**
 * Runtime Environment Variable Validation
 *
 * Validates that all required environment variables are present at app startup.
 * Prevents silent failures due to missing configuration.
 *
 * @throws {Error} If any required environment variable is missing
 */

/**
 * List of required environment variables for the admin app
 * All variables must be prefixed with VITE_ to be exposed to the client
 */
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_URL',
  'VITE_TURNSTILE_SITE_KEY'
] as const;

/**
 * Optional environment variables with their default values
 */
const optionalEnvVars: Record<string, string> = {
  VITE_ENV: 'development',
  VITE_ENABLE_ANALYTICS: 'false',
  VITE_ENABLE_ERROR_TRACKING: 'false',
  VITE_ENABLE_DEBUG_MODE: 'true',
  VITE_API_TIMEOUT: '30000',
  VITE_MAX_FILE_SIZE: '5242880'
};

/**
 * Validates that all required environment variables are present
 *
 * @throws {Error} If any required variable is missing
 */
export function validateEnv(): void {
  const missing: string[] = [];

  // Check required variables
  for (const key of requiredEnvVars) {
    if (!import.meta.env[key]) {
      missing.push(key);
    }
  }

  // If any are missing, throw detailed error
  if (missing.length > 0) {
    const errorMessage = [
      '❌ Missing Required Environment Variables',
      '',
      'The following environment variables are required but not found:',
      ...missing.map(key => `  • ${key}`),
      '',
      'To fix this:',
      '1. Copy .env.example to .env:',
      '   cp .env.example .env',
      '',
      '2. Fill in the values in .env with your actual credentials',
      '',
      '3. Restart the development server',
      '',
      'For production, ensure these variables are set in your hosting environment.',
    ].join('\n');

    throw new Error(errorMessage);
  }

  // Log environment info (development only)
  if (import.meta.env.DEV) {
    console.log('✅ Environment validation passed');
    console.log('📋 Configuration:');
    console.log(`   • Environment: ${import.meta.env.VITE_ENV || 'development'}`);
    console.log(`   • API URL: ${import.meta.env.VITE_API_URL}`);
    console.log(`   • Supabase URL: ${import.meta.env.VITE_SUPABASE_URL}`);
    console.log(`   • Debug Mode: ${import.meta.env.VITE_ENABLE_DEBUG_MODE || 'true'}`);
  }
}

/**
 * Get an environment variable with a default fallback
 *
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns The environment variable value or default
 */
export function getEnv(key: string, defaultValue: string = ''): string {
  return import.meta.env[key] || defaultValue;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return import.meta.env.PROD || import.meta.env.VITE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENV === 'development';
}

/**
 * Typed environment variables for type safety
 */
export const env = {
  // Supabase
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string,

  // API
  API_URL: import.meta.env.VITE_API_URL as string,
  API_TIMEOUT: parseInt(getEnv('VITE_API_TIMEOUT', '30000'), 10),

  // Turnstile CAPTCHA
  TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY as string,

  // Environment
  ENV: getEnv('VITE_ENV', 'development'),
  IS_PRODUCTION: isProduction(),
  IS_DEVELOPMENT: isDevelopment(),

  // Feature Flags
  ENABLE_ANALYTICS: getEnv('VITE_ENABLE_ANALYTICS', 'false') === 'true',
  ENABLE_ERROR_TRACKING: getEnv('VITE_ENABLE_ERROR_TRACKING', 'false') === 'true',
  ENABLE_DEBUG_MODE: getEnv('VITE_ENABLE_DEBUG_MODE', 'true') === 'true',

  // Limits
  MAX_FILE_SIZE: parseInt(getEnv('VITE_MAX_FILE_SIZE', '5242880'), 10),
} as const;
