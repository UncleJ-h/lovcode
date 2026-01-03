# src/hooks/ - 自定义 React Hooks

> L2 | 父级: src/CLAUDE.md

React 19 自定义 Hooks

---

## 成员清单

| 文件 | 职责 | 状态 |
|------|------|------|
| `useInvokeQuery.ts` | Tauri invoke 的 React Query 封装 | ✅ |
| `useNavigate.ts` | 导航操作 (forward/back/goto) | ✅ |
| `usePtyStatus.ts` | PTY 终端状态追踪 | ✅ |
| `useFeatureCreation.ts` | 功能创建工作流 | ✅ |
| `useResize.ts` | 拖拽调整大小 + localStorage 持久化 | ✅ |
| `index.ts` | 导出汇总 | ✅ |

---

## Hook 详解

### useInvokeQuery

```typescript
// Tauri invoke + React Query 封装
const { data, isLoading, error } = useInvokeQuery<Project[]>(
  ['projects'],        // queryKey
  'list_projects',     // Tauri command name
  {}                   // args (可选)
);
```

### useNavigate

```typescript
const navigate = useNavigate();

// 导航到新视图
navigate({ type: 'chat', projectId: '...' });

// 后退
navigate.back();

// 前进
navigate.forward();
```

### usePtyStatus

```typescript
const { isActive, sessionId } = usePtyStatus();
```

### useResize

```typescript
const { size, onResize } = useResize('panel-width', 300);
// size: 当前尺寸
// onResize: (newSize: number) => void
// 自动持久化到 localStorage
```

---

[PROTOCOL]: 变更时更新此文档，然后检查 src/CLAUDE.md
