import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { logger } from './logger';

const environment = process.env.NODE_ENV || 'development';
const release = process.env.SENTRY_RELEASE || 'backend@1.0.0';

/**
 * Initialize Sentry error tracking
 *
 * Guarded by:
 * - SENTRY_DSN must be set
 * - SENTRY_ENABLED=true OR NODE_ENV=production
 *
 * Usage in Railway:
 * - Set SENTRY_DSN env var
 * - Set NODE_ENV=production (auto-enables Sentry)
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  const enabled = process.env.SENTRY_ENABLED === 'true' || environment === 'production';

  if (!dsn) {
    logger.info('Sentry DSN not configured, error tracking disabled');
    return;
  }

  if (!enabled) {
    logger.info('Sentry disabled (SENTRY_ENABLED=false and not production)');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      release,

      // Performance monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      profilesSampleRate: environment === 'production' ? 0.1 : 1.0,

      integrations: [
        // Enable profiling
        nodeProfilingIntegration(),
      ],

      // Filter out low-severity events
      beforeSend(event, hint) {
        // Don't send debug/info level events
        if (event.level === 'info' || event.level === 'debug') {
          return null;
        }
        return event;
      },
    });

    logger.info({ environment, release }, '✅ Sentry initialized');
  } catch (error) {
    logger.error({ error }, '❌ Failed to initialize Sentry');
  }
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Set user context for error tracking
 */
export function setSentryUser(user: { id: string; email?: string; role?: string } | null) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb (for debugging)
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    data,
    level: 'info',
  });
}
