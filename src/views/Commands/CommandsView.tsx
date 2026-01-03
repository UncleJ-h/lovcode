/**
 * [INPUT]: useInvokeQuery, Jotai atoms, DnD context
 * [OUTPUT]: CommandsView component
 * [POS]: 命令管理主视图
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useInvokeQuery } from "../../hooks";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Terminal } from "lucide-react";
import { CommandTrendChart } from "../../components/home";
import { LightningBoltIcon } from "@radix-ui/react-icons";
import {
  LoadingState,
  EmptyState,
  PageHeader,
  ConfigPage,
  MarketplaceSection,
  useSearch,
  type MarketplaceItem,
} from "../../components/config";
import { BrowseMarketplaceButton } from "../../components/shared";
import { useAtom } from "jotai";
import {
  commandsSortKeyAtom,
  commandsSortDirAtom,
  commandsShowDeprecatedAtom,
  commandsViewModeAtom,
  commandsExpandedFoldersAtom,
} from "../../store";
import type { LocalCommand } from "../../types";
import type { CommandSortKey, TreeNode } from "./types";

// Sub-components
import { DraggableCommandItem } from "./DraggableCommandItem";
import { DroppableFolder } from "./DroppableFolder";
import { RootDropZone } from "./RootDropZone";
import { CommandItemCard } from "./CommandItemCard";
import { CommandsToolbar } from "./CommandsToolbar";
import { DeprecateDialog } from "./DeprecateDialog";
import { MoveDialog, CreateDirDialog } from "./MoveDialog";

// Hooks
import { useCommandTree, extractFolders, getCurrentFolder } from "./hooks";
import { useCommandActions } from "./hooks";

// ============================================================================
// Types
// ============================================================================

interface CommandsViewProps {
  onSelect: (cmd: LocalCommand, scrollToChangelog?: boolean) => void;
  marketplaceItems: MarketplaceItem[];
  onMarketplaceSelect: (item: MarketplaceItem) => void;
  onBrowseMore?: () => void;
}

// ============================================================================
// CommandsView Component
// ============================================================================

export function CommandsView({
  onSelect,
  marketplaceItems,
  onMarketplaceSelect,
  onBrowseMore,
}: CommandsViewProps) {
  // Data fetching
  const { data: commands = [], isLoading } = useInvokeQuery<LocalCommand[]>(
    ["commands"],
    "list_local_commands"
  );
  const { data: commandStats = {} } = useInvokeQuery<Record<string, number>>(
    ["commandStats"],
    "get_command_stats"
  );
  const { data: commandWeeklyStats } = useInvokeQuery<Record<string, Record<string, number>>>(
    ["commandWeeklyStats"],
    "get_command_weekly_stats",
    { weeks: 0 }
  );

  // Jotai state
  const [sortKey, setSortKey] = useAtom(commandsSortKeyAtom);
  const [sortDir, setSortDir] = useAtom(commandsSortDirAtom);
  const [showDeprecated, setShowDeprecated] = useAtom(commandsShowDeprecatedAtom);
  const [viewMode, setViewMode] = useAtom(commandsViewModeAtom);
  const [expandedFoldersArr, setExpandedFoldersArr] = useAtom(commandsExpandedFoldersAtom);

  // Local state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const { search, setSearch, filtered } = useSearch(commands, ["name", "description"]);

  // Derived state
  const expandedFolders = useMemo(() => new Set(expandedFoldersArr), [expandedFoldersArr]);
  const folders = useMemo(() => extractFolders(commands), [commands]);

  // Command actions hook
  const actions = useCommandActions();

  // Usage count calculator
  const getUsageCount = useCallback(
    (cmd: LocalCommand) => {
      const mainCount = commandStats[cmd.name.slice(1)] || 0;
      const aliasCount = cmd.aliases.reduce((sum, alias) => {
        const key = alias.startsWith("/") ? alias.slice(1) : alias;
        return sum + (commandStats[key] || 0);
      }, 0);
      return mainCount + aliasCount;
    },
    [commandStats]
  );

  // Filter and sort commands
  const statusFiltered = useMemo(() => {
    return filtered.filter((cmd) => {
      if (cmd.status === "active") return true;
      return showDeprecated || search.length > 0;
    });
  }, [filtered, showDeprecated, search]);

  const sorted = useMemo(() => {
    return [...statusFiltered].sort((a, b) => {
      if (a.status !== "active" && b.status === "active") return 1;
      if (a.status === "active" && b.status !== "active") return -1;

      if (sortKey === "usage") {
        const aCount = getUsageCount(a);
        const bCount = getUsageCount(b);
        return sortDir === "desc" ? bCount - aCount : aCount - bCount;
      } else {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === "desc" ? -cmp : cmp;
      }
    });
  }, [statusFiltered, sortKey, sortDir, getUsageCount]);

  // Build tree using hook
  const { tree } = useCommandTree({
    commands: statusFiltered,
    sortKey,
    sortDir,
    getUsageCount,
  });

  // Counts
  const activeCount = commands.filter((c) => c.status === "active").length;
  const deprecatedCount = commands.filter((c) => c.status !== "active").length;

  // Sort toggle
  const toggleSort = useCallback(
    (key: CommandSortKey) => {
      if (sortKey === key) {
        setSortDir(sortDir === "desc" ? "asc" : "desc");
      } else {
        setSortKey(key);
        setSortDir(key === "usage" ? "desc" : "asc");
      }
    },
    [sortKey, sortDir, setSortKey, setSortDir]
  );

  // Folder toggle
  const toggleFolder = useCallback(
    (path: string) => {
      setExpandedFoldersArr((prev) =>
        prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
      );
    },
    [setExpandedFoldersArr]
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);

      if (!over) return;

      const cmdPath = active.id as string;
      const targetFolder = over.id as string;

      const cmd = commands.find((c) => c.path === cmdPath);
      if (!cmd) return;

      const currentFolder = getCurrentFolder(cmd);
      if (targetFolder === currentFolder) return;

      await actions.handleMove(cmd, targetFolder);
    },
    [commands, actions]
  );

  const activeDragCmd = activeDragId ? commands.find((c) => c.path === activeDragId) : null;

  // Render tree node
  const renderTreeNode = useCallback(
    (node: TreeNode, depth: number = 0): React.ReactNode => {
      const isFolder = node.type === "folder";
      const indent = depth * 24;
      const isExpanded = isFolder && expandedFolders.has(node.path);

      if (isFolder) {
        return (
          <div key={node.path} style={{ marginLeft: indent }}>
            <DroppableFolder
              folderPath={node.path}
              name={node.name}
              childCount={node.children.length}
              isExpanded={isExpanded}
              isOver={false}
              onToggle={() => toggleFolder(node.path)}
            >
              {node.children.map((child) => renderTreeNode(child, depth + 1))}
            </DroppableFolder>
          </div>
        );
      }

      const cmd = node.command;
      const shortName = depth === 0 ? cmd.name : cmd.name.split("/").pop() || cmd.name;
      const isInactive = cmd.status === "deprecated" || cmd.status === "archived";
      const usageCount = getUsageCount(cmd);
      const isDragging = activeDragId === cmd.path;

      return (
        <div key={cmd.path} style={{ marginLeft: indent }}>
          <DraggableCommandItem
            cmd={cmd}
            shortName={shortName}
            usageCount={usageCount}
            isInactive={isInactive}
            isDragging={isDragging}
            onClick={() => onSelect(cmd)}
            onOpenInEditor={() => invoke("open_in_editor", { path: cmd.path })}
            onMove={() => actions.openMoveDialog(cmd)}
            onDeprecate={() => actions.openDeprecateDialog(cmd)}
            onRestore={() => actions.handleRestore(cmd)}
          />
        </div>
      );
    },
    [expandedFolders, toggleFolder, getUsageCount, activeDragId, onSelect, actions]
  );

  // Loading state
  if (isLoading) return <LoadingState message="Loading commands..." />;

  return (
    <ConfigPage>
      <PageHeader
        title="Commands"
        subtitle={`${activeCount} active, ${deprecatedCount} deprecated`}
        action={<BrowseMarketplaceButton onClick={onBrowseMore} />}
      />

      {/* Command Trend Chart */}
      {commandWeeklyStats && Object.keys(commandWeeklyStats).length > 0 && (
        <div className="mb-6 p-4 bg-card/50 rounded-xl border border-border/40">
          <CommandTrendChart data={commandWeeklyStats} />
        </div>
      )}

      {/* Toolbar */}
      <CommandsToolbar
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={toggleSort}
        showDeprecated={showDeprecated}
        onShowDeprecatedChange={setShowDeprecated}
      />

      {/* Flat View */}
      {viewMode === "flat" && sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((cmd) => (
            <CommandItemCard
              key={cmd.path}
              command={cmd}
              usageCount={getUsageCount(cmd)}
              onClick={() => onSelect(cmd)}
              onOpenInEditor={() => invoke("open_in_editor", { path: cmd.path })}
              onDeprecate={() => actions.openDeprecateDialog(cmd)}
              onRestore={() => actions.handleRestore(cmd)}
            />
          ))}
        </div>
      )}

      {/* Tree View */}
      {viewMode === "tree" && tree.length > 0 && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="space-y-1">
            {activeDragId && <RootDropZone isOver={false} />}
            {tree.map((node) => renderTreeNode(node))}
          </div>
          <DragOverlay>
            {activeDragCmd && (
              <div className="flex items-center gap-2 py-1.5 px-2 bg-card border border-primary rounded-md shadow-lg">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="font-mono font-medium text-primary">{activeDragCmd.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Empty States */}
      {statusFiltered.length === 0 && !search && (
        <EmptyState
          icon={LightningBoltIcon}
          message="No commands found"
          hint="Create commands in ~/.claude/commands/"
        />
      )}

      {statusFiltered.length === 0 && search && (
        <p className="text-muted-foreground text-sm">No local commands match "{search}"</p>
      )}

      {/* Marketplace Section */}
      <MarketplaceSection
        items={marketplaceItems}
        search={search}
        onSelect={onMarketplaceSelect}
        onBrowseMore={onBrowseMore}
      />

      {/* Dialogs */}
      <DeprecateDialog
        open={actions.deprecateDialogOpen}
        onOpenChange={actions.setDeprecateDialogOpen}
        selectedCommand={actions.selectedCommand}
        replacementCommand={actions.replacementCommand}
        onReplacementChange={actions.setReplacementCommand}
        deprecationNote={actions.deprecationNote}
        onNoteChange={actions.setDeprecationNote}
        onConfirm={actions.handleDeprecate}
      />

      <MoveDialog
        open={actions.moveDialogOpen}
        onOpenChange={actions.setMoveDialogOpen}
        selectedCommand={actions.selectedCommand}
        folders={folders}
        targetFolder={actions.moveTargetFolder}
        onTargetChange={actions.setMoveTargetFolder}
        onConfirm={() =>
          actions.selectedCommand &&
          actions.handleMove(actions.selectedCommand, actions.moveTargetFolder)
        }
      />

      <CreateDirDialog
        open={actions.moveCreateDirOpen}
        onOpenChange={(open) => {
          actions.setMoveCreateDirOpen(open);
          if (!open) actions.closeMoveCreateDirDialog();
        }}
        dirPath={actions.pendingMove?.dirPath}
        onConfirm={actions.handleConfirmMoveCreateDir}
        onCancel={actions.closeMoveCreateDirDialog}
      />
    </ConfigPage>
  );
}
