# src/store/ - Jotai 状态管理

> L2 | 父级: src/CLAUDE.md

Jotai atoms + localStorage 持久化

---

## 目录结构

```
store/
├── atoms/
│   ├── app.ts          # 应用全局状态
│   ├── chat.ts         # 聊天查看选项
│   ├── commands.ts     # 命令过滤/排序
│   ├── components.ts   # 编辑器状态
│   ├── fileTree.ts     # 文件树状态
│   ├── home.ts         # 首页数据
│   ├── knowledge.ts    # 知识库状态
│   ├── settings.ts     # 配置状态
│   ├── ui.ts           # UI 状态·导航
│   └── workspace.ts    # 工作区数据
└── index.ts            # 导出汇总
```

---

## 成员清单

| 文件 | 核心 Atoms | 职责 |
|------|-----------|------|
| `app.ts` | `tabsAtom`, `profileAtom`, `shortcutsAtom` | 标签页·用户档案·快捷键 |
| `chat.ts` | `chatViewerOptionsAtom` | 聊天查看选项 |
| `commands.ts` | `commandFilterAtom`, `commandSortAtom` | 命令过滤排序 |
| `components.ts` | `editorStateAtom` | 代码编辑器状态 |
| `fileTree.ts` | `fileTreeStateAtom` | 文件树展开状态 |
| `home.ts` | `homeDataAtom` | 首页仪表盘数据 |
| `knowledge.ts` | `knowledgeStateAtom` | 知识库选中状态 |
| `settings.ts` | `settingsAtom` | 应用配置 |
| `ui.ts` | `navigationStateAtom`, `viewAtom` | 导航·视图状态 |
| `workspace.ts` | `workspaceDataAtom` | 工作区项目数据 |

---

## 已知问题

### 🔴 ui.ts 导航状态设计问题

**问题 1**: `viewAtom` 既是派生的又有 setter

```typescript
// 当前实现 - 容易导致状态不一致
export const viewAtom = atom(
  (get) => get(navigationStateAtom).history[get(navigationStateAtom).index],
  (get, set, newView: View) => { ... }
);
```

**问题 2**: `viewHistoryAtom` 有假 setter

```typescript
// 只是为了避免 "not writable" 错误
export const viewHistoryAtom = atom(
  (get) => get(navigationStateAtom).history,
  (_get, _set, _newHistory: View[]) => {
    // Read-only in practice
  }
);
```

**建议**: 简化为纯派生 atom，写操作只通过 `navigationStateAtom`

---

## 使用模式

### 基础读写

```typescript
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { settingsAtom } from '@/store/atoms/settings';

// 读写
const [settings, setSettings] = useAtom(settingsAtom);

// 只读
const settings = useAtomValue(settingsAtom);

// 只写
const setSettings = useSetAtom(settingsAtom);
```

### 持久化 (localStorage)

```typescript
import { atomWithStorage } from 'jotai/utils';

export const settingsAtom = atomWithStorage(
  'lovcode:settings',  // key
  defaultSettings      // 默认值
);
```

### 派生状态

```typescript
import { atom } from 'jotai';

export const currentViewAtom = atom(
  (get) => get(navigationStateAtom).history[get(navigationStateAtom).index]
);
```

---

## localStorage Keys

| Key | Atom | 用途 |
|-----|------|------|
| `lovcode:settings` | `settingsAtom` | 应用配置 |
| `lovcode:profile` | `profileAtom` | 用户档案 |
| `lovcode:tabs` | `tabsAtom` | 标签页状态 |
| `lovcode:navigation` | `navigationStateAtom` | 导航历史 |

---

[PROTOCOL]: 变更时更新此文档，然后检查 src/CLAUDE.md
