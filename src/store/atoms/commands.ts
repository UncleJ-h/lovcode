import { atomWithStorage } from "jotai/utils";

export const commandsSortKeyAtom = atomWithStorage<"name" | "usage" | "modified">("lovcode:commands:sortKey", "usage");
export const commandsSortDirAtom = atomWithStorage<"asc" | "desc">("lovcode:commands:sortDir", "desc");
export const commandsShowDeprecatedAtom = atomWithStorage("lovcode:commands:showDeprecated", false);
export const commandsViewModeAtom = atomWithStorage<"flat" | "tree">("lovcode:commands:viewMode", "tree");
export const commandsExpandedFoldersAtom = atomWithStorage<string[]>("lovcode:commands:expandedFolders", []);
