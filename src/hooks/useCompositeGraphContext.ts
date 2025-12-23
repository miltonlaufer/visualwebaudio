/**
 * useCompositeGraphContext Hook
 *
 * A React hook that wraps CompositeGraphContext, providing a clean interface
 * for using the graph context in React components with ReactFlow integration.
 *
 * This hook manages the synchronization between React state (for ReactFlow)
 * and the CompositeGraphContext (for graph operations).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNodesState, useEdgesState } from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react'
import { CompositeGraphContext } from '~/stores/CompositeGraphContext'
import type { IGraphContext } from '~/stores/GraphContext'

/******************* TYPES ***********************/

export interface UseCompositeGraphContextOptions {
  /** Initial nodes */
  initialNodes?: Node[]
  /** Initial edges */
  initialEdges?: Edge[]
  /** Whether the context is read-only */
  isReadOnly?: boolean
}

export interface UseCompositeGraphContextReturn {
  /** ReactFlow nodes state */
  nodes: Node[]
  /** ReactFlow edges state */
  edges: Edge[]
  /** ReactFlow onNodesChange handler */
  onNodesChange: (changes: NodeChange[]) => void
  /** ReactFlow onEdgesChange handler */
  onEdgesChange: (changes: EdgeChange[]) => void
  /** The graph context instance */
  context: IGraphContext
  /** Set nodes directly (for loading data) */
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  /** Set edges directly (for loading data) */
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  /** Set selection state */
  setSelection: (nodeIds: string[], edgeIds: string[]) => void
  /** Reset the context */
  reset: () => void
}

/******************* HOOK ***********************/

export function useCompositeGraphContext(
  options: UseCompositeGraphContextOptions = {}
): UseCompositeGraphContextReturn {
  const { initialNodes = [], initialEdges = [], isReadOnly = false } = options

  /******************* REACTFLOW STATE ***********************/

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)

  /******************* CONTEXT ***********************/

  // Create a stable context instance
  const contextRef = useRef<CompositeGraphContext | null>(null)
  if (!contextRef.current) {
    contextRef.current = new CompositeGraphContext()
  }
  const context = contextRef.current

  /******************* INITIALIZATION ***********************/

  // Initialize context when component mounts or read-only changes
  // Note: We intentionally exclude nodes/edges/setNodes/setEdges from deps
  // because we don't want to re-initialize on every state change -
  // that's handled by updateState in the next effect
  useEffect(() => {
    context.initialize(nodes, edges, setNodes, setEdges, isReadOnly)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, isReadOnly])

  // Keep context in sync with React state
  useEffect(() => {
    context.updateState(nodes, edges)
  }, [context, nodes, edges])

  /******************* CALLBACKS ***********************/

  const setSelection = useCallback(
    (nodeIds: string[], edgeIds: string[]) => {
      context.setSelection(nodeIds, edgeIds)
    },
    [context]
  )

  const reset = useCallback(() => {
    context.reset()
    setNodes([])
    setEdges([])
  }, [context, setNodes, setEdges])

  /******************* RETURN ***********************/

  // Cast to IGraphContext for public API
  const graphContext: IGraphContext = context

  return useMemo(
    () => ({
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      context: graphContext,
      setNodes,
      setEdges,
      setSelection,
      reset,
    }),
    [
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      graphContext,
      setNodes,
      setEdges,
      setSelection,
      reset,
    ]
  )
}

export default useCompositeGraphContext
