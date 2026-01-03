/**
 * [INPUT]: view, navigate, currentFeature, handleFeatureClick, catalog, marketplaceCategory
 * [OUTPUT]: AppRouter component - 根据 view 渲染对应视图
 * [POS]: App 路由逻辑抽取
 * [PROTOCOL]: 变更时更新此头部
 */

import { invoke } from "@tauri-apps/api/core";
import { useAtom } from "jotai";
import { marketplaceCategoryAtom } from "../store";
import type { View, FeatureType, TemplatesCatalog, LocalCommand } from "../types";

// Views
import {
  Home,
  WorkspaceView,
  FeaturesView,
  FeaturesLayout,
  OutputStylesView,
  StatuslineView,
  SubAgentsView,
  SubAgentDetailView,
  SkillsView,
  SkillDetailView,
  HooksView,
  McpView,
  FeatureTodo,
  CommandsView,
  CommandDetailView,
  MarketplaceView,
  MarketplaceLayout,
  TemplateDetailView,
  DistillView,
  DistillDetailView,
  ReferenceView,
  KnowledgeLayout,
  SettingsView,
  ProjectList,
  SessionList,
  MessageView,
  AnnualReport2025,
} from "../views";

interface AppRouterProps {
  view: View;
  navigate: (view: View) => void;
  currentFeature: FeatureType | null;
  handleFeatureClick: (feature: FeatureType) => void;
  catalog: TemplatesCatalog | null;
  distillWatchEnabled: boolean;
  onDistillWatchToggle: (enabled: boolean) => void;
}

