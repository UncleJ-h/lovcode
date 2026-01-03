/**
 * [INPUT]: LayoutNode type
 * [OUTPUT]: splitLayoutNode, removeFromLayout
 * [POS]: Workspace 布局树操作工具函数
 * [PROTOCOL]: 变更时更新此头部
 */

import type { LayoutNode } from '../types';

/**
 * Split a layout node at the target panel, creating a new split node
 */
export function splitLayoutNode(
  node: LayoutNode,
  targetPanelId: string,
  direction: 'horizontal' | 'vertical',
  newPanelId: string
): LayoutNode {
  if (node.type === 'panel') {
    if (node.panelId === targetPanelId) {
      // Found the target - replace with split node
      return {
        type: 'split',
        direction,
        first: node,
        second: { type: 'panel', panelId: newPanelId },
      };
    }
    return node;
  }
  // Recurse into split node
  return {
    ...node,
    first: splitLayoutNode(node.first, targetPanelId, direction, newPanelId),
    second: splitLayoutNode(node.second, targetPanelId, direction, newPanelId),
  };
}

/**
 * Remove a panel from the layout tree, collapsing parent split nodes as needed
 */
export function removeFromLayout(node: LayoutNode, targetPanelId: string): LayoutNode | null {
  if (node.type === 'panel') {
    return node.panelId === targetPanelId ? null : node;
  }
  const first = removeFromLayout(node.first, targetPanelId);
  const second = removeFromLayout(node.second, targetPanelId);
  if (!first && !second) return null;
  if (!first) return second;
  if (!second) return first;
  return { ...node, first, second };
}
