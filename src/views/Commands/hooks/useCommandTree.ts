/**
 * [INPUT]: LocalCommand[], sortKey, sortDir
 * [OUTPUT]: buildTree function, tree data structure
 * [POS]: 命令树构建逻辑抽取
 * [PROTOCOL]: 变更时更新此头部
 */

import { useMemo, useCallback } from "react";
import type { LocalCommand } from "../../../types";
import type { TreeNode, FolderNode, CommandSortKey } from "../types";

interface UseCommandTreeOptions {
  commands: LocalCommand[];
  sortKey: CommandSortKey;
  sortDir: "asc" | "desc";
  getUsageCount: (cmd: LocalCommand) => number;
}

export function useCommandTree({
  commands,
  sortKey,
  sortDir,
  getUsageCount,
}: UseCommandTreeOptions) {
  const buildTree = useCallback(
    (cmds: LocalCommand[]): TreeNode[] => {
      const root: Map<string, FolderNode | { type: "command"; command: LocalCommand }> = new Map();

      for (const cmd of cmds) {
        const match = cmd.path.match(/\.claude\/commands\/(.+)$/);
        const relativePath = match ? match[1] : cmd.name + ".md";
        const parts = relativePath.replace(/\.md$/, "").split("/");

        if (parts.length === 1) {
          root.set(cmd.name, { type: "command", command: cmd });
        } else {
          let currentLevel = root;
          let currentPath = "";
          for (let i = 0; i < parts.length - 1; i++) {
            const folderName = parts[i];
            currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            let folder = currentLevel.get(folderName);
            if (!folder || folder.type !== "folder") {
              folder = { type: "folder", name: folderName, path: currentPath, childMap: new Map() };
              currentLevel.set(folderName, folder);
            }
            currentLevel = folder.childMap;
          }
          currentLevel.set(cmd.name, { type: "command", command: cmd });
        }
      }

      const convertAndSort = (
        map: Map<string, FolderNode | { type: "command"; command: LocalCommand }>
      ): TreeNode[] => {
        const nodes: TreeNode[] = [];
        for (const node of map.values()) {
          if (node.type === "folder") {
            nodes.push({
              type: "folder",
              name: node.name,
              path: node.path,
              children: convertAndSort(node.childMap),
            });
          } else {
            nodes.push(node);
          }
        }
        return nodes.sort((a, b) => {
          if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
          if (a.type === "folder" && b.type === "folder") return a.name.localeCompare(b.name);
          if (a.type === "command" && b.type === "command") {
            if (sortKey === "usage") {
              const diff = getUsageCount(b.command) - getUsageCount(a.command);
              return sortDir === "desc" ? diff : -diff;
            }
            const cmp = a.command.name.localeCompare(b.command.name);
            return sortDir === "desc" ? -cmp : cmp;
          }
          return 0;
        });
      };

      return convertAndSort(root);
    },
    [sortKey, sortDir, getUsageCount]
  );

  const tree = useMemo(() => buildTree(commands), [buildTree, commands]);

  return { tree, buildTree };
}

/**
 * 从命令列表中提取所有文件夹路径
 */
export function extractFolders(commands: LocalCommand[]): string[] {
  const folders = new Set<string>();
  for (const cmd of commands) {
    const match = cmd.path.match(/\.claude\/commands\/(.+)$/);
    if (match) {
      const parts = match[1].split("/");
      if (parts.length > 1) {
        let path = "";
        for (let i = 0; i < parts.length - 1; i++) {
          path = path ? `${path}/${parts[i]}` : parts[i];
          folders.add(path);
        }
      }
    }
  }
  return Array.from(folders).sort();
}

/**
 * 从命令路径中提取当前文件夹
 */
export function getCurrentFolder(cmd: LocalCommand): string {
  const match = cmd.path.match(/\.claude\/commands\/(.+)$/);
  if (match) {
    const parts = match[1].split("/");
    if (parts.length > 1) return parts.slice(0, -1).join("/");
  }
  return "";
}
