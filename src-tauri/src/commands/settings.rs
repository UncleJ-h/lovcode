/**
 * [INPUT]: 依赖 std::fs, std::time::Duration, serde, serde_json, reqwest, arboard, crate::security, crate::types
 * [OUTPUT]: 对外提供 get_settings, update_mcp_env, update_settings_env, delete_settings_env, disable_settings_env, enable_settings_env, test_anthropic_connection, test_openai_connection, test_claude_cli 等命令
 * [POS]: commands/ 模块的设置管理命令中心
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use crate::commands::read_session_head;
use crate::security;
use crate::types::{ClaudeSettings, McpServer};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;

// ============================================================================
// Path Helper Functions
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
    fs::write(&path, output).map_err(|e| e.to_string())?;
    Ok(())
}

fn get_session_path(project_id: &str, session_id: &str) -> PathBuf {
    security::get_claude_dir_or_fallback()
        .join("projects")
        .join(project_id)
        .join(format!("{}.jsonl", session_id))
}

// ============================================================================
// Settings Commands
// ============================================================================

#[tauri::command]
pub fn get_settings() -> Result<ClaudeSettings, String> {
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");
    let claude_json_path = security::get_claude_json_path_or_fallback();

    // Read ~/.claude/settings.json for permissions, hooks, etc.
    let (mut raw, permissions, hooks) = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        let raw: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        let permissions = raw.get("permissions").cloned();
        let hooks = raw.get("hooks").cloned();
        (raw, permissions, hooks)
    } else {
        (Value::Null, None, None)
    };

    // Overlay disabled env from ~/.lovstudio/lovcode (do not persist in settings.json)
    if let Ok(disabled_env) = load_disabled_env() {
        if !disabled_env.is_empty() {
            if let Some(obj) = raw.as_object_mut() {
                obj.insert(
                    "_lovcode_disabled_env".to_string(),
                    Value::Object(disabled_env),
                );
            } else {
                raw = serde_json::json!({
                    "_lovcode_disabled_env": disabled_env
                });
            }
        } else if let Some(obj) = raw.as_object_mut() {
            obj.remove("_lovcode_disabled_env");
        }
    }

    // Read ~/.claude.json for MCP servers
    let mut mcp_servers = Vec::new();
    if claude_json_path.exists() {
        if let Ok(content) = fs::read_to_string(&claude_json_path) {
            if let Ok(claude_json) = serde_json::from_str::<Value>(&content) {
                if let Some(mcp_obj) = claude_json.get("mcpServers").and_then(|v| v.as_object()) {
                    for (name, config) in mcp_obj {
                        if let Some(obj) = config.as_object() {
                            // Handle nested mcpServers format (from some installers)
                            let actual_config = if let Some(nested) =
                                obj.get("mcpServers").and_then(|v| v.as_object())
                            {
                                nested.values().next().and_then(|v| v.as_object())
                            } else {
                                Some(obj)
                            };

                            if let Some(cfg) = actual_config {
                                let description = cfg
                                    .get("description")
                                    .and_then(|v| v.as_str())
                                    .map(String::from);
                                let server_type = cfg
                                    .get("type")
                                    .and_then(|v| v.as_str())
                                    .map(String::from);
                                let url = cfg
                                    .get("url")
                                    .and_then(|v| v.as_str())
                                    .map(String::from);
                                let command = cfg
                                    .get("command")
                                    .and_then(|v| v.as_str())
                                    .map(String::from);
                                let args: Vec<String> = cfg
                                    .get("args")
                                    .and_then(|v| v.as_array())
                                    .map(|arr| {
                                        arr.iter()
                                            .filter_map(|v| v.as_str().map(String::from))
                                            .collect()
                                    })
                                    .unwrap_or_default();
                                let env: HashMap<String, String> = cfg
                                    .get("env")
                                    .and_then(|v| v.as_object())
                                    .map(|m| {
                                        m.iter()
                                            .filter_map(|(k, v)| {
                                                v.as_str().map(|s| (k.clone(), s.to_string()))
                                            })
                                            .collect()
                                    })
                                    .unwrap_or_default();

                                mcp_servers.push(McpServer {
                                    name: name.clone(),
                                    description,
                                    server_type,
                                    url,
                                    command,
                                    args,
                                    env,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(ClaudeSettings {
        raw,
        permissions,
        hooks,
        mcp_servers,
    })
}

// ============================================================================
// Session Commands
// ============================================================================

#[tauri::command]
pub fn open_session_in_editor(project_id: String, session_id: String) -> Result<(), String> {
    let path = get_session_path(&project_id, &session_id);
    if !path.exists() {
        return Err("Session file not found".to_string());
    }
    open_in_editor(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_session_file_path(project_id: String, session_id: String) -> Result<String, String> {
    let path = get_session_path(&project_id, &session_id);
    if !path.exists() {
        return Err("Session file not found".to_string());
    }
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_session_summary(project_id: String, session_id: String) -> Result<Option<String>, String> {
    let path = get_session_path(&project_id, &session_id);
    if !path.exists() {
        return Err("Session file not found".to_string());
    }
    let (summary, _) = read_session_head(&path, 20);
    Ok(summary)
}

#[tauri::command]
pub fn reveal_session_file(project_id: String, session_id: String) -> Result<(), String> {
    let session_path = get_session_path(&project_id, &session_id);

    if !session_path.exists() {
        return Err("Session file not found".to_string());
    }

    let path = session_path.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(session_path.parent().unwrap_or(&session_path))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ============================================================================
// Clipboard Commands
// ============================================================================

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())
}

// ============================================================================
// File/Path Commands
// ============================================================================

#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    let expanded = if path.starts_with("~") {
        let home = dirs::home_dir().ok_or("Cannot get home dir")?;
        home.join(&path[2..])
    } else {
        std::path::PathBuf::from(&path)
    };

    if !expanded.exists() {
        return Err(format!("Path not found: {}", path));
    }

    let path_str = expanded.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path_str])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path_str])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(expanded.parent().unwrap_or(&expanded))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    let expanded = if path.starts_with("~") {
        let home = dirs::home_dir().ok_or("Cannot get home dir")?;
        home.join(&path[2..])
    } else {
        std::path::PathBuf::from(&path)
    };

    if !expanded.exists() {
        return Err(format!("Path not found: {}", path));
    }

    let path_str = expanded.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path_str])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_in_editor(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_file_at_line(path: String, line: usize) -> Result<(), String> {
    // 尝试用 cursor，失败则用 code (VSCode)
    let editors = ["cursor", "code", "zed"];

    for editor in editors {
        let result = std::process::Command::new(editor)
            .arg("--goto")
            .arg(format!("{}:{}", path, line))
            .spawn();

        if result.is_ok() {
            return Ok(());
        }
    }

    // 都失败则用系统默认方式打开
    open_in_editor(path)
}

#[tauri::command]
pub fn get_settings_path() -> String {
    security::get_claude_dir_or_fallback()
        .join("settings.json")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub fn get_mcp_config_path() -> String {
    security::get_claude_json_path_or_fallback().to_string_lossy().to_string()
}

#[tauri::command]
pub fn get_home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

// ============================================================================
// File Write Commands
// ============================================================================

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, data).map_err(|e| e.to_string())
}

// ============================================================================
// MCP/Env Commands
// ============================================================================

#[tauri::command]
pub fn update_mcp_env(server_name: String, env_key: String, env_value: String) -> Result<(), String> {
    let claude_json_path = security::get_claude_json_path_or_fallback();

    let mut claude_json: serde_json::Value = if claude_json_path.exists() {
        let content = fs::read_to_string(&claude_json_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        return Err("~/.claude.json not found".to_string());
    };

    let server = claude_json
        .get_mut("mcpServers")
        .and_then(|s| s.get_mut(&server_name))
        .ok_or_else(|| format!("MCP server '{}' not found", server_name))?;

    if !server.get("env").is_some() {
        server["env"] = serde_json::json!({});
    }
    server["env"][&env_key] = serde_json::Value::String(env_value);

    let output = serde_json::to_string_pretty(&claude_json).map_err(|e| e.to_string())?;
    fs::write(&claude_json_path, output).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_settings_env(
    env_key: String,
    env_value: String,
    is_new: Option<bool>,
) -> Result<(), String> {
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    if !settings.get("env").and_then(|v| v.as_object()).is_some() {
        settings["env"] = serde_json::json!({});
    }
    settings["env"][&env_key] = serde_json::Value::String(env_value);

    // Track custom env keys when is_new=true
    if is_new == Some(true) {
        let custom_keys = settings
            .get("_lovcode_custom_env_keys")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        let key_val = serde_json::Value::String(env_key.clone());
        if !custom_keys.contains(&key_val) {
            let mut new_keys = custom_keys;
            new_keys.push(key_val);
            settings["_lovcode_custom_env_keys"] = serde_json::Value::Array(new_keys);
        }
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_lovcode_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_settings_env(env_key: String) -> Result<(), String> {
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    if let Some(env) = settings.get_mut("env").and_then(|v| v.as_object_mut()) {
        env.remove(&env_key);
    }

    // Also remove from custom keys list
    if let Some(custom_keys) = settings
        .get_mut("_lovcode_custom_env_keys")
        .and_then(|v| v.as_array_mut())
    {
        custom_keys.retain(|v| v.as_str() != Some(&env_key));
    }

    // Also remove from disabled env if present
    if let Some(disabled) = settings
        .get_mut("_lovcode_disabled_env")
        .and_then(|v| v.as_object_mut())
    {
        disabled.remove(&env_key);
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_lovcode_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    let mut disabled_env = load_disabled_env()?;
    disabled_env.remove(&env_key);
    save_disabled_env(&disabled_env)?;

    Ok(())
}

#[tauri::command]
pub fn disable_settings_env(env_key: String) -> Result<(), String> {
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");
    if !settings_path.exists() {
        return Ok(());
    }
    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let mut settings: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Get current value before removing
    let current_value = settings
        .get("env")
        .and_then(|v| v.get(&env_key))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Remove from active env
    if let Some(env) = settings.get_mut("env").and_then(|v| v.as_object_mut()) {
        env.remove(&env_key);
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_lovcode_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    let mut disabled_env = load_disabled_env()?;
    disabled_env.insert(env_key, serde_json::Value::String(current_value));
    save_disabled_env(&disabled_env)?;

    Ok(())
}

#[tauri::command]
pub fn enable_settings_env(env_key: String) -> Result<(), String> {
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    // Get value from disabled env
    let mut disabled_env = load_disabled_env()?;
    let disabled_value = disabled_env
        .get(&env_key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    disabled_env.remove(&env_key);
    save_disabled_env(&disabled_env)?;

    // Add back to active env
    if !settings.get("env").and_then(|v| v.as_object()).is_some() {
        settings["env"] = serde_json::json!({});
    }
    settings["env"][&env_key] = serde_json::Value::String(disabled_value);

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_lovcode_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_disabled_settings_env(env_key: String, env_value: String) -> Result<(), String> {
    let mut disabled_env = load_disabled_env()?;
    disabled_env.insert(env_key, serde_json::Value::String(env_value));
    save_disabled_env(&disabled_env)?;

    Ok(())
}

// ============================================================================
// Connection Test Commands
// ============================================================================

#[derive(Serialize)]
pub struct ConnectionTestResult {
    ok: bool,
    status: u16,
    body: String,
}

#[tauri::command]
pub async fn test_anthropic_connection(
    base_url: String,
    auth_token: String,
    model: String,
) -> Result<ConnectionTestResult, String> {
    if auth_token.trim().is_empty() {
        return Err("ANTHROPIC_AUTH_TOKEN is empty".to_string());
    }

    let base = base_url.trim_end_matches('/');
    let url = format!("{}/v1/messages", base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;
    let payload = serde_json::json!({
        "model": model,
        "max_tokens": 1,
        "messages": [
            { "role": "user", "content": "ping" }
        ]
    });

    tracing::debug!(
        url = %url,
        "Anthropic connection test request"
    );

    let response = client
        .post(&url)
        .header("x-api-key", auth_token)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    tracing::debug!(
        status = %status,
        body_len = body.len(),
        "Anthropic connection test response"
    );

    Ok(ConnectionTestResult {
        ok: status.is_success(),
        status: status.as_u16(),
        body,
    })
}

#[tauri::command]
pub async fn test_openai_connection(
    base_url: String,
    api_key: String,
) -> Result<ConnectionTestResult, String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty".to_string());
    }

    let base = base_url.trim_end_matches('/');
    let url = format!("{}/models", base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    Ok(ConnectionTestResult {
        ok: status.is_success(),
        status: status.as_u16(),
        body,
    })
}

#[derive(Serialize)]
pub struct ClaudeCliTestResult {
    ok: bool,
    code: i32,
    stdout: String,
    stderr: String,
}

/// Timeout for Claude CLI test (15 seconds)
const CLI_TEST_TIMEOUT_SECS: u64 = 15;

#[tauri::command]
pub async fn test_claude_cli(
    base_url: String,
    auth_token: String,
) -> Result<ClaudeCliTestResult, String> {
    use tokio::time::timeout;

    if auth_token.trim().is_empty() {
        return Err("ANTHROPIC_AUTH_TOKEN is empty".to_string());
    }

    let output = timeout(
        Duration::from_secs(CLI_TEST_TIMEOUT_SECS),
        tokio::process::Command::new("claude")
            .arg("--print")
            .arg("reply 1")
            .env("ANTHROPIC_BASE_URL", &base_url)
            .env("ANTHROPIC_AUTH_TOKEN", &auth_token)
            .output(),
    )
    .await
    .map_err(|_| format!("Claude CLI test timed out after {} seconds", CLI_TEST_TIMEOUT_SECS))?
    .map_err(|e| format!("Failed to execute claude CLI: {}", e))?;

    let code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    tracing::debug!(
        exit_code = code,
        stdout_len = stdout.len(),
        stderr_len = stderr.len(),
        "Claude CLI test result"
    );

    Ok(ClaudeCliTestResult {
        ok: output.status.success(),
        code,
        stdout,
        stderr,
    })
}
