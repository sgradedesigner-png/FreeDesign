/**
 * Production-safe logger utility
 *
 * - Development: All logs visible
 * - Production: Only errors logged (warnings/info/debug suppressed)
 *
 * Usage:
 *   logger.debug('Debug info:', data);
 *   logger.info('User logged in');
 *   logger.warn('API rate limit approaching');
 *   logger.error('Failed to load data:', error);
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Debug logs - Only in development
   * Use for detailed debugging information
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info logs - Only in development
   * Use for general information
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * Warning logs - Only in development
   * Use for non-critical issues
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Error logs - Always logged (including production)
   * Use for errors that should be tracked
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);

    // TODO: Send to error tracking service in production
    // if (!isDevelopment && window.Sentry) {
    //   Sentry.captureException(args[0]);
    // }
  },

  /**
   * Group logs - Only in development
   * Use for organizing related logs
   */
  group: (label: string) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  }
};
