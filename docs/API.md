# Lovcode Tauri Commands API

> Complete reference for all Tauri IPC commands

## Table of Contents

- [Projects](#projects)
- [Settings](#settings)
- [Files](#files)
- [Git](#git)
- [Local Commands](#local-commands)
- [Agents & Skills](#agents--skills)
- [Knowledge Base](#knowledge-base)
- [Marketplace](#marketplace)
- [Reports](#reports)
- [Version Management](#version-management)

---

## Projects

Commands for managing Claude Code projects and sessions.

### `list_projects`

List all projects with Claude Code sessions.

**Returns:** `Project[]`

```typescript
interface Project {
  id: string;           // Encoded project path
  path: string;         // Original project path
  session_count: number;
  last_active: number;  // Unix timestamp
}

// Usage
const projects = await invoke<Project[]>('list_projects');
```

### `list_sessions`

List sessions for a specific project.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `project_id` | `string` | Encoded project path |

**Returns:** `Session[]`

```typescript
interface Session {
  id: string;
  project_id: string;
  project_path: string | null;
  summary: string | null;
  message_count: number;
  last_modified: number;
}

const sessions = await invoke<Session[]>('list_sessions', { projectId: 'encoded-path' });
```

### `list_all_sessions`

List all sessions across all projects.

**Returns:** `Session[]`

### `list_all_chats`

List all chat messages with pagination.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `page` | `number` | Page number (0-indexed) |
| `page_size` | `number` | Items per page |

**Returns:** `ChatsResponse`

```typescript
interface ChatsResponse {
  items: ChatMessage[];
  total: number;
}
```

### `decode_project_path`

Decode an encoded project path back to original path.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `encoded` | `string` | Encoded project path |

**Returns:** `string`

### `read_session_head`

Read first N messages from a session file.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `session_path` | `string` | Path to session JSONL file |
| `count` | `number` | Number of messages to read |

**Returns:** `Message[]`

---

## Settings

Commands for managing Claude Code settings.

### `get_settings`

Get all Claude Code settings.

**Returns:** `ClaudeSettings`

```typescript
interface ClaudeSettings {
  raw: Record<string, unknown> | null;
  permissions: Record<string, unknown> | null;
  hooks: Record<string, unknown[]> | null;
  mcp_servers: McpServer[];
}
```

### `get_settings_path`

Get path to Claude settings file.

**Returns:** `string`

### `get_home_dir`

Get user's home directory path.

**Returns:** `string`

### `get_mcp_config_path`

Get path to MCP configuration file.

**Returns:** `string`

### `update_settings_env`

Update an environment variable in settings.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `mcp_name` | `string` | MCP server name |
| `key` | `string` | Environment variable key |
| `value` | `string` | New value |

### `update_mcp_env`

Update MCP server environment configuration.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `mcp_name` | `string` | MCP server name |
| `env` | `Record<string, string>` | Environment variables |

### `delete_settings_env`

Delete an environment variable from settings.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `mcp_name` | `string` | MCP server name |
| `key` | `string` | Environment variable key |

### `enable_settings_env` / `disable_settings_env`

Enable or disable an environment variable.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `mcp_name` | `string` | MCP server name |
| `key` | `string` | Environment variable key |

### `test_claude_cli`

Test if Claude CLI is available and working.

**Returns:** `boolean`

### `test_anthropic_connection` / `test_openai_connection`

Test API connections.

**Returns:** `boolean`

### `open_in_editor`

Open a file in the default code editor.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | File path |

### `open_file_at_line`

Open a file at a specific line.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | File path |
| `line` | `number` | Line number |

### `reveal_path` / `open_path`

Reveal or open a path in the file manager.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Path to reveal/open |

### `copy_to_clipboard`

Copy text to system clipboard.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `text` | `string` | Text to copy |

### `write_file` / `write_binary_file`

Write content to a file.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | File path |
| `content` | `string` / `Vec<u8>` | File content |

---

## Files

Commands for file system operations.

### `list_directory`

List contents of a directory.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Directory path |

**Returns:** `FileMetadata[]`

```typescript
interface FileMetadata {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
}
```

### `read_file`

Read file contents as text.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | File path |

**Returns:** `string`

### `read_file_base64`

Read file contents as base64.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | File path |

**Returns:** `string`

### `get_file_metadata`

Get metadata for a file.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | File path |

**Returns:** `FileMetadata`

### `exec_shell_command`

Execute a shell command.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `command` | `string` | Command to execute |
| `cwd` | `string?` | Working directory |

**Returns:** `string` (stdout)

### `save_project_logo` / `get_project_logo` / `delete_project_logo`

Manage project logos.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `project_id` | `string` | Encoded project path |
| `logo_data` | `string?` | Base64 logo data (for save) |

### `list_project_logos`

List available logos for a project.

**Returns:** `string[]` (file paths)

### `copy_file_to_project_assets`

Copy a file to project assets directory.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `source_path` | `string` | Source file path |
| `project_id` | `string` | Target project ID |

---

## Git

Commands for Git operations.

### `git_has_changes`

Check if directory has uncommitted changes.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Repository path |

**Returns:** `boolean`

### `git_log`

Get Git commit history.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Repository path |
| `count` | `number?` | Number of commits |

**Returns:** `GitCommit[]`

### `git_auto_commit`

Auto-commit all changes with generated message.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Repository path |
| `message` | `string?` | Custom commit message |

### `git_revert`

Revert to a specific commit.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Repository path |
| `commit_hash` | `string` | Commit to revert to |

### `git_generate_changelog`

Generate changelog from commits.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Repository path |
| `from_commit` | `string?` | Start commit |
| `to_commit` | `string?` | End commit |

**Returns:** `string`

### `git_get_note` / `git_set_note`

Get or set Git notes on commits.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Repository path |
| `commit_hash` | `string` | Commit hash |
| `note` | `string?` | Note content (for set) |

---

## Local Commands

Commands for managing Claude Code slash commands.

### `list_local_commands`

List all local slash commands.

**Returns:** `LocalCommand[]`

```typescript
interface LocalCommand {
  name: string;
  path: string;
  description: string | null;
  allowed_tools: string | null;
  argument_hint: string | null;
  content: string;
  version: string | null;
  status: 'active' | 'deprecated' | 'archived';
  deprecated_by: string | null;
  changelog: string | null;
  aliases: string[];
  frontmatter: string | null;
}
```

### `parse_frontmatter`

Parse YAML frontmatter from a command file.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `content` | `string` | File content |

**Returns:** `Record<string, unknown> | null`

### `rename_command`

Rename a command file.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `old_name` | `string` | Current name |
| `new_name` | `string` | New name |

### `deprecate_command`

Mark a command as deprecated.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Command name |
| `replaced_by` | `string?` | Replacement command |

### `archive_command` / `restore_command`

Archive or restore a command.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Command name |

### `update_command_aliases`

Update command aliases.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Command name |
| `aliases` | `string[]` | New aliases |

### `add_frontmatter_field` / `update_frontmatter_field`

Manage frontmatter fields.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | File path |
| `key` | `string` | Field key |
| `value` | `string` | Field value |

---

## Agents & Skills

Commands for managing agents and skills.

### `list_local_agents`

List all local agents.

**Returns:** `LocalAgent[]`

```typescript
interface LocalAgent {
  name: string;
  path: string;
  description: string | null;
  model: string | null;
  tools: string | null;
  content: string;
}
```

### `list_local_skills`

List all local skills.

**Returns:** `LocalSkill[]`

```typescript
interface LocalSkill {
  name: string;
  path: string;
  description: string | null;
  content: string;
}
```

### `list_coding_agents`

List all detected coding agents (Claude Code, Cursor, etc.).

**Returns:** `CodingAgentInfo[]`

```typescript
interface CodingAgentInfo {
  id: string;
  name: string;
  description: string;
  command: string;
  availability: AgentAvailability;
  capabilities: AgentCapability[];
  mcp_config_path: string | null;
  website: string | null;
}
```

### `get_coding_agent_info`

Get detailed info for a specific coding agent.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `agent_id` | `string` | Agent identifier |

**Returns:** `CodingAgentInfo`

---

## Knowledge Base

Commands for knowledge management.

### `list_distill_documents`

List distilled knowledge documents.

**Returns:** `DistillDocument[]`

```typescript
interface DistillDocument {
  date: string;
  file: string;
  title: string;
  tags: string[];
  session: string | null;
}
```

### `get_distill_dir`

Get path to distill documents directory.

**Returns:** `string`

### `get_distill_watch_enabled` / `set_distill_watch_enabled`

Get or set distill watch mode.

**Returns/Parameters:** `boolean`

### `list_reference_sources`

List reference documentation sources.

**Returns:** `ReferenceSource[]`

### `list_reference_docs`

List documents from a reference source.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `source` | `string` | Source name |

**Returns:** `ReferenceDoc[]`

### `find_session_project`

Find the project for a session.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `session_id` | `string` | Session ID |

**Returns:** `Project | null`

---

## Marketplace

Commands for the template marketplace.

### `get_templates_catalog`

Get all templates from the marketplace.

**Returns:** `TemplatesCatalog`

```typescript
interface TemplatesCatalog {
  settings: TemplateComponent[];
  commands: TemplateComponent[];
  mcps: TemplateComponent[];
  skills: TemplateComponent[];
  hooks: TemplateComponent[];
  agents: TemplateComponent[];
  statuslines: TemplateComponent[];
  'output-styles': TemplateComponent[];
  sources?: SourceInfo[];
}
```

### `install_*_template`

Install templates by type:
- `install_command_template`
- `install_setting_template`
- `install_mcp_template`
- `install_hook_template`
- `install_statusline_template`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `template` | `TemplateComponent` | Template to install |

### `uninstall_mcp_template`

Uninstall an MCP template.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | MCP name |

### `check_mcp_installed`

Check if an MCP is installed.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | MCP name |

**Returns:** `boolean`

### Statusline Management

- `apply_statusline` - Apply statusline configuration
- `remove_statusline_template` - Remove statusline
- `has_previous_statusline` - Check for previous statusline
- `restore_previous_statusline` - Restore previous
- `update_settings_statusline` / `remove_settings_statusline` - Settings-based statusline
- `write_statusline_script` - Write statusline script

---

## Reports

Commands for analytics and reports.

### `get_activity_stats`

Get activity statistics.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `days` | `number?` | Number of days to analyze |

**Returns:** `ActivityStats`

### `get_command_stats`

Get command usage statistics.

**Returns:** `CommandStats[]`

### `get_command_weekly_stats`

Get weekly command usage.

**Returns:** `WeeklyStats`

### `get_annual_report_2025`

Get 2025 annual usage report.

**Returns:** `AnnualReport2025`

```typescript
interface AnnualReport2025 {
  total_sessions: number;
  total_messages: number;
  total_commands: number;
  active_days: number;
  first_chat_date: string | null;
  last_chat_date: string | null;
  peak_hour: number;
  peak_hour_count: number;
  peak_weekday: number;
  total_projects: number;
  favorite_project: FavoriteProject | null;
  top_commands: TopCommand[];
  longest_streak: number;
  daily_activity: Record<string, number>;
  hourly_distribution: Record<string, number>;
}
```

---

## Version Management

Commands for Claude Code version management.

### `get_claude_code_version_info`

Get Claude Code version information.

**Returns:** `ClaudeCodeVersionInfo`

```typescript
interface ClaudeCodeVersionInfo {
  install_type: 'native' | 'npm' | 'none';
  current_version: string | null;
  available_versions: VersionWithDownloads[];
  autoupdater_disabled: boolean;
}
```

### `install_claude_code_version`

Install a specific Claude Code version.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `version` | `string` | Version to install (semver) |

**Note:** Version parameter is validated against semver format for security.

### `set_claude_code_autoupdater`

Enable or disable Claude Code auto-updater.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `enabled` | `boolean` | Enable/disable |

---

## Context

Commands for context file management.

### `get_context_files`

Get all context files (CLAUDE.md, etc.).

**Returns:** `ContextFile[]`

```typescript
interface ContextFile {
  name: string;
  path: string;
  scope: string;
  content: string;
  last_modified: number;
}
```

### `get_project_context`

Get context for a specific project.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `project_path` | `string` | Project path |

**Returns:** `ContextFile[]`

---

## Executor Profiles

Commands for executor profile management.

### `list_supported_agents`

List all supported coding agents.

**Returns:** `string[]`

### `list_executor_profiles`

List executor profiles for an agent.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `agent` | `string` | Agent identifier |

**Returns:** `ExecutorProfile[]`

### `get_agent_profiles`

Get all profiles for an agent.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `agent` | `string` | Agent identifier |

**Returns:** `ExecutorProfile[]`

---

## Error Handling

All commands may return errors as strings. Use try-catch or `.catch()` for error handling:

```typescript
try {
  const result = await invoke('command_name', { param: 'value' });
} catch (error) {
  console.error('Command failed:', error);
}
```

Common error types:
- **File not found**: Path does not exist
- **Permission denied**: Insufficient permissions
- **Invalid parameter**: Parameter validation failed
- **Parse error**: Failed to parse content

---

## Frontend Usage

### With React Query (Recommended)

```typescript
import { useInvokeQuery } from '@/hooks/useInvokeQuery';

function ProjectList() {
  const { data, isLoading, error } = useInvokeQuery<Project[]>(
    ['projects'],
    'list_projects'
  );

  if (isLoading) return <Loading />;
  if (error) return <Error message={error} />;

  return <ProjectGrid projects={data} />;
}
```

### Direct Invoke

```typescript
import { invoke } from '@tauri-apps/api/core';

async function fetchProjects() {
  return await invoke<Project[]>('list_projects');
}
```
