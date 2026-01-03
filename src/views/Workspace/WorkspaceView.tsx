/**
 * [INPUT]: useWorkspaceState, useWorkspaceHandlers
 * [OUTPUT]: WorkspaceView component
 * [POS]: 工作区主视图 - 终端面板网格布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 views/CLAUDE.md
 */

import { ProjectHomeView } from './ProjectHomeView';
import { ProjectDashboard } from './ProjectDashboard';
import { PanelGrid } from '../../components/PanelGrid';
import { useWorkspaceState, useWorkspaceHandlers } from './hooks';

export function WorkspaceView() {
  const {
    loading,
    activePanelId,
    setActivePanelId,
    activeProject,
    activeFeature,
    workspace,
    saveWorkspace,
    allFeaturePanels,
  } = useWorkspaceState();

  const {
    handleAddProject,
    handleAddFeature,
    handlePanelSplit,
    handleInitialPanelCreate,
    handlePanelClose,
    handlePanelToggleShared,
    handlePanelReload,
    handleSessionAdd,
    handleSessionClose,
    handleSessionSelect,
    handleSessionTitleChange,
  } = useWorkspaceHandlers({
    workspace,
    activeProject,
    activeFeature,
    saveWorkspace,
    setActivePanelId,
  });

  if (loading) {
    return (
      <div className="bg-canvas flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  // No active project - show welcome
  if (!activeProject) {
    return (
      <div className="bg-canvas flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="text-ink mb-2 font-serif text-2xl font-bold">Welcome to Workspace</h2>
            <p className="text-muted-foreground mb-6">
              Add a project to start parallel vibe coding
            </p>
            <button
              onClick={handleAddProject}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-3 transition-colors"
            >
              Add Your First Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard mode
  if (activeProject.view_mode === 'dashboard') {
    return (
      <div className="bg-canvas flex h-full flex-col">
        <ProjectDashboard project={activeProject} />
      </div>
    );
  }

  // Home mode
  if (activeProject.view_mode === 'home') {
    return (
      <div className="bg-canvas flex h-full flex-col">
        <ProjectHomeView projectPath={activeProject.path} projectName={activeProject.name} />
      </div>
    );
  }

  // Feature mode - no active feature
  if (!activeFeature) {
    return (
      <div className="bg-canvas flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No features yet</p>
            <button
              onClick={() => handleAddFeature(activeProject.id)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 transition-colors"
            >
              Create First Feature
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Feature mode - render panel grid for all features (keep PTY alive)
  return (
    <div className="bg-canvas flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        {activeProject.features.map((feature) => {
          const isActive = feature.id === activeFeature.id;
          const featurePanels = allFeaturePanels.get(feature.id) || [];
          if (!isActive && featurePanels.length === 0) return null;

          return (
            <div
              key={feature.id}
              className={`absolute inset-0 ${isActive ? '' : 'pointer-events-none invisible'}`}
            >
              <PanelGrid
                panels={featurePanels}
                layout={feature.layout}
                activePanelId={activePanelId}
                onPanelFocus={setActivePanelId}
                onPanelClose={handlePanelClose}
                onPanelSplit={handlePanelSplit}
                onPanelToggleShared={handlePanelToggleShared}
                onPanelReload={handlePanelReload}
                onSessionAdd={handleSessionAdd}
                onSessionClose={handleSessionClose}
                onSessionSelect={handleSessionSelect}
                onSessionTitleChange={handleSessionTitleChange}
                onInitialPanelCreate={handleInitialPanelCreate}
                direction={feature.layout_direction || 'horizontal'}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
