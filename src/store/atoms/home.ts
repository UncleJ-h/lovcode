import { atomWithStorage } from "jotai/utils";

export const activityViewModeAtom = atomWithStorage<"weekday" | "hour">("lovcode:home:activityViewMode", "hour");
export const commandRangeAtom = atomWithStorage<"1m" | "3m" | "all">("lovcode:home:commandRange", "3m");
export const commandModeAtom = atomWithStorage<"weekly" | "cumulative">("lovcode:home:commandMode", "cumulative");
