/**
 * [INPUT]: open, onClose, useAppConfig, featureTabsLayoutAtom
 * [OUTPUT]: AppSettingsDialog component
 * [POS]: 应用设置对话框
 * [PROTOCOL]: 变更时更新此头部
 */

import { useState } from "react";
import { useAtom } from "jotai";
import { Switch } from "../ui/switch";
import { useAppConfig } from "../../context";
import { featureTabsLayoutAtom } from "../../store";
import { setAutoCopyOnSelect, getAutoCopyOnSelect } from "../Terminal";

interface AppSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AppSettingsDialog({ open, onClose }: AppSettingsDialogProps) {
  const { shortenPaths, setShortenPaths } = useAppConfig();
  const [autoCopy, setAutoCopy] = useState(getAutoCopyOnSelect);
  const [featureTabsLayout, setFeatureTabsLayout] = useAtom(featureTabsLayoutAtom);

  const handleAutoCopyChange = (checked: boolean) => {
    setAutoCopy(checked);
    setAutoCopyOnSelect(checked);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-xl border border-border shadow-xl w-96 max-w-[90vw]">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Settings</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-ink text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-5 space-y-5">
          {/* Display */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Display
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">Shorten paths</p>
                <p className="text-xs text-muted-foreground">
                  Replace home directory with ~
                </p>
              </div>
              <Switch checked={shortenPaths} onCheckedChange={setShortenPaths} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">Project tabs layout</p>
                <p className="text-xs text-muted-foreground">
                  Position of project/feature tabs
                </p>
              </div>
              <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg">
                <button
                  onClick={() => setFeatureTabsLayout("horizontal")}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    featureTabsLayout === "horizontal"
                      ? "bg-background text-ink shadow-sm"
                      : "text-muted-foreground hover:text-ink"
                  }`}
                >
                  Horizontal
                </button>
                <button
                  onClick={() => setFeatureTabsLayout("vertical")}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    featureTabsLayout === "vertical"
                      ? "bg-background text-ink shadow-sm"
                      : "text-muted-foreground hover:text-ink"
                  }`}
                >
                  Vertical
                </button>
              </div>
            </div>
          </div>
          {/* Terminal */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Terminal
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">Auto copy on select</p>
                <p className="text-xs text-muted-foreground">
                  Copy terminal selection to clipboard
                </p>
              </div>
              <Switch checked={autoCopy} onCheckedChange={handleAutoCopyChange} />
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
