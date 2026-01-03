# src/components/ - UI 组件库

> L2 | 父级: src/CLAUDE.md

React 19 + shadcn/ui + Tailwind CSS + Radix UI

---

## 目录结构

```
components/
├── ui/             # shadcn/ui 基础组件封装
├── shared/         # 业务通用组件
├── GlobalHeader/   # 全局头部·导航·功能标签
├── home/           # 首页专用组件
├── Terminal/       # xterm.js 终端
├── PanelGrid/      # 可调整面板布局
├── FileTree/       # 文件树组件
├── FileViewer/     # 文件查看器
├── config/         # 配置组件
├── MarkdownRenderer.tsx   # Markdown 渲染
├── DocumentReader.tsx     # 文档阅读器
└── ContextFileItem.tsx    # 上下文文件项
```

---

## 成员清单

### ui/ - shadcn/ui 基础组件

| 文件 | 职责 |
|------|------|
| `button.tsx` | 按钮 (Primary/Secondary/Ghost) |
| `dialog.tsx` | 对话框 |
| `dropdown-menu.tsx` | 下拉菜单 |
| `context-menu.tsx` | 右键菜单 |
| `tabs.tsx` | 标签页 |
| `input.tsx` | 输入框 |
| `select.tsx` | 选择框 |
| `label.tsx` | 标签 |
| `switch.tsx` | 开关 |
| `tooltip.tsx` | 提示 |
| `popover.tsx` | 弹出层 |
| `avatar.tsx` | 头像 |
| `collapsible.tsx` | 可折叠 |
| `new-terminal-button.tsx` | 新建终端按钮 |

### shared/ - 业务通用组件

| 文件 | 职责 |
|------|------|
| `NavSidebar.tsx` | 导航侧边栏 |
| `SidebarLayout.tsx` | 侧边栏布局模板 |
| `FeatureButton.tsx` | 功能按钮 |
| `FilePath.tsx` | 文件路径显示 |
| `CodePreview.tsx` | 代码预览 |
| `CollapsibleCard.tsx` | 可折叠卡片 |
| `SessionMenuItems.tsx` | 会话菜单项 |
| `BrowseMarketplaceButton.tsx` | 市场浏览按钮 |

### GlobalHeader/ - 全局头部

| 文件 | 职责 |
|------|------|
| `GlobalHeader.tsx` | 主头部组件 |
| `GlobalFeatureTabs.tsx` | 功能标签组 |
| `FeatureTabGroup.tsx` | 标签分组 |
| `FeatureTab.tsx` | 单个标签 |
| `VerticalFeatureTabs.tsx` | 垂直标签 |
| `CreateFeatureDialog.tsx` | 创建功能对话框 |

### home/ - 首页组件

| 文件 | 职责 |
|------|------|
| `FeaturedCarousel.tsx` | 特色轮播 |
| `ActivityHeatmap.tsx` | 活动热力图 |
| `RecentActivity.tsx` | 近期活动 |
| `CommandTrendChart.tsx` | 命令趋势图 |
| `QuickActions.tsx` | 快捷操作 |

### Terminal/ - 终端组件

| 文件 | 职责 | 状态 |
|------|------|------|
| `TerminalPane.tsx` | 终端面板主组件 | ⚠️ 内存泄漏风险 |
| `terminalPool.ts` | 终端实例池管理 | ✅ |

### 其他

| 文件 | 职责 |
|------|------|
| `PanelGrid/` | 可调整大小的面板网格 |
| `FileTree/` | 文件树浏览 |
| `FileViewer/` | 文件内容查看 |
| `MarkdownRenderer.tsx` | Markdown → HTML |
| `DocumentReader.tsx` | 文档阅读器 |

---

## 设计规范

```typescript
// 颜色: 使用 semantic 类名
className="bg-primary text-primary-foreground"  // ✅
className="bg-[#CC785C]"                        // ❌ 禁止

// 圆角: 统一风格
className="rounded-xl"  // 卡片
className="rounded-lg"  // 按钮

// 间距: 使用 Tailwind 单位
className="p-4 gap-2"   // ✅
className="padding: 16px" // ❌
```

---

## 已知问题

### TerminalPane.tsx 内存泄漏风险

```typescript
// 问题: 事件监听器可能未正确清理
viewport.addEventListener('scroll', onScroll);
term.write(text, () => {
  viewport.removeEventListener('scroll', onScroll); // 回调未必执行
});

// 建议: 使用 AbortController
const controller = new AbortController();
viewport.addEventListener('scroll', onScroll, { signal: controller.signal });
```

---

[PROTOCOL]: 变更时更新此文档，然后检查 src/CLAUDE.md
