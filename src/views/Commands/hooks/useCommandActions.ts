/**
 * [INPUT]: invoke API, queryClient
 * [OUTPUT]: Command action handlers (deprecate, restore, move)
 * [POS]: 命令操作逻辑抽取
 * [PROTOCOL]: 变更时更新此头部
 */

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "../../../hooks";
import type { LocalCommand } from "../../../types";

interface PendingMove {
  cmd: LocalCommand;
  newPath: string;
  dirPath: string;
}

export function useCommandActions() {
  const queryClient = useQueryClient();
  const [selectedCommand, setSelectedCommand] = useState<LocalCommand | null>(null);
  const [deprecateDialogOpen, setDeprecateDialogOpen] = useState(false);
  const [replacementCommand, setReplacementCommand] = useState("");
  const [deprecationNote, setDeprecationNote] = useState("");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTargetFolder, setMoveTargetFolder] = useState("");
  const [moveCreateDirOpen, setMoveCreateDirOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const refreshCommands = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["commands"] });
  }, [queryClient]);

  const handleDeprecate = useCallback(async () => {
    if (!selectedCommand) return;
    try {
      await invoke("deprecate_command", {
        path: selectedCommand.path,
        replacedBy: replacementCommand || null,
        note: deprecationNote || null,
      });
      setDeprecateDialogOpen(false);
      setSelectedCommand(null);
      setReplacementCommand("");
      setDeprecationNote("");
      refreshCommands();
    } catch (e) {
      console.error("Failed to deprecate command:", e);
    }
  }, [selectedCommand, replacementCommand, deprecationNote, refreshCommands]);

  const handleRestore = useCallback(
    async (cmd: LocalCommand) => {
      try {
        await invoke("restore_command", { path: cmd.path });
        refreshCommands();
      } catch (e) {
        console.error("Failed to restore command:", e);
      }
    },
    [refreshCommands]
  );

  const openDeprecateDialog = useCallback((cmd: LocalCommand) => {
    setSelectedCommand(cmd);
    setDeprecateDialogOpen(true);
  }, []);

  const openMoveDialog = useCallback((cmd: LocalCommand) => {
    setSelectedCommand(cmd);
    setMoveTargetFolder("");
    setMoveDialogOpen(true);
  }, []);

  const handleMove = useCallback(
    async (cmd: LocalCommand, targetFolder: string, createDir = false) => {
      try {
        const filename = cmd.path.split("/").pop()?.replace(".md", "") || "";
        const newName = targetFolder ? `/${targetFolder}/${filename}` : `/${filename}`;
        await invoke<string>("rename_command", { path: cmd.path, newName, createDir });
        setMoveDialogOpen(false);
        setSelectedCommand(null);
        await refreshCommands();
      } catch (e) {
        const error = String(e);
        if (error.startsWith("DIR_NOT_EXIST:")) {
          const dirPath = error.slice("DIR_NOT_EXIST:".length);
          const filename = cmd.path.split("/").pop()?.replace(".md", "") || "";
          const newPath = targetFolder ? `/${targetFolder}/${filename}` : `/${filename}`;
          setPendingMove({ cmd, newPath, dirPath });
          setMoveCreateDirOpen(true);
        } else {
          console.error("Failed to move command:", e);
        }
      }
    },
    [refreshCommands]
  );

  const handleConfirmMoveCreateDir = useCallback(async () => {
    if (pendingMove) {
      setMoveCreateDirOpen(false);
      await invoke<string>("rename_command", {
        path: pendingMove.cmd.path,
        newName: pendingMove.newPath,
        createDir: true,
      });
      setPendingMove(null);
      setMoveDialogOpen(false);
      setSelectedCommand(null);
      await refreshCommands();
    }
  }, [pendingMove, refreshCommands]);

  const closeMoveCreateDirDialog = useCallback(() => {
    setMoveCreateDirOpen(false);
    setPendingMove(null);
  }, []);

  return {
    // State
    selectedCommand,
    deprecateDialogOpen,
    setDeprecateDialogOpen,
    replacementCommand,
    setReplacementCommand,
    deprecationNote,
    setDeprecationNote,
    moveDialogOpen,
    setMoveDialogOpen,
    moveTargetFolder,
    setMoveTargetFolder,
    moveCreateDirOpen,
    setMoveCreateDirOpen,
    pendingMove,
    // Actions
    handleDeprecate,
    handleRestore,
    openDeprecateDialog,
    openMoveDialog,
    handleMove,
    handleConfirmMoveCreateDir,
    closeMoveCreateDirDialog,
    refreshCommands,
  };
}
