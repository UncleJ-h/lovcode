/**
 * [INPUT]: React error boundary API
 * [OUTPUT]: ErrorBoundary, withErrorBoundary HOC
 * [POS]: 全局错误边界组件，防止应用白屏崩溃
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "./ui/button";

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 用于在开发模式下显示错误详情 */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// ErrorBoundary Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // 调用外部错误处理器（如 Sentry）
    this.props.onError?.(error, errorInfo);

    // 开发模式下输出到控制台
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary] Caught error:", error);
      console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails = import.meta.env.DEV } = this.props;

    if (hasError) {
      // 如果提供了自定义 fallback，使用它
      if (fallback) {
        return fallback;
      }

      // 默认错误 UI
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="mb-6 text-6xl">💥</div>
          <h2 className="mb-2 font-serif text-xl font-semibold text-foreground">
            出现了一些问题
          </h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            应用遇到了意外错误。你可以尝试重试当前操作，或刷新页面。
          </p>

          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset}>
              重试
            </Button>
            <Button onClick={this.handleReload}>
              刷新页面
            </Button>
          </div>

          {showDetails && error && (
            <details className="mt-8 w-full max-w-2xl text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                查看错误详情
              </summary>
              <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
                <p className="mb-2 font-mono text-sm font-semibold text-destructive">
                  {error.name}: {error.message}
                </p>
                {errorInfo?.componentStack && (
                  <pre className="overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return children;
  }
}

// ============================================================================
// Feature-level Error Boundary (更轻量的局部错误边界)
// ============================================================================

interface FeatureErrorBoundaryProps {
  children: ReactNode;
  featureName: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: FeatureErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    if (import.meta.env.DEV) {
      console.error(`[${this.props.featureName}] Error:`, error);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, featureName } = this.props;

    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/30 p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            {featureName} 加载失败
          </p>
          {import.meta.env.DEV && error && (
            <p className="mb-3 font-mono text-xs text-destructive">
              {error.message}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            重试
          </Button>
        </div>
      );
    }

    return children;
  }
}

// ============================================================================
// HOC for wrapping components with error boundary
// ============================================================================

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureName: string
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <FeatureErrorBoundary featureName={featureName}>
      <WrappedComponent {...props} />
    </FeatureErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return WithErrorBoundary;
}

export default ErrorBoundary;
