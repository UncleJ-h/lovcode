/**
 * [INPUT]: 依赖 std::collections, tauri, types, loader
 * [OUTPUT]: 对外提供所有 marketplace 命令：get_templates_catalog, install_*, uninstall_*, apply_*, remove_* 等
 * [POS]: commands/marketplace/ 模块入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

mod install;
mod loader;
mod statusline;
mod types;

// Re-export all commands
pub use install::{
    check_mcp_installed, install_command_template, install_hook_template, install_mcp_template,
    install_setting_template, uninstall_mcp_template,
};
pub use statusline::{
    apply_statusline, has_previous_statusline, install_statusline_template,
    remove_settings_statusline, remove_statusline_template, restore_previous_statusline,
    update_settings_statusline, write_statusline_script,
};
pub use types::{SourceInfo, TemplateComponent, TemplatesCatalog};

use loader::{
    load_community_catalog, load_personal_statuslines, load_plugin_directory, load_single_plugin,
};
use std::collections::HashMap;
use types::PLUGIN_SOURCES;

// ============================================================================
// Main Catalog Command
// ============================================================================

#[tauri::command]
pub fn get_templates_catalog(app_handle: tauri::AppHandle) -> Result<TemplatesCatalog, String> {
    let mut all_components: Vec<TemplateComponent> = Vec::new();
    let mut source_counts: HashMap<String, usize> = HashMap::new();

    // Load from each source
    for source in PLUGIN_SOURCES {
        let components = if source.path.ends_with(".json") {
            // Community catalog (JSON file)
            load_community_catalog(Some(&app_handle), source)
        } else if source.id == "lovstudio" {
            // Single plugin directory
            load_single_plugin(Some(&app_handle), source)
        } else {
            // Multi-plugin directory
            load_plugin_directory(Some(&app_handle), source)
        };

        source_counts.insert(source.id.to_string(), components.len());
        all_components.extend(components);
    }

    // Separate by type
    let mut agents = Vec::new();
    let mut commands = Vec::new();
    let mut mcps = Vec::new();
    let mut hooks = Vec::new();
    let mut settings = Vec::new();
    let mut skills = Vec::new();
    let mut statuslines = Vec::new();

    for comp in all_components {
        match comp.component_type.as_str() {
            "agent" => agents.push(comp),
            "command" => commands.push(comp),
            "mcp" => mcps.push(comp),
            "hook" => hooks.push(comp),
            "setting" => settings.push(comp),
            "skill" => skills.push(comp),
            "statusline" => statuslines.push(comp),
            _ => {} // Ignore unknown types
        }
    }

    // Add personal/installed statuslines
    let personal_statuslines = load_personal_statuslines();
    let personal_count = personal_statuslines.len();
    statuslines.extend(personal_statuslines);

    // Build source info
    let mut sources: Vec<SourceInfo> = PLUGIN_SOURCES
        .iter()
        .map(|s| SourceInfo {
            id: s.id.to_string(),
            name: s.name.to_string(),
            icon: s.icon.to_string(),
            count: *source_counts.get(s.id).unwrap_or(&0),
        })
        .collect();

    // Add personal source if there are installed statuslines
    if personal_count > 0 {
        sources.insert(
            0,
            SourceInfo {
                id: "personal".to_string(),
                name: "Installed".to_string(),
                icon: "📦".to_string(),
                count: personal_count,
            },
        );
    }

    Ok(TemplatesCatalog {
        agents,
        commands,
        mcps,
        hooks,
        settings,
        skills,
        statuslines,
        sources,
    })
}
