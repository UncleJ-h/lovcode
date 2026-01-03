/**
 * [INPUT]: Tauri invoke API errors
 * [OUTPUT]: handleInvokeError, logError utilities
 * [POS]: 统一错误处理工具
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

type ErrorSeverity = "info" | "warning" | "error";

interface ErrorContext {
  /** 操作描述，用于日志 */
  operation: string;
  /** 严重程度 */
  severity?: ErrorSeverity;
  /** 是否显示用户提示（未来可接入 toast） */
  silent?: boolean;
}

/**
 * 记录 Tauri invoke 调用错误
 *
 * 用法:
 * ```ts
 * invoke("get_home_dir")
 *   .then(setHomeDir)
 *   .catch(handleInvokeError({ operation: "获取用户目录" }));
 * ```
 */
export function handleInvokeError(context: ErrorContext): (error: unknown) => void {
  return (error: unknown) => {
    const { operation, severity = "warning", silent = false } = context;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 开发模式下输出到控制台
    if (import.meta.env.DEV) {
      const logFn = severity === "error" ? console.error : console.warn;
      logFn(`[${operation}] 失败:`, errorMessage);
    }

    // 未来可接入:
    // 1. Sentry 错误上报
    // 2. Toast 用户提示
    // 3. 错误边界触发

    if (!silent) {
      // 预留: 显示 toast 或其他用户反馈
      // toast.error(`${operation}失败: ${errorMessage}`);
    }
  };
}

/**
 * 处理非关键性错误（静默记录，不中断用户操作）
 *
 * 用法:
 * ```ts
 * invoke("get_optional_data")
 *   .then(setData)
 *   .catch(logNonCriticalError("加载可选数据"));
 * ```
 */
export function logNonCriticalError(operation: string): (error: unknown) => void {
  return handleInvokeError({ operation, severity: "info", silent: true });
}

/**
 * 记录剪贴板操作错误（浏览器限制常见）
 */
export function handleClipboardError(error: unknown): void {
  if (import.meta.env.DEV) {
    console.warn("[Clipboard] 复制失败:", error);
  }
  // 剪贴板错误通常是浏览器权限问题，不需要用户反馈
}

/**
 * 处理终端 resize 错误（PTY 可能已关闭）
 */
export function handlePtyResizeError(error: unknown): void {
  if (import.meta.env.DEV) {
    console.warn("[PTY Resize] 调整大小失败:", error);
  }
  // PTY resize 失败通常是会话已结束，不需要用户反馈
}
