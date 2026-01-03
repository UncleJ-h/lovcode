# src/views/Workspace/ - 工作区视图

> L2 | 父级: src/views/CLAUDE.md

项目工作区·终端面板·功能管理

---

## 目录结构

```
Workspace/
├── WorkspaceView.tsx       # 主视图 (155行) ✅ 已模块化
├── ProjectHomeView.tsx     # 项目主页
├── ProjectDashboard.tsx    # 项目仪表盘
├── ProjectSidebar.tsx      # 项目侧边栏
├── ProjectLogo.tsx         # 项目 Logo
├── ProjectDiagnostics.tsx  # 项目诊断 (612行)
├── FeatureSidebar.tsx      # 功能侧边栏
├── FeatureTabs.tsx         # 功能标签页
├── GitHistory.tsx          # Git 历史
├── KanbanBoard.tsx         # 看板
├── LogoManager.tsx         # Logo 管理
├── types.ts                # 类型定义
├── index.ts                # 导出
└── hooks/                  # 状态与处理函数
    ├── useWorkspaceState.ts    # 状态初始化·加载·事件 (212行)
    ├── useWorkspaceHandlers.ts # 操作处理函数 (681行)
    ├── layoutUtils.ts          # 布局树工具 (55行)
    └── index.ts
```

---

## 成员清单

| 文件 | 行数 | 职责 | 状态 |
|------|------|------|------|
| `WorkspaceView.tsx` | 155 | 主视图·渲染层 | ✅ 已模块化 |
| `hooks/useWorkspaceState.ts` | 212 | 状态初始化·加载·事件监听 | ✅ |
| `hooks/useWorkspaceHandlers.ts` | 681 | Project/Feature/Panel/Session 处理函数 | ✅ |
| `hooks/layoutUtils.ts` | 55 | 布局树操作工具 | ✅ |
| `ProjectDashboard.tsx` | 438 | 项目仪表盘 | ✅ |
| `ProjectDiagnostics.tsx` | 612 | 项目诊断分析 | ⚠️ 可考虑拆分 |
| `FeatureSidebar.tsx` | 404 | 功能侧边栏 | ✅ |
| `FeatureTabs.tsx` | 282 | 功能标签页 | ✅ |
| `GitHistory.tsx` | 425 | Git 提交历史 | ✅ |
| `LogoManager.tsx` | 450 | Logo 上传管理 | ✅ |
| `KanbanBoard.tsx` | 388 | 看板视图 (借鉴 vibe-kanban) | ✅ 已增强 |
| `ProjectSidebar.tsx` | 283 | 项目侧边栏 | ✅ |
| `ProjectHomeView.tsx` | 64 | 项目主页 | ✅ |
| `ProjectLogo.tsx` | 51 | Logo 显示 | ✅ |

---

## hooks/ 详解

### useWorkspaceState

```typescript
const {
  workspace,           // WorkspaceData | null
  loading,             // boolean
  activePanelId,       // string | undefined
  setActivePanelId,    // (id: string | undefined) => void
  activeProject,       // WorkspaceProject | undefined
  activeFeature,       // Feature | undefined
  saveWorkspace,       // (updater) => Promise<void>
  allFeaturePanels,    // Map<string, PanelState[]>
} = useWorkspaceState();
```

### useWorkspaceHandlers

```typescript
const {
  // Project & Feature
  handleAddProject,
  handleAddFeature,
  // Panel
  handlePanelSplit,
  handleInitialPanelCreate,
  handlePanelClose,
  handlePanelToggleShared,
  handlePanelReload,
  // Session
  handleSessionAdd,
  handleSessionClose,
  handleSessionSelect,
  handleSessionTitleChange,
} = useWorkspaceHandlers({
  workspace,
  activeProject,
  activeFeature,
  saveWorkspace,
  setActivePanelId,
});
```

### layoutUtils

```typescript
// 分割布局节点
splitLayoutNode(node, targetPanelId, direction, newPanelId): LayoutNode

// 从布局树移除节点
removeFromLayout(node, targetPanelId): LayoutNode | null
```

---

## 重构记录 (2025-01-03)

**原问题**: `WorkspaceView.tsx` 922行，职责混杂

**解决方案**:
- 提取 `useWorkspaceState` hook (状态管理)
- 提取 `useWorkspaceHandlers` hook (操作处理)
- 提取 `layoutUtils` (布局树工具函数)

**成果**:
- 主文件从 922行 减少到 155行 (减少 83%)
- 逻辑清晰分离：状态、处理函数、渲染
- 类型检查通过，功能完全一致

---

## KanbanBoard 增强记录 (2026-01-03)

**借鉴来源**: vibe-kanban KanbanBoard

**增强内容**:
- 列头渐变背景 + 状态圆点 (视觉层次)
- 每列添加任务按钮 + Tooltip
- 卡片选中状态 (ring-2 ring-primary)
- 空列占位提示 "No tasks"
- 卡片描述预览 (line-clamp-2)
- 拖拽时 scale-105 动效

**新增 Props**:
- `selectedFeatureId?: string` - 当前选中的 Feature
- `onAddTask?: (status: FeatureStatus) => void` - 添加任务回调

---

[PROTOCOL]: 变更时更新此文档，然后检查 src/views/CLAUDE.md
