import { atomWithStorage } from "jotai/utils";

// FeatureSidebar
export const featureSidebarExpandedPanelsAtom = atomWithStorage<string[]>("feature-sidebar-expanded-panels", []);
export const featureSidebarPinnedExpandedAtom = atomWithStorage("feature-sidebar-pinned-expanded", true);
export const featureSidebarFilesExpandedAtom = atomWithStorage("feature-sidebar-files-expanded", false);
