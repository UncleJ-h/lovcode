import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Project {
  id: string;
  path: string;
  session_count: number;
  last_active: number;
}

interface Session {
  id: string;
  project_id: string;
  summary: string | null;
  message_count: number;
  last_modified: number;
}

interface Message {
  uuid: string;
  role: string;
  content: string;
  timestamp: string;
}

type View =
  | { type: "projects" }
  | { type: "sessions"; projectId: string; projectPath: string }
  | { type: "messages"; projectId: string; sessionId: string; summary: string | null };

function App() {
  const [view, setView] = useState<View>({ type: "projects" });

  return (
    <main className="min-h-screen bg-canvas">
      {view.type === "projects" && (
        <ProjectList onSelect={(p) => setView({
          type: "sessions",
          projectId: p.id,
          projectPath: p.path
        })} />
      )}
      {view.type === "sessions" && (
        <SessionList
          projectId={view.projectId}
          projectPath={view.projectPath}
          onBack={() => setView({ type: "projects" })}
          onSelect={(s) => setView({
            type: "messages",
            projectId: s.project_id,
            sessionId: s.id,
            summary: s.summary
          })}
        />
      )}
      {view.type === "messages" && (
        <MessageView
          projectId={view.projectId}
          sessionId={view.sessionId}
          summary={view.summary}
          onBack={() => setView({
            type: "sessions",
            projectId: view.projectId,
            projectPath: ""
          })}
        />
      )}
    </main>
  );
}

type SortKey = "recent" | "sessions" | "name";

function ProjectList({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  useEffect(() => {
    invoke<Project[]>("list_projects")
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const formatRelativeTime = (ts: number) => {
    const now = Date.now() / 1000;
    const diff = now - ts;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ts * 1000).toLocaleDateString();
  };

  const sortedProjects = [...projects].sort((a, b) => {
    switch (sortBy) {
      case "recent": return b.last_active - a.last_active;
      case "sessions": return b.session_count - a.session_count;
      case "name": return a.path.localeCompare(b.path);
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-ink">Projects</h1>
        <p className="text-muted mt-1">{projects.length} Claude Code projects</p>
      </header>

      <div className="flex gap-2 mb-6">
        {([
          ["recent", "Recent"],
          ["sessions", "Sessions"],
          ["name", "Name"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              sortBy === key
                ? "bg-primary text-primary-foreground"
                : "bg-card-alt text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {sortedProjects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelect(project)}
            className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
          >
            <p className="font-medium text-ink truncate">{project.path}</p>
            <p className="text-sm text-muted mt-1">
              {project.session_count} session{project.session_count !== 1 ? "s" : ""} &middot; {formatRelativeTime(project.last_active)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function SessionList({
  projectId,
  projectPath,
  onBack,
  onSelect
}: {
  projectId: string;
  projectPath: string;
  onBack: () => void;
  onSelect: (s: Session) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<Session[]>("list_sessions", { projectId })
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [projectId]);

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted">Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-8">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink mb-2 flex items-center gap-1"
        >
          <span>&larr;</span> Back
        </button>
        <h1 className="font-serif text-2xl font-semibold text-ink truncate">
          {projectPath || projectId}
        </h1>
        <p className="text-muted mt-1">{sessions.length} sessions</p>
      </header>

      <div className="space-y-3">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session)}
            className="w-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
          >
            <p className="font-medium text-ink line-clamp-2">
              {session.summary || "Untitled session"}
            </p>
            <p className="text-sm text-muted mt-2">
              {session.message_count} messages &middot; {formatDate(session.last_modified)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageView({
  projectId,
  sessionId,
  summary,
  onBack
}: {
  projectId: string;
  sessionId: string;
  summary: string | null;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<Message[]>("get_session_messages", { projectId, sessionId })
      .then(setMessages)
      .finally(() => setLoading(false));
  }, [projectId, sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-6">
        <button
          onClick={onBack}
          className="text-muted hover:text-ink mb-2 flex items-center gap-1"
        >
          <span>&larr;</span> Back
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink line-clamp-2">
          {summary || "Session"}
        </h1>
      </header>

      <div className="space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.uuid}
            className={`rounded-xl p-4 ${
              msg.role === "user"
                ? "bg-card-alt ml-8"
                : "bg-card mr-8 border border-border"
            }`}
          >
            <p className="text-xs text-muted mb-2 uppercase tracking-wide">
              {msg.role}
            </p>
            <p className="text-ink whitespace-pre-wrap break-words text-sm leading-relaxed">
              {msg.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
