/**
 * Main Graph Operations Hook
 *
 * Adapts the AudioGraphStore to the IGraphOperations interface
 * and registers it with the GraphFocusStore.
 */

import { useEffect, useCallback, useRef } from 'react'
import { graphFocusStore, type IGraphOperations } from '~/stores/GraphFocusStore'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import type { Node, Edge } from '@xyflow/react'

/******************* TYPES ***********************/

export interface UseMainGraphOperationsOptions {
  store: AudioGraphStoreType
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
}

/******************* HOOK ***********************/

export function useMainGraphOperations(options: UseMainGraphOperationsOptions): void {
  const { store, selectedNodeIds, selectedEdgeIds } = options

  // Use refs to avoid stale closures
  const selectedNodeIdsRef = useRef(selectedNodeIds)
  const selectedEdgeIdsRef = useRef(selectedEdgeIds)

  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds
  }, [selectedNodeIds])

  useEffect(() => {
    selectedEdgeIdsRef.current = selectedEdgeIds
  }, [selectedEdgeIds])

  /******************* OPERATIONS ADAPTER ***********************/

  const createHandler = useCallback((): IGraphOperations => {
    return {
      getSelectedNodeIds: () => selectedNodeIdsRef.current,
      getSelectedEdgeIds: () => selectedEdgeIdsRef.current,

      selectNodes: (_nodeIds: string[]) => {
        // Selection is managed by React Flow, not the store
        // This is a no-op for main graph
      },

      deselectAll: () => {
        // Selection is managed by React Flow
      },

      copyNodes: (nodeIds: string[]): Node[] => {
        store.copySelectedNodes(nodeIds)
        // Return the copied nodes for the unified clipboard
        // Convert MST nodes to React Flow Node format
        return store.adaptedNodes
          .filter(n => nodeIds.includes(n.id))
          .map(n => ({
            id: n.id,
            type: n.nodeType,
            position: { x: n.position.x, y: n.position.y },
            data: { ...n },
          }))
      },

      cutNodes: (nodeIds: string[]) => {
        store.cutSelectedNodes(nodeIds)
      },

      pasteNodes: (_nodes: Node[], _edges: Edge[]) => {
        // Main graph uses its own clipboard via store.pasteNodes()
        store.pasteNodes().catch(err => {
          console.error('Error pasting nodes:', err)
        })
      },

      deleteNodes: (nodeIds: string[]) => {
        nodeIds.forEach(id => store.removeNode(id))
      },

      deleteEdges: (edgeIds: string[]) => {
        edgeIds.forEach(id => store.removeEdge(id))
      },

      canUndo: () => store.canUndo,
      canRedo: () => store.canRedo,
      undo: () => store.undo(),
      redo: () => store.redo(),

      isReadOnly: () => false,
    }
  }, [store])

  /******************* REGISTRATION ***********************/

  useEffect(() => {
    const handler = createHandler()
    graphFocusStore.registerMainGraphHandler(handler)

    // Set main graph as active by default
    if (graphFocusStore.activeContext === 'main') {
      graphFocusStore.activateMainGraph()
    }

    return () => {
      graphFocusStore.registerMainGraphHandler(null)
    }
  }, [createHandler])
}

export default useMainGraphOperations
