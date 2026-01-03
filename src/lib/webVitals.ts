/**
 * [INPUT]: web-vitals library
 * [OUTPUT]: Web Vitals performance monitoring utilities
 * [POS]: 可观测性 - 性能监控
 * [PROTOCOL]: 变更时更新此头部
 */

import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { captureMessage, addBreadcrumb } from './sentry';

// Performance thresholds (based on Google's recommendations)
const THRESHOLDS = {
  CLS: { good: 0.1, needsImprovement: 0.25 },
  INP: { good: 200, needsImprovement: 500 },
  FCP: { good: 1800, needsImprovement: 3000 },
  LCP: { good: 2500, needsImprovement: 4000 },
  TTFB: { good: 800, needsImprovement: 1800 },
} as const;

type MetricName = keyof typeof THRESHOLDS;

/**
 * Get rating for a metric value
 * Exported for external use (e.g., custom metric display)
 */
export function getRating(name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Report metric to analytics/monitoring
 */
function reportMetric(metric: Metric): void {
  const { name, value, rating, id } = metric;

  // Add breadcrumb for debugging
  addBreadcrumb(`Web Vital: ${name}`, 'performance', {
    value: Math.round(value),
    rating,
    id,
  });

  // Log to console in development
  if (import.meta.env.DEV) {
    const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
    console.debug(
      `${emoji} [Web Vital] ${name}: ${Math.round(value)}${name === 'CLS' ? '' : 'ms'} (${rating})`
    );
  }

  // Report poor metrics to Sentry
  if (rating === 'poor') {
    captureMessage(
      `Poor Web Vital: ${name} = ${Math.round(value)}${name === 'CLS' ? '' : 'ms'}`,
      'warning'
    );
  }

  // Send to analytics endpoint if configured
  const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
  if (analyticsEndpoint) {
    sendToAnalytics(analyticsEndpoint, metric);
  }
}

/**
 * Send metric to analytics endpoint
 */
async function sendToAnalytics(endpoint: string, metric: Metric): Promise<void> {
  try {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      navigationType: metric.navigationType,
      timestamp: Date.now(),
    });

    // Use sendBeacon for reliability
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, body);
    } else {
      await fetch(endpoint, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      });
    }
  } catch {
    // Silently fail - analytics should not break the app
  }
}

/**
 * Initialize Web Vitals monitoring
 * Call this once when the app starts
 */
export function initWebVitals(): void {
  // Cumulative Layout Shift
  onCLS(reportMetric);

  // Interaction to Next Paint (replaces FID)
  onINP(reportMetric);

  // First Contentful Paint
  onFCP(reportMetric);

  // Largest Contentful Paint
  onLCP(reportMetric);

  // Time to First Byte
  onTTFB(reportMetric);

  if (import.meta.env.DEV) {
    console.debug('[Web Vitals] Monitoring initialized');
  }
}

/**
 * Get current performance summary
 * Useful for displaying in settings/about page
 */
export function getPerformanceSummary(): {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  navigation?: PerformanceNavigationTiming;
} {
  const summary: ReturnType<typeof getPerformanceSummary> = {};

  // Memory info (Chrome only)
  if ('memory' in performance) {
    const memory = (performance as Performance & { memory: PerformanceMemory }).memory;
    summary.memory = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }

  // Navigation timing
  const navEntries = performance.getEntriesByType('navigation');
  if (navEntries.length > 0) {
    summary.navigation = navEntries[0] as PerformanceNavigationTiming;
  }

  return summary;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// Export thresholds for UI display
export { THRESHOLDS as WEB_VITALS_THRESHOLDS };
