# src-tauri/ - Rust 后端

> L2 | 父级: /CLAUDE.md

Rust + Tauri 2 + Tantivy (全文搜索) + PTY (终端)

---

## 目录结构

```
src-tauri/
├── src/
│   ├── lib.rs              # 核心入口 (804行) ✅ 已重构
│   ├── main.rs             # 应用入口
│   ├── errors.rs           # 统一错误类型 (thiserror)
│   ├── security.rs         # 安全验证 (路径/版本)
│   ├── types.rs            # 共享类型定义
│   ├── pty_manager.rs      # PTY 会话管理
│   ├── workspace_store.rs  # 工作区持久化
│   ├── diagnostics.rs      # 项目诊断分析
│   ├── hook_watcher.rs     # 文件监听器
│   ├── commands/           # ✅ 命令模块 (新增)
│   │   ├── mod.rs          # 模块入口·统一导出
│   │   ├── agents.rs       # Agent/Skill 管理
│   │   ├── context.rs      # 上下文文件管理
│   │   ├── files.rs        # 文件操作
│   │   ├── git.rs          # Git 操作
│   │   ├── knowledge.rs    # 知识库管理
│   │   ├── local_commands.rs # 本地命令管理
│   │   ├── marketplace.rs  # 模板市场
│   │   ├── projects.rs     # 项目和会话管理
│   │   ├── report.rs       # 报告和统计
│   │   ├── settings.rs     # 设置管理
│   │   └── version.rs      # Claude Code 版本管理
│   └── services/           # ✅ 服务模块 (新增)
│       ├── mod.rs          # 模块入口
│       └── search.rs       # 全文搜索 (Tantivy + Jieba)
├── capabilities/           # Tauri 安全能力配置
├── icons/                  # 应用图标
├── Cargo.toml              # Rust 依赖配置
└── tauri.conf.json         # Tauri 应用配置
```

---

## 成员清单

### 核心源码 (src/)

| 文件 | 行数 | 职责 | 状态 |
|------|------|------|------|
| `lib.rs` | ~800 | 应用启动·PTY·Workspace·Watcher | ✅ 已重构 |
| `main.rs` | ~20 | 应用入口 | ✅ |
| `errors.rs` | ~50 | 统一错误类型 | ✅ |
| `logging.rs` | ~50 | 结构化日志 (tracing) | ✅ 新增 |
| `security.rs` | ~200 | 路径验证·版本验证·原子写入 | ✅ |
| `types.rs` | ~150 | 共享类型定义 | ✅ |
| `pty_manager.rs` | ~300 | PTY 会话·滚动缓冲 | ✅ |
| `workspace_store.rs` | ~530 | 工作区状态持久化 (RwLock) | ✅ 线程安全 |
| `diagnostics.rs` | ~250 | 技术栈检测·密钥扫描 | ✅ |
| `hook_watcher.rs` | ~100 | 文件变更监听 | ✅ |

### 命令模块 (src/commands/)

| 文件 | 行数 | 职责 | 导出命令 |
|------|------|------|----------|
| `mod.rs` | ~70 | 统一导出 | - |
| `agents.rs` | ~130 | Agent/Skill 管理 | `list_local_agents`, `list_local_skills` |
| `context.rs` | ~180 | 上下文文件 | `get_context_files`, `get_project_context` |
| `files.rs` | ~400 | 文件操作 | `list_directory`, `read_file`, `exec_shell_command`, `save_project_logo`... |
| `git.rs` | ~350 | Git 操作 | `git_has_changes`, `git_log`, `git_auto_commit`, `git_revert`... |
| `knowledge.rs` | ~390 | 知识库 | `list_distill_documents`, `list_reference_sources`, `find_session_project`... |
| `local_commands.rs` | ~450 | 本地命令 | `list_local_commands`, `parse_frontmatter`, `archive_command`... |
| `marketplace/` | ~1200 | 模板市场 (已模块化) | `get_templates_catalog`, `install_*_template`, `uninstall_mcp_template`... |
| `projects.rs` | ~250 | 项目会话 | `list_projects`, `list_sessions`, `list_all_chats`, `decode_project_path`... |
| `report.rs` | ~480 | 报告统计 | `get_activity_stats`, `get_annual_report_2025`, `get_command_stats`... |
| `settings.rs` | ~550 | 设置管理 | `get_settings`, `update_settings_env`, `test_claude_cli`, `open_in_editor`... |
| `version.rs` | ~290 | 版本管理 | `get_claude_code_version_info`, `install_claude_code_version`... |

