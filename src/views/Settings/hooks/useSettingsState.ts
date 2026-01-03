/**
 * [INPUT]: 依赖 @tauri-apps/api/core 的 invoke, hooks/useInvokeQuery, store/atoms
 * [OUTPUT]: 对外提供 useSettingsState hook
 * [POS]: Settings 的共享状态管理
 * [PROTOCOL]: 变更时更新此头部,然后检查 views/CLAUDE.md
 */

import { useState, useEffect, useMemo } from "react";
import { useInvokeQuery, useQueryClient } from "../../../hooks";
import { useAtom } from "jotai";
import { routerTestStatusAtom, routerTestMessageAtom } from "../../../store";
import type { ClaudeSettings, ContextFile } from "../../../types";

export function useSettingsState() {
  const queryClient = useQueryClient();

  // Data queries
  const { data: settings, isLoading: loadingSettings } = useInvokeQuery<ClaudeSettings>(
    ["settings"],
    "get_settings"
  );
  const { data: allContextFiles = [] } = useInvokeQuery<ContextFile[]>(
    ["contextFiles"],
    "get_context_files"
  );
  const { data: settingsPath = "" } = useInvokeQuery<string>(
    ["settingsPath"],
    "get_settings_path"
  );

  // Computed data
  const contextFiles = useMemo(
    () => allContextFiles.filter((f) => f.scope === "global"),
    [allContextFiles]
  );

  // Search state
  const [search, setSearch] = useState("");

  // Proxy preset states
  const [applyStatus, setApplyStatus] = useState<Record<string, "idle" | "loading" | "success" | "error">>({});
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyHint, setApplyHint] = useState<Record<string, string>>({});
  const [testStatus, setTestStatus] = useAtom(routerTestStatusAtom);
  const [testMessage, setTestMessage] = useAtom(routerTestMessageAtom);
  const [testMissingKeys, setTestMissingKeys] = useState<Record<string, string[]>>({});
  const [testMissingValues, setTestMissingValues] = useState<Record<string, Record<string, string>>>({});
  const [expandedPresetKey, setExpandedPresetKey] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({
    univibe: "claude-sonnet-4-5-20250929",
    siliconflow: "moonshotai/Kimi-K2-Instruct-0905",
  });

  // Env states
  const [editingEnvKey, setEditingEnvKey] = useState<string | null>(null);
  const [envEditValue, setEnvEditValue] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [revealedEnvKeys, setRevealedEnvKeys] = useState<Record<string, boolean>>({});
  const [editingEnvIsDisabled, setEditingEnvIsDisabled] = useState(false);

  // Initialize selected model from current env
  useEffect(() => {
    if (!settings) return;
    const envValue = settings.raw && typeof settings.raw === "object"
      ? (settings.raw as Record<string, unknown>).env
      : null;
    if (envValue && typeof envValue === "object") {
      const currentModel = (envValue as Record<string, unknown>).ANTHROPIC_MODEL;
      if (typeof currentModel === "string" && currentModel) {
        setSelectedModels((prev) => ({ ...prev, univibe: currentModel }));
      }
    }
  }, [settings]);

  // Utility functions
  const refreshSettings = () => {
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const getActiveProvider = (value: ClaudeSettings | null | undefined): string | null => {
    const lovcode = value?.raw && typeof value.raw === "object"
      ? (value.raw as Record<string, unknown>).lovcode
      : null;
    if (!lovcode || typeof lovcode !== "object") return null;
    const activeProvider = (lovcode as Record<string, unknown>).activeProvider;
    return typeof activeProvider === "string" ? activeProvider : null;
  };

  const getRawEnvFromSettings = (value: ClaudeSettings | null | undefined) => {
    const envValue = value?.raw && typeof value.raw === "object"
      ? (value.raw as Record<string, unknown>).env
      : null;
    if (!envValue || typeof envValue !== "object" || Array.isArray(envValue)) return {};
    return Object.fromEntries(
      Object.entries(envValue as Record<string, unknown>).map(([key, v]) => [key, String(v ?? "")])
    );
  };

  const getCustomEnvKeysFromSettings = (value: ClaudeSettings | null | undefined): string[] => {
    const keys = value?.raw && typeof value.raw === "object"
      ? (value.raw as Record<string, unknown>)._lovcode_custom_env_keys
      : null;
    if (!keys || !Array.isArray(keys)) return [];
    return keys.filter((k): k is string => typeof k === "string");
  };

  const getDisabledEnvFromSettings = (value: ClaudeSettings | null | undefined): Record<string, string> => {
    const disabled = value?.raw && typeof value.raw === "object"
      ? (value.raw as Record<string, unknown>)._lovcode_disabled_env
      : null;
    if (!disabled || typeof disabled !== "object" || Array.isArray(disabled)) return {};
    return Object.fromEntries(
      Object.entries(disabled as Record<string, unknown>).map(([key, v]) => [key, String(v ?? "")])
    );
  };

  // Computed values
  const activeProvider = getActiveProvider(settings);
  const rawEnv = getRawEnvFromSettings(settings);
  const customEnvKeys = getCustomEnvKeysFromSettings(settings);
  const disabledEnv = getDisabledEnvFromSettings(settings);

  const allEnvEntries: Array<[string, string, boolean]> = [
    ...Object.entries(rawEnv).map(([k, v]) => [k, v, false] as [string, string, boolean]),
    ...Object.entries(disabledEnv).map(([k, v]) => [k, v, true] as [string, string, boolean]),
  ].sort((a, b) => a[0].localeCompare(b[0]));

  const filteredEnvEntries = !search
    ? allEnvEntries
    : allEnvEntries.filter(([key]) => key.toLowerCase().includes(search.toLowerCase()));

  const filteredContextFiles = contextFiles.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const settingsMatchSearch = !search || JSON.stringify(settings?.raw || {}).toLowerCase().includes(search.toLowerCase());
  const hasContent = settings?.raw || contextFiles.length > 0;

  return {
    // Data
    settings,
    settingsPath,
    contextFiles,
    loadingSettings,
    hasContent,

    // Search
    search,
    setSearch,
    filteredContextFiles,
    settingsMatchSearch,

    // Proxy preset states
    applyStatus,
    setApplyStatus,
    applyError,
    setApplyError,
    applyHint,
    setApplyHint,
    testStatus,
    setTestStatus,
    testMessage,
    setTestMessage,
    testMissingKeys,
    setTestMissingKeys,
    testMissingValues,
    setTestMissingValues,
    expandedPresetKey,
    setExpandedPresetKey,
    selectedModels,
    setSelectedModels,

    // Env states
    editingEnvKey,
    setEditingEnvKey,
    envEditValue,
    setEnvEditValue,
    newEnvKey,
    setNewEnvKey,
    newEnvValue,
    setNewEnvValue,
    revealedEnvKeys,
    setRevealedEnvKeys,
    editingEnvIsDisabled,
    setEditingEnvIsDisabled,

    // Computed
    activeProvider,
    rawEnv,
    customEnvKeys,
    disabledEnv,
    allEnvEntries,
    filteredEnvEntries,

    // Utilities
    refreshSettings,
    getRawEnvFromSettings,
    getActiveProvider,
  };
}
