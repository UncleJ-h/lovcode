import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { CollapsibleCard } from "../../components/shared";
import type { ClaudeCodeVersionInfo } from "../../types";

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ClaudeCodeVersionSection() {
  const [versionInfo, setVersionInfo] = useState<ClaudeCodeVersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>("latest");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadVersionInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await invoke<ClaudeCodeVersionInfo>("get_claude_code_version_info");
      setVersionInfo(info);
      if (info.current_version) {
        setSelectedVersion(info.current_version);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersionInfo();
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    setSuccess(null);
    try {
      await invoke<string>("install_claude_code_version", { version: selectedVersion });
      setSuccess(`Successfully installed Claude Code ${selectedVersion}`);
      await loadVersionInfo();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  const handleToggleAutoupdater = async () => {
    if (!versionInfo) return;
    try {
      await invoke("set_claude_code_autoupdater", { disabled: !versionInfo.autoupdater_disabled });
      setVersionInfo({ ...versionInfo, autoupdater_disabled: !versionInfo.autoupdater_disabled });
    } catch (e) {
      setError(String(e));
    }
  };

  if (loading) {
    return (
      <CollapsibleCard
        storageKey="lovcode:settings:ccVersionOpen"
        title="Claude Code Version"
        subtitle="Loading version information..."
        bodyClassName="p-3"
      >
        <p className="text-xs text-muted-foreground">Loading...</p>
      </CollapsibleCard>
    );
  }

  const isCurrentVersion = versionInfo?.current_version === selectedVersion;
  const isLatest =
    selectedVersion === "latest" ||
    versionInfo?.available_versions[0]?.version === selectedVersion;

  const getSelectedLabel = () => {
    if (selectedVersion === "latest") return "latest (newest)";
    const v = versionInfo?.available_versions.find((v) => v.version === selectedVersion);
    if (!v) return selectedVersion;
    const isCurrent = v.version === versionInfo?.current_version;
    return `${v.version}${isCurrent ? " (current)" : ""}`;
  };

  return (
    <CollapsibleCard
      storageKey="lovcode:settings:ccVersionOpen"
      title="Claude Code Version"
      subtitle={versionInfo?.current_version ? `Current: v${versionInfo.current_version}` : "Not installed"}
      bodyClassName="p-3 space-y-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Select value={selectedVersion} onValueChange={setSelectedVersion} disabled={installing}>
            <SelectTrigger className="w-full">
              <SelectValue>{getSelectedLabel()}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">
                <span className="flex items-center justify-between w-full gap-3">
                  <span>latest (newest)</span>
                </span>
              </SelectItem>
              {versionInfo?.available_versions.map((v) => {
                const isCurrent = v.version === versionInfo.current_version;
                return (
                  <SelectItem key={v.version} value={v.version}>
                    <span className="flex items-center justify-between w-full gap-3">
                      <span>
                        {v.version}
                        {isCurrent ? " (current)" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ↓{formatDownloads(v.downloads)}
                      </span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleInstall} disabled={installing || isCurrentVersion} className="shrink-0">
          {installing ? "Installing..." : isCurrentVersion ? "Installed" : isLatest ? "Update" : "Install"}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 p-2 rounded-lg border border-border bg-card-alt">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink">Auto-updater</p>
          <p className="text-[10px] text-muted-foreground">
            {versionInfo?.autoupdater_disabled
              ? "Disabled - Claude Code won't update automatically"
              : "Enabled - Claude Code will update automatically"}
          </p>
        </div>
        <Button
          size="sm"
          variant={versionInfo?.autoupdater_disabled ? "default" : "outline"}
          onClick={handleToggleAutoupdater}
        >
          {versionInfo?.autoupdater_disabled ? "Enable" : "Disable"}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
      {success && <p className="text-xs text-green-600 bg-green-50 rounded-lg p-2">{success}</p>}

      <p className="text-[10px] text-muted-foreground">
        Tip: Disable auto-updater to lock a specific version for stability.
      </p>
    </CollapsibleCard>
  );
}
