/**
 * [INPUT]: useNavigate hook
 * [OUTPUT]: Unit tests for navigation hook
 * [POS]: 测试导航 hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useNavigate } from './useNavigate';
import { navigationStateAtom } from '@/store';
import type { View } from '@/types';
import React from 'react';

// Helper to create a Jotai provider wrapper
function createWrapper(initialView: View = { type: 'home' }) {
  const store = createStore();
  store.set(navigationStateAtom, { history: [initialView], index: 0 });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store }, children);
  };
}

describe('useNavigate', () => {
  it('returns a navigate function', () => {
    const { result } = renderHook(() => useNavigate(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current).toBe('function');
  });

  it('navigates to a new view', () => {
    const store = createStore();
    store.set(navigationStateAtom, { history: [{ type: 'home' }], index: 0 });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store }, children);

    const { result } = renderHook(() => useNavigate(), { wrapper });

    act(() => {
      result.current({ type: 'chat-projects' });
    });

    const state = store.get(navigationStateAtom);
    expect(state.history).toHaveLength(2);
    expect(state.index).toBe(1);
    expect(state.history[1]).toEqual({ type: 'chat-projects' });
  });

  it('clears forward history when navigating from middle', () => {
    const store = createStore();
    store.set(navigationStateAtom, {
      history: [{ type: 'home' }, { type: 'chat-projects' }, { type: 'workspace' }],
      index: 1, // currently at 'chat-projects', 'workspace' is forward
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store }, children);

    const { result } = renderHook(() => useNavigate(), { wrapper });

    act(() => {
      result.current({ type: 'settings' });
    });

    const state = store.get(navigationStateAtom);
    // Forward history ('workspace') should be cleared
    expect(state.history).toHaveLength(3);
    expect(state.history).toEqual([
      { type: 'home' },
      { type: 'chat-projects' },
      { type: 'settings' },
    ]);
    expect(state.index).toBe(2);
  });

  it('respects MAX_HISTORY limit of 50', () => {
    const store = createStore();
    // Create history with 50 items using valid View types
    const initialHistory: View[] = Array.from({ length: 50 }, (_, i) => ({
      type: 'workspace' as const,
      projectId: `project-${i}`,
    }));
    store.set(navigationStateAtom, { history: initialHistory, index: 49 });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store }, children);

    const { result } = renderHook(() => useNavigate(), { wrapper });

    act(() => {
      result.current({ type: 'home' });
    });

    const state = store.get(navigationStateAtom);
    // Should still be 50, oldest item removed
    expect(state.history).toHaveLength(50);
    expect(state.index).toBe(49);
    expect(state.history[49]).toEqual({ type: 'home' });
    // First item should be project-1 (project-0 was removed)
    expect(state.history[0]).toEqual({ type: 'workspace', projectId: 'project-1' });
  });

  it('handles multiple navigations correctly', () => {
    const store = createStore();
    store.set(navigationStateAtom, { history: [{ type: 'home' }], index: 0 });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store }, children);

    const { result } = renderHook(() => useNavigate(), { wrapper });

    act(() => {
      result.current({ type: 'chat-projects' });
    });

    act(() => {
      result.current({ type: 'features' });
    });

    act(() => {
      result.current({ type: 'settings' });
    });

    const state = store.get(navigationStateAtom);
    expect(state.history).toHaveLength(4);
    expect(state.index).toBe(3);
    expect(state.history.map((v) => v.type)).toEqual([
      'home',
      'chat-projects',
      'features',
      'settings',
    ]);
  });

  it('preserves view params when navigating', () => {
    const store = createStore();
    store.set(navigationStateAtom, { history: [{ type: 'home' }], index: 0 });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store }, children);

    const { result } = renderHook(() => useNavigate(), { wrapper });

    const viewWithParams: View = {
      type: 'workspace',
      projectId: 'my-project',
      featureId: 'feature-123',
    };

    act(() => {
      result.current(viewWithParams);
    });

    const state = store.get(navigationStateAtom);
    expect(state.history[1]).toEqual(viewWithParams);
  });
});
