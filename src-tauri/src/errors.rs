/**
 * [INPUT]: 依赖 thiserror 的 Error derive
 * [OUTPUT]: 对外提供 AppError 统一错误类型、Result 别名
 * [POS]: src-tauri/src 的错误处理核心，被所有模块消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use thiserror::Error;

// ============================================================================
// 统一错误类型
// ============================================================================

#[derive(Error, Debug)]
pub enum AppError {
    // --------------------------------------------------------------------
    // 系统级错误
    // --------------------------------------------------------------------
    #[error("无法确定用户主目录")]
    HomeDirNotFound,

    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON 解析错误: {0}")]
    Json(#[from] serde_json::Error),

    // --------------------------------------------------------------------
    // 安全错误
    // --------------------------------------------------------------------
    #[error("路径安全检查失败: {reason}")]
    PathTraversal { reason: String },

    #[error("无效的版本格式: {version}")]
    InvalidVersion { version: String },

    // --------------------------------------------------------------------
    // 业务错误
    // --------------------------------------------------------------------
    #[error("项目不存在: {path}")]
    ProjectNotFound { path: String },

    #[error("会话不存在: {project_id}/{session_id}")]
    SessionNotFound { project_id: String, session_id: String },

    #[error("文件不存在: {path}")]
    FileNotFound { path: String },

    #[error("文件写入失败: {path} - {reason}")]
    FileWrite { path: String, reason: String },

    #[error("搜索索引未初始化")]
    SearchIndexNotReady,

    #[error("操作失败: {0}")]
    Operation(String),
}

// ============================================================================
// 类型别名
// ============================================================================

pub type AppResult<T> = Result<T, AppError>;

// ============================================================================
// Tauri 错误转换
// ============================================================================

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

// 允许 AppError 作为 Tauri command 的返回类型
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
