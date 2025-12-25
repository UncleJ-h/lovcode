import { atomWithStorage } from "jotai/utils";
import type { View } from "@/types";

// 当前选中的文件路径
export const selectedFileAtom = atomWithStorage<string | null>("lovcode:selectedFile", null);

// FileViewer 的查看模式
export const fileViewModeAtom = atomWithStorage<"source" | "preview" | "split">("lovcode:fileViewer:viewMode", "preview");

// 当前激活的面板 ID
export const activePanelIdAtom = atomWithStorage<string | undefined>("lovcode:activePanelId", undefined);

// 当前视图
export const viewAtom = atomWithStorage<View>("lovcode:view", { type: "home" });

// 视图历史
export const viewHistoryAtom = atomWithStorage<View[]>("lovcode:viewHistory", [{ type: "home" }]);

// 历史索引
export const historyIndexAtom = atomWithStorage<number>("lovcode:historyIndex", 0);
