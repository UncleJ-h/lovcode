import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { CollapsibleCard } from "../../components/shared";
import type { ClaudeCodeVersionInfo, ClaudeCodeInstallType } from "../../types";

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const INSTALL_TYPE_LABELS: Record<ClaudeCodeInstallType, string> = {
  native: "Native",
  npm: "NPM",
  none: "Not Installed",
};

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
    if (!versionInfo) return;
    setInstalling(true);
    setError(null);
    setSuccess(null);
    try {
      // Use current install type, or default to native for new installs
      const installType = versionInfo.install_type === "none" ? "native" : versionInfo.install_type;
      await invoke<string>("install_claude_code_version", {
        version: selectedVersion,
        installType,
      });
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

  const isNotInstalled = versionInfo?.install_type === "none";
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

  const getSubtitle = () => {
    if (!versionInfo) return "Error loading";
    if (isNotInstalled) return "Not installed";
    const typeLabel = INSTALL_TYPE_LABELS[versionInfo.install_type];
    return `v${versionInfo.current_version} (${typeLabel})`;
  };

  return (
    <CollapsibleCard
      storageKey="lovcode:settings:ccVersionOpen"
      title="Claude Code Version"
      subtitle={getSubtitle()}
      bodyClassName="p-3 space-y-3"
    >
      {/* Not installed: show install options */}
      {isNotInstalled ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Claude Code is not installed. Choose an installation method:
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setInstalling(true);
                invoke<string>("install_claude_code_version", {
                  version: "latest",
                  installType: "native",
                })
                  .then(() => {
                    setSuccess("Successfully installed Claude Code (Native)");
                    loadVersionInfo();
                  })
                  .catch((e) => setError(String(e)))
                  .finally(() => setInstalling(false));
              }}
              disabled={installing}
              className="flex-1"
            >
              {installing ? "Installing..." : "Install (Native)"}
            </Button>
            <Button
              variant="outline"
              onClick={() => openUrl("https://nodejs.org")}
              className="shrink-0"
            >
              NPM (needs Node.js)
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Native install is recommended. No dependencies required.
          </p>
        </div>
      ) : (
        <>
          {/* Version selector */}
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

          {/* Auto-updater toggle */}
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

          <p className="text-[10px] text-muted-foreground">
            Tip: Disable auto-updater to lock a specific version for stability.
          </p>
        </>
      )}

      {/* Error/Success messages */}
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
      {success && <p className="text-xs text-green-600 bg-green-50 rounded-lg p-2">{success}</p>}
    </CollapsibleCard>
  );
}
