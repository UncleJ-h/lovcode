/**
 * [INPUT]: useAppNavigation hook
 * [OUTPUT]: Unit tests for app navigation hook
 * [POS]: 测试应用导航 hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useAppNavigation } from './useAppNavigation';
import { navigationStateAtom } from '@/store';
import type { View } from '@/types';
import React from 'react';

// Helper to create a Jotai provider wrapper with custom initial state
function createWrapper(initialView: View = { type: 'home' }, initialHistory?: View[]) {
  const store = createStore();
  const history = initialHistory || [initialView];
  store.set(navigationStateAtom, { history, index: history.length - 1 });

  return {
    store,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store }, children),
  };
}

describe('useAppNavigation', () => {
  describe('navigate', () => {
    it('navigates to a new view', () => {
      const { wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.navigate({ type: 'chat-projects' });
      });

      expect(result.current.view.type).toBe('chat-projects');
    });

    it('adds to history when navigating', () => {
      const { store, wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.navigate({ type: 'settings' });
      });

      const state = store.get(navigationStateAtom);
      expect(state.history).toHaveLength(2);
    });
  });

  describe('goBack / goForward', () => {
    it('canGoBack is false at start of history', () => {
      const { wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      expect(result.current.canGoBack).toBe(false);
    });

    it('canGoBack is true after navigating', () => {
      const { wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.navigate({ type: 'settings' });
      });

      expect(result.current.canGoBack).toBe(true);
    });

    it('canGoForward is false at end of history', () => {
      const { wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      expect(result.current.canGoForward).toBe(false);
    });

    it('goBack navigates to previous view', () => {
      const { store, wrapper } = createWrapper({ type: 'home' }, [
        { type: 'home' },
        { type: 'settings' },
      ]);
      // Set index to 1 (settings)
      store.set(navigationStateAtom, {
        history: [{ type: 'home' }, { type: 'settings' }],
        index: 1,
      });

      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.goBack();
      });

      expect(result.current.view.type).toBe('home');
    });

    it('goForward navigates to next view', () => {
      const { store, wrapper } = createWrapper();
      store.set(navigationStateAtom, {
        history: [{ type: 'home' }, { type: 'settings' }],
        index: 0,
      });

      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.goForward();
      });

      expect(result.current.view.type).toBe('settings');
    });

    it('goBack does nothing at start of history', () => {
      const { store, wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.goBack();
      });

      const state = store.get(navigationStateAtom);
      expect(state.index).toBe(0);
    });

    it('goForward does nothing at end of history', () => {
      const { store, wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.goForward();
      });

      const state = store.get(navigationStateAtom);
      expect(state.index).toBe(0);
    });
  });

  describe('currentFeature', () => {
    it('returns chat for chat-projects view', () => {
      const { wrapper } = createWrapper({ type: 'chat-projects' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      expect(result.current.currentFeature).toBe('chat');
    });

    it('returns chat for chat-sessions view', () => {
      const { wrapper } = createWrapper({
        type: 'chat-sessions',
        projectId: 'test',
        projectPath: '/test',
      });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      expect(result.current.currentFeature).toBe('chat');
    });

    it('returns workspace for workspace view', () => {
      const { wrapper } = createWrapper({ type: 'workspace' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      expect(result.current.currentFeature).toBe('workspace');
    });

    it('returns settings for settings view', () => {
      const { wrapper } = createWrapper({ type: 'settings' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      expect(result.current.currentFeature).toBe('settings');
    });

    it('returns commands for commands view', () => {
      const { wrapper } = createWrapper({ type: 'commands' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      expect(result.current.currentFeature).toBe('commands');
    });

    it('returns mcp for mcp view', () => {
      const { wrapper } = createWrapper({ type: 'mcp' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      expect(result.current.currentFeature).toBe('mcp');
    });

    it('returns null for home view', () => {
      const { wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      expect(result.current.currentFeature).toBe(null);
    });
  });

  describe('handleFeatureClick', () => {
    it('navigates to chat-projects for chat feature', () => {
      const { wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.handleFeatureClick('chat');
      });

      expect(result.current.view.type).toBe('chat-projects');
    });

    it('navigates to workspace for workspace feature', () => {
      const { wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.handleFeatureClick('workspace');
      });

      expect(result.current.view.type).toBe('workspace');
    });

    it('navigates to settings for settings feature', () => {
      const { wrapper } = createWrapper({ type: 'home' });
      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.handleFeatureClick('settings');
      });

      expect(result.current.view.type).toBe('settings');
    });

    it('navigates to marketplace with category', () => {
      const { wrapper } = createWrapper({ type: 'home' });

      const { result } = renderHook(() => useAppNavigation(), { wrapper });

      act(() => {
        result.current.handleFeatureClick('marketplace');
      });

      expect(result.current.view.type).toBe('marketplace');
      // Default category from marketplaceCategoryAtom is 'commands'
      expect((result.current.view as { category?: string }).category).toBe('commands');
    });
  });
});
