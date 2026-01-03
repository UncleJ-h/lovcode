/**
 * [INPUT]: ErrorBoundary component
 * [OUTPUT]: Unit tests for ErrorBoundary
 * [POS]: 测试 ErrorBoundary 组件
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, FeatureErrorBoundary } from './ErrorBoundary';

// 阻止 React 在测试中输出错误日志
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

// 故意抛出错误的测试组件
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('出现了一些问题')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
    expect(screen.getByText('刷新页面')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom Error UI</div>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('resets error state when retry button is clicked', () => {
    let shouldThrow = true;

    function ConditionalError() {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    );

    expect(screen.getByText('出现了一些问题')).toBeInTheDocument();

    // 修复错误条件
    shouldThrow = false;

    // 点击重试
    fireEvent.click(screen.getByText('重试'));

    // 重新渲染
    rerender(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('shows error details in development mode', () => {
    render(
      <ErrorBoundary showDetails={true}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('查看错误详情')).toBeInTheDocument();
  });
});

describe('FeatureErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <div>Feature Content</div>
      </FeatureErrorBoundary>
    );

    expect(screen.getByText('Feature Content')).toBeInTheDocument();
  });

  it('renders feature-specific error UI when child throws', () => {
    render(
      <FeatureErrorBoundary featureName="测试功能">
        <ThrowError />
      </FeatureErrorBoundary>
    );

    expect(screen.getByText('测试功能 加载失败')).toBeInTheDocument();
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();

    render(
      <FeatureErrorBoundary featureName="Test" onError={onError}>
        <ThrowError />
      </FeatureErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
