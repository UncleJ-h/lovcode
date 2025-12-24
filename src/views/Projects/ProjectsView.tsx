import { FileIcon } from "@radix-ui/react-icons";

export function ProjectsView() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-ink mb-2">Projects</h1>
          <p className="text-muted-foreground">Manage your parallel development projects</p>
        </header>

        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <FileIcon className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
          <h2 className="font-serif text-xl font-semibold text-ink mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Project management for parallel development workflows will be available in a future
            update.
          </p>
        </div>
      </div>
    </div>
  );
}
