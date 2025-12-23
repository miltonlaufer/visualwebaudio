/**
 * Graph Focus Store
 *
 * Manages which graph context is currently active (main graph or composite editor).
 * This enables unified keyboard handling and clipboard operations across contexts.
 *
 * Architecture:
 * - Only one context can be active at a time
 * - When composite editor opens, it becomes active
 * - When composite editor closes, main graph becomes active
 * - Keyboard shortcuts route to the active context
 * - Clipboard is shared across contexts
 */

import { types, Instance } from 'mobx-state-tree'
import { createContext, useContext } from 'react'
import type { Node, Edge } from '@xyflow/react'

/******************* TYPES ***********************/

export type GraphContextType = 'main' | 'composite'

export interface ClipboardData {
  nodes: Node[]
  edges: Edge[]
  sourceContext: GraphContextType
}

/** Interface for graph operations that both contexts must implement */
export interface IGraphOperations {
  // Selection
  getSelectedNodeIds(): string[]
  getSelectedEdgeIds(): string[]
  selectNodes(nodeIds: string[]): void
  deselectAll(): void

  // Node operations
  copyNodes(nodeIds: string[]): Node[]
  cutNodes(nodeIds: string[]): void
  pasteNodes(nodes: Node[], edges: Edge[]): void
  deleteNodes(nodeIds: string[]): void
  deleteEdges(edgeIds: string[]): void

  // Undo/Redo
  canUndo(): boolean
  canRedo(): boolean
  undo(): void
  redo(): void

  // State
  isReadOnly(): boolean
}

/******************* STORE MODEL ***********************/

export const GraphFocusStoreModel = types
  .model('GraphFocusStore', {
    activeContext: types.optional(
      types.enumeration<GraphContextType>('GraphContextType', ['main', 'composite']),
      'main'
    ),
  })
  .volatile(() => ({
    // Clipboard shared across contexts
    clipboard: null as ClipboardData | null,

    // Registered context handlers
    mainGraphHandler: null as IGraphOperations | null,
    compositeEditorHandler: null as IGraphOperations | null,
  }))
  .views(self => ({
    get canPaste(): boolean {
      return self.clipboard !== null && self.clipboard.nodes.length > 0
    },

    get clipboardNodes(): Node[] {
      return self.clipboard?.nodes ?? []
    },

    get clipboardEdges(): Edge[] {
      return self.clipboard?.edges ?? []
    },

    get activeHandler(): IGraphOperations | null {
      if (self.activeContext === 'composite' && self.compositeEditorHandler) {
        return self.compositeEditorHandler
      }
      return self.mainGraphHandler
    },

    get isActiveContextReadOnly(): boolean {
      const handler = this.activeHandler
      return handler?.isReadOnly() ?? false
    },
  }))
  .actions(self => ({
    /******************* CONTEXT MANAGEMENT ***********************/

    setActiveContext(context: GraphContextType) {
      self.activeContext = context
    },

    activateMainGraph() {
      self.activeContext = 'main'
    },

    activateCompositeEditor() {
      self.activeContext = 'composite'
    },

    /******************* HANDLER REGISTRATION ***********************/

    registerMainGraphHandler(handler: IGraphOperations | null) {
      self.mainGraphHandler = handler
    },

    registerCompositeEditorHandler(handler: IGraphOperations | null) {
      self.compositeEditorHandler = handler
    },

    /******************* CLIPBOARD OPERATIONS ***********************/

    setClipboard(data: ClipboardData | null) {
      self.clipboard = data
    },

    clearClipboard() {
      self.clipboard = null
    },

    /**
     * Copy nodes from the active context to the shared clipboard
     */
    copy(): boolean {
      const handler = self.activeHandler
      if (!handler) return false

      const selectedNodeIds = handler.getSelectedNodeIds()
      if (selectedNodeIds.length === 0) return false

      const copiedNodes = handler.copyNodes(selectedNodeIds)
      if (copiedNodes.length === 0) return false

      // Store the nodes in the clipboard
      // Note: Edges will be reconstructed during paste based on node connections
      self.clipboard = {
        nodes: copiedNodes,
        edges: [],
        sourceContext: self.activeContext,
      }

      return true
    },

    /**
     * Cut nodes from the active context
     */
    cut(): boolean {
      const handler = self.activeHandler
      if (!handler || handler.isReadOnly()) return false

      const selectedNodeIds = handler.getSelectedNodeIds()
      if (selectedNodeIds.length === 0) return false

      // Copy first
      const copiedNodes = handler.copyNodes(selectedNodeIds)
      if (copiedNodes.length === 0) return false

      self.clipboard = {
        nodes: copiedNodes,
        edges: [],
        sourceContext: self.activeContext,
      }

      // Then delete
      handler.cutNodes(selectedNodeIds)

      return true
    },

    /**
     * Paste nodes into the active context
     */
    paste(): boolean {
      const handler = self.activeHandler
      if (!handler || handler.isReadOnly()) return false
      if (!self.clipboard || self.clipboard.nodes.length === 0) return false

      handler.pasteNodes(self.clipboard.nodes, self.clipboard.edges)
      return true
    },

    /******************* EDIT OPERATIONS ***********************/

    /**
     * Delete selected nodes/edges in the active context
     */
    deleteSelected(): boolean {
      const handler = self.activeHandler
      if (!handler || handler.isReadOnly()) return false

      const selectedNodeIds = handler.getSelectedNodeIds()
      const selectedEdgeIds = handler.getSelectedEdgeIds()

      if (selectedNodeIds.length > 0) {
        handler.deleteNodes(selectedNodeIds)
        return true
      }

      if (selectedEdgeIds.length > 0) {
        handler.deleteEdges(selectedEdgeIds)
        return true
      }

      return false
    },

    /******************* UNDO/REDO ***********************/

    undo(): boolean {
      const handler = self.activeHandler
      if (!handler || !handler.canUndo()) return false

      handler.undo()
      return true
    },

    redo(): boolean {
      const handler = self.activeHandler
      if (!handler || !handler.canRedo()) return false

      handler.redo()
      return true
    },

    /******************* QUERIES ***********************/

    canUndo(): boolean {
      return self.activeHandler?.canUndo() ?? false
    },

    canRedo(): boolean {
      return self.activeHandler?.canRedo() ?? false
    },
  }))

/******************* EXPORTS ***********************/

export interface IGraphFocusStore extends Instance<typeof GraphFocusStoreModel> {}

// Singleton instance
export const graphFocusStore = GraphFocusStoreModel.create({})

// React context
const GraphFocusStoreContext = createContext<IGraphFocusStore | null>(null)

export const GraphFocusStoreProvider = GraphFocusStoreContext.Provider

export function useGraphFocusStore(): IGraphFocusStore {
  const store = useContext(GraphFocusStoreContext)
  if (!store) {
    // Return singleton if not in provider
    return graphFocusStore
  }
  return store
}
