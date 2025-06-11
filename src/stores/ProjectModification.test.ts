import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAudioGraphStore } from './AudioGraphStore'
import type { AudioGraphStoreType } from './AudioGraphStore'

// Mock Web Audio API
const createMockAudioNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  frequency: { value: 440 },
  gain: { value: 1 },
})

const mockAudioContext = {
  createOscillator: vi.fn(() => ({
    ...createMockAudioNode(),
    frequency: { value: 440 },
    detune: { value: 0 },
    type: 'sine',
  })),
  createGain: vi.fn(() => ({
    ...createMockAudioNode(),
    gain: { value: 1 },
  })),
  createBiquadFilter: vi.fn(() => createMockAudioNode()),
  createDelay: vi.fn(() => createMockAudioNode()),
  createAnalyser: vi.fn(() => createMockAudioNode()),
  createDynamicsCompressor: vi.fn(() => createMockAudioNode()),
  createStereoPanner: vi.fn(() => createMockAudioNode()),
  createChannelSplitter: vi.fn(() => createMockAudioNode()),
  createChannelMerger: vi.fn(() => createMockAudioNode()),
  createConvolver: vi.fn(() => createMockAudioNode()),
  createWaveShaper: vi.fn(() => createMockAudioNode()),
  createBufferSource: vi.fn(() => createMockAudioNode()),
  destination: createMockAudioNode(),
  resume: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  state: 'running' as AudioContextState,
}

