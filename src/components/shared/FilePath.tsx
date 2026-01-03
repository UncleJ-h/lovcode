import { memo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileIcon, CopyIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '../ui/context-menu';

interface FilePathProps {
  path: string;
  basePath?: string;
  className?: string;
  showIcon?: boolean;
  filenameOnly?: boolean;
}

export const FilePath = memo(function FilePath({
  path,
  basePath,
  className = '',
  showIcon = false,
  filenameOnly = false,
}: FilePathProps) {
  // 显示文件名或相对路径，hover 显示绝对路径
  const displayPath = filenameOnly
    ? path.split('/').pop() || path
    : basePath && path.startsWith(basePath)
      ? path.slice(basePath.length).replace(/^\//, '')
      : path;

  const handleReveal = async () => {
    try {
      await invoke('reveal_path', { path });
    } catch (e) {
      console.error('Failed to reveal path:', e);
    }
  };

  const handleOpen = async () => {
    try {
      await invoke('open_path', { path });
    } catch (e) {
      console.error('Failed to open path:', e);
    }
  };

  const handleCopyPath = async () => {
    try {
      await invoke('copy_to_clipboard', { text: path });
    } catch (e) {
      console.error('Failed to copy path:', e);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <span
          className={`text-muted-foreground/50 hover:text-muted-foreground inline-flex cursor-context-menu items-center gap-1 truncate font-mono ${className}`}
          title={path}
        >
          {showIcon && <FileIcon className="h-3 w-3 flex-shrink-0" />}
          <span className="truncate">{displayPath}</span>
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleReveal}>
          <ExternalLinkIcon className="mr-2 h-4 w-4" />
          Reveal in Finder
        </ContextMenuItem>
        <ContextMenuItem onClick={handleOpen}>
          <FileIcon className="mr-2 h-4 w-4" />
          Open File
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyPath}>
          <CopyIcon className="mr-2 h-4 w-4" />
          Copy Path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
