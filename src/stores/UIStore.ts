/**
 * UI Store
 *
 * Manages UI-specific state that doesn't need to be persisted with the project.
 * Follows Single Responsibility Principle by handling only UI concerns.
 *
 * State managed here:
 * - Clipboard for copy/paste operations
 * - Drag state for node creation
 * - Viewport state for canvas
 */

import { types, Instance, getRoot } from 'mobx-state-tree'
import type { IRootStore } from './RootStore'

/******************* TYPES ***********************/

export interface ClipboardNode {
  id: string
  nodeType: string
  position: { x: number; y: number }
  properties: Record<string, unknown>
  metadata: unknown
}

export interface ClipboardEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface ClipboardData {
  nodes: ClipboardNode[]
  edges: ClipboardEdge[]
  operation: 'copy' | 'cut'
  sourceNodeIds: string[]
}

/******************* MODEL ***********************/

export const UIStore = types
  .model('UIStore', {
    // Clipboard state is volatile - not serialized
  })
  .volatile(() => ({
    clipboard: null as ClipboardData | null,
    isDraggingNewNode: false,
    draggingNodeType: null as string | null,
    viewportX: 0,
    viewportY: 0,
    viewportZoom: 1,
  }))
  .views(self => ({
    get root(): IRootStore {
      return getRoot(self) as IRootStore
    },

    get hasClipboard(): boolean {
      return self.clipboard !== null && self.clipboard.nodes.length > 0
    },

    get clipboardNodeCount(): number {
      return self.clipboard?.nodes.length ?? 0
    },

    get isCutOperation(): boolean {
      return self.clipboard?.operation === 'cut'
    },
  }))
  .actions(self => ({
    /******************* CLIPBOARD ACTIONS ***********************/

    setClipboard(data: ClipboardData | null) {
      self.clipboard = data
    },

    clearClipboard() {
      self.clipboard = null
    },

    /******************* DRAG STATE ACTIONS ***********************/

    startDraggingNewNode(nodeType: string) {
      self.isDraggingNewNode = true
      self.draggingNodeType = nodeType
    },

    stopDraggingNewNode() {
      self.isDraggingNewNode = false
      self.draggingNodeType = null
    },

    /******************* VIEWPORT ACTIONS ***********************/

    setViewport(x: number, y: number, zoom: number) {
      self.viewportX = x
      self.viewportY = y
      self.viewportZoom = zoom
    },

    resetViewport() {
      self.viewportX = 0
      self.viewportY = 0
      self.viewportZoom = 1
    },
  }))

export interface IUIStore extends Instance<typeof UIStore> {}
