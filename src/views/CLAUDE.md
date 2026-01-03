# src/views/ - 功能页面

> L2 | 父级: src/CLAUDE.md

14 个功能模块，每个目录对应一个页面视图

---

## 目录结构

```
views/
├── Home/           # 首页仪表盘
├── Chat/           # 聊天历史浏览
├── Workspace/      # 项目工作区
├── Commands/       # 命令管理 (⚠️ 677行)
├── Projects/       # 项目列表
├── Skills/         # 技能模板
├── Hooks/          # 自动化钩子
├── Mcp/            # MCP 服务器
├── SubAgents/      # 子代理
├── OutputStyles/   # 输出样式
├── Knowledge/      # 知识库
├── Marketplace/    # 模板市场
├── Settings/       # 设置
├── Statusline/     # 状态栏配置
├── AnnualReport/   # 年度报告
├── Features/       # 功能管理
└── FeatureTodo/    # 功能待办
```

---

## 成员清单

| 目录 | 主文件 | 行数 | 职责 | 状态 |
|------|--------|------|------|------|
| `Home/` | `Home.tsx` | ~200 | 仪表盘·统计·快捷操作 | ✅ |
| `Chat/` | `MessageView.tsx` | ~400 | 聊天消息查看·全文搜索 | ✅ |
| `Workspace/` | `WorkspaceView.tsx` | ~300 | 项目工作区·面板布局 | ⚠️ 状态同步问题 |
| `Commands/` | `CommandsView.tsx` | 677 | 命令树·拖拽·编辑 | ⚠️ 需拆分 |
| `Projects/` | `ProjectsView.tsx` | ~150 | 项目列表 | ✅ |
| `Skills/` | `SkillsView.tsx` | ~200 | 技能模板管理 | ✅ |
| `Hooks/` | `HooksView.tsx` | ~200 | 钩子配置 | ✅ |
| `Mcp/` | `McpView.tsx` | ~250 | MCP 服务器管理 | ✅ |
| `SubAgents/` | `SubAgentsView.tsx` | ~200 | 子代理管理 | ✅ |
| `OutputStyles/` | `OutputStylesView.tsx` | ~150 | 输出样式配置 | ✅ |
| `Knowledge/` | `KnowledgeView.tsx` | ~200 | 知识库浏览 | ✅ |
| `Marketplace/` | `MarketplaceView.tsx` | ~300 | 模板市场 | ✅ |
| `Settings/` | `SettingsView.tsx` | 149 | 应用设置 | ✅ 已模块化 |
| `Statusline/` | `StatuslineView.tsx` | ~200 | 状态栏配置 | ✅ |
| `AnnualReport/` | `AnnualReport2025.tsx` | ~800 | 年度统计可视化 | ✅ |

---

## 已知问题

### 🔴 CommandsView.tsx (677行)

**现象**: 单文件过大，职责过多
**本质**: 树构建、拖拽、对话框等功能混杂

**重构建议**:
```
Commands/
├── CommandsView.tsx        # 主视图 (<200行)
├── CommandTree.tsx         # 树形结构
├── CommandItem.tsx         # 单个命令项
├── CommandDialog.tsx       # 编辑对话框
├── useCommandTree.ts       # 树构建逻辑
└── useCommandDrag.ts       # 拖拽逻辑
```

### 🟡 WorkspaceView.tsx 状态同步

**问题**: 多个 `useEffect` 和 callbacks 同时更新 `workspaceDataAtom`
**风险**: Race condition，状态可能覆盖

**建议**: 使用 `useReducer` 统一状态更新

---

## 最佳实践示例

### ✅ Settings/ 模块化重构 (2025-01-03)

**原问题**: SettingsView.tsx 1270行，职责混杂

**解决方案**:
```
Settings/
├── SettingsView.tsx              # 主视图 (149行)
├── SettingsEnvSection.tsx        # 环境变量管理 (346行)
├── SettingsProxySection.tsx      # 代理预设管理 (844行)
├── SettingsContextSection.tsx    # Context文件显示 (53行)
└── hooks/
    └── useSettingsState.ts       # 共享状态管理 (201行)
```

**成果**:
- 主文件从1270行减少到149行 (减少88%)
- 逻辑清晰分离：状态管理、环境变量、代理、Context
- 类型检查通过，功能完全一致

---

## 视图约定

```typescript
// 每个 View 导出模式
// index.ts
export { default as HomeView } from './Home';

// 主组件命名
// Home.tsx
export default function Home() { ... }
// 或
export default function HomeView() { ... }
```

---

[PROTOCOL]: 变更时更新此文档，然后检查 src/CLAUDE.md