export function AppRouter({
  view,
  navigate,
  currentFeature,
  handleFeatureClick,
  catalog,
  distillWatchEnabled,
  onDistillWatchToggle,
}: AppRouterProps) {
  const [marketplaceCategory, setMarketplaceCategory] = useAtom(marketplaceCategoryAtom);

  // Home
  if (view.type === "home") {
    return (
      <Home
        onFeatureClick={handleFeatureClick}
        onProjectClick={(p) =>
          navigate({ type: "chat-sessions", projectId: p.id, projectPath: p.path })
        }
        onSessionClick={(s) =>
          navigate({
            type: "chat-messages",
            projectId: s.project_id,
            projectPath: s.project_path || "",
            sessionId: s.id,
            summary: s.summary,
          })
        }
        onSearch={() => navigate({ type: "chat-projects" })}
        onOpenAnnualReport={() => navigate({ type: "annual-report-2025" })}
      />
    );
  }

  // Annual Report
  if (view.type === "annual-report-2025") {
    return <AnnualReport2025 onClose={() => navigate({ type: "home" })} />;
  }

  // Workspace
  if (view.type === "workspace") {
    return <WorkspaceView />;
  }

  // Features
  if (view.type === "features") {
    return (
      <FeaturesView onFeatureClick={handleFeatureClick} currentFeature={currentFeature} />
    );
  }

  // Chat
  if (view.type === "chat-projects") {
    return (
      <ProjectList
        onSelectProject={(p) =>
          navigate({ type: "chat-sessions", projectId: p.id, projectPath: p.path })
        }
        onSelectSession={(s) =>
          navigate({
            type: "chat-messages",
            projectId: s.project_id,
            projectPath: s.project_path || "",
            sessionId: s.id,
            summary: s.summary,
          })
        }
        onSelectChat={(c) =>
          navigate({
            type: "chat-messages",
            projectId: c.project_id,
            projectPath: c.project_path,
            sessionId: c.session_id,
            summary: c.session_summary,
          })
        }
      />
    );
  }

  if (view.type === "chat-sessions") {
    return (
      <SessionList
        projectId={view.projectId}
        projectPath={view.projectPath}
        onBack={() => navigate({ type: "chat-projects" })}
        onSelect={(s) =>
          navigate({
            type: "chat-messages",
            projectId: s.project_id,
            projectPath: s.project_path || "",
            sessionId: s.id,
            summary: s.summary,
          })
        }
      />
    );
  }

  if (view.type === "chat-messages") {
    return (
      <MessageView
        projectId={view.projectId}
        projectPath={view.projectPath}
        sessionId={view.sessionId}
        summary={view.summary}
        onBack={() =>
          navigate({
            type: "chat-sessions",
            projectId: view.projectId,
            projectPath: view.projectPath,
          })
        }
      />
    );
  }

  // Features Layout Views
  if (
    view.type === "commands" ||
    view.type === "command-detail" ||
    view.type === "mcp" ||
    view.type === "skills" ||
    view.type === "skill-detail" ||
    view.type === "hooks" ||
    view.type === "sub-agents" ||
    view.type === "sub-agent-detail" ||
    view.type === "output-styles" ||
    view.type === "statusline"
  ) {
    return (
      <FeaturesLayout currentFeature={currentFeature} onFeatureClick={handleFeatureClick}>
        {view.type === "commands" && (
          <CommandsView
            onSelect={(cmd, scrollToChangelog) =>
              navigate({ type: "command-detail", command: cmd, scrollToChangelog })
            }
            marketplaceItems={catalog?.commands || []}
            onMarketplaceSelect={(item) => {
              const template = catalog?.commands.find((c) => c.path === item.path);
              if (template)
                navigate({ type: "template-detail", template, category: "commands" });
            }}
            onBrowseMore={() => navigate({ type: "marketplace", category: "commands" })}
          />
        )}
        {view.type === "command-detail" && (
          <CommandDetailView
            command={view.command}
            onBack={() => navigate({ type: "commands" })}
            onCommandUpdated={() => {}}
            onRenamed={async (newPath: string) => {
              const commands = await invoke<LocalCommand[]>("list_local_commands");
              const cmd = commands.find((c) => c.path === newPath);
              if (cmd) navigate({ type: "command-detail", command: cmd });
            }}
            scrollToChangelog={view.scrollToChangelog}
          />
        )}
        {view.type === "mcp" && (
          <McpView
            marketplaceItems={catalog?.mcps || []}
            onMarketplaceSelect={(item) => {
              const template = catalog?.mcps.find((c) => c.path === item.path);
              if (template)
                navigate({ type: "template-detail", template, category: "mcps" });
            }}
            onBrowseMore={() => navigate({ type: "marketplace", category: "mcps" })}
          />
        )}
        {view.type === "skills" && (
          <SkillsView
            onSelect={(skill) => navigate({ type: "skill-detail", skill })}
            marketplaceItems={catalog?.skills || []}
            onMarketplaceSelect={(item) => {
              const template = catalog?.skills.find((c) => c.path === item.path);
              if (template)
                navigate({ type: "template-detail", template, category: "skills" });
            }}
            onBrowseMore={() => navigate({ type: "marketplace", category: "skills" })}
          />
        )}
        {view.type === "skill-detail" && (
          <SkillDetailView
            skill={view.skill}
            onBack={() => navigate({ type: "skills" })}
          />
        )}
        {view.type === "hooks" && (
          <HooksView
            marketplaceItems={catalog?.hooks || []}
            onMarketplaceSelect={(item) => {
              const template = catalog?.hooks.find((c) => c.path === item.path);
              if (template)
                navigate({ type: "template-detail", template, category: "hooks" });
            }}
            onBrowseMore={() => navigate({ type: "marketplace", category: "hooks" })}
          />
        )}
        {view.type === "sub-agents" && (
          <SubAgentsView
            onSelect={(agent) => navigate({ type: "sub-agent-detail", agent })}
            marketplaceItems={catalog?.agents || []}
            onMarketplaceSelect={(item) => {
              const template = catalog?.agents.find((c) => c.path === item.path);
              if (template)
                navigate({ type: "template-detail", template, category: "agents" });
            }}
            onBrowseMore={() => navigate({ type: "marketplace", category: "agents" })}
          />
        )}
        {view.type === "sub-agent-detail" && (
          <SubAgentDetailView
            agent={view.agent}
            onBack={() => navigate({ type: "sub-agents" })}
          />
        )}
        {view.type === "output-styles" && <OutputStylesView />}
        {view.type === "statusline" && (
          <StatuslineView
            installedTemplates={
              catalog?.statuslines.filter((s) => s.source_id === "personal") || []
            }
            onBrowseMore={() => navigate({ type: "marketplace", category: "statuslines" })}
          />
        )}
      </FeaturesLayout>
    );
  }

  // Knowledge Layout
  if (
    view.type === "kb-distill" ||
    view.type === "kb-distill-detail" ||
    view.type === "kb-reference" ||
    view.type === "kb-reference-doc"
  ) {
    return (
      <KnowledgeLayout currentFeature={currentFeature} onFeatureClick={handleFeatureClick}>
        {view.type === "kb-distill" && (
          <DistillView
            onSelect={(doc) => navigate({ type: "kb-distill-detail", document: doc })}
            watchEnabled={distillWatchEnabled}
            onWatchToggle={(enabled) => {
              onDistillWatchToggle(enabled);
              invoke("set_distill_watch_enabled", { enabled });
            }}
          />
        )}
        {view.type === "kb-distill-detail" && (
          <DistillDetailView
            document={view.document}
            onBack={() => navigate({ type: "kb-distill" })}
            onNavigateSession={(projectId, projectPath, sessionId, summary) =>
              navigate({ type: "chat-messages", projectId, projectPath, sessionId, summary })
            }
          />
        )}
        {(view.type === "kb-reference" || view.type === "kb-reference-doc") && (
          <ReferenceView
            initialSource={view.type === "kb-reference-doc" ? view.source : undefined}
            initialDocIndex={view.type === "kb-reference-doc" ? view.docIndex : undefined}
            onDocOpen={(source, docIndex) =>
              navigate({ type: "kb-reference-doc", source, docIndex })
            }
            onDocClose={() => navigate({ type: "kb-reference" })}
          />
        )}
      </KnowledgeLayout>
    );
  }

  // Settings
  if (view.type === "settings") {
    return (
      <SettingsView
        marketplaceItems={catalog?.settings || []}
        onMarketplaceSelect={(item) => {
          const template = catalog?.settings.find((c) => c.path === item.path);
          if (template)
            navigate({ type: "template-detail", template, category: "settings" });
        }}
        onBrowseMore={() => navigate({ type: "marketplace", category: "settings" })}
      />
    );
  }

  // Marketplace
  if (view.type === "marketplace" || view.type === "template-detail") {
    return (
      <MarketplaceLayout
        currentCategory={
          view.type === "marketplace" ? (view.category ?? marketplaceCategory) : view.category
        }
        onCategoryClick={(category) => navigate({ type: "marketplace", category })}
      >
        {view.type === "marketplace" && (
          <MarketplaceView
            initialCategory={view.category ?? marketplaceCategory}
            onSelectTemplate={(template, category) => {
              setMarketplaceCategory(category);
              navigate({ type: "template-detail", template, category });
            }}
          />
        )}
        {view.type === "template-detail" && (
          <TemplateDetailView
            template={view.template}
            category={view.category}
            onBack={() => navigate({ type: "marketplace", category: marketplaceCategory })}
            onNavigateToInstalled={
              view.category === "mcps" ? () => navigate({ type: "mcp" }) : undefined
            }
          />
        )}
      </MarketplaceLayout>
    );
  }

  // Feature Todo
  if (view.type === "feature-todo") {
    return <FeatureTodo feature={view.feature} />;
  }

  return null;
}
