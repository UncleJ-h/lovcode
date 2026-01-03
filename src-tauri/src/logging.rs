/**
 * [INPUT]: 依赖 tracing, tracing-subscriber
 * [OUTPUT]: 对外提供 init_logging() 初始化函数
 * [POS]: 日志模块，提供结构化日志支持
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initialize structured logging with tracing.
///
/// Log levels can be controlled via RUST_LOG environment variable:
/// - RUST_LOG=debug (for debug output)
/// - RUST_LOG=lovcode=debug,info (for module-specific levels)
///
/// Default level is INFO in release, DEBUG in debug builds.
pub fn init_logging() {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        if cfg!(debug_assertions) {
            // Debug builds: more verbose
            EnvFilter::new("lovcode=debug,info")
        } else {
            // Release builds: less verbose
            EnvFilter::new("lovcode=info,warn")
        }
    });

    let fmt_layer = fmt::layer()
        .with_target(true)
        .with_thread_ids(false)
        .with_file(true)
        .with_line_number(true)
        .compact();

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .init();

    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        "Lovcode logging initialized"
    );
}

// Re-export tracing macros for convenience (used by other modules)
#[allow(unused_imports)]
pub use tracing::{debug, error, info, instrument, trace, warn};
