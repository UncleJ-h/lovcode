/**
 * [INPUT]: 依赖 types/ContextFile, components/ContextFileItem, components/shared
 * [OUTPUT]: 对外提供 SettingsContextSection 组件
 * [POS]: Settings 的 Context 文件管理子组件
 * [PROTOCOL]: 变更时更新此头部,然后检查 views/CLAUDE.md
 */

import { GearIcon } from "@radix-ui/react-icons";
import { ContextFileItem, ConfigFileItem } from "../../components/ContextFileItem";
import type { ContextFile, ClaudeSettings } from "../../types";

interface SettingsContextSectionProps {
  filteredContextFiles: ContextFile[];
  settings: ClaudeSettings | null | undefined;
  settingsPath: string;
  settingsMatchSearch: boolean;
}

export function SettingsContextSection({
  filteredContextFiles,
  settings,
  settingsPath,
  settingsMatchSearch,
}: SettingsContextSectionProps) {
  return (
    <div className="space-y-4">
      {filteredContextFiles.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <span className="text-sm font-medium text-ink">📄 Context ({filteredContextFiles.length})</span>
          </div>
          <div className="p-3 space-y-1">
            {filteredContextFiles.map((file) => (
              <ContextFileItem key={file.path} file={file} />
            ))}
          </div>
        </div>
      )}

      {settingsMatchSearch && settings?.raw && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <GearIcon className="w-4 h-4" />
            <span className="text-sm font-medium text-ink">Configuration</span>
          </div>
          <div className="p-3">
            <ConfigFileItem name="settings.json" path={settingsPath} content={settings.raw} />
          </div>
        </div>
      )}
    </div>
  );
}
