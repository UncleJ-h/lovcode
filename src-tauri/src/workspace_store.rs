//! Workspace data persistence
//!
//! Stores workspace configuration including projects, features, and panel states.
//! Data is persisted to ~/.lovstudio/lovcode/workspace.json
//!
//! Thread Safety: Uses RwLock to prevent race conditions during concurrent access.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

// ============================================================================
// Global Lock for Thread Safety
// ============================================================================

/// Global lock for workspace file operations.
/// Uses RwLock because reads are more frequent than writes.
static WORKSPACE_LOCK: RwLock<()> = RwLock::new(());

/// Get the workspace data file path
fn get_workspace_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".lovstudio")
        .join("lovcode")
        .join("workspace.json")
}

/// Feature status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum FeatureStatus {
    Pending,
    Running,
    Completed,
    NeedsReview,
}

impl Default for FeatureStatus {
    fn default() -> Self {
        Self::Pending
    }
}

/// Session within a panel (a terminal tab)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub id: String,
    pub pty_id: String,
    pub title: String,
    pub command: Option<String>,
}

/// Panel state (container for multiple session tabs)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelState {
    pub id: String,
    #[serde(default)]
    pub sessions: Vec<SessionState>,
    #[serde(default)]
    pub active_session_id: String,
    pub is_shared: bool,
    pub cwd: String,
}

/// Layout tree node - either a panel leaf or a split container
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum LayoutNode {
    Panel { panelId: String },
    Split {
        direction: String,
        first: Box<LayoutNode>,
        second: Box<LayoutNode>,
    },
}

/// Feature within a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feature {
    pub id: String,
    /// Immutable sequence number (like database auto-increment ID)
    #[serde(default)]
    pub seq: u32,
    pub name: String,
    /// Optional description (markdown) - e.g., background, goals
    #[serde(default)]
    pub description: Option<String>,
    pub status: FeatureStatus,
    #[serde(default)]
    pub pinned: Option<bool>,
    #[serde(default)]
    pub archived: Option<bool>,
    pub archived_note: Option<String>,
    pub git_branch: Option<String>,
    pub chat_session_id: Option<String>,
    pub panels: Vec<PanelState>,
    /// @deprecated Use layout instead
    #[serde(default)]
    pub layout_direction: Option<String>,
    /// Tree-based layout for tmux-style splits
    #[serde(default)]
    pub layout: Option<LayoutNode>,
    pub created_at: u64,
}

/// Project in the workspace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceProject {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub archived: Option<bool>,
    pub features: Vec<Feature>,
    #[serde(default)]
    pub shared_panels: Vec<PanelState>,
    pub active_feature_id: Option<String>,
    #[serde(default)]
    pub feature_counter: Option<u32>,
    pub created_at: u64,
}

/// Complete workspace data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspaceData {
    pub projects: Vec<WorkspaceProject>,
    pub active_project_id: Option<String>,
    /// Global feature counter across all projects
    #[serde(default)]
    pub feature_counter: Option<u32>,
}

/// Load workspace data from disk (thread-safe with read lock)
pub fn load_workspace() -> Result<WorkspaceData, String> {
    let _guard = WORKSPACE_LOCK
        .read()
        .map_err(|_| "Workspace lock poisoned")?;

    load_workspace_internal()
}

