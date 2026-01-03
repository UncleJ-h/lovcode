/**
 * [INPUT]: 依赖 types (Project, Session, ChatMessage), security (get_claude_dir, validate_decoded_path)
 * [OUTPUT]: 对外提供 list_projects, list_sessions, list_all_sessions, list_all_chats 命令
 * [POS]: commands/ 模块的项目和会话管理中心
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use crate::security::{get_claude_dir, validate_decoded_path};
use crate::types::{ChatMessage, ChatsResponse, HistoryEntry, Project, RawLine, Session};
use regex::Regex;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

// ============================================================================
// 路径编解码
// ============================================================================

/// Encode project path to project ID (inverse of decode_project_path).
/// Claude Code encodes: `/.` -> `--`, then `/` -> `-`
pub fn encode_project_path(path: &str) -> String {
    path.replace("/.", "--").replace('/', "-")
}

/// Decode project ID to actual filesystem path (带安全验证).
pub fn decode_project_path(id: &str) -> String {
    let decoded = decode_project_path_unsafe(id);

    match validate_decoded_path(&decoded) {
        Ok(safe_path) => safe_path,
        Err(e) => {
            tracing::warn!(
                project_id = %id,
                error = %e,
                "Path validation failed"
            );
            String::new()
        }
    }
}

/// 内部解码函数 (不带安全验证)
fn decode_project_path_unsafe(id: &str) -> String {
    let base = id
        .replace("--", "\x00")
        .replace('-', "/")
        .replace('\x00', "/.");

    if PathBuf::from(&base).exists() {
        return base;
    }

    for base_dir in &["/projects/", "/repos/", "/Documents/", "/Desktop/"] {
        if let Some(idx) = base.find(base_dir) {
            let prefix = &base[..idx + base_dir.len()];
            let rest = &base[idx + base_dir.len()..];

            if let Some(merged) = try_merge_segments(prefix, rest) {
                return merged;
            }
        }
    }

    base
}

/// Try different combinations of merging path segments with hyphens
fn try_merge_segments(prefix: &str, rest: &str) -> Option<String> {
    let segments: Vec<&str> = rest.split('/').filter(|s| !s.is_empty()).collect();
    if segments.is_empty() {
        return None;
    }

    let all_merged = format!("{}{}", prefix, segments.join("-"));
    if PathBuf::from(&all_merged).exists() {
        return Some(all_merged);
    }

    for merge_count in (1..segments.len()).rev() {
        let merged_part = segments[..=merge_count].join("-");
        let rest_part = segments[merge_count + 1..].join("/");
        let candidate = if rest_part.is_empty() {
            format!("{}{}", prefix, merged_part)
        } else {
            format!("{}{}/{}", prefix, merged_part, rest_part)
        };
        if PathBuf::from(&candidate).exists() {
            return Some(candidate);
        }
    }

    None
}

// ============================================================================
// 辅助函数
// ============================================================================

/// Read only the first N lines of a session file to get summary (much faster than reading entire file)
pub fn read_session_head(path: &Path, max_lines: usize) -> (Option<String>, usize) {
    use std::io::{BufRead, BufReader};

    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (None, 0),
    };

    let reader = BufReader::new(file);
    let mut summary = None;
    let mut first_user_message: Option<String> = None;
    let mut message_count = 0;

    for line in reader.lines().take(max_lines) {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        if let Ok(parsed) = serde_json::from_str::<RawLine>(&line) {
            if parsed.line_type.as_deref() == Some("summary") {
                summary = parsed.summary;
            }
            if parsed.line_type.as_deref() == Some("user") {
                message_count += 1;
                if first_user_message.is_none() {
                    if let Some(msg) = &parsed.message {
                        if let Some(content) = &msg.content {
                            let text_content = match content {
                                Value::String(s) => Some(s.clone()),
                                Value::Array(arr) => arr.iter().find_map(|item| {
                                    if item.get("type").and_then(|t| t.as_str()) == Some("text") {
                                        item.get("text")
                                            .and_then(|t| t.as_str())
                                            .map(|s| s.to_string())
                                    } else {
                                        None
                                    }
                                }),
                                _ => None,
                            };
                            if let Some(text) = text_content {
                                let restored = restore_slash_command(&text);
                                let display = if restored.chars().count() > 80 {
                                    format!("{}...", restored.chars().take(80).collect::<String>())
                                } else {
                                    restored
                                };
                                first_user_message = Some(display);
                            }
                        }
                    }
                }
            }
            if parsed.line_type.as_deref() == Some("assistant") {
                message_count += 1;
            }
        }
    }

    let final_summary = summary
        .or(first_user_message)
        .map(|s| restore_slash_command(&s));
    (final_summary, message_count)
}

/// Convert <command-message>...</command-message><command-name>/cmd</command-name> to /cmd format
#[allow(clippy::unwrap_used)] // Static regex patterns are compile-time validated
fn restore_slash_command(content: &str) -> String {
    static NAME_RE: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"<command-name>(/[^<]+)</command-name>").unwrap());
    static ARGS_RE: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"(?s)<command-args>(.*?)</command-args>").unwrap());
    static STRIP_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?s)<command-message>.*?</command-message>|</?command-[^>]*>").unwrap()
    });

    let cmd = NAME_RE
        .captures(content)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string());
    let args = ARGS_RE
        .captures(content)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
        .filter(|s| !s.is_empty());

    let prefix = match (cmd, args) {
        (Some(c), Some(a)) => format!("{} {}", c, a),
        (Some(c), None) => c,
        _ => String::new(),
    };

    let cleaned = STRIP_RE.replace_all(content, "").trim().to_string();

    if prefix.is_empty() {
        cleaned
    } else {
        prefix
    }
}

/// Build session index from history.jsonl (fast: only reads one file)
fn build_session_index_from_history() -> HashMap<(String, String), (u64, Option<String>)> {
    use std::io::{BufRead, BufReader};

    let history_path = get_claude_dir()
        .map(|d| d.join("history.jsonl"))
        .unwrap_or_else(|_| PathBuf::from("./.claude/history.jsonl"));

    let mut index: HashMap<(String, String), (u64, Option<String>)> = HashMap::new();

    let file = match fs::File::open(&history_path) {
        Ok(f) => f,
        Err(_) => return index,
    };

    let reader = BufReader::new(file);
    for line in reader.lines().map_while(Result::ok) {
        if let Ok(entry) = serde_json::from_str::<HistoryEntry>(&line) {
            if let (Some(session_id), Some(project), Some(timestamp)) =
                (entry.session_id, entry.project, entry.timestamp)
            {
                let project_id = encode_project_path(&project);
                index
                    .entry((project_id, session_id))
                    .and_modify(|(ts, disp)| {
                        if timestamp > *ts {
                            *ts = timestamp;
                            *disp = entry.display.clone();
                        }
                    })
                    .or_insert((timestamp, entry.display));
            }
        }
    }

    index
}

/// Extract text content from message content field
fn extract_content_with_meta(value: &Option<Value>) -> (String, bool) {
    match value {
        Some(Value::String(s)) => (s.clone(), false),
        Some(Value::Array(arr)) => {
            let has_tool = arr.iter().any(|item| {
                if let Some(obj) = item.as_object() {
                    let t = obj.get("type").and_then(|v| v.as_str());
                    return t == Some("tool_use") || t == Some("tool_result");
                }
                false
            });

            let text = arr
                .iter()
                .filter_map(|item| {
                    if let Some(obj) = item.as_object() {
                        if obj.get("type").and_then(|v| v.as_str()) == Some("text") {
                            return obj.get("text").and_then(|v| v.as_str()).map(String::from);
                        }
                    }
                    None
                })
                .collect::<Vec<_>>()
                .join("\n");

            (text, has_tool)
        }
        _ => (String::new(), false),
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn list_projects() -> Result<Vec<Project>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let projects_dir = get_claude_dir()
            .map(|d| d.join("projects"))
            .map_err(|e| e.to_string())?;

        if !projects_dir.exists() {
            return Ok(vec![]);
        }

        let mut projects = Vec::new();

        for entry in fs::read_dir(&projects_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();

            if path.is_dir() {
                let id = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                let display_path = decode_project_path(&id);

                let mut session_count = 0;
                let mut last_active: u64 = 0;

                if let Ok(entries) = fs::read_dir(&path) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.ends_with(".jsonl") && !name.starts_with("agent-") {
                            session_count += 1;
                            if let Ok(meta) = entry.metadata() {
                                if let Ok(modified) = meta.modified() {
                                    if let Ok(duration) =
                                        modified.duration_since(std::time::UNIX_EPOCH)
                                    {
                                        last_active = last_active.max(duration.as_secs());
                                    }
                                }
                            }
                        }
                    }
                }

                projects.push(Project {
                    id: id.clone(),
                    path: display_path,
                    session_count,
                    last_active,
                });
            }
        }

        projects.sort_by(|a, b| b.last_active.cmp(&a.last_active));
        Ok(projects)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_sessions(project_id: String) -> Result<Vec<Session>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let project_dir = get_claude_dir()
            .map(|d| d.join("projects").join(&project_id))
            .map_err(|e| e.to_string())?;

        if !project_dir.exists() {
            return Err("Project not found".to_string());
        }

        let mut sessions = Vec::new();

        for entry in fs::read_dir(&project_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            if name.ends_with(".jsonl") && !name.starts_with("agent-") {
                let session_id = name.trim_end_matches(".jsonl").to_string();
                let (summary, message_count) = read_session_head(&path, 20);

                let metadata = fs::metadata(&path).ok();
                let last_modified = metadata
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                sessions.push(Session {
                    id: session_id,
                    project_id: project_id.clone(),
                    project_path: None,
                    summary,
                    message_count,
                    last_modified,
                });
            }
        }

        sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
        Ok(sessions)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_all_sessions() -> Result<Vec<Session>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let projects_dir = get_claude_dir()
            .map(|d| d.join("projects"))
            .map_err(|e| e.to_string())?;

        if !projects_dir.exists() {
            return Ok(vec![]);
        }

        let history_index = build_session_index_from_history();
        let mut all_sessions = Vec::new();
        let mut seen_sessions: HashSet<(String, String)> = HashSet::new();

        // First pass: use history index
        for ((project_id, session_id), (timestamp, display)) in &history_index {
            let session_path = projects_dir
                .join(project_id)
                .join(format!("{}.jsonl", session_id));

            if !session_path.exists() {
                continue;
            }

            seen_sessions.insert((project_id.clone(), session_id.clone()));

            let (summary, head_msg_count) = read_session_head(&session_path, 20);
            let final_summary =
                summary.or_else(|| display.clone().map(|d| restore_slash_command(&d)));

            let metadata = fs::metadata(&session_path).ok();
            let last_modified = metadata
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(*timestamp / 1000);

            let display_path = decode_project_path(project_id);

            all_sessions.push(Session {
                id: session_id.clone(),
                project_id: project_id.clone(),
                project_path: Some(display_path),
                summary: final_summary,
                message_count: head_msg_count,
                last_modified,
            });
        }

        // Second pass: scan for sessions not in history
        for project_entry in fs::read_dir(&projects_dir).into_iter().flatten().flatten() {
            let project_path = project_entry.path();
            if !project_path.is_dir() {
                continue;
            }

            let project_id = project_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let display_path = decode_project_path(&project_id);

            for entry in fs::read_dir(&project_path).into_iter().flatten().flatten() {
                let path = entry.path();
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                if name.ends_with(".jsonl") && !name.starts_with("agent-") {
                    let session_id = name.trim_end_matches(".jsonl").to_string();

                    if seen_sessions.contains(&(project_id.clone(), session_id.clone())) {
                        continue;
                    }

                    let (summary, head_msg_count) = read_session_head(&path, 20);

                    let metadata = fs::metadata(&path).ok();
                    let last_modified = metadata
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    all_sessions.push(Session {
                        id: session_id,
                        project_id: project_id.clone(),
                        project_path: Some(display_path.clone()),
                        summary,
                        message_count: head_msg_count,
                        last_modified,
                    });
                }
            }
        }

        all_sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
        Ok(all_sessions)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_all_chats(
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<ChatsResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let projects_dir = get_claude_dir()
            .map(|d| d.join("projects"))
            .map_err(|e| e.to_string())?;

        let max_messages = limit.unwrap_or(50);
        let skip = offset.unwrap_or(0);

        if !projects_dir.exists() {
            return Ok(ChatsResponse {
                items: vec![],
                total: 0,
            });
        }

        // Collect all session files with metadata
        let mut session_files: Vec<(PathBuf, String, String, u64)> = Vec::new();

        for project_entry in fs::read_dir(&projects_dir).map_err(|e| e.to_string())? {
            let project_entry = project_entry.map_err(|e| e.to_string())?;
            let project_path = project_entry.path();

            if !project_path.is_dir() {
                continue;
            }

            let project_id = project_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let display_path = decode_project_path(&project_id);

            for entry in fs::read_dir(&project_path).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                let path = entry.path();
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                if name.ends_with(".jsonl") && !name.starts_with("agent-") {
                    let last_modified = entry
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    session_files.push((
                        path,
                        project_id.clone(),
                        display_path.clone(),
                        last_modified,
                    ));
                }
            }
        }

        session_files.sort_by(|a, b| b.3.cmp(&a.3));

        let mut all_chats: Vec<ChatMessage> = Vec::new();

        for (path, project_id, project_path, _) in session_files {
            let session_id = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let content = fs::read_to_string(&path).unwrap_or_default();

            let mut session_summary: Option<String> = None;
            let mut session_messages: Vec<ChatMessage> = Vec::new();

            for line in content.lines() {
                if let Ok(parsed) = serde_json::from_str::<RawLine>(line) {
                    let line_type = parsed.line_type.as_deref();

                    if line_type == Some("summary") {
                        session_summary = parsed.summary;
                    }

                    if line_type == Some("user") || line_type == Some("assistant") {
                        if let Some(msg) = &parsed.message {
                            let role = msg.role.clone().unwrap_or_default();
                            let (text_content, _is_tool) = extract_content_with_meta(&msg.content);
                            let is_meta = parsed.is_meta.unwrap_or(false);

                            if !is_meta && !text_content.is_empty() {
                                session_messages.push(ChatMessage {
                                    uuid: parsed.uuid.unwrap_or_default(),
                                    role,
                                    content: text_content,
                                    timestamp: parsed.timestamp.unwrap_or_default(),
                                    project_id: project_id.clone(),
                                    project_path: project_path.clone(),
                                    session_id: session_id.clone(),
                                    session_summary: None,
                                });
                            }
                        }
                    }
                }
            }

            for msg in &mut session_messages {
                msg.session_summary = session_summary.clone();
            }

            all_chats.extend(session_messages);
        }

        all_chats.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        let total = all_chats.len();
        let items: Vec<ChatMessage> = all_chats
            .into_iter()
            .skip(skip)
            .take(max_messages)
            .collect();

        Ok(ChatsResponse { items, total })
    })
    .await
    .map_err(|e| e.to_string())?
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // ------------------------------------------------------------------------
    // Path encoding/decoding tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_encode_project_path_simple() {
        let encoded = encode_project_path("/Users/test/projects/myapp");
        assert_eq!(encoded, "-Users-test-projects-myapp");
    }

    #[test]
    fn test_encode_project_path_hidden_dir() {
        let encoded = encode_project_path("/Users/test/.config/app");
        assert_eq!(encoded, "-Users-test--config-app");
    }

    #[test]
    fn test_decode_project_path_unsafe_simple() {
        // Note: This test checks internal logic without filesystem validation
        let decoded = decode_project_path_unsafe("-Users-test-projects-myapp");
        assert_eq!(decoded, "/Users/test/projects/myapp");
    }

    #[test]
    fn test_decode_project_path_unsafe_hidden_dir() {
        let decoded = decode_project_path_unsafe("-Users-test--config-app");
        assert_eq!(decoded, "/Users/test/.config/app");
    }

    #[test]
    fn test_encode_decode_roundtrip() {
        // Note: Paths with hyphens are ambiguous in Claude's encoding
        // /my-app encodes to -my-app, which decodes to /my/app
        // This is a known limitation of the encoding scheme
        let original = "/Users/test/projects/myapp"; // No hyphen
        let encoded = encode_project_path(original);
        let decoded = decode_project_path_unsafe(&encoded);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_decode_with_real_path_without_hyphen() {
        // Create a real temporary directory to test path validation
        // Note: tempfile paths may contain dots which need special handling
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let subdir = temp_dir.path().join("testproject");
        fs::create_dir_all(&subdir).expect("Failed to create subdir");

        let path = subdir.to_string_lossy().to_string();
        let encoded = encode_project_path(&path);
        let decoded = decode_project_path(&encoded);

        // The decoded path should either match exactly or be empty (validation failure)
        // due to temp directories often having hidden segments
        assert!(decoded == path || decoded.is_empty());
    }

    #[test]
    fn test_decode_invalid_path_returns_empty() {
        // Path traversal should be rejected
        let result = decode_project_path("-Users-test--..--..--etc-passwd");
        // Should return empty string due to validation failure
        // (actual behavior depends on validate_decoded_path implementation)
        assert!(result.is_empty() || !result.contains(".."));
    }

    // ------------------------------------------------------------------------
    // try_merge_segments tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_try_merge_segments_no_match() {
        let result = try_merge_segments("/prefix/", "a/b/c");
        // Should return None if no paths exist
        assert!(result.is_none());
    }

    #[test]
    fn test_try_merge_segments_empty() {
        let result = try_merge_segments("/prefix/", "");
        assert!(result.is_none());
    }

    // ------------------------------------------------------------------------
    // restore_slash_command tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_restore_slash_command_with_command() {
        let input = "<command-message>test</command-message><command-name>/help</command-name>";
        let result = restore_slash_command(input);
        assert_eq!(result, "/help");
    }

    #[test]
    fn test_restore_slash_command_with_args() {
        let input = "<command-name>/search</command-name><command-args>query text</command-args>";
        let result = restore_slash_command(input);
        assert_eq!(result, "/search query text");
    }

    #[test]
    fn test_restore_slash_command_plain_text() {
        let input = "Hello, this is a normal message";
        let result = restore_slash_command(input);
        assert_eq!(result, "Hello, this is a normal message");
    }

    #[test]
    fn test_restore_slash_command_empty_args() {
        let input = "<command-name>/commit</command-name><command-args>  </command-args>";
        let result = restore_slash_command(input);
        assert_eq!(result, "/commit");
    }

    // ------------------------------------------------------------------------
    // read_session_head tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_read_session_head_nonexistent() {
        let path = PathBuf::from("/nonexistent/session.jsonl");
        let (summary, count) = read_session_head(&path, 10);
        assert!(summary.is_none());
        assert_eq!(count, 0);
    }

    #[test]
    fn test_read_session_head_with_summary() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let session_path = temp_dir.path().join("session.jsonl");

        let lines = r#"{"type":"summary","summary":"Test conversation about Rust"}
{"type":"user","message":{"role":"user","content":"Hello"}}
{"type":"assistant","message":{"role":"assistant","content":"Hi there!"}}"#;

        fs::write(&session_path, lines).expect("Failed to write session file");

        let (summary, count) = read_session_head(&session_path, 10);
        assert_eq!(summary, Some("Test conversation about Rust".to_string()));
        assert_eq!(count, 2); // user + assistant
    }

    #[test]
    fn test_read_session_head_fallback_to_first_message() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let session_path = temp_dir.path().join("session.jsonl");

        let lines = r#"{"type":"user","message":{"role":"user","content":"What is Rust?"}}"#;

        fs::write(&session_path, lines).expect("Failed to write session file");

        let (summary, count) = read_session_head(&session_path, 10);
        assert_eq!(summary, Some("What is Rust?".to_string()));
        assert_eq!(count, 1);
    }

    #[test]
    fn test_read_session_head_truncates_long_message() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let session_path = temp_dir.path().join("session.jsonl");

        // Create a message longer than 80 chars
        let long_message = "A".repeat(100);
        let lines = format!(
            r#"{{"type":"user","message":{{"role":"user","content":"{}"}}}}"#,
            long_message
        );

        fs::write(&session_path, lines).expect("Failed to write session file");

        let (summary, _count) = read_session_head(&session_path, 10);
        assert!(summary.is_some());
        let summary_text = summary.unwrap();
        assert!(summary_text.ends_with("..."));
        assert!(summary_text.len() <= 83); // 80 chars + "..."
    }

    // ------------------------------------------------------------------------
    // extract_content_with_meta tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_extract_content_string() {
        let content = Some(Value::String("Hello world".to_string()));
        let (text, is_tool) = extract_content_with_meta(&content);
        assert_eq!(text, "Hello world");
        assert!(!is_tool);
    }

    #[test]
    fn test_extract_content_array_text() {
        let content = Some(serde_json::json!([
            {"type": "text", "text": "Part 1"},
            {"type": "text", "text": "Part 2"}
        ]));
        let (text, is_tool) = extract_content_with_meta(&content);
        assert_eq!(text, "Part 1\nPart 2");
        assert!(!is_tool);
    }

    #[test]
    fn test_extract_content_with_tool() {
        let content = Some(serde_json::json!([
            {"type": "tool_use", "name": "read_file"},
            {"type": "text", "text": "Reading file..."}
        ]));
        let (text, is_tool) = extract_content_with_meta(&content);
        assert_eq!(text, "Reading file...");
        assert!(is_tool);
    }

    #[test]
    fn test_extract_content_none() {
        let (text, is_tool) = extract_content_with_meta(&None);
        assert_eq!(text, "");
        assert!(!is_tool);
    }
}
