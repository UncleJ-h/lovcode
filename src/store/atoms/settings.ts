import { atomWithStorage } from "jotai/utils";

// Router test status
export const routerTestStatusAtom = atomWithStorage<Record<string, "idle" | "loading" | "success" | "error">>(
  "lovcode:settings:routerTestStatus",
  {}
);

export const routerTestMessageAtom = atomWithStorage<Record<string, string>>(
  "lovcode:settings:routerTestMessage",
  {}
);
