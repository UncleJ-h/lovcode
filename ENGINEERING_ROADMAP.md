# Lovcode Engineering Excellence Roadmap

> 从创业公司早期水准 → 世界顶尖工程团队标准

## 当前状态评估

```
工程成熟度: 82/100 (提升 +44)

已完成:
- ✅ 安全漏洞修复 (路径遍历、命令注入)
- ✅ 错误处理改进 (.unwrap() → Result)
- ✅ 测试覆盖率 79%+ (前端)
- ✅ 可观测性 (Sentry, Web Vitals, Logger)
- ✅ 代码模块化 (lib.rs 6384行 → 804行)
- ✅ CI/CD 管线
- ✅ 完整文档 (API, 架构, 贡献指南)
- ✅ 性能优化 (memo, lazy loading, 静态正则)
```

---

## Phase 1: 安全加固 (P0 - 立即)

### 1.1 修复安全漏洞

- [ ] **SEC-001**: 修复路径遍历攻击
  - 文件: `src-tauri/src/lib.rs:325` `decode_project_path`
  - 风险: 高 - 可访问任意文件系统路径
  - 方案: 添加路径验证，检查 `..` 和 canonicalize

- [ ] **SEC-002**: 修复命令注入
  - 文件: `src-tauri/src/lib.rs:5101` `install_claude_code_version`
  - 风险: 高 - 可执行任意 shell 命令
  - 方案: 验证 version 参数格式 (semver only)

- [ ] **SEC-003**: 配置 CSP
  - 文件: `src-tauri/tauri.conf.json`
  - 当前: `"csp": null`
  - 方案: 设置合理的 Content-Security-Policy

### 1.2 消除 Panic 风险

- [ ] **PANIC-001**: 替换所有 `.unwrap()` 为错误处理
  - 涉及: 38+ 处
  - 优先: `get_claude_dir()`, `get_claude_json_path()`
  - 工具: `cargo clippy -- -D clippy::unwrap_used`

- [ ] **PANIC-002**: 修复 UTF-8 字符串切割
  - 文件: `src-tauri/src/diagnostics.rs:324`
  - 方案: 使用 `chars().take(n)` 替代字节索引

### 1.3 添加错误边界 (前端)

- [ ] **ERR-001**: 全局 ErrorBoundary 组件
- [ ] **ERR-002**: 功能级 ErrorBoundary
- [ ] **ERR-003**: 替换 `.catch(() => {})` 为用户反馈

---

## Phase 2: 工程基础设施 (P1 - 1周内)

### 2.1 代码质量工具

- [ ] **INFRA-001**: 配置 pre-commit hooks
  ```bash
  # 安装 husky
  pnpm add -D husky lint-staged
  pnpm exec husky init
  ```

- [ ] **INFRA-002**: 配置 Rust Clippy 严格模式
  ```toml
  # Cargo.toml
  [lints.clippy]
  unwrap_used = "deny"
  expect_used = "warn"
  pedantic = "warn"
  ```

- [ ] **INFRA-003**: 配置 ESLint 规则
  - 禁止 `console.log` (warn)
  - 要求错误处理
  - 强制类型注解

### 2.2 CI/CD 增强

- [ ] **CI-001**: 添加 Rust 测试 job
- [ ] **CI-002**: 添加前端测试 job
- [ ] **CI-003**: 添加安全扫描 (cargo audit, npm audit)
- [ ] **CI-004**: 添加 bundle size 检查

### 2.3 原子文件写入

- [ ] **FILE-001**: `workspace_store.rs` 使用临时文件+重命名
- [ ] **FILE-002**: 所有配置写入使用原子操作

---

## Phase 3: 代码重构 (P1 - 2周内)

### 3.1 Rust 模块拆分

将 `lib.rs` (6384行) 拆分为:

```
src-tauri/src/
├── lib.rs              # 入口，<200行
├── commands/
│   ├── mod.rs
│   ├── projects.rs     # list_projects, list_sessions
│   ├── search.rs       # build_search_index, search_chats
│   ├── commands.rs     # list_local_commands, etc.
│   ├── settings.rs     # get_settings, update_settings
│   └── workspace.rs    # workspace_* commands
├── services/
│   ├── mod.rs
│   ├── jieba.rs        # 中文分词
│   └── tantivy.rs      # 全文搜索
├── errors.rs           # 统一错误类型
├── diagnostics.rs      # (已存在)
├── pty_manager.rs      # (已存在)
├── workspace_store.rs  # (已存在)
└── hook_watcher.rs     # (已存在)
```

- [ ] **REFACTOR-001**: 创建 commands/ 目录结构
- [ ] **REFACTOR-002**: 提取 projects 相关命令
- [ ] **REFACTOR-003**: 提取 search 相关命令
- [ ] **REFACTOR-004**: 提取 settings 相关命令
- [ ] **REFACTOR-005**: 创建统一错误类型 (thiserror)

### 3.2 前端状态管理统一

