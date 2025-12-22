/**
 * Composite Editor Store
 *
 * Manages the state of the composite node editor, including:
 * - Whether the editor is open
 * - The definition being edited
 * - Event-based node addition requests (observed by CompositeEditorPanel)
 * - Read-only state management
 */

import { types, Instance, addDisposer } from 'mobx-state-tree'
import { createContext, useContext } from 'react'

/******************* TYPES ***********************/

/** Pending node request for event-based communication */
export interface PendingNodeRequest {
  nodeType: string
  position: { x: number; y: number }
  timestamp: number
}

/******************* STORE MODEL ***********************/

export const CompositeEditorStoreModel = types
  .model('CompositeEditorStore', {
    isOpen: types.optional(types.boolean, false),
    editingDefinitionId: types.maybeNull(types.string),
    isCreatingNew: types.optional(types.boolean, false),
    // ID of the node in the main graph that opened this editor (if any)
    sourceNodeId: types.maybeNull(types.string),
    // Error message to display (auto-clears after timeout)
    error: types.maybeNull(types.string),
    // Whether the editor allows modifications (set by editor component)
    _editorReady: types.optional(types.boolean, false),
  })
  .volatile(() => ({
    // Pending node request - observed by CompositeEditorPanel via reaction
    pendingNodeRequest: null as PendingNodeRequest | null,
    // Timer for auto-clearing error (volatile to avoid serialization)
    _errorTimer: null as ReturnType<typeof setTimeout> | null,
  }))
  .views(self => ({
    get isEditing() {
      return self.isOpen
    },
    // Check if the editor is in read-only mode
    get isReadOnly() {
      return self.isOpen && !self._editorReady
    },
    // Check if nodes can be added
    get canAddNodes() {
      return self.isOpen && self._editorReady
    },
  }))
  .actions(self => ({
    openEditor(definitionId: string | null, sourceNodeId?: string) {
      self.isOpen = true
      self.editingDefinitionId = definitionId
      self.isCreatingNew = definitionId === null
      self.sourceNodeId = sourceNodeId || null
      self._editorReady = false
    },

    // Switch to editing a different definition (used after Save As)
    switchToDefinition(newDefinitionId: string) {
      self.editingDefinitionId = newDefinitionId
      self.isCreatingNew = false
    },

    closeEditor() {
      self.isOpen = false
      self.editingDefinitionId = null
      self.isCreatingNew = false
      self.sourceNodeId = null
      self._editorReady = false
      self.pendingNodeRequest = null
    },

    /**
     * Mark the editor as ready to receive nodes.
     * Called by CompositeEditorPanel when it's mounted and not read-only.
     */
    setEditorReady(ready: boolean) {
      self._editorReady = ready
    },

    /**
     * Request to add a node to the editor.
     * This sets a pending request that CompositeEditorPanel observes via reaction.
     * Event-based pattern eliminates callback coupling.
     */
    requestAddNode(nodeType: string) {
      if (!self._editorReady) {
        return
      }
      // Generate position with some randomization
      const position = {
        x: 300 + Math.random() * 200,
        y: 150 + Math.random() * 200,
      }
      self.pendingNodeRequest = {
        nodeType,
        position,
        timestamp: Date.now(),
      }
    },

    /**
     * Clear the pending node request after it's been processed.
     * Called by CompositeEditorPanel after handling the request.
     */
    clearPendingNodeRequest() {
      self.pendingNodeRequest = null
    },

    // Legacy method for backward compatibility during migration
    // TODO: Remove after all usages are migrated
    addNodeToEditor(nodeType: string) {
      this.requestAddNode(nodeType)
    },

    // Legacy method - now replaced by setEditorReady
    // Kept for test compatibility during migration
    setAddNodeCallback(
      callback: ((nodeType: string, position: { x: number; y: number }) => void) | null
    ) {
      // Convert to new pattern: if callback provided, editor is ready
      self._editorReady = callback !== null
    },

    createNew() {
      self.isOpen = true
      self.editingDefinitionId = null
      self.isCreatingNew = true
    },

    // Clear any existing error timer (internal helper)
    _clearErrorTimer() {
      if (self._errorTimer) {
        clearTimeout(self._errorTimer)
        self._errorTimer = null
      }
    },

    // Clear error message and timer
    clearError() {
      // Use inline timer clearing to avoid action ordering issues
      if (self._errorTimer) {
        clearTimeout(self._errorTimer)
        self._errorTimer = null
      }
      self.error = null
    },
  }))
  .actions(self => ({
    // setError needs to be in separate action block to call clearError
    setError(message: string | null) {
      // Clear any existing timer
      self._clearErrorTimer()

      self.error = message

      // Auto-clear error after 5 seconds
      if (message) {
        // Store reference to self for closure
        const store = self
        self._errorTimer = setTimeout(() => {
          // Call clearError action (safe from setTimeout)
          store.clearError()
        }, 5000)
      }
    },

    // Lifecycle hook for cleanup
    afterCreate() {
      // Register disposer to clear timer on store destruction
      addDisposer(self, () => {
        self._clearErrorTimer()
      })
    },
  }))

export interface ICompositeEditorStore extends Instance<typeof CompositeEditorStoreModel> {}

// Create singleton instance
export const compositeEditorStore = CompositeEditorStoreModel.create({})

// React context
const CompositeEditorStoreContext = createContext<ICompositeEditorStore | null>(null)

export const CompositeEditorStoreProvider = CompositeEditorStoreContext.Provider

export function useCompositeEditorStore(): ICompositeEditorStore {
  const store = useContext(CompositeEditorStoreContext)
  if (!store) {
    // Return singleton if not in provider
    return compositeEditorStore
  }
  return store
}
