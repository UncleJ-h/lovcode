/**
 * [INPUT]: 依赖 components/config, components/shared, hooks/useSettingsState, 子组件
 * [OUTPUT]: 对外提供 SettingsView 组件
 * [POS]: Settings 的主视图组件
 * [PROTOCOL]: 变更时更新此头部,然后检查 views/CLAUDE.md
 */

import { invoke } from "@tauri-apps/api/core";
import { GearIcon } from "@radix-ui/react-icons";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ConfigPage,
  MarketplaceSection,
  type MarketplaceItem,
} from "../../components/config";
import { BrowseMarketplaceButton } from "../../components/shared";
import { ClaudeCodeVersionSection } from "./ClaudeCodeVersionSection";
import { SettingsEnvSection } from "./SettingsEnvSection";
import { SettingsProxySection } from "./SettingsProxySection";
import { SettingsContextSection } from "./SettingsContextSection";
import { useSettingsState } from "./hooks/useSettingsState";

interface SettingsViewProps {
  marketplaceItems: MarketplaceItem[];
  onMarketplaceSelect: (item: MarketplaceItem) => void;
  onBrowseMore?: () => void;
}

const presetFallbacks: Record<string, MarketplaceItem> = {
  corporate: {
    name: "corporate-proxy",
    path: "fallback/corporate-proxy.json",
    description: "Add HTTP_PROXY / HTTPS_PROXY for firewalled networks.",
    downloads: null,
    content: JSON.stringify(
      { env: { HTTP_PROXY: "http://proxy.example.com:8080", HTTPS_PROXY: "http://proxy.example.com:8080" } },
      null,
      2
    ),
  },
};

export function SettingsView({ marketplaceItems, onMarketplaceSelect, onBrowseMore }: SettingsViewProps) {
  const state = useSettingsState();

  if (state.loadingSettings) return <LoadingState message="Loading settings..." />;

  const handleApplyCorporateProxy = async () => {
    const template = presetFallbacks.corporate;
    if (!template?.content) return;
    try {
      await invoke("install_setting_template", { config: template.content });
      state.refreshSettings();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ConfigPage>
      <PageHeader
        title="Settings"
        subtitle="User configuration (~/.claude)"
        action={<BrowseMarketplaceButton onClick={onBrowseMore} />}
      />
      <SearchInput placeholder="Search local & marketplace..." value={state.search} onChange={state.setSearch} />

      <SettingsEnvSection
        filteredEnvEntries={state.filteredEnvEntries}
        customEnvKeys={state.customEnvKeys}
        newEnvKey={state.newEnvKey}
        setNewEnvKey={state.setNewEnvKey}
        newEnvValue={state.newEnvValue}
        setNewEnvValue={state.setNewEnvValue}
        editingEnvKey={state.editingEnvKey}
        setEditingEnvKey={state.setEditingEnvKey}
        envEditValue={state.envEditValue}
        setEnvEditValue={state.setEnvEditValue}
        editingEnvIsDisabled={state.editingEnvIsDisabled}
        setEditingEnvIsDisabled={state.setEditingEnvIsDisabled}
        revealedEnvKeys={state.revealedEnvKeys}
        setRevealedEnvKeys={state.setRevealedEnvKeys}
        refreshSettings={state.refreshSettings}
        onApplyCorporateProxy={handleApplyCorporateProxy}
      />

      <SettingsProxySection
        marketplaceItems={marketplaceItems}
        search={state.search}
        activeProvider={state.activeProvider}
        rawEnv={state.rawEnv}
        applyStatus={state.applyStatus}
        setApplyStatus={state.setApplyStatus}
        applyError={state.applyError}
        setApplyError={state.setApplyError}
        applyHint={state.applyHint}
        setApplyHint={state.setApplyHint}
        testStatus={state.testStatus}
        setTestStatus={state.setTestStatus}
        testMessage={state.testMessage}
        setTestMessage={state.setTestMessage}
        testMissingKeys={state.testMissingKeys}
        setTestMissingKeys={state.setTestMissingKeys}
        testMissingValues={state.testMissingValues}
        setTestMissingValues={state.setTestMissingValues}
        expandedPresetKey={state.expandedPresetKey}
        setExpandedPresetKey={state.setExpandedPresetKey}
        selectedModels={state.selectedModels}
        setSelectedModels={state.setSelectedModels}
        refreshSettings={state.refreshSettings}
        getRawEnvFromSettings={state.getRawEnvFromSettings}
      />

      <ClaudeCodeVersionSection />

      {!state.hasContent && !state.search && (
        <EmptyState
          icon={GearIcon}
          message="No configuration found"
          hint="Create ~/.claude/settings.json or CLAUDE.md"
        />
      )}

      {(state.filteredContextFiles.length > 0 ||
        (state.settingsMatchSearch && state.settings?.raw)) && (
        <SettingsContextSection
          filteredContextFiles={state.filteredContextFiles}
          settings={state.settings}
          settingsPath={state.settingsPath}
          settingsMatchSearch={state.settingsMatchSearch}
        />
      )}

      {state.search && state.filteredContextFiles.length === 0 && !state.settingsMatchSearch && (
        <p className="text-muted-foreground text-sm">No local settings match "{state.search}"</p>
      )}

      <MarketplaceSection
        items={marketplaceItems}
        search={state.search}
        onSelect={onMarketplaceSelect}
        onBrowseMore={onBrowseMore}
      />
    </ConfigPage>
  );
}
