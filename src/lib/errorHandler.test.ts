/**
 * [INPUT]: errorHandler utilities
 * [OUTPUT]: Unit tests for error handling functions
 * [POS]: 测试错误处理工具函数
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleInvokeError,
  logNonCriticalError,
  handleClipboardError,
  handlePtyResizeError,
} from './errorHandler';

describe('errorHandler utilities', () => {
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe('handleInvokeError', () => {
    it('logs warning in dev mode', () => {
      const handler = handleInvokeError({ operation: '测试操作' });
      handler(new Error('测试错误'));

      expect(console.warn).toHaveBeenCalledWith(
        '[测试操作] 失败:',
        '测试错误'
      );
    });

    it('logs error when severity is error', () => {
      const handler = handleInvokeError({
        operation: '严重操作',
        severity: 'error',
      });
      handler(new Error('严重错误'));

      expect(console.error).toHaveBeenCalledWith(
        '[严重操作] 失败:',
        '严重错误'
      );
    });

    it('handles string errors', () => {
      const handler = handleInvokeError({ operation: '测试' });
      handler('字符串错误');

      expect(console.warn).toHaveBeenCalledWith('[测试] 失败:', '字符串错误');
    });

    it('handles unknown error types', () => {
      const handler = handleInvokeError({ operation: '测试' });
      handler({ custom: 'error object' });

      expect(console.warn).toHaveBeenCalledWith(
        '[测试] 失败:',
        '[object Object]'
      );
    });
  });

  describe('logNonCriticalError', () => {
    it('logs with info severity and silent mode', () => {
      const handler = logNonCriticalError('可选操作');
      handler(new Error('非关键错误'));

      // 应该使用 warn (因为 info severity maps to warn in our impl)
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('handleClipboardError', () => {
    it('logs clipboard error in dev mode', () => {
      handleClipboardError(new Error('剪贴板权限被拒绝'));

      expect(console.warn).toHaveBeenCalledWith(
        '[Clipboard] 复制失败:',
        expect.any(Error)
      );
    });
  });

  describe('handlePtyResizeError', () => {
    it('logs PTY resize error in dev mode', () => {
      handlePtyResizeError(new Error('PTY 已关闭'));

      expect(console.warn).toHaveBeenCalledWith(
        '[PTY Resize] 调整大小失败:',
        expect.any(Error)
      );
    });
  });
});
