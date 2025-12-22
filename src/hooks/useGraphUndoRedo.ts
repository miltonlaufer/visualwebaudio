/**
 * useGraphUndoRedo Hook
 *
 * A reusable hook for managing undo/redo state in graph-based editors.
 * Uses refs to avoid stale closure issues with React state updates.
 *
 * Features:
 * - Undo/redo with configurable history limit
 * - Clipboard operations (copy, cut, paste)
 * - Automatic edge cleanup when nodes are removed
 * - ID remapping for pasted nodes
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'

/******************* TYPES ***********************/

export interface GraphState {
  nodes: Node[]
  edges: Edge[]
}

export interface ClipboardState {
  nodes: Node[]
  edges: Edge[]
}

export interface UseGraphUndoRedoOptions {
  /** Maximum number of undo states to keep */
  maxHistory?: number
  /** Offset for pasted nodes */
  pasteOffset?: number
  /** Callback when nodes are added (only used with internal state management) */
  onNodesChange?: (nodes: Node[]) => void
  /** Callback when edges are added (only used with internal state management) */
  onEdgesChange?: (edges: Edge[]) => void
  /** Custom ID generator for pasted nodes */
  generateNodeId?: (originalId: string, nodeType: string) => string
  /** Custom ID generator for pasted edges */
  generateEdgeId?: (originalId: string, source: string, target: string) => string
  /** External nodes state (for integration with useNodesState) */
  externalNodes?: Node[]
  /** External edges state (for integration with useEdgesState) */
  externalEdges?: Edge[]
  /** External setNodes function (for integration with useNodesState) */
  externalSetNodes?: React.Dispatch<React.SetStateAction<Node[]>>
  /** External setEdges function (for integration with useEdgesState) */
  externalSetEdges?: React.Dispatch<React.SetStateAction<Edge[]>>
}

export interface UseGraphUndoRedoReturn {
  /** Current nodes */
  nodes: Node[]
  /** Current edges */
  edges: Edge[]
  /** Set nodes directly (bypasses undo) */
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  /** Set edges directly (bypasses undo) */
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  /** Undo stack for inspection */
  undoStack: GraphState[]
  /** Redo stack for inspection */
  redoStack: GraphState[]
  /** Current clipboard contents */
  clipboard: ClipboardState
  /** Whether undo is available */
  canUndo: boolean
  /** Whether redo is available */
  canRedo: boolean
  /** Whether paste is available */
  canPaste: boolean
  /** Save current state to undo stack (call before making changes) */
  saveUndoState: () => void
  /** Undo last change */
  undo: () => void
  /** Redo last undone change */
  redo: () => void
  /** Copy nodes to clipboard */
  copy: (nodeIds: string[]) => void
  /** Cut nodes (copy + delete) */
  cut: (nodeIds: string[]) => void
  /** Paste nodes from clipboard */
  paste: () => void
  /** Add a node with undo support */
  addNode: (node: Node) => void
  /** Remove a node with undo support */
  removeNode: (nodeId: string) => void
  /** Remove multiple nodes with undo support */
  removeNodes: (nodeIds: string[]) => void
  /** Add an edge with undo support */
  addEdge: (edge: Edge) => void
  /** Remove an edge with undo support */
  removeEdge: (edgeId: string) => void
  /** Remove multiple edges with undo support */
  removeEdges: (edgeIds: string[]) => void
  /** Clear undo/redo history */
  clearHistory: () => void
  /** Reset entire state including history */
  reset: () => void
}

/******************* DEFAULT OPTIONS ***********************/

const DEFAULT_MAX_HISTORY = 50
const DEFAULT_PASTE_OFFSET = 50

/******************* HOOK ***********************/

