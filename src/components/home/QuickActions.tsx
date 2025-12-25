import { RotateCcw, Search } from "lucide-react";
import type { Project } from "../../types";

interface QuickActionsProps {
  lastProject: Project | null;
  onContinue: (project: Project) => void;
  onSearch: () => void;
}

export function QuickActions({ lastProject, onContinue, onSearch }: QuickActionsProps) {
  const getProjectName = (path: string): string => {
    return path.split("/").pop() || path;
  };

  return (
    <div className="flex gap-2">
      {lastProject && (
        <button
          onClick={() => onContinue(lastProject)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Continue: {getProjectName(lastProject.path)}</span>
        </button>
      )}
      <button
        onClick={onSearch}
        className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-colors text-sm text-muted-foreground"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="ml-2 px-1.5 py-0.5 text-[10px] bg-muted rounded">⌘K</kbd>
      </button>
    </div>
  );
}