/// Internal load without locking (for use within write-locked operations)
fn load_workspace_internal() -> Result<WorkspaceData, String> {
    let path = get_workspace_path();

    if !path.exists() {
        return Ok(WorkspaceData::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read workspace: {}", e))?;

    let mut data: WorkspaceData = serde_json::from_str(&content).map_err(|e| format!("Failed to parse workspace: {}", e))?;

    // Migrate: initialize global feature_counter from max seq if not set
    if data.feature_counter.is_none() {
        let max_seq = data.projects.iter()
            .flat_map(|p| p.features.iter())
            .map(|f| f.seq)
            .max()
            .unwrap_or(0);
        if max_seq > 0 {
            data.feature_counter = Some(max_seq);
        }
    }

    Ok(data)
}

/// Save workspace data to disk (atomic write, thread-safe with write lock)
pub fn save_workspace(data: &WorkspaceData) -> Result<(), String> {
    let _guard = WORKSPACE_LOCK
        .write()
        .map_err(|_| "Workspace lock poisoned")?;

    save_workspace_internal(data)
}

/// Internal save without locking (for use within already-locked operations)
fn save_workspace_internal(data: &WorkspaceData) -> Result<(), String> {
    use crate::security;

    let path = get_workspace_path();

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let content =
        serde_json::to_string_pretty(data).map_err(|e| format!("Failed to serialize workspace: {}", e))?;

    // 使用原子化写入，防止崩溃时数据损坏
    security::atomic_write_string(&path, &content)
        .map_err(|e| format!("Failed to write workspace: {}", e))?;

    Ok(())
}

/// Execute a read-modify-write operation atomically with write lock
fn with_workspace_mut<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&mut WorkspaceData) -> Result<T, String>,
{
    let _guard = WORKSPACE_LOCK
        .write()
        .map_err(|_| "Workspace lock poisoned")?;

    let mut data = load_workspace_internal()?;
    let result = f(&mut data)?;
    save_workspace_internal(&data)?;
    Ok(result)
}

/// Add a new project to the workspace
pub fn add_project(path: String) -> Result<WorkspaceProject, String> {
    with_workspace_mut(|data| {
        // Check if project already exists
        if data.projects.iter().any(|p| p.path == path) {
            return Err(format!("Project '{}' already exists", path));
        }

        // Extract project name from path
        let name = std::path::Path::new(&path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let project = WorkspaceProject {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path: path.clone(),
            archived: None,
            features: Vec::new(),
            shared_panels: Vec::new(),
            active_feature_id: None,
            feature_counter: None,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        };

        data.projects.push(project.clone());

        // Set as active if it's the first project
        if data.active_project_id.is_none() {
            data.active_project_id = Some(project.id.clone());
        }

        Ok(project)
    })
}

/// Remove a project from the workspace
pub fn remove_project(id: &str) -> Result<(), String> {
    let id = id.to_string();
    with_workspace_mut(|data| {
        let index = data
            .projects
            .iter()
            .position(|p| p.id == id)
            .ok_or_else(|| format!("Project '{}' not found", id))?;

        data.projects.remove(index);

        // Update active project if needed
        if data.active_project_id.as_deref() == Some(id.as_str()) {
            data.active_project_id = data.projects.first().map(|p| p.id.clone());
        }

        Ok(())
    })
}

/// Set the active project
pub fn set_active_project(id: &str) -> Result<(), String> {
    let id = id.to_string();
    with_workspace_mut(|data| {
        if !data.projects.iter().any(|p| p.id == id) {
            return Err(format!("Project '{}' not found", id));
        }

        data.active_project_id = Some(id);
        Ok(())
    })
}

/// Create a new feature in a project
pub fn create_feature(project_id: &str, name: String, description: Option<String>) -> Result<Feature, String> {
    let project_id = project_id.to_string();
    with_workspace_mut(|data| {
        // Increment global feature counter
        let seq = data.feature_counter.unwrap_or(0) + 1;
        data.feature_counter = Some(seq);

        let project = data
            .projects
            .iter_mut()
            .find(|p| p.id == project_id)
            .ok_or_else(|| format!("Project '{}' not found", project_id))?;

        let feature = Feature {
            id: uuid::Uuid::new_v4().to_string(),
            seq,
            name: name.clone(),
            description: description.clone(),
            status: FeatureStatus::Pending,
            pinned: None,
            archived: None,
            archived_note: None,
            git_branch: None,
            chat_session_id: None,
            panels: Vec::new(),
            layout_direction: None,
            layout: None,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        };

        project.features.push(feature.clone());

        // Set as active feature if it's the first
        if project.active_feature_id.is_none() {
            project.active_feature_id = Some(feature.id.clone());
        }

        Ok(feature)
    })
}

/// Rename a feature
pub fn rename_feature(feature_id: &str, name: String) -> Result<(), String> {
    let feature_id = feature_id.to_string();
    with_workspace_mut(|data| {
        for project in &mut data.projects {
            if let Some(feature) = project.features.iter_mut().find(|f| f.id == feature_id) {
                feature.name = name;
                return Ok(());
            }
        }
        Err(format!("Feature '{}' not found", feature_id))
    })
}

/// Update a feature's status
pub fn update_feature_status(project_id: &str, feature_id: &str, status: FeatureStatus) -> Result<(), String> {
    let project_id = project_id.to_string();
    let feature_id = feature_id.to_string();
    with_workspace_mut(|data| {
        let project = data
            .projects
            .iter_mut()
            .find(|p| p.id == project_id)
            .ok_or_else(|| format!("Project '{}' not found", project_id))?;

        let feature = project
            .features
            .iter_mut()
            .find(|f| f.id == feature_id)
            .ok_or_else(|| format!("Feature '{}' not found", feature_id))?;

        feature.status = status;
        Ok(())
    })
}

/// Delete a feature
pub fn delete_feature(project_id: &str, feature_id: &str) -> Result<(), String> {
    let project_id = project_id.to_string();
    let feature_id = feature_id.to_string();
    with_workspace_mut(|data| {
        let project = data
            .projects
            .iter_mut()
            .find(|p| p.id == project_id)
            .ok_or_else(|| format!("Project '{}' not found", project_id))?;

        let index = project
            .features
            .iter()
            .position(|f| f.id == feature_id)
            .ok_or_else(|| format!("Feature '{}' not found", feature_id))?;

        project.features.remove(index);

        // Update active feature if needed
        if project.active_feature_id.as_deref() == Some(feature_id.as_str()) {
            project.active_feature_id = project.features.first().map(|f| f.id.clone());
        }

        Ok(())
    })
}

/// Set the active feature for a project
pub fn set_active_feature(project_id: &str, feature_id: &str) -> Result<(), String> {
    let project_id = project_id.to_string();
    let feature_id = feature_id.to_string();
    with_workspace_mut(|data| {
        let project = data
            .projects
            .iter_mut()
            .find(|p| p.id == project_id)
            .ok_or_else(|| format!("Project '{}' not found", project_id))?;

        if !project.features.iter().any(|f| f.id == feature_id) {
            return Err(format!("Feature '{}' not found", feature_id));
        }

        project.active_feature_id = Some(feature_id);
        Ok(())
    })
}

/// Add a panel to a feature
pub fn add_panel_to_feature(project_id: &str, feature_id: &str, panel: PanelState) -> Result<(), String> {
    let project_id = project_id.to_string();
    let feature_id = feature_id.to_string();
    with_workspace_mut(|data| {
        let project = data
            .projects
            .iter_mut()
            .find(|p| p.id == project_id)
            .ok_or_else(|| format!("Project '{}' not found", project_id))?;

        let feature = project
            .features
            .iter_mut()
            .find(|f| f.id == feature_id)
            .ok_or_else(|| format!("Feature '{}' not found", feature_id))?;

        feature.panels.push(panel);
        Ok(())
    })
}

/// Remove a panel from a feature
pub fn remove_panel_from_feature(project_id: &str, feature_id: &str, panel_id: &str) -> Result<(), String> {
    let project_id = project_id.to_string();
    let feature_id = feature_id.to_string();
    let panel_id = panel_id.to_string();
    with_workspace_mut(|data| {
        let project = data
            .projects
            .iter_mut()
            .find(|p| p.id == project_id)
            .ok_or_else(|| format!("Project '{}' not found", project_id))?;

        let feature = project
            .features
            .iter_mut()
            .find(|f| f.id == feature_id)
            .ok_or_else(|| format!("Feature '{}' not found", feature_id))?;

        feature.panels.retain(|p| p.id != panel_id);
        Ok(())
    })
}

/// Toggle panel shared state (move between feature and shared)
pub fn toggle_panel_shared(project_id: &str, panel_id: &str) -> Result<bool, String> {
    let project_id = project_id.to_string();
    let panel_id = panel_id.to_string();
    with_workspace_mut(|data| {
        let project = data
            .projects
            .iter_mut()
            .find(|p| p.id == project_id)
            .ok_or_else(|| format!("Project '{}' not found", project_id))?;

        // Check if panel is in shared panels
        if let Some(index) = project.shared_panels.iter().position(|p| p.id == panel_id) {
            // Move from shared to active feature
            let mut panel = project.shared_panels.remove(index);
            panel.is_shared = false;

            if let Some(feature_id) = &project.active_feature_id {
                if let Some(feature) = project.features.iter_mut().find(|f| &f.id == feature_id) {
                    feature.panels.push(panel);
                }
            }

            return Ok(false); // No longer shared
        }

        // Check if panel is in any feature
        for feature in &mut project.features {
            if let Some(index) = feature.panels.iter().position(|p| p.id == panel_id) {
                // Move from feature to shared
                let mut panel = feature.panels.remove(index);
                panel.is_shared = true;
                project.shared_panels.push(panel);

                return Ok(true); // Now shared
            }
        }

        Err(format!("Panel '{}' not found", panel_id))
    })
}

/// Get features that need review
pub fn get_pending_reviews() -> Result<Vec<(String, String, String)>, String> {
    let data = load_workspace()?;
    let mut reviews = Vec::new();

    for project in &data.projects {
        for feature in &project.features {
            if feature.status == FeatureStatus::NeedsReview {
                reviews.push((
                    project.id.clone(),
                    feature.id.clone(),
                    format!("{}: {}", project.name, feature.name),
                ));
            }
        }
    }

    Ok(reviews)
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ========================================================================
    // Type and Enum Tests
    // ========================================================================

    #[test]
    fn test_feature_status_default() {
        let status = FeatureStatus::default();
        assert_eq!(status, FeatureStatus::Pending);
    }

    #[test]
    fn test_feature_status_variants() {
        // Test that all variants can be used
        let _pending = FeatureStatus::Pending;
        let _running = FeatureStatus::Running;
        let _completed = FeatureStatus::Completed;
        let _needs_review = FeatureStatus::NeedsReview;
    }

    #[test]
    fn test_workspace_data_default() {
        let data = WorkspaceData::default();
        assert!(data.projects.is_empty());
        assert!(data.active_project_id.is_none());
        assert!(data.feature_counter.is_none());
    }

    // ========================================================================
    // Serialization Tests
    // ========================================================================

    #[test]
    fn test_feature_status_serialization() {
        let status = FeatureStatus::NeedsReview;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"needs-review\"");

        let deserialized: FeatureStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, FeatureStatus::NeedsReview);
    }

    #[test]
    fn test_session_state_serialization() {
        let session = SessionState {
            id: "sess-1".to_string(),
            pty_id: "pty-1".to_string(),
            title: "Terminal 1".to_string(),
            command: Some("npm run dev".to_string()),
        };

        let json = serde_json::to_string(&session).unwrap();
        let deserialized: SessionState = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, "sess-1");
        assert_eq!(deserialized.pty_id, "pty-1");
        assert_eq!(deserialized.title, "Terminal 1");
        assert_eq!(deserialized.command, Some("npm run dev".to_string()));
    }

    #[test]
    fn test_panel_state_serialization() {
        let panel = PanelState {
            id: "panel-1".to_string(),
            sessions: vec![],
            active_session_id: "".to_string(),
            is_shared: false,
            cwd: "/home/user/project".to_string(),
        };

        let json = serde_json::to_string(&panel).unwrap();
        let deserialized: PanelState = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, "panel-1");
        assert!(!deserialized.is_shared);
        assert_eq!(deserialized.cwd, "/home/user/project");
    }

    #[test]
    fn test_layout_node_panel_serialization() {
        let node = LayoutNode::Panel {
            panelId: "panel-1".to_string(),
        };

        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("\"type\":\"panel\""));
        assert!(json.contains("\"panelId\":\"panel-1\""));
    }

    #[test]
    fn test_layout_node_split_serialization() {
        let node = LayoutNode::Split {
            direction: "horizontal".to_string(),
            first: Box::new(LayoutNode::Panel {
                panelId: "panel-1".to_string(),
            }),
            second: Box::new(LayoutNode::Panel {
                panelId: "panel-2".to_string(),
            }),
        };

        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("\"type\":\"split\""));
        assert!(json.contains("\"direction\":\"horizontal\""));
    }

    #[test]
    fn test_feature_serialization() {
        let feature = Feature {
            id: "feat-1".to_string(),
            seq: 1,
            name: "Test Feature".to_string(),
            description: Some("Description".to_string()),
            status: FeatureStatus::Running,
            pinned: Some(true),
            archived: None,
            archived_note: None,
            git_branch: Some("feature/test".to_string()),
            chat_session_id: None,
            panels: vec![],
            layout_direction: None,
            layout: None,
            created_at: 1234567890,
        };

        let json = serde_json::to_string(&feature).unwrap();
        let deserialized: Feature = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, "feat-1");
        assert_eq!(deserialized.seq, 1);
        assert_eq!(deserialized.name, "Test Feature");
        assert_eq!(deserialized.status, FeatureStatus::Running);
        assert_eq!(deserialized.pinned, Some(true));
        assert_eq!(deserialized.git_branch, Some("feature/test".to_string()));
    }

    #[test]
    fn test_workspace_project_serialization() {
        let project = WorkspaceProject {
            id: "proj-1".to_string(),
            name: "Test Project".to_string(),
            path: "/home/user/project".to_string(),
            archived: None,
            features: vec![],
            shared_panels: vec![],
            active_feature_id: None,
            feature_counter: Some(5),
            created_at: 1234567890,
        };

        let json = serde_json::to_string(&project).unwrap();
        let deserialized: WorkspaceProject = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, "proj-1");
        assert_eq!(deserialized.name, "Test Project");
        assert_eq!(deserialized.path, "/home/user/project");
        assert_eq!(deserialized.feature_counter, Some(5));
    }

    #[test]
    fn test_workspace_data_serialization() {
        let data = WorkspaceData {
            projects: vec![],
            active_project_id: Some("proj-1".to_string()),
            feature_counter: Some(10),
        };

        let json = serde_json::to_string(&data).unwrap();
        let deserialized: WorkspaceData = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.active_project_id, Some("proj-1".to_string()));
        assert_eq!(deserialized.feature_counter, Some(10));
    }

    // ========================================================================
    // Path Tests
    // ========================================================================

    #[test]
    fn test_get_workspace_path() {
        let path = get_workspace_path();
        let path_str = path.to_string_lossy();

        // Should be in .lovstudio/lovcode/workspace.json
        assert!(path_str.contains(".lovstudio"));
        assert!(path_str.contains("lovcode"));
        assert!(path_str.ends_with("workspace.json"));
    }

    // ========================================================================
    // Optional Field Defaults
    // ========================================================================

    #[test]
    fn test_feature_optional_fields_missing() {
        // JSON with minimal fields
        let json = r#"{
            "id": "feat-1",
            "name": "Test",
            "status": "pending",
            "panels": [],
            "created_at": 0
        }"#;

        let feature: Feature = serde_json::from_str(json).unwrap();

        // Verify defaults
        assert_eq!(feature.seq, 0); // default
        assert!(feature.description.is_none());
        assert!(feature.pinned.is_none());
        assert!(feature.archived.is_none());
        assert!(feature.git_branch.is_none());
        assert!(feature.layout.is_none());
    }

    #[test]
    fn test_workspace_project_optional_fields_missing() {
        let json = r#"{
            "id": "proj-1",
            "name": "Test",
            "path": "/path",
            "features": [],
            "active_feature_id": null,
            "created_at": 0
        }"#;

        let project: WorkspaceProject = serde_json::from_str(json).unwrap();

        // Verify defaults
        assert!(project.archived.is_none());
        assert!(project.shared_panels.is_empty());
        assert!(project.feature_counter.is_none());
    }

    // ========================================================================
    // Clone Tests (important for the interior mutability pattern)
    // ========================================================================

    #[test]
    fn test_feature_clone() {
        let feature = Feature {
            id: "feat-1".to_string(),
            seq: 1,
            name: "Test".to_string(),
            description: None,
            status: FeatureStatus::Pending,
            pinned: None,
            archived: None,
            archived_note: None,
            git_branch: None,
            chat_session_id: None,
            panels: vec![],
            layout_direction: None,
            layout: None,
            created_at: 0,
        };

        let cloned = feature.clone();
        assert_eq!(cloned.id, feature.id);
        assert_eq!(cloned.seq, feature.seq);
    }

    #[test]
    fn test_workspace_project_clone() {
        let project = WorkspaceProject {
            id: "proj-1".to_string(),
            name: "Test".to_string(),
            path: "/path".to_string(),
            archived: None,
            features: vec![],
            shared_panels: vec![],
            active_feature_id: None,
            feature_counter: None,
            created_at: 0,
        };

        let cloned = project.clone();
        assert_eq!(cloned.id, project.id);
        assert_eq!(cloned.path, project.path);
    }
}
