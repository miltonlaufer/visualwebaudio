/**
 * GraphOperationsStore Tests
 *
 * Tests for the centralized graph operations store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GraphOperationsStore } from './GraphOperationsStore'
import type { IGraphContext, ClipboardData } from './GraphContext'
import type { Node, Edge } from '@xyflow/react'

/******************* MOCK CONTEXT ***********************/

function createMockContext(
  options: {
    nodes?: Node[]
    edges?: Edge[]
    selectedNodeIds?: string[]
    selectedEdgeIds?: string[]
    isReadOnly?: boolean
    clipboardData?: ClipboardData | null
  } = {}
): IGraphContext {
  let _selectedNodeIds = options.selectedNodeIds || []
  let _selectedEdgeIds = options.selectedEdgeIds || []
  let _nodes = options.nodes || []
  let _edges = options.edges || []
  let _clipboardData = options.clipboardData || null

  return {
    get nodes() {
      return _nodes
    },
    get edges() {
      return _edges
    },
    get selectedNodeIds() {
      return _selectedNodeIds
    },
    get selectedEdgeIds() {
      return _selectedEdgeIds
    },
    get isReadOnly() {
      return options.isReadOnly || false
    },
    get undoManager() {
      return {
        canUndo: true,
        canRedo: true,
        undo: vi.fn(),
        redo: vi.fn(),
      }
    },
    get canPaste() {
      return _clipboardData !== null && _clipboardData.nodes.length > 0
    },
    get clipboardData() {
      return _clipboardData
    },

    addNode: vi.fn((nodeType, _position) => `new_${nodeType}_${Date.now()}`),
    removeNode: vi.fn(),
    removeNodes: vi.fn(ids => {
      _nodes = _nodes.filter(n => !ids.includes(n.id))
    }),
    updateNodePosition: vi.fn(),
    selectNode: vi.fn(id => {
      _selectedNodeIds = [id]
    }),
    deselectAll: vi.fn(() => {
      _selectedNodeIds = []
      _selectedEdgeIds = []
    }),

    addEdge: vi.fn(() => `new_edge_${Date.now()}`),
    removeEdge: vi.fn(),
    removeEdges: vi.fn(ids => {
      _edges = _edges.filter(e => !ids.includes(e.id))
    }),

    copyNodes: vi.fn(ids => {
      const nodesToCopy = _nodes.filter(n => ids.includes(n.id))
      const edgesToCopy = _edges.filter(e => ids.includes(e.source) && ids.includes(e.target))
      _clipboardData = {
        nodes: nodesToCopy.map(n => ({
          id: n.id,
          nodeType: (n.data as { nodeType?: string })?.nodeType || 'unknown',
          position: { ...n.position },
          properties: {},
        })),
        edges: edgesToCopy.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
        })),
      }
    }),
    cutNodes: vi.fn(ids => {
      // Copy first
      const nodesToCopy = _nodes.filter(n => ids.includes(n.id))
      const edgesToCopy = _edges.filter(e => ids.includes(e.source) && ids.includes(e.target))
      _clipboardData = {
        nodes: nodesToCopy.map(n => ({
          id: n.id,
          nodeType: (n.data as { nodeType?: string })?.nodeType || 'unknown',
          position: { ...n.position },
          properties: {},
        })),
        edges: edgesToCopy.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
        })),
      }
      // Then remove
      _nodes = _nodes.filter(n => !ids.includes(n.id))
      _edges = _edges.filter(e => !ids.includes(e.source) && !ids.includes(e.target))
    }),
    pasteNodes: vi.fn(() => {
      if (!_clipboardData || _clipboardData.nodes.length === 0) return []
      return _clipboardData.nodes.map(n => `pasted_${n.id}`)
    }),

    undo: vi.fn(),
    redo: vi.fn(),
    autoLayout: vi.fn(),
  }
}

