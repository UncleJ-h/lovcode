/**
 * [INPUT]: 依赖 std::fs, std::path, std::process, serde, crate::security, crate::commands::local_commands
 * [OUTPUT]: 对外提供 list_local_agents, list_local_skills, list_agents, get_agent_info 命令
 * [POS]: commands/ 模块的 Agent 和 Skill 管理命令中心
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 *
 * 设计借鉴: vibe-kanban executors
 * - Agent 可用性检测
 * - Agent 能力声明
 * - MCP 配置路径
 */
use crate::commands::parse_frontmatter;
use crate::security;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

// ============================================================================
// Coding Agent Types (借鉴 vibe-kanban)
// ============================================================================

/// Agent 能力
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgentCapability {
    /// 支持会话 fork (继续之前的对话)
    SessionFork,
    /// 需要登录/安装设置
    SetupRequired,
    /// 支持 MCP 服务器
    McpSupport,
    /// 支持计划模式
    PlanMode,
}

/// Agent 可用性状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum AgentAvailability {
    /// 已安装且可用
    Available { version: Option<String> },
    /// 已安装但需要登录
    NeedsAuth { message: String },
    /// 未安装
    NotInstalled,
    /// 检测失败
    Unknown { error: String },
}

/// Coding Agent 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodingAgentInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub command: String,
    pub availability: AgentAvailability,
    pub capabilities: Vec<AgentCapability>,
    pub mcp_config_path: Option<String>,
    pub website: Option<String>,
}

// ============================================================================
// Local Agent/Skill Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalAgent {
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub model: Option<String>,
    pub tools: Option<String>,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalSkill {
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub content: String,
}

// ============================================================================
// Helper Functions
// ============================================================================

fn collect_agents(
    base_dir: &PathBuf,
    current_dir: &PathBuf,
    agents: &mut Vec<LocalAgent>,
) -> Result<(), String> {
    for entry in fs::read_dir(current_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            collect_agents(base_dir, &path, agents)?;
        } else if path.extension().map_or(false, |e| e == "md") {
            let content = fs::read_to_string(&path).unwrap_or_default();
            let (frontmatter, _, body) = parse_frontmatter(&content);

            // Only include if it has a 'model' field (agents have model, commands don't)
            if frontmatter.contains_key("model") {
                let relative = path.strip_prefix(base_dir).unwrap_or(&path);
                let name = relative
                    .to_string_lossy()
                    .trim_end_matches(".md")
                    .replace("\\", "/")
                    .to_string();

                agents.push(LocalAgent {
                    name,
                    path: path.to_string_lossy().to_string(),
                    description: frontmatter.get("description").cloned(),
                    model: frontmatter.get("model").cloned(),
                    tools: frontmatter.get("tools").cloned(),
                    content: body,
                });
            }
        }
    }
    Ok(())
}

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
pub fn list_local_agents() -> Result<Vec<LocalAgent>, String> {
    let commands_dir = security::get_claude_dir_or_fallback().join("commands");

    if !commands_dir.exists() {
        return Ok(vec![]);
    }

    let mut agents = Vec::new();
    collect_agents(&commands_dir, &commands_dir, &mut agents)?;

    agents.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(agents)
}

#[tauri::command]
pub fn list_local_skills() -> Result<Vec<LocalSkill>, String> {
    let skills_dir = security::get_claude_dir_or_fallback().join("skills");

    if !skills_dir.exists() {
        return Ok(vec![]);
    }

    let mut skills = Vec::new();

    for entry in fs::read_dir(&skills_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            let skill_name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string());
            let skill_md = path.join("SKILL.md");

            if skill_md.exists() {
                let content = fs::read_to_string(&skill_md).unwrap_or_default();
                let (frontmatter, _, body) = parse_frontmatter(&content);

                skills.push(LocalSkill {
                    name: skill_name,
                    path: skill_md.to_string_lossy().to_string(),
                    description: frontmatter.get("description").cloned(),
                    content: body,
                });
            }
        }
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

// ============================================================================
// Coding Agent Detection (借鉴 vibe-kanban)
// ============================================================================

