/**
 * [INPUT]: Jotai atoms, Tauri events, AppConfigContext
 * [OUTPUT]: App root component
 * [POS]: 应用根组件 - 布局、全局状态、对话框
 * [PROTOCOL]: 变更时更新此头部，然后检查 src/CLAUDE.md
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAtom } from "jotai";

import { GlobalHeader, VerticalFeatureTabs } from "./components/GlobalHeader";
import { AppRouter } from "./components/AppRouter";
import { AppSettingsDialog, ProfileDialog } from "./components/dialogs";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { logNonCriticalError } from "./lib/errorHandler";

import {
  shortenPathsAtom,
  profileAtom,
  featureTabsLayoutAtom,
  workspaceDataAtom,
} from "./store";
import { AppConfigContext, type AppConfig } from "./context";
import type { TemplatesCatalog } from "./types";

// ============================================================================
// App Component
// ============================================================================

function App() {
  // Navigation
  const {
    view,
    navigate,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    currentFeature,
    handleFeatureClick,
  } = useAppNavigation();

  // Global state
  const [featureTabsLayout] = useAtom(featureTabsLayoutAtom);
  const [workspace] = useAtom(workspaceDataAtom);
  const [shortenPaths, setShortenPaths] = useAtom(shortenPathsAtom);
  const [profile, setProfile] = useAtom(profileAtom);

  // Local state
  const [catalog, setCatalog] = useState<TemplatesCatalog | null>(null);
  const [homeDir, setHomeDir] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [distillWatchEnabled, setDistillWatchEnabled] = useState(true);

  // Initialize
  useEffect(() => {
    invoke<string>("get_home_dir")
      .then(setHomeDir)
      .catch(logNonCriticalError("获取用户主目录"));
    invoke<boolean>("get_distill_watch_enabled")
      .then(setDistillWatchEnabled)
      .catch(logNonCriticalError("获取提炼监听状态"));
    invoke<TemplatesCatalog>("get_templates_catalog")
      .then(setCatalog)
      .catch(logNonCriticalError("获取模板目录"));
  }, []);

  // Menu event
  useEffect(() => {
    const unlisten = listen("menu-settings", () => setShowSettings(true));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        window.dispatchEvent(new Event("app:before-reload"));
        setTimeout(() => window.location.reload(), 50);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Path formatter
  const formatPath = useCallback(
    (path: string) => {
      if (shortenPaths && homeDir && path.startsWith(homeDir)) {
        return "~" + path.slice(homeDir.length);
      }
      return path;
    },
    [shortenPaths, homeDir]
  );

  const appConfig: AppConfig = { homeDir, shortenPaths, setShortenPaths, formatPath };

  return (
    <AppConfigContext.Provider value={appConfig}>
      <div className="h-screen bg-canvas flex flex-col">
        <GlobalHeader
          currentFeature={currentFeature}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onGoBack={goBack}
          onGoForward={goForward}
          onNavigate={navigate}
          onFeatureClick={handleFeatureClick}
          onShowProfileDialog={() => setShowProfileDialog(true)}
          onShowSettings={() => setShowSettings(true)}
        />
        <div className="flex-1 flex overflow-hidden">
          {featureTabsLayout === "vertical" && workspace && <VerticalFeatureTabs />}
          <main className="flex-1 overflow-auto">
            <AppRouter
              view={view}
              navigate={navigate}
              currentFeature={currentFeature}
              handleFeatureClick={handleFeatureClick}
              catalog={catalog}
              distillWatchEnabled={distillWatchEnabled}
              onDistillWatchToggle={setDistillWatchEnabled}
            />
          </main>
        </div>
      </div>
      <AppSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <ProfileDialog
        open={showProfileDialog}
        onClose={() => setShowProfileDialog(false)}
        profile={profile}
        onSave={setProfile}
      />
    </AppConfigContext.Provider>
  );
}

export default App;
