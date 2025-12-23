/**
 * Composite Editor Operations Hook
 *
 * Adapts the composite editor state to the IGraphOperations interface
 * and registers it with the GraphFocusStore.
 *
 * This hook should be used in CompositeEditorPanel to connect it to the
 * unified keyboard/clipboard system.
 */

import { useEffect, useCallback, useRef } from 'react'
import { graphFocusStore, type IGraphOperations } from '~/stores/GraphFocusStore'
import type { Node, Edge } from '@xyflow/react'

/******************* TYPES ***********************/

export interface UseCompositeEditorOperationsOptions {
  /** Whether the editor is currently open */
  isOpen: boolean
  /** Whether the editor is read-only (prebuilt composite) */
  isReadOnly: boolean
  /** Current nodes in the editor */
  nodes: Node[]
  /** Current edges in the editor */
  edges: Edge[]
  /** Selected node IDs */
  selectedNodeIds: string[]
  /** Selected edge IDs */
  selectedEdgeIds: string[]
  /** Set nodes function */
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  /** Set edges function */
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  /** Save undo state function */
  saveUndoState: () => void
  /** Undo function */
  undo: () => void
  /** Redo function */
  redo: () => void
  /** Can undo */
  canUndo: boolean
  /** Can redo */
  canRedo: boolean
  /** Node ID counter ref for generating new IDs */
  nodeIdCounter: React.MutableRefObject<number>
}

/******************* CONSTANTS ***********************/

const PASTE_OFFSET = 50

/******************* HOOK ***********************/

export function useCompositeEditorOperations(options: UseCompositeEditorOperationsOptions): void {
  const {
    isOpen,
    isReadOnly,
    nodes,
    edges,
    selectedNodeIds,
    selectedEdgeIds,
    setNodes,
    setEdges,
    saveUndoState,
    undo,
    redo,
    canUndo,
    canRedo,
    nodeIdCounter,
  } = options

  // Use refs to avoid stale closures
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const selectedNodeIdsRef = useRef(selectedNodeIds)
  const selectedEdgeIdsRef = useRef(selectedEdgeIds)
  const isReadOnlyRef = useRef(isReadOnly)
  const canUndoRef = useRef(canUndo)
  const canRedoRef = useRef(canRedo)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds
  }, [selectedNodeIds])
  useEffect(() => {
    selectedEdgeIdsRef.current = selectedEdgeIds
  }, [selectedEdgeIds])
  useEffect(() => {
    isReadOnlyRef.current = isReadOnly
  }, [isReadOnly])
  useEffect(() => {
    canUndoRef.current = canUndo
  }, [canUndo])
  useEffect(() => {
    canRedoRef.current = canRedo
  }, [canRedo])

  /******************* OPERATIONS ADAPTER ***********************/

  const createHandler = useCallback((): IGraphOperations => {
    return {
      getSelectedNodeIds: () => selectedNodeIdsRef.current,
      getSelectedEdgeIds: () => selectedEdgeIdsRef.current,

      selectNodes: (_nodeIds: string[]) => {
        // Selection is managed by React Flow
      },

      deselectAll: () => {
        // Selection is managed by React Flow
      },

      copyNodes: (nodeIds: string[]): Node[] => {
        const currentNodes = nodesRef.current
        // Only copy internal nodes, not edge connectors
        return currentNodes.filter(n => nodeIds.includes(n.id) && n.type === 'internalNode')
      },

      cutNodes: (nodeIds: string[]) => {
        if (isReadOnlyRef.current) return

        saveUndoState()
        const nodeIdSet = new Set(nodeIds)
        setNodes(prev => prev.filter(n => !nodeIdSet.has(n.id)))
        setEdges(prev => prev.filter(e => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target)))
      },

      pasteNodes: (nodesToPaste: Node[], _edgesToPaste: Edge[]) => {
        if (isReadOnlyRef.current) return
        if (nodesToPaste.length === 0) return

        saveUndoState()

        const idMap = new Map<string, string>()
        const timestamp = Date.now()

        // Create new nodes with new IDs and offset positions
        const newNodes = nodesToPaste.map((clipNode, _index) => {
          const nodeType = (clipNode.data as { nodeType?: string })?.nodeType || 'node'
          const newId = `internal_${nodeType}_${timestamp}_${nodeIdCounter.current++}`
          idMap.set(clipNode.id, newId)

          return {
            ...clipNode,
            id: newId,
            position: {
              x: clipNode.position.x + PASTE_OFFSET,
              y: clipNode.position.y + PASTE_OFFSET,
            },
          }
        })

        setNodes(prev => [...prev, ...newNodes])
      },

      deleteNodes: (nodeIds: string[]) => {
        if (isReadOnlyRef.current) return

        // Don't allow deleting edge connectors
        const deletableIds = nodeIds.filter(id => {
          const node = nodesRef.current.find(n => n.id === id)
          return node?.type === 'internalNode'
        })

        if (deletableIds.length === 0) return

        saveUndoState()
        const nodeIdSet = new Set(deletableIds)
        setNodes(prev => prev.filter(n => !nodeIdSet.has(n.id)))
        setEdges(prev => prev.filter(e => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target)))
      },

      deleteEdges: (edgeIds: string[]) => {
        if (isReadOnlyRef.current) return
        if (edgeIds.length === 0) return

        saveUndoState()
        const edgeIdSet = new Set(edgeIds)
        setEdges(prev => prev.filter(e => !edgeIdSet.has(e.id)))
      },

      canUndo: () => canUndoRef.current && !isReadOnlyRef.current,
      canRedo: () => canRedoRef.current && !isReadOnlyRef.current,
      undo: () => {
        if (!isReadOnlyRef.current) undo()
      },
      redo: () => {
        if (!isReadOnlyRef.current) redo()
      },

      isReadOnly: () => isReadOnlyRef.current,
    }
  }, [setNodes, setEdges, saveUndoState, undo, redo, nodeIdCounter])

  /******************* REGISTRATION ***********************/

  useEffect(() => {
    if (!isOpen) {
      // When editor closes, switch back to main graph
      graphFocusStore.registerCompositeEditorHandler(null)
      graphFocusStore.activateMainGraph()
      return
    }

    // When editor opens, register handler and activate composite context
    const handler = createHandler()
    graphFocusStore.registerCompositeEditorHandler(handler)
    graphFocusStore.activateCompositeEditor()

    return () => {
      graphFocusStore.registerCompositeEditorHandler(null)
      graphFocusStore.activateMainGraph()
    }
  }, [isOpen, createHandler])
}

export default useCompositeEditorOperations