/// 检测命令是否存在
fn command_exists(cmd: &str) -> bool {
    Command::new("which")
        .arg(cmd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// 获取命令版本
fn get_command_version(cmd: &str, args: &[&str]) -> Option<String> {
    Command::new(cmd).args(args).output().ok().and_then(|o| {
        if o.status.success() {
            String::from_utf8(o.stdout)
                .ok()
                .map(|s| s.lines().next().unwrap_or("").trim().to_string())
        } else {
            None
        }
    })
}

/// Claude Code 检测
fn detect_claude() -> CodingAgentInfo {
    let availability = if command_exists("claude") {
        match get_command_version("claude", &["--version"]) {
            Some(version) => AgentAvailability::Available {
                version: Some(version),
            },
            None => AgentAvailability::Available { version: None },
        }
    } else {
        AgentAvailability::NotInstalled
    };

    let home = dirs::home_dir().unwrap_or_default();
    let mcp_path = home.join(".claude.json");

    CodingAgentInfo {
        id: "claude".to_string(),
        name: "Claude Code".to_string(),
        description: "Anthropic's official AI coding assistant".to_string(),
        command: "claude".to_string(),
        availability,
        capabilities: vec![
            AgentCapability::SessionFork,
            AgentCapability::McpSupport,
            AgentCapability::PlanMode,
        ],
        mcp_config_path: Some(mcp_path.to_string_lossy().to_string()),
        website: Some("https://claude.ai/claude-code".to_string()),
    }
}

/// Codex 检测
fn detect_codex() -> CodingAgentInfo {
    let availability = if command_exists("codex") {
        match get_command_version("codex", &["--version"]) {
            Some(version) => AgentAvailability::Available {
                version: Some(version),
            },
            None => AgentAvailability::Available { version: None },
        }
    } else {
        AgentAvailability::NotInstalled
    };

    let home = dirs::home_dir().unwrap_or_default();
    let mcp_path = home.join(".codex").join("config.json");

    CodingAgentInfo {
        id: "codex".to_string(),
        name: "Codex".to_string(),
        description: "OpenAI's coding assistant with o1/o3 reasoning".to_string(),
        command: "codex".to_string(),
        availability,
        capabilities: vec![
            AgentCapability::SessionFork,
            AgentCapability::McpSupport,
            AgentCapability::SetupRequired,
        ],
        mcp_config_path: Some(mcp_path.to_string_lossy().to_string()),
        website: Some("https://github.com/openai/codex".to_string()),
    }
}

/// Gemini CLI 检测
fn detect_gemini() -> CodingAgentInfo {
    let availability = if command_exists("gemini") {
        match get_command_version("gemini", &["--version"]) {
            Some(version) => AgentAvailability::Available {
                version: Some(version),
            },
            None => AgentAvailability::Available { version: None },
        }
    } else {
        AgentAvailability::NotInstalled
    };

    let home = dirs::home_dir().unwrap_or_default();
    let mcp_path = home.join(".gemini").join("settings.json");

    CodingAgentInfo {
        id: "gemini".to_string(),
        name: "Gemini CLI".to_string(),
        description: "Google's AI coding assistant".to_string(),
        command: "gemini".to_string(),
        availability,
        capabilities: vec![AgentCapability::SessionFork, AgentCapability::McpSupport],
        mcp_config_path: Some(mcp_path.to_string_lossy().to_string()),
        website: Some("https://github.com/google-gemini/gemini-cli".to_string()),
    }
}

/// Aider 检测
fn detect_aider() -> CodingAgentInfo {
    let availability = if command_exists("aider") {
        match get_command_version("aider", &["--version"]) {
            Some(version) => AgentAvailability::Available {
                version: Some(version),
            },
            None => AgentAvailability::Available { version: None },
        }
    } else {
        AgentAvailability::NotInstalled
    };

    CodingAgentInfo {
        id: "aider".to_string(),
        name: "Aider".to_string(),
        description: "AI pair programming in your terminal".to_string(),
        command: "aider".to_string(),
        availability,
        capabilities: vec![AgentCapability::SessionFork],
        mcp_config_path: None,
        website: Some("https://aider.chat".to_string()),
    }
}

/// Amp 检测
fn detect_amp() -> CodingAgentInfo {
    let availability = if command_exists("amp") {
        match get_command_version("amp", &["--version"]) {
            Some(version) => AgentAvailability::Available {
                version: Some(version),
            },
            None => AgentAvailability::Available { version: None },
        }
    } else {
        AgentAvailability::NotInstalled
    };

    let home = dirs::home_dir().unwrap_or_default();
    let mcp_path = home.join(".config").join("amp").join("settings.json");

    CodingAgentInfo {
        id: "amp".to_string(),
        name: "Amp".to_string(),
        description: "Sourcegraph's AI coding assistant".to_string(),
        command: "amp".to_string(),
        availability,
        capabilities: vec![AgentCapability::SessionFork, AgentCapability::McpSupport],
        mcp_config_path: Some(mcp_path.to_string_lossy().to_string()),
        website: Some("https://ampcode.com".to_string()),
    }
}

// ============================================================================
// Coding Agent Commands
// ============================================================================

/// 获取所有支持的 Coding Agent 及其可用性
#[tauri::command]
pub fn list_coding_agents() -> Result<Vec<CodingAgentInfo>, String> {
    let agents = vec![
        detect_claude(),
        detect_codex(),
        detect_gemini(),
        detect_aider(),
        detect_amp(),
    ];
    Ok(agents)
}

/// 获取单个 Coding Agent 信息
#[tauri::command]
pub fn get_coding_agent_info(agent_id: String) -> Result<CodingAgentInfo, String> {
    match agent_id.as_str() {
        "claude" => Ok(detect_claude()),
        "codex" => Ok(detect_codex()),
        "gemini" => Ok(detect_gemini()),
        "aider" => Ok(detect_aider()),
        "amp" => Ok(detect_amp()),
        _ => Err(format!("Unknown agent: {}", agent_id)),
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_coding_agents() {
        let agents = list_coding_agents().unwrap();
        assert_eq!(agents.len(), 5);

        // 验证 claude 存在
        let claude = agents.iter().find(|a| a.id == "claude");
        assert!(claude.is_some());
        assert_eq!(claude.unwrap().name, "Claude Code");
    }

    #[test]
    fn test_get_coding_agent_info() {
        let claude = get_coding_agent_info("claude".to_string()).unwrap();
        assert_eq!(claude.id, "claude");
        assert!(claude.capabilities.contains(&AgentCapability::McpSupport));
    }

    #[test]
    fn test_unknown_agent() {
        let result = get_coding_agent_info("unknown_agent".to_string());
        assert!(result.is_err());
    }
}
