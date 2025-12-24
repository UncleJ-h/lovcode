import { useDroppable } from "@dnd-kit/core";
import { Folder } from "lucide-react";

interface DroppableFolderProps {
  folderPath: string;
  name: string;
  childCount: number;
  isExpanded: boolean;
  isOver: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export function DroppableFolder({
  folderPath,
  name,
  childCount,
  isExpanded,
  isOver,
  onToggle,
  children,
}: DroppableFolderProps) {
  const { setNodeRef, isOver: dropIsOver } = useDroppable({
    id: folderPath,
  });

  const highlighted = isOver || dropIsOver;

  return (
    <div>
      <div
        ref={setNodeRef}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        className={`w-full flex items-center gap-2 py-1.5 px-2 text-left rounded-md transition-colors cursor-pointer ${
          highlighted ? "bg-primary/20 ring-2 ring-primary/50" : ""
        } hover:bg-muted/50`}
      >
        <Folder className="w-4 h-4 text-primary" />
        <span className="font-mono font-medium text-primary">{name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          {childCount}
        </span>
      </div>
      {isExpanded && children && <div className="space-y-1 mt-1">{children}</div>}
    </div>
  );
}