export function useGraphUndoRedo(options: UseGraphUndoRedoOptions = {}): UseGraphUndoRedoReturn {
  const {
    maxHistory = DEFAULT_MAX_HISTORY,
    pasteOffset = DEFAULT_PASTE_OFFSET,
    onNodesChange,
    onEdgesChange,
    generateNodeId,
    generateEdgeId,
    externalNodes,
    externalEdges,
    externalSetNodes,
    externalSetEdges,
  } = options

  // Determine if using external state management
  const useExternalState = externalSetNodes !== undefined && externalSetEdges !== undefined

  /******************* STATE ***********************/

  // Internal state (used when external state is not provided)
  const [internalNodes, setInternalNodes] = useState<Node[]>([])
  const [internalEdges, setInternalEdges] = useState<Edge[]>([])
  const [undoStack, setUndoStack] = useState<GraphState[]>([])
  const [redoStack, setRedoStack] = useState<GraphState[]>([])
  const [clipboard, setClipboard] = useState<ClipboardState>({ nodes: [], edges: [] })

  // Use external or internal state
  const nodes = useExternalState ? (externalNodes ?? []) : internalNodes
  const edges = useExternalState ? (externalEdges ?? []) : internalEdges
  const setNodes = useExternalState ? externalSetNodes! : setInternalNodes
  const setEdges = useExternalState ? externalSetEdges! : setInternalEdges

  /******************* REFS (to avoid stale closures) ***********************/

  const nodesRef = useRef<Node[]>(nodes)
  const edgesRef = useRef<Edge[]>(edges)
  const undoStackRef = useRef<GraphState[]>(undoStack)
  const redoStackRef = useRef<GraphState[]>(redoStack)

  // Keep refs in sync with state
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])
  useEffect(() => {
    undoStackRef.current = undoStack
  }, [undoStack])
  useEffect(() => {
    redoStackRef.current = redoStack
  }, [redoStack])

  // Notify callbacks when state changes (only for internal state management)
  useEffect(() => {
    if (!useExternalState) onNodesChange?.(nodes)
  }, [nodes, onNodesChange, useExternalState])
  useEffect(() => {
    if (!useExternalState) onEdgesChange?.(edges)
  }, [edges, onEdgesChange, useExternalState])

  /******************* UNDO/REDO OPERATIONS ***********************/

  const saveUndoState = useCallback(() => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current
    setUndoStack(prev => {
      const newStack = [...prev, { nodes: [...currentNodes], edges: [...currentEdges] }]
      // Limit history size
      if (newStack.length > maxHistory) newStack.shift()
      return newStack
    })
    // Clear redo stack when new action is performed
    setRedoStack([])
  }, [maxHistory])

  const undo = useCallback(() => {
    const currentUndoStack = undoStackRef.current
    if (currentUndoStack.length === 0) return

    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    // Save current state to redo stack
    setRedoStack(prev => [...prev, { nodes: [...currentNodes], edges: [...currentEdges] }])

    // Restore previous state
    const previousState = currentUndoStack[currentUndoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    setNodes(previousState.nodes)
    setEdges(previousState.edges)
  }, [])

  const redo = useCallback(() => {
    const currentRedoStack = redoStackRef.current
    if (currentRedoStack.length === 0) return

    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    // Save current state to undo stack
    setUndoStack(prev => [...prev, { nodes: [...currentNodes], edges: [...currentEdges] }])

    // Restore next state
    const nextState = currentRedoStack[currentRedoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))
    setNodes(nextState.nodes)
    setEdges(nextState.edges)
  }, [])

  const clearHistory = useCallback(() => {
    setUndoStack([])
    setRedoStack([])
  }, [])

  const reset = useCallback(() => {
    setNodes([])
    setEdges([])
    setUndoStack([])
    setRedoStack([])
    setClipboard({ nodes: [], edges: [] })
  }, [])

  /******************* NODE OPERATIONS ***********************/

  const addNode = useCallback(
    (node: Node) => {
      saveUndoState()
      setNodes(prev => [...prev, node])
    },
    [saveUndoState]
  )

  const removeNode = useCallback(
    (nodeId: string) => {
      saveUndoState()
      setNodes(prev => prev.filter(n => n.id !== nodeId))
      // Also remove connected edges
      setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId))
    },
    [saveUndoState]
  )

  const removeNodes = useCallback(
    (nodeIds: string[]) => {
      saveUndoState()
      const nodeIdSet = new Set(nodeIds)
      setNodes(prev => prev.filter(n => !nodeIdSet.has(n.id)))
      // Also remove connected edges
      setEdges(prev => prev.filter(e => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target)))
    },
    [saveUndoState]
  )

  /******************* EDGE OPERATIONS ***********************/

  const addEdge = useCallback(
    (edge: Edge) => {
      saveUndoState()
      setEdges(prev => [...prev, edge])
    },
    [saveUndoState]
  )

  const removeEdge = useCallback(
    (edgeId: string) => {
      saveUndoState()
      setEdges(prev => prev.filter(e => e.id !== edgeId))
    },
    [saveUndoState]
  )

  const removeEdges = useCallback(
    (edgeIds: string[]) => {
      saveUndoState()
      const edgeIdSet = new Set(edgeIds)
      setEdges(prev => prev.filter(e => !edgeIdSet.has(e.id)))
    },
    [saveUndoState]
  )

  /******************* CLIPBOARD OPERATIONS ***********************/

  const copy = useCallback((nodeIds: string[]) => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const nodesToCopy = currentNodes.filter(n => nodeIds.includes(n.id))
    if (nodesToCopy.length === 0) return

    const nodeIdSet = new Set(nodeIds)
    // Only copy edges where both source and target are in selection
    const edgesToCopy = currentEdges.filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))

    setClipboard({ nodes: nodesToCopy, edges: edgesToCopy })
  }, [])

  const cut = useCallback(
    (nodeIds: string[]) => {
      // Save state first
      saveUndoState()
      // Copy to clipboard
      copy(nodeIds)
      // Then remove
      const nodeIdSet = new Set(nodeIds)
      setNodes(prevNodes => prevNodes.filter(n => !nodeIdSet.has(n.id)))
      setEdges(prevEdges =>
        prevEdges.filter(e => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target))
      )
    },
    [saveUndoState, copy]
  )

  const paste = useCallback(() => {
    if (clipboard.nodes.length === 0) return

    saveUndoState()

    const idMap = new Map<string, string>()
    const timestamp = Date.now()

    // Create new nodes with new IDs and offset positions
    const newNodes = clipboard.nodes.map((clipNode, index) => {
      const nodeType = (clipNode.data as { nodeType?: string })?.nodeType || 'node'
      const newId = generateNodeId
        ? generateNodeId(clipNode.id, nodeType)
        : `${clipNode.id}_copy_${timestamp}_${index}`
      idMap.set(clipNode.id, newId)

      return {
        ...clipNode,
        id: newId,
        position: {
          x: clipNode.position.x + pasteOffset,
          y: clipNode.position.y + pasteOffset,
        },
      }
    })

    // Create new edges with updated source/target IDs
    const newEdges = clipboard.edges
      .filter(clipEdge => idMap.has(clipEdge.source) && idMap.has(clipEdge.target))
      .map((clipEdge, index) => {
        const newSource = idMap.get(clipEdge.source)!
        const newTarget = idMap.get(clipEdge.target)!
        const newId = generateEdgeId
          ? generateEdgeId(clipEdge.id, newSource, newTarget)
          : `${clipEdge.id}_copy_${timestamp}_${index}`

        return {
          ...clipEdge,
          id: newId,
          source: newSource,
          target: newTarget,
        }
      })

    setNodes(prevNodes => [...prevNodes, ...newNodes])
    setEdges(prevEdges => [...prevEdges, ...newEdges])
  }, [clipboard, saveUndoState, pasteOffset, generateNodeId, generateEdgeId])

  /******************* COMPUTED VALUES ***********************/

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0
  const canPaste = clipboard.nodes.length > 0

  /******************* RETURN ***********************/

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    undoStack,
    redoStack,
    clipboard,
    canUndo,
    canRedo,
    canPaste,
    saveUndoState,
    undo,
    redo,
    copy,
    cut,
    paste,
    addNode,
    removeNode,
    removeNodes,
    addEdge,
    removeEdge,
    removeEdges,
    clearHistory,
    reset,
  }
}

export default useGraphUndoRedo
