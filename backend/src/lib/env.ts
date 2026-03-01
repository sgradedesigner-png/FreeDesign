import { z } from 'zod';

const booleanFlagSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const mimeCsvSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  )
  .refine((items) => items.length > 0, {
    message: 'UPLOAD_ALLOWED_MIME must contain at least one MIME type',
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),

  // Database (Supabase PostgreSQL)
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid PostgreSQL connection string').optional(),

  // Supabase Auth
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_JWT_SECRET: z.string().min(32, 'SUPABASE_JWT_SECRET must be at least 32 characters'),

  // Session & Cookies
  COOKIE_SECRET: z
    .string()
    .min(32, 'COOKIE_SECRET must be at least 32 characters (use: openssl rand -base64 32)'),

  // QPay Payment Gateway
  QPAY_BASE_URL: z.string().url().default('https://merchant.qpay.mn/v2'),
  QPAY_USERNAME: z.string().min(1, 'QPAY_USERNAME is required'),
  QPAY_PASSWORD: z.string().min(1, 'QPAY_PASSWORD is required'),
  QPAY_INVOICE_CODE: z.string().min(1, 'QPAY_INVOICE_CODE is required'),
  QPAY_CALLBACK_URL: z.string().url('QPAY_CALLBACK_URL must be a valid URL'),
  QPAY_CALLBACK_ALLOWED_IPS: z.string().optional(),
  QPAY_CALLBACK_SECRET: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().startsWith('re_', 'RESEND_API_KEY must start with "re_"'),
  FROM_EMAIL: z.string().email('FROM_EMAIL must be a valid email address'),

  // Asset Storage
  ASSET_STORAGE_PROVIDER: z.enum(['cloudinary', 'r2']).optional().default('cloudinary'),

  // Cloudinary Storage
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),

  // DTF Upload Security
  CLOUDINARY_SIGNATURE_TTL_SEC: z
    .coerce
    .number()
    .int('CLOUDINARY_SIGNATURE_TTL_SEC must be an integer')
    .min(30, 'CLOUDINARY_SIGNATURE_TTL_SEC must be at least 30 seconds')
    .max(3600, 'CLOUDINARY_SIGNATURE_TTL_SEC must be at most 3600 seconds')
    .default(300),
  UPLOAD_MAX_MB: z
    .coerce
    .number()
    .int('UPLOAD_MAX_MB must be an integer')
    .min(1, 'UPLOAD_MAX_MB must be at least 1 MB')
    .max(512, 'UPLOAD_MAX_MB must be at most 512 MB')
    .default(25),
  UPLOAD_ALLOWED_MIME: z
    .string()
    .default('image/jpeg,image/jpg,image/png,image/webp,application/pdf')
    .pipe(mimeCsvSchema),

  // Phase Feature Flags (backend)
  FF_DTF_NAV_V1: booleanFlagSchema,
  FF_CART_DB_V1: booleanFlagSchema,
  FF_UPLOAD_ASYNC_VALIDATION_V1: booleanFlagSchema,
  FF_BUILDER_MVP_V1: booleanFlagSchema,

  // Optional: Rate Limiting
  RATE_LIMIT_MAX: z.string().optional().default('100'),
  RATE_LIMIT_WINDOW: z.string().optional().default('60000'),

  // Optional: Cron Jobs
  CRON_RUN_ON_STARTUP: z.string().optional().default('false'),
  CRON_EXPIRATION_WARNING_ENABLED: z.string().optional().default('true'),
  CRON_EXPIRED_CHECK_ENABLED: z.string().optional().default('true'),

  // Optional: Upload Validation Worker
  WORKER_UPLOAD_VALIDATION_ENABLED: booleanFlagSchema,
  WORKER_UPLOAD_VALIDATION_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).optional().default(5000),
  WORKER_UPLOAD_VALIDATION_BATCH_SIZE: z.coerce.number().int().min(1).max(100).optional().default(10),
  WORKER_UPLOAD_VALIDATION_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(20).optional().default(5),

  // Optional: Builder Preview Worker (P3-02)
  WORKER_BUILDER_PREVIEW_ENABLED: booleanFlagSchema,
  WORKER_BUILDER_PREVIEW_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).optional().default(10000),
  WORKER_BUILDER_PREVIEW_BATCH_SIZE: z.coerce.number().int().min(1).max(50).optional().default(5),
  WORKER_BUILDER_PREVIEW_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(10).optional().default(2),

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

export function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env);
    console.log('Environment validation passed');
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\nEnvironment validation failed:\n');
      error.issues.forEach((issue: z.ZodIssue) => {
        const field = issue.path.join('.');
        console.error(`  - ${field}: ${issue.message}`);
      });
      console.error('\nCheck backend/.env and required variables.\n');
    } else {
      console.error('\nUnexpected error during environment validation:', error);
    }

    process.exit(1);
  }
}

export const env = validateEnv();
