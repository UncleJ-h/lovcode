import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PlusIcon, CheckCircledIcon, UpdateIcon, ExclamationTriangleIcon, TimerIcon, ArchiveIcon, HomeIcon, DashboardIcon, CubeIcon, ChevronRightIcon, ChevronDownIcon, DrawingPinFilledIcon } from "@radix-ui/react-icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "../../components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import type { WorkspaceProject, FeatureStatus } from "./types";

function ProjectLogo({ projectPath }: { projectPath: string }) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    invoke<string | null>("get_project_logo", { projectPath })
      .then(setLogoSrc)
      .catch(() => setLogoSrc(null));
  }, [projectPath]);

  if (!logoSrc) {
    return <CubeIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
  }

  return (
    <img
      src={logoSrc}
      alt="Project logo"
      className="w-5 h-5 rounded object-contain flex-shrink-0"
    />
  );
}

interface ProjectSidebarProps {
  projects: WorkspaceProject[];
  activeProjectId?: string;
  activeFeatureId?: string;
  onSelectFeature: (projectId: string, featureId: string) => void;
  onAddProject: () => void;
  onAddFeature: (projectId: string) => void;
  onArchiveProject: (id: string) => void;
  onUnarchiveProject: (id: string) => void;
  onUnarchiveFeature: (projectId: string, featureId: string) => void;
  onOpenProjectHome: (id: string) => void;
  onOpenFeaturePanel: (id: string) => void;
}

export function ProjectSidebar({
  projects,
  activeProjectId,
  activeFeatureId,
  onSelectFeature,
  onAddProject,
  onAddFeature,
  onArchiveProject,
  onUnarchiveProject,
  onUnarchiveFeature,
  onOpenProjectHome,
  onOpenFeaturePanel,
}: ProjectSidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() =>
    new Set(activeProjectId ? [activeProjectId] : [])
  );

  // Auto-expand active project
  useEffect(() => {
    if (activeProjectId && !expandedProjects.has(activeProjectId)) {
      setExpandedProjects(prev => new Set([...prev, activeProjectId]));
    }
  }, [activeProjectId]);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);

  return (
    <div className="w-48 flex flex-col border-r border-border bg-card">
      <div className="flex-1 overflow-y-auto py-2">
        {activeProjects.map((project) => {
            const isActive = project.id === activeProjectId;
            const isExpanded = expandedProjects.has(project.id);
            const activeFeatures = project.features.filter((f) => !f.archived);
            const archivedFeatures = project.features.filter((f) => f.archived);

            const hasFeatures = activeFeatures.length > 0;

            return (
              <div key={project.id} className="mb-0.5">
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`group mx-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        isActive ? "bg-primary/10" : "hover:bg-card-alt"
                      }`}
                      onClick={() => hasFeatures && toggleProjectExpanded(project.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        <ProjectLogo projectPath={project.path} />
                        <span
                          className={`flex-1 text-sm truncate ${
                            isActive ? "text-primary font-medium" : "text-ink"
                          }`}
                        >
                          {project.name.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </span>
                        <span className={`p-0.5 ${hasFeatures ? "text-muted-foreground" : "text-muted-foreground/30"}`}>
                          {isExpanded && hasFeatures ? (
                            <ChevronDownIcon className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRightIcon className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="min-w-[180px]">
                    {/* Feature Management */}
                    <ContextMenuLabel>Feature</ContextMenuLabel>
                    <ContextMenuItem
                      onClick={() => onAddFeature(project.id)}
                      className="gap-2 cursor-pointer"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      <span>New Feature</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => onOpenFeaturePanel(project.id)}
                      className="gap-2 cursor-pointer"
                    >
                      <DashboardIcon className="w-3.5 h-3.5" />
                      <span>Open Features</span>
                    </ContextMenuItem>
                    {archivedFeatures.length > 0 && (
                      <ContextMenuSub>
                        <ContextMenuSubTrigger className="gap-2">
                          <ArchiveIcon className="w-3.5 h-3.5" />
                          <span>Archived ({archivedFeatures.length})</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="min-w-[160px]">
                          {archivedFeatures.map((feature) => (
                            <ContextMenuItem
                              key={feature.id}
                              onClick={() => onUnarchiveFeature(project.id, feature.id)}
                              className="gap-2 cursor-pointer"
                            >
                              <StatusIcon status={feature.status} />
                              <span className="truncate">{feature.name}</span>
                            </ContextMenuItem>
                          ))}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    )}
                    <ContextMenuSeparator />
                    {/* Project Management */}
                    <ContextMenuLabel>Project</ContextMenuLabel>
                    <ContextMenuItem
                      onClick={() => onOpenProjectHome(project.id)}
                      className="gap-2 cursor-pointer"
                    >
                      <HomeIcon className="w-3.5 h-3.5" />
                      <span>Project Home</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => onArchiveProject(project.id)}
                      className="gap-2 cursor-pointer"
                    >
                      <ArchiveIcon className="w-3.5 h-3.5" />
                      <span>Archive Project</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                {/* Nested features - aligned with project name (after logo) */}
                {isExpanded && activeFeatures.length > 0 && (
                  <div className="mt-0.5">
                    {activeFeatures
                      .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
                      .map((feature) => {
                        const isFeatureActive = isActive && feature.id === activeFeatureId;
                        return (
                          <div
                            key={feature.id}
                            className={`flex items-center gap-1.5 ml-[30px] mr-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                              isFeatureActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-ink hover:bg-card-alt"
                            }`}
                            onClick={() => onSelectFeature(project.id, feature.id)}
                          >
                            {feature.pinned && <DrawingPinFilledIcon className="w-3 h-3 text-primary/70 flex-shrink-0" />}
                            <StatusIcon status={feature.status} />
                            {feature.seq > 0 && <span className="text-xs text-muted-foreground/60">#{feature.seq}</span>}
                            <span className="text-sm truncate">{feature.name}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <div className="p-2 border-t border-border flex gap-1">
        <button
          onClick={onAddProject}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-ink hover:bg-card-alt rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add
        </button>
        {archivedProjects.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-ink hover:bg-card-alt rounded-lg transition-colors">
              <ArchiveIcon className="w-4 h-4" />
              <span className="text-xs">{archivedProjects.length}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {archivedProjects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => onUnarchiveProject(project.id)}
                  className="cursor-pointer"
                >
                  <span className="truncate">{project.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: FeatureStatus }) {
  switch (status) {
    case "pending":
      return <TimerIcon className="w-3.5 h-3.5 text-muted-foreground" />;
    case "running":
      return <UpdateIcon className="w-3.5 h-3.5 text-blue-500" />;
    case "completed":
      return <CheckCircledIcon className="w-3.5 h-3.5 text-green-500" />;
    case "needs-review":
      return <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500" />;
  }
}
