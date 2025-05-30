import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAudioGraphStore } from './AudioGraphStore'
import type { AudioGraphStoreType } from './AudioGraphStore'

// Mock AudioParam
const createMockAudioParam = (defaultValue: number) => ({
  value: defaultValue,
  connect: vi.fn(),
  disconnect: vi.fn(),
})

// Mock AudioNodes
const mockOscillatorNode = {
  frequency: createMockAudioParam(440),
  detune: createMockAudioParam(0),
  type: 'sine',
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}

const mockGainNode = {
  gain: createMockAudioParam(1),
  connect: vi.fn(),
  disconnect: vi.fn(),
}

const mockDestinationNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
}

const mockAudioContext = {
  createOscillator: vi.fn(() => ({ ...mockOscillatorNode })),
  createGain: vi.fn(() => ({ ...mockGainNode })),
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 1024,
    smoothingTimeConstant: 0.8,
  })),
  createConstantSource: vi.fn(() => ({
    offset: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  destination: mockDestinationNode,
  state: 'running',
  close: vi.fn(),
  suspend: vi.fn(),
} as unknown as AudioContext

// Mock the services
vi.mock('~/services/AudioNodeFactory', () => ({
  AudioNodeFactory: class {
    constructor(public audioContext: AudioContext) {}

    createAudioNode(nodeType: string) {
      if (nodeType === 'OscillatorNode') {
        return { ...mockOscillatorNode, frequency: createMockAudioParam(440) }
      } else if (nodeType === 'GainNode') {
        return { ...mockGainNode, gain: createMockAudioParam(1) }
      } else if (nodeType === 'AudioDestinationNode') {
        return mockDestinationNode
      }
      return mockGainNode
    }

    updateNodeProperty() {
      return true
    }
    stopSourceNode() {}
  },
}))

vi.mock('~/services/CustomNodeFactory', () => ({
  CustomNodeFactory: class {
    constructor(public audioContext: AudioContext) {}

    isCustomNodeType(nodeType: string) {
      return ['SliderNode', 'MidiToFreqNode', 'ButtonNode'].includes(nodeType)
    }

    createNode(id: string, nodeType: string) {
      return {
        id,
        type: nodeType,
        outputs: new Map([
          ['value', 100],
          ['frequency', 440],
        ]),
        properties: new Map([['value', 100]]),
        cleanup: vi.fn(),
        getAudioOutput: vi.fn(() => null),
      }
    }

    createCustomNode(nodeType: string) {
      const id = `${nodeType}-${Date.now()}`
      return this.createNode(id, nodeType)
    }

    setBridgeUpdateCallback() {}
    connectCustomNodes() {}
    getCustomNode() {
      return undefined
    }
  },
}))

// Mock global AudioContext
Object.defineProperty(global, 'AudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext),
})

describe('AudioParam Connection Tests', () => {
  let store: AudioGraphStoreType

  beforeEach(() => {
    vi.clearAllMocks()
    store = createAudioGraphStore()
    store.loadMetadata()
  })

  describe('Direct frequency control connections', () => {
    it('should set frequency base to 0 when connecting SliderNode', () => {
      // Create nodes
      const sliderId = store.addNode('SliderNode', { x: 100, y: 100 })
      const oscId = store.addNode('OscillatorNode', { x: 200, y: 100 })

      // Get the actual audio nodes
      const oscAudioNode = store.audioNodes.get(oscId) as any
      expect(oscAudioNode).toBeDefined()
      expect(oscAudioNode.frequency.value).toBe(440) // Default frequency

      // Connect SliderNode to frequency
      store.addEdge(sliderId, oscId, 'value', 'frequency')

      // After connection, frequency base should be 0 for direct control
      expect(oscAudioNode.frequency.value).toBe(0)
    })

    it('should set frequency base to 0 when connecting MidiToFreqNode', () => {
      // Create nodes
      const midiId = store.addNode('MidiToFreqNode', { x: 100, y: 100 })
      const oscId = store.addNode('OscillatorNode', { x: 200, y: 100 })

      // Get the actual audio nodes
      const oscAudioNode = store.audioNodes.get(oscId) as any
      expect(oscAudioNode.frequency.value).toBe(440) // Default frequency

      // Connect MidiToFreqNode to frequency
      store.addEdge(midiId, oscId, 'frequency', 'frequency')

      // After connection, frequency base should be 0 for direct control
      expect(oscAudioNode.frequency.value).toBe(0)
    })
  })

  describe('LFO modulation connections', () => {
    it('should keep frequency base when connecting OscillatorNode for modulation', () => {
      // Create nodes
      const lfoId = store.addNode('OscillatorNode', { x: 100, y: 100 })
      const oscId = store.addNode('OscillatorNode', { x: 200, y: 100 })

      // Get the actual audio nodes
      const oscAudioNode = store.audioNodes.get(oscId) as any
      expect(oscAudioNode.frequency.value).toBe(440) // Default frequency

      // Connect LFO to frequency (modulation)
      store.addEdge(lfoId, oscId, 'output', 'frequency')

      // After connection, frequency base should remain 440 for modulation
      expect(oscAudioNode.frequency.value).toBe(440)
    })
  })

  describe('Other AudioParam connections', () => {
    it('should set gain base to 0 when connecting control signal', () => {
      // Create nodes
      const sliderId = store.addNode('SliderNode', { x: 100, y: 100 })
      const gainId = store.addNode('GainNode', { x: 200, y: 100 })

      // Get the actual audio nodes
      const gainAudioNode = store.audioNodes.get(gainId) as any
      expect(gainAudioNode.gain.value).toBe(1) // Default gain

      // Connect SliderNode to gain
      store.addEdge(sliderId, gainId, 'value', 'gain')

      // After connection, gain base should be 0 for direct control
      expect(gainAudioNode.gain.value).toBe(0)
    })
  })

  describe('Disconnection behavior', () => {
    it('should restore default values when disconnecting', () => {
      // Create nodes
      const sliderId = store.addNode('SliderNode', { x: 100, y: 100 })
      const oscId = store.addNode('OscillatorNode', { x: 200, y: 100 })

      // Connect and verify base is set to 0
      store.addEdge(sliderId, oscId, 'value', 'frequency')
      const oscAudioNode = store.audioNodes.get(oscId) as any
      expect(oscAudioNode.frequency.value).toBe(0)

      // Find and remove the edge
      const edge = store.visualEdges.find(e => e.source === sliderId && e.target === oscId)
      expect(edge).toBeDefined()

      store.removeEdge(edge!.id)

      // After disconnection, frequency should be restored to default
      expect(oscAudioNode.frequency.value).toBe(440)
    })
  })

  describe('Visual verification test', () => {
    it('should create a complete working example for manual testing', () => {
      console.log('\n🎵 CREATING MANUAL TEST EXAMPLE:')

      // Create a complete audio chain for testing
      const sliderId = store.addNode('SliderNode', { x: 100, y: 100 })
      const oscId = store.addNode('OscillatorNode', { x: 250, y: 100 })
      const destId = store.addNode('AudioDestinationNode', { x: 400, y: 100 })

      console.log(`1. Created SliderNode: ${sliderId}`)
      console.log(`2. Created OscillatorNode: ${oscId}`)
      console.log(`3. Created AudioDestinationNode: ${destId}`)

      // Connect slider to oscillator frequency
      store.addEdge(sliderId, oscId, 'value', 'frequency')
      console.log('4. Connected SliderNode → OscillatorNode frequency')

      // Connect oscillator to destination
      store.addEdge(oscId, destId, 'output', 'input')
      console.log('5. Connected OscillatorNode → AudioDestinationNode')

      // Verify the connections
      const oscAudioNode = store.audioNodes.get(oscId) as any
      console.log(`6. Oscillator frequency base value: ${oscAudioNode.frequency.value} Hz`)
      console.log('   ✅ Should be 0 for direct slider control')

      // Simulate slider changes
      console.log('\n🎚️ SIMULATING SLIDER CHANGES:')
      store.updateNodeProperty(sliderId, 'value', 220)
      console.log('   Set slider to 220 → Should control frequency directly')

      store.updateNodeProperty(sliderId, 'value', 440)
      console.log('   Set slider to 440 → Should control frequency directly')

      store.updateNodeProperty(sliderId, 'value', 880)
      console.log('   Set slider to 880 → Should control frequency directly')

      console.log('\n✅ Example created successfully!')
      console.log(
        '💡 In the browser: Create SliderNode → connect to OscillatorNode frequency → connect to output'
      )
      console.log('💡 Move the slider and the frequency should change directly!')

      // Verify all nodes exist
      expect(store.visualNodes.length).toBe(3)
      expect(store.visualEdges.length).toBe(2)
      expect(oscAudioNode.frequency.value).toBe(0) // Should be 0 for direct control
    })
  })
})
