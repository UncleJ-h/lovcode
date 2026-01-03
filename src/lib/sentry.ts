/**
 * [INPUT]: @sentry/react
 * [OUTPUT]: Sentry initialization and error tracking utilities
 * [POS]: 可观测性 - 错误追踪
 * [PROTOCOL]: 变更时更新此头部
 */

import * as Sentry from '@sentry/react';

// Sentry DSN - should be set via environment variable in production
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

// Environment detection
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

/**
 * Initialize Sentry error tracking
 * Only enabled in production or when VITE_SENTRY_DSN is set
 */
export function initSentry(): void {
  // Skip initialization if no DSN or in development (unless forced)
  if (!SENTRY_DSN) {
    if (isDev) {
      console.debug('[Sentry] Skipped: No DSN configured (development mode)');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: isDev ? 'development' : 'production',

    // Performance monitoring
    tracesSampleRate: isProd ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Session replay for debugging
    replaysSessionSampleRate: isProd ? 0.01 : 0, // 1% in prod
    replaysOnErrorSampleRate: isProd ? 0.1 : 0, // 10% on error

    // Release tracking
    release: `lovcode@${import.meta.env.VITE_APP_VERSION || 'unknown'}`,

    // Filter out noisy errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Ignore network errors from Tauri IPC (expected in some cases)
      if (error instanceof Error) {
        if (error.message.includes('invoke') && error.message.includes('not found')) {
          return null;
        }
        // Ignore user-cancelled operations
        if (error.message.includes('cancelled') || error.message.includes('aborted')) {
          return null;
        }
      }

      return event;
    },

    // Additional context
    initialScope: {
      tags: {
        platform: 'tauri',
      },
    },
  });

  console.debug('[Sentry] Initialized successfully');
}

/**
 * Capture an exception with optional context
 */
export function captureException(error: Error | unknown, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) {
    console.error('[Error]', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  if (!SENTRY_DSN) {
    console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info'](
      `[${level.toUpperCase()}]`,
      message
    );
    return;
  }

  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id?: string; email?: string; username?: string } | null): void {
  Sentry.setUser(user);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Create a performance span for measuring operations
 */
export function startSpan<T>(
  name: string,
  operation: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: operation,
    },
    fn
  );
}

// Re-export Sentry's ErrorBoundary for use in React components
export { ErrorBoundary as SentryErrorBoundary } from '@sentry/react';
