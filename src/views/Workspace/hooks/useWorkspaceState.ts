/**
 * [INPUT]: Jotai atoms, Tauri invoke/listen
 * [OUTPUT]: useWorkspaceState hook
 * [POS]: Workspace 状态初始化、加载、事件监听
 * [PROTOCOL]: 变更时更新此头部
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useAtom } from 'jotai';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { activePanelIdAtom, workspaceDataAtom, workspaceLoadingAtom, viewAtom } from '@/store';
import type { WorkspaceData } from '../types';
import type { PanelState } from '../../../components/PanelGrid';

export function useWorkspaceState() {
  const [workspace, setWorkspace] = useAtom(workspaceDataAtom);
  const [loading, setLoading] = useAtom(workspaceLoadingAtom);
  const [activePanelId, setActivePanelId] = useAtom(activePanelIdAtom);
  const [view] = useAtom(viewAtom);

  // Sync workspace state from View params (for back/forward navigation)
  useEffect(() => {
    if (view.type !== 'workspace') return;

    const { projectId, featureId, mode } = view;
    if (!projectId && !featureId && !mode) return;

    setWorkspace((currentWorkspace) => {
      if (!currentWorkspace) return currentWorkspace;

      const currentProject = currentWorkspace.projects.find(
        (p) => p.id === currentWorkspace.active_project_id
      );
      const needsUpdate =
        (projectId && currentWorkspace.active_project_id !== projectId) ||
        (featureId && currentProject?.active_feature_id !== featureId) ||
        (mode && currentProject?.view_mode !== mode);

      if (!needsUpdate) return currentWorkspace;

      const newProjects = currentWorkspace.projects.map((p) => {
        if (projectId && p.id === projectId) {
          return {
            ...p,
            ...(featureId && { active_feature_id: featureId }),
            ...(mode && { view_mode: mode }),
          };
        }
        return p;
      });

      const newWorkspace = {
        ...currentWorkspace,
        projects: newProjects,
        ...(projectId && { active_project_id: projectId }),
      };

      invoke('workspace_save', { data: newWorkspace }).catch(console.error);
      return newWorkspace;
    });
  }, [view, setWorkspace]);

  // Load workspace data and reset running features
  useEffect(() => {
    invoke<WorkspaceData>('workspace_load')
      .then((data) => {
        const hasRunningFeatures = data.projects.some((p) =>
          p.features.some((f) => f.status === 'running')
        );

        if (hasRunningFeatures) {
          const resetData: WorkspaceData = {
            ...data,
            projects: data.projects.map((p) => ({
              ...p,
              features: p.features.map((f) =>
                f.status === 'running' ? { ...f, status: 'pending' as const } : f
              ),
            })),
          };
          setWorkspace(resetData);
          invoke('workspace_save', { data: resetData }).catch(console.error);
        } else {
          setWorkspace(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setWorkspace, setLoading]);

  // Listen for feature-complete events
  useEffect(() => {
    const unlisten = listen<{
      project_id: string;
      feature_id: string;
      feature_name: string;
    }>('feature-complete', (event) => {
      const { project_id, feature_id } = event.payload;
      setWorkspace((prev) => {
        if (!prev) return prev;
        const newProjects = prev.projects.map((p) => {
          if (p.id !== project_id) return p;
          return {
            ...p,
            features: p.features.map((f) =>
              f.id === feature_id ? { ...f, status: 'needs-review' as const } : f
            ),
          };
        });
        return { ...prev, projects: newProjects };
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setWorkspace]);

  // Save workspace with functional update
  const saveWorkspace = useCallback(
    async (updater: (current: WorkspaceData) => WorkspaceData) => {
      let savedData: WorkspaceData | null = null;
      setWorkspace((current) => {
        if (!current) return current;
        savedData = updater(current);
        return savedData;
      });
      if (savedData) {
        try {
          await invoke('workspace_save', { data: savedData });
        } catch (err) {
          console.error('Failed to save workspace:', err);
        }
      }
    },
    [setWorkspace]
  );

  // Get active project
  const activeProject = workspace?.projects.find((p) => p.id === workspace.active_project_id);

  // Get active feature
  const activeFeature = activeProject?.features.find(
    (f) => f.id === activeProject.active_feature_id
  );

  // Session cache for preventing unnecessary remounts
  const sessionCacheRef = useRef(
    new Map<string, { id: string; ptyId: string; title: string; command?: string }>()
  );

  // Convert workspace panels to PanelGrid format for ALL features
  const allFeaturePanels = useMemo(() => {
    const map = new Map<string, PanelState[]>();
    const cache = sessionCacheRef.current;
    const usedSessionIds = new Set<string>();

    activeProject?.features.forEach((feature) => {
      map.set(
        feature.id,
        feature.panels.map((p) => ({
          id: p.id,
          sessions: (p.sessions || []).map((s) => {
            usedSessionIds.add(s.id);
            const cached = cache.get(s.id);
            if (cached && cached.ptyId === s.pty_id) {
              cached.title = s.title;
              cached.command = s.command;
              return cached;
            }
            const session = {
              id: s.id,
              ptyId: s.pty_id,
              title: s.title,
              command: s.command,
            };
            cache.set(s.id, session);
            return session;
          }),
          activeSessionId: p.active_session_id,
          isShared: p.is_shared,
          cwd: activeProject?.path || '',
        }))
      );
    });

    // Clean up stale cache entries
    for (const id of cache.keys()) {
      if (!usedSessionIds.has(id)) cache.delete(id);
    }

    return map;
  }, [activeProject?.features, activeProject?.path]);

  return {
    workspace,
    loading,
    activePanelId,
    setActivePanelId,
    activeProject,
    activeFeature,
    saveWorkspace,
    allFeaturePanels,
  };
}
