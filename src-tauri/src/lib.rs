use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub path: String,
    pub session_count: usize,
    pub last_active: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub project_id: String,
    pub summary: Option<String>,
    pub message_count: usize,
    pub last_modified: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub uuid: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

#[derive(Debug, Deserialize)]
struct RawLine {
    #[serde(rename = "type")]
    line_type: Option<String>,
    summary: Option<String>,
    uuid: Option<String>,
    message: Option<RawMessage>,
    timestamp: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawMessage {
    role: Option<String>,
    content: Option<serde_json::Value>,
}

fn get_claude_dir() -> PathBuf {
    dirs::home_dir().unwrap().join(".claude")
}

#[tauri::command]
fn list_projects() -> Result<Vec<Project>, String> {
    let projects_dir = get_claude_dir().join("projects");

    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();

    for entry in fs::read_dir(&projects_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            let id = path.file_name().unwrap().to_string_lossy().to_string();
            let display_path = id.replace("-", "/").replace("//", "-");

            let mut session_count = 0;
            let mut last_active: u64 = 0;

            if let Ok(entries) = fs::read_dir(&path) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.ends_with(".jsonl") && !name.starts_with("agent-") {
                        session_count += 1;
                        if let Ok(meta) = entry.metadata() {
                            if let Ok(modified) = meta.modified() {
                                if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
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
}

#[tauri::command]
fn list_sessions(project_id: String) -> Result<Vec<Session>, String> {
    let project_dir = get_claude_dir().join("projects").join(&project_id);

    if !project_dir.exists() {
        return Err("Project not found".to_string());
    }

    let mut sessions = Vec::new();

    for entry in fs::read_dir(&project_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = path.file_name().unwrap().to_string_lossy().to_string();

        if name.ends_with(".jsonl") && !name.starts_with("agent-") {
            let session_id = name.trim_end_matches(".jsonl").to_string();
            let content = fs::read_to_string(&path).unwrap_or_default();

            let mut summary = None;
            let mut message_count = 0;

            for line in content.lines() {
                if let Ok(parsed) = serde_json::from_str::<RawLine>(line) {
                    if parsed.line_type.as_deref() == Some("summary") {
                        summary = parsed.summary;
                    }
                    if parsed.line_type.as_deref() == Some("user") ||
                       parsed.line_type.as_deref() == Some("assistant") {
                        message_count += 1;
                    }
                }
            }

            let metadata = fs::metadata(&path).ok();
            let last_modified = metadata
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            sessions.push(Session {
                id: session_id,
                project_id: project_id.clone(),
                summary,
                message_count,
                last_modified,
            });
        }
    }

    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    Ok(sessions)
}

#[tauri::command]
fn get_session_messages(project_id: String, session_id: String) -> Result<Vec<Message>, String> {
    let session_path = get_claude_dir()
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));

    if !session_path.exists() {
        return Err("Session not found".to_string());
    }

    let content = fs::read_to_string(&session_path).map_err(|e| e.to_string())?;
    let mut messages = Vec::new();

    for line in content.lines() {
        if let Ok(parsed) = serde_json::from_str::<RawLine>(line) {
            let line_type = parsed.line_type.as_deref();
            if line_type == Some("user") || line_type == Some("assistant") {
                if let Some(msg) = &parsed.message {
                    let role = msg.role.clone().unwrap_or_default();
                    let content = extract_content(&msg.content);

                    if !content.is_empty() {
                        messages.push(Message {
                            uuid: parsed.uuid.unwrap_or_default(),
                            role,
                            content,
                            timestamp: parsed.timestamp.unwrap_or_default(),
                        });
                    }
                }
            }
        }
    }

    Ok(messages)
}

fn extract_content(value: &Option<serde_json::Value>) -> String {
    match value {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Array(arr)) => {
            arr.iter()
                .filter_map(|item| {
                    if let Some(obj) = item.as_object() {
                        if obj.get("type").and_then(|v| v.as_str()) == Some("text") {
                            return obj.get("text").and_then(|v| v.as_str()).map(String::from);
                        }
                    }
                    None
                })
                .collect::<Vec<_>>()
                .join("\n")
        }
        _ => String::new(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_projects,
            list_sessions,
            get_session_messages
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
