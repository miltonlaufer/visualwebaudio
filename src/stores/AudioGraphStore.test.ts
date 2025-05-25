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
      expect(mockAudioContext.resume).toHaveBeenCalled()

      await store.togglePlayback()
      expect(store.isPlaying).toBe(false)
      expect(mockAudioContext.suspend).toHaveBeenCalled()
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
})
