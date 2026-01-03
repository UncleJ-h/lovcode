/**
 * [INPUT]: console API, sentry
 * [OUTPUT]: Structured logging utilities
 * [POS]: 可观测性 - 结构化日志
 * [PROTOCOL]: 变更时更新此头部
 */

import { addBreadcrumb, captureException } from './sentry';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  component?: string;
}

// Log level hierarchy
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Current log level (configurable via environment)
const currentLevel: LogLevel =
  (import.meta.env.VITE_LOG_LEVEL as LogLevel) || (import.meta.env.DEV ? 'debug' : 'info');

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Format log entry for output
 */
function formatEntry(entry: LogEntry): string {
  const prefix = entry.component ? `[${entry.component}]` : '';
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  return `${prefix} ${entry.message}${contextStr}`;
}

/**
 * Create a structured log entry
 */
function createEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  component?: string
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    component,
  };
}

/**
 * Output log entry to console
 */
function outputLog(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return;

  const formatted = formatEntry(entry);

  switch (entry.level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      addBreadcrumb(entry.message, entry.component || 'app', entry.context);
      break;
    case 'error':
      console.error(formatted);
      addBreadcrumb(entry.message, entry.component || 'app', entry.context);
      break;
  }
}

/**
 * Logger interface for type safety
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
  time<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T>;
  child(subComponent: string): Logger;
}

/**
 * Create a logger instance for a specific component
 */
export function createLogger(component: string): Logger {
  return {
    debug(message: string, context?: LogContext): void {
      outputLog(createEntry('debug', message, context, component));
    },

    info(message: string, context?: LogContext): void {
      outputLog(createEntry('info', message, context, component));
    },

    warn(message: string, context?: LogContext): void {
      outputLog(createEntry('warn', message, context, component));
    },

    error(message: string, error?: Error | unknown, context?: LogContext): void {
      const entry = createEntry('error', message, context, component);
      outputLog(entry);

      // Report errors to Sentry
      if (error) {
        captureException(error, { ...context, component, message });
      }
    },

    /**
     * Measure and log execution time of an async operation
     */
    async time<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
      const start = performance.now();
      try {
        const result = await fn();
        const duration = Math.round(performance.now() - start);
        this.debug(`${operation} completed`, { ...context, durationMs: duration });
        return result;
      } catch (error) {
        const duration = Math.round(performance.now() - start);
        this.error(`${operation} failed`, error, { ...context, durationMs: duration });
        throw error;
      }
    },

    /**
     * Create a child logger with additional context
     */
    child(subComponent: string): Logger {
      return createLogger(`${component}:${subComponent}`);
    },
  };
}

// Default app logger
export const logger = createLogger('app');

// Specialized loggers for common use cases
export const apiLogger = createLogger('api');
export const uiLogger = createLogger('ui');
export const storeLogger = createLogger('store');

/**
 * Log user action (for analytics/debugging)
 */
export function logAction(action: string, target?: string, metadata?: LogContext): void {
  const entry = createEntry(
    'info',
    `Action: ${action}`,
    {
      target,
      ...metadata,
    },
    'user'
  );

  outputLog(entry);
  addBreadcrumb(action, 'user.action', { target, ...metadata });
}

/**
 * Log navigation event
 */
export function logNavigation(from: string, to: string, metadata?: LogContext): void {
  const entry = createEntry('debug', `Navigate: ${from} → ${to}`, metadata, 'navigation');
  outputLog(entry);
  addBreadcrumb(`Navigate to ${to}`, 'navigation', { from, to, ...metadata });
}
