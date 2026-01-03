/**
 * [INPUT]: 依赖 diagnostics 模块的项目诊断功能
 * [OUTPUT]: 对外提供诊断相关的 Tauri 命令
 * [POS]: commands/ 模块成员，处理技术栈检测、环境变量检查等
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use crate::diagnostics::{self, EnvCheckResult, FileLineCount, TechStack};

// ============================================================================
// Diagnostics Commands
// ============================================================================

#[tauri::command]
pub async fn diagnostics_detect_stack(project_path: String) -> Result<TechStack, String> {
    tauri::async_runtime::spawn_blocking(move || diagnostics::detect_tech_stack(&project_path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn diagnostics_check_env(project_path: String) -> Result<EnvCheckResult, String> {
    tauri::async_runtime::spawn_blocking(move || diagnostics::check_env_vars(&project_path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn diagnostics_add_missing_keys(
    project_path: String,
    keys: Vec<String>,
) -> Result<usize, String> {
    diagnostics::add_missing_keys_to_env(&project_path, keys)
}

#[tauri::command]
pub async fn diagnostics_scan_file_lines(
    project_path: String,
    limit: usize,
    ignored_paths: Vec<String>,
) -> Result<Vec<FileLineCount>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        diagnostics::scan_file_lines(&project_path, limit, &ignored_paths)
    })
    .await
    .map_err(|e| e.to_string())?
}
