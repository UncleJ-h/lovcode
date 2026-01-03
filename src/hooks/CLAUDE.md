# src/hooks/ - 自定义 React Hooks

> L2 | 父级: src/CLAUDE.md

React 19 自定义 Hooks

---

## 成员清单

| 文件 | 职责 | 状态 |
|------|------|------|
| `useInvokeQuery.ts` | Tauri invoke 的 React Query 封装 | ✅ |
| `useNavigate.ts` | 导航操作 (forward/back/goto) | ✅ 主导航 |
| `useNavigation.ts` | 独立 localStorage 导航 | ⚠️ 应删除 |
| `usePtyStatus.ts` | PTY 终端状态追踪 | ✅ |
| `useFeatureCreation.ts` | 功能创建工作流 | ✅ |
| `useResize.ts` | 拖拽调整大小 + localStorage 持久化 | ✅ |
| `index.ts` | 导出汇总 | ✅ |

---

## 已知问题

### 🔴 两套导航系统

**问题**: `useNavigate.ts` 和 `useNavigation.ts` 功能重叠

| Hook | 状态来源 | 使用情况 |
|------|---------|---------|
| `useNavigate.ts` | `navigationStateAtom` (Jotai) | App.tsx 使用 |
| `useNavigation.ts` | 独立 localStorage | 未被使用 |

**建议**: 删除 `useNavigation.ts`，统一使用 `useNavigate.ts`

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
