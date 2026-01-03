/**
 * [INPUT]: selectedCommand, dialog state, handlers
 * [OUTPUT]: Deprecate command dialog component
 * [POS]: 命令废弃对话框组件
 * [PROTOCOL]: 变更时更新此头部
 */

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

interface DeprecateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCommand: LocalCommand | null;
  replacementCommand: string;
  onReplacementChange: (value: string) => void;
  deprecationNote: string;
  onNoteChange: (value: string) => void;
  onConfirm: () => void;
}

export function DeprecateDialog({
  open,
  onOpenChange,
  selectedCommand,
  replacementCommand,
  onReplacementChange,
  deprecationNote,
  onNoteChange,
  onConfirm,
}: DeprecateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deprecate {selectedCommand?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            This will move the file to <code>~/.claude/.commands/archived/</code>, outside the
            commands directory so Claude Code won't load it.
          </p>
          <div>
            <Label htmlFor="replacement">Replacement command (optional)</Label>
            <Input
              id="replacement"
              placeholder="/new-command"
              value={replacementCommand}
              onChange={(e) => onReplacementChange(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="deprecation-note">Note (optional)</Label>
            <Input
              id="deprecation-note"
              placeholder="Reason for deprecation..."
              value={deprecationNote}
              onChange={(e) => onNoteChange(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} className="bg-amber-600 hover:bg-amber-700">
            Deprecate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
