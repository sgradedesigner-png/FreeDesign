/**
 * Sentry Error Tracking Configuration
 *
 * Provides real-time error monitoring, stack traces, and user context
 * for production issues.
 *
 * Features:
 * - Automatic error capture
 * - User context tracking (email, ID)
 * - Performance monitoring
 * - Release tracking
 * - Environment tagging
 * - Source map support
 */

import * as Sentry from '@sentry/react';
import { logger } from './logger';

/**
 * Initialize Sentry error tracking
 *
 * Only initializes in production or when explicitly enabled via VITE_SENTRY_ENABLED=true
 *
 * @returns void
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development';
  const release = import.meta.env.VITE_SENTRY_RELEASE || 'store@unknown';
  const enabled = import.meta.env.VITE_SENTRY_ENABLED === 'true' || environment === 'production';

  // Skip initialization if DSN not configured or explicitly disabled
  if (!dsn) {
    logger.debug('Sentry DSN not configured, skipping initialization');
    return;
  }

  if (!enabled) {
    logger.debug('Sentry disabled in', environment, 'environment');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      release,

      // Performance Monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev

      // Session Replay (optional - captures user sessions for debugging)
      // replaysSessionSampleRate: 0.1, // 10% of sessions
      // replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

      // Integrations
      integrations: [
        // Browser tracing for performance monitoring
        Sentry.browserTracingIntegration(),

        // React component tracking
        Sentry.replayIntegration({
          maskAllText: true, // Mask sensitive text
          blockAllMedia: true, // Block images/videos for privacy
        }),
      ],

      // Error filtering - ignore common/expected errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'chrome-extension://',
        'moz-extension://',

        // Network errors (user's connection issues)
        'NetworkError',
        'Network request failed',
        'Failed to fetch',

        // ResizeObserver (benign warning)
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',

        // Supabase session refresh (expected behavior)
        'Session is expired',
        'refresh_token_not_found',
      ],

      // Don't send errors in development (unless explicitly enabled)
      enabled,

      // Attach stack traces
      attachStacktrace: true,

      // Normalize depth for better error grouping
      normalizeDepth: 10,

      // Before sending events, you can modify or filter them
      beforeSend(event, hint) {
        // Don't send events in development (unless explicitly enabled)
        if (!enabled) {
          return null;
        }

        // Filter out 401/403 errors (authentication issues, not bugs)
        if (event.exception?.values?.[0]?.value?.includes('401') ||
            event.exception?.values?.[0]?.value?.includes('403')) {
          logger.debug('Filtered out auth error from Sentry:', event.exception.values[0].value);
          return null;
        }

        // Add custom context
        event.tags = {
          ...event.tags,
          browser: navigator.userAgent,
        };

        return event;
      },

      // Before breadcrumbs are sent
      beforeBreadcrumb(breadcrumb, hint) {
        // Don't log console breadcrumbs in production (too noisy)
        if (environment === 'production' && breadcrumb.category === 'console') {
          return null;
        }

        // Redact sensitive data from breadcrumbs
        if (breadcrumb.data?.url) {
          breadcrumb.data.url = redactSensitiveData(breadcrumb.data.url);
        }

        return breadcrumb;
      },
    });

    logger.debug('Sentry initialized successfully', { environment, release });
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Set user context for Sentry
 *
 * Call this after user logs in to associate errors with specific users
 *
 * @param user - User object with id, email, and optional username
 */
export function setSentryUser(user: { id: string; email?: string; username?: string } | null): void {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username || user.email,
  });

  logger.debug('Sentry user context set:', user.email);
}

/**
 * Manually capture an exception
 *
 * Use this for caught errors that you still want to track
 *
 * @param error - Error object or string
 * @param context - Additional context about the error
 */
export function captureException(error: Error | string, context?: Record<string, any>): void {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }

  logger.error('Exception captured by Sentry:', error, context);
}

/**
 * Manually capture a message
 *
 * Use this for important events or warnings that aren't errors
 *
 * @param message - Message to capture
 * @param level - Severity level
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
  Sentry.captureMessage(message, level);
  logger.debug('Message captured by Sentry:', message, level);
}

/**
 * Add breadcrumb (trail of events leading to an error)
 *
 * @param breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, any>;
}): void {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Redact sensitive data from URLs and strings
 *
 * @param str - String to redact
 * @returns Redacted string
 */
function redactSensitiveData(str: string): string {
  return str
    // Redact email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
    // Redact JWTs
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[jwt]')
    // Redact API keys
    .replace(/[a-z0-9]{32,}/gi, '[redacted]');
}

/**
 * Create Sentry ErrorBoundary wrapper
 *
 * Usage:
 * <SentryErrorBoundary fallback={<ErrorFallback />}>
 *   <App />
 * </SentryErrorBoundary>
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Wrap async functions to automatically capture errors
 *
 * Usage:
 * const fetchData = withSentry(async () => { ... });
 */
export function withSentry<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((error) => {
          captureException(error);
          throw error;
        });
      }
      return result;
    } catch (error) {
      captureException(error as Error);
      throw error;
    }
  }) as T;
}

/**
 * Re-export Sentry for advanced usage
 */
export { Sentry };
