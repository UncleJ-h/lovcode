/**
 * [INPUT]: 依赖 @tauri-apps/api/core invoke, UI components, hooks/useSettingsState
 * [OUTPUT]: 对外提供 SettingsEnvSection 组件
 * [POS]: Settings 的环境变量管理子组件
 * [PROTOCOL]: 变更时更新此头部,然后检查 views/CLAUDE.md
 */

import { invoke } from "@tauri-apps/api/core";
import {
  CheckIcon,
  Cross1Icon,
  Pencil1Icon,
  EyeOpenIcon,
  EyeClosedIcon,
  PlusCircledIcon,
  MinusCircledIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { CollapsibleCard } from "../../components/shared";
import type { ReactNode } from "react";

interface SettingsEnvSectionProps {
  filteredEnvEntries: Array<[string, string, boolean]>;
  customEnvKeys: string[];
  newEnvKey: string;
  setNewEnvKey: (value: string) => void;
  newEnvValue: string;
  setNewEnvValue: (value: string) => void;
  editingEnvKey: string | null;
  setEditingEnvKey: (value: string | null) => void;
  envEditValue: string;
  setEnvEditValue: (value: string) => void;
  editingEnvIsDisabled: boolean;
  setEditingEnvIsDisabled: (value: boolean) => void;
  revealedEnvKeys: Record<string, boolean>;
  setRevealedEnvKeys: (value: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  refreshSettings: () => void;
  onApplyCorporateProxy: () => void;
}

const ResponsiveActions = ({
  variant,
  icon,
  text,
  className = "",
}: {
  variant: "env" | "router";
  icon: ReactNode;
  text: ReactNode;
  className?: string;
}) => (
  <div className={`flex flex-nowrap items-center gap-2 whitespace-nowrap justify-end ${className}`}>
    <div className={`${variant}-actions--icon flex flex-nowrap items-center gap-2`}>{icon}</div>
    <div className={`${variant}-actions--text flex flex-nowrap items-center gap-2`}>{text}</div>
  </div>
);

export function SettingsEnvSection({
  filteredEnvEntries,
  customEnvKeys,
  newEnvKey,
  setNewEnvKey,
  newEnvValue,
  setNewEnvValue,
  editingEnvKey,
  setEditingEnvKey,
  envEditValue,
  setEnvEditValue,
  editingEnvIsDisabled,
  setEditingEnvIsDisabled,
  revealedEnvKeys,
  setRevealedEnvKeys,
  refreshSettings,
  onApplyCorporateProxy,
}: SettingsEnvSectionProps) {
  const handleEnvEdit = (key: string, value: string, isDisabled = false) => {
    setEditingEnvKey(key);
    setEnvEditValue(value);
    setEditingEnvIsDisabled(isDisabled);
  };

  const handleEnvSave = async () => {
    if (!editingEnvKey) return;
    if (editingEnvIsDisabled) {
      await invoke("update_disabled_settings_env", { envKey: editingEnvKey, envValue: envEditValue });
    } else {
      await invoke("update_settings_env", { envKey: editingEnvKey, envValue: envEditValue });
    }
    await refreshSettings();
    setEditingEnvKey(null);
    setEditingEnvIsDisabled(false);
  };

  const handleEnvDelete = async (key: string) => {
    await invoke("delete_settings_env", { envKey: key });
    await refreshSettings();
    if (editingEnvKey === key) setEditingEnvKey(null);
  };

  const handleEnvDisable = async (key: string) => {
    await invoke("disable_settings_env", { envKey: key });
    await refreshSettings();
    if (editingEnvKey === key) setEditingEnvKey(null);
  };

  const handleEnvEnable = async (key: string) => {
    await invoke("enable_settings_env", { envKey: key });
    await refreshSettings();
  };

  const handleEnvCreate = async () => {
    const key = newEnvKey.trim();
    if (!key) return;
    await invoke("update_settings_env", { envKey: key, envValue: newEnvValue, isNew: true });
    await refreshSettings();
    setNewEnvKey("");
    setNewEnvValue("");
  };

  const toggleEnvReveal = (key: string) => {
    setRevealedEnvKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <CollapsibleCard
      storageKey="lovcode:settings:envCardOpen"
      title="Environment Variables"
      subtitle="Manage env vars in ~/.claude/settings.json"
      bodyClassName="p-3 space-y-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="text-xs px-2 py-1 rounded bg-canvas border border-border text-ink flex-1"
          placeholder="ENV_KEY"
          value={newEnvKey}
          onChange={(e) => setNewEnvKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEnvCreate()}
        />
        <input
          className="text-xs px-2 py-1 rounded bg-canvas border border-border text-ink flex-1"
          placeholder="value"
          value={newEnvValue}
          onChange={(e) => setNewEnvValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEnvCreate()}
        />
        <Button size="sm" onClick={handleEnvCreate} disabled={!newEnvKey.trim()}>
          Add
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 p-2 rounded-lg border border-dashed border-border bg-card-alt">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink">Corporate HTTP(S) Proxy</p>
          <p className="text-[10px] text-muted-foreground">
            Add HTTP_PROXY / HTTPS_PROXY for firewalled networks
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onApplyCorporateProxy}>
          Apply
        </Button>
      </div>

      {filteredEnvEntries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-2 font-medium">Key</th>
                <th className="py-2 pr-2 font-medium">Value</th>
                <th className="py-2 px-2 font-medium text-right env-actions-cell w-[1%] whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEnvEntries.map(([key, value, isDisabled]) => {
                const isRevealed = !!revealedEnvKeys[key];
                const isCustom = customEnvKeys.includes(key);
                return (
                  <tr
                    key={key}
                    className={`border-b border-border/60 last:border-0 ${isDisabled ? "opacity-50" : ""}`}
                  >
                    <td className="py-2 pr-2">
                      <span
                        className={`text-xs px-2 py-1 rounded font-mono ${
                          isDisabled
                            ? "bg-muted/50 text-muted-foreground line-through"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {key}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      {editingEnvKey === key ? (
                        <input
                          autoFocus
                          className="text-xs px-2 py-1 rounded bg-canvas border border-border text-ink w-64"
                          value={envEditValue}
                          onChange={(e) => setEnvEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEnvSave();
                            if (e.key === "Escape") setEditingEnvKey(null);
                          }}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {isRevealed ? value || "(empty)" : "••••••"}
                          </span>
                          <button
                            onClick={() => toggleEnvReveal(key)}
                            className="text-muted-foreground hover:text-foreground p-0.5"
                            title={isRevealed ? "Hide" : "View"}
                          >
                            {isRevealed ? (
                              <EyeClosedIcon className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOpenIcon className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap text-right env-actions-cell w-[1%]">
                      {editingEnvKey === key ? (
                        <ResponsiveActions
                          variant="env"
                          icon={
                            <>
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleEnvSave} title="Save">
                                <CheckIcon />
                              </Button>
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditingEnvKey(null)} title="Cancel">
                                <Cross1Icon />
                              </Button>
                            </>
                          }
                          text={
                            <>
                              <Button size="sm" onClick={handleEnvSave}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingEnvKey(null)}>Cancel</Button>
                            </>
                          }
                        />
                      ) : isDisabled ? (
                        <ResponsiveActions
                          variant="env"
                          icon={
                            <>
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleEnvEdit(key, value, true)} title="Edit">
                                <Pencil1Icon />
                              </Button>
                              <Button size="icon" variant="outline" className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleEnvEnable(key)} title="Enable">
                                <PlusCircledIcon />
                              </Button>
                              <TooltipProvider delayDuration={1000}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none" onClick={() => handleEnvDelete(key)} disabled={!isCustom}>
                                        <TrashIcon />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  {!isCustom && <TooltipContent>Only custom can be deleted</TooltipContent>}
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          }
                          text={
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleEnvEdit(key, value, true)}>Edit</Button>
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleEnvEnable(key)}>Enable</Button>
                              <TooltipProvider delayDuration={1000}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none" onClick={() => handleEnvDelete(key)} disabled={!isCustom}>Delete</Button>
                                    </span>
                                  </TooltipTrigger>
                                  {!isCustom && <TooltipContent>Only custom can be deleted</TooltipContent>}
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          }
                        />
                      ) : (
                        <ResponsiveActions
                          variant="env"
                          icon={
                            <>
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleEnvEdit(key, value, false)} title="Edit">
                                <Pencil1Icon />
                              </Button>
                              <Button size="icon" variant="outline" className="h-8 w-8 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleEnvDisable(key)} title="Disable">
                                <MinusCircledIcon />
                              </Button>
                              <TooltipProvider delayDuration={1000}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none" onClick={() => handleEnvDelete(key)} disabled={!isCustom}>
                                        <TrashIcon />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  {!isCustom && <TooltipContent>Only custom can be deleted</TooltipContent>}
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          }
                          text={
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleEnvEdit(key, value, false)}>Edit</Button>
                              <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleEnvDisable(key)}>Disable</Button>
                              <TooltipProvider delayDuration={1000}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none" onClick={() => handleEnvDelete(key)} disabled={!isCustom}>Delete</Button>
                                    </span>
                                  </TooltipTrigger>
                                  {!isCustom && <TooltipContent>Only custom can be deleted</TooltipContent>}
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          }
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No env variables configured.</p>
      )}
    </CollapsibleCard>
  );
}
