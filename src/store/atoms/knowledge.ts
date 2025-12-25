import { atomWithStorage } from "jotai/utils";

// ReferenceView
export const referenceCollapsedGroupsAtom = atomWithStorage<Record<string, string[]>>(
  "lovcode:reference:collapsedGroups",
  {}
);

export const referenceExpandedSourceAtom = atomWithStorage<string | null>(
  "lovcode:reference:expandedSource",
  null
);

export const referenceScrollPositionAtom = atomWithStorage<Record<string, number>>(
  "lovcode:reference:scrollPosition",
  {}
);
