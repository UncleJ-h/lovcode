import { useState, useCallback, useEffect, useRef } from "react";
import {
  PlusIcon,
  CheckCircledIcon,
  UpdateIcon,
  ExclamationTriangleIcon,
  TimerIcon,
  Cross2Icon,
  DrawingPinIcon,
  DrawingPinFilledIcon,
  Pencil1Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { TerminalPane } from "../../components/Terminal";
import type { Feature, FeatureStatus } from "./types";
import type { PanelState } from "../../components/PanelGrid";

interface FeatureSidebarProps {
  // Project
  projectName: string;
  // Features
  features: Feature[];
  activeFeatureId?: string;
  onSelectFeature: (id: string) => void;
  onAddFeature: (name: string) => void;
  onRenameFeature: (id: string, name: string) => void;
  onUpdateFeatureStatus: (id: string, status: FeatureStatus, note?: string) => void;
  onArchiveFeature: (id: string, note?: string) => void;
  onPinFeature: (id: string, pinned: boolean) => void;
  // Pinned panels
  pinnedPanels: PanelState[];
  onAddPinnedPanel: () => void;
  onPanelClose: (id: string) => void;
  onPanelToggleShared: (id: string) => void;
  onPanelReload: (id: string) => void;
  onSessionAdd: (panelId: string) => void;
  onSessionClose: (panelId: string, sessionId: string) => void;
  onSessionSelect: (panelId: string, sessionId: string) => void;
  onSessionTitleChange: (panelId: string, sessionId: string, title: string) => void;
  // Sidebar state
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

const STATUS_OPTIONS: { value: FeatureStatus; label: string; icon: React.ReactNode }[] = [
  { value: "pending", label: "Pending", icon: <TimerIcon className="w-3.5 h-3.5 text-muted-foreground" /> },
  { value: "running", label: "Running", icon: <UpdateIcon className="w-3.5 h-3.5 text-blue-500" /> },
  { value: "completed", label: "Completed", icon: <CheckCircledIcon className="w-3.5 h-3.5 text-green-500" /> },
  { value: "needs-review", label: "Needs Review", icon: <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500" /> },
];

type ArchiveAction = { type: "complete"; featureId: string } | { type: "cancel"; featureId: string };
type NameDialogState = { type: "add" } | { type: "rename"; featureId: string; currentName: string } | null;

export function FeatureSidebar({
  projectName,
  features,
  activeFeatureId,
  onSelectFeature,
  onAddFeature,
  onRenameFeature,
  onUpdateFeatureStatus,
  onArchiveFeature,
  onPinFeature,
  pinnedPanels,
  onAddPinnedPanel,
  onPanelClose,
  onPanelToggleShared,
  onPanelReload,
  onSessionAdd,
  onSessionClose,
  onSessionSelect,
  onSessionTitleChange,
  collapsed,
  onCollapsedChange,
}: FeatureSidebarProps) {
  const [archiveAction, setArchiveAction] = useState<ArchiveAction | null>(null);
  const [archiveNote, setArchiveNote] = useState("");
  const [nameDialog, setNameDialog] = useState<NameDialogState>(null);
  const [featureName, setFeatureName] = useState("");
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(() => new Set());
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem("feature-sidebar-width");
    return saved ? Number(saved) : 256;
  });
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Persist width
  useEffect(() => {
    localStorage.setItem("feature-sidebar-width", String(width));
  }, [width]);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const startX = e.clientX;
    const startWidth = width;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 180), 480);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [width]);

  const activeFeatures = features
    .filter((f) => !f.archived)
    .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
  const pendingFeature = archiveAction ? features.find((f) => f.id === archiveAction.featureId) : null;

  // Auto-expand newly pinned panels
  useEffect(() => {
    const newIds = pinnedPanels.filter(p => !expandedPanels.has(p.id)).map(p => p.id);
    if (newIds.length > 0) {
      setExpandedPanels(prev => new Set([...prev, ...newIds]));
    }
  }, [pinnedPanels]);

  const togglePanelExpanded = useCallback((panelId: string) => {
    setExpandedPanels(prev => {
      const next = new Set(prev);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  }, []);

  const handleConfirmArchive = () => {
    if (!archiveAction) return;
    const note = archiveNote.trim() || undefined;
    if (archiveAction.type === "complete") {
      onUpdateFeatureStatus(archiveAction.featureId, "completed", note);
    } else {
      onArchiveFeature(archiveAction.featureId, note);
    }
    setArchiveAction(null);
    setArchiveNote("");
  };

  const handleCancelDialog = () => {
    setArchiveAction(null);
    setArchiveNote("");
  };

  const handleOpenAddDialog = () => {
    setNameDialog({ type: "add" });
    setFeatureName("");
  };

  const handleOpenRenameDialog = (featureId: string, currentName: string) => {
    setNameDialog({ type: "rename", featureId, currentName });
    setFeatureName(currentName);
  };

  const handleConfirmName = () => {
    const name = featureName.trim();
    if (!name || !nameDialog) return;
    if (nameDialog.type === "add") {
      onAddFeature(name);
    } else {
      onRenameFeature(nameDialog.featureId, name);
    }
    setNameDialog(null);
    setFeatureName("");
  };

  const handleCancelNameDialog = () => {
    setNameDialog(null);
    setFeatureName("");
  };

  // Collapsed state
  if (collapsed) {
    return (
      <div className="h-full flex flex-col bg-canvas-alt border-r border-border w-8">
        <button
          onClick={() => onCollapsedChange(false)}
          className="p-2 text-muted-foreground hover:text-ink hover:bg-card-alt transition-colors"
          title="Expand sidebar"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
        <div className="flex-1 flex flex-col items-center pt-2 gap-2">
          {activeFeatures.map((feature) => (
            <div
              key={feature.id}
              className={`w-1.5 h-1.5 rounded-full cursor-pointer ${
                feature.id === activeFeatureId ? "bg-primary" : "bg-muted-foreground/40"
              }`}
              title={feature.name}
              onClick={() => onSelectFeature(feature.id)}
            />
          ))}
          {pinnedPanels.length > 0 && (
            <>
              <div className="w-4 border-t border-border my-1" />
              {pinnedPanels.map((panel) => (
                <DrawingPinFilledIcon
                  key={panel.id}
                  className="w-3 h-3 text-primary/70"
                  title={panel.sessions.find(s => s.id === panel.activeSessionId)?.title || "Pinned"}
                />
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  const expandedCount = pinnedPanels.filter(p => expandedPanels.has(p.id)).length;

  return (
    <>
      <div
        ref={sidebarRef}
        className="h-full flex flex-col bg-canvas-alt border-r border-border min-w-0 relative"
        style={{ width }}
      >
        {/* Resize handle - wider hit area, thin visual line */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
        >
          <div className="absolute right-1.5 top-0 bottom-0 w-0.5 group-hover:bg-primary/50 transition-colors" />
        </div>
        {/* Header */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border flex-shrink-0">
          <button
            onClick={() => onCollapsedChange(true)}
            className="p-1 text-muted-foreground hover:text-ink hover:bg-card-alt transition-colors rounded"
            title="Collapse sidebar"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="flex-1 text-sm font-medium text-ink px-1 truncate capitalize">{projectName}</span>
          <button
            onClick={handleOpenAddDialog}
            className="p-1 text-muted-foreground hover:text-ink hover:bg-card-alt transition-colors rounded"
            title="New feature"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onAddPinnedPanel}
            className="p-1 text-muted-foreground hover:text-primary hover:bg-card-alt transition-colors rounded"
            title="New pinned terminal"
          >
            <DrawingPinIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Features list */}
        <div className="flex-shrink-0 max-h-48 overflow-y-auto">
          {activeFeatures.map((feature) => {
            const isActive = feature.id === activeFeatureId;
            return (
              <ContextMenu key={feature.id}>
                <ContextMenuTrigger asChild>
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary border-l-2 border-primary"
                        : "text-muted-foreground hover:text-ink hover:bg-card-alt border-l-2 border-transparent"
                    }`}
                    onClick={() => onSelectFeature(feature.id)}
                  >
                    {feature.pinned && <DrawingPinFilledIcon className="w-3 h-3 text-primary/70 flex-shrink-0" />}
                    <StatusIcon status={feature.status} />
                    <span className="text-sm truncate">{feature.name}</span>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="min-w-[160px]">
                  <ContextMenuItem
                    onClick={() => handleOpenRenameDialog(feature.id, feature.name)}
                    className="gap-2 cursor-pointer"
                  >
                    <Pencil1Icon className="w-3.5 h-3.5" />
                    <span>Rename</span>
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => onPinFeature(feature.id, !feature.pinned)}
                    className="gap-2 cursor-pointer"
                  >
                    {feature.pinned ? (
                      <DrawingPinFilledIcon className="w-3.5 h-3.5" />
                    ) : (
                      <DrawingPinIcon className="w-3.5 h-3.5" />
                    )}
                    <span>{feature.pinned ? "Unpin" : "Pin"}</span>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  {STATUS_OPTIONS.map((option) => (
                    <ContextMenuItem
                      key={option.value}
                      onClick={() => {
                        if (option.value === "completed") {
                          setArchiveAction({ type: "complete", featureId: feature.id });
                        } else {
                          onUpdateFeatureStatus(feature.id, option.value);
                        }
                      }}
                      className={`gap-2 cursor-pointer ${feature.status === option.value ? "bg-accent" : ""}`}
                    >
                      {option.icon}
                      <span>{option.label}</span>
                    </ContextMenuItem>
                  ))}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => setArchiveAction({ type: "cancel", featureId: feature.id })}
                    className="gap-2 cursor-pointer text-muted-foreground"
                  >
                    <Cross2Icon className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>

        {/* Pinned sessions */}
        {pinnedPanels.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col border-t border-border">
            <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0">
              <DrawingPinFilledIcon className="w-3.5 h-3.5 text-primary/70" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pinned
              </span>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {pinnedPanels.map((panel) => {
                const isExpanded = expandedPanels.has(panel.id);
                const activeSession = panel.sessions.find(s => s.id === panel.activeSessionId);
                return (
                  <div
                    key={panel.id}
                    className={`flex flex-col overflow-hidden ${
                      isExpanded ? (expandedCount > 0 ? "flex-1 min-h-0" : "flex-1") : "flex-shrink-0"
                    }`}
                  >
                    {/* Panel header - same style as feature items */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors text-muted-foreground hover:text-ink hover:bg-card-alt border-l-2 border-transparent"
                          onClick={() => togglePanelExpanded(panel.id)}
                        >
                          {isExpanded ? (
                            <ChevronDownIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          ) : (
                            <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          )}
                          <span className="text-sm truncate">{activeSession?.title || "Pinned"}</span>
                          {panel.sessions.length > 1 && (
                            <span className="text-xs text-muted-foreground/60">+{panel.sessions.length - 1}</span>
                          )}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="min-w-[160px]">
                        <ContextMenuItem onClick={() => onSessionAdd(panel.id)} className="gap-2 cursor-pointer">
                          <PlusIcon className="w-3.5 h-3.5" />
                          <span>New Tab</span>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onPanelReload(panel.id)} className="gap-2 cursor-pointer">
                          <ReloadIcon className="w-3.5 h-3.5" />
                          <span>Reload</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => onPanelToggleShared(panel.id)} className="gap-2 cursor-pointer">
                          <DrawingPinIcon className="w-3.5 h-3.5" />
                          <span>Unpin</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => onPanelClose(panel.id)}
                          className="gap-2 cursor-pointer text-red-500 focus:text-red-500"
                        >
                          <Cross2Icon className="w-3.5 h-3.5" />
                          <span>Close</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* Terminal content */}
                    {isExpanded && (
                      <div className="flex-1 min-h-0 relative bg-terminal border-l-2 border-transparent ml-0">
                        {panel.sessions.map((session) => (
                          <div
                            key={session.id}
                            className={`absolute inset-0 ${session.id === panel.activeSessionId ? "" : "hidden"}`}
                          >
                            <TerminalPane
                              ptyId={session.ptyId}
                              cwd={panel.cwd}
                              command={session.command}
                              onTitleChange={(title) => onSessionTitleChange(panel.id, session.id, title)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Archive confirmation dialog */}
      <Dialog open={archiveAction !== null} onOpenChange={(open) => !open && handleCancelDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {archiveAction?.type === "complete" ? "Complete" : "Cancel"} "{pendingFeature?.name}"
            </DialogTitle>
          </DialogHeader>
          <textarea
            value={archiveNote}
            onChange={(e) => setArchiveNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleConfirmArchive();
              }
            }}
            placeholder="Add a note (optional)"
            className="w-full h-24 px-3 py-2 text-sm border border-border rounded-lg bg-card text-ink resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={handleCancelDialog}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-ink hover:bg-card-alt rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleConfirmArchive}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
            >
              {archiveAction?.type === "complete" ? "Complete" : "Cancel"} Feature
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Name dialog for add/rename */}
      <Dialog open={nameDialog !== null} onOpenChange={(open) => !open && handleCancelNameDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {nameDialog?.type === "add" ? "New Feature" : "Rename Feature"}
            </DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={featureName}
            onChange={(e) => setFeatureName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirmName();
              if (e.key === "Escape") handleCancelNameDialog();
            }}
            placeholder="Feature name"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={handleCancelNameDialog}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-ink hover:bg-card-alt rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmName}
              disabled={!featureName.trim()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
            >
              {nameDialog?.type === "add" ? "Create" : "Rename"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusIcon({ status }: { status: FeatureStatus }) {
  switch (status) {
    case "pending":
      return <TimerIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />;
    case "running":
      return <UpdateIcon className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />;
    case "completed":
      return <CheckCircledIcon className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
    case "needs-review":
      return <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
  }
}
