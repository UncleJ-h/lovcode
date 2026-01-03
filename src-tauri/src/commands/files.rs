/**
 * [INPUT]: 依赖 std::fs, std::path, base64, serde, crate::security
 * [OUTPUT]: 对外提供 read_file, read_file_base64, list_directory, get_file_metadata, copy_file_to_project_assets 等命令
 * [POS]: commands/ 模块的文件操作命令中心
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use crate::security;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(Debug, Serialize)]
pub struct FileMetadata {
    pub size: u64,
    pub modified: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogoVersion {
    pub path: String,
    pub filename: String,
    pub created_at: u64,
    pub is_current: bool,
}

// ============================================================================
// File Reading Commands
// ============================================================================

/// Read file contents as string
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    if !file_path.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Read file as base64
#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let data = fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(STANDARD.encode(&data))
}

/// Get file metadata (size, modified time)
#[tauri::command]
pub fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let metadata =
        fs::metadata(&file_path).map_err(|e| format!("Failed to get metadata: {}", e))?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    Ok(FileMetadata {
        size: metadata.len(),
        modified,
    })
}

// ============================================================================
// Directory Listing
// ============================================================================

/// List directory contents (non-recursive, respects .gitignore patterns)
#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    if !dir_path.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    // Common patterns to ignore
    let ignore_patterns = [
        ".git",
        "node_modules",
        ".DS_Store",
        "target",
        "dist",
        "build",
        ".next",
        ".nuxt",
        ".output",
        "__pycache__",
        ".pytest_cache",
        ".venv",
        "venv",
        ".idea",
        ".vscode",
        "*.pyc",
        ".turbo",
    ];

    let mut entries: Vec<DirEntry> = Vec::new();

    let read_dir =
        fs::read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip ignored patterns
        if ignore_patterns.iter().any(|p| {
            if p.starts_with("*.") {
                name.ends_with(&p[1..])
            } else {
                name == *p
            }
        }) {
            continue;
        }

        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);

        entries.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

// ============================================================================
// Project Assets Management
// ============================================================================

/// Helper to get current logo path
fn get_current_logo_path(project: &PathBuf) -> Option<String> {
    let logo_paths = [
        "assets/logo.svg",
        "assets/logo.png",
        "assets/icon.svg",
        "assets/icon.png",
    ];

    for rel_path in logo_paths {
        let full_path = project.join(rel_path);
        if full_path.exists() {
            return Some(full_path.to_string_lossy().to_string());
        }
    }
    None
}

/// Find project logo from common locations and return as base64 data URL
#[tauri::command]
pub fn get_project_logo(project_path: String) -> Option<String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let logo_paths = [
        "assets/logo.svg",
        "assets/logo.png",
        "assets/icon.svg",
        "assets/icon.png",
        "public/logo.svg",
        "public/logo.png",
        "logo.svg",
        "logo.png",
        "icon.svg",
        "icon.png",
    ];

    let project = PathBuf::from(&project_path);

    for rel_path in logo_paths {
        let full_path = project.join(rel_path);
        if full_path.exists() {
            if let Ok(data) = fs::read(&full_path) {
                let mime = if rel_path.ends_with(".svg") {
                    "image/svg+xml"
                } else if rel_path.ends_with(".png") {
                    "image/png"
                } else {
                    "application/octet-stream"
                };
                let b64 = STANDARD.encode(&data);
                return Some(format!("data:{};base64,{}", mime, b64));
            }
        }
    }

    None
}

/// List all logo versions in project assets directory
#[tauri::command]
pub fn list_project_logos(project_path: String) -> Vec<LogoVersion> {
    let project = PathBuf::from(&project_path);
    let assets_dir = project.join("assets");

    let mut versions = Vec::new();

    // Get current logo path for comparison
    let current_logo = get_current_logo_path(&project);

    // Scan assets directory for logo files
    if let Ok(entries) = fs::read_dir(&assets_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                // Match logo-*.png, logo.png, logo.svg patterns
                if (filename.starts_with("logo") || filename.starts_with("icon"))
                    && (filename.ends_with(".png")
                        || filename.ends_with(".svg")
                        || filename.ends_with(".jpg"))
                {
                    let created_at = entry
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    let path_str = path.to_string_lossy().to_string();
                    let is_current = current_logo
                        .as_ref()
                        .map(|c| c == &path_str)
                        .unwrap_or(false);

                    versions.push(LogoVersion {
                        path: path_str,
                        filename: filename.to_string(),
                        created_at,
                        is_current,
                    });
                }
            }
        }
    }

    // Sort by created_at descending (newest first)
    versions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    versions
}

/// Save base64 logo data to project assets
#[tauri::command]
pub fn save_project_logo(
    project_path: String,
    base64_data: String,
    filename: String,
) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let project = PathBuf::from(&project_path);
    let assets_dir = project.join("assets");

    // Ensure assets directory exists
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;

    // Decode base64
    let data = STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Save versioned file (atomic)
    let versioned_path = assets_dir.join(&filename);
    security::atomic_write(&versioned_path, &data)
        .map_err(|e| format!("Failed to write logo: {}", e))?;

    // Also save as logo.png (current)
    let ext = filename.rsplit('.').next().unwrap_or("png");
    let current_path = assets_dir.join(format!("logo.{}", ext));
    security::atomic_write(&current_path, &data)
        .map_err(|e| format!("Failed to write current logo: {}", e))?;

    Ok(versioned_path.to_string_lossy().to_string())
}

/// Copy external file to project assets as logo
#[tauri::command]
pub fn copy_file_to_project_assets(
    source_path: String,
    project_path: String,
    target_filename: String,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    let project = PathBuf::from(&project_path);
    let assets_dir = project.join("assets");

    // Ensure assets directory exists
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;

    // Copy to target filename
    let target_path = assets_dir.join(&target_filename);
    fs::copy(&source, &target_path).map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

/// Set a specific logo version as current
#[tauri::command]
pub fn set_current_project_logo(project_path: String, logo_path: String) -> Result<(), String> {
    let project = PathBuf::from(&project_path);
    let assets_dir = project.join("assets");
    let source = PathBuf::from(&logo_path);

    if !source.exists() {
        return Err("Logo file does not exist".to_string());
    }

    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");

    // Copy as current logo
    let current_path = assets_dir.join(format!("logo.{}", ext));
    fs::copy(&source, &current_path).map_err(|e| format!("Failed to set current logo: {}", e))?;

    Ok(())
}

/// Delete a logo version
#[tauri::command]
pub fn delete_project_logo(_project_path: String, logo_path: String) -> Result<(), String> {
    let path = PathBuf::from(&logo_path);

    if !path.exists() {
        return Ok(());
    }

    // Don't allow deleting the current logo (logo.png/logo.svg)
    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
        if filename == "logo.png" || filename == "logo.svg" {
            return Err(
                "Cannot delete current logo. Set another version as current first.".to_string(),
            );
        }
    }

    fs::remove_file(&path).map_err(|e| format!("Failed to delete logo: {}", e))?;

    Ok(())
}

// ============================================================================
// Shell Command Execution
// ============================================================================

/// Default timeout for shell commands (30 seconds)
const SHELL_COMMAND_TIMEOUT_SECS: u64 = 30;

/// Run a shell command in specified directory using login shell (async, non-blocking)
///
/// # Security
/// - cwd 参数经过路径验证，防止路径遍历攻击
/// - cwd 参数经过 shell 转义，防止命令注入
/// - 使用固定的 shell 路径，避免 $SHELL 环境变量劫持
/// - 命令执行有 30 秒超时，防止无限挂起
#[tauri::command]
pub async fn exec_shell_command(command: String, cwd: String) -> Result<String, String> {
    use std::time::Duration;
    use tokio::process::Command;
    use tokio::time::timeout;

    // 安全验证：验证路径并转义 shell 特殊字符
    let escaped_cwd = security::validate_and_escape_cwd(&cwd)
        .map_err(|e| format!("Invalid working directory: {}", e))?;

    // 使用固定的 shell 路径，避免环境变量劫持
    // macOS 默认使用 zsh，Linux 使用 bash
    #[cfg(target_os = "macos")]
    let shell = "/bin/zsh";
    #[cfg(not(target_os = "macos"))]
    let shell = "/bin/bash";

    // 使用超时机制，防止命令无限挂起
    let output = timeout(
        Duration::from_secs(SHELL_COMMAND_TIMEOUT_SECS),
        Command::new(shell)
            .args(["-ilc", &format!("cd {} && {}", escaped_cwd, command)])
            .output(),
    )
    .await
    .map_err(|_| {
        format!(
            "Command timed out after {} seconds",
            SHELL_COMMAND_TIMEOUT_SECS
        )
    })?
    .map_err(|e| format!("Failed to run command: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // ------------------------------------------------------------------------
    // read_file tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_read_file_success() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "Hello, World!").expect("Failed to write file");

        let result = read_file(file_path.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Hello, World!");
    }

    #[test]
    fn test_read_file_not_exists() {
        let result = read_file("/nonexistent/path/to/file.txt".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_read_file_is_directory() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let result = read_file(temp_dir.path().to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Not a file"));
    }

    #[test]
    fn test_read_file_utf8_content() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join("chinese.txt");
        fs::write(&file_path, "你好世界！🚀").expect("Failed to write file");

        let result = read_file(file_path.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "你好世界！🚀");
    }

    // ------------------------------------------------------------------------
    // read_file_base64 tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_read_file_base64_success() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join("test.bin");
        fs::write(&file_path, &[0x48, 0x65, 0x6c, 0x6c, 0x6f]).expect("Failed to write file");

        let result = read_file_base64(file_path.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "SGVsbG8="); // "Hello" in base64
    }

    #[test]
    fn test_read_file_base64_not_exists() {
        let result = read_file_base64("/nonexistent/file.bin".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    // ------------------------------------------------------------------------
    // get_file_metadata tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_get_file_metadata_success() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "Hello").expect("Failed to write file");

        let result = get_file_metadata(file_path.to_string_lossy().to_string());
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.size, 5);
        assert!(metadata.modified.is_some());
    }

    #[test]
    fn test_get_file_metadata_not_exists() {
        let result = get_file_metadata("/nonexistent/file.txt".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    // ------------------------------------------------------------------------
    // list_directory tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_list_directory_success() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        fs::write(temp_dir.path().join("file1.txt"), "").expect("Failed to write");
        fs::write(temp_dir.path().join("file2.txt"), "").expect("Failed to write");
        fs::create_dir(temp_dir.path().join("subdir")).expect("Failed to create dir");

        let result = list_directory(temp_dir.path().to_string_lossy().to_string());
        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 3);
        // Directories should come first
        assert!(entries[0].is_dir);
        assert_eq!(entries[0].name, "subdir");
    }

    #[test]
    fn test_list_directory_ignores_node_modules() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        fs::write(temp_dir.path().join("index.js"), "").expect("Failed to write");
        fs::create_dir(temp_dir.path().join("node_modules")).expect("Failed to create dir");

        let result = list_directory(temp_dir.path().to_string_lossy().to_string());
        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "index.js");
    }

    #[test]
    fn test_list_directory_ignores_git() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        fs::write(temp_dir.path().join("README.md"), "").expect("Failed to write");
        fs::create_dir(temp_dir.path().join(".git")).expect("Failed to create dir");

        let result = list_directory(temp_dir.path().to_string_lossy().to_string());
        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "README.md");
    }

    #[test]
    fn test_list_directory_not_exists() {
        let result = list_directory("/nonexistent/directory".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_list_directory_is_file() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "").expect("Failed to write");

        let result = list_directory(file_path.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Not a directory"));
    }

    // ------------------------------------------------------------------------
    // save_project_logo tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_save_project_logo_creates_assets_dir() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let project_path = temp_dir.path().to_string_lossy().to_string();

        // Base64 of "test" (dGVzdA==)
        let result = save_project_logo(
            project_path.clone(),
            "dGVzdA==".to_string(),
            "logo-v1.png".to_string(),
        );

        assert!(result.is_ok());
        assert!(temp_dir.path().join("assets").exists());
        assert!(temp_dir.path().join("assets/logo-v1.png").exists());
        assert!(temp_dir.path().join("assets/logo.png").exists());
    }

    #[test]
    fn test_save_project_logo_invalid_base64() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let project_path = temp_dir.path().to_string_lossy().to_string();

        let result = save_project_logo(
            project_path,
            "invalid!!!base64".to_string(),
            "logo.png".to_string(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("decode base64"));
    }

    // ------------------------------------------------------------------------
    // get_project_logo tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_get_project_logo_not_found() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let result = get_project_logo(temp_dir.path().to_string_lossy().to_string());
        assert!(result.is_none());
    }

    #[test]
    fn test_get_project_logo_found() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let assets_dir = temp_dir.path().join("assets");
        fs::create_dir_all(&assets_dir).expect("Failed to create assets dir");
        fs::write(assets_dir.join("logo.png"), &[0x89, 0x50, 0x4E, 0x47]).expect("Failed to write");

        let result = get_project_logo(temp_dir.path().to_string_lossy().to_string());
        assert!(result.is_some());
        let data_url = result.unwrap();
        assert!(data_url.starts_with("data:image/png;base64,"));
    }

    // ------------------------------------------------------------------------
    // delete_project_logo tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_delete_project_logo_versioned() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let assets_dir = temp_dir.path().join("assets");
        fs::create_dir_all(&assets_dir).expect("Failed to create assets dir");
        let logo_path = assets_dir.join("logo-v1.png");
        fs::write(&logo_path, "test").expect("Failed to write");

        let result = delete_project_logo(
            temp_dir.path().to_string_lossy().to_string(),
            logo_path.to_string_lossy().to_string(),
        );
        assert!(result.is_ok());
        assert!(!logo_path.exists());
    }

    #[test]
    fn test_delete_project_logo_current_blocked() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let assets_dir = temp_dir.path().join("assets");
        fs::create_dir_all(&assets_dir).expect("Failed to create assets dir");
        let logo_path = assets_dir.join("logo.png");
        fs::write(&logo_path, "test").expect("Failed to write");

        let result = delete_project_logo(
            temp_dir.path().to_string_lossy().to_string(),
            logo_path.to_string_lossy().to_string(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Cannot delete current logo"));
    }
}
