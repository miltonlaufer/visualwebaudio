import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAudioGraphStore } from '../stores/AudioGraphStore'
import type { AudioGraphStoreType } from '../stores/AudioGraphStore'

// Mock Web Audio API
const createMockAudioNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  frequency: { value: 440 },
  gain: { value: 1 },
  type: 'sine',
})

const mockAudioContext = {
  createOscillator: vi.fn(() => createMockAudioNode()),
  createGain: vi.fn(() => createMockAudioNode()),
  createAnalyser: vi.fn(() => createMockAudioNode()),
  destination: createMockAudioNode(),
  state: 'running' as AudioContextState,
  close: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve()),
  resume: vi.fn(() => Promise.resolve()),
}

// Mock AudioContext constructor
const MockAudioContext = vi.fn(() => mockAudioContext)
;(globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext

describe('Audio Bug Fix - Adding/Removing Unconnected Nodes', () => {
  let store: AudioGraphStoreType

  beforeEach(() => {
    vi.clearAllMocks()
    store = createAudioGraphStore()
  })

  it('should not disrupt existing audio when adding unconnected nodes', async () => {
    // Create a connected audio graph: Oscillator -> Gain -> Destination
    const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
    const gainId = store.addAdaptedNode('GainNode', { x: 300, y: 100 })
    const destId = store.addAdaptedNode('AudioDestinationNode', { x: 500, y: 100 })

    // Connect them
    store.addEdge(oscId, gainId, 'output', 'input')
    store.addEdge(gainId, destId, 'output', 'input')

    // Wait for audio nodes to be created
    await new Promise(resolve => setTimeout(resolve, 50))

    // Get references to the original audio nodes
    const originalOscNode = store.audioNodes.get(oscId)
    const originalGainNode = store.audioNodes.get(gainId)

    expect(originalOscNode).toBeDefined()
    expect(originalGainNode).toBeDefined()

    // Clear the mock call history
    vi.clearAllMocks()

    // Add an unconnected node (this should NOT disrupt existing audio)
    const unconnectedId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 300 })

    // Wait for the new node to be processed
    await new Promise(resolve => setTimeout(resolve, 50))

    // Verify that the original audio nodes were NOT recreated/disrupted
    const currentOscNode = store.audioNodes.get(oscId)
    const currentGainNode = store.audioNodes.get(gainId)

    // The nodes should be the same instances (not recreated)
    expect(currentOscNode).toBe(originalOscNode)
    expect(currentGainNode).toBe(originalGainNode)

    // The original nodes should NOT have been disconnected
    expect(originalOscNode?.disconnect).not.toHaveBeenCalled()
    expect(originalGainNode?.disconnect).not.toHaveBeenCalled()

    // The original oscillator should NOT have been stopped
    if (originalOscNode && 'stop' in originalOscNode) {
      expect((originalOscNode as any).stop).not.toHaveBeenCalled()
    }

    // The unconnected node should exist
    expect(store.audioNodes.get(unconnectedId)).toBeDefined()
  })

  it('should not disrupt existing audio when removing unconnected nodes', async () => {
    // Create a connected audio graph: Oscillator -> Gain -> Destination
    const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
    const gainId = store.addAdaptedNode('GainNode', { x: 300, y: 100 })
    const destId = store.addAdaptedNode('AudioDestinationNode', { x: 500, y: 100 })

    // Add an unconnected node
    const unconnectedId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 300 })

    // Connect the main graph
    store.addEdge(oscId, gainId, 'output', 'input')
    store.addEdge(gainId, destId, 'output', 'input')

    // Wait for audio nodes to be created
    await new Promise(resolve => setTimeout(resolve, 50))

    // Get references to the original audio nodes
    const originalOscNode = store.audioNodes.get(oscId)
    const originalGainNode = store.audioNodes.get(gainId)

    expect(originalOscNode).toBeDefined()
    expect(originalGainNode).toBeDefined()

    // Clear the mock call history
    vi.clearAllMocks()

    // Remove the unconnected node (this should NOT disrupt existing audio)
    store.removeNode(unconnectedId)

    // Wait for the removal to be processed
    await new Promise(resolve => setTimeout(resolve, 50))

    // Verify that the original audio nodes were NOT recreated/disrupted
    const currentOscNode = store.audioNodes.get(oscId)
    const currentGainNode = store.audioNodes.get(gainId)

    // The nodes should be the same instances (not recreated)
    expect(currentOscNode).toBe(originalOscNode)
    expect(currentGainNode).toBe(originalGainNode)

    // The original nodes should NOT have been disconnected
    expect(originalOscNode?.disconnect).not.toHaveBeenCalled()
    expect(originalGainNode?.disconnect).not.toHaveBeenCalled()

    // The original oscillator should NOT have been stopped
    if (originalOscNode && 'stop' in originalOscNode) {
      expect((originalOscNode as any).stop).not.toHaveBeenCalled()
    }

    // The unconnected node should be removed
    expect(store.audioNodes.get(unconnectedId)).toBeUndefined()
  })

  it('should only create audio nodes for new nodes, not recreate existing ones', async () => {
    // Create initial nodes
    const oscId1 = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
    const gainId = store.addAdaptedNode('GainNode', { x: 300, y: 100 })

    // Wait for audio nodes to be created
    await new Promise(resolve => setTimeout(resolve, 50))

    // Get the creation call count
    const initialOscCreationCalls = mockAudioContext.createOscillator.mock.calls.length
    const initialGainCreationCalls = mockAudioContext.createGain.mock.calls.length

    // Add another oscillator
    const oscId2 = store.addAdaptedNode('OscillatorNode', { x: 100, y: 300 })

    // Wait for the new node to be processed
    await new Promise(resolve => setTimeout(resolve, 50))

    // Only ONE additional oscillator should have been created
    expect(mockAudioContext.createOscillator.mock.calls.length).toBe(initialOscCreationCalls + 1)

    // No additional gain nodes should have been created
    expect(mockAudioContext.createGain.mock.calls.length).toBe(initialGainCreationCalls)

    // All nodes should exist
    expect(store.audioNodes.get(oscId1)).toBeDefined()
    expect(store.audioNodes.get(oscId2)).toBeDefined()
    expect(store.audioNodes.get(gainId)).toBeDefined()
  })
})
