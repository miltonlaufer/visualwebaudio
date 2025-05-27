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
}

// Mock AudioContext constructor
const MockAudioContext = vi.fn(() => mockAudioContext)
;(globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext

describe('AudioGraphStore', () => {
  let store: AudioGraphStoreType

  beforeEach(() => {
    store = createAudioGraphStore()
    store.loadMetadata()
    vi.clearAllMocks()
  })

  describe('Metadata Loading', () => {
    it('should load web audio metadata', () => {
      expect(Object.keys(store.webAudioMetadata)).toContain('OscillatorNode')
      expect(Object.keys(store.webAudioMetadata)).toContain('GainNode')
      expect(Object.keys(store.webAudioMetadata)).toContain('AudioDestinationNode')
    })

    it('should have correct metadata structure', () => {
      const oscMetadata = store.webAudioMetadata['OscillatorNode']
      expect(oscMetadata).toBeDefined()
      expect(oscMetadata.category).toBe('source')
      expect(oscMetadata.outputs).toHaveLength(1)
      expect(oscMetadata.properties).toContainEqual(expect.objectContaining({ name: 'frequency' }))
    })
  })

  describe('Node Management', () => {
    it('should add a node', () => {
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      expect(store.visualNodes).toHaveLength(1)
      expect(store.visualNodes[0].id).toBe(nodeId)
      expect(store.visualNodes[0].data.nodeType).toBe('OscillatorNode')
      expect(store.visualNodes[0].position).toEqual({ x: 100, y: 200 })
    })

    it('should create audio node when adding visual node', () => {
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      expect(mockAudioContext.createOscillator).toHaveBeenCalled()
      expect(store.audioNodes.has(nodeId)).toBe(true)
    })

    it('should remove a node', () => {
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      expect(store.visualNodes).toHaveLength(1)

      store.removeNode(nodeId)

      expect(store.visualNodes).toHaveLength(0)
      expect(store.audioNodes.has(nodeId)).toBe(false)
    })

    it('should update node position', () => {
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      store.updateNodePosition(nodeId, { x: 300, y: 400 })

      expect(store.visualNodes[0].position).toEqual({ x: 300, y: 400 })
    })

    it('should select and deselect nodes', () => {
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      store.selectNode(nodeId)
      expect(store.selectedNodeId).toBe(nodeId)
      expect(store.selectedNode).toBe(store.visualNodes[0])

      store.selectNode(undefined)
      expect(store.selectedNodeId).toBeUndefined()
      expect(store.selectedNode).toBeUndefined()
    })
  })

  describe('Edge Management', () => {
    let sourceNodeId: string
    let targetNodeId: string

    beforeEach(() => {
      sourceNodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })
      targetNodeId = store.addNode('GainNode', { x: 300, y: 200 })
    })

    it('should add an edge', () => {
      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')

      expect(store.visualEdges).toHaveLength(1)
      expect(store.visualEdges[0].source).toBe(sourceNodeId)
      expect(store.visualEdges[0].target).toBe(targetNodeId)
    })

    it('should create audio connection when adding edge', () => {
      const sourceAudioNode = store.audioNodes.get(sourceNodeId)

      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')

      expect(sourceAudioNode?.connect).toHaveBeenCalled()
    })

    it('should remove an edge', () => {
      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')
      const edgeId = store.visualEdges[0].id

      store.removeEdge(edgeId)

      expect(store.visualEdges).toHaveLength(0)
    })

    it('should remove edges when removing a node', () => {
      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')

      expect(store.visualEdges).toHaveLength(1)

      store.removeNode(sourceNodeId)

      expect(store.visualEdges).toHaveLength(0)
    })
  })

  describe('Undo/Redo Functionality', () => {
    it('should track undo/redo availability', () => {
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)

      store.addNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for patch recording
      return new Promise(resolve => {
        setTimeout(() => {
          expect(store.canUndo).toBe(true)
          expect(store.canRedo).toBe(false)
          resolve(undefined)
        }, 10)
      })
    })

    it('should undo node addition', async () => {
      store.addNode('OscillatorNode', { x: 100, y: 200 })

      expect(store.visualNodes).toHaveLength(1)

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      store.undo()

      expect(store.visualNodes).toHaveLength(0)
      expect(store.canRedo).toBe(true)
    })

    it('should redo node addition', async () => {
      store.addNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      store.undo()
      expect(store.visualNodes).toHaveLength(0)

      store.redo()
      expect(store.visualNodes).toHaveLength(1)
      expect(store.visualNodes[0].data.nodeType).toBe('OscillatorNode')
    })

    it('should undo edge addition', async () => {
      const sourceNodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })
      const targetNodeId = store.addNode('GainNode', { x: 300, y: 200 })

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')
      expect(store.visualEdges).toHaveLength(1)

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      store.undo()
      expect(store.visualEdges).toHaveLength(0)
    })

    it('should clear redo stack when new action is performed', async () => {
      store.addNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      store.undo()
      expect(store.canRedo).toBe(true)

      store.addNode('GainNode', { x: 300, y: 200 })

      // Wait for patch recording
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(store.canRedo).toBe(false)
    })

    it('should not record play/stop operations in undo history', async () => {
      // Add a node to create some initial history
      store.addNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for patches to be recorded
      await new Promise(resolve => setTimeout(resolve, 10))

      // Record initial undo stack length
      const initialUndoLength = store.undoStack.length
      expect(store.canUndo).toBe(true)

      // Toggle playback multiple times
      await store.togglePlayback() // Start
      await store.togglePlayback() // Stop
      await store.togglePlayback() // Start again
      await store.togglePlayback() // Stop again

      // Wait for any potential patches
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify that play/stop operations didn't add to undo history
      expect(store.undoStack.length).toBe(initialUndoLength)
      expect(store.canUndo).toBe(true) // Should still be able to undo the node addition
      expect(store.canRedo).toBe(false) // No redo history should be created

      // Verify that we can still undo the original node addition
      store.undo()
      expect(store.visualNodes.length).toBe(0)
    })

    it('should not record automatic play state changes in undo history', async () => {
      // Add oscillator and destination nodes
      const oscId = store.addNode('OscillatorNode', { x: 100, y: 100 })
      const destId = store.addNode('AudioDestinationNode', { x: 300, y: 100 })

      // Wait for patches to be recorded
      await new Promise(resolve => setTimeout(resolve, 10))

      // Record initial undo stack length
      const initialUndoLength = store.undoStack.length
      expect(store.canUndo).toBe(true)

      // Connect nodes (this should automatically set isPlaying to true)
      store.addEdge(oscId, destId, 'output', 'input')
      expect(store.isPlaying).toBe(true)

      // Wait for any potential patches
      await new Promise(resolve => setTimeout(resolve, 10))

      // Disconnect nodes (this should automatically set isPlaying to false)
      const edgeId = store.visualEdges[0].id
      store.removeEdge(edgeId)
      expect(store.isPlaying).toBe(false)

      // Wait for any potential patches
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify that automatic play state changes didn't add to undo history
      // Only the edge addition and removal should be recorded, not the play state changes
      expect(store.undoStack.length).toBe(initialUndoLength + 2) // +1 for edge add, +1 for edge remove
      expect(store.canUndo).toBe(true)
      expect(store.canRedo).toBe(false)
    })
  })

  describe('Audio Context Management', () => {
    it('should initialize audio context', () => {
      store.initializeAudioContext()
      expect(store.audioContext).toBeDefined()
    })

    it('should toggle playback', async () => {
      store.initializeAudioContext()

      expect(store.isPlaying).toBe(false)

      await store.togglePlayback()
      expect(store.isPlaying).toBe(true)
      // New implementation creates fresh audio context

      await store.togglePlayback()
      expect(store.isPlaying).toBe(false)
      // New implementation closes audio context
    })
  })

  describe('Property Management', () => {
    it('should update node properties', () => {
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      store.updateNodeProperty(nodeId, 'frequency', 880)

      const node = store.visualNodes[0]
      expect(node.data.properties.get('frequency')).toBe(880)

      const audioNode = store.audioNodes.get(nodeId) as unknown as { frequency: { value: number } }
      expect(audioNode.frequency.value).toBe(880)
    })
  })

  describe('AudioGraphStore - Undo/Redo History', () => {
    it('should clear undo/redo history when clearing all nodes', async () => {
      // Add some nodes to create history
      const nodeId1 = store.addNode('OscillatorNode', { x: 100, y: 100 })
      const nodeId2 = store.addNode('GainNode', { x: 200, y: 100 })

      // Wait for patches to be recorded
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify we have undo history
      expect(store.canUndo).toBe(true)
      expect(store.undoStack.length).toBeGreaterThan(0)

      // Add an edge to create more history
      store.addEdge(nodeId1, nodeId2, 'output', 'input')

      // Wait for patches to be recorded
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify we have more undo history
      expect(store.undoStack.length).toBeGreaterThan(1)

      // Perform an undo to create redo history
      store.undo()

      // Wait for undo to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify we have both undo and redo history
      expect(store.canUndo).toBe(true)
      expect(store.canRedo).toBe(true)
      expect(store.undoStack.length).toBeGreaterThan(0)
      expect(store.redoStack.length).toBeGreaterThan(0)

      // Clear all nodes
      store.clearAllNodes()

      // Verify that undo/redo history is cleared
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)
      expect(store.undoStack.length).toBe(0)
      expect(store.redoStack.length).toBe(0)

      // Verify nodes are actually cleared
      expect(store.visualNodes.length).toBe(0)
      expect(store.visualEdges.length).toBe(0)
    })

    it('should not record clearAllNodes operation in undo history', async () => {
      // Add a node
      store.addNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for patches to be recorded
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify we have undo history
      expect(store.canUndo).toBe(true)

      // Clear all nodes
      store.clearAllNodes()

      // Wait for any potential patches
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify that clearAllNodes itself didn't add to undo history
      // (since history was cleared, it should be 0)
      expect(store.undoStack.length).toBe(0)
      expect(store.redoStack.length).toBe(0)
    })

    it('should maintain clean state after clearing nodes and adding new ones', async () => {
      // Add some nodes and create history
      store.addNode('OscillatorNode', { x: 100, y: 100 })
      store.addNode('GainNode', { x: 200, y: 100 })

      // Wait for patches
      await new Promise(resolve => setTimeout(resolve, 10))

      // Clear all nodes (this clears history)
      store.clearAllNodes()

      // Add new nodes after clearing
      const newNodeId = store.addNode('DelayNode', { x: 300, y: 100 })

      // Wait for patches
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify we have a clean slate with new history
      expect(store.visualNodes.length).toBe(1)
      expect(store.visualNodes[0].id).toBe(newNodeId)
      expect(store.canUndo).toBe(true) // New action should be undoable
      expect(store.canRedo).toBe(false) // No redo history yet
    })
  })
})
