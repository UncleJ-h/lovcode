/**
 * [INPUT]: 依赖 std::fs, std::path, serde, crate::security, crate::commands::local_commands
 * [OUTPUT]: 对外提供 list_local_agents, list_local_skills 命令
 * [POS]: commands/ 模块的 Agent 和 Skill 管理命令中心
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use crate::commands::parse_frontmatter;
use crate::security;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;


// ============================================================================
// Types
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
