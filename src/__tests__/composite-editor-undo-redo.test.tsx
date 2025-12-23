/**
 * Composite Editor Undo/Redo and Clipboard Tests
 *
 * Tests for undo/redo and clipboard functionality in the composite editor.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState, useCallback, useRef, useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'

// Helper hook to simulate the undo/redo logic from CompositeEditorPanel
function useUndoRedo() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [undoStack, setUndoStack] = useState<{ nodes: Node[]; edges: Edge[] }[]>([])
  const [redoStack, setRedoStack] = useState<{ nodes: Node[]; edges: Edge[] }[]>([])
  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[] }>({
    nodes: [],
    edges: [],
  })

  // Refs for accessing current state in callbacks (to avoid stale closures)
  const nodesRef = useRef<Node[]>(nodes)
  const edgesRef = useRef<Edge[]>(edges)
  const undoStackRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>(undoStack)
  const redoStackRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>(redoStack)

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

  const saveUndoState = useCallback(() => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current
    setUndoStack(prev => {
      const newStack = [...prev, { nodes: [...currentNodes], edges: [...currentEdges] }]
      if (newStack.length > 50) newStack.shift()
      return newStack
    })
    setRedoStack([])
  }, [])

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
      setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId))
    },
    [saveUndoState]
  )

  const addEdge = useCallback(
    (edge: Edge) => {
      saveUndoState()
      setEdges(prev => [...prev, edge])
    },
    [saveUndoState]
  )

  const handleUndo = useCallback(() => {
    const currentUndoStack = undoStackRef.current
    if (currentUndoStack.length === 0) return

    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    setRedoStack(prev => [...prev, { nodes: [...currentNodes], edges: [...currentEdges] }])

    const previousState = currentUndoStack[currentUndoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    setNodes(previousState.nodes)
    setEdges(previousState.edges)
  }, [])

  const handleRedo = useCallback(() => {
    const currentRedoStack = redoStackRef.current
    if (currentRedoStack.length === 0) return

    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    setUndoStack(prev => [...prev, { nodes: [...currentNodes], edges: [...currentEdges] }])

    const nextState = currentRedoStack[currentRedoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))
    setNodes(nextState.nodes)
    setEdges(nextState.edges)
  }, [])

  const handleCopy = useCallback((nodeIds: string[]) => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const nodesToCopy = currentNodes.filter(n => nodeIds.includes(n.id))
    if (nodesToCopy.length === 0) return

    const nodeIdSet = new Set(nodeIds)
    const edgesToCopy = currentEdges.filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))

    setClipboard({ nodes: nodesToCopy, edges: edgesToCopy })
  }, [])

  const handleCut = useCallback(
    (nodeIds: string[]) => {
      saveUndoState()
      handleCopy(nodeIds)
      const nodeIdSet = new Set(nodeIds)
      setNodes(prevNodes => prevNodes.filter(n => !nodeIdSet.has(n.id)))
      setEdges(prevEdges =>
        prevEdges.filter(e => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target))
      )
    },
    [saveUndoState, handleCopy]
  )

  const handlePaste = useCallback(() => {
    if (clipboard.nodes.length === 0) return

    saveUndoState()

    const idMap = new Map<string, string>()
    const newNodes = clipboard.nodes.map(clipNode => {
      const newId = `${clipNode.id}_copy_${Date.now()}`
      idMap.set(clipNode.id, newId)
      return {
        ...clipNode,
        id: newId,
        position: {
          x: clipNode.position.x + 50,
          y: clipNode.position.y + 50,
        },
      }
    })

    const newEdges = clipboard.edges
      .filter(clipEdge => idMap.has(clipEdge.source) && idMap.has(clipEdge.target))
      .map(clipEdge => ({
        ...clipEdge,
        id: `${clipEdge.id}_copy_${Date.now()}`,
        source: idMap.get(clipEdge.source)!,
        target: idMap.get(clipEdge.target)!,
      }))

    setNodes(prevNodes => [...prevNodes, ...newNodes])
    setEdges(prevEdges => [...prevEdges, ...newEdges])
  }, [clipboard, saveUndoState])

  return {
    nodes,
    edges,
    undoStack,
    redoStack,
    clipboard,
    addNode,
    removeNode,
    addEdge,
    handleUndo,
    handleRedo,
    handleCopy,
    handleCut,
    handlePaste,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    canPaste: clipboard.nodes.length > 0,
  }
}

// Helper to create mock nodes and edges
function createMockNode(id: string, x = 0, y = 0): Node {
  return {
    id,
    type: 'internalNode',
    position: { x, y },
    data: { nodeType: 'GainNode', properties: new Map() },
  }
}

function createMockEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    type: 'default',
  }
}

describe('Composite Editor Undo/Redo Logic', () => {
  describe('undo operations', () => {
    it('should undo adding a node', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)

      act(() => {
        result.current.addNode(node1)
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.canUndo).toBe(true)

      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.nodes).toHaveLength(0)
      expect(result.current.canUndo).toBe(false)
      expect(result.current.canRedo).toBe(true)
    })

    it('should undo removing a node', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)

      act(() => {
        result.current.addNode(node1)
      })

      act(() => {
        result.current.removeNode('node1')
      })

      expect(result.current.nodes).toHaveLength(0)

      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].id).toBe('node1')
    })

    it('should undo multiple operations', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)
      const node2 = createMockNode('node2', 200, 200)

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.addNode(node2)
      })

      expect(result.current.nodes).toHaveLength(2)
      expect(result.current.undoStack).toHaveLength(2)

      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].id).toBe('node1')

      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.nodes).toHaveLength(0)
    })

    it('should not undo when undo stack is empty', async () => {
      const { result } = renderHook(() => useUndoRedo())

      expect(result.current.canUndo).toBe(false)

      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.nodes).toHaveLength(0)
    })
  })

  describe('redo operations', () => {
    it('should redo an undone operation', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.nodes).toHaveLength(0)
      expect(result.current.canRedo).toBe(true)

      act(() => {
        result.current.handleRedo()
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].id).toBe('node1')
      expect(result.current.canRedo).toBe(false)
    })

    it('should redo multiple undone operations', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)
      const node2 = createMockNode('node2', 200, 200)

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.addNode(node2)
      })
      act(() => {
        result.current.handleUndo()
      })
      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.nodes).toHaveLength(0)
      expect(result.current.redoStack).toHaveLength(2)

      act(() => {
        result.current.handleRedo()
      })
      act(() => {
        result.current.handleRedo()
      })

      expect(result.current.nodes).toHaveLength(2)
    })

    it('should clear redo stack when new action is performed', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)
      const node2 = createMockNode('node2', 200, 200)

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.canRedo).toBe(true)

      act(() => {
        result.current.addNode(node2)
      })

      expect(result.current.canRedo).toBe(false)
      expect(result.current.redoStack).toHaveLength(0)
    })

    it('should not redo when redo stack is empty', async () => {
      const { result } = renderHook(() => useUndoRedo())

      expect(result.current.canRedo).toBe(false)

      act(() => {
        result.current.handleRedo()
      })

      expect(result.current.nodes).toHaveLength(0)
    })
  })

  describe('clipboard operations', () => {
    it('should copy selected nodes', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.handleCopy(['node1'])
      })

      expect(result.current.clipboard.nodes).toHaveLength(1)
      expect(result.current.clipboard.nodes[0].id).toBe('node1')
      expect(result.current.canPaste).toBe(true)
    })

    it('should copy nodes with connected edges', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)
      const node2 = createMockNode('node2', 200, 200)
      const edge1 = createMockEdge('edge1', 'node1', 'node2')

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.addNode(node2)
      })
      act(() => {
        result.current.addEdge(edge1)
      })
      act(() => {
        result.current.handleCopy(['node1', 'node2'])
      })

      expect(result.current.clipboard.nodes).toHaveLength(2)
      expect(result.current.clipboard.edges).toHaveLength(1)
    })

    it('should not include edges to nodes outside selection', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)
      const node2 = createMockNode('node2', 200, 200)
      const node3 = createMockNode('node3', 300, 300)
      const edge1 = createMockEdge('edge1', 'node1', 'node2')
      const edge2 = createMockEdge('edge2', 'node2', 'node3')

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.addNode(node2)
      })
      act(() => {
        result.current.addNode(node3)
      })
      act(() => {
        result.current.addEdge(edge1)
      })
      act(() => {
        result.current.addEdge(edge2)
      })
      act(() => {
        // Only copy node1 and node2, not node3
        result.current.handleCopy(['node1', 'node2'])
      })

      // Should only have edge1, not edge2 (because node3 is not in selection)
      expect(result.current.clipboard.edges).toHaveLength(1)
      expect(result.current.clipboard.edges[0].id).toBe('edge1')
    })

    it('should cut selected nodes and save undo state', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.handleCut(['node1'])
      })

      // Nodes should be removed
      expect(result.current.nodes).toHaveLength(0)
      // Clipboard should have the cut node
      expect(result.current.clipboard.nodes).toHaveLength(1)
      // Should be able to undo
      expect(result.current.canUndo).toBe(true)
    })

    it('should paste clipboard contents with new IDs', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.handleCopy(['node1'])
      })
      act(() => {
        result.current.handlePaste()
      })

      expect(result.current.nodes).toHaveLength(2)
      // New node should have different ID
      const newNode = result.current.nodes.find(n => n.id !== 'node1')
      expect(newNode).toBeDefined()
      expect(newNode!.id).toContain('node1')
      expect(newNode!.id).toContain('copy')
    })

    it('should paste with offset position', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.handleCopy(['node1'])
      })
      act(() => {
        result.current.handlePaste()
      })

      const newNode = result.current.nodes.find(n => n.id !== 'node1')
      expect(newNode!.position.x).toBe(150) // 100 + 50 offset
      expect(newNode!.position.y).toBe(150) // 100 + 50 offset
    })

    it('should preserve edges when pasting connected nodes', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)
      const node2 = createMockNode('node2', 200, 200)
      const edge1 = createMockEdge('edge1', 'node1', 'node2')

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.addNode(node2)
      })
      act(() => {
        result.current.addEdge(edge1)
      })
      act(() => {
        result.current.handleCopy(['node1', 'node2'])
      })
      act(() => {
        result.current.handlePaste()
      })

      expect(result.current.nodes).toHaveLength(4)
      expect(result.current.edges).toHaveLength(2)

      // New edge should connect the new nodes, not the original ones
      const newEdge = result.current.edges.find(e => e.id !== 'edge1')
      expect(newEdge).toBeDefined()
      expect(newEdge!.source).toContain('copy')
      expect(newEdge!.target).toContain('copy')
    })

    it('should undo paste operation', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.handleCopy(['node1'])
      })
      act(() => {
        result.current.handlePaste()
      })

      expect(result.current.nodes).toHaveLength(2)

      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].id).toBe('node1')
    })

    it('should undo cut operation and restore nodes', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.handleCut(['node1'])
      })

      expect(result.current.nodes).toHaveLength(0)

      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].id).toBe('node1')
    })

    it('should not paste when clipboard is empty', async () => {
      const { result } = renderHook(() => useUndoRedo())

      expect(result.current.canPaste).toBe(false)

      act(() => {
        result.current.handlePaste()
      })

      expect(result.current.nodes).toHaveLength(0)
    })
  })

  describe('edge operations with undo', () => {
    it('should undo adding an edge', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)
      const node2 = createMockNode('node2', 200, 200)
      const edge1 = createMockEdge('edge1', 'node1', 'node2')

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.addNode(node2)
      })
      act(() => {
        result.current.addEdge(edge1)
      })

      expect(result.current.edges).toHaveLength(1)

      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.edges).toHaveLength(0)
    })

    it('should remove connected edges when node is removed', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)
      const node2 = createMockNode('node2', 200, 200)
      const edge1 = createMockEdge('edge1', 'node1', 'node2')

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.addNode(node2)
      })
      act(() => {
        result.current.addEdge(edge1)
      })
      act(() => {
        result.current.removeNode('node1')
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.edges).toHaveLength(0) // Edge should be removed
    })

    it('should restore edges when undoing node removal', async () => {
      const { result } = renderHook(() => useUndoRedo())

      const node1 = createMockNode('node1', 100, 100)
      const node2 = createMockNode('node2', 200, 200)
      const edge1 = createMockEdge('edge1', 'node1', 'node2')

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.addNode(node2)
      })
      act(() => {
        result.current.addEdge(edge1)
      })
      act(() => {
        result.current.removeNode('node1')
      })

      act(() => {
        result.current.handleUndo()
      })

      expect(result.current.nodes).toHaveLength(2)
      expect(result.current.edges).toHaveLength(1)
    })
  })

  describe('undo stack limits', () => {
    it('should limit undo stack to 50 items', async () => {
      const { result } = renderHook(() => useUndoRedo())

      // Add 55 nodes to exceed the limit
      for (let i = 0; i < 55; i++) {
        act(() => {
          result.current.addNode(createMockNode(`node${i}`, i * 10, i * 10))
        })
      }

      // Undo stack should be capped at 50
      expect(result.current.undoStack.length).toBeLessThanOrEqual(50)
    })
  })
})
