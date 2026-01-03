/**
 * [INPUT]: 依赖 serde
 * [OUTPUT]: 对外提供 PluginSource, PluginMetadata, TemplateComponent, TemplatesCatalog, SourceInfo 类型
 * [POS]: marketplace/ 模块的类型定义
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use serde::{Deserialize, Serialize};

// ============================================================================
// Plugin Source Configuration
// ============================================================================

/// Plugin source configuration
#[derive(Debug, Clone)]
pub struct PluginSource {
    pub id: &'static str,
    pub name: &'static str,
    pub icon: &'static str,
    #[allow(dead_code)]
    pub priority: u32,
    pub path: &'static str, // Relative to project root
}

/// Available marketplace sources (ordered by priority)
pub const PLUGIN_SOURCES: &[PluginSource] = &[
    PluginSource {
        id: "anthropic",
        name: "Anthropic Official",
        icon: "🔷",
        priority: 1,
        path: "third-parties/claude-plugins-official",
    },
    PluginSource {
        id: "lovstudio",
        name: "Lovstudio",
        icon: "💜",
        priority: 2,
        path: "marketplace/lovstudio",
    },
    PluginSource {
        id: "lovstudio-plugins",
        name: "Lovstudio Plugins",
        icon: "💜",
        priority: 3,
        path: "../lovstudio-plugins-official",
    },
    PluginSource {
        id: "community",
        name: "Community",
        icon: "🌍",
        priority: 4,
        path: "third-parties/claude-code-templates/docs/components.json",
    },
];

// ============================================================================
// Plugin Metadata
// ============================================================================

/// Plugin metadata from .claude-plugin/plugin.json
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginMetadata {
    pub name: String,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub author: Option<PluginAuthor>,
    #[serde(default)]
    pub repository: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginAuthor {
    pub name: String,
    #[serde(default)]
    pub email: Option<String>,
}

// ============================================================================
// Template Component
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TemplateComponent {
    pub name: String,
    pub path: String,
    pub category: String,
    #[serde(rename = "type")]
    pub component_type: String,
    pub description: Option<String>,
    pub downloads: Option<u32>,
    pub content: Option<String>,
    // Source attribution
    #[serde(default)]
    pub source_id: Option<String>,
    #[serde(default)]
    pub source_name: Option<String>,
    #[serde(default)]
    pub source_icon: Option<String>,
    #[serde(default)]
    pub plugin_name: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
}

// ============================================================================
// Catalog
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct TemplatesCatalog {
    pub agents: Vec<TemplateComponent>,
    pub commands: Vec<TemplateComponent>,
    pub mcps: Vec<TemplateComponent>,
    pub hooks: Vec<TemplateComponent>,
    pub settings: Vec<TemplateComponent>,
    pub skills: Vec<TemplateComponent>,
    pub statuslines: Vec<TemplateComponent>,
    #[serde(default)]
    pub sources: Vec<SourceInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SourceInfo {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub count: usize,
}
