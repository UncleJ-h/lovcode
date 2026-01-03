/**
 * [INPUT]: useWorkspaceState, Tauri invoke
 * [OUTPUT]: useWorkspaceHandlers hook
 * [POS]: Workspace 所有操作处理函数 (project, feature, panel, session)
 * [PROTOCOL]: 变更时更新此头部
 */

import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { disposeTerminal } from '../../../components/Terminal';
import { splitLayoutNode, removeFromLayout } from './layoutUtils';
import type {
  WorkspaceData,
  WorkspaceProject,
  Feature,
  PanelState as StoredPanelState,
  SessionState as StoredSessionState,
  LayoutNode,
} from '../types';

interface UseWorkspaceHandlersProps {
  workspace: WorkspaceData | null;
  activeProject: WorkspaceProject | undefined;
  activeFeature: Feature | undefined;
  saveWorkspace: (updater: (current: WorkspaceData) => WorkspaceData) => Promise<void>;
  setActivePanelId: (id: string | undefined) => void;
}

export function useWorkspaceHandlers({
  workspace,
  activeProject,
  activeFeature,
  saveWorkspace,
  setActivePanelId,
}: UseWorkspaceHandlersProps) {
  // ============================================================================
  // Project & Feature Handlers
  // ============================================================================

  const handleAddProject = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Directory',
      });

      if (selected && typeof selected === 'string') {
        const project = await invoke<WorkspaceProject>('workspace_add_project', {
          path: selected,
        });

        saveWorkspace((current) => ({
          ...current,
          projects: [...current.projects, project],
          active_project_id: project.id,
        }));
      }
    } catch (err) {
      console.error('Failed to add project:', err);
    }
  }, [saveWorkspace]);

  const handleAddFeature = useCallback(
    async (projectId?: string) => {
      if (!workspace) return;
      const targetProject = projectId
        ? workspace.projects.find((p) => p.id === projectId)
        : activeProject;
      if (!targetProject) return;

      const counter = (workspace.feature_counter ?? 0) + 1;
      const name = `#${counter}`;

      try {
        const feature = await invoke<Feature>('workspace_create_feature', {
          projectId: targetProject.id,
          name,
        });

        const targetId = targetProject.id;
        saveWorkspace((current) => {
          const newProjects = current.projects.map((p) =>
            p.id === targetId
              ? {
                  ...p,
                  features: [...p.features, feature],
                  active_feature_id: feature.id,
                }
              : p
          );
          return {
            ...current,
            projects: newProjects,
            active_project_id: targetId,
            feature_counter: feature.seq,
          };
        });
        return { featureId: feature.id, featureName: feature.name };
      } catch (err) {
        console.error('Failed to create feature:', err);
        return undefined;
      }
    },
    [workspace, activeProject, saveWorkspace]
  );

  // ============================================================================
  // Panel Handlers
  // ============================================================================

  const handlePanelSplit = useCallback(
    (targetPanelId: string, direction: 'horizontal' | 'vertical') => {
      if (!activeProject || !activeFeature) return;

      const panelId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const ptyId = crypto.randomUUID();
      const projectId = activeProject.id;
      const featureId = activeFeature.id;
      const projectPath = activeProject.path;

      const newPanel: StoredPanelState = {
        id: panelId,
        sessions: [{ id: sessionId, pty_id: ptyId, title: 'Untitled' }],
        active_session_id: sessionId,
        is_shared: false,
        cwd: projectPath,
      };

      saveWorkspace((current) => {
        const newProjects = current.projects.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            features: p.features.map((f) => {
              if (f.id !== featureId) return f;

              let currentLayout = f.layout;
              if (!currentLayout) {
                if (f.panels.length === 0) {
                  currentLayout = { type: 'panel', panelId: targetPanelId };
                } else if (f.panels.length === 1) {
                  currentLayout = { type: 'panel', panelId: f.panels[0].id };
                } else {
                  const dir = f.layout_direction || 'horizontal';
                  currentLayout = f.panels.slice(1).reduce<LayoutNode>(
                    (acc, panel) => ({
                      type: 'split',
                      direction: dir,
                      first: acc,
                      second: { type: 'panel', panelId: panel.id },
                    }),
                    { type: 'panel', panelId: f.panels[0].id }
                  );
                }
              }

              const newLayout = splitLayoutNode(currentLayout, targetPanelId, direction, panelId);

              return {
                ...f,
                panels: [...f.panels, newPanel],
                layout: newLayout,
              };
            }),
          };
        });
        return { ...current, projects: newProjects };
      });

      setActivePanelId(panelId);
    },
    [activeProject, activeFeature, saveWorkspace, setActivePanelId]
  );

  const handleInitialPanelCreate = useCallback(
    (command?: string) => {
      if (!activeProject || !activeFeature) return;

      const panelId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const ptyId = crypto.randomUUID();
      const projectId = activeProject.id;
      const featureId = activeFeature.id;
      const projectPath = activeProject.path;

      const title =
        command === 'claude' ? 'Claude Code' : command === 'codex' ? 'Codex' : 'Terminal';

      const newPanel: StoredPanelState = {
        id: panelId,
        sessions: [{ id: sessionId, pty_id: ptyId, title, command }],
        active_session_id: sessionId,
        is_shared: false,
        cwd: projectPath,
      };

      saveWorkspace((current) => {
        const newProjects = current.projects.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            features: p.features.map((f) => {
              if (f.id !== featureId) return f;
              const layout: LayoutNode = { type: 'panel', panelId };
              return {
                ...f,
                panels: [newPanel],
                layout,
              };
            }),
          };
        });
        return { ...current, projects: newProjects };
      });

      setActivePanelId(panelId);
    },
    [activeProject, activeFeature, saveWorkspace, setActivePanelId]
  );

  const handlePanelClose = useCallback(
    (panelId: string) => {
      if (!activeProject) return;

      const ptyIdsToKill: string[] = [];
      for (const feature of activeProject.features) {
        const panel = feature.panels.find((p) => p.id === panelId);
        if (panel) {
          ptyIdsToKill.push(...(panel.sessions || []).map((s) => s.pty_id));
          break;
        }
      }
      if (ptyIdsToKill.length === 0) {
        const sharedPanel = (activeProject.shared_panels || []).find((p) => p.id === panelId);
        if (sharedPanel) {
          ptyIdsToKill.push(...(sharedPanel.sessions || []).map((s) => s.pty_id));
        }
      }

      for (const ptyId of ptyIdsToKill) {
        disposeTerminal(ptyId);
        invoke('pty_kill', { id: ptyId }).catch(console.error);
        invoke('pty_purge_scrollback', { id: ptyId }).catch(console.error);
      }

      const projectId = activeProject.id;
      saveWorkspace((current) => {
        const newProjects = current.projects.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            features: p.features.map((f) => {
              const newPanels = f.panels.filter((panel) => panel.id !== panelId);
              const newLayout = f.layout ? removeFromLayout(f.layout, panelId) : undefined;
              return {
                ...f,
                panels: newPanels,
                layout: newLayout ?? undefined,
              };
            }),
            shared_panels: (p.shared_panels || []).filter((panel) => panel.id !== panelId),
          };
        });
        return { ...current, projects: newProjects };
      });
    },
    [activeProject, saveWorkspace]
  );

  const handlePanelToggleShared = useCallback(
    (panelId: string) => {
      if (!activeProject) return;
      const projectId = activeProject.id;

      saveWorkspace((current) => {
        const newProjects = current.projects.map((p) => {
          if (p.id !== projectId) return p;

          const sharedPanels = p.shared_panels || [];
          const sharedIndex = sharedPanels.findIndex((panel) => panel.id === panelId);
          if (sharedIndex !== -1) {
            const panel = sharedPanels[sharedIndex];
            const newSharedPanels = sharedPanels.filter((_, i) => i !== sharedIndex);
            const newFeatures = p.features.map((f) => {
              if (f.id !== p.active_feature_id) return f;
              if (f.panels.length > 0) {
                const [firstPanel, ...restPanels] = f.panels;
                return {
                  ...f,
                  panels: [
                    {
                      ...firstPanel,
                      sessions: [...firstPanel.sessions, ...panel.sessions],
                      active_session_id: panel.sessions[0]?.id ?? firstPanel.active_session_id,
                    },
                    ...restPanels,
                  ],
                };
              }
              return {
                ...f,
                panels: [{ ...panel, is_shared: false }],
              };
            });
            return { ...p, shared_panels: newSharedPanels, features: newFeatures };
          }

          for (const feature of p.features) {
            const panelIndex = feature.panels.findIndex((panel) => panel.id === panelId);
            if (panelIndex !== -1) {
              const panel = feature.panels[panelIndex];
              const activeSessionId = panel.active_session_id;
              const activeSession =
                panel.sessions.find((s) => s.id === activeSessionId) || panel.sessions[0];

              if (!activeSession) return p;

              const newSharedPanel = {
                id: crypto.randomUUID(),
                cwd: panel.cwd,
                sessions: [activeSession],
                active_session_id: activeSession.id,
                is_shared: true,
              };

              const newFeatures = p.features.map((f) => {
                if (f.id !== feature.id) return f;
                const remainingSessions = panel.sessions.filter((s) => s.id !== activeSession.id);
                if (remainingSessions.length === 0) {
                  return {
                    ...f,
                    panels: f.panels.filter((_, i) => i !== panelIndex),
                  };
                }
                return {
                  ...f,
                  panels: f.panels.map((pl, i) =>
                    i !== panelIndex
                      ? pl
                      : {
                          ...pl,
                          sessions: remainingSessions,
                          active_session_id: remainingSessions[0].id,
                        }
                  ),
                };
              });
              return {
                ...p,
                features: newFeatures,
                shared_panels: [...p.shared_panels, newSharedPanel],
              };
            }
          }

          return p;
        });
        return { ...current, projects: newProjects };
      });
    },
    [activeProject, saveWorkspace]
  );

  const handlePanelReload = useCallback(
    (panelId: string) => {
      if (!activeProject) return;

      let activeSessionId: string | null = null;
      let oldPtyId: string | null = null;
      for (const feature of activeProject.features) {
        const panel = feature.panels.find((p) => p.id === panelId);
        if (panel) {
          activeSessionId = panel.active_session_id;
          const activeSession = (panel.sessions || []).find((s) => s.id === activeSessionId);
          if (activeSession) oldPtyId = activeSession.pty_id;
          break;
        }
      }
      if (!oldPtyId) {
        const sharedPanel = (activeProject.shared_panels || []).find((p) => p.id === panelId);
        if (sharedPanel) {
          activeSessionId = sharedPanel.active_session_id;
          const activeSession = (sharedPanel.sessions || []).find((s) => s.id === activeSessionId);
          if (activeSession) oldPtyId = activeSession.pty_id;
        }
      }
      if (oldPtyId) {
        disposeTerminal(oldPtyId);
        invoke('pty_kill', { id: oldPtyId }).catch(console.error);
        invoke('pty_purge_scrollback', { id: oldPtyId }).catch(console.error);
      }

      const newPtyId = crypto.randomUUID();
      const projectId = activeProject.id;
      const targetActiveSessionId = activeSessionId;

      saveWorkspace((current) => {
        const newProjects = current.projects.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            features: p.features.map((f) => ({
              ...f,
              panels: f.panels.map((panel) =>
                panel.id === panelId
                  ? {
                      ...panel,
                      sessions: (panel.sessions || []).map((s) =>
                        s.id === targetActiveSessionId ? { ...s, pty_id: newPtyId } : s
                      ),
                    }
                  : panel
              ),
            })),
            shared_panels: (p.shared_panels || []).map((panel) =>
              panel.id === panelId
                ? {
                    ...panel,
                    sessions: (panel.sessions || []).map((s) =>
                      s.id === targetActiveSessionId ? { ...s, pty_id: newPtyId } : s
                    ),
                  }
                : panel
            ),
          };
        });
        return { ...current, projects: newProjects };
      });
    },
    [activeProject, saveWorkspace]
  );

  // ============================================================================
  // Session Handlers
  // ============================================================================

  const handleSessionAdd = useCallback(
    (panelId: string) => {
      if (!activeProject) return;

      const sessionId = crypto.randomUUID();
      const ptyId = crypto.randomUUID();
      const newSession: StoredSessionState = {
        id: sessionId,
        pty_id: ptyId,
        title: 'Untitled',
      };
      const projectId = activeProject.id;

      saveWorkspace((current) => {
        const newProjects = current.projects.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            features: p.features.map((f) => ({
              ...f,
              panels: f.panels.map((panel) =>
                panel.id === panelId
                  ? {
                      ...panel,
                      sessions: [...(panel.sessions || []), newSession],
                      active_session_id: sessionId,
                    }
                  : panel
              ),
            })),
            shared_panels: (p.shared_panels || []).map((panel) =>
              panel.id === panelId
                ? {
                    ...panel,
                    sessions: [...(panel.sessions || []), newSession],
                    active_session_id: sessionId,
                  }
                : panel
            ),
          };
        });
        return { ...current, projects: newProjects };
      });

      setActivePanelId(panelId);
    },
    [activeProject, saveWorkspace, setActivePanelId]
  );

  const handleSessionClose = useCallback(
    (panelId: string, sessionId: string) => {
      if (!activeProject) return;

      let sessionCount = 0;
      let ptyIdToPurge: string | null = null;

      for (const feature of activeProject.features) {
        const panel = feature.panels.find((p) => p.id === panelId);
        if (panel) {
          sessionCount = (panel.sessions || []).length;
          const session = (panel.sessions || []).find((s) => s.id === sessionId);
          if (session) {
            ptyIdToPurge = session.pty_id;
          }
          break;
        }
      }
      if (!ptyIdToPurge) {
        const sharedPanel = (activeProject.shared_panels || []).find((p) => p.id === panelId);
        if (sharedPanel) {
          sessionCount = (sharedPanel.sessions || []).length;
          const session = (sharedPanel.sessions || []).find((s) => s.id === sessionId);
          if (session) {
            ptyIdToPurge = session.pty_id;
          }
        }
      }

      if (sessionCount <= 1) {
        handlePanelClose(panelId);
        return;
      }

      if (ptyIdToPurge) {
        disposeTerminal(ptyIdToPurge);
        invoke('pty_kill', { id: ptyIdToPurge }).catch(console.error);
        invoke('pty_purge_scrollback', { id: ptyIdToPurge }).catch(console.error);
      }

      const projectId = activeProject.id;

      saveWorkspace((current) => {
        const newProjects = current.projects.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            features: p.features.map((f) => ({
              ...f,
              panels: f.panels.map((panel) => {
                if (panel.id !== panelId) return panel;
                const newSessions = (panel.sessions || []).filter((s) => s.id !== sessionId);
                const newActiveId =
                  panel.active_session_id === sessionId
                    ? newSessions[0]?.id || ''
                    : panel.active_session_id;
                return { ...panel, sessions: newSessions, active_session_id: newActiveId };
              }),
            })),
            shared_panels: (p.shared_panels || []).map((panel) => {
              if (panel.id !== panelId) return panel;
              const newSessions = (panel.sessions || []).filter((s) => s.id !== sessionId);
              const newActiveId =
                panel.active_session_id === sessionId
                  ? newSessions[0]?.id || ''
                  : panel.active_session_id;
              return { ...panel, sessions: newSessions, active_session_id: newActiveId };
            }),
          };
        });
        return { ...current, projects: newProjects };
      });

      setActivePanelId(panelId);
    },
    [activeProject, saveWorkspace, setActivePanelId, handlePanelClose]
  );

  const handleSessionSelect = useCallback(
    (panelId: string, sessionId: string) => {
      if (!activeProject) return;
      const projectId = activeProject.id;

      saveWorkspace((current) => {
        const newProjects = current.projects.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            features: p.features.map((f) => ({
              ...f,
              panels: f.panels.map((panel) =>
                panel.id === panelId ? { ...panel, active_session_id: sessionId } : panel
              ),
            })),
            shared_panels: (p.shared_panels || []).map((panel) =>
              panel.id === panelId ? { ...panel, active_session_id: sessionId } : panel
            ),
          };
        });
        return { ...current, projects: newProjects };
      });
    },
    [activeProject, saveWorkspace]
  );

  const handleSessionTitleChange = useCallback(
    (panelId: string, sessionId: string, title: string) => {
      if (!activeProject) return;
      const projectId = activeProject.id;

      saveWorkspace((current) => {
        const newProjects = current.projects.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            features: p.features.map((f) => ({
              ...f,
              panels: f.panels.map((panel) =>
                panel.id === panelId
                  ? {
                      ...panel,
                      sessions: (panel.sessions || []).map((s) =>
                        s.id === sessionId ? { ...s, title } : s
                      ),
                    }
                  : panel
              ),
            })),
            shared_panels: (p.shared_panels || []).map((panel) =>
              panel.id === panelId
                ? {
                    ...panel,
                    sessions: (panel.sessions || []).map((s) =>
                      s.id === sessionId ? { ...s, title } : s
                    ),
                  }
                : panel
            ),
          };
        });
        return { ...current, projects: newProjects };
      });
    },
    [activeProject, saveWorkspace]
  );

  return {
    // Project & Feature
    handleAddProject,
    handleAddFeature,
    // Panel
    handlePanelSplit,
    handleInitialPanelCreate,
    handlePanelClose,
    handlePanelToggleShared,
    handlePanelReload,
    // Session
    handleSessionAdd,
    handleSessionClose,
    handleSessionSelect,
    handleSessionTitleChange,
  };
}
