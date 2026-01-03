mod commands;
mod diagnostics;
mod errors;
mod hook_watcher;
mod logging;
mod pty_manager;
mod security;
mod services;
mod types;
mod workspace_store;

// 从新模块导入 (逐步迁移)
use services::extract_content_with_meta;
use types::{Message, RawLine};

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{Emitter, Manager};

#[cfg(target_os = "macos")]
use objc::runtime::YES;
#[cfg(target_os = "macos")]
use objc::*;

// ============================================================================
// 路径辅助函数
// ============================================================================

fn get_disabled_env_path() -> PathBuf {
    security::get_lovstudio_dir_or_fallback().join("disabled_env.json")
}

fn load_disabled_env() -> Result<serde_json::Map<String, Value>, String> {
    let path = get_disabled_env_path();
    if !path.exists() {
        return Ok(serde_json::Map::new());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(value.as_object().cloned().unwrap_or_default())
}

fn save_disabled_env(disabled: &serde_json::Map<String, Value>) -> Result<(), String> {
    let path = get_disabled_env_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let output = serde_json::to_string_pretty(&Value::Object(disabled.clone()))
        .map_err(|e| e.to_string())?;
    // 使用原子化写入
    security::atomic_write_string(&path, &output).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get path to ~/.claude.json (MCP servers config)
fn get_claude_json_path() -> PathBuf {
    security::get_claude_json_path().unwrap_or_else(|_| PathBuf::from("./.claude.json"))
}

// ============================================================================
// Project Commands (代理到 commands/projects.rs)
// ============================================================================

// 注: list_projects, list_sessions, list_all_sessions, list_all_chats
// 已移至 commands/projects.rs，此处使用 pub use 重导出
pub use commands::{list_all_chats, list_all_sessions, list_projects, list_sessions};

#[tauri::command]
async fn get_session_messages(
    project_id: String,
    session_id: String,
) -> Result<Vec<Message>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let session_path = security::get_claude_dir_or_fallback()
            .join("projects")
            .join(&project_id)
            .join(format!("{}.jsonl", session_id));

        if !session_path.exists() {
            return Err("Session not found".to_string());
        }

        let content = fs::read_to_string(&session_path).map_err(|e| e.to_string())?;
        let mut messages = Vec::new();

        for (idx, line) in content.lines().enumerate() {
            if let Ok(parsed) = serde_json::from_str::<RawLine>(line) {
                let line_type = parsed.line_type.as_deref();
                if line_type == Some("user") || line_type == Some("assistant") {
                    if let Some(msg) = &parsed.message {
                        let role = msg.role.clone().unwrap_or_default();
                        let (content, is_tool) = extract_content_with_meta(&msg.content);
                        let is_meta = parsed.is_meta.unwrap_or(false);

                        if !content.is_empty() {
                            messages.push(Message {
                                uuid: parsed.uuid.unwrap_or_default(),
                                role,
                                content,
                                timestamp: parsed.timestamp.unwrap_or_default(),
                                is_meta,
                                is_tool,
                                line_number: idx + 1,
                            });
                        }
                    }
                }
            }
        }

        Ok(messages)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ============================================================================
// Search Feature (已移至 services/search.rs)
// ============================================================================

pub use services::{build_search_index, search_chats};

// ============================================================================
// Commands Feature (已移至 commands/local_commands.rs)
// ============================================================================

pub use commands::{
    add_frontmatter_field, archive_command, deprecate_command, list_local_commands,
    parse_frontmatter, rename_command, restore_command, update_command_aliases,
    update_frontmatter_field,
};

// ============================================================================
// Agents & Skills Feature (已移至 commands/agents.rs)
// ============================================================================
pub use commands::{list_local_agents, list_local_skills};

// ============================================================================
// Knowledge Base (已移至 commands/knowledge.rs)
// ============================================================================
pub use commands::{
    find_session_project, get_distill_dir, get_distill_watch_enabled, list_distill_documents,
    list_reference_docs, list_reference_sources, set_distill_watch_enabled, DISTILL_WATCH_ENABLED,
};

// ============================================================================
// Marketplace Feature (已移至 commands/marketplace.rs)
// ============================================================================

pub use commands::{
    apply_statusline, check_mcp_installed, get_templates_catalog, has_previous_statusline,
    install_command_template, install_hook_template, install_mcp_template,
    install_setting_template, install_statusline_template, remove_settings_statusline,
    remove_statusline_template, restore_previous_statusline, uninstall_mcp_template,
    update_settings_statusline, write_statusline_script,
};


// ============================================================================
// Context Feature (已移至 commands/context.rs)
// ============================================================================
pub use commands::{get_context_files, get_project_context};

// ============================================================================
// Report Feature (已移至 commands/report.rs)
// ============================================================================
pub use commands::{
    get_activity_stats, get_annual_report_2025, get_command_stats, get_command_weekly_stats,
};

// ============================================================================
// Settings Feature (已移至 commands/settings.rs)
// ============================================================================

pub use commands::{
    copy_to_clipboard, delete_settings_env, disable_settings_env, enable_settings_env,
    get_home_dir, get_mcp_config_path, get_session_file_path, get_session_summary, get_settings,
    get_settings_path, open_file_at_line, open_in_editor, open_path, open_session_in_editor,
    reveal_path, reveal_session_file, test_anthropic_connection, test_claude_cli,
    test_openai_connection, update_disabled_settings_env, update_mcp_env, update_settings_env,
    write_binary_file, write_file,
};

// ============================================================================
// Claude Code Version Management (已移至 commands/version.rs)
// ============================================================================

pub use commands::{
    get_claude_code_version_info, install_claude_code_version, set_claude_code_autoupdater,
};

// ============================================================================
// PTY Terminal Commands
// ============================================================================

#[tauri::command]
fn pty_create(
    id: String,
    cwd: String,
    shell: Option<String>,
    command: Option<String>,
) -> Result<String, String> {
    pty_manager::create_session(id.clone(), cwd, shell, command)?;
    Ok(id)
}

#[tauri::command]
fn pty_write(id: String, data: Vec<u8>) -> Result<(), String> {
    pty_manager::write_to_session(&id, &data)
}

#[tauri::command]
#[allow(deprecated)]
fn pty_read(id: String) -> Result<Vec<u8>, String> {
    // Legacy - data now comes via pty-data events
    pty_manager::read_from_session(&id)
}

#[tauri::command]
fn pty_resize(id: String, cols: u16, rows: u16) -> Result<(), String> {
    pty_manager::resize_session(&id, cols, rows)
}

#[tauri::command]
fn pty_kill(id: String) -> Result<(), String> {
    pty_manager::kill_session(&id)
}

#[tauri::command]
fn pty_list() -> Vec<String> {
    pty_manager::list_sessions()
}

#[tauri::command]
fn pty_exists(id: String) -> bool {
    pty_manager::session_exists(&id)
}

#[tauri::command]
fn pty_scrollback(id: String) -> Vec<u8> {
    pty_manager::get_scrollback(&id)
}

#[tauri::command]
fn pty_purge_scrollback(id: String) {
    pty_manager::purge_scrollback(&id)
}

#[tauri::command]
fn pty_flush_scrollback() {
    pty_manager::flush_all_scrollback()
}

// ============================================================================
// Workspace Commands
// ============================================================================

#[tauri::command]
fn workspace_load() -> Result<workspace_store::WorkspaceData, String> {
    workspace_store::load_workspace()
}

#[tauri::command]
fn workspace_save(data: workspace_store::WorkspaceData) -> Result<(), String> {
    workspace_store::save_workspace(&data)
}

#[tauri::command]
fn workspace_add_project(path: String) -> Result<workspace_store::WorkspaceProject, String> {
    workspace_store::add_project(path)
}

#[tauri::command]
fn workspace_list_projects() -> Result<Vec<workspace_store::WorkspaceProject>, String> {
    workspace_store::load_workspace().map(|d| d.projects)
}

#[tauri::command]
fn workspace_remove_project(id: String) -> Result<(), String> {
    workspace_store::remove_project(&id)
}

#[tauri::command]
fn workspace_set_active_project(id: String) -> Result<(), String> {
    workspace_store::set_active_project(&id)
}

#[tauri::command]
fn workspace_create_feature(project_id: String, name: String, description: Option<String>) -> Result<workspace_store::Feature, String> {
    workspace_store::create_feature(&project_id, name, description)
}

#[tauri::command]
fn workspace_rename_feature(feature_id: String, name: String) -> Result<(), String> {
    workspace_store::rename_feature(&feature_id, name)
}

#[tauri::command]
fn workspace_update_feature_status(
    project_id: String,
    feature_id: String,
    status: workspace_store::FeatureStatus,
) -> Result<(), String> {
    workspace_store::update_feature_status(&project_id, &feature_id, status)
}

#[tauri::command]
fn workspace_delete_feature(project_id: String, feature_id: String) -> Result<(), String> {
    workspace_store::delete_feature(&project_id, &feature_id)
}

#[tauri::command]
fn workspace_set_active_feature(project_id: String, feature_id: String) -> Result<(), String> {
    workspace_store::set_active_feature(&project_id, &feature_id)
}

#[tauri::command]
fn workspace_add_panel(
    project_id: String,
    feature_id: String,
    panel: workspace_store::PanelState,
) -> Result<(), String> {
    workspace_store::add_panel_to_feature(&project_id, &feature_id, panel)
}

#[tauri::command]
fn workspace_remove_panel(project_id: String, feature_id: String, panel_id: String) -> Result<(), String> {
    workspace_store::remove_panel_from_feature(&project_id, &feature_id, &panel_id)
}

#[tauri::command]
fn workspace_toggle_panel_shared(project_id: String, panel_id: String) -> Result<bool, String> {
    workspace_store::toggle_panel_shared(&project_id, &panel_id)
}

#[tauri::command]
fn workspace_get_pending_reviews() -> Result<Vec<(String, String, String)>, String> {
    workspace_store::get_pending_reviews()
}

// ============================================================================
// Hook Watcher Commands
// ============================================================================

#[tauri::command]
fn hook_start_monitoring(project_id: String, feature_id: String) {
    hook_watcher::start_monitoring(&project_id, &feature_id);
}

#[tauri::command]
fn hook_stop_monitoring(project_id: String, feature_id: String) {
    hook_watcher::stop_monitoring(&project_id, &feature_id);
}

#[tauri::command]
fn hook_is_monitoring(project_id: String, feature_id: String) -> bool {
    hook_watcher::is_monitoring(&project_id, &feature_id)
}

#[tauri::command]
fn hook_get_monitored() -> Vec<String> {
    hook_watcher::get_monitored_features()
}

#[tauri::command]
fn hook_notify_complete(app_handle: tauri::AppHandle, project_id: String, feature_id: String, feature_name: String) {
    hook_watcher::notify_feature_complete(&app_handle, &project_id, &feature_id, &feature_name);
}

// ============================================================================
// File Operations (已移至 commands/files.rs)
// ============================================================================

pub use commands::{
    copy_file_to_project_assets, delete_project_logo, exec_shell_command, get_file_metadata,
    get_project_logo, list_directory, list_project_logos, read_file, read_file_base64,
    save_project_logo, set_current_project_logo,
};

// ============================================================================
// Git Commands (已移至 commands/git.rs)
// ============================================================================

pub use commands::{
    git_auto_commit, git_generate_changelog, git_get_note, git_has_changes, git_log, git_revert,
    git_set_note,
};

// ============================================================================
// Diagnostics Commands
// ============================================================================

#[tauri::command]
async fn diagnostics_detect_stack(project_path: String) -> Result<diagnostics::TechStack, String> {
    tauri::async_runtime::spawn_blocking(move || {
        diagnostics::detect_tech_stack(&project_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn diagnostics_check_env(project_path: String) -> Result<diagnostics::EnvCheckResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        diagnostics::check_env_vars(&project_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn diagnostics_add_missing_keys(project_path: String, keys: Vec<String>) -> Result<usize, String> {
    diagnostics::add_missing_keys_to_env(&project_path, keys)
}

#[tauri::command]
async fn diagnostics_scan_file_lines(project_path: String, limit: usize, ignored_paths: Vec<String>) -> Result<Vec<diagnostics::FileLineCount>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        diagnostics::scan_file_lines(&project_path, limit, &ignored_paths)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ============================================================================
// macOS Window Configuration
// ============================================================================

/// 激活应用并聚焦指定窗口 (macOS)
/// 使用 dispatch_after 确保在 window.show() 异步操作完成后再激活
#[cfg(target_os = "macos")]
fn activate_and_focus_window(window: &tauri::WebviewWindow) {
    use cocoa::appkit::NSApplicationActivationPolicy;
    use cocoa::base::id;
    use objc::*;

    // 获取 NSWindow 句柄
    let ns_window = match window.ns_window() {
        Ok(w) => w as usize, // 转为 usize 以便跨闭包传递
        Err(_) => return,
    };

    unsafe {
        let app = cocoa::appkit::NSApp();

        // 1. 确保应用是 Regular 类型（可以接收焦点）
        let _: () = msg_send![app, setActivationPolicy: NSApplicationActivationPolicy::NSApplicationActivationPolicyRegular];

        // 2. 激活应用（立即执行）
        let _: () = msg_send![app, activateIgnoringOtherApps: YES];

        // 3. 延迟执行窗口聚焦，等待 window.show() 完成
        // 使用 performSelector:withObject:afterDelay: 在主线程的 run loop 中延迟执行
        // 50ms 足够让 macOS 完成窗口显示动画
        let ns_win: id = ns_window as id;
        let nil_ptr: id = std::ptr::null_mut();

        let sel_make_key = sel!(makeKeyAndOrderFront:);
        let sel_order_front = sel!(orderFrontRegardless);
        let sel_make_main = sel!(makeMainWindow);

        // 延迟 50ms 后执行
        let delay: f64 = 0.05;
        let _: () = msg_send![ns_win, performSelector:sel_make_key withObject:nil_ptr afterDelay:delay];
        let _: () = msg_send![ns_win, performSelector:sel_order_front withObject:nil_ptr afterDelay:delay];
        let _: () = msg_send![ns_win, performSelector:sel_make_main withObject:nil_ptr afterDelay:delay];

        tracing::debug!("Window activation scheduled (50ms delay)");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize structured logging
    logging::init_logging();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem};

            // Initialize PTY manager with app handle for event emission
            pty_manager::init(app.handle().clone());

            // Start watching distill directory for changes
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let distill_dir = get_distill_dir();
                if !distill_dir.exists() {
                    // Create directory if it doesn't exist so we can watch it
                    let _ = fs::create_dir_all(&distill_dir);
                }

                let (tx, rx) = channel();
                let mut watcher: RecommendedWatcher = match notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
                    if let Ok(event) = res {
                        // Only trigger on create/modify/remove events
                        if event.kind.is_create() || event.kind.is_modify() || event.kind.is_remove() {
                            let _ = tx.send(());
                        }
                    }
                }) {
                    Ok(w) => w,
                    Err(_) => return,
                };

                if watcher.watch(&distill_dir, RecursiveMode::NonRecursive).is_err() {
                    return;
                }

                // Debounce: wait for events to settle before emitting
                loop {
                    if rx.recv().is_ok() {
                        // Drain any additional events that came in quickly
                        while rx.recv_timeout(Duration::from_millis(200)).is_ok() {}
                        // Only emit if watch is enabled
                        if DISTILL_WATCH_ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
                            let _ = app_handle.emit("distill-changed", ());
                        }
                    }
                }
            });

            let settings = MenuItemBuilder::with_id("settings", "Settings...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let app_menu = SubmenuBuilder::new(app, "Lovcode")
                .item(&PredefinedMenuItem::about(app, Some("About Lovcode"), None)?)
                .separator()
                .item(&settings)
                .separator()
                .item(&PredefinedMenuItem::hide(app, Some("Hide Lovcode"))?)
                .item(&PredefinedMenuItem::hide_others(app, Some("Hide Others"))?)
                .item(&PredefinedMenuItem::show_all(app, Some("Show All"))?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, Some("Quit Lovcode"))?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            let toggle_main = MenuItemBuilder::with_id("toggle_main", "Toggle Main Window")
                .accelerator("CmdOrCtrl+1")
                .build(app)?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&toggle_main)
                .separator()
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            use tauri::WebviewWindowBuilder;
            use tauri::WebviewUrl;

            match event.id().as_ref() {
                "settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("menu-settings", ());
                    }
                }
                "toggle_main" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let visible = window.is_visible().unwrap_or(false);
                        let focused = window.is_focused().unwrap_or(false);
                        if visible && focused {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            #[cfg(target_os = "macos")]
                            activate_and_focus_window(&window);
                            #[cfg(not(target_os = "macos"))]
                            let _ = window.set_focus();
                        }
                    } else {
                        // Recreate main window
                        #[cfg(target_os = "macos")]
                        {
                            if let Ok(window) = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                                .title("Lovcode")
                                .inner_size(800.0, 600.0)
                                .title_bar_style(tauri::TitleBarStyle::Overlay)
                                .hidden_title(true)
                                .traffic_light_position(tauri::Position::Logical(tauri::LogicalPosition::new(16.0, 28.0)))
                                .build()
                            {
                                let _ = window.show();
                                activate_and_focus_window(&window);
                            }
                        }
                        #[cfg(not(target_os = "macos"))]
                        if let Ok(window) = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                            .title("Lovcode")
                            .inner_size(800.0, 600.0)
                            .build()
                        {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_projects,
            list_sessions,
            list_all_sessions,
            list_all_chats,
            get_session_messages,
            build_search_index,
            search_chats,
            list_local_commands,
            list_local_agents,
            list_local_skills,
            get_context_files,
            get_project_context,
            get_settings,
            get_command_stats,
            get_command_weekly_stats,
            get_activity_stats,
            get_annual_report_2025,
            get_templates_catalog,
            install_command_template,
            rename_command,
            deprecate_command,
            archive_command,
            restore_command,
            update_command_aliases,
            install_mcp_template,
            uninstall_mcp_template,
            check_mcp_installed,
            install_hook_template,
            install_setting_template,
            update_settings_statusline,
            remove_settings_statusline,
            write_statusline_script,
            install_statusline_template,
            apply_statusline,
            restore_previous_statusline,
            has_previous_statusline,
            remove_statusline_template,
            open_in_editor,
            open_file_at_line,
            open_session_in_editor,
            reveal_session_file,
            reveal_path,
            open_path,
            get_session_file_path,
            get_session_summary,
            copy_to_clipboard,
            get_settings_path,
            get_mcp_config_path,
            get_home_dir,
            write_file,
            write_binary_file,
            update_mcp_env,
            update_settings_env,
            delete_settings_env,
            disable_settings_env,
            enable_settings_env,
            update_disabled_settings_env,
            test_anthropic_connection,
            test_openai_connection,
            test_claude_cli,
            list_distill_documents,
            find_session_project,
            get_distill_watch_enabled,
            set_distill_watch_enabled,
            list_reference_sources,
            list_reference_docs,
            get_claude_code_version_info,
            install_claude_code_version,
            set_claude_code_autoupdater,
            // PTY commands
            pty_create,
            pty_write,
            pty_read,
            pty_resize,
            pty_kill,
            pty_list,
            pty_exists,
            pty_scrollback,
            pty_purge_scrollback,
            pty_flush_scrollback,
            // Workspace commands
            workspace_load,
            workspace_save,
            workspace_add_project,
            workspace_list_projects,
            workspace_remove_project,
            workspace_set_active_project,
            workspace_create_feature,
            workspace_rename_feature,
            workspace_update_feature_status,
            workspace_delete_feature,
            workspace_set_active_feature,
            workspace_add_panel,
            workspace_remove_panel,
            workspace_toggle_panel_shared,
            workspace_get_pending_reviews,
            // Hook watcher commands
            hook_start_monitoring,
            hook_stop_monitoring,
            hook_is_monitoring,
            // Project logo
            get_project_logo,
            list_project_logos,
            save_project_logo,
            copy_file_to_project_assets,
            set_current_project_logo,
            delete_project_logo,
            read_file_base64,
            exec_shell_command,
            hook_get_monitored,
            hook_notify_complete,
            // File system
            get_file_metadata,
            read_file,
            list_directory,
            // Git commands
            git_log,
            git_get_note,
            git_set_note,
            git_revert,
            git_has_changes,
            git_auto_commit,
            git_generate_changelog,
            // Diagnostics commands
            diagnostics_detect_stack,
            diagnostics_check_env,
            diagnostics_add_missing_keys,
            diagnostics_scan_file_lines
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            {
                use tauri::{Manager, RunEvent, WebviewWindowBuilder, WebviewUrl};

                if let RunEvent::Reopen { has_visible_windows, .. } = _event {
                    tracing::debug!(has_visible_windows, "Dock clicked");

                    // 无论是否有"可见窗口"，都尝试打开主窗口
                    // 因为 float 窗口可能被计入 has_visible_windows
                    if let Some(window) = _app.get_webview_window("main") {
                        tracing::debug!("Main window exists, showing");
                        let _ = window.show();
                        activate_and_focus_window(&window);
                    } else {
                        tracing::debug!("Main window gone, recreating");
                        match WebviewWindowBuilder::new(_app, "main", WebviewUrl::default())
                            .title("Lovcode")
                            .inner_size(800.0, 600.0)
                            .title_bar_style(tauri::TitleBarStyle::Overlay)
                            .hidden_title(true)
                            .traffic_light_position(tauri::Position::Logical(tauri::LogicalPosition::new(16.0, 28.0)))
                            .build()
                        {
                            Ok(window) => {
                                tracing::info!("Window created successfully");
                                let _ = window.show();
                                activate_and_focus_window(&window);
                            }
                            Err(e) => {
                                tracing::error!(error = ?e, "Failed to create window");
                            }
                        }
                    }
                }
            }
        });
}
