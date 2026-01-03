/**
 * [INPUT]: selectedCommand, folders, dialog state, handlers
 * [OUTPUT]: Move command dialog component
 * [POS]: 命令移动对话框组件
 * [PROTOCOL]: 变更时更新此头部
 */

import { Folder } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import type { LocalCommand } from "../../types";
import { getCurrentFolder } from "./hooks";

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCommand: LocalCommand | null;
  folders: string[];
  targetFolder: string;
  onTargetChange: (value: string) => void;
  onConfirm: () => void;
}

export function MoveDialog({
  open,
  onOpenChange,
  selectedCommand,
  folders,
  targetFolder,
  onTargetChange,
  onConfirm,
}: MoveDialogProps) {
  const currentFolder = selectedCommand ? getCurrentFolder(selectedCommand) : "";
  const isDisabled = !selectedCommand || targetFolder === currentFolder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {selectedCommand?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Current:{" "}
            <code className="bg-muted px-1 rounded font-mono">
              /{currentFolder || "(root)"}
            </code>
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => onTargetChange("")}
              disabled={currentFolder === ""}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                currentFolder === ""
                  ? "opacity-50 cursor-not-allowed"
                  : targetFolder === ""
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
              }`}
            >
              <Folder className="w-4 h-4" />
              <span className="font-mono">/ (root)</span>
              {currentFolder === "" && (
                <span className="text-xs text-muted-foreground ml-auto">(current)</span>
              )}
            </button>
            {folders.map((folder) => {
              const isCurrent = folder === currentFolder;
              return (
                <button
                  key={folder}
                  onClick={() => onTargetChange(folder)}
                  disabled={isCurrent}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                    isCurrent
                      ? "opacity-50 cursor-not-allowed"
                      : targetFolder === folder
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  <span className="font-mono">/{folder}</span>
                  {isCurrent && (
                    <span className="text-xs text-muted-foreground ml-auto">(current)</span>
                  )}
                </button>
              );
            })}
          </div>
          <div>
            <Label htmlFor="move-new-folder">Or enter a new folder path:</Label>
            <Input
              id="move-new-folder"
              placeholder="/new/folder/path"
              value={targetFolder}
              onChange={(e) => onTargetChange(e.target.value.replace(/^\//, ""))}
              className="mt-1 font-mono"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isDisabled}>
            Move
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CreateDirDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dirPath: string | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CreateDirDialog({
  open,
  onOpenChange,
  dirPath,
  onConfirm,
  onCancel,
}: CreateDirDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Directory?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-4">
          The directory <code className="bg-card-alt px-1 rounded">{dirPath}</code>{" "}
          does not exist. Create it?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
