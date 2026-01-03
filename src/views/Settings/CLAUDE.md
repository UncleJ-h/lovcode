# src/views/Settings/ - 设置页面

> L2 | 父级: views/CLAUDE.md

用户配置管理模块，包含环境变量、代理预设、Context文件等

---

## 目录结构

```
Settings/
├── SettingsView.tsx              # 主视图组件 (149行)
├── SettingsEnvSection.tsx        # 环境变量管理子组件 (346行)
├── SettingsProxySection.tsx      # 代理预设管理子组件 (844行)
├── SettingsContextSection.tsx    # Context文件显示子组件 (53行)
├── ClaudeCodeVersionSection.tsx  # 版本信息组件
├── hooks/
│   └── useSettingsState.ts       # 共享状态管理 (201行)
└── index.ts                      # 导出文件
```

---

## 成员清单

| 文件 | 行数 | 职责 | 状态 |
|------|------|------|------|
| `SettingsView.tsx` | 149 | 主视图·组件编排 | ✅ |
| `SettingsEnvSection.tsx` | 346 | 环境变量管理·增删改查·启用/禁用 | ✅ |
| `SettingsProxySection.tsx` | 844 | 代理预设·测试连接·应用配置 | ✅ |
| `SettingsContextSection.tsx` | 53 | Context文件列表·settings.json显示 | ✅ |
| `ClaudeCodeVersionSection.tsx` | ~50 | Claude Code版本信息 | ✅ |
| `hooks/useSettingsState.ts` | 201 | 状态管理·数据查询·工具函数 | ✅ |

---

## 组件职责

### SettingsView.tsx
- **INPUT**: MarketplaceItem[], 回调函数
- **OUTPUT**: 完整的设置页面
- **职责**:
  - 页面布局和组件编排
  - 调用子组件
  - 处理 Corporate Proxy 应用逻辑

### SettingsEnvSection.tsx
- **INPUT**: 环境变量状态、setter函数、refreshSettings
- **OUTPUT**: 环境变量管理 UI
- **职责**:
  - 环境变量增删改查
  - 启用/禁用环境变量
  - 值显示/隐藏切换
  - Corporate Proxy快捷应用

### SettingsProxySection.tsx
- **INPUT**: 代理相关状态、模板数据、rawEnv
- **OUTPUT**: 代理预设管理 UI
- **职责**:
  - 代理预设列表展示（官方/第三方分组）
  - 测试连接功能（UniVibe/SiliconFlow/ZenMux/ModelGate）
  - 应用配置
  - 缺失值提示和填充
  - Analytics开关

### SettingsContextSection.tsx
- **INPUT**: 过滤后的Context文件、settings数据
- **OUTPUT**: Context文件和配置展示
- **职责**:
  - 显示全局Context文件列表
  - 显示settings.json配置

### hooks/useSettingsState.ts
- **INPUT**: 无
- **OUTPUT**: 完整的状态对象和工具函数
- **职责**:
  - 数据查询（settings, contextFiles, settingsPath）
  - 状态管理（搜索、编辑、测试、应用等）
  - 计算属性（过滤、排序等）
  - 工具函数（refreshSettings, getRawEnvFromSettings等）

---

## 重构历史

### 2025-01-03: 大重构

**原问题**:
- SettingsView.tsx 1270行，职责混杂
- 环境变量、代理预设、Context管理代码混在一起
- 状态管理分散，难以维护

**解决方案**:
1. 创建 `useSettingsState.ts` 集中管理状态
2. 拆分为3个功能子组件：
   - SettingsEnvSection: 环境变量管理
   - SettingsProxySection: 代理预设管理
   - SettingsContextSection: Context文件显示
3. 主文件只负责组件编排

**成果**:
- 主文件从1270行减少到149行 (减少88%)
- 代码职责清晰，易于维护和测试
- 类型检查通过，功能完全一致

---

## 代理预设支持列表

| Key | 名称 | 测试方式 | 文档 |
|-----|------|----------|------|
| `anthropic-subscription` | Anthropic Subscription | OAuth | - |
| `native` | Anthropic API | - | - |
| `univibe` | UniVibe | `test_claude_cli` | [docs](https://www.univibe.cc/console/docs/claudecode) |
| `siliconflow` | SiliconFlow | `test_openai_connection` | [docs](https://docs.siliconflow.com/en/userguide/quickstart) |
| `zenmux` | ZenMux | `test_anthropic_connection` | [docs](https://docs.zenmux.ai/best-practices/claude-code.html) |
| `modelgate` | ModelGate | `test_anthropic_connection` | [docs](https://docs.modelgate.net/guide/tools/claude-code.html) |
| `qiniu` | Qiniu Cloud | - | [docs](https://developer.qiniu.com/aitokenapi/13085/claude-code-configuration-instructions) |

---

## 环境变量操作

```typescript
// 增
await invoke("update_settings_env", { envKey, envValue, isNew: true });

// 改
await invoke("update_settings_env", { envKey, envValue });
await invoke("update_disabled_settings_env", { envKey, envValue });

// 删
await invoke("delete_settings_env", { envKey });

// 启用/禁用
await invoke("disable_settings_env", { envKey });
await invoke("enable_settings_env", { envKey });
```

---

[PROTOCOL]: 变更时更新此文档，然后检查 views/CLAUDE.md
