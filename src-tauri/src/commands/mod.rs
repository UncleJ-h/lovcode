/**
 * [INPUT]: 依赖各子模块的命令实现
 * [OUTPUT]: 对外提供所有 Tauri 命令的统一导出
 * [POS]: commands/ 模块入口，汇总所有命令供 lib.rs 注册
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// ============================================================================
// 子模块声明
// ============================================================================

pub mod agents; // Agent 和 Skill 管理
pub mod context; // 上下文文件管理
pub mod files; // 文件操作
pub mod git; // Git 操作
pub mod knowledge; // 知识库管理
pub mod local_commands; // 本地命令管理
pub mod marketplace; // 模板市场
pub mod projects; // 项目和会话管理
pub mod report; // 报告和统计
pub mod settings; // 设置管理
pub mod version; // Claude Code 版本管理

// ============================================================================
// 重导出所有命令
// ============================================================================

pub use files::{
    copy_file_to_project_assets, delete_project_logo, exec_shell_command, get_file_metadata,
    get_project_logo, list_directory, list_project_logos, read_file, read_file_base64,
    save_project_logo, set_current_project_logo,
};
pub use git::{
    git_auto_commit, git_generate_changelog, git_get_note, git_has_changes, git_log, git_revert,
    git_set_note,
};
pub use marketplace::{
    apply_statusline, check_mcp_installed, get_templates_catalog, has_previous_statusline,
    install_command_template, install_hook_template, install_mcp_template,
    install_setting_template, install_statusline_template, remove_settings_statusline,
    remove_statusline_template, restore_previous_statusline, uninstall_mcp_template,
    update_settings_statusline, write_statusline_script,
};
pub use local_commands::{
    add_frontmatter_field, archive_command, deprecate_command, list_local_commands,
    parse_frontmatter, rename_command, restore_command, update_command_aliases,
    update_frontmatter_field,
};
pub use projects::{
    decode_project_path, list_all_chats, list_all_sessions, list_projects, list_sessions,
    read_session_head,
};
pub use settings::{
    copy_to_clipboard, delete_settings_env, disable_settings_env, enable_settings_env,
    get_home_dir, get_mcp_config_path, get_session_file_path, get_session_summary, get_settings,
    get_settings_path, open_file_at_line, open_in_editor, open_path, open_session_in_editor,
    reveal_path, reveal_session_file, test_anthropic_connection, test_claude_cli,
    test_openai_connection, update_disabled_settings_env, update_mcp_env, update_settings_env,
    write_binary_file, write_file,
};
pub use version::{
    get_claude_code_version_info, install_claude_code_version, set_claude_code_autoupdater,
};
pub use knowledge::{
    find_session_project, get_distill_dir, get_distill_watch_enabled, list_distill_documents,
    list_reference_docs, list_reference_sources, set_distill_watch_enabled, DISTILL_WATCH_ENABLED,
};
pub use report::{
    get_activity_stats, get_annual_report_2025, get_command_stats, get_command_weekly_stats,
};
pub use context::{get_context_files, get_project_context};
pub use agents::{list_local_agents, list_local_skills};
