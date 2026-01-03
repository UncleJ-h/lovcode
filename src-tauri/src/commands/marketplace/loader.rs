/**
 * [INPUT]: 依赖 std::fs, std::path, serde_json, tauri, crate::security, super::types
 * [OUTPUT]: 对外提供 resolve_source_path, load_community_catalog, load_plugin_directory, load_single_plugin, load_personal_statuslines
 * [POS]: marketplace/ 模块的模板加载逻辑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use super::types::{PluginMetadata, PluginSource, TemplateComponent};
use crate::security;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// ============================================================================
// Path Resolution
// ============================================================================

/// Resolve source path (handles both bundled and development paths)
pub fn resolve_source_path(
    app_handle: Option<&tauri::AppHandle>,
    relative_path: &str,
) -> Option<PathBuf> {
    // In production: try bundled resources first
    if let Some(handle) = app_handle {
        if let Ok(resource_path) = handle.path().resource_dir() {
            // Tauri maps "../" to "_up_/" in the resource bundle
            let bundled_path = relative_path.replace("../", "_up_/");
            let bundled = resource_path.join("_up_").join(&bundled_path);
            if bundled.exists() {
                return Some(bundled);
            }
        }
    }

    // In development: try from current dir and parent
    let candidates = [
        std::env::current_dir().ok(),
        std::env::current_dir()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf())),
    ];

    for candidate in candidates.into_iter().flatten() {
        let path = candidate.join(relative_path);
        if path.exists() {
            return Some(path);
        }
    }

    None
}

// ============================================================================
// Community Catalog Loading
// ============================================================================

/// Load community catalog from JSON file (claude-code-templates)
pub fn load_community_catalog(
    app_handle: Option<&tauri::AppHandle>,
    source: &PluginSource,
) -> Vec<TemplateComponent> {
    let Some(path) = resolve_source_path(app_handle, source.path) else {
        return Vec::new();
    };

    let Ok(content) = fs::read_to_string(&path) else {
        return Vec::new();
    };

    let Ok(raw): Result<serde_json::Value, _> = serde_json::from_str(&content) else {
        return Vec::new();
    };

    let mut components = Vec::new();

    // Load each component type and add source info
    for (key, comp_type) in [
        ("agents", "agent"),
        ("commands", "command"),
        ("mcps", "mcp"),
        ("hooks", "hook"),
        ("settings", "setting"),
        ("skills", "skill"),
    ] {
        if let Some(items) = raw.get(key) {
            if let Ok(mut parsed) = serde_json::from_value::<Vec<TemplateComponent>>(items.clone())
            {
                for comp in &mut parsed {
                    comp.source_id = Some(source.id.to_string());
                    comp.source_name = Some(source.name.to_string());
                    comp.source_icon = Some(source.icon.to_string());
                    if comp.component_type.is_empty() {
                        comp.component_type = comp_type.to_string();
                    }
                }
                components.extend(parsed);
            }
        }
    }

    components
}

// ============================================================================
// Skill Frontmatter Parsing
// ============================================================================

/// Parse SKILL.md frontmatter to extract metadata
pub fn parse_skill_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    if !content.starts_with("---") {
        return (None, None);
    }

    let parts: Vec<&str> = content.splitn(3, "---").collect();
    if parts.len() < 3 {
        return (None, None);
    }

    let frontmatter = parts[1];
    let mut name = None;
    let mut description = None;

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("name:") {
            name = Some(val.trim().to_string());
        } else if let Some(val) = line.strip_prefix("description:") {
            description = Some(val.trim().to_string());
        }
    }

    (name, description)
}

// ============================================================================
// Plugin Directory Loading
// ============================================================================

/// Load plugins from a directory structure (claude-plugins-official style)
pub fn load_plugin_directory(
    app_handle: Option<&tauri::AppHandle>,
    source: &PluginSource,
) -> Vec<TemplateComponent> {
    let Some(base_path) = resolve_source_path(app_handle, source.path) else {
        return Vec::new();
    };

    let mut components = Vec::new();

    // Scan both plugins/ and external_plugins/ directories
    for subdir in ["plugins", "external_plugins"] {
        let dir = base_path.join(subdir);
        if !dir.exists() {
            continue;
        }

        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };

        for entry in entries.filter_map(|e| e.ok()) {
            let plugin_dir = entry.path();
            if !plugin_dir.is_dir() {
                continue;
            }

            // Read plugin metadata
            let plugin_json = plugin_dir.join(".claude-plugin/plugin.json");
            let metadata: Option<PluginMetadata> = fs::read_to_string(&plugin_json)
                .ok()
                .and_then(|c| serde_json::from_str(&c).ok());

            let plugin_name = metadata
                .as_ref()
                .map(|m| m.name.clone())
                .unwrap_or_else(|| {
                    plugin_dir
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string()
                });

            let plugin_desc = metadata.as_ref().and_then(|m| m.description.clone());
            let author = metadata
                .as_ref()
                .and_then(|m| m.author.as_ref().map(|a| a.name.clone()));

            // Scan commands/
            scan_commands_dir(&plugin_dir, source, &plugin_name, &plugin_desc, &author, &mut components);

            // Scan skills/
            scan_skills_dir(&plugin_dir, source, &plugin_name, &plugin_desc, &author, &mut components);

            // Scan agents/
            scan_agents_dir(&plugin_dir, source, &plugin_name, &plugin_desc, &author, &mut components);

            // Check for .mcp.json
            let mcp_json = plugin_dir.join(".mcp.json");
            if mcp_json.exists() {
                let content = fs::read_to_string(&mcp_json).ok();
                components.push(TemplateComponent {
                    name: plugin_name.clone(),
                    path: mcp_json.to_string_lossy().to_string(),
                    category: plugin_name.clone(),
                    component_type: "mcp".to_string(),
                    description: plugin_desc.clone(),
                    downloads: None,
                    content,
                    source_id: Some(source.id.to_string()),
                    source_name: Some(source.name.to_string()),
                    source_icon: Some(source.icon.to_string()),
                    plugin_name: Some(plugin_name.clone()),
                    author: author.clone(),
                });
            }
        }
    }

    components
}

// ============================================================================
// Directory Scanning Helpers
// ============================================================================

fn scan_commands_dir(
    plugin_dir: &PathBuf,
    source: &PluginSource,
    plugin_name: &str,
    plugin_desc: &Option<String>,
    author: &Option<String>,
    components: &mut Vec<TemplateComponent>,
) {
    let commands_dir = plugin_dir.join("commands");
    if !commands_dir.exists() {
        return;
    }

    let Ok(cmd_entries) = fs::read_dir(&commands_dir) else {
        return;
    };

    for cmd_entry in cmd_entries.filter_map(|e| e.ok()) {
        let cmd_path = cmd_entry.path();
        if cmd_path.extension().map_or(false, |e| e == "md") {
            let name = cmd_path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let content = fs::read_to_string(&cmd_path).ok();

            components.push(TemplateComponent {
                name: name.clone(),
                path: cmd_path.to_string_lossy().to_string(),
                category: plugin_name.to_string(),
                component_type: "command".to_string(),
                description: plugin_desc.clone(),
                downloads: None,
                content,
                source_id: Some(source.id.to_string()),
                source_name: Some(source.name.to_string()),
                source_icon: Some(source.icon.to_string()),
                plugin_name: Some(plugin_name.to_string()),
                author: author.clone(),
            });
        }
    }
}

fn scan_skills_dir(
    plugin_dir: &PathBuf,
    source: &PluginSource,
    plugin_name: &str,
    plugin_desc: &Option<String>,
    author: &Option<String>,
    components: &mut Vec<TemplateComponent>,
) {
    let skills_dir = plugin_dir.join("skills");
    if !skills_dir.exists() {
        return;
    }

    let Ok(skill_entries) = fs::read_dir(&skills_dir) else {
        return;
    };

    for skill_entry in skill_entries.filter_map(|e| e.ok()) {
        let skill_path = skill_entry.path();
        if skill_path.is_dir() {
            let skill_md = skill_path.join("SKILL.md");
            if skill_md.exists() {
                let name = skill_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let content = fs::read_to_string(&skill_md).ok();
                let (parsed_name, parsed_desc) = content
                    .as_ref()
                    .map(|c| parse_skill_frontmatter(c))
                    .unwrap_or((None, None));

                components.push(TemplateComponent {
                    name: parsed_name.unwrap_or(name.clone()),
                    path: skill_md.to_string_lossy().to_string(),
                    category: plugin_name.to_string(),
                    component_type: "skill".to_string(),
                    description: parsed_desc.or_else(|| plugin_desc.clone()),
                    downloads: None,
                    content,
                    source_id: Some(source.id.to_string()),
                    source_name: Some(source.name.to_string()),
                    source_icon: Some(source.icon.to_string()),
                    plugin_name: Some(plugin_name.to_string()),
                    author: author.clone(),
                });
            }
        }
    }
}

fn scan_agents_dir(
    plugin_dir: &PathBuf,
    source: &PluginSource,
    plugin_name: &str,
    plugin_desc: &Option<String>,
    author: &Option<String>,
    components: &mut Vec<TemplateComponent>,
) {
    let agents_dir = plugin_dir.join("agents");
    if !agents_dir.exists() {
        return;
    }

    let Ok(agent_entries) = fs::read_dir(&agents_dir) else {
        return;
    };

    for agent_entry in agent_entries.filter_map(|e| e.ok()) {
        let agent_path = agent_entry.path();
        if agent_path.extension().map_or(false, |e| e == "md") {
            let name = agent_path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let content = fs::read_to_string(&agent_path).ok();

            components.push(TemplateComponent {
                name: name.clone(),
                path: agent_path.to_string_lossy().to_string(),
                category: plugin_name.to_string(),
                component_type: "agent".to_string(),
                description: plugin_desc.clone(),
                downloads: None,
                content,
                source_id: Some(source.id.to_string()),
                source_name: Some(source.name.to_string()),
                source_icon: Some(source.icon.to_string()),
                plugin_name: Some(plugin_name.to_string()),
                author: author.clone(),
            });
        }
    }
}

// ============================================================================
// Single Plugin Loading
// ============================================================================

/// Load a single plugin (lovstudio-plugins-official style)
pub fn load_single_plugin(
    app_handle: Option<&tauri::AppHandle>,
    source: &PluginSource,
) -> Vec<TemplateComponent> {
    let Some(base_path) = resolve_source_path(app_handle, source.path) else {
        return Vec::new();
    };

    let mut components = Vec::new();

    // Read plugin metadata
    let plugin_json = base_path.join(".claude-plugin/plugin.json");
    let metadata: Option<PluginMetadata> = fs::read_to_string(&plugin_json)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok());

    let plugin_name = metadata
        .as_ref()
        .map(|m| m.name.clone())
        .unwrap_or_else(|| source.id.to_string());

    let plugin_desc = metadata.as_ref().and_then(|m| m.description.clone());
    let author = metadata
        .as_ref()
        .and_then(|m| m.author.as_ref().map(|a| a.name.clone()));

    // Scan skills/
    let skills_dir = base_path.join("skills");
    if skills_dir.exists() {
        if let Ok(skill_entries) = fs::read_dir(&skills_dir) {
            for skill_entry in skill_entries.filter_map(|e| e.ok()) {
                let skill_path = skill_entry.path();
                if skill_path.is_dir() {
                    let skill_md = skill_path.join("SKILL.md");
                    if skill_md.exists() {
                        let name = skill_path
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        let content = fs::read_to_string(&skill_md).ok();
                        let (parsed_name, parsed_desc) = content
                            .as_ref()
                            .map(|c| parse_skill_frontmatter(c))
                            .unwrap_or((None, None));

                        components.push(TemplateComponent {
                            name: parsed_name.unwrap_or_else(|| format!("{}:{}", plugin_name, name)),
                            path: skill_md.to_string_lossy().to_string(),
                            category: plugin_name.clone(),
                            component_type: "skill".to_string(),
                            description: parsed_desc.or_else(|| plugin_desc.clone()),
                            downloads: None,
                            content,
                            source_id: Some(source.id.to_string()),
                            source_name: Some(source.name.to_string()),
                            source_icon: Some(source.icon.to_string()),
                            plugin_name: Some(plugin_name.clone()),
                            author: author.clone(),
                        });
                    }
                }
            }
        }
    }

    // Scan commands/
    let commands_dir = base_path.join("commands");
    if commands_dir.exists() {
        if let Ok(cmd_entries) = fs::read_dir(&commands_dir) {
            for cmd_entry in cmd_entries.filter_map(|e| e.ok()) {
                let cmd_path = cmd_entry.path();
                if cmd_path.extension().map_or(false, |e| e == "md") {
                    let name = cmd_path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let content = fs::read_to_string(&cmd_path).ok();

                    components.push(TemplateComponent {
                        name: name.clone(),
                        path: cmd_path.to_string_lossy().to_string(),
                        category: plugin_name.clone(),
                        component_type: "command".to_string(),
                        description: plugin_desc.clone(),
                        downloads: None,
                        content,
                        source_id: Some(source.id.to_string()),
                        source_name: Some(source.name.to_string()),
                        source_icon: Some(source.icon.to_string()),
                        plugin_name: Some(plugin_name.clone()),
                        author: author.clone(),
                    });
                }
            }
        }
    }

    // Scan hooks/ (read hooks.json if exists)
    let hooks_json = base_path.join("hooks/hooks.json");
    if hooks_json.exists() {
        let content = fs::read_to_string(&hooks_json).ok();
        components.push(TemplateComponent {
            name: format!("{}-hooks", plugin_name),
            path: hooks_json.to_string_lossy().to_string(),
            category: plugin_name.clone(),
            component_type: "hook".to_string(),
            description: Some("Automation hooks configuration".to_string()),
            downloads: None,
            content,
            source_id: Some(source.id.to_string()),
            source_name: Some(source.name.to_string()),
            source_icon: Some(source.icon.to_string()),
            plugin_name: Some(plugin_name.clone()),
            author: author.clone(),
        });
    }

    // Scan statuslines/ (.sh files)
    let statuslines_dir = base_path.join("statuslines");
    if statuslines_dir.exists() {
        if let Ok(entries) = fs::read_dir(&statuslines_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.extension().map_or(false, |e| e == "sh") {
                    let name = path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let content = fs::read_to_string(&path).ok();

                    // Parse description from script header comment
                    let description = content.as_ref().and_then(|c| {
                        c.lines()
                            .find(|l| l.starts_with("# Description:"))
                            .map(|l| l.trim_start_matches("# Description:").trim().to_string())
                    });

                    components.push(TemplateComponent {
                        name: name.clone(),
                        path: path.to_string_lossy().to_string(),
                        category: plugin_name.clone(),
                        component_type: "statusline".to_string(),
                        description,
                        downloads: None,
                        content,
                        source_id: Some(source.id.to_string()),
                        source_name: Some(source.name.to_string()),
                        source_icon: Some(source.icon.to_string()),
                        plugin_name: Some(plugin_name.clone()),
                        author: author.clone(),
                    });
                }
            }
        }
    }

    components
}

// ============================================================================
// Personal Statuslines
// ============================================================================

/// Load personal/installed statuslines from ~/.lovstudio/lovcode/statusline/
pub fn load_personal_statuslines() -> Vec<TemplateComponent> {
    let statusline_dir = security::get_lovstudio_dir_or_fallback().join("statusline");
    let mut components = Vec::new();

    if !statusline_dir.exists() {
        return components;
    }

    if let Ok(entries) = fs::read_dir(&statusline_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "sh") {
                let name = path.file_stem().unwrap_or_default().to_string_lossy();

                // Skip backup files (starting with _)
                if name.starts_with('_') {
                    continue;
                }

                let name = name.to_string();
                let content = fs::read_to_string(&path).ok();

                // Parse description from script header comment
                let description = content.as_ref().and_then(|c| {
                    c.lines()
                        .find(|l| l.starts_with("# Description:"))
                        .map(|l| l.trim_start_matches("# Description:").trim().to_string())
                });

                components.push(TemplateComponent {
                    name: name.clone(),
                    path: path.to_string_lossy().to_string(),
                    category: "personal".to_string(),
                    component_type: "statusline".to_string(),
                    description,
                    downloads: None,
                    content,
                    source_id: Some("personal".to_string()),
                    source_name: Some("Installed".to_string()),
                    source_icon: Some("📦".to_string()),
                    plugin_name: None,
                    author: None,
                });
            }
        }
    }

    components
}
