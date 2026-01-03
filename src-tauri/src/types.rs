/**
 * [INPUT]: 依赖 serde, serde_json
 * [OUTPUT]: 对外提供所有共享数据类型定义
 * [POS]: src-tauri/src 的类型中心，被所有模块消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

// ============================================================================
// 项目和会话类型
// ============================================================================

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
    pub project_path: Option<String>,
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
    pub is_meta: bool,
    pub is_tool: bool,
    pub line_number: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub uuid: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub project_id: String,
    pub project_path: String,
    pub session_id: String,
    pub session_summary: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatsResponse {
    pub items: Vec<ChatMessage>,
    pub total: usize,
}

// ============================================================================
// 内部解析类型
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct RawLine {
    #[serde(rename = "type")]
    pub line_type: Option<String>,
    pub summary: Option<String>,
    pub uuid: Option<String>,
    pub message: Option<RawMessage>,
    pub timestamp: Option<String>,
    #[serde(rename = "isMeta")]
    pub is_meta: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RawMessage {
    pub role: Option<String>,
    pub content: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct HistoryEntry {
    pub display: Option<String>,
    pub timestamp: Option<u64>,
    pub project: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
}

// ============================================================================
// 命令和设置类型
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalCommand {
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub allowed_tools: Option<String>,
    pub argument_hint: Option<String>,
    pub content: String,
    pub version: Option<String>,
    pub status: String,
    pub deprecated_by: Option<String>,
    pub changelog: Option<String>,
    pub aliases: Vec<String>,
    pub frontmatter: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub server_type: Option<String>,
    pub url: Option<String>,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeSettings {
    pub raw: Value,
    pub permissions: Option<Value>,
    pub hooks: Option<Value>,
    pub mcp_servers: Vec<McpServer>,
}

// ============================================================================
// 搜索类型
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub uuid: String,
    pub content: String,
    pub role: String,
    pub project_id: String,
    pub project_path: String,
    pub session_id: String,
    pub session_summary: Option<String>,
    pub timestamp: String,
    pub score: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub items: Vec<SearchResult>,
    pub total: usize,
}

// ============================================================================
// 版本和统计类型
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionWithDownloads {
    pub version: String,
    pub downloads: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeCodeVersionInfo {
    pub install_type: String,
    pub current_version: Option<String>,
    pub available_versions: Vec<VersionWithDownloads>,
    pub autoupdater_disabled: bool,
}

// ============================================================================
// 活动统计类型
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyActivity {
    pub date: String,
    pub message_count: usize,
    pub session_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivityStats {
    pub daily: Vec<DailyActivity>,
    pub total_messages: usize,
    pub total_sessions: usize,
    pub first_date: Option<String>,
    pub last_date: Option<String>,
}

// ============================================================================
// 文件和目录类型
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_hidden: bool,
}
