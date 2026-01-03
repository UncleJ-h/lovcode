/**
 * [INPUT]: Feature[], FeatureStatus from types.ts
 * [OUTPUT]: KanbanBoard component with drag-and-drop
 * [POS]: 工作区看板视图 - 功能状态管理
 * [PROTOCOL]: 变更时更新此头部，然后检查 views/Workspace/CLAUDE.md
 *
 * 设计借鉴: vibe-kanban KanbanBoard
 * - 列头渐变背景 + 状态圆点
 * - 每列添加任务按钮
 * - 卡片悬停/选中状态增强
 */

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircledIcon,
  UpdateIcon,
  ExclamationTriangleIcon,
  TimerIcon,
  DrawingPinFilledIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import type { Feature, FeatureStatus } from './types';

// ============================================================================
// Constants
// ============================================================================

interface ColumnConfig {
  id: FeatureStatus;
  label: string;
  color: string; // CSS variable name for theming
}

const COLUMNS: ColumnConfig[] = [
  { id: 'pending', label: 'Pending', color: '--muted-foreground' },
  { id: 'running', label: 'Running', color: '--blue-500' },
  { id: 'needs-review', label: 'Needs Review', color: '--amber-500' },
  { id: 'completed', label: 'Completed', color: '--green-500' },
];

const STATUS_COLORS: Record<FeatureStatus, { dot: string; border: string; bg: string }> = {
  pending: {
    dot: 'bg-muted-foreground',
    border: 'border-muted-foreground/30',
    bg: 'from-muted-foreground/5 to-transparent',
  },
  running: {
    dot: 'bg-blue-500',
    border: 'border-blue-500/30',
    bg: 'from-blue-500/5 to-transparent',
  },
  'needs-review': {
    dot: 'bg-amber-500',
    border: 'border-amber-500/30',
    bg: 'from-amber-500/5 to-transparent',
  },
  completed: {
    dot: 'bg-green-500',
    border: 'border-green-500/30',
    bg: 'from-green-500/5 to-transparent',
  },
};

// ============================================================================
// Sub-components
// ============================================================================

function StatusIcon({ status }: { status: FeatureStatus }) {
  const iconClass = 'w-4 h-4';
  switch (status) {
    case 'pending':
      return <TimerIcon className={`${iconClass} text-muted-foreground`} />;
    case 'running':
      return <UpdateIcon className={`${iconClass} text-blue-500`} />;
    case 'completed':
      return <CheckCircledIcon className={`${iconClass} text-green-500`} />;
    case 'needs-review':
      return <ExclamationTriangleIcon className={`${iconClass} text-amber-500`} />;
  }
}

interface FeatureCardProps {
  feature: Feature;
  onClick: () => void;
  isDragging?: boolean;
  isSelected?: boolean;
}