- [ ] **STATE-001**: 删除 `useNavigation.ts` (未使用)
- [ ] **STATE-002**: 统一使用 `useNavigate.ts`
- [ ] **STATE-003**: 移除 App.tsx 中重复的导航逻辑
- [ ] **STATE-004**: 简化 `viewAtom` 设计

### 3.3 组件拆分

- [ ] **COMP-001**: 拆分 `CommandsView.tsx` (677行)
- [ ] **COMP-002**: 拆分 `WorkspaceView.tsx`
- [ ] **COMP-003**: 添加 React.memo 优化

---

## Phase 4: 测试体系 (P2 - 3周内)

### 4.1 Rust 单元测试

- [ ] **TEST-R001**: 路径编解码测试
- [ ] **TEST-R002**: 搜索索引测试
- [ ] **TEST-R003**: 配置解析测试
- [ ] **TEST-R004**: 命令迁移测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_project_path_prevents_traversal() {
        assert!(decode_project_path("..--etc--passwd").is_err());
    }
}
```

### 4.2 前端单元测试

- [ ] **TEST-F001**: 配置 Vitest
- [ ] **TEST-F002**: 导航 store 测试
- [ ] **TEST-F003**: 工具函数测试

### 4.3 E2E 测试

- [ ] **TEST-E001**: 配置 Playwright
- [ ] **TEST-E002**: 核心用户流程测试

---

## Phase 5: 可观测性 (P2 - 4周内)

### 5.1 错误追踪

- [ ] **OBS-001**: 集成 Sentry (前端)
- [ ] **OBS-002**: 集成错误上报 (Rust)

### 5.2 日志系统

- [ ] **OBS-003**: 添加 tracing (Rust)
- [ ] **OBS-004**: 结构化日志格式

### 5.3 性能监控

- [ ] **OBS-005**: 关键操作耗时埋点
- [ ] **OBS-006**: Bundle 大小监控

---

## Phase 6: 持续改进 (P3 - 持续)

### 6.1 文档

- [ ] **DOC-001**: API 文档 (Tauri commands)
- [ ] **DOC-002**: 架构文档
- [ ] **DOC-003**: 贡献指南

### 6.2 开发体验

- [ ] **DX-001**: PR 模板
- [ ] **DX-002**: Issue 模板
- [ ] **DX-003**: CODEOWNERS

---

## 进度追踪

| Phase | 目标 | 状态 | 完成日期 |
|-------|------|------|----------|
| Phase 1 | 安全加固 | ✅ 已完成 | 2025-01-03 |
| Phase 2 | 测试基础设施 | ✅ 已完成 | 2025-01-03 |
| Phase 3 | 可观测性 | ✅ 已完成 | 2025-01-03 |
| Phase 4 | 文档与 DX | ✅ 已完成 | 2025-01-03 |
| Phase 5 | 性能优化 | ✅ 已完成 | 2025-01-04 |
| Phase 6 | 持续改进 | 🟡 进行中 | 持续 |

---

## 成功指标

| 指标 | 初始 | 当前 | 目标 | 状态 |
|------|------|------|------|------|
| 安全漏洞 | 3 | 0 | 0 | ✅ |
| `.unwrap()` 数量 | 38+ | 0 (非测试) | 0 | ✅ |
| 测试覆盖率 | 0% | 79% | 60%+ | ✅ |
| lib.rs 行数 | 6384 | 495 | <500 | ✅ |
| 最大单文件行数 | 6384 | 495 | <400 | 🟡 |
| CI 检查项 | 1 | 8+ | 8+ | ✅ |
| 工程成熟度 | 38/100 | 85/100 | 70/100 | ✅ |

---

## 已完成工作总结

### Phase 1: 安全加固 ✅
- 修复路径遍历漏洞 (`security.rs`)
- 修复命令注入漏洞 (版本验证)
- 配置 CSP
- 原子化文件写入
- 添加 ErrorBoundary

### Phase 2: 测试基础设施 ✅
- Rust 单元测试 (92 tests)
- 前端 Hook 测试 (55 tests, 79% coverage)
- Playwright E2E 框架
- GitHub Actions CI/CD
- Coverage gates (30%)

### Phase 3: 可观测性 ✅
- Sentry 错误追踪
- Web Vitals 性能监控
- Bundle 大小分析 (treemap)
- 结构化日志系统

### Phase 4: 文档与 DX ✅
- API 文档 (docs/API.md)
- 架构文档 (docs/ARCHITECTURE.md)
- 贡献指南 (docs/CONTRIBUTING.md)
- Issue/PR 模板
- CODEOWNERS 配置

### Phase 5: 性能优化 ✅
- React.memo 优化关键组件 (FeatureTab, FeatureButton, FilePath)
- 列表虚拟化 (VirtualChatList 已存在)
- 代码分割与懒加载 (LazyViews.tsx, AnnualReport)
- Rust 正则表达式静态编译 (LazyLock)

### Phase 6: 持续改进 🟡
- lib.rs 模块化拆分 (804行 → 495行)
- 新增命令模块: pty.rs, workspace.rs, hooks.rs, diagnostics.rs, sessions.rs
- 清理所有非测试代码中的 `.unwrap()` 调用
- commands/ 模块现有 17 个子模块
