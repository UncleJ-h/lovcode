/**
 * [INPUT]: 依赖 std::fs, serde_json, crate::security
 * [OUTPUT]: 对外提供 install_command_template, install_mcp_template, uninstall_mcp_template, check_mcp_installed, install_hook_template, install_setting_template 命令
 * [POS]: marketplace/ 模块的安装/卸载命令
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use crate::security;
use std::fs;

// ============================================================================
// Command Templates
// ============================================================================

#[tauri::command]
pub fn install_command_template(name: String, content: String) -> Result<String, String> {
    let commands_dir = security::get_claude_dir_or_fallback().join("commands");
    fs::create_dir_all(&commands_dir).map_err(|e| e.to_string())?;

    let file_path = commands_dir.join(format!("{}.md", name));
    fs::write(&file_path, content).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

// ============================================================================
// MCP Templates
// ============================================================================

#[tauri::command]
pub fn install_mcp_template(name: String, config: String) -> Result<String, String> {
    // MCP servers are stored in ~/.claude.json (not ~/.claude/settings.json)
    let claude_json_path = security::get_claude_json_path_or_fallback();

    // Parse the MCP config
    let mcp_config: serde_json::Value =
        serde_json::from_str(&config).map_err(|e| e.to_string())?;

    // Helper to check if a value looks like an actual MCP server config
    // (has type, url, or command field)
    fn is_server_config(v: &serde_json::Value) -> bool {
        v.get("type").is_some() || v.get("url").is_some() || v.get("command").is_some()
    }

    // Recursively extract the actual server config, unwrapping any nesting
    fn extract_server_config(v: serde_json::Value) -> serde_json::Value {
        // If it's already a valid config, return it
        if is_server_config(&v) {
            return v;
        }

        // Try to unwrap {"mcpServers": {...}}
        if let Some(mcp_servers) = v.get("mcpServers").and_then(|x| x.as_object()) {
            if let Some(inner) = mcp_servers.values().next() {
                return extract_server_config(inner.clone());
            }
        }

        // Try to unwrap {"someName": {config}}
        if let Some(obj) = v.as_object() {
            if obj.len() == 1 {
                if let Some(inner) = obj.values().next() {
                    if is_server_config(inner) || inner.is_object() {
                        return extract_server_config(inner.clone());
                    }
                }
            }
        }

        v
    }

    let server_config = extract_server_config(mcp_config);

    // Read existing ~/.claude.json or create new
    let mut claude_json: serde_json::Value = if claude_json_path.exists() {
        let content = fs::read_to_string(&claude_json_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure mcpServers exists
    if claude_json.get("mcpServers").is_none() {
        claude_json["mcpServers"] = serde_json::json!({});
    }

    // Ensure the server config has a 'type' field (required by Claude Code)
    // Infer type from the config if not present:
    // - If has "url" field -> "http" (or "sse" if url contains /sse)
    // - If has "command" field -> "stdio"
    let mut server_config = server_config;
    if server_config.get("type").is_none() {
        if let Some(url) = server_config.get("url").and_then(|v| v.as_str()) {
            // Check if it's an SSE endpoint
            let transport_type = if url.ends_with("/sse") || url.contains("/sse/") {
                "sse"
            } else {
                "http"
            };
            server_config["type"] = serde_json::json!(transport_type);
        } else if server_config.get("command").is_some() {
            server_config["type"] = serde_json::json!("stdio");
        }
    }

    // Add the MCP server with the extracted config
    claude_json["mcpServers"][&name] = server_config;

    // Write back
    let output = serde_json::to_string_pretty(&claude_json).map_err(|e| e.to_string())?;
    fs::write(&claude_json_path, output).map_err(|e| e.to_string())?;

    Ok(format!("Installed MCP: {}", name))
}

#[tauri::command]
pub fn uninstall_mcp_template(name: String) -> Result<String, String> {
    let claude_json_path = security::get_claude_json_path_or_fallback();

    if !claude_json_path.exists() {
        return Err("No MCP configuration found".to_string());
    }

    let content = fs::read_to_string(&claude_json_path).map_err(|e| e.to_string())?;
    let mut claude_json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(mcp_servers) = claude_json
        .get_mut("mcpServers")
        .and_then(|v| v.as_object_mut())
    {
        if mcp_servers.remove(&name).is_none() {
            return Err(format!("MCP '{}' not found", name));
        }
    } else {
        return Err("No mcpServers found".to_string());
    }

    let output = serde_json::to_string_pretty(&claude_json).map_err(|e| e.to_string())?;
    fs::write(&claude_json_path, output).map_err(|e| e.to_string())?;

    Ok(format!("Uninstalled MCP: {}", name))
}

#[tauri::command]
pub fn check_mcp_installed(name: String) -> bool {
    let claude_json_path = security::get_claude_json_path_or_fallback();

    if !claude_json_path.exists() {
        return false;
    }

    let Ok(content) = fs::read_to_string(&claude_json_path) else {
        return false;
    };

    let Ok(claude_json) = serde_json::from_str::<serde_json::Value>(&content) else {
        return false;
    };

    claude_json
        .get("mcpServers")
        .and_then(|v| v.as_object())
        .map(|servers| servers.contains_key(&name))
        .unwrap_or(false)
}

// ============================================================================
// Hook Templates
// ============================================================================

#[tauri::command]
pub fn install_hook_template(name: String, config: String) -> Result<String, String> {
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");

    // Parse the hook config (should be an object with event type as key)
    let hook_config: serde_json::Value =
        serde_json::from_str(&config).map_err(|e| e.to_string())?;

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure hooks exists
    if settings.get("hooks").is_none() {
        settings["hooks"] = serde_json::json!({});
    }

    // Merge hook config - hooks are typically structured as {"PreToolUse": [...], "PostToolUse": [...]}
    if let Some(hook_obj) = hook_config.as_object() {
        for (event_type, handlers) in hook_obj {
            if let Some(handlers_arr) = handlers.as_array() {
                // Get existing handlers for this event type
                let existing = settings["hooks"]
                    .get(event_type)
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();

                // Merge (append new handlers)
                let mut merged: Vec<serde_json::Value> = existing;
                merged.extend(handlers_arr.clone());
                settings["hooks"][event_type] = serde_json::Value::Array(merged);
            }
        }
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    Ok(format!("Installed hook: {}", name))
}

// ============================================================================
// Setting Templates
// ============================================================================

#[tauri::command]
pub fn install_setting_template(config: String) -> Result<String, String> {
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");

    // Parse the setting config
    let new_settings: serde_json::Value =
        serde_json::from_str(&config).map_err(|e| e.to_string())?;

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Deep merge the new settings
    if let (Some(existing_obj), Some(new_obj)) =
        (settings.as_object_mut(), new_settings.as_object())
    {
        for (key, value) in new_obj {
            existing_obj.insert(key.clone(), value.clone());
        }
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    Ok("Settings updated".to_string())
}
