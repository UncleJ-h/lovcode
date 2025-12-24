import { useDroppable } from "@dnd-kit/core";
import { Folder } from "lucide-react";

interface RootDropZoneProps {
  isOver: boolean;
}

export function RootDropZone({ isOver }: RootDropZoneProps) {
  const { setNodeRef, isOver: dropIsOver } = useDroppable({ id: "" });
  const highlighted = isOver || dropIsOver;

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors ${
        highlighted ? "bg-primary/20 ring-2 ring-primary/50" : "bg-muted/30"
      }`}
    >
      <Folder className="w-4 h-4 text-muted-foreground" />
      <span className="font-mono text-sm text-muted-foreground">/ (root)</span>
    </div>
  );
}
