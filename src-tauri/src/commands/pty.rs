/**
 * [INPUT]: 依赖 pty_manager 模块的会话管理功能
 * [OUTPUT]: 对外提供 PTY 终端相关的 Tauri 命令
 * [POS]: commands/ 模块成员，处理伪终端会话的创建、读写、调整大小等
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use crate::pty_manager;

// ============================================================================
// PTY Terminal Commands
// ============================================================================

#[tauri::command]
pub fn pty_create(
    id: String,
    cwd: String,
    shell: Option<String>,
    command: Option<String>,
) -> Result<String, String> {
    pty_manager::create_session(id.clone(), cwd, shell, command)?;
    Ok(id)
}

#[tauri::command]
pub fn pty_write(id: String, data: Vec<u8>) -> Result<(), String> {
    pty_manager::write_to_session(&id, &data)
}

#[tauri::command]
#[allow(deprecated)]
pub fn pty_read(id: String) -> Result<Vec<u8>, String> {
    // Legacy - data now comes via pty-data events
    pty_manager::read_from_session(&id)
}

#[tauri::command]
pub fn pty_resize(id: String, cols: u16, rows: u16) -> Result<(), String> {
    pty_manager::resize_session(&id, cols, rows)
}

#[tauri::command]
pub fn pty_kill(id: String) -> Result<(), String> {
    pty_manager::kill_session(&id)
}

#[tauri::command]
pub fn pty_list() -> Vec<String> {
    pty_manager::list_sessions()
}

#[tauri::command]
pub fn pty_exists(id: String) -> bool {
    pty_manager::session_exists(&id)
}

#[tauri::command]
pub fn pty_scrollback(id: String) -> Vec<u8> {
    pty_manager::get_scrollback(&id)
}

#[tauri::command]
pub fn pty_purge_scrollback(id: String) {
    pty_manager::purge_scrollback(&id)
}

#[tauri::command]
pub fn pty_flush_scrollback() {
    pty_manager::flush_all_scrollback()
}
