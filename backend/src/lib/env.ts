import { z } from 'zod';

/**
 * Environment variable validation schema
 *
 * Validates all required environment variables on startup.
 * If any are missing or invalid, the app exits immediately with clear error messages.
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),

  // Database (Supabase PostgreSQL)
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Supabase Auth
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_JWT_SECRET: z.string().min(32, 'SUPABASE_JWT_SECRET must be at least 32 characters'),

  // Session & Cookies
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters (use: openssl rand -base64 32)'),

  // QPay Payment Gateway
  QPAY_BASE_URL: z.string().url().default('https://merchant.qpay.mn/v2'),
  QPAY_USERNAME: z.string().min(1, 'QPAY_USERNAME is required'),
  QPAY_PASSWORD: z.string().min(1, 'QPAY_PASSWORD is required'),
  QPAY_INVOICE_CODE: z.string().min(1, 'QPAY_INVOICE_CODE is required'),
  QPAY_CALLBACK_URL: z.string().url('QPAY_CALLBACK_URL must be a valid URL'),

  // Email (Resend)
  RESEND_API_KEY: z.string().startsWith('re_', 'RESEND_API_KEY must start with "re_"'),
  FROM_EMAIL: z.string().email('FROM_EMAIL must be a valid email address'),

  // Cloudflare R2 Storage
  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  R2_PUBLIC_BASE_URL: z.string().url('R2_PUBLIC_BASE_URL must be a valid URL'),

  // Optional: Rate Limiting
  RATE_LIMIT_MAX: z.string().optional().default('100'),
  RATE_LIMIT_WINDOW: z.string().optional().default('60000'),

  // Optional: Cron Jobs
  CRON_RUN_ON_STARTUP: z.string().optional().default('false'),
  CRON_EXPIRATION_WARNING_ENABLED: z.string().optional().default('true'),
  CRON_EXPIRED_CHECK_ENABLED: z.string().optional().default('true'),

  // Optional: Performance
  ENABLE_RESPONSE_CACHE: z.string().optional().default('true'),
  CACHE_TTL: z.string().optional().default('60000'),
  CACHE_MAX_ENTRIES: z.string().optional().default('100'),

  // Optional: Monitoring (Sentry)
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENABLED: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // Optional: Logging
  LOG_LEVEL: z.string().optional(),

  // Optional: CORS
  CORS_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables on startup
 *
 * @throws {Error} If validation fails (exits process)
 */
export function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);
    console.log('✅ Environment validation passed');
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError<Env>;
      console.error('\n❌ Environment validation failed:\n');
      zodError.issues.forEach((err: z.ZodIssue) => {
        const field = err.path.join('.');
        console.error(`  • ${field}: ${err.message}`);
      });
      console.error('\n📝 Please check your .env file and ensure all required variables are set.');
      console.error('📚 See backend/RAILWAY_DEPLOYMENT.md for required environment variables.\n');
    } else {
      console.error('\n❌ Unexpected error during environment validation:', error);
    }
    process.exit(1);
  }
}

// Export validated environment for type-safe access
export const env = validateEnv();