function FeatureCard({ feature, onClick, isDragging, isSelected }: FeatureCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-card cursor-pointer rounded-lg border p-3 transition-all ${isDragging ? 'scale-105 opacity-50 shadow-lg' : ''} ${isSelected ? 'ring-primary border-primary ring-2 ring-inset' : 'border-border'} ${!isDragging && !isSelected ? 'hover:border-primary/50 hover:shadow-sm' : ''} `}
    >
      <div className="flex items-center gap-2">
        {feature.pinned && (
          <DrawingPinFilledIcon className="text-primary/70 h-3 w-3 flex-shrink-0" />
        )}
        <StatusIcon status={feature.status} />
        {feature.seq > 0 && (
          <span className="text-muted-foreground font-mono text-xs">#{feature.seq}</span>
        )}
        <span className="text-ink flex-1 truncate text-sm font-medium">{feature.name}</span>
      </div>
      {feature.git_branch && (
        <div className="text-muted-foreground mt-2 truncate font-mono text-xs">
          {feature.git_branch}
        </div>
      )}
      {feature.description && (
        <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">{feature.description}</div>
      )}
    </div>
  );
}

function SortableFeatureCard({
  feature,
  onClick,
  isSelected,
}: {
  feature: Feature;
  onClick: () => void;
  isSelected?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feature.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FeatureCard
        feature={feature}
        onClick={onClick}
        isDragging={isDragging}
        isSelected={isSelected}
      />
    </div>
  );
}

// ============================================================================
// KanbanHeader - Column header with gradient and add button
// ============================================================================

interface KanbanHeaderProps {
  status: FeatureStatus;
  label: string;
  count: number;
  onAddTask?: () => void;
}

function KanbanHeader({ status, label, count, onAddTask }: KanbanHeaderProps) {
  const colors = STATUS_COLORS[status];

  return (
    <div
      className={`sticky top-0 z-10 border-b-2 px-3 py-2 ${colors.border} bg-gradient-to-b ${colors.bg} `}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
          <span className="text-ink text-sm font-medium">{label}</span>
          <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs">
            {count}
          </span>
        </span>
        {onAddTask && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onAddTask}
                  className="text-muted-foreground hover:text-ink hover:bg-card-alt rounded p-1 transition-colors"
                  aria-label={`Add task to ${label}`}
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Add task</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// KanbanColumn
// ============================================================================

interface KanbanColumnProps {
  status: FeatureStatus;
  label: string;
  features: Feature[];
  selectedFeatureId?: string;
  onFeatureClick: (featureId: string) => void;
  onAddTask?: () => void;
}

function KanbanColumn({
  status,
  label,
  features,
  selectedFeatureId,
  onFeatureClick,
  onAddTask,
}: KanbanColumnProps) {
  return (
    <div className="flex max-w-[320px] min-w-[220px] flex-1 flex-col">
      <KanbanHeader status={status} label={label} count={features.length} onAddTask={onAddTask} />
      <div className="bg-muted/20 min-h-[120px] flex-1 space-y-2 overflow-y-auto p-2">
        <SortableContext items={features.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {features.map((feature) => (
            <SortableFeatureCard
              key={feature.id}
              feature={feature}
              onClick={() => onFeatureClick(feature.id)}
              isSelected={feature.id === selectedFeatureId}
            />
          ))}
        </SortableContext>
        {features.length === 0 && (
          <div className="text-muted-foreground flex h-20 items-center justify-center text-xs">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// KanbanBoard - Main component
// ============================================================================

interface KanbanBoardProps {
  features: Feature[];
  selectedFeatureId?: string;
  onFeatureClick: (featureId: string) => void;
  onFeatureStatusChange: (featureId: string, status: FeatureStatus) => void;
  onAddTask?: (status: FeatureStatus) => void;
}

export function KanbanBoard({
  features,
  selectedFeatureId,
  onFeatureClick,
  onFeatureStatusChange,
  onAddTask,
}: KanbanBoardProps) {
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const featuresByStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = features.filter((f) => f.status === col.id && !f.archived);
      return acc;
    },
    {} as Record<FeatureStatus, Feature[]>
  );

  const handleDragStart = (event: DragStartEvent) => {
    const feature = features.find((f) => f.id === event.active.id);
    setActiveFeature(feature || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveFeature(null);

    if (!over) return;

    const activeFeatureId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const targetColumn = COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      const feature = features.find((f) => f.id === activeFeatureId);
      if (feature && feature.status !== targetColumn.id) {
        onFeatureStatusChange(activeFeatureId, targetColumn.id);
      }
      return;
    }

    // Check if dropped on another feature - use that feature's status
    const targetFeature = features.find((f) => f.id === overId);
    if (targetFeature) {
      const sourceFeature = features.find((f) => f.id === activeFeatureId);
      if (sourceFeature && sourceFeature.status !== targetFeature.status) {
        onFeatureStatusChange(activeFeatureId, targetFeature.status);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            status={col.id}
            label={col.label}
            features={featuresByStatus[col.id]}
            selectedFeatureId={selectedFeatureId}
            onFeatureClick={onFeatureClick}
            onAddTask={onAddTask ? () => onAddTask(col.id) : undefined}
          />
        ))}
      </div>
      <DragOverlay>
        {activeFeature && <FeatureCard feature={activeFeature} onClick={() => {}} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
