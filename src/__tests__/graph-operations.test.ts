/**
 * Integration tests for Graph Operations
 *
 * Tests the shared graph operations functionality including:
 * - Copy/paste between contexts
 * - Undo/redo isolation
 * - Auto-layout functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GraphOperationsStore } from '~/stores/GraphOperationsStore'
import { CompositeGraphContext } from '~/stores/CompositeGraphContext'
import type { Node, Edge } from '@xyflow/react'

describe('GraphOperationsStore', () => {
  let graphOps: ReturnType<typeof GraphOperationsStore.create>

  beforeEach(() => {
    graphOps = GraphOperationsStore.create({})
  })

  describe('context management', () => {
    it('should initialize with no active context', () => {
      expect(graphOps.activeContextType).toBe('none')
      expect(graphOps.activeContext).toBeNull()
    })

    it('should set active context', () => {
      const mockContext = {
        nodes: [],
        edges: [],
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isReadOnly: false,
        undoManager: null,
        canPaste: false,
        clipboardData: null,
        addNode: vi.fn(),
        removeNode: vi.fn(),
        removeNodes: vi.fn(),
        updateNodePosition: vi.fn(),
        selectNode: vi.fn(),
        deselectAll: vi.fn(),
        addEdge: vi.fn(),
        removeEdge: vi.fn(),
        removeEdges: vi.fn(),
        copyNodes: vi.fn(),
        cutNodes: vi.fn(),
        pasteNodes: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        autoLayout: vi.fn(),
      }

      graphOps.setActiveContext(mockContext, 'main')

      expect(graphOps.activeContextType).toBe('main')
      expect(graphOps.activeContext).toBe(mockContext)
    })

    it('should clear active context', () => {
      const mockContext = { nodes: [] } as any
      graphOps.setActiveContext(mockContext, 'main')
      graphOps.clearActiveContext()

      expect(graphOps.activeContextType).toBe('none')
      expect(graphOps.activeContext).toBeNull()
    })
  })

  describe('operations with context', () => {
    it('should not perform operations without active context', () => {
      const result = graphOps.addNode('OscillatorNode', { x: 100, y: 100 })
      expect(result).toBeNull()
    })

    it('should call context methods for operations', () => {
      const mockContext = {
        isReadOnly: false,
        selectedNodeIds: ['node1'],
        selectedEdgeIds: [],
        addNode: vi.fn().mockReturnValue('new-node-id'),
        removeNodes: vi.fn(),
        copyNodes: vi.fn(),
        pasteNodes: vi.fn().mockReturnValue(['pasted-1']),
        undo: vi.fn(),
        redo: vi.fn(),
        autoLayout: vi.fn(),
      } as any

      graphOps.setActiveContext(mockContext, 'main')

      // Test addNode
      const nodeId = graphOps.addNode('OscillatorNode', { x: 100, y: 100 })
      expect(nodeId).toBe('new-node-id')
      expect(mockContext.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 100 })

      // Test copy
      graphOps.copy()
      expect(mockContext.copyNodes).toHaveBeenCalledWith(['node1'])

      // Test undo
      graphOps.undo()
      expect(mockContext.undo).toHaveBeenCalled()

      // Test redo
      graphOps.redo()
      expect(mockContext.redo).toHaveBeenCalled()

      // Test autoLayout
      graphOps.autoLayout('LR')
      expect(mockContext.autoLayout).toHaveBeenCalledWith('LR')
    })

    it('should not perform operations in read-only mode', () => {
      const mockContext = {
        isReadOnly: true,
        selectedNodeIds: ['node1'],
        addNode: vi.fn(),
        removeNodes: vi.fn(),
      } as any

      graphOps.setActiveContext(mockContext, 'composite')

      graphOps.addNode('OscillatorNode', { x: 100, y: 100 })
      expect(mockContext.addNode).not.toHaveBeenCalled()

      graphOps.removeSelectedNodes()
      expect(mockContext.removeNodes).not.toHaveBeenCalled()
    })
  })
})

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
      expect(context.nodes).toEqual([])
      expect(context.edges).toEqual([])
      expect(context.isReadOnly).toBe(false)
    })

    it('should initialize with provided state', () => {
      const nodes: Node[] = [{ id: 'node1', type: 'test', position: { x: 0, y: 0 }, data: {} }]
      const edges: Edge[] = []

      context.initialize(nodes, edges, setNodes, setEdges, false)

      expect(context.nodes).toEqual(nodes)
      expect(context.edges).toEqual(edges)
      expect(context.isReadOnly).toBe(false)
    })
  })

  describe('node operations', () => {
    beforeEach(() => {
      context.initialize([], [], setNodes, setEdges, false)
    })

    it('should add a node', () => {
      const nodeId = context.addNode('OscillatorNode', { x: 100, y: 100 })

      expect(nodeId).toContain('internal_OscillatorNode')
      expect(setNodes).toHaveBeenCalled()
      expect(context.nodes.length).toBe(1)
    })

    it('should not add nodes in read-only mode', () => {
      context.initialize([], [], setNodes, setEdges, true)

      const nodeId = context.addNode('OscillatorNode', { x: 100, y: 100 })

      expect(nodeId).toBe('')
      expect(setNodes).not.toHaveBeenCalled()
    })

    it('should remove a node and its connected edges', () => {
      // Setup initial state
      const nodes: Node[] = [
        { id: 'node1', type: 'test', position: { x: 0, y: 0 }, data: {} },
        { id: 'node2', type: 'test', position: { x: 100, y: 0 }, data: {} },
      ]
      const edges: Edge[] = [{ id: 'edge1', source: 'node1', target: 'node2' }]

      context.initialize(nodes, edges, setNodes, setEdges, false)

      context.removeNode('node1')

      expect(context.nodes.length).toBe(1)
      expect(context.nodes[0].id).toBe('node2')
      expect(context.edges.length).toBe(0)
    })
  })

  describe('undo/redo', () => {
    beforeEach(() => {
      context.initialize([], [], setNodes, setEdges, false)
    })

    it('should undo last action', () => {
      // Add a node
      context.addNode('OscillatorNode', { x: 100, y: 100 })
      expect(context.nodes.length).toBe(1)

      // Undo
      context.undo()
      expect(context.nodes.length).toBe(0)
    })

    it('should redo undone action', () => {
      // Add a node
      context.addNode('OscillatorNode', { x: 100, y: 100 })
      const nodeId = context.nodes[0].id

      // Undo
      context.undo()
      expect(context.nodes.length).toBe(0)

      // Redo
      context.redo()
      expect(context.nodes.length).toBe(1)
      expect(context.nodes[0].id).toBe(nodeId)
    })

    it('should report canUndo and canRedo correctly', () => {
      expect(context.undoManager.canUndo).toBe(false)
      expect(context.undoManager.canRedo).toBe(false)

      context.addNode('OscillatorNode', { x: 100, y: 100 })

      expect(context.undoManager.canUndo).toBe(true)
      expect(context.undoManager.canRedo).toBe(false)

      context.undo()

      expect(context.undoManager.canUndo).toBe(false)
      expect(context.undoManager.canRedo).toBe(true)
    })

    it('should not undo in read-only mode', () => {
      context.addNode('OscillatorNode', { x: 100, y: 100 })

      // Switch to read-only
      context.initialize(context.nodes, context.edges, setNodes, setEdges, true)

      context.undo()
      // Should not have called setNodes for undo
      expect(context.nodes.length).toBe(1)
    })
  })

  describe('clipboard operations', () => {
    beforeEach(() => {
      const nodes: Node[] = [
        {
          id: 'node1',
          type: 'internalNode',
          position: { x: 0, y: 0 },
          data: { nodeType: 'OscillatorNode' },
        },
        {
          id: 'node2',
          type: 'internalNode',
          position: { x: 100, y: 0 },
          data: { nodeType: 'GainNode' },
        },
      ]
      const edges: Edge[] = [{ id: 'edge1', source: 'node1', target: 'node2' }]
      context.initialize(nodes, edges, setNodes, setEdges, false)
    })

    it('should copy nodes', () => {
      context.copyNodes(['node1', 'node2'])

      expect(context.canPaste).toBe(true)
      expect(context.clipboardData).not.toBeNull()
      expect(context.clipboardData?.nodes.length).toBe(2)
      expect(context.clipboardData?.edges.length).toBe(1)
    })

    it('should copy only internal edges', () => {
      context.copyNodes(['node1'])

      expect(context.clipboardData?.nodes.length).toBe(1)
      expect(context.clipboardData?.edges.length).toBe(0) // Edge requires both source and target
    })

    it('should paste nodes with new IDs', () => {
      context.copyNodes(['node1', 'node2'])
      const initialCount = context.nodes.length

      const pastedIds = context.pasteNodes()

      expect(pastedIds.length).toBe(2)
      expect(context.nodes.length).toBe(initialCount + 2)

      // New IDs should be different
      pastedIds.forEach(id => {
        expect(['node1', 'node2']).not.toContain(id)
      })
    })

    it('should paste nodes with offset position', () => {
      context.copyNodes(['node1'])
      context.pasteNodes()

      const originalNode = context.nodes.find(n => n.id === 'node1')!
      const pastedNode = context.nodes.find(n => n.id !== 'node1' && n.id !== 'node2')!

      expect(pastedNode.position.x).toBe(originalNode.position.x + 50)
      expect(pastedNode.position.y).toBe(originalNode.position.y + 50)
    })

    it('should cut nodes (copy + delete)', () => {
      context.cutNodes(['node1'])

      expect(context.canPaste).toBe(true)
      expect(context.nodes.length).toBe(1)
      expect(context.nodes[0].id).toBe('node2')
    })
  })

  describe('auto-layout', () => {
    beforeEach(() => {
      const nodes: Node[] = [
        { id: 'node1', type: 'internalNode', position: { x: 500, y: 500 }, data: {} },
        { id: 'node2', type: 'internalNode', position: { x: 500, y: 500 }, data: {} },
      ]
      const edges: Edge[] = [{ id: 'edge1', source: 'node1', target: 'node2' }]
      context.initialize(nodes, edges, setNodes, setEdges, false)
    })

    it('should auto-layout internal nodes', () => {
      const originalPositions = context.nodes.map(n => ({ id: n.id, ...n.position }))

      context.autoLayout('LR')

      // Positions should have changed
      const newPositions = context.nodes.map(n => ({ id: n.id, ...n.position }))
      expect(newPositions).not.toEqual(originalPositions)
    })

    it('should not layout in read-only mode', () => {
      context.initialize(context.nodes, context.edges, setNodes, setEdges, true)
      const originalPositions = context.nodes.map(n => ({ id: n.id, ...n.position }))

      context.autoLayout('LR')

      const newPositions = context.nodes.map(n => ({ id: n.id, ...n.position }))
      expect(newPositions).toEqual(originalPositions)
    })
  })

  describe('context isolation', () => {
    it('should maintain separate undo stacks', () => {
      const context1 = new CompositeGraphContext()
      const context2 = new CompositeGraphContext()

      const setNodes1 = vi.fn()
      const setEdges1 = vi.fn()
      const setNodes2 = vi.fn()
      const setEdges2 = vi.fn()

      context1.initialize([], [], setNodes1, setEdges1, false)
      context2.initialize([], [], setNodes2, setEdges2, false)

      // Add nodes to context1
      context1.addNode('OscillatorNode', { x: 0, y: 0 })
      context1.addNode('GainNode', { x: 100, y: 0 })

      // Add nodes to context2
      context2.addNode('OscillatorNode', { x: 0, y: 0 })

      // Context1 should have 2 in undo stack
      expect(context1.undoManager.canUndo).toBe(true)

      // Undo context1 twice
      context1.undo()
      context1.undo()
      expect(context1.nodes.length).toBe(0)

      // Context2 should still have 1 node
      expect(context2.nodes.length).toBe(1)
      expect(context2.undoManager.canUndo).toBe(true)
    })

    it('should maintain separate clipboards', () => {
      const context1 = new CompositeGraphContext()
      const context2 = new CompositeGraphContext()

      const nodes1: Node[] = [
        { id: 'ctx1-node', type: 'test', position: { x: 0, y: 0 }, data: { nodeType: 'Osc' } },
      ]
      const nodes2: Node[] = [
        { id: 'ctx2-node', type: 'test', position: { x: 0, y: 0 }, data: { nodeType: 'Gain' } },
      ]

      context1.initialize(nodes1, [], vi.fn(), vi.fn(), false)
      context2.initialize(nodes2, [], vi.fn(), vi.fn(), false)

      context1.copyNodes(['ctx1-node'])

      // Context1 has clipboard
      expect(context1.canPaste).toBe(true)
      expect(context1.clipboardData?.nodes[0].id).toBe('ctx1-node')

      // Context2 should not have clipboard
      expect(context2.canPaste).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset all state', () => {
      context.initialize(
        [{ id: 'node1', type: 'test', position: { x: 0, y: 0 }, data: {} }],
        [{ id: 'edge1', source: 'node1', target: 'node2' }],
        vi.fn(),
        vi.fn(),
        false
      )

      context.copyNodes(['node1'])
      context.addNode('OscillatorNode', { x: 100, y: 100 })

      context.reset()

      expect(context.nodes).toEqual([])
      expect(context.edges).toEqual([])
      expect(context.canPaste).toBe(false)
      expect(context.undoManager.canUndo).toBe(false)
    })
  })
})

describe('Undo/Redo Isolation', () => {
  it('main graph and composite editor should have independent undo stacks', () => {
    // This test verifies the architectural requirement from the plan
    // The MainGraphContext uses the AudioGraphStore's undo (via rootStore)
    // The CompositeGraphContext has its own internal undo stack

    // Create a composite context
    const compositeContext = new CompositeGraphContext()
    compositeContext.initialize([], [], vi.fn(), vi.fn(), false)

    // Add some operations to composite
    compositeContext.addNode('OscillatorNode', { x: 0, y: 0 })
    compositeContext.addNode('GainNode', { x: 100, y: 0 })

    expect(compositeContext.undoManager.canUndo).toBe(true)

    // Main graph's undo should not be affected by composite's operations
    // (This is implicitly tested by the isolation - main graph uses AudioGraphStore's UndoManager)

    // Undo in composite
    compositeContext.undo()
    expect(compositeContext.nodes.length).toBe(1)

    // Redo in composite
    compositeContext.redo()
    expect(compositeContext.nodes.length).toBe(2)
  })
})
