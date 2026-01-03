/**
 * [INPUT]: navigationStateAtom, viewAtom, viewHistoryAtom, historyIndexAtom
 * [OUTPUT]: navigate, goBack, goForward, canGoBack, canGoForward, currentFeature, handleFeatureClick
 * [POS]: App 导航逻辑抽取
 * [PROTOCOL]: 变更时更新此头部，然后检查 hooks/CLAUDE.md
 */

import { useCallback } from "react";
import { useAtom } from "jotai";
import {
  navigationStateAtom,
  viewAtom,
  viewHistoryAtom,
  historyIndexAtom,
  marketplaceCategoryAtom,
} from "../store";
import type { View, FeatureType, TemplateCategory } from "../types";

const MAX_HISTORY = 50;

export function useAppNavigation() {
  const [view] = useAtom(viewAtom);
  const [viewHistory] = useAtom(viewHistoryAtom);
  const [historyIndex] = useAtom(historyIndexAtom);
  const [, setNavigationState] = useAtom(navigationStateAtom);
  const [marketplaceCategory] = useAtom(marketplaceCategoryAtom);

  const navigate = useCallback(
    (newView: View) => {
      setNavigationState((prev) => {
        const newHistory = prev.history.slice(0, prev.index + 1);
        newHistory.push(newView);
        let newIndex = prev.index + 1;
        if (newHistory.length > MAX_HISTORY) {
          newHistory.shift();
          newIndex = MAX_HISTORY - 1;
        }
        return { history: newHistory, index: newIndex };
      });
    },
    [setNavigationState]
  );

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < viewHistory.length - 1;

  const goBack = useCallback(() => {
    setNavigationState((prev) => {
      if (prev.index > 0) {
        return { ...prev, index: prev.index - 1 };
      }
      return prev;
    });
  }, [setNavigationState]);

  const goForward = useCallback(() => {
    setNavigationState((prev) => {
      if (prev.index < prev.history.length - 1) {
        return { ...prev, index: prev.index + 1 };
      }
      return prev;
    });
  }, [setNavigationState]);

  // Compute current feature from view
  const currentFeature: FeatureType | null = computeCurrentFeature(view);

  const handleFeatureClick = useCallback(
    (feature: FeatureType) => {
      const viewType = featureToViewType(feature, marketplaceCategory);
      navigate(viewType);
    },
    [navigate, marketplaceCategory]
  );

  return {
    view,
    navigate,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    currentFeature,
    handleFeatureClick,
  };
}

function computeCurrentFeature(view: View): FeatureType | null {
  switch (view.type) {
    case "chat-projects":
    case "chat-sessions":
    case "chat-messages":
      return "chat";
    case "workspace":
      return "workspace";
    case "features":
      return "features";
    case "settings":
      return "settings";
    case "commands":
    case "command-detail":
      return "commands";
    case "mcp":
      return "mcp";
    case "skills":
    case "skill-detail":
      return "skills";
    case "hooks":
      return "hooks";
    case "sub-agents":
    case "sub-agent-detail":
      return "sub-agents";
    case "output-styles":
      return "output-styles";
    case "statusline":
      return "statusline";
    case "kb-distill":
    case "kb-distill-detail":
      return "kb-distill";
    case "kb-reference":
    case "kb-reference-doc":
      return "kb-reference";
    case "marketplace":
    case "template-detail":
      return "marketplace";
    case "feature-todo":
      return view.feature;
    default:
      return null;
  }
}

function featureToViewType(
  feature: FeatureType,
  marketplaceCategory: TemplateCategory
): View {
  switch (feature) {
    case "chat":
      return { type: "chat-projects" };
    case "workspace":
      return { type: "workspace" };
    case "features":
      return { type: "features" };
    case "settings":
      return { type: "settings" };
    case "commands":
      return { type: "commands" };
    case "mcp":
      return { type: "mcp" };
    case "skills":
      return { type: "skills" };
    case "hooks":
      return { type: "hooks" };
    case "sub-agents":
      return { type: "sub-agents" };
    case "output-styles":
      return { type: "output-styles" };
    case "statusline":
      return { type: "statusline" };
    case "kb-distill":
      return { type: "kb-distill" };
    case "kb-reference":
      return { type: "kb-reference" };
    case "marketplace":
      return { type: "marketplace", category: marketplaceCategory };
    default:
      return { type: "feature-todo", feature };
  }
}
