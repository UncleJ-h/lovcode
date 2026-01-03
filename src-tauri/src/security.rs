/**
 * [INPUT]: 依赖 std::path, regex
 * [OUTPUT]: 对外提供 validate_path, validate_version, safe_home_dir
 * [POS]: src-tauri/src 的安全验证核心，防止路径遍历和命令注入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use crate::errors::{AppError, AppResult};
use regex::Regex;
use std::path::PathBuf;
use std::sync::LazyLock;

// ============================================================================
// 版本格式验证 (防止命令注入)
// ============================================================================

/// 验证版本字符串格式
/// 只允许: "latest" 或 semver 格式 (1.2.3, 1.2.3-beta.1, etc.)
static VERSION_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(latest|(\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?))$")
        .expect("VERSION_PATTERN regex should compile")
});

pub fn validate_version(version: &str) -> AppResult<()> {
    if VERSION_PATTERN.is_match(version) {
        Ok(())
    } else {
        Err(AppError::InvalidVersion {
            version: version.to_string(),
        })
    }
}

// ============================================================================
// 路径安全验证 (防止路径遍历)
// ============================================================================

/// 安全获取用户主目录
pub fn safe_home_dir() -> AppResult<PathBuf> {
    dirs::home_dir().ok_or(AppError::HomeDirNotFound)
}

/// 获取 Claude 配置目录 (~/.claude)
pub fn get_claude_dir() -> AppResult<PathBuf> {
    Ok(safe_home_dir()?.join(".claude"))
}

/// 获取 Claude 配置目录，失败时回退到当前目录 (便捷版本)
/// 适用于不需要严格错误处理的场景
pub fn get_claude_dir_or_fallback() -> PathBuf {
    get_claude_dir().unwrap_or_else(|_| PathBuf::from("./.claude"))
}

/// 获取 Claude JSON 配置路径 (~/.claude.json)
pub fn get_claude_json_path() -> AppResult<PathBuf> {
    Ok(safe_home_dir()?.join(".claude.json"))
}

/// 获取 Claude JSON 配置路径，失败时回退 (便捷版本)
pub fn get_claude_json_path_or_fallback() -> PathBuf {
    get_claude_json_path().unwrap_or_else(|_| PathBuf::from("./.claude.json"))
}

/// 获取 Lovstudio 数据目录 (~/.lovstudio/lovcode)
pub fn get_lovstudio_dir() -> AppResult<PathBuf> {
    Ok(safe_home_dir()?.join(".lovstudio").join("lovcode"))
}

/// 获取 Lovstudio 数据目录，失败时回退 (便捷版本)
pub fn get_lovstudio_dir_or_fallback() -> PathBuf {
    get_lovstudio_dir().unwrap_or_else(|_| PathBuf::from("./.lovstudio/lovcode"))
}

/// 验证解码后的路径不包含路径遍历攻击
///
/// # 安全检查
/// 1. 不允许 ".." 路径组件
/// 2. 路径必须是绝对路径
/// 3. 规范化后不能逃逸到危险目录
pub fn validate_decoded_path(path: &str) -> AppResult<String> {
    // 检查 1: 不允许 ".."
    if path.contains("..") {
        return Err(AppError::PathTraversal {
            reason: "路径包含 '..' 组件".to_string(),
        });
    }

    // 检查 2: 必须是绝对路径
    if !path.starts_with('/') {
        return Err(AppError::PathTraversal {
            reason: "路径必须是绝对路径".to_string(),
        });
    }

    // 检查 3: 不允许访问敏感系统目录
    let forbidden_prefixes = [
        "/etc",
        "/var",
        "/usr",
        "/bin",
        "/sbin",
        "/System",
        "/Library",
        "/private",
    ];

    for prefix in &forbidden_prefixes {
        if path.starts_with(prefix) {
            return Err(AppError::PathTraversal {
                reason: format!("不允许访问系统目录: {}", prefix),
            });
        }
    }

    // 检查 4: 路径应该在用户目录下或常见开发目录
    let home = safe_home_dir()?;
    let home_str = home.to_string_lossy();

    let allowed_prefixes = [
        home_str.as_ref(),
        "/Users",
        "/home",
        "/tmp",
        "/projects",
        "/repos",
    ];

    let is_allowed = allowed_prefixes.iter().any(|prefix| path.starts_with(prefix));

    if !is_allowed {
        return Err(AppError::PathTraversal {
            reason: format!("路径不在允许的目录范围内: {}", path),
        });
    }

    Ok(path.to_string())
}

// ============================================================================
// Shell 命令安全 (防止命令注入)
// ============================================================================

/// Shell 转义字符串，防止命令注入
/// 使用单引号包裹，并转义内部的单引号
///
/// # 安全原理
/// 在 bash/zsh 中，单引号内的所有字符都是字面量（除了单引号本身）
/// 所以我们把 ' 替换为 '\'' (结束单引号、转义单引号、重新开始单引号)
///
/// # 示例
/// "hello" -> 'hello'
/// "it's" -> 'it'\''s'
/// "$(rm -rf /)" -> '$(rm -rf /)'  (不会执行)
pub fn shell_escape(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// 验证并转义 shell 命令的工作目录
/// 结合路径验证和 shell 转义，提供双重保护
pub fn validate_and_escape_cwd(cwd: &str) -> AppResult<String> {
    // 先验证路径安全性
    validate_decoded_path(cwd)?;
    // 再进行 shell 转义
    Ok(shell_escape(cwd))
}

// ============================================================================
// 原子化文件操作 (防止数据损坏)
// ============================================================================

use std::fs;
use std::io::Write;

/// 原子化写入文件
/// 先写入临时文件，再通过 rename 替换目标文件
/// 这样即使写入过程中崩溃，也不会损坏原文件
///
/// # 安全原理
/// 1. 写入同目录下的临时文件 (确保同一文件系统)
/// 2. 使用 fsync 确保数据落盘
/// 3. 使用 rename 原子替换 (POSIX 保证原子性)
pub fn atomic_write(path: &PathBuf, content: &[u8]) -> AppResult<()> {
    use std::time::{SystemTime, UNIX_EPOCH};

    // 生成临时文件名 (同目录以确保同一文件系统)
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);

    let tmp_name = format!(
        ".{}.{}.tmp",
        path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file"),
        timestamp
    );

    let tmp_path = path.parent().map(|p| p.join(&tmp_name)).unwrap_or_else(|| {
        PathBuf::from(&tmp_name)
    });

    // 写入临时文件
    let mut file = fs::File::create(&tmp_path).map_err(|e| AppError::FileWrite {
        path: tmp_path.to_string_lossy().to_string(),
        reason: e.to_string(),
    })?;

    file.write_all(content).map_err(|e| AppError::FileWrite {
        path: tmp_path.to_string_lossy().to_string(),
        reason: e.to_string(),
    })?;

    // 同步到磁盘
    file.sync_all().map_err(|e| AppError::FileWrite {
        path: tmp_path.to_string_lossy().to_string(),
        reason: format!("fsync failed: {}", e),
    })?;

    // 原子替换
    fs::rename(&tmp_path, path).map_err(|e| AppError::FileWrite {
        path: path.to_string_lossy().to_string(),
        reason: format!("atomic rename failed: {}", e),
    })?;

    Ok(())
}

/// 原子化写入字符串文件
pub fn atomic_write_string(path: &PathBuf, content: &str) -> AppResult<()> {
    atomic_write(path, content.as_bytes())
}

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_version_latest() {
        assert!(validate_version("latest").is_ok());
    }

    #[test]
    fn test_validate_version_semver() {
        assert!(validate_version("1.0.0").is_ok());
        assert!(validate_version("1.2.3").is_ok());
        assert!(validate_version("10.20.30").is_ok());
        assert!(validate_version("1.2.3-beta.1").is_ok());
        assert!(validate_version("1.2.3-alpha").is_ok());
    }

    #[test]
    fn test_validate_version_invalid() {
        // 命令注入尝试
        assert!(validate_version("1.0.0; rm -rf /").is_err());
        assert!(validate_version("$(whoami)").is_err());
        assert!(validate_version("`id`").is_err());
        assert!(validate_version("1.0.0 && echo pwned").is_err());

        // 格式错误
        assert!(validate_version("abc").is_err());
        assert!(validate_version("1.2").is_err());
        assert!(validate_version("").is_err());
    }

    #[test]
    fn test_validate_path_traversal() {
        // 路径遍历攻击
        assert!(validate_decoded_path("/Users/test/../../../etc/passwd").is_err());
        assert!(validate_decoded_path("..").is_err());
        assert!(validate_decoded_path("/Users/test/..").is_err());
    }

    #[test]
    fn test_validate_path_system_dirs() {
        // 系统目录
        assert!(validate_decoded_path("/etc/passwd").is_err());
        assert!(validate_decoded_path("/var/log/system.log").is_err());
        assert!(validate_decoded_path("/usr/bin/bash").is_err());
    }

    #[test]
    fn test_validate_path_relative() {
        // 相对路径
        assert!(validate_decoded_path("relative/path").is_err());
        assert!(validate_decoded_path("./current").is_err());
    }

    #[test]
    fn test_validate_path_allowed() {
        // 允许的路径
        assert!(validate_decoded_path("/Users/test/projects/app").is_ok());
        assert!(validate_decoded_path("/home/user/code").is_ok());
        assert!(validate_decoded_path("/tmp/test").is_ok());
    }

    #[test]
    fn test_shell_escape_basic() {
        // 基础字符串
        assert_eq!(shell_escape("hello"), "'hello'");
        assert_eq!(shell_escape("hello world"), "'hello world'");
    }

    #[test]
    fn test_shell_escape_quotes() {
        // 包含单引号
        assert_eq!(shell_escape("it's"), "'it'\\''s'");
        assert_eq!(shell_escape("'quoted'"), "''\\''quoted'\\'''");
    }

    #[test]
    fn test_shell_escape_injection() {
        // 命令注入尝试 - 这些都应该被转义为字面量
        let escaped = shell_escape("'; rm -rf / #");
        assert!(escaped.starts_with('\''));
        assert!(escaped.ends_with('\''));
        // 转义后应该不包含未转义的单引号

        let escaped2 = shell_escape("$(whoami)");
        assert_eq!(escaped2, "'$(whoami)'");

        let escaped3 = shell_escape("`id`");
        assert_eq!(escaped3, "'`id`'");
    }

    #[test]
    fn test_shell_escape_special_chars() {
        // 特殊字符应该被保护
        assert_eq!(shell_escape("$HOME"), "'$HOME'");
        assert_eq!(shell_escape("foo && bar"), "'foo && bar'");
        assert_eq!(shell_escape("foo | bar"), "'foo | bar'");
        assert_eq!(shell_escape("foo; bar"), "'foo; bar'");
    }

    // ========================================================================
    // 路径辅助函数测试
    // ========================================================================

    #[test]
    fn test_safe_home_dir() {
        // 应该能获取到用户主目录
        let result = safe_home_dir();
        assert!(result.is_ok());
        let home = result.unwrap();
        assert!(home.is_absolute());
    }

    #[test]
    fn test_get_claude_dir() {
        let result = get_claude_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.ends_with(".claude"));
    }

    #[test]
    fn test_get_claude_dir_or_fallback() {
        let path = get_claude_dir_or_fallback();
        // 应该包含 .claude
        assert!(path.to_string_lossy().contains(".claude"));
    }

    #[test]
    fn test_get_claude_json_path() {
        let result = get_claude_json_path();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.to_string_lossy().ends_with(".claude.json"));
    }

    #[test]
    fn test_get_lovstudio_dir() {
        let result = get_lovstudio_dir();
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains(".lovstudio"));
        assert!(path.to_string_lossy().contains("lovcode"));
    }

    #[test]
    fn test_validate_and_escape_cwd_valid() {
        // 有效路径应该通过验证并被转义
        let result = validate_and_escape_cwd("/Users/test/project");
        assert!(result.is_ok());
        let escaped = result.unwrap();
        assert!(escaped.starts_with('\''));
        assert!(escaped.ends_with('\''));
    }

    #[test]
    fn test_validate_and_escape_cwd_invalid() {
        // 无效路径应该失败
        assert!(validate_and_escape_cwd("../etc/passwd").is_err());
        assert!(validate_and_escape_cwd("/etc/passwd").is_err());
    }

    // ========================================================================
    // 原子写入测试
    // ========================================================================

    #[test]
    fn test_atomic_write_creates_file() {
        use std::fs;

        // 创建临时目录
        let temp_dir = std::env::temp_dir().join("lovcode_test_atomic");
        let _ = fs::create_dir_all(&temp_dir);

        let test_file = temp_dir.join("test_atomic_write.txt");
        let content = "Hello, atomic world!";

        // 确保文件不存在
        let _ = fs::remove_file(&test_file);

        // 执行原子写入
        let result = atomic_write_string(&test_file, content);
        assert!(result.is_ok(), "atomic_write_string should succeed");

        // 验证文件内容
        let read_content = fs::read_to_string(&test_file).unwrap();
        assert_eq!(read_content, content);

        // 清理
        let _ = fs::remove_file(&test_file);
        let _ = fs::remove_dir(&temp_dir);
    }

    #[test]
    fn test_atomic_write_overwrites_existing() {
        use std::fs;

        let temp_dir = std::env::temp_dir().join("lovcode_test_atomic2");
        let _ = fs::create_dir_all(&temp_dir);

        let test_file = temp_dir.join("test_atomic_overwrite.txt");

        // 创建初始文件
        fs::write(&test_file, "original content").unwrap();

        // 原子覆盖
        let new_content = "new content";
        let result = atomic_write_string(&test_file, new_content);
        assert!(result.is_ok());

        // 验证新内容
        let read_content = fs::read_to_string(&test_file).unwrap();
        assert_eq!(read_content, new_content);

        // 清理
        let _ = fs::remove_file(&test_file);
        let _ = fs::remove_dir(&temp_dir);
    }

    #[test]
    fn test_atomic_write_binary() {
        use std::fs;

        let temp_dir = std::env::temp_dir().join("lovcode_test_atomic3");
        let _ = fs::create_dir_all(&temp_dir);

        let test_file = temp_dir.join("test_atomic_binary.bin");
        let binary_content: Vec<u8> = vec![0x00, 0x01, 0x02, 0xFF, 0xFE];

        let result = atomic_write(&test_file, &binary_content);
        assert!(result.is_ok());

        let read_content = fs::read(&test_file).unwrap();
        assert_eq!(read_content, binary_content);

        // 清理
        let _ = fs::remove_file(&test_file);
        let _ = fs::remove_dir(&temp_dir);
    }

    #[test]
    fn test_atomic_write_no_temp_file_left() {
        use std::fs;

        let temp_dir = std::env::temp_dir().join("lovcode_test_atomic4");
        let _ = fs::create_dir_all(&temp_dir);

        let test_file = temp_dir.join("test_no_temp.txt");

        // 写入文件
        let _ = atomic_write_string(&test_file, "content");

        // 检查目录中没有 .tmp 文件残留
        let entries: Vec<_> = fs::read_dir(&temp_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();

        assert!(entries.is_empty(), "No .tmp files should remain");

        // 清理
        let _ = fs::remove_file(&test_file);
        let _ = fs::remove_dir(&temp_dir);
    }

    // ========================================================================
    // 边界情况测试
    // ========================================================================

    #[test]
    fn test_shell_escape_empty_string() {
        assert_eq!(shell_escape(""), "''");
    }

    #[test]
    fn test_shell_escape_unicode() {
        // Unicode 字符应该被保护
        assert_eq!(shell_escape("你好世界"), "'你好世界'");
        assert_eq!(shell_escape("émoji 🎉"), "'émoji 🎉'");
    }

    #[test]
    fn test_validate_path_unicode() {
        // 包含 Unicode 的有效路径
        let result = validate_decoded_path("/Users/测试用户/项目");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_version_edge_cases() {
        // 边界版本号
        assert!(validate_version("0.0.0").is_ok());
        assert!(validate_version("999.999.999").is_ok());
        assert!(validate_version("1.2.3-rc.1.2.3").is_ok());

        // 无效边界
        assert!(validate_version("1.2.3.4").is_err()); // 四段版本号
        assert!(validate_version("v1.2.3").is_err());  // v 前缀
        assert!(validate_version("1.2.3-").is_err());  // 悬空连字符
    }
}