// Mock AudioContext constructor
const MockAudioContext = vi.fn(() => mockAudioContext)
;(globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext

describe('AudioGraphStore - Project Modification Tracking', () => {
  let store: AudioGraphStoreType

  beforeEach(() => {
    store = createAudioGraphStore()
    store.loadMetadata()
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should initialize with isProjectModified as false', () => {
      expect(store.isProjectModified).toBe(false)
    })
  })

  describe('setProjectModified Action', () => {
    it('should set isProjectModified to true', () => {
      store.setProjectModified(true)
      expect(store.isProjectModified).toBe(true)
    })

    it('should set isProjectModified to false', () => {
      store.setProjectModified(true)
      store.setProjectModified(false)
      expect(store.isProjectModified).toBe(false)
    })
  })

  describe('markProjectModified Action', () => {
    it('should mark project as modified', () => {
      store.markProjectModified()
      expect(store.isProjectModified).toBe(true)
    })
  })

  describe('Automatic Modification Tracking', () => {
    it('should mark project as modified when adding a node', () => {
      expect(store.isProjectModified).toBe(false)

      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      expect(store.isProjectModified).toBe(true)
    })

    it('should mark project as modified when removing a node', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.setProjectModified(false) // Reset

      store.removeNode(nodeId)

      expect(store.isProjectModified).toBe(true)
    })

    it('should mark project as modified when adding an edge', () => {
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const targetId = store.addAdaptedNode('AudioDestinationNode', { x: 200, y: 100 })
      store.setProjectModified(false) // Reset

      store.addEdge(sourceId, targetId)

      expect(store.isProjectModified).toBe(true)
    })

    it('should mark project as modified when removing an edge', () => {
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const targetId = store.addAdaptedNode('AudioDestinationNode', { x: 200, y: 100 })
      store.addEdge(sourceId, targetId)
      store.setProjectModified(false) // Reset

      const edgeId = `${sourceId}-${targetId}-output-input`
      store.removeEdge(edgeId)

      expect(store.isProjectModified).toBe(true)
    })

    it('should mark project as modified when updating node property', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.setProjectModified(false) // Reset

      store.updateNodeProperty(nodeId, 'frequency', 880)

      expect(store.isProjectModified).toBe(true)
    })

    it('should mark project as modified when updating node position', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.setProjectModified(false) // Reset

      store.updateNodePosition(nodeId, { x: 200, y: 200 })

      expect(store.isProjectModified).toBe(true)
    })
  })

  describe('Operations that should NOT mark project as modified', () => {
    it('should not mark project as modified when selecting a node', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.setProjectModified(false) // Reset

      store.selectNode(nodeId)

      expect(store.isProjectModified).toBe(false)
    })

    it('should not mark project as modified when toggling playback', async () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.setProjectModified(false) // Reset

      await store.togglePlayback()

      expect(store.isProjectModified).toBe(false)
    })

    it('should not mark project as modified when undoing/redoing', async () => {
      // Add a node to create undo history
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      store.setProjectModified(false) // Reset

      store.undo()

      expect(store.isProjectModified).toBe(false)
    })

    it('should not mark project as modified during clearAllNodes operation', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.setProjectModified(false) // Reset

      store.clearAllNodes()

      expect(store.isProjectModified).toBe(false)
    })

    it('should not mark project as modified when changing play state automatically', () => {
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const targetId = store.addAdaptedNode('AudioDestinationNode', { x: 200, y: 100 })
      store.setProjectModified(false) // Reset

      // This should mark as modified due to edge addition
      store.addEdge(sourceId, targetId)

      // The edge addition should mark as modified
      expect(store.isProjectModified).toBe(true)
      // In test mode, isPlaying doesn't auto-start
      expect(store.isPlaying).toBe(false)

      store.setProjectModified(false) // Reset to test the disconnect

      // This should mark as modified due to edge removal
      const edgeId = `${sourceId}-${targetId}-output-input`
      store.removeEdge(edgeId)

      // The edge removal should mark as modified
      expect(store.isProjectModified).toBe(true)
      expect(store.isPlaying).toBe(false)
    })
  })

  describe('clearAllNodes behavior with modification tracking', () => {
    it('should reset isProjectModified to false when clearing all nodes', () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      expect(store.isProjectModified).toBe(true)

      store.clearAllNodes()

      expect(store.isProjectModified).toBe(false)
      expect(store.adaptedNodes.length).toBe(0)
    })

    it('should not mark project as modified during clearAllNodes even with multiple operations', () => {
      // Add multiple nodes and edges
      const node1 = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const node2 = store.addAdaptedNode('GainNode', { x: 200, y: 100 })
      const node3 = store.addAdaptedNode('AudioDestinationNode', { x: 300, y: 100 })
      store.addEdge(node1, node2)
      store.addEdge(node2, node3)

      expect(store.isProjectModified).toBe(true)

      // The clearAllNodes operation should not mark as modified during the clearing process
      store.clearAllNodes()

      expect(store.isProjectModified).toBe(false)
      expect(store.adaptedNodes.length).toBe(0)
      expect(store.visualEdges.length).toBe(0)
    })
  })

  describe('Patch middleware exclusions', () => {
    it('should not record patches for property change counter', async () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      const initialUndoLength = store.undoStack.length
      store.setProjectModified(false) // Reset

      // Update property which increments the counter
      store.updateNodeProperty(nodeId, 'frequency', 880)

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      // Should have recorded the property change but not the counter increment
      expect(store.undoStack.length).toBe(initialUndoLength + 1)
      expect(store.isProjectModified).toBe(true)
    })

    it('should not record patches for graph change counter', async () => {
      // Wait for initial patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      const initialUndoLength = store.undoStack.length
      store.setProjectModified(false) // Reset

      // Add node which increments the graph counter
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      // Should have recorded the node addition but not the counter increment
      expect(store.undoStack.length).toBe(initialUndoLength + 1)
      expect(store.isProjectModified).toBe(true)
    })

    it('should not record patches for isProjectModified changes', async () => {
      // Add a node to create some history
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      const initialUndoLength = store.undoStack.length

      // Manually change isProjectModified multiple times
      store.setProjectModified(true)
      store.setProjectModified(false)
      store.markProjectModified()
      store.setProjectModified(false)

      // Wait for potential patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      // No patches should be recorded for isProjectModified changes
      expect(store.undoStack.length).toBe(initialUndoLength)
    })
  })
})
