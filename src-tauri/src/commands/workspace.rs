/**
 * [INPUT]: 依赖 workspace_store 模块的工作区数据管理功能
 * [OUTPUT]: 对外提供工作区相关的 Tauri 命令
 * [POS]: commands/ 模块成员，处理项目、功能、面板的 CRUD 操作
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use crate::workspace_store::{
    self, Feature, FeatureStatus, PanelState, WorkspaceData, WorkspaceProject,
};

// ============================================================================
// Workspace Commands
// ============================================================================

#[tauri::command]
pub fn workspace_load() -> Result<WorkspaceData, String> {
    workspace_store::load_workspace()
}

#[tauri::command]
pub fn workspace_save(data: WorkspaceData) -> Result<(), String> {
    workspace_store::save_workspace(&data)
}

#[tauri::command]
pub fn workspace_add_project(path: String) -> Result<WorkspaceProject, String> {
    workspace_store::add_project(path)
}

#[tauri::command]
pub fn workspace_list_projects() -> Result<Vec<WorkspaceProject>, String> {
    workspace_store::load_workspace().map(|d| d.projects)
}

#[tauri::command]
pub fn workspace_remove_project(id: String) -> Result<(), String> {
    workspace_store::remove_project(&id)
}

#[tauri::command]
pub fn workspace_set_active_project(id: String) -> Result<(), String> {
    workspace_store::set_active_project(&id)
}

#[tauri::command]
pub fn workspace_create_feature(
    project_id: String,
    name: String,
    description: Option<String>,
) -> Result<Feature, String> {
    workspace_store::create_feature(&project_id, name, description)
}

#[tauri::command]
pub fn workspace_rename_feature(feature_id: String, name: String) -> Result<(), String> {
    workspace_store::rename_feature(&feature_id, name)
}

#[tauri::command]
pub fn workspace_update_feature_status(
    project_id: String,
    feature_id: String,
    status: FeatureStatus,
) -> Result<(), String> {
    workspace_store::update_feature_status(&project_id, &feature_id, status)
}

#[tauri::command]
pub fn workspace_delete_feature(project_id: String, feature_id: String) -> Result<(), String> {
    workspace_store::delete_feature(&project_id, &feature_id)
}

#[tauri::command]
pub fn workspace_set_active_feature(project_id: String, feature_id: String) -> Result<(), String> {
    workspace_store::set_active_feature(&project_id, &feature_id)
}

#[tauri::command]
pub fn workspace_add_panel(
    project_id: String,
    feature_id: String,
    panel: PanelState,
) -> Result<(), String> {
    workspace_store::add_panel_to_feature(&project_id, &feature_id, panel)
}

#[tauri::command]
pub fn workspace_remove_panel(
    project_id: String,
    feature_id: String,
    panel_id: String,
) -> Result<(), String> {
    workspace_store::remove_panel_from_feature(&project_id, &feature_id, &panel_id)
}

#[tauri::command]
pub fn workspace_toggle_panel_shared(project_id: String, panel_id: String) -> Result<bool, String> {
    workspace_store::toggle_panel_shared(&project_id, &panel_id)
}

#[tauri::command]
pub fn workspace_get_pending_reviews() -> Result<Vec<(String, String, String)>, String> {
    workspace_store::get_pending_reviews()
}
