/**
 * [INPUT]: 依赖 types, services, security 模块
 * [OUTPUT]: 对外提供会话消息相关的 Tauri 命令
 * [POS]: commands/ 模块成员，处理会话消息的读取和解析
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use crate::security;
use crate::services::extract_content_with_meta;
use crate::types::{Message, RawLine};
use std::fs;

// ============================================================================
// Session Messages Command
// ============================================================================

#[tauri::command]
pub async fn get_session_messages(
    project_id: String,
    session_id: String,
) -> Result<Vec<Message>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let session_path = security::get_claude_dir_or_fallback()
            .join("projects")
            .join(&project_id)
            .join(format!("{}.jsonl", session_id));

        if !session_path.exists() {
            return Err("Session not found".to_string());
        }

        let content = fs::read_to_string(&session_path).map_err(|e| e.to_string())?;
        let mut messages = Vec::new();

        for (idx, line) in content.lines().enumerate() {
            if let Ok(parsed) = serde_json::from_str::<RawLine>(line) {
                let line_type = parsed.line_type.as_deref();
                if line_type == Some("user") || line_type == Some("assistant") {
                    if let Some(msg) = &parsed.message {
                        let role = msg.role.clone().unwrap_or_default();
                        let (content, is_tool) = extract_content_with_meta(&msg.content);
                        let is_meta = parsed.is_meta.unwrap_or(false);

                        if !content.is_empty() {
                            messages.push(Message {
                                uuid: parsed.uuid.unwrap_or_default(),
                                role,
                                content,
                                timestamp: parsed.timestamp.unwrap_or_default(),
                                is_meta,
                                is_tool,
                                line_number: idx + 1,
                            });
                        }
                    }
                }
            }
        }

        Ok(messages)
    })
    .await
    .map_err(|e| e.to_string())?
}