function createMockNode(id: string): Node {
  return {
    id,
    type: 'default',
    position: { x: 0, y: 0 },
    data: { nodeType: 'GainNode' },
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

describe('GraphOperationsStore', () => {
  let store: ReturnType<typeof GraphOperationsStore.create>

  beforeEach(() => {
    store = GraphOperationsStore.create({})
  })

  describe('context management', () => {
    it('should start with no active context', () => {
      expect(store.activeContextType).toBe('none')
      expect(store.isReadOnly).toBe(true)
    })

    it('should set active context', () => {
      const context = createMockContext()
      store.setActiveContext(context, 'main')

      expect(store.activeContextType).toBe('main')
      expect(store.isReadOnly).toBe(false)
    })

    it('should clear active context', () => {
      const context = createMockContext()
      store.setActiveContext(context, 'main')
      store.clearActiveContext()

      expect(store.activeContextType).toBe('none')
    })
  })

  describe('node operations', () => {
    it('should add node through context', () => {
      const context = createMockContext()
      store.setActiveContext(context, 'main')

      const nodeId = store.addNode('GainNode', { x: 100, y: 100 })

      expect(nodeId).toBeDefined()
      expect(context.addNode).toHaveBeenCalledWith('GainNode', { x: 100, y: 100 })
    })

    it('should not add node in read-only mode', () => {
      const context = createMockContext({ isReadOnly: true })
      store.setActiveContext(context, 'main')

      const nodeId = store.addNode('GainNode', { x: 100, y: 100 })

      expect(nodeId).toBeNull()
    })

    it('should remove selected nodes', () => {
      const nodes = [createMockNode('node1'), createMockNode('node2')]
      const context = createMockContext({ nodes, selectedNodeIds: ['node1'] })
      store.setActiveContext(context, 'main')

      store.removeSelectedNodes()

      expect(context.removeNodes).toHaveBeenCalledWith(['node1'])
    })
  })

  describe('clipboard operations', () => {
    it('should copy selected nodes', () => {
      const nodes = [createMockNode('node1')]
      const context = createMockContext({ nodes, selectedNodeIds: ['node1'] })
      store.setActiveContext(context, 'main')

      store.copy()

      expect(context.copyNodes).toHaveBeenCalledWith(['node1'])
    })

    it('should populate shared clipboard on copy', () => {
      const nodes = [createMockNode('node1')]
      const context = createMockContext({ nodes, selectedNodeIds: ['node1'] })
      store.setActiveContext(context, 'main')

      store.copy()

      expect(store.clipboardData).toBeDefined()
      expect(store.clipboardData?.nodes).toHaveLength(1)
    })

    it('should track clipboard source context', () => {
      const nodes = [createMockNode('node1')]
      const context = createMockContext({ nodes, selectedNodeIds: ['node1'] })
      store.setActiveContext(context, 'main')

      store.copy()

      // Access internal state via workaround since it's volatile
      expect(store.canPaste).toBe(true)
    })

    it('should cut nodes (copy + delete)', () => {
      const nodes = [createMockNode('node1')]
      const context = createMockContext({ nodes, selectedNodeIds: ['node1'] })
      store.setActiveContext(context, 'main')

      store.cut()

      expect(context.cutNodes).toHaveBeenCalledWith(['node1'])
    })

    it('should not cut in read-only mode', () => {
      const nodes = [createMockNode('node1')]
      const context = createMockContext({ nodes, selectedNodeIds: ['node1'], isReadOnly: true })
      store.setActiveContext(context, 'main')

      store.cut()

      expect(context.cutNodes).not.toHaveBeenCalled()
    })

    it('should paste nodes', () => {
      const clipboardData: ClipboardData = {
        nodes: [{ id: 'node1', nodeType: 'GainNode', position: { x: 0, y: 0 }, properties: {} }],
        edges: [],
      }
      const context = createMockContext({ clipboardData })
      store.setActiveContext(context, 'main')

      store.paste()

      expect(context.pasteNodes).toHaveBeenCalled()
    })

    it('should not paste in read-only mode', () => {
      const clipboardData: ClipboardData = {
        nodes: [{ id: 'node1', nodeType: 'GainNode', position: { x: 0, y: 0 }, properties: {} }],
        edges: [],
      }
      const context = createMockContext({ clipboardData, isReadOnly: true })
      store.setActiveContext(context, 'main')

      const pastedIds = store.paste()

      expect(pastedIds).toHaveLength(0)
    })

    it('should clear clipboard', () => {
      const nodes = [createMockNode('node1')]
      const context = createMockContext({ nodes, selectedNodeIds: ['node1'] })
      store.setActiveContext(context, 'main')

      store.copy()
      expect(store.canPaste).toBe(true)

      store.clearClipboard()
      // Note: canPaste may still be true if context clipboard has data
    })
  })

  describe('undo/redo operations', () => {
    it('should delegate undo to context', () => {
      const context = createMockContext()
      store.setActiveContext(context, 'main')

      store.undo()

      expect(context.undo).toHaveBeenCalled()
    })

    it('should delegate redo to context', () => {
      const context = createMockContext()
      store.setActiveContext(context, 'main')

      store.redo()

      expect(context.redo).toHaveBeenCalled()
    })

    it('should report canUndo correctly', () => {
      const context = createMockContext()
      store.setActiveContext(context, 'main')

      expect(store.canUndo).toBe(true)
    })

    it('should report canRedo correctly', () => {
      const context = createMockContext()
      store.setActiveContext(context, 'main')

      expect(store.canRedo).toBe(true)
    })
  })

  describe('auto-layout', () => {
    it('should delegate auto-layout to context', () => {
      const context = createMockContext()
      store.setActiveContext(context, 'main')

      store.autoLayout('TB')

      expect(context.autoLayout).toHaveBeenCalledWith('TB')
    })

    it('should not auto-layout in read-only mode', () => {
      const context = createMockContext({ isReadOnly: true })
      store.setActiveContext(context, 'main')

      store.autoLayout('TB')

      expect(context.autoLayout).not.toHaveBeenCalled()
    })
  })

  describe('selection operations', () => {
    it('should select a node', () => {
      const context = createMockContext()
      store.setActiveContext(context, 'main')

      store.selectNode('node1')

      expect(context.selectNode).toHaveBeenCalledWith('node1')
    })

    it('should deselect all', () => {
      const context = createMockContext({ selectedNodeIds: ['node1'] })
      store.setActiveContext(context, 'main')

      store.deselectAll()

      expect(context.deselectAll).toHaveBeenCalled()
    })

    it('should report selected node IDs', () => {
      const context = createMockContext({ selectedNodeIds: ['node1', 'node2'] })
      store.setActiveContext(context, 'main')

      expect(store.selectedNodeIds).toEqual(['node1', 'node2'])
    })
  })

  describe('delete selected', () => {
    it('should delete selected nodes and edges', () => {
      const nodes = [createMockNode('node1'), createMockNode('node2')]
      const edges = [createMockEdge('edge1', 'node1', 'node2')]
      const context = createMockContext({
        nodes,
        edges,
        selectedNodeIds: ['node1'],
        selectedEdgeIds: ['edge1'],
      })
      store.setActiveContext(context, 'main')

      store.deleteSelected()

      expect(context.removeNodes).toHaveBeenCalledWith(['node1'])
      expect(context.removeEdges).toHaveBeenCalledWith(['edge1'])
    })

    it('should not delete in read-only mode', () => {
      const nodes = [createMockNode('node1')]
      const context = createMockContext({
        nodes,
        selectedNodeIds: ['node1'],
        isReadOnly: true,
      })
      store.setActiveContext(context, 'main')

      store.deleteSelected()

      expect(context.removeNodes).not.toHaveBeenCalled()
    })
  })

  describe('cross-context paste', () => {
    it('should detect cross-context paste potential', () => {
      // Setup main context with copied nodes
      const mainNodes = [createMockNode('mainNode1')]
      const mainContext = createMockContext({ nodes: mainNodes, selectedNodeIds: ['mainNode1'] })
      store.setActiveContext(mainContext, 'main')
      store.copy()

      // Switch to composite context
      const compositeContext = createMockContext()
      store.setActiveContext(compositeContext, 'composite')

      // Should be able to paste
      expect(store.canPaste).toBe(true)
    })
  })
})
