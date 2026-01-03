/**
 * [INPUT]: React.lazy, Suspense
 * [OUTPUT]: Lazy-loaded view components
 * [POS]: 性能优化 - 代码分割
 * [PROTOCOL]: 变更时更新此头部
 */

import { lazy, Suspense, type ComponentType } from 'react';

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="border-primary/30 border-t-primary h-8 w-8 animate-spin rounded-full border-2" />
        <span className="text-muted-foreground text-sm">Loading...</span>
      </div>
    </div>
  );
}

// Helper to wrap lazy components with Suspense
function withSuspense<P extends object>(
  LazyComponent: ComponentType<P>,
  fallback: React.ReactNode = <LoadingFallback />
) {
  return function SuspenseWrapper(props: P) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Lazy-loaded heavy components
// These are split into separate chunks for better initial load time

// AnnualReport - large component with charts, loaded on demand
export const LazyAnnualReport2025 = withSuspense(
  lazy(() => import('./AnnualReport').then((m) => ({ default: m.AnnualReport2025 })))
);

// DocumentReader - heavy markdown/syntax highlighting component
export const LazyDocumentReader = withSuspense(
  lazy(() => import('../components/DocumentReader').then((m) => ({ default: m.default })))
);

// Monaco Editor wrapper - large dependency
export const LazyMonacoEditor = withSuspense(
  lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.default })))
);
