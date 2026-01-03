/**
 * [INPUT]: 依赖 std::fs, std::path, serde, serde_json, chrono, tauri, crate::types, crate::commands::projects
 * [OUTPUT]: 对外提供 list_distill_documents, list_reference_sources, list_reference_docs, find_session_project, get_distill_watch_enabled, set_distill_watch_enabled 命令
 * [POS]: commands/ 模块的知识库管理命令中心
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

use crate::commands::decode_project_path;
use crate::security;
use crate::types::{RawLine, Session};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use tauri::Manager;

// ============================================================================
// Global State
// ============================================================================

// Distill watch state
pub static DISTILL_WATCH_ENABLED: AtomicBool = AtomicBool::new(true);

// ============================================================================
// Path Helper Functions
// ============================================================================

pub fn get_distill_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".lovstudio/docs/distill")
}

fn get_reference_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".lovstudio/docs/reference")
}

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DistillDocument {
    pub date: String,
    pub file: String,
    pub title: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub session: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReferenceSource {
    pub name: String,
    pub path: String,
    pub doc_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReferenceDoc {
    pub name: String,
    pub path: String,
    pub group: Option<String>,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Scan a directory for reference sources (subdirectories with markdown files)
fn scan_reference_dir(dir: &Path) -> Vec<ReferenceSource> {
    if !dir.exists() {
        return vec![];
    }

    let mut sources = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            // Follow symlinks and check if it's a directory
            if let Ok(metadata) = fs::metadata(&path) {
                if metadata.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let doc_count = fs::read_dir(&path)
                        .map(|entries| {
                            entries
                                .filter(|e| {
                                    e.as_ref()
                                        .ok()
                                        .map(|e| {
                                            e.path().extension().map(|ext| ext == "md").unwrap_or(false)
                                        })
                                        .unwrap_or(false)
                                })
                                .count()
                        })
                        .unwrap_or(0);

                    sources.push(ReferenceSource {
                        name,
                        path: path.to_string_lossy().to_string(),
                        doc_count,
                    });
                }
            }
        }
    }
    sources
}

/// Get bundled reference docs directories from app resources
fn get_bundled_reference_dirs(app_handle: &tauri::AppHandle) -> Vec<(String, PathBuf)> {
    let bundled_docs = [
        ("claude-code", "third-parties/claude-code-docs/docs"),
        ("codex", "third-parties/codex/docs"),
    ];

    let mut result = Vec::new();

    // Try resource directory (production)
    if let Ok(resource_path) = app_handle.path().resource_dir() {
        for (name, rel_path) in &bundled_docs {
            let path = resource_path.join(rel_path);
            if path.exists() {
                result.push((name.to_string(), path));
            }
        }
    }

    // If not found in resources, try development paths
    if result.is_empty() {
        let candidates = [
            std::env::current_dir().ok(),
            std::env::current_dir()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf())),
        ];

        for candidate in candidates.into_iter().flatten() {
            for (name, rel_path) in &bundled_docs {
                let path = candidate.join(rel_path);
                if path.exists() && !result.iter().any(|(n, _)| n == *name) {
                    result.push((name.to_string(), path));
                }
            }
        }
    }

    result
}

/// Find reference source directory by name (checks user dir first, then bundled)
fn find_reference_source_dir(app_handle: &tauri::AppHandle, source: &str) -> Option<PathBuf> {
    // 1. Check user's custom reference directory first
    let user_dir = get_reference_dir().join(source);
    if user_dir.exists() {
        return Some(user_dir);
    }

    // 2. Check bundled reference docs
    for (name, path) in get_bundled_reference_dirs(app_handle) {
        if name == source {
            return Some(path);
        }
    }

    None
}

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
pub fn list_reference_sources(app_handle: tauri::AppHandle) -> Result<Vec<ReferenceSource>, String> {
    let mut sources = Vec::new();
    let mut seen_names = std::collections::HashSet::new();

    // 1. Scan user's custom reference directory first (higher priority)
    let ref_dir = get_reference_dir();
    for source in scan_reference_dir(&ref_dir) {
        seen_names.insert(source.name.clone());
        sources.push(source);
    }

    // 2. Add bundled reference docs (if not overridden by user)
    for (name, path) in get_bundled_reference_dirs(&app_handle) {
        if !seen_names.contains(&name) {
            let doc_count = fs::read_dir(&path)
                .map(|entries| {
                    entries
                        .filter(|e| {
                            e.as_ref()
                                .ok()
                                .map(|e| e.path().extension().map(|ext| ext == "md").unwrap_or(false))
                                .unwrap_or(false)
                        })
                        .count()
                })
                .unwrap_or(0);

            sources.push(ReferenceSource {
                name,
                path: path.to_string_lossy().to_string(),
                doc_count,
            });
        }
    }

    sources.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(sources)
}

#[tauri::command]
pub fn list_reference_docs(app_handle: tauri::AppHandle, source: String) -> Result<Vec<ReferenceDoc>, String> {
    let source_dir = match find_reference_source_dir(&app_handle, &source) {
        Some(dir) => dir,
        None => return Ok(vec![]),
    };

    // Read _order.txt if exists, parse groups from comments
    let order_file = source_dir.join("_order.txt");
    let mut order_map: HashMap<String, (usize, Option<String>)> = HashMap::new(); // name -> (order, group)

    if order_file.exists() {
        if let Ok(content) = fs::read_to_string(&order_file) {
            let mut current_group: Option<String> = None;
            let mut order_idx = 0;

            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if trimmed.starts_with('#') {
                    // Comment line = group name (strip # and trim)
                    let group_name = trimmed.trim_start_matches('#').trim();
                    if !group_name.is_empty() {
                        current_group = Some(group_name.to_string());
                    }
                } else {
                    // Doc name
                    order_map.insert(trimmed.to_string(), (order_idx, current_group.clone()));
                    order_idx += 1;
                }
            }
        }
    }

    let mut docs = Vec::new();
    for entry in fs::read_dir(&source_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.extension().map(|e| e == "md").unwrap_or(false) {
            let name = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            let group = order_map.get(&name).and_then(|(_, g)| g.clone());

            docs.push(ReferenceDoc {
                name,
                path: path.to_string_lossy().to_string(),
                group,
            });
        }
    }

    // Sort by _order.txt if available, otherwise alphabetically
    if !order_map.is_empty() {
        docs.sort_by(|a, b| {
            let a_idx = order_map
                .get(&a.name)
                .map(|(i, _)| *i)
                .unwrap_or(usize::MAX);
            let b_idx = order_map
                .get(&b.name)
                .map(|(i, _)| *i)
                .unwrap_or(usize::MAX);
            a_idx.cmp(&b_idx)
        });
    } else {
        docs.sort_by(|a, b| a.name.cmp(&b.name));
    }

    Ok(docs)
}

#[tauri::command]
pub fn list_distill_documents() -> Result<Vec<DistillDocument>, String> {
    let distill_dir = get_distill_dir();
    let index_path = distill_dir.join("index.jsonl");

    if !index_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
    let mut docs: Vec<DistillDocument> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            let mut doc: DistillDocument = serde_json::from_str(line).ok()?;
            // Use actual file modification time instead of index.jsonl date
            let file_path = distill_dir.join(&doc.file);
            if let Ok(metadata) = fs::metadata(&file_path) {
                if let Ok(modified) = metadata.modified() {
                    let datetime: chrono::DateTime<chrono::Local> = modified.into();
                    doc.date = datetime.format("%Y-%m-%dT%H:%M:%S").to_string();
                }
            }
            Some(doc)
        })
        .collect();

    // Sort by date descending (newest first)
    docs.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(docs)
}

#[tauri::command]
pub fn find_session_project(session_id: String) -> Result<Option<Session>, String> {
    let projects_dir = security::get_claude_dir_or_fallback().join("projects");
    if !projects_dir.exists() {
        return Ok(None);
    }

    for project_entry in fs::read_dir(&projects_dir).map_err(|e| e.to_string())? {
        let project_entry = project_entry.map_err(|e| e.to_string())?;
        let project_path = project_entry.path();

        if !project_path.is_dir() {
            continue;
        }

        let session_file = project_path.join(format!("{}.jsonl", session_id));
        if session_file.exists() {
            let project_id = project_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let display_path = decode_project_path(&project_id);
            let content = fs::read_to_string(&session_file).unwrap_or_default();

            let mut summary = None;
            for line in content.lines() {
                if let Ok(parsed) = serde_json::from_str::<RawLine>(line) {
                    if parsed.line_type.as_deref() == Some("summary") {
                        summary = parsed.summary;
                        break;
                    }
                }
            }

            return Ok(Some(Session {
                id: session_id,
                project_id,
                project_path: Some(display_path),
                summary,
                message_count: 0,
                last_modified: 0,
            }));
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn get_distill_watch_enabled() -> bool {
    DISTILL_WATCH_ENABLED.load(std::sync::atomic::Ordering::Relaxed)
}

#[tauri::command]
pub fn set_distill_watch_enabled(enabled: bool) {
    DISTILL_WATCH_ENABLED.store(enabled, std::sync::atomic::Ordering::Relaxed);
}
