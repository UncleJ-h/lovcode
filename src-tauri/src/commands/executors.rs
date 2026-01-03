/**
 * [INPUT]: executor_profiles.json 配置文件
 * [OUTPUT]: 对外提供 Executor Profile 相关命令
 * [POS]: 管理 AI Coding Agent 的执行配置
 * [PROTOCOL]: 变更时更新此头部，然后检查 commands/mod.rs
 */
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// 类型定义
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutorProfile {
    pub label: String,
    pub description: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub name: String,
    pub profiles: HashMap<String, ExecutorProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutorProfiles {
    pub agents: HashMap<String, AgentConfig>,
}

/// 前端使用的扁平化 Profile 结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlatProfile {
    pub agent: String,
    pub agent_name: String,
    pub profile_id: String,
    pub label: String,
    pub description: String,
    pub command: String,
}

// ============================================================================
// 内置配置
// ============================================================================

fn get_builtin_profiles() -> ExecutorProfiles {
    serde_json::from_str(include_str!("../executor_profiles.json"))
        .expect("Invalid executor_profiles.json")
}

// ============================================================================
// Tauri 命令
// ============================================================================

/// 获取所有 Executor Profiles (扁平化列表)
#[tauri::command]
pub fn list_executor_profiles() -> Result<Vec<FlatProfile>, String> {
    let profiles = get_builtin_profiles();
    let mut result = Vec::new();

    for (agent_id, agent_config) in &profiles.agents {
        for (profile_id, profile) in &agent_config.profiles {
            // 构建完整命令
            let command = if profile.args.is_empty() {
                agent_id.clone()
            } else {
                format!("{} {}", agent_id, profile.args.join(" "))
            };

            result.push(FlatProfile {
                agent: agent_id.clone(),
                agent_name: agent_config.name.clone(),
                profile_id: profile_id.clone(),
                label: profile.label.clone(),
                description: profile.description.clone(),
                command,
            });
        }
    }

    // 按 agent 名称 + profile 标签排序
    result.sort_by(|a, b| a.agent_name.cmp(&b.agent_name).then(a.label.cmp(&b.label)));

    Ok(result)
}

/// 获取指定 Agent 的所有 Profiles
#[tauri::command]
pub fn get_agent_profiles(agent: String) -> Result<Vec<FlatProfile>, String> {
    let profiles = get_builtin_profiles();

    let agent_config = profiles
        .agents
        .get(&agent)
        .ok_or_else(|| format!("Unknown agent: {}", agent))?;

    let mut result: Vec<FlatProfile> = agent_config
        .profiles
        .iter()
        .map(|(profile_id, profile)| {
            let command = if profile.args.is_empty() {
                agent.clone()
            } else {
                format!("{} {}", agent, profile.args.join(" "))
            };

            FlatProfile {
                agent: agent.clone(),
                agent_name: agent_config.name.clone(),
                profile_id: profile_id.clone(),
                label: profile.label.clone(),
                description: profile.description.clone(),
                command,
            }
        })
        .collect();

    // Default profile first, then alphabetical
    result.sort_by(|a, b| {
        if a.profile_id == "default" {
            std::cmp::Ordering::Less
        } else if b.profile_id == "default" {
            std::cmp::Ordering::Greater
        } else {
            a.label.cmp(&b.label)
        }
    });

    Ok(result)
}

/// 获取支持的 Agent 列表
#[tauri::command]
pub fn list_supported_agents() -> Result<Vec<(String, String)>, String> {
    let profiles = get_builtin_profiles();

    let mut agents: Vec<(String, String)> = profiles
        .agents
        .iter()
        .map(|(id, config)| (id.clone(), config.name.clone()))
        .collect();

    agents.sort_by(|a, b| a.1.cmp(&b.1));

    Ok(agents)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_executor_profiles() {
        let profiles = list_executor_profiles().unwrap();
        assert!(!profiles.is_empty());

        // Check claude profiles exist
        let claude_profiles: Vec<_> = profiles.iter().filter(|p| p.agent == "claude").collect();
        assert!(!claude_profiles.is_empty());

        // Check default profile exists
        assert!(claude_profiles.iter().any(|p| p.profile_id == "default"));
    }

    #[test]
    fn test_get_agent_profiles() {
        let profiles = get_agent_profiles("claude".to_string()).unwrap();
        assert!(!profiles.is_empty());

        // Default should be first
        assert_eq!(profiles[0].profile_id, "default");
    }
}
