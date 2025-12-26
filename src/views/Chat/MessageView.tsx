import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DotsHorizontalIcon, ExternalLinkIcon, DownloadIcon } from "@radix-ui/react-icons";
import { FolderOpen, Copy, FileCode } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuCheckboxItem,
} from "../../components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "../../components/ui/dropdown-menu";
import { useAtom } from "jotai";
import { originalChatAtom, markdownPreviewAtom } from "../../store";
import { CollapsibleContent } from "./CollapsibleContent";
import { ExportDialog } from "./ExportDialog";
import { restoreSlashCommand } from "./utils";
import type { Message } from "../../types";

interface MessageViewProps {
  projectId: string;
  sessionId: string;
  summary: string | null;
  onBack: () => void;
}

export function MessageView({ projectId, sessionId, summary, onBack }: MessageViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [originalChat, setOriginalChat] = useAtom(originalChatAtom);
  const [markdownPreview, setMarkdownPreview] = useAtom(markdownPreviewAtom);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [sessionFilePath, setSessionFilePath] = useState("");

  useEffect(() => {
    invoke<Message[]>("get_session_messages", { projectId, sessionId })
      .then(setMessages)
      .finally(() => setLoading(false));
    invoke<string>("get_session_file_path", { projectId, sessionId })
      .then(setSessionFilePath)
      .catch(() => {});
  }, [projectId, sessionId]);

  const processContent = (content: string) => {
    return originalChat ? restoreSlashCommand(content) : content;
  };

  const handleCopyPath = () => {
    if (sessionFilePath) {
      invoke("copy_to_clipboard", { text: sessionFilePath });
    }
  };

  const handleCopyContent = (content: string) => {
    invoke("copy_to_clipboard", { text: content });
  };

  const handleCopyFileLine = (lineNumber: number) => {
    if (sessionFilePath) {
      invoke("copy_to_clipboard", { text: `${sessionFilePath}:${lineNumber}` });
    }
  };

  const filteredMessages = useMemo(
    () => (originalChat ? messages.filter((m) => !m.is_meta && !m.is_tool) : messages),
    [messages, originalChat]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <header className="mb-8">
        <button
          onClick={onBack}
          className="text-muted-foreground-foreground hover:text-foreground flex items-center gap-1 text-sm mb-4"
        >
          <span>←</span> Sessions
        </button>
        <div className="flex items-start justify-between gap-4">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="cursor-context-menu flex-1 min-w-0">
                <h1 className="font-serif text-2xl font-semibold text-ink leading-tight mb-1">
                  {summary || "Session"}
                </h1>
                <p className="text-primary text-xs font-mono truncate">{sessionId}</p>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
              <ContextMenuItem onClick={() => invoke("reveal_session_file", { projectId, sessionId })}>
                <FolderOpen size={14} />
                Reveal in Finder
              </ContextMenuItem>
              <ContextMenuItem onClick={() => invoke("open_session_in_editor", { projectId, sessionId })}>
                <ExternalLinkIcon width={14} />
                Open in Editor
              </ContextMenuItem>
              <ContextMenuItem onClick={handleCopyPath}>
                <Copy size={14} />
                Copy Path
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuCheckboxItem checked={originalChat} onCheckedChange={setOriginalChat}>
                Original View
              </ContextMenuCheckboxItem>
              <ContextMenuCheckboxItem checked={markdownPreview} onCheckedChange={setMarkdownPreview}>
                Markdown Preview
              </ContextMenuCheckboxItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setExportDialogOpen(true)}>
                <DownloadIcon width={14} />
                Export
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground-foreground p-1 rounded hover:bg-card-alt shrink-0">
                <DotsHorizontalIcon width={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => invoke("reveal_session_file", { projectId, sessionId })}>
                <FolderOpen size={14} />
                Reveal in Finder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => invoke("open_session_in_editor", { projectId, sessionId })}>
                <ExternalLinkIcon width={14} />
                Open in Editor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyPath}>
                <Copy size={14} />
                Copy Path
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={originalChat} onCheckedChange={setOriginalChat}>
                Original View
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={markdownPreview} onCheckedChange={setMarkdownPreview}>
                Markdown Preview
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                <DownloadIcon width={14} />
                Export
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="space-y-4">
        {filteredMessages.map((msg) => {
          const displayContent = processContent(msg.content);
          return (
            <div
              key={msg.uuid}
              className={`group relative rounded-xl p-4 ${
                msg.role === "user" ? "bg-card-alt" : "bg-card border border-border"
              }`}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="absolute top-3 right-3 p-1.5 rounded-md bg-card-alt/80 hover:bg-card-alt text-muted-foreground hover:text-ink transition-opacity opacity-0 group-hover:opacity-100">
                    <DotsHorizontalIcon width={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleCopyContent(displayContent)}>
                    <Copy size={14} />
                    Copy Content
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCopyFileLine(msg.line_number)}>
                    <FileCode size={14} />
                    Copy file:line
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-xs text-muted-foreground-foreground mb-2 uppercase tracking-wide">{msg.role}</p>
              <CollapsibleContent content={displayContent} markdown={markdownPreview} />
            </div>
          );
        })}
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        allMessages={filteredMessages}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        defaultName={summary?.slice(0, 50).replace(/[/\\?%*:|"<>]/g, "-") || "session"}
      />
    </div>
  );
}
