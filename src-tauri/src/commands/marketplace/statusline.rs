/**
 * [INPUT]: 依赖 std::fs, serde_json, crate::security
 * [OUTPUT]: 对外提供 update_settings_statusline, remove_settings_statusline, write_statusline_script, install_statusline_template, apply_statusline, restore_previous_statusline, has_previous_statusline, remove_statusline_template 命令
 * [POS]: marketplace/ 模块的状态栏管理命令
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use crate::security;
use std::fs;

// ============================================================================
// Settings Statusline
// ============================================================================

#[tauri::command]
pub fn update_settings_statusline(statusline: serde_json::Value) -> Result<(), String> {
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    settings["statusLine"] = statusline;

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_settings_statusline() -> Result<(), String> {
    let settings_path = security::get_claude_dir_or_fallback().join("settings.json");
    if !settings_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let mut settings: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("statusLine");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

// ============================================================================
// Statusline Script
// ============================================================================

#[tauri::command]
pub fn write_statusline_script(content: String) -> Result<String, String> {
    let script_path = security::get_claude_dir_or_fallback().join("statusline.sh");
    fs::write(&script_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(script_path.to_string_lossy().to_string())
}

// ============================================================================
// Statusline Templates
// ============================================================================

/// Install statusline template to ~/.lovstudio/lovcode/statusline/{name}.sh
#[tauri::command]
pub fn install_statusline_template(name: String, content: String) -> Result<String, String> {
    let statusline_dir = security::get_lovstudio_dir_or_fallback().join("statusline");
    fs::create_dir_all(&statusline_dir).map_err(|e| e.to_string())?;

    let script_path = statusline_dir.join(format!("{}.sh", name));
    fs::write(&script_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(script_path.to_string_lossy().to_string())
}

/// Apply statusline: copy from ~/.lovstudio/lovcode/statusline/{name}.sh to ~/.claude/statusline.sh
/// If ~/.claude/statusline.sh exists and is not already installed, backup to ~/.lovstudio/lovcode/statusline/_previous.sh
#[tauri::command]
pub fn apply_statusline(name: String) -> Result<String, String> {
    let source_path = security::get_lovstudio_dir_or_fallback()
        .join("statusline")
        .join(format!("{}.sh", name));
    if !source_path.exists() {
        return Err(format!("Statusline template not found: {}", name));
    }

    let target_path = security::get_claude_dir_or_fallback().join("statusline.sh");
    let backup_dir = security::get_lovstudio_dir_or_fallback().join("statusline");
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    // Backup existing statusline.sh if it exists and differs from source
    if target_path.exists() {
        let existing_content = fs::read_to_string(&target_path).unwrap_or_default();
        let new_content = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;

        if existing_content != new_content {
            let backup_path = backup_dir.join("_previous.sh");
            fs::copy(&target_path, &backup_path).map_err(|e| e.to_string())?;
        }
    }

    let content = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
    fs::write(&target_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&target_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&target_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(target_path.to_string_lossy().to_string())
}

/// Restore previous statusline from backup
#[tauri::command]
pub fn restore_previous_statusline() -> Result<String, String> {
    let backup_path = security::get_lovstudio_dir_or_fallback()
        .join("statusline")
        .join("_previous.sh");
    if !backup_path.exists() {
        return Err("No previous statusline to restore".to_string());
    }

    let content = fs::read_to_string(&backup_path).map_err(|e| e.to_string())?;
    let target_path = security::get_claude_dir_or_fallback().join("statusline.sh");
    fs::write(&target_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&target_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&target_path, perms).map_err(|e| e.to_string())?;
    }

    // Remove backup after restore
    fs::remove_file(&backup_path).ok();

    Ok(target_path.to_string_lossy().to_string())
}

/// Check if previous statusline backup exists
#[tauri::command]
pub fn has_previous_statusline() -> bool {
    security::get_lovstudio_dir_or_fallback()
        .join("statusline")
        .join("_previous.sh")
        .exists()
}

/// Remove installed statusline template
#[tauri::command]
pub fn remove_statusline_template(name: String) -> Result<(), String> {
    let script_path = security::get_lovstudio_dir_or_fallback()
        .join("statusline")
        .join(format!("{}.sh", name));
    if script_path.exists() {
        fs::remove_file(&script_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
