# src/ - React 前端

> L2 | 父级: /CLAUDE.md

React 19 + TypeScript + Vite + Tailwind CSS + Jotai

---

## 目录结构

```
src/
├── components/     # UI 组件 (7 子目录)
├── views/          # 页面视图 (14 功能模块)
├── store/          # Jotai 状态管理
├── hooks/          # 自定义 React Hooks
├── types/          # TypeScript 类型定义
├── context/        # React Context
├── lib/            # 工具函数
├── constants/      # 常量定义
├── App.tsx         # 根组件·路由·全局状态
└── main.tsx        # 入口文件
```

---

## 成员清单

### 入口文件

| 文件 | 职责 |
|------|------|
| `main.tsx` | 应用入口，挂载 React 到 DOM |
| `App.tsx` | 根组件，布局、全局状态 (145行) ✅ |
| `vite-env.d.ts` | Vite 环境类型声明 |

### 子目录

| 目录 | 职责 | 详见 |
|------|------|------|
| `components/` | UI 组件库 | `components/CLAUDE.md` |
| `views/` | 功能页面 | `views/CLAUDE.md` |
| `store/` | Jotai atoms | `store/CLAUDE.md` |
| `hooks/` | 自定义 Hooks | `hooks/CLAUDE.md` |
| `types/` | 类型定义 | 单文件 `index.ts` |
| `context/` | React Context | 单文件 `AppConfigContext.tsx` |
| `lib/` | 工具函数 | `utils.ts`, `analytics.ts` |
| `constants/` | 常量 | 单文件 `index.ts` |

---

## 已知问题

### ✅ 架构问题已修复 (2025-01-03)

1. **App.tsx 已拆分** (606行 → 145行)
   - `useAppNavigation` hook: 导航逻辑
   - `AppRouter` component: 路由渲染
   - `AppSettingsDialog`, `ProfileDialog`: 对话框组件

### 🟡 代码质量

- 部分 `useEffect` 依赖数组不完整
- 缺少 `React.memo` 性能优化

### ✅ 已修复 (2025-01-03)

- ~~两套导航系统并存~~ → 删除 `useNavigation.ts`，统一使用 `useNavigate.ts`
- ~~错误处理缺失~~ → 使用 `errorHandler.ts` 统一处理
- ~~缺少 Error Boundary~~ → 已添加 `ErrorBoundary.tsx`

---

## 状态管理模式

```typescript
// Jotai atom 定义
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// 持久化状态 (localStorage)
export const settingsAtom = atomWithStorage('lovcode:settings', defaultSettings);

// 派生状态
export const viewAtom = atom(
  (get) => get(navigationStateAtom).history[get(navigationStateAtom).index]
);
```

---

## 前后端通信模式

```typescript
import { invoke } from '@tauri-apps/api/core';
import { useInvokeQuery } from '@/hooks/useInvokeQuery';

// 方式1: 直接调用
const result = await invoke<Project[]>('list_projects');

// 方式2: React Query 封装 (推荐)
const { data, isLoading, error } = useInvokeQuery(['projects'], 'list_projects');
```

---

[PROTOCOL]: 变更时更新此文档，然后检查 /CLAUDE.md
