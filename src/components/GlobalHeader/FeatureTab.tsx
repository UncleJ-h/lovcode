import { useState, useRef, useEffect, memo } from 'react';
import { useAtom } from 'jotai';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Cross2Icon,
  CheckCircledIcon,
  TimerIcon,
  DrawingPinFilledIcon,
  ArchiveIcon,
  GearIcon,
} from '@radix-ui/react-icons';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { workspaceDataAtom } from '@/store';
import { invoke } from '@tauri-apps/api/core';
import type { Feature, FeatureStatus, WorkspaceData } from '@/views/Workspace/types';

interface FeatureTabProps {
  feature: Feature;
  projectId: string;
  isActive: boolean;
  onSelect: () => void;
  isDragging?: boolean;
  dragHandleProps?: ReturnType<typeof useSortable>['listeners'];
}

export const FeatureTab = memo(function FeatureTab({
  feature,
  projectId,
  isActive,
  onSelect,
  isDragging,
  dragHandleProps,
}: FeatureTabProps) {
  const [workspace, setWorkspace] = useAtom(workspaceDataAtom);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(feature.name);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailForm, setDetailForm] = useState({
    name: feature.name,
    description: feature.description || '',
    status: feature.status,
    git_branch: feature.git_branch || '',
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isRenaming]);

  const saveWorkspace = async (data: WorkspaceData) => {
    setWorkspace(data);
    await invoke('workspace_save', { data });
  };

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === feature.name || !workspace) {
      setIsRenaming(false);
      setRenameValue(feature.name);
      return;
    }

    await invoke('workspace_rename_feature', { featureId: feature.id, name: trimmed });

    const newProjects = workspace.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            features: p.features.map((f) => (f.id === feature.id ? { ...f, name: trimmed } : f)),
          }
        : p
    );

    await saveWorkspace({ ...workspace, projects: newProjects });
    setIsRenaming(false);
  };

  const handleArchive = async (note?: string) => {
    if (!workspace) return;

    const newProjects = workspace.projects.map((p) => {
      if (p.id !== projectId) return p;
      const activeFeatures = p.features.filter((f) => f.id !== feature.id && !f.archived);
      return {
        ...p,
        features: p.features.map((f) =>
          f.id === feature.id ? { ...f, archived: true, archived_note: note } : f
        ),
        active_feature_id:
          p.active_feature_id === feature.id ? activeFeatures[0]?.id : p.active_feature_id,
      };
    });

    await saveWorkspace({ ...workspace, projects: newProjects });
  };

  const handlePin = async () => {
    if (!workspace) return;

    const newProjects = workspace.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            features: p.features.map((f) =>
              f.id === feature.id ? { ...f, pinned: !f.pinned } : f
            ),
          }
        : p
    );

    await saveWorkspace({ ...workspace, projects: newProjects });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(feature.name);
    setIsRenaming(true);
  };

  const openDetailDialog = () => {
    setDetailForm({
      name: feature.name,
      description: feature.description || '',
      status: feature.status,
      git_branch: feature.git_branch || '',
    });
    setIsDetailOpen(true);
  };

  const handleSaveDetail = async () => {
    if (!workspace) return;
    const trimmedName = detailForm.name.trim();
    if (!trimmedName) return;

    if (trimmedName !== feature.name) {
      await invoke('workspace_rename_feature', { featureId: feature.id, name: trimmedName });
    }

    const newProjects = workspace.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            features: p.features.map((f) =>
              f.id === feature.id
                ? {
                    ...f,
                    name: trimmedName,
                    description: detailForm.description || undefined,
                    status: detailForm.status,
                    git_branch: detailForm.git_branch || undefined,
                  }
                : f
            ),
          }
        : p
    );

    await saveWorkspace({ ...workspace, projects: newProjects });
    setIsDetailOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.keyCode === 229) return; // IME
    if (e.key === 'Enter' && !isComposingRef.current) {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setRenameValue(feature.name);
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={onSelect}
            onDoubleClick={handleDoubleClick}
            onPointerDown={(e) => e.stopPropagation()}
            className={`group flex max-w-[140px] cursor-pointer items-center gap-1 rounded-md px-2 py-1 transition-colors ${
              isDragging
                ? 'bg-primary/20 shadow-lg'
                : isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-ink hover:bg-card-alt'
            }`}
          >
            {feature.pinned && (
              <DrawingPinFilledIcon className="text-primary/70 h-2.5 w-2.5 flex-shrink-0" />
            )}
            {isRenaming ? (
              <input
                ref={inputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={() => {
                  isComposingRef.current = false;
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border-border focus:border-primary w-16 flex-shrink-0 rounded border px-1 text-xs outline-none"
              />
            ) : (
              <span
                className="min-w-0 cursor-grab truncate text-xs active:cursor-grabbing"
                title={feature.name}
                {...dragHandleProps}
              >
                {feature.name}
              </span>
            )}
            {/* Close button - archive on click */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleArchive();
              }}
              className="hover:bg-muted flex-shrink-0 rounded p-0.5 opacity-0 transition-all group-hover:opacity-100"
              title="Archive"
            >
              <Cross2Icon className="h-3 w-3" />
            </button>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="min-w-[140px]">
          <ContextMenuItem onClick={openDetailDialog} className="cursor-pointer gap-2">
            <GearIcon className="h-3.5 w-3.5" />
            Details
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handlePin} className="cursor-pointer gap-2">
            <DrawingPinFilledIcon className="h-3.5 w-3.5" />
            {feature.pinned ? 'Unpin' : 'Pin'}
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <ArchiveIcon className="h-3.5 w-3.5" />
              Archive
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="min-w-[120px]">
              <ContextMenuItem
                onClick={() => handleArchive('completed')}
                className="cursor-pointer gap-2"
              >
                <CheckCircledIcon className="h-3.5 w-3.5 text-green-500" />
                Completed
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleArchive('cancelled')}
                className="cursor-pointer gap-2"
              >
                <Cross2Icon className="text-muted-foreground h-3.5 w-3.5" />
                Cancelled
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => handleArchive('on-hold')}
                className="cursor-pointer gap-2"
              >
                <TimerIcon className="h-3.5 w-3.5 text-amber-500" />
                On Hold
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>

      {/* Feature Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feature Details</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Name</label>
              <input
                value={detailForm.name}
                onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })}
                className="bg-background border-border focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={detailForm.description}
                onChange={(e) => setDetailForm({ ...detailForm, description: e.target.value })}
                rows={3}
                placeholder="Optional description..."
                className="bg-background border-border focus:ring-primary w-full resize-none rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Status</label>
              <select
                value={detailForm.status}
                onChange={(e) =>
                  setDetailForm({ ...detailForm, status: e.target.value as FeatureStatus })
                }
                className="bg-background border-border focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="needs-review">Needs Review</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Git Branch</label>
              <input
                value={detailForm.git_branch}
                onChange={(e) => setDetailForm({ ...detailForm, git_branch: e.target.value })}
                placeholder="feature/my-branch"
                className="bg-background border-border focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsDetailOpen(false)}
              className="border-border hover:bg-muted rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDetail}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm"
            >
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

// Sortable wrapper for drag-and-drop
export function SortableFeatureTab(props: Omit<FeatureTabProps, 'isDragging' | 'dragHandleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.feature.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex-shrink-0">
      <FeatureTab {...props} isDragging={isDragging} dragHandleProps={listeners} />
    </div>
  );
}
