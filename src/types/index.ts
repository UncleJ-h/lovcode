// ============================================================================
// Feature Types
// ============================================================================

export type FeatureType =
  | 'chat'
  | 'workspace'
  | 'features'
  | 'settings'
  | 'statusline'
  | 'commands'
  | 'mcp'
  | 'skills'
  | 'hooks'
  | 'sub-agents'
  | 'output-styles'
  | 'marketplace'
  | 'kb-distill'
  | 'kb-reference';

export interface FeatureConfig {
  type: FeatureType;
  label: string;
  description: string;
  available: boolean;
  group: 'history' | 'config' | 'marketplace' | 'knowledge';
}

// ============================================================================
// Data Types
// ============================================================================

export interface Project {
  id: string;
  path: string;
  session_count: number;
  last_active: number;
}

export interface Session {
  id: string;
  project_id: string;
  project_path: string | null;
  summary: string | null;
  message_count: number;
  last_modified: number;
}

export interface Message {
  uuid: string;
  role: string;
  content: string;
  timestamp: string;
  is_meta: boolean;
  is_tool: boolean;
  line_number: number;
}

export interface ChatMessage {
  uuid: string;
  role: string;
  content: string;
  timestamp: string;
  project_id: string;
  project_path: string;
  session_id: string;
  session_summary: string | null;
}

export interface SearchResult {
  uuid: string;
  content: string;
  role: string;
  project_id: string;
  project_path: string;
  session_id: string;
  session_summary: string | null;
  timestamp: string;
  score: number;
}

export interface ChatsResponse {
  items: ChatMessage[];
  total: number;
}

