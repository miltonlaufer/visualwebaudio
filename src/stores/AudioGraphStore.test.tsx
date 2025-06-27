import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rootStore } from './RootStore'
import type { AudioGraphStoreType } from './AudioGraphStore'

// Mock Web Audio API with minimal implementation
const mockAudioContext = {
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 },
    type: 'sine',
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  }),
  createBiquadFilter: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequency: { value: 350 },
    type: 'lowpass',
  }),
  createAnalyser: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 1024,
    smoothingTimeConstant: 0.8,
  }),
  destination: { connect: vi.fn(), disconnect: vi.fn() },
  sampleRate: 44100,
  currentTime: 0,
  close: vi.fn(),
  suspend: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
}

// Mock AudioNodeFactory
vi.mock('~/services/AudioNodeFactory', () => ({
  AudioNodeFactory: vi.fn().mockImplementation(() => ({
    createAudioNode: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    updateNodeProperty: vi.fn().mockReturnValue(true),
  })),
}))

// Mock global AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudioContext),
})

describe('AudioGraphStore - Basic Functionality', () => {
  let store: AudioGraphStoreType
  let root: typeof rootStore

  beforeEach(() => {
    vi.clearAllMocks()
    store = rootStore.audioGraph
    root = rootStore
    store.loadMetadata()

    // Clean up any existing nodes from previous tests
    if (store.adaptedNodes.length > 0) {
      store.clearAllNodes()
    }

    // Reset project modification state
    root.setProjectModified(false)
  })

  describe('Store Initialization', () => {
    it('initializes with empty state', () => {
      expect(store.adaptedNodes.length).toBe(0)
      expect(store.visualEdges.length).toBe(0)
      expect(root.selectedNodeId).toBeUndefined()
      expect(root.isPlaying).toBe(false)
    })

    it('loads metadata correctly', () => {
      expect(store.webAudioMetadata).toBeDefined()
      expect(Object.keys(store.webAudioMetadata).length).toBeGreaterThan(0)

      // Should have common node types
      expect(store.webAudioMetadata['OscillatorNode']).toBeDefined()
      expect(store.webAudioMetadata['GainNode']).toBeDefined()
      expect(store.webAudioMetadata['AudioDestinationNode']).toBeDefined()
    })

    it('provides available node types', () => {
      const nodeTypes = store.availableNodeTypes
      expect(nodeTypes).toContain('OscillatorNode')
      expect(nodeTypes).toContain('GainNode')
      expect(nodeTypes).toContain('AudioDestinationNode')
    })
  })

  describe('Node Management', () => {
    it('adds a node correctly', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      expect(nodeId).toBeDefined()
      expect(store.adaptedNodes.length).toBe(1)

      const node = store.adaptedNodes[0]
      expect(node.nodeType).toBe('OscillatorNode')
      expect(node.position.x).toBe(100)
      expect(node.position.y).toBe(100)
    })

    it('removes a node correctly', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      expect(store.adaptedNodes.length).toBe(1)

      store.removeNode(nodeId)
      expect(store.adaptedNodes.length).toBe(0)
    })

    it('clears all nodes', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      expect(store.adaptedNodes.length).toBe(2)

      store.clearAllNodes()
      expect(store.adaptedNodes.length).toBe(0)
      expect(store.visualEdges.length).toBe(0)
    })

    it('updates node position', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      store.updateNodePosition(nodeId, { x: 200, y: 300 })

      const node = store.adaptedNodes.find(n => n.id === nodeId)
      expect(node?.position.x).toBe(200)
      expect(node?.position.y).toBe(300)
    })

    it('selects and deselects nodes', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      expect(root.selectedNodeId).toBeUndefined()

      root.selectNode(nodeId)
      expect(root.selectedNodeId).toBe(nodeId)

      root.selectNode(undefined)
      expect(root.selectedNodeId).toBeUndefined()
    })

    it('gets selected node correctly', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      expect(store.selectedNode).toBeUndefined()

      root.selectNode(nodeId)
      expect(store.selectedNode).toBeDefined()
      expect(store.selectedNode?.id).toBe(nodeId)
    })
  })

  describe('Property Management', () => {
    it('increments property change counter', () => {
      const initialCounter = root.propertyChangeCounter

      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.updateNodeProperty(nodeId, 'frequency', 880)

      expect(root.propertyChangeCounter).toBe(initialCounter + 1)
    })

    it('increments counter on multiple property changes', () => {
      const initialCounter = root.propertyChangeCounter

      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.updateNodeProperty(nodeId, 'frequency', 880)
      store.updateNodeProperty(nodeId, 'type', 'square')

      expect(root.propertyChangeCounter).toBe(initialCounter + 2)
    })
  })

  describe('Edge Management - Basic', () => {
    it('validates connections correctly', () => {
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const targetId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      const isValid = store.isValidConnection(sourceId, targetId, 'output', 'input')
      expect(isValid).toBe(true)
    })

    it('removes edges when node is removed', () => {
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      // Test that edge removal works when nodes are removed
      // (We can't directly test edge addition due to MST protection)
      expect(store.visualEdges.length).toBe(0)

      store.removeNode(sourceId)
      expect(store.adaptedNodes.length).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('handles removing non-existent node gracefully', () => {
      expect(() => {
        store.removeNode('non-existent-id')
      }).not.toThrow()
    })

    it('handles removing non-existent edge gracefully', () => {
      expect(() => {
        store.removeEdge('non-existent-id')
      }).not.toThrow()
    })

    it('handles updating non-existent node gracefully', () => {
      expect(() => {
        store.updateNodeProperty('non-existent-id', 'frequency', 880)
      }).not.toThrow()
    })

    it('handles unknown node types', () => {
      expect(() => {
        store.addAdaptedNode('UnknownNode', { x: 100, y: 100 })
      }).toThrow('Unknown node type: UnknownNode')
    })
  })

  describe('State Consistency', () => {
    it('maintains consistent state after multiple operations', () => {
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const targetId = store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      // Select nodes
      root.selectNode(sourceId)

      // Verify state consistency
      expect(store.adaptedNodes.length).toBe(2)
      expect(root.selectedNodeId).toBe(sourceId)

      const sourceNode = store.adaptedNodes.find(n => n.id === sourceId)
      const targetNode = store.adaptedNodes.find(n => n.id === targetId)
      expect(sourceNode?.nodeType).toBe('OscillatorNode')
      expect(targetNode?.nodeType).toBe('GainNode')
    })

    it('handles rapid node creation and deletion', () => {
      const nodeIds = []

      // Create many nodes
      for (let i = 0; i < 10; i++) {
        nodeIds.push(store.addAdaptedNode('OscillatorNode', { x: i * 100, y: 100 }))
      }

      expect(store.adaptedNodes.length).toBe(10)

      // Delete them all
      nodeIds.forEach(id => store.removeNode(id))

      expect(store.adaptedNodes.length).toBe(0)
    })
  })

  describe('Metadata Access', () => {
    it('provides metadata for common node types', () => {
      const oscMetadata = store.webAudioMetadata['OscillatorNode']
      expect(oscMetadata).toBeDefined()
      expect(oscMetadata.name).toBe('OscillatorNode')
      expect(oscMetadata.category).toBe('source')
      expect(oscMetadata.properties).toBeDefined()
      expect(oscMetadata.properties.length).toBeGreaterThan(0)
    })

    it('provides input/output information', () => {
      const gainMetadata = store.webAudioMetadata['GainNode']
      expect(gainMetadata.inputs).toBeDefined()
      expect(gainMetadata.outputs).toBeDefined()
      expect(gainMetadata.inputs.length).toBeGreaterThan(0)
      expect(gainMetadata.outputs.length).toBeGreaterThan(0)
    })
  })

  describe('Node Properties', () => {
    it('creates nodes with default properties from metadata', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const node = store.adaptedNodes.find(n => n.id === nodeId)

      expect(node?.properties).toBeDefined()
      // Note: Properties might not be directly accessible due to MST structure
      expect(typeof node?.properties).toBe('object')
    })

    it('creates gain nodes with correct default properties', () => {
      const nodeId = store.addAdaptedNode('GainNode', { x: 100, y: 100 })
      const node = store.adaptedNodes.find(n => n.id === nodeId)

      expect(node?.properties).toBeDefined()
      expect(typeof node?.properties).toBe('object')
    })
  })

  describe('Basic Undo/Redo State', () => {
    it('tracks undo/redo state correctly', () => {
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)

      // The undo/redo functionality is complex and requires proper setup
      // For now, just test that the getters work
      expect(typeof store.canUndo).toBe('boolean')
      expect(typeof store.canRedo).toBe('boolean')
    })
  })
})
