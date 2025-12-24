import { PlusIcon, CheckCircledIcon, UpdateIcon, ExclamationTriangleIcon, TimerIcon, ArchiveIcon } from "@radix-ui/react-icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
} from "../../components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import type { WorkspaceProject, FeatureStatus } from "./types";

interface ProjectSidebarProps {
  projects: WorkspaceProject[];
  activeProjectId?: string;
  onSelectProject: (id: string) => void;
  onAddProject: () => void;
  onArchiveProject: (id: string) => void;
  onUnarchiveProject: (id: string) => void;
  onUnarchiveFeature: (projectId: string, featureId: string) => void;
}

export function ProjectSidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onArchiveProject,
  onUnarchiveProject,
  onUnarchiveFeature,
}: ProjectSidebarProps) {
  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);
  return (
    <div className="w-48 flex flex-col border-r border-border bg-card">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-ink">Projects</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {activeProjects.map((project) => {
          const isActive = project.id === activeProjectId;
          const statusCounts = getStatusCounts(project);
          const archivedFeatures = project.features.filter((f) => f.archived);

          return (
            <ContextMenu key={project.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={`group mx-2 mb-1 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isActive ? "bg-primary/10" : "hover:bg-card-alt"
                  }`}
                  onClick={() => onSelectProject(project.id)}
                >
                  <span
                    className={`text-sm truncate ${
                      isActive ? "text-primary font-medium" : "text-ink"
                    }`}
                  >
                    {project.name}
                  </span>
                  {/* Status indicators */}
                  <div className="flex items-center gap-2 mt-1">
                    {statusCounts.running > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-blue-500">
                        <UpdateIcon className="w-3 h-3 animate-spin" />
                        {statusCounts.running}
                      </span>
                    )}
                    {statusCounts.needsReview > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500">
                        <ExclamationTriangleIcon className="w-3 h-3" />
                        {statusCounts.needsReview}
                      </span>
                    )}
                    {statusCounts.completed > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-green-500">
                        <CheckCircledIcon className="w-3 h-3" />
                        {statusCounts.completed}
                      </span>
                    )}
                    {archivedFeatures.length > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <ArchiveIcon className="w-3 h-3" />
                        {archivedFeatures.length}
                      </span>
                    )}
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-[160px]">
                {archivedFeatures.length > 0 && (
                  <>
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
                    <ContextMenuSeparator />
                  </>
                )}
                <ContextMenuItem
                  onClick={() => onArchiveProject(project.id)}
                  className="gap-2 cursor-pointer"
                >
                  <ArchiveIcon className="w-3.5 h-3.5" />
                  <span>Archive Project</span>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
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

function getStatusCounts(project: WorkspaceProject) {
  const counts = { pending: 0, running: 0, completed: 0, needsReview: 0 };
  for (const feature of project.features) {
    if (feature.archived) continue;
    switch (feature.status) {
      case "pending":
        counts.pending++;
        break;
      case "running":
        counts.running++;
        break;
      case "completed":
        counts.completed++;
        break;
      case "needs-review":
        counts.needsReview++;
        break;
    }
  }
  return counts;
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