### 服务模块 (src/services/)

| 文件 | 行数 | 职责 | 导出函数 |
|------|------|------|----------|
| `mod.rs` | ~10 | 模块入口 | - |
| `search.rs` | ~400 | 全文搜索 | `build_search_index`, `search_chats`, `extract_content_with_meta` |

---

## ✅ 已完成重构 (2025-01-03)

### lib.rs 模块化拆分

| 指标 | 重构前 | 重构后 | 改进 |
|------|--------|--------|------|
| lib.rs 行数 | 6384 | 804 | **-87%** |
| 命令模块数 | 0 | 11 | +11 |
| 服务模块数 | 0 | 1 | +1 |
| 单一职责 | ❌ | ✅ | 符合 |

### 安全漏洞修复

| 问题 | 修复 | 状态 |
|------|------|------|
| 路径遍历攻击 | `security.rs` + `validate_decoded_path()` | ✅ |
| 命令注入 | `security.rs` + `validate_version()` | ✅ |
| CSP 配置 | `tauri.conf.json` 完整 CSP | ✅ |

### ✅ 额外修复 (2025-01-03)

| 问题 | 修复 | 状态 |
|------|------|------|
| 原子化文件写入 | `security.rs` + `atomic_write_string()` | ✅ |
| UTF-8 安全切割 | `diagnostics.rs` 使用 `.chars().take()` | ✅ |
| `.unwrap()` 残留 | 替换为 `map_err`/`ok_or_else` | ✅ |
| `get_claude_dir` 重复 | 集中到 `security.rs` | ✅ |
| marketplace 模块过大 | 拆分为 5 个子模块 | ✅ |
| workspace 竞争条件 | `RwLock` + `with_workspace_mut` | ✅ |
| 结构化日志 | `tracing` crate + `logging.rs` | ✅ |

---

## 🟡 待改进

| 问题 | 位置 | 优先级 |
|------|------|--------|
| 测试覆盖率 0% | 全局 | P2 |
| Regex 重复编译 | 多处 | P2 |
| 长操作无超时 | 网络请求等 | P2 |

---

## 模块依赖关系

```
lib.rs
├── logging.rs (初始化结构化日志)
├── commands/mod.rs ─┬── agents.rs ──────── local_commands (parse_frontmatter)
│                    ├── context.rs ─────── projects (decode_project_path)
│                    ├── files.rs
│                    ├── git.rs
│                    ├── knowledge.rs ───── projects (decode_project_path)
│                    ├── local_commands.rs
│                    ├── marketplace/ ───── (types, loader, install, statusline)
│                    ├── projects.rs
│                    ├── report.rs ──────── local_commands (list_local_commands)
│                    ├── settings.rs
│                    └── version.rs
├── services/mod.rs ─── search.rs
├── security.rs (被多个模块依赖: 路径验证, 原子写入)
├── types.rs (被多个模块依赖)
├── pty_manager.rs
├── workspace_store.rs (RwLock 线程安全)
├── diagnostics.rs
└── hook_watcher.rs
```

---

## Tauri 命令模式

```rust
// 1. 在 commands/*.rs 中定义命令
#[tauri::command]
pub fn list_projects() -> Result<Vec<Project>, String> {
    // 实现...
}

// 2. 在 commands/mod.rs 中导出
pub use projects::list_projects;

// 3. 在 lib.rs 中注册
tauri::generate_handler![
    commands::list_projects,
    // ...
]
```

---

## 依赖说明

| 依赖 | 用途 |
|------|------|
| `tantivy` | 全文搜索引擎 |
| `jieba-rs` | 中文分词 |
| `portable-pty` | 伪终端管理 |
| `notify` | 文件系统监听 |
| `reqwest` | HTTP 请求 |
| `thiserror` | 错误类型定义 |
| `anyhow` | 错误传播 |
| `chrono` | 时间处理 |
| `regex` | 正则表达式 |
| `tracing` | 结构化日志 (新增) |
| `tracing-subscriber` | 日志订阅和输出 |

---

## Clippy 配置

```toml
# Cargo.toml
[lints.clippy]
unwrap_used = "warn"
expect_used = "warn"
panic = "warn"
pedantic = "warn"
```

运行检查: `pnpm clippy` 或 `cargo clippy`

---

[PROTOCOL]: 变更时更新此文档，然后检查 /CLAUDE.md
