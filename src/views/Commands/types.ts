export type CommandSortKey = "usage" | "name" | "modified";
export type SortDirection = "asc" | "desc";

export type FolderNode = {
  type: "folder";
  name: string;
  path: string;
  childMap: Map<string, FolderNode | { type: "command"; command: import("../../types").LocalCommand }>;
};

export type TreeNode =
  | { type: "folder"; name: string; path: string; children: TreeNode[] }
  | { type: "command"; command: import("../../types").LocalCommand };
