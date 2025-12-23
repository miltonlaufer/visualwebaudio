/**
 * CompositeGraphContext Tests
 *
 * Tests for the composite graph context that implements IGraphContext.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CompositeGraphContext } from './CompositeGraphContext'
import type { Node, Edge } from '@xyflow/react'

/******************* HELPERS ***********************/

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

/******************* TESTS ***********************/

describe('CompositeGraphContext', () => {
  let context: CompositeGraphContext
  let setNodes: ReturnType<typeof vi.fn>
  let setEdges: ReturnType<typeof vi.fn>

  beforeEach(() => {
    context = new CompositeGraphContext()
    setNodes = vi.fn()
    setEdges = vi.fn()
  })

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      expect(context.nodes).toHaveLength(0)
      expect(context.edges).toHaveLength(0)
      expect(context.selectedNodeIds).toHaveLength(0)
      expect(context.selectedEdgeIds).toHaveLength(0)
      expect(context.isReadOnly).toBe(false)
    })

    it('should initialize with provided state', () => {
      const nodes = [createMockNode('node1')]
      const edges = [createMockEdge('edge1', 'node1', 'node2')]

      context.initialize(nodes, edges, setNodes, setEdges, false)

      expect(context.nodes).toHaveLength(1)
      expect(context.edges).toHaveLength(1)
      expect(context.isReadOnly).toBe(false)
    })

    it('should respect read-only mode', () => {
      context.initialize([], [], setNodes, setEdges, true)
      expect(context.isReadOnly).toBe(true)
    })
  })

  describe('node operations', () => {
    beforeEach(() => {
      context.initialize([], [], setNodes, setEdges, false)
    })

    it('should add a node', () => {
      const nodeId = context.addNode('GainNode', { x: 100, y: 100 })

      expect(nodeId).toContain('GainNode')
      expect(context.nodes).toHaveLength(1)
      expect(setNodes).toHaveBeenCalled()
    })

    it('should not add node in read-only mode', () => {
      context.initialize([], [], setNodes, setEdges, true)

      const nodeId = context.addNode('GainNode', { x: 100, y: 100 })

      expect(nodeId).toBe('')
      expect(context.nodes).toHaveLength(0)
    })

    it('should remove a node', () => {
      context.initialize([createMockNode('node1')], [], setNodes, setEdges, false)

      context.removeNode('node1')

      expect(context.nodes).toHaveLength(0)
      expect(setNodes).toHaveBeenCalled()
    })

    it('should remove connected edges when node is removed', () => {
      const nodes = [createMockNode('node1'), createMockNode('node2')]
      const edges = [createMockEdge('edge1', 'node1', 'node2')]
      context.initialize(nodes, edges, setNodes, setEdges, false)

      context.removeNode('node1')

      expect(context.nodes).toHaveLength(1)
      expect(context.edges).toHaveLength(0)
    })

    it('should remove multiple nodes', () => {
      const nodes = [createMockNode('node1'), createMockNode('node2'), createMockNode('node3')]
      context.initialize(nodes, [], setNodes, setEdges, false)

      context.removeNodes(['node1', 'node3'])

      expect(context.nodes).toHaveLength(1)
      expect(context.nodes[0].id).toBe('node2')
    })

    it('should update node position', () => {
      context.initialize([createMockNode('node1', 0, 0)], [], setNodes, setEdges, false)

      context.updateNodePosition('node1', { x: 200, y: 200 })

      expect(context.nodes[0].position).toEqual({ x: 200, y: 200 })
    })

    it('should select a node', () => {
      context.selectNode('node1')
      expect(context.selectedNodeIds).toContain('node1')
    })

    it('should deselect all', () => {
      context.selectNode('node1')
      context.setSelection(['node1', 'node2'], ['edge1'])

      context.deselectAll()

      expect(context.selectedNodeIds).toHaveLength(0)
      expect(context.selectedEdgeIds).toHaveLength(0)
    })
  })

  describe('edge operations', () => {
    beforeEach(() => {
      context.initialize([], [], setNodes, setEdges, false)
    })

    it('should add an edge', () => {
      const edgeId = context.addEdge('node1', 'node2', 'output', 'input')

      expect(edgeId).toContain('node1')
      expect(edgeId).toContain('node2')
      expect(context.edges).toHaveLength(1)
      expect(setEdges).toHaveBeenCalled()
    })

    it('should not add edge in read-only mode', () => {
      context.initialize([], [], setNodes, setEdges, true)

      const edgeId = context.addEdge('node1', 'node2')

      expect(edgeId).toBe('')
      expect(context.edges).toHaveLength(0)
    })

    it('should remove an edge', () => {
      const edges = [createMockEdge('edge1', 'node1', 'node2')]
      context.initialize([], edges, setNodes, setEdges, false)

      context.removeEdge('edge1')

      expect(context.edges).toHaveLength(0)
    })

    it('should remove multiple edges', () => {
      const edges = [
        createMockEdge('edge1', 'node1', 'node2'),
        createMockEdge('edge2', 'node2', 'node3'),
        createMockEdge('edge3', 'node3', 'node4'),
      ]
      context.initialize([], edges, setNodes, setEdges, false)

      context.removeEdges(['edge1', 'edge3'])

      expect(context.edges).toHaveLength(1)
      expect(context.edges[0].id).toBe('edge2')
    })
  })

  describe('undo/redo operations', () => {
    beforeEach(() => {
      context.initialize([], [], setNodes, setEdges, false)
    })

    it('should undo adding a node', () => {
      context.addNode('GainNode', { x: 100, y: 100 })
      expect(context.nodes).toHaveLength(1)
      expect(context.undoManager.canUndo).toBe(true)

      context.undo()

      expect(context.nodes).toHaveLength(0)
      expect(context.undoManager.canUndo).toBe(false)
      expect(context.undoManager.canRedo).toBe(true)
    })

    it('should redo an undone operation', () => {
      context.addNode('GainNode', { x: 100, y: 100 })
      context.undo()

      expect(context.nodes).toHaveLength(0)

      context.redo()

      expect(context.nodes).toHaveLength(1)
      expect(context.undoManager.canRedo).toBe(false)
    })

    it('should undo removing a node', () => {
      const nodes = [createMockNode('node1')]
      context.initialize(nodes, [], setNodes, setEdges, false)

      context.removeNode('node1')
      expect(context.nodes).toHaveLength(0)

      context.undo()
      expect(context.nodes).toHaveLength(1)
    })

    it('should clear redo stack on new action', () => {
      context.addNode('GainNode', { x: 100, y: 100 })
      context.undo()

      expect(context.undoManager.canRedo).toBe(true)

      context.addNode('OscillatorNode', { x: 200, y: 200 })

      expect(context.undoManager.canRedo).toBe(false)
    })

    it('should not undo in read-only mode', () => {
      context.addNode('GainNode', { x: 100, y: 100 })
      context.initialize(context.nodes, [], setNodes, setEdges, true)

      context.undo()

      expect(context.nodes).toHaveLength(1) // Unchanged
    })

    it('should limit undo stack to 50 items', () => {
      for (let i = 0; i < 60; i++) {
        context.addNode('GainNode', { x: i * 10, y: i * 10 })
      }

      // Undo should be capped - won't be able to undo all 60
      let undoCount = 0
      while (context.undoManager.canUndo) {
        context.undo()
        undoCount++
      }

      expect(undoCount).toBeLessThanOrEqual(50)
    })
  })

  describe('clipboard operations', () => {
    beforeEach(() => {
      context.initialize([], [], setNodes, setEdges, false)
    })

    it('should copy nodes to clipboard', () => {
      const nodes = [createMockNode('node1')]
      context.initialize(nodes, [], setNodes, setEdges, false)

      context.copyNodes(['node1'])

      expect(context.canPaste).toBe(true)
      expect(context.clipboardData?.nodes).toHaveLength(1)
    })

    it('should copy nodes with edges', () => {
      const nodes = [createMockNode('node1'), createMockNode('node2')]
      const edges = [createMockEdge('edge1', 'node1', 'node2')]
      context.initialize(nodes, edges, setNodes, setEdges, false)

      context.copyNodes(['node1', 'node2'])

      expect(context.clipboardData?.nodes).toHaveLength(2)
      expect(context.clipboardData?.edges).toHaveLength(1)
    })

    it('should not copy edges to nodes outside selection', () => {
      const nodes = [createMockNode('node1'), createMockNode('node2'), createMockNode('node3')]
      const edges = [
        createMockEdge('edge1', 'node1', 'node2'),
        createMockEdge('edge2', 'node2', 'node3'),
      ]
      context.initialize(nodes, edges, setNodes, setEdges, false)

      context.copyNodes(['node1', 'node2'])

      expect(context.clipboardData?.edges).toHaveLength(1)
    })

    it('should cut nodes', () => {
      const nodes = [createMockNode('node1')]
      context.initialize(nodes, [], setNodes, setEdges, false)

      context.cutNodes(['node1'])

      expect(context.nodes).toHaveLength(0)
      expect(context.canPaste).toBe(true)
    })

    it('should paste nodes with new IDs', () => {
      const nodes = [createMockNode('node1', 100, 100)]
      context.initialize(nodes, [], setNodes, setEdges, false)

      context.copyNodes(['node1'])
      const pastedIds = context.pasteNodes()

      expect(pastedIds).toHaveLength(1)
      expect(pastedIds[0]).not.toBe('node1')
      expect(context.nodes).toHaveLength(2)
    })

    it('should paste nodes with offset', () => {
      const nodes = [createMockNode('node1', 100, 100)]
      context.initialize(nodes, [], setNodes, setEdges, false)

      context.copyNodes(['node1'])
      context.pasteNodes()

      const pastedNode = context.nodes.find(n => n.id !== 'node1')
      expect(pastedNode?.position.x).toBe(150) // 100 + 50 offset
      expect(pastedNode?.position.y).toBe(150)
    })

    it('should preserve edges when pasting connected nodes', () => {
      const nodes = [createMockNode('node1'), createMockNode('node2')]
      const edges = [createMockEdge('edge1', 'node1', 'node2')]
      context.initialize(nodes, edges, setNodes, setEdges, false)

      context.copyNodes(['node1', 'node2'])
      context.pasteNodes()

      expect(context.nodes).toHaveLength(4)
      expect(context.edges).toHaveLength(2)
    })

    it('should not paste in read-only mode', () => {
      const nodes = [createMockNode('node1')]
      context.initialize(nodes, [], setNodes, setEdges, false)
      context.copyNodes(['node1'])

      context.initialize(nodes, [], setNodes, setEdges, true)
      const pastedIds = context.pasteNodes()

      expect(pastedIds).toHaveLength(0)
    })
  })

  describe('auto-layout', () => {
    beforeEach(() => {
      const nodes = [
        createMockNode('node1', 0, 0),
        createMockNode('node2', 0, 0),
        createMockNode('node3', 0, 0),
      ]
      const edges = [
        createMockEdge('edge1', 'node1', 'node2'),
        createMockEdge('edge2', 'node2', 'node3'),
      ]
      context.initialize(nodes, edges, setNodes, setEdges, false)
    })

    it('should layout nodes', () => {
      const originalPositions = context.nodes.map(n => ({ ...n.position }))

      context.autoLayout('LR')

      // Positions should change
      const newPositions = context.nodes.map(n => ({ ...n.position }))
      const positionsChanged = originalPositions.some(
        (orig, i) => orig.x !== newPositions[i].x || orig.y !== newPositions[i].y
      )

      expect(positionsChanged).toBe(true)
    })

    it('should not layout in read-only mode', () => {
      context.initialize(context.nodes, context.edges, setNodes, setEdges, true)
      const originalPositions = context.nodes.map(n => ({ ...n.position }))

      context.autoLayout('LR')

      const newPositions = context.nodes.map(n => ({ ...n.position }))
      expect(originalPositions).toEqual(newPositions)
    })

    it('should save undo state before layout', () => {
      expect(context.undoManager.canUndo).toBe(false)

      context.autoLayout('LR')

      expect(context.undoManager.canUndo).toBe(true)
    })
  })

  describe('state management', () => {
    it('should update state when updateState is called', () => {
      context.initialize([], [], setNodes, setEdges, false)

      const newNodes = [createMockNode('node1')]
      const newEdges = [createMockEdge('edge1', 'node1', 'node2')]

      context.updateState(newNodes, newEdges)

      expect(context.nodes).toHaveLength(1)
      expect(context.edges).toHaveLength(1)
    })

    it('should reset all state', () => {
      context.initialize([createMockNode('node1')], [], setNodes, setEdges, false)
      context.copyNodes(['node1'])
      context.addNode('GainNode', { x: 0, y: 0 })

      context.reset()

      expect(context.nodes).toHaveLength(0)
      expect(context.edges).toHaveLength(0)
      expect(context.canPaste).toBe(false)
      expect(context.undoManager.canUndo).toBe(false)
    })
  })
})