export interface LocalCommand {
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

export interface LocalAgent {
  name: string;
  path: string;
  description: string | null;
  model: string | null;
  tools: string | null;
  content: string;
}

export interface LocalSkill {
  name: string;
  path: string;
  description: string | null;
  content: string;
}

export interface DistillDocument {
  date: string;
  file: string;
  title: string;
  tags: string[];
  session: string | null;
}

export interface McpServer {
  name: string;
  description: string | null;
  type: string | null; // "http" | "sse" | "stdio"
  url: string | null; // for http/sse servers
  command: string | null; // for stdio servers
  args: string[];
  env: Record<string, string>;
}

export interface ClaudeSettings {
  raw: Record<string, unknown> | null;
  permissions: Record<string, unknown> | null;
  hooks: Record<string, unknown[]> | null;
  mcp_servers: McpServer[];
}

export interface ContextFile {
  name: string;
  path: string;
  scope: string;
  content: string;
  last_modified: number;
}

export interface TemplateComponent {
  name: string;
  path: string;
  category: string;
  component_type: string;
  description: string | null;
  downloads: number | null;
  content: string | null;
  source_id?: string | null;
  source_name?: string | null;
  source_icon?: string | null;
  plugin_name?: string | null;
  author?: string | null;
}

export interface SourceInfo {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface TemplatesCatalog {
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

export type TemplateCategory =
  | 'settings'
  | 'commands'
  | 'mcps'
  | 'skills'
  | 'hooks'
  | 'agents'
  | 'statuslines'
  | 'output-styles';

// ============================================================================
// View State Types
// ============================================================================

export type View =
  | { type: 'home' }
  | {
      type: 'workspace';
      projectId?: string;
      featureId?: string;
      mode?: 'features' | 'dashboard' | 'home';
    }
  | { type: 'features' }
  | { type: 'chat-projects' }
  | { type: 'chat-sessions'; projectId: string; projectPath: string }
  | {
      type: 'chat-messages';
      projectId: string;
      projectPath: string;
      sessionId: string;
      summary: string | null;
    }
  | { type: 'settings' }
  | { type: 'commands' }
  | { type: 'command-detail'; command: LocalCommand; scrollToChangelog?: boolean }
  | { type: 'mcp' }
  | { type: 'skills' }
  | { type: 'skill-detail'; skill: LocalSkill }
  | { type: 'hooks' }
  | { type: 'sub-agents' }
  | { type: 'sub-agent-detail'; agent: LocalAgent }
  | { type: 'output-styles' }
  | { type: 'statusline' }
  | { type: 'kb-distill' }
  | { type: 'kb-distill-detail'; document: DistillDocument }
  | { type: 'kb-reference' }
  | { type: 'kb-reference-doc'; source: string; docIndex: number }
  | { type: 'marketplace'; category?: TemplateCategory }
  | { type: 'template-detail'; template: TemplateComponent; category: TemplateCategory }
  | { type: 'feature-todo'; feature: FeatureType }
  | { type: 'annual-report-2025' };

// ============================================================================
// Annual Report Types
// ============================================================================

export interface FavoriteProject {
  id: string;
  path: string;
  session_count: number;
  message_count: number;
}

export interface TopCommand {
  name: string;
  count: number;
}

export interface AnnualReport2025 {
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

// ============================================================================
// User Types
// ============================================================================

export interface UserProfile {
  nickname: string;
  avatarUrl: string;
}

// ============================================================================
// Sort & Filter Types
// ============================================================================

export type SortKey = 'recent' | 'sessions' | 'name';
export type SortDirection = 'asc' | 'desc';
export type CommandSortKey = 'usage' | 'name';
export type ChatViewMode = 'projects' | 'sessions' | 'chats';
export type ExportFormat = 'markdown' | 'json';
export type MarkdownStyle = 'full' | 'bullet' | 'qa';

// ============================================================================
// Reference Types
// ============================================================================

export interface ReferenceSource {
  name: string;
  icon: string;
  docs: ReferenceDoc[];
}

export interface ReferenceDoc {
  title: string;
  description: string;
  path: string;
}

// ============================================================================
// Version Types
// ============================================================================

export interface VersionWithDownloads {
  version: string;
  downloads: number;
  date: string;
}

export type ClaudeCodeInstallType = 'native' | 'npm' | 'none';

export interface ClaudeCodeVersionInfo {
  install_type: ClaudeCodeInstallType;
  current_version: string | null;
  available_versions: VersionWithDownloads[];
  autoupdater_disabled: boolean;
}

// ============================================================================
// Executor Profile Types
// ============================================================================

export interface ExecutorProfile {
  agent: string;
  agent_name: string;
  profile_id: string;
  label: string;
  description: string;
  command: string;
}

// ============================================================================
// Coding Agent Types (借鉴 vibe-kanban)
// ============================================================================

export type AgentCapability = 'session_fork' | 'setup_required' | 'mcp_support' | 'plan_mode';

export type AgentAvailability =
  | { status: 'available'; version: string | null }
  | { status: 'needs_auth'; message: string }
  | { status: 'not_installed' }
  | { status: 'unknown'; error: string };

export interface CodingAgentInfo {
  id: string;
  name: string;
  description: string;
  command: string;
  availability: AgentAvailability;
  capabilities: AgentCapability[];
  mcp_config_path: string | null;
  website: string | null;
}

// ============================================================================
// NormalizedEntry Types (借鉴 vibe-kanban)
// 统一 AI Agent 输出格式的日志解析系统
// ============================================================================

export type ToolStatus =
  | { status: 'created' }
  | { status: 'success' }
  | { status: 'failed' }
  | { status: 'denied'; reason: string | null }
  | { status: 'pending_approval'; approval_id: string; requested_at: string; timeout_at: string }
  | { status: 'timed_out' };

export type FileChange =
  | { action: 'write'; content: string }
  | { action: 'delete' }
  | { action: 'rename'; new_path: string }
  | { action: 'edit'; unified_diff: string; has_line_numbers: boolean };

export type CommandExitStatus =
  | { type: 'exit_code'; code: number }
  | { type: 'signal'; signal: number }
  | { type: 'timed_out' };

export interface CommandRunResult {
  exit_status: CommandExitStatus | null;
  output: string | null;
}

export type TodoItemStatus = 'pending' | 'in_progress' | 'completed';

export interface LogTodoItem {
  content: string;
  status: TodoItemStatus;
  active_form: string | null;
}

export interface ToolResult {
  success: boolean;
  output: string | null;
  error: string | null;
}

export type ActionType =
  | { action: 'file_read'; path: string }
  | { action: 'file_edit'; path: string; changes: FileChange[] }
  | { action: 'command_run'; command: string; result: CommandRunResult | null }
  | { action: 'search'; query: string }
  | { action: 'web_fetch'; url: string }
  | { action: 'tool'; tool_name: string; arguments: unknown | null; result: ToolResult | null }
  | { action: 'task_create'; description: string }
  | { action: 'plan_presentation'; plan: string }
  | { action: 'todo_management'; todos: LogTodoItem[]; operation: string }
  | { action: 'other'; description: string };

export type NormalizedEntryError =
  | 'agent_error'
  | 'api_error'
  | 'network_error'
  | 'permission_error'
  | 'timeout_error'
  | 'unknown';

export type NormalizedEntryType =
  | { type: 'user_message' }
  | { type: 'user_feedback'; denied_tool: string }
  | { type: 'assistant_message' }
  | { type: 'tool_use'; tool_name: string; action_type: ActionType; status: ToolStatus }
  | { type: 'system_message' }
  | { type: 'error_message'; error_type: NormalizedEntryError }
  | { type: 'thinking' }
  | { type: 'loading' }
  | { type: 'next_action'; failed: boolean; execution_processes: number; needs_setup: boolean };

export interface NormalizedEntry {
  timestamp: string | null;
  entry_type: NormalizedEntryType;
  content: string;
  metadata?: unknown;
}
