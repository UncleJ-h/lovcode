/**
 * [INPUT]: 依赖 hook_watcher 模块的文件监听功能
 * [OUTPUT]: 对外提供 Hook 监控相关的 Tauri 命令
 * [POS]: commands/ 模块成员，处理功能完成监控和通知
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use crate::hook_watcher;

// ============================================================================
// Hook Watcher Commands
// ============================================================================

#[tauri::command]
pub fn hook_start_monitoring(project_id: String, feature_id: String) {
    hook_watcher::start_monitoring(&project_id, &feature_id);
}

#[tauri::command]
pub fn hook_stop_monitoring(project_id: String, feature_id: String) {
    hook_watcher::stop_monitoring(&project_id, &feature_id);
}

#[tauri::command]
pub fn hook_is_monitoring(project_id: String, feature_id: String) -> bool {
    hook_watcher::is_monitoring(&project_id, &feature_id)
}

#[tauri::command]
pub fn hook_get_monitored() -> Vec<String> {
    hook_watcher::get_monitored_features()
}

#[tauri::command]
pub fn hook_notify_complete(
    app_handle: tauri::AppHandle,
    project_id: String,
    feature_id: String,
    feature_name: String,
) {
    hook_watcher::notify_feature_complete(&app_handle, &project_id, &feature_id, &feature_name);
}
