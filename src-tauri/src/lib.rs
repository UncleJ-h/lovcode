/**
 * [INPUT]: 依赖 commands/, services/, 各核心模块
 * [OUTPUT]: Tauri 应用入口，注册所有命令和事件处理
 * [POS]: 应用核心入口文件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
mod commands;
mod diagnostics;
mod errors;
mod hook_watcher;
mod logging;
mod logs;
mod pty_manager;
mod security;
mod services;
mod types;
mod workspace_store;

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::fs;
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{Emitter, Manager};

#[cfg(target_os = "macos")]
use objc::runtime::YES;
#[cfg(target_os = "macos")]
use objc::*;

// ============================================================================
// 命令重导出 (从 commands/ 模块)
// ============================================================================
// Project Commands
pub use commands::{list_all_chats, list_all_sessions, list_projects, list_sessions};
// Search
pub use services::{build_search_index, search_chats};
// Commands
pub use commands::{
    add_frontmatter_field, archive_command, deprecate_command, list_local_commands,
    parse_frontmatter, rename_command, restore_command, update_command_aliases,
    update_frontmatter_field,
};
// Agents & Skills
pub use commands::{
    get_coding_agent_info, list_coding_agents, list_local_agents, list_local_skills,
};
// Executor Profiles
pub use commands::{get_agent_profiles, list_executor_profiles, list_supported_agents};
// Knowledge Base
pub use commands::{
    find_session_project, get_distill_dir, get_distill_watch_enabled, list_distill_documents,
    list_reference_docs, list_reference_sources, set_distill_watch_enabled, DISTILL_WATCH_ENABLED,
};
// Marketplace
pub use commands::{
    apply_statusline, check_mcp_installed, get_templates_catalog, has_previous_statusline,
    install_command_template, install_hook_template, install_mcp_template,
    install_setting_template, install_statusline_template, remove_settings_statusline,
    remove_statusline_template, restore_previous_statusline, uninstall_mcp_template,
    update_settings_statusline, write_statusline_script,
};
// Context
pub use commands::{get_context_files, get_project_context};
// Report
pub use commands::{
    get_activity_stats, get_annual_report_2025, get_command_stats, get_command_weekly_stats,
};
// Settings
pub use commands::{
    copy_to_clipboard, delete_settings_env, disable_settings_env, enable_settings_env,
    get_home_dir, get_mcp_config_path, get_session_file_path, get_session_summary, get_settings,
    get_settings_path, open_file_at_line, open_in_editor, open_path, open_session_in_editor,
    reveal_path, reveal_session_file, test_anthropic_connection, test_claude_cli,
    test_openai_connection, update_disabled_settings_env, update_mcp_env, update_settings_env,
    write_binary_file, write_file,
};
// Version
pub use commands::{
    get_claude_code_version_info, install_claude_code_version, set_claude_code_autoupdater,
};
// Files
pub use commands::{
    copy_file_to_project_assets, delete_project_logo, exec_shell_command, get_file_metadata,
    get_project_logo, list_directory, list_project_logos, read_file, read_file_base64,
    save_project_logo, set_current_project_logo,
};
// Git
pub use commands::{
    git_auto_commit, git_generate_changelog, git_get_note, git_has_changes, git_log, git_revert,
    git_set_note,
};
// PTY
pub use commands::{
    pty_create, pty_exists, pty_flush_scrollback, pty_kill, pty_list, pty_purge_scrollback,
    pty_read, pty_resize, pty_scrollback, pty_write,
};
// Workspace
pub use commands::{
    workspace_add_panel, workspace_add_project, workspace_create_feature, workspace_delete_feature,
    workspace_get_pending_reviews, workspace_list_projects, workspace_load, workspace_remove_panel,
    workspace_remove_project, workspace_rename_feature, workspace_save,
    workspace_set_active_feature, workspace_set_active_project, workspace_toggle_panel_shared,
    workspace_update_feature_status,
};
// Hooks
pub use commands::{
    hook_get_monitored, hook_is_monitoring, hook_notify_complete, hook_start_monitoring,
    hook_stop_monitoring,
};
// Diagnostics
pub use commands::{
    diagnostics_add_missing_keys, diagnostics_check_env, diagnostics_detect_stack,
    diagnostics_scan_file_lines,
};
// Sessions
pub use commands::get_session_messages;

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
        let _: () =
            msg_send![ns_win, performSelector:sel_make_key withObject:nil_ptr afterDelay:delay];
        let _: () =
            msg_send![ns_win, performSelector:sel_order_front withObject:nil_ptr afterDelay:delay];
        let _: () =
            msg_send![ns_win, performSelector:sel_make_main withObject:nil_ptr afterDelay:delay];

        tracing::debug!("Window activation scheduled (50ms delay)");
    }
}

// ============================================================================
// Application Entry Point
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize structured logging
    logging::init_logging();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

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
                let mut watcher: RecommendedWatcher =
                    match notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
                        if let Ok(event) = res {
                            // Only trigger on create/modify/remove events
                            if event.kind.is_create()
                                || event.kind.is_modify()
                                || event.kind.is_remove()
                            {
                                let _ = tx.send(());
                            }
                        }
                    }) {
                        Ok(w) => w,
                        Err(_) => return,
                    };

                if watcher
                    .watch(&distill_dir, RecursiveMode::NonRecursive)
                    .is_err()
                {
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
                .item(&PredefinedMenuItem::about(
                    app,
                    Some("About Lovcode"),
                    None,
                )?)
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
            use tauri::WebviewUrl;
            use tauri::WebviewWindowBuilder;

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
                            if let Ok(window) =
                                WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                                    .title("Lovcode")
                                    .inner_size(800.0, 600.0)
                                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                                    .hidden_title(true)
                                    .traffic_light_position(tauri::Position::Logical(
                                        tauri::LogicalPosition::new(16.0, 28.0),
                                    ))
                                    .build()
                            {
                                let _ = window.show();
                                activate_and_focus_window(&window);
                            }
                        }
                        #[cfg(not(target_os = "macos"))]
                        if let Ok(window) =
                            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
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
            list_coding_agents,
            get_coding_agent_info,
            list_executor_profiles,
            get_agent_profiles,
            list_supported_agents,
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
                use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

                if let RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } = _event
                {
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
                            .traffic_light_position(tauri::Position::Logical(
                                tauri::LogicalPosition::new(16.0, 28.0),
                            ))
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
