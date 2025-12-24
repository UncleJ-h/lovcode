import { useDraggable } from "@dnd-kit/core";
import { Terminal } from "lucide-react";
import {
  DotsHorizontalIcon,
  QuestionMarkCircledIcon,
  ExternalLinkIcon,
  CopyIcon,
  ResetIcon,
  ArchiveIcon,
} from "@radix-ui/react-icons";
import { FolderInput } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import type { LocalCommand } from "../../types";

interface DraggableCommandItemProps {
  cmd: LocalCommand;
  shortName: string;
  usageCount: number;
  isInactive: boolean;
  isDragging: boolean;
  onClick: () => void;
  onOpenInEditor: () => void;
  onMove: () => void;
  onDeprecate: () => void;
  onRestore: () => void;
}

export function DraggableCommandItem({
  cmd,
  shortName,
  usageCount,
  isInactive,
  isDragging,
  onClick,
  onOpenInEditor,
  onMove,
  onDeprecate,
  onRestore,
}: DraggableCommandItemProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: cmd.path,
    disabled: isInactive,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={`w-full flex items-center gap-2 py-1.5 px-2 text-left rounded-md transition-colors select-none ${
        !isInactive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${isInactive ? "opacity-60 hover:opacity-100" : ""} ${isDragging ? "opacity-50 ring-2 ring-primary" : ""} hover:bg-muted/50`}
    >
      <Terminal className={`w-4 h-4 ${isInactive ? "text-muted-foreground" : "text-primary"}`} />
      <span
        className={`font-mono font-medium ${isInactive ? "text-muted-foreground" : "text-primary"}`}
      >
        {shortName}
      </span>
      {cmd.version && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          v{cmd.version.replace(/^["']|["']$/g, "")}
        </span>
      )}
      {usageCount > 0 && (
        <span
          className={`text-xs font-bold italic tabular-nums ${
            usageCount >= 100
              ? "text-amber-500"
              : usageCount >= 50
                ? "text-orange-500"
                : usageCount >= 10
                  ? "text-primary"
                  : "text-muted-foreground"
          }`}
          title={`Used ${usageCount} times`}
        >
          ×{usageCount}
        </span>
      )}
      {cmd.aliases && cmd.aliases.length > 0 && (
        <span className="relative group/aliases">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70 font-medium">
            +{cmd.aliases.length}
          </span>
          <div className="absolute left-0 top-full mt-1 hidden group-hover/aliases:block z-50 bg-popover border border-border rounded-md shadow-md p-2 min-w-max">
            <div className="text-xs text-muted-foreground mb-1">Aliases:</div>
            {cmd.aliases.map((alias, i) => (
              <div key={i} className="font-mono text-xs text-primary">
                {alias}
              </div>
            ))}
          </div>
        </span>
      )}
      <span className="flex-1" />
      {cmd.status === "deprecated" && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600">
          deprecated
        </span>
      )}
      {cmd.status === "archived" && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-card-alt text-muted-foreground">
          archived
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span
            role="button"
            className="w-4 h-4 flex items-center justify-center cursor-pointer hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <DotsHorizontalIcon className="w-4 h-4" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={onClick}>
            <QuestionMarkCircledIcon className="w-4 h-4 mr-2" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenInEditor}>
            <ExternalLinkIcon className="w-4 h-4 mr-2" />
            Open in Editor
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(cmd.path)}>
            <CopyIcon className="w-4 h-4 mr-2" />
            Copy Path
          </DropdownMenuItem>
          {!isInactive && (
            <DropdownMenuItem onSelect={onMove}>
              <FolderInput className="w-4 h-4 mr-2" />
              Move to...
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isInactive ? (
            <DropdownMenuItem onClick={onRestore}>
              <ResetIcon className="w-4 h-4 mr-2" />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onDeprecate} className="text-amber-600">
              <ArchiveIcon className="w-4 h-4 mr-2" />
              Deprecate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
