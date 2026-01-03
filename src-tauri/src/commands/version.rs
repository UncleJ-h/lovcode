/**
 * [INPUT]: 依赖 std::fs, serde, serde_json, reqwest, crate::security
 * [OUTPUT]: 对外提供 get_claude_code_version_info, install_claude_code_version, set_claude_code_autoupdater 命令
 * [POS]: commands/ 模块的 Claude Code 版本管理命令中心
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use crate::security::{self, validate_version};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ClaudeCodeInstallType {
    Native,
    Npm,
    None,
}

#[derive(Debug, Serialize)]
pub struct VersionWithDownloads {
    pub version: String,
    pub downloads: u64,
}

#[derive(Debug, Serialize)]
pub struct ClaudeCodeVersionInfo {
    pub install_type: ClaudeCodeInstallType,
    pub current_version: Option<String>,
    pub available_versions: Vec<VersionWithDownloads>,
    pub autoupdater_disabled: bool,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Run a command in user's interactive login shell (to get proper PATH with nvm, etc.)
fn run_shell_command(cmd: &str) -> std::io::Result<std::process::Output> {
    // Use user's default shell from $SHELL, fallback to /bin/zsh (macOS default)
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    std::process::Command::new(&shell)
        .args(["-ilc", cmd]) // -i for interactive (loads .zshrc), -l for login, -c for command
        .output()
}

/// Detect Claude Code installation type
fn detect_claude_code_install_type() -> (ClaudeCodeInstallType, Option<String>) {
    // Try running `claude --version` first (works for both Native and NPM)
    if let Ok(output) = run_shell_command("claude --version 2>/dev/null") {
        if output.status.success() {
            let version_str = String::from_utf8_lossy(&output.stdout);
            // Parse version from output like "2.0.76 (Claude Code)" - take first token
            let version = version_str
                .trim()
                .split_whitespace()
                .next()
                .map(|s| s.to_string());

            // Determine install type by checking the actual path of claude binary
            if let Ok(which_output) = run_shell_command("which claude 2>/dev/null") {
                if which_output.status.success() {
                    let claude_path = String::from_utf8_lossy(&which_output.stdout);
                    let claude_path = claude_path.trim();

                    // NPM install: path contains node_modules, .nvm, or npm
                    if claude_path.contains("node_modules")
                        || claude_path.contains(".nvm")
                        || claude_path.contains("/npm/")
                    {
                        return (ClaudeCodeInstallType::Npm, version);
                    }

                    // Native install: path is ~/.local/bin/claude or contains .claude-code
                    if claude_path.contains(".local/bin/claude")
                        || claude_path.contains(".claude-code")
                    {
                        return (ClaudeCodeInstallType::Native, version);
                    }
                }
            }

            // Fallback: check npm list
            if let Ok(npm_output) = run_shell_command("npm list -g @anthropic-ai/claude-code --depth=0 2>/dev/null") {
                if npm_output.status.success() {
                    let stdout = String::from_utf8_lossy(&npm_output.stdout);
                    if stdout.contains("@anthropic-ai/claude-code") {
                        return (ClaudeCodeInstallType::Npm, version);
                    }
                }
            }

            // Claude exists but can't determine type, assume Native (newer default)
            return (ClaudeCodeInstallType::Native, version);
        }
    }

    (ClaudeCodeInstallType::None, None)
}

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
pub async fn get_claude_code_version_info() -> Result<ClaudeCodeVersionInfo, String> {
    // Detect installation type and current version
    let (install_type, current_version) = tauri::async_runtime::spawn_blocking(detect_claude_code_install_type)
        .await
        .map_err(|e| e.to_string())?;

    // Fetch available versions from npm registry API (no local npm needed)
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    // Get versions list from npm registry
    let versions: Vec<String> = match client
        .get("https://registry.npmjs.org/@anthropic-ai/claude-code")
        .send()
        .await
    {
        Ok(resp) => resp
            .json::<serde_json::Value>()
            .await
            .ok()
            .and_then(|json| {
                json.get("versions")?.as_object().map(|obj| {
                    let mut versions: Vec<String> = obj.keys().cloned().collect();
                    // Sort by semver (simple string sort works for most cases)
                    versions.sort_by(|a, b| {
                        let parse = |s: &str| -> Vec<u32> {
                            s.split('.').filter_map(|p| p.parse().ok()).collect()
                        };
                        parse(b).cmp(&parse(a))
                    });
                    versions.into_iter().take(20).collect()
                })
            })
            .unwrap_or_default(),
        Err(_) => vec![],
    };

    // Fetch download counts from npm API
    let downloads_map: HashMap<String, u64> = match client
        .get("https://api.npmjs.org/versions/@anthropic-ai%2Fclaude-code/last-week")
        .send()
        .await
    {
        Ok(resp) => resp
            .json::<serde_json::Value>()
            .await
            .ok()
            .and_then(|json| {
                json.get("downloads")?.as_object().map(|obj| {
                    obj.iter()
                        .filter_map(|(k, v)| Some((k.clone(), v.as_u64()?)))
                        .collect()
                })
            })
            .unwrap_or_default(),
        Err(_) => HashMap::new(),
    };

    // Combine versions with download counts
    let available_versions: Vec<VersionWithDownloads> = versions
        .into_iter()
        .map(|v| {
            let downloads = downloads_map.get(&v).copied().unwrap_or(0);
            VersionWithDownloads { version: v, downloads }
        })
        .collect();

    // Check autoupdater setting
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");
    let autoupdater_disabled = fs::read_to_string(&settings_path)
        .ok()
        .and_then(|content| {
            let json: serde_json::Value = serde_json::from_str(&content).ok()?;
            json.get("env")?
                .get("DISABLE_AUTOUPDATER")?
                .as_str()
                .map(|s| s == "true" || s == "1")
        })
        .unwrap_or(false);

    Ok(ClaudeCodeVersionInfo {
        install_type,
        current_version,
        available_versions,
        autoupdater_disabled,
    })
}

#[tauri::command]
pub async fn install_claude_code_version(version: String, install_type: Option<String>) -> Result<String, String> {
    // ========================================================================
    // 安全验证: 防止命令注入
    // ========================================================================
    validate_version(&version).map_err(|e| e.to_string())?;

    let is_specific_version = version != "latest";
    let install_type_str = install_type.unwrap_or_else(|| "native".to_string());

    // 验证 install_type 只能是允许的值
    if install_type_str != "native" && install_type_str != "npm" {
        return Err(format!("无效的安装类型: {}", install_type_str));
    }

    let result = tauri::async_runtime::spawn_blocking(move || {
        let cmd = if install_type_str == "npm" {
            // NPM installation (--force to overwrite existing native install)
            // version 已经通过 validate_version 验证，安全
            let package = if version == "latest" {
                "@anthropic-ai/claude-code@latest".to_string()
            } else {
                format!("@anthropic-ai/claude-code@{}", version)
            };
            format!("npm install -g --force {}", package)
        } else {
            // Native installation (default)
            // version 已经通过 validate_version 验证，安全
            let version_arg = if version == "latest" { "".to_string() } else { version };
            format!("curl -fsSL https://claude.ai/install.sh | bash -s {}", version_arg)
        };

        // Use user's interactive login shell to get proper PATH (nvm, etc.)
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let output = std::process::Command::new(&shell)
            .args(["-ilc", &cmd])
            .output()
            .map_err(|e| format!("Failed to run install command: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    // Auto-disable autoupdater when installing a specific version
    if is_specific_version {
        let _ = set_claude_code_autoupdater(true); // true = disabled
    }

    Ok(result)
}

#[tauri::command]
pub fn set_claude_code_autoupdater(disabled: bool) -> Result<(), String> {
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");

    // Read existing settings or create empty object
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure env object exists
    if !settings.get("env").is_some() {
        settings["env"] = serde_json::json!({});
    }

    // Set DISABLE_AUTOUPDATER
    settings["env"]["DISABLE_AUTOUPDATER"] = serde_json::Value::String(
        if disabled { "true".to_string() } else { "false".to_string() }
    );

    // Write back (atomic)
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    security::atomic_write_string(&settings_path, &content).map_err(|e| e.to_string())?;

    Ok(())
}
