import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen } from 'lucide-react';
import {
  QuestionMarkCircledIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  DotsHorizontalIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useAppConfig } from '../../context';

interface DistillMenuProps {
  watchEnabled: boolean;
  onWatchToggle: (enabled: boolean) => void;
  onRefresh: () => void;
}

export function DistillMenu({ watchEnabled, onWatchToggle, onRefresh }: DistillMenuProps) {
  const { homeDir } = useAppConfig();
  const [helpOpen, setHelpOpen] = useState(false);
  const [commandContent, setCommandContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (helpOpen && !commandContent) {
      const path = `${homeDir}/.claude/commands/distill.md`;
      invoke<string>('read_file', { path })
        .then(setCommandContent)
        .catch((err) => {
          console.warn('Failed to load distill command:', err);
          setCommandContent(null);
        });
    }
  }, [helpOpen, commandContent, homeDir]);

  const handleCopy = async () => {
    if (commandContent) {
      await navigator.clipboard.writeText(commandContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (commandContent) {
      const blob = new Blob([commandContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'distill.md';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="text-muted-foreground hover:text-ink hover:bg-card-alt rounded-lg p-2 transition-colors">
            <DotsHorizontalIcon className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setHelpOpen(true)}>
            <QuestionMarkCircledIcon className="mr-2 h-4 w-4" />
            Help
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => invoke('open_in_editor', { path: `${homeDir}/.lovstudio/docs/distill` })}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Open Folder
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRefresh} disabled={watchEnabled}>
            <ReloadIcon className="mr-2 h-4 w-4" />
            Refresh
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={watchEnabled} onCheckedChange={onWatchToggle}>
            Auto Refresh
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>How to use Distill</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-muted-foreground space-y-2 text-sm">
              <p>Distill captures wisdom from your Claude Code sessions into reusable knowledge.</p>
              <p className="text-ink font-medium">In Claude Code, run:</p>
              <code className="bg-card-alt block rounded-lg px-3 py-2 font-mono text-sm">
                /distill
              </code>
              <p>
                This analyzes your conversation and extracts key learnings into structured documents
                stored in:
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-card-alt rounded px-2 py-1 text-xs">
                  ~/.lovstudio/docs/distill/
                </code>
                <button
                  onClick={() =>
                    invoke('open_in_editor', { path: `${homeDir}/.lovstudio/docs/distill` })
                  }
                  className="text-muted-foreground hover:text-ink hover:bg-card-alt rounded p-1.5 transition-colors"
                  title="Open distill directory"
                >
                  <FolderOpen className="h-4 w-4" />
                </button>
              </div>
            </div>

            {commandContent && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-ink text-sm font-medium">Command File (distill.md)</p>
                  <div className="flex gap-1">
                    <button
                      onClick={handleCopy}
                      className="text-muted-foreground hover:text-ink hover:bg-card-alt rounded p-1.5 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <CheckIcon className="text-primary h-4 w-4" />
                      ) : (
                        <CopyIcon className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="text-muted-foreground hover:text-ink hover:bg-card-alt rounded p-1.5 transition-colors"
                      title="Download file"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="bg-card-alt max-h-[40vh] overflow-auto rounded-lg p-3">
                  <pre className="text-muted-foreground font-mono text-xs whitespace-pre-wrap">
                    {commandContent}
                  </pre>
                </div>
              </div>
            )}

            {commandContent === null && (
              <p className="text-muted-foreground text-sm italic">
                Command file not found. Place distill.md in ~/.claude/commands/
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
