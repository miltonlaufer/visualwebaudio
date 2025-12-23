/**
 * useGraphUndoRedo Hook Tests
 *
 * Comprehensive tests for the graph undo/redo hook.
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGraphUndoRedo } from './useGraphUndoRedo'
import type { Node, Edge } from '@xyflow/react'

/******************* HELPERS ***********************/

function createMockNode(id: string, x = 0, y = 0): Node {
  return {
    id,
    type: 'default',
    position: { x, y },
    data: { nodeType: 'TestNode', label: id },
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

/******************* TESTS ***********************/

describe('useGraphUndoRedo', () => {
  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      expect(result.current.nodes).toHaveLength(0)
      expect(result.current.edges).toHaveLength(0)
      expect(result.current.undoStack).toHaveLength(0)
      expect(result.current.redoStack).toHaveLength(0)
      expect(result.current.canUndo).toBe(false)
      expect(result.current.canRedo).toBe(false)
      expect(result.current.canPaste).toBe(false)
    })
  })

  describe('node operations', () => {
    it('should add a node with undo support', () => {
      const { result } = renderHook(() => useGraphUndoRedo())
      const node = createMockNode('node1', 100, 100)

      act(() => {
        result.current.addNode(node)
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].id).toBe('node1')
      expect(result.current.canUndo).toBe(true)
    })

    it('should remove a node with undo support', () => {
      const { result } = renderHook(() => useGraphUndoRedo())
      const node = createMockNode('node1')

      act(() => {
        result.current.addNode(node)
      })
      act(() => {
        result.current.removeNode('node1')
      })

      expect(result.current.nodes).toHaveLength(0)
      expect(result.current.undoStack).toHaveLength(2)
    })

    it('should remove connected edges when node is removed', () => {
      const { result } = renderHook(() => useGraphUndoRedo())
      const node1 = createMockNode('node1')
      const node2 = createMockNode('node2')
      const edge = createMockEdge('edge1', 'node1', 'node2')

      act(() => {
        result.current.addNode(node1)
      })
      act(() => {
        result.current.addNode(node2)
      })
      act(() => {
        result.current.addEdge(edge)
      })

      expect(result.current.edges).toHaveLength(1)

      act(() => {
        result.current.removeNode('node1')
      })

      expect(result.current.edges).toHaveLength(0)
    })

    it('should remove multiple nodes', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.addNode(createMockNode('node2'))
      })
      act(() => {
        result.current.addNode(createMockNode('node3'))
      })

      expect(result.current.nodes).toHaveLength(3)

      act(() => {
        result.current.removeNodes(['node1', 'node3'])
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].id).toBe('node2')
    })
  })

  describe('edge operations', () => {
    it('should add an edge with undo support', () => {
      const { result } = renderHook(() => useGraphUndoRedo())
      const edge = createMockEdge('edge1', 'node1', 'node2')

      act(() => {
        result.current.addEdge(edge)
      })

      expect(result.current.edges).toHaveLength(1)
      expect(result.current.canUndo).toBe(true)
    })

    it('should remove an edge with undo support', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addEdge(createMockEdge('edge1', 'node1', 'node2'))
      })
      act(() => {
        result.current.removeEdge('edge1')
      })

      expect(result.current.edges).toHaveLength(0)
    })

    it('should remove multiple edges', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addEdge(createMockEdge('edge1', 'node1', 'node2'))
      })
      act(() => {
        result.current.addEdge(createMockEdge('edge2', 'node2', 'node3'))
      })
      act(() => {
        result.current.addEdge(createMockEdge('edge3', 'node3', 'node4'))
      })

      act(() => {
        result.current.removeEdges(['edge1', 'edge3'])
      })

      expect(result.current.edges).toHaveLength(1)
      expect(result.current.edges[0].id).toBe('edge2')
    })
  })

  describe('undo operations', () => {
    it('should undo adding a node', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })

      expect(result.current.nodes).toHaveLength(1)

      act(() => {
        result.current.undo()
      })

      expect(result.current.nodes).toHaveLength(0)
      expect(result.current.canUndo).toBe(false)
      expect(result.current.canRedo).toBe(true)
    })

    it('should undo removing a node', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.removeNode('node1')
      })

      expect(result.current.nodes).toHaveLength(0)

      act(() => {
        result.current.undo()
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].id).toBe('node1')
    })

    it('should undo multiple operations', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.addNode(createMockNode('node2'))
      })
      act(() => {
        result.current.addNode(createMockNode('node3'))
      })

      expect(result.current.nodes).toHaveLength(3)

      act(() => {
        result.current.undo()
      })
      act(() => {
        result.current.undo()
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].id).toBe('node1')
    })

    it('should not undo when stack is empty', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      expect(result.current.canUndo).toBe(false)

      act(() => {
        result.current.undo()
      })

      expect(result.current.nodes).toHaveLength(0)
    })
  })

  describe('redo operations', () => {
    it('should redo an undone operation', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.undo()
      })

      expect(result.current.nodes).toHaveLength(0)
      expect(result.current.canRedo).toBe(true)

      act(() => {
        result.current.redo()
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.canRedo).toBe(false)
    })

    it('should redo multiple undone operations', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.addNode(createMockNode('node2'))
      })
      act(() => {
        result.current.undo()
      })
      act(() => {
        result.current.undo()
      })

      expect(result.current.nodes).toHaveLength(0)

      act(() => {
        result.current.redo()
      })
      act(() => {
        result.current.redo()
      })

      expect(result.current.nodes).toHaveLength(2)
    })

    it('should clear redo stack on new action', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.undo()
      })

      expect(result.current.canRedo).toBe(true)

      act(() => {
        result.current.addNode(createMockNode('node2'))
      })

      expect(result.current.canRedo).toBe(false)
    })

    it('should not redo when stack is empty', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      expect(result.current.canRedo).toBe(false)

      act(() => {
        result.current.redo()
      })

      expect(result.current.nodes).toHaveLength(0)
    })
  })

  describe('clipboard operations', () => {
    it('should copy nodes to clipboard', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.copy(['node1'])
      })

      expect(result.current.clipboard.nodes).toHaveLength(1)
      expect(result.current.clipboard.nodes[0].id).toBe('node1')
      expect(result.current.canPaste).toBe(true)
    })

    it('should copy nodes with connected edges', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.addNode(createMockNode('node2'))
      })
      act(() => {
        result.current.addEdge(createMockEdge('edge1', 'node1', 'node2'))
      })
      act(() => {
        result.current.copy(['node1', 'node2'])
      })

      expect(result.current.clipboard.nodes).toHaveLength(2)
      expect(result.current.clipboard.edges).toHaveLength(1)
    })

    it('should not copy edges to nodes outside selection', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.addNode(createMockNode('node2'))
      })
      act(() => {
        result.current.addNode(createMockNode('node3'))
      })
      act(() => {
        result.current.addEdge(createMockEdge('edge1', 'node1', 'node2'))
      })
      act(() => {
        result.current.addEdge(createMockEdge('edge2', 'node2', 'node3'))
      })
      act(() => {
        result.current.copy(['node1', 'node2'])
      })

      // Only edge1 should be copied (both endpoints in selection)
      expect(result.current.clipboard.edges).toHaveLength(1)
      expect(result.current.clipboard.edges[0].id).toBe('edge1')
    })

    it('should cut nodes (copy + delete)', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.cut(['node1'])
      })

      expect(result.current.nodes).toHaveLength(0)
      expect(result.current.clipboard.nodes).toHaveLength(1)
      expect(result.current.canUndo).toBe(true)
    })

    it('should paste nodes with new IDs', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1', 100, 100))
      })
      act(() => {
        result.current.copy(['node1'])
      })
      act(() => {
        result.current.paste()
      })

      expect(result.current.nodes).toHaveLength(2)
      const newNode = result.current.nodes.find(n => n.id !== 'node1')
      expect(newNode).toBeDefined()
      expect(newNode!.id).toContain('node1')
      expect(newNode!.id).toContain('copy')
    })

    it('should paste nodes with offset position', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1', 100, 100))
      })
      act(() => {
        result.current.copy(['node1'])
      })
      act(() => {
        result.current.paste()
      })

      const newNode = result.current.nodes.find(n => n.id !== 'node1')
      expect(newNode!.position.x).toBe(150) // 100 + 50 offset
      expect(newNode!.position.y).toBe(150)
    })

    it('should preserve edges when pasting connected nodes', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.addNode(createMockNode('node2'))
      })
      act(() => {
        result.current.addEdge(createMockEdge('edge1', 'node1', 'node2'))
      })
      act(() => {
        result.current.copy(['node1', 'node2'])
      })
      act(() => {
        result.current.paste()
      })

      expect(result.current.nodes).toHaveLength(4)
      expect(result.current.edges).toHaveLength(2)

      // New edge should connect new nodes
      const newEdge = result.current.edges.find(e => e.id !== 'edge1')
      expect(newEdge).toBeDefined()
      expect(newEdge!.source).toContain('copy')
      expect(newEdge!.target).toContain('copy')
    })

    it('should not paste when clipboard is empty', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      expect(result.current.canPaste).toBe(false)

      act(() => {
        result.current.paste()
      })

      expect(result.current.nodes).toHaveLength(0)
    })

    it('should undo cut operation', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.cut(['node1'])
      })

      expect(result.current.nodes).toHaveLength(0)

      act(() => {
        result.current.undo()
      })

      expect(result.current.nodes).toHaveLength(1)
      expect(result.current.nodes[0].id).toBe('node1')
    })

    it('should undo paste operation', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.copy(['node1'])
      })
      act(() => {
        result.current.paste()
      })

      expect(result.current.nodes).toHaveLength(2)

      act(() => {
        result.current.undo()
      })

      expect(result.current.nodes).toHaveLength(1)
    })
  })

  describe('history management', () => {
    it('should limit undo stack to maxHistory', () => {
      const { result } = renderHook(() => useGraphUndoRedo({ maxHistory: 5 }))

      // Add 10 nodes
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.addNode(createMockNode(`node${i}`))
        })
      }

      // Stack should be limited to 5
      expect(result.current.undoStack.length).toBeLessThanOrEqual(5)
    })

    it('should clear history', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      // Add two nodes so we have undo history
      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.addNode(createMockNode('node2'))
      })
      // Undo one to populate redo stack
      act(() => {
        result.current.undo()
      })

      // Now we should have 1 in undo and 1 in redo
      expect(result.current.undoStack.length).toBeGreaterThan(0)
      expect(result.current.redoStack.length).toBeGreaterThan(0)

      act(() => {
        result.current.clearHistory()
      })

      expect(result.current.undoStack).toHaveLength(0)
      expect(result.current.redoStack).toHaveLength(0)
    })

    it('should reset entire state', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.copy(['node1'])
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.nodes).toHaveLength(0)
      expect(result.current.edges).toHaveLength(0)
      expect(result.current.undoStack).toHaveLength(0)
      expect(result.current.redoStack).toHaveLength(0)
      expect(result.current.clipboard.nodes).toHaveLength(0)
    })
  })

  describe('options', () => {
    it('should call onNodesChange callback', () => {
      const onNodesChange = vi.fn()
      const { result } = renderHook(() => useGraphUndoRedo({ onNodesChange }))

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })

      expect(onNodesChange).toHaveBeenCalled()
    })

    it('should call onEdgesChange callback', () => {
      const onEdgesChange = vi.fn()
      const { result } = renderHook(() => useGraphUndoRedo({ onEdgesChange }))

      act(() => {
        result.current.addEdge(createMockEdge('edge1', 'node1', 'node2'))
      })

      expect(onEdgesChange).toHaveBeenCalled()
    })

    it('should use custom paste offset', () => {
      const { result } = renderHook(() => useGraphUndoRedo({ pasteOffset: 100 }))

      act(() => {
        result.current.addNode(createMockNode('node1', 50, 50))
      })
      act(() => {
        result.current.copy(['node1'])
      })
      act(() => {
        result.current.paste()
      })

      const newNode = result.current.nodes.find(n => n.id !== 'node1')
      expect(newNode!.position.x).toBe(150) // 50 + 100 offset
      expect(newNode!.position.y).toBe(150)
    })

    it('should use custom ID generators', () => {
      const generateNodeId = vi.fn((id: string) => `custom_${id}`)
      const generateEdgeId = vi.fn((id: string) => `custom_edge_${id}`)

      const { result } = renderHook(() => useGraphUndoRedo({ generateNodeId, generateEdgeId }))

      act(() => {
        result.current.addNode(createMockNode('node1'))
      })
      act(() => {
        result.current.addNode(createMockNode('node2'))
      })
      act(() => {
        result.current.addEdge(createMockEdge('edge1', 'node1', 'node2'))
      })
      act(() => {
        result.current.copy(['node1', 'node2'])
      })
      act(() => {
        result.current.paste()
      })

      expect(generateNodeId).toHaveBeenCalled()
      expect(generateEdgeId).toHaveBeenCalled()

      const customNode = result.current.nodes.find(n => n.id.startsWith('custom_'))
      expect(customNode).toBeDefined()
    })
  })

  describe('direct state setters', () => {
    it('should allow direct node setting (bypasses undo)', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.setNodes([createMockNode('node1'), createMockNode('node2')])
      })

      expect(result.current.nodes).toHaveLength(2)
      expect(result.current.canUndo).toBe(false) // No undo because direct set
    })

    it('should allow direct edge setting (bypasses undo)', () => {
      const { result } = renderHook(() => useGraphUndoRedo())

      act(() => {
        result.current.setEdges([createMockEdge('edge1', 'node1', 'node2')])
      })

      expect(result.current.edges).toHaveLength(1)
      expect(result.current.canUndo).toBe(false)
    })
  })
})
