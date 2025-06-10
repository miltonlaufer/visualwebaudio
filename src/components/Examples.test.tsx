import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useExamples } from './Examples'
import { createAudioGraphStore } from '~/stores/AudioGraphStore'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'

// Create mock audio nodes
const createMockAudioNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  frequency: { value: 440 },
  gain: { value: 1 },
  type: 'sine',
  delayTime: { value: 0 },
  Q: { value: 1 },
  pan: { value: 0 },
  buffer: null,
})

// Mock AudioNodeFactory
vi.mock('~/services/AudioNodeFactory', () => ({
  AudioNodeFactory: class {
    constructor(public audioContext: AudioContext) {}

    createAudioNode(_nodeType: string, _metadata: any, properties: any) {
      const mockNode = createMockAudioNode()
      // Apply initial properties
      if (properties) {
        Object.entries(properties).forEach(([key, value]) => {
          if (key === 'frequency' && mockNode.frequency) {
            mockNode.frequency.value = value as number
          } else if (key === 'gain' && mockNode.gain) {
            mockNode.gain.value = value as number
          }
        })
      }
      return mockNode
    }

    updateNodeProperty(audioNode: any, _nodeType: string, propertyName: string, value: any) {
      // Actually update the property on the mock
      if (propertyName === 'frequency' && audioNode.frequency) {
        audioNode.frequency.value = value
        return true
      } else if (propertyName === 'gain' && audioNode.gain) {
        audioNode.gain.value = value
        return true
      }
      return false
    }

    stopSourceNode(audioNode: any) {
      if ('stop' in audioNode) {
        audioNode.stop()
      }
    }
  },
}))

// Mock CustomNodeFactory
vi.mock('~/services/CustomNodeFactory', () => ({
  CustomNodeFactory: class {
    constructor(public audioContext: AudioContext) {}

    isCustomNodeType(nodeType: string) {
      return ['SliderNode', 'DisplayNode', 'ButtonNode', 'MidiToFreqNode', 'TimerNode'].includes(
        nodeType
      )
    }

    createNode(id: string, nodeType: string, metadata: any) {
      // Get default value from metadata if available
      const defaultValue =
        metadata?.properties?.[0]?.defaultValue ?? (nodeType === 'DisplayNode' ? 0 : 50)

      return {
        id,
        type: nodeType,
        outputs: new Map([['value', defaultValue]]),
        properties: new Map([['value', defaultValue]]),
        cleanup: vi.fn(),
        getAudioOutput: vi.fn(() => null),
      }
    }

    createCustomNode(nodeType: string) {
      const id = `${nodeType}-${Date.now()}`
      return this.createNode(id, nodeType, {})
    }
  },
}))

// Only mock the Web Audio API since it's not available in Node.js
const createMockAudioContext = () => ({
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 },
    type: 'sine',
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  })),
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 1024,
    smoothingTimeConstant: 0.8,
  })),
  createDelay: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    delayTime: { value: 0 },
  })),
  createBiquadFilter: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequency: { value: 350 },
    Q: { value: 1 },
    type: 'lowpass',
  })),
  createStereoPanner: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    pan: { value: 0 },
  })),
  createChannelSplitter: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createChannelMerger: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createConvolver: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    buffer: null,
  })),
  createMediaStreamSource: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createConstantSource: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    offset: { value: 0 },
  })),
  destination: {
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
  state: 'running',
  sampleRate: 44100,
  close: vi.fn().mockResolvedValue(undefined),
})

// Mock the global AudioContext constructor
global.AudioContext = vi.fn(() => createMockAudioContext()) as any

// Mock navigator.mediaDevices for microphone input examples
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => [],
    }),
  },
  writable: true,
})

// Mock window.alert for error handling in examples
global.alert = vi.fn()

// Mock the store hook to return our test store
vi.mock('~/stores/AudioGraphStore', async importOriginal => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    useAudioGraphStore: vi.fn(),
  }
})

describe('Examples Structure Tests', () => {
  let store: AudioGraphStoreType
  let examples: any[]

  beforeEach(async () => {
    // Create a real store instance for testing
    store = createAudioGraphStore()
    store.loadMetadata()

    // Mock the hook to return our test store
    const { useAudioGraphStore } = await import('~/stores/AudioGraphStore')
    vi.mocked(useAudioGraphStore).mockReturnValue(store)

    // Get examples using renderHook
    const { result } = renderHook(() => useExamples())
    examples = result.current.examples
  })

  describe('Basic Oscillator Example', () => {
    it('should create exactly 3 nodes', async () => {
      const example = examples.find(e => e.id === 'basic-oscillator')
      expect(example).toBeDefined()

      await example.create()

      // Wait for nodes to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(3)
      })

      expect(store.adaptedNodes.some(n => n.nodeType === 'OscillatorNode')).toBe(true)
      expect(store.adaptedNodes.some(n => n.nodeType === 'GainNode')).toBe(true)
      expect(store.adaptedNodes.some(n => n.nodeType === 'AudioDestinationNode')).toBe(true)
    })

    it('should create exactly 2 connections', async () => {
      const example = examples.find(e => e.id === 'basic-oscillator')
      await example.create()

      // Wait for edges to be created
      await waitFor(() => {
        expect(store.visualEdges).toHaveLength(2)
      })
    })

    it('should set gain property', async () => {
      const example = examples.find(e => e.id === 'basic-oscillator')
      await example.create()

      // Wait for nodes to be created and properties to be set
      await waitFor(() => {
        const gainNode = store.adaptedNodes.find(n => n.nodeType === 'GainNode')
        expect(gainNode).toBeDefined()
        expect(gainNode?.properties.get('gain')).toBe(0.5)
      })
    })
  })

  describe('Stereo Panning Example', () => {
    it('should create exactly 6 nodes including LFO and oscillator gain', async () => {
      const example = examples.find(e => e.id === 'stereo-panner')
      expect(example).toBeDefined()

      await example.create()

      // Wait for nodes to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(6)
      })

      expect(store.adaptedNodes.filter(n => n.nodeType === 'OscillatorNode')).toHaveLength(2) // Main + LFO
      expect(store.adaptedNodes.filter(n => n.nodeType === 'GainNode')).toHaveLength(2) // Osc + LFO gain
      expect(store.adaptedNodes.some(n => n.nodeType === 'StereoPannerNode')).toBe(true)
      expect(store.adaptedNodes.some(n => n.nodeType === 'AudioDestinationNode')).toBe(true)
    })

    it('should create exactly 5 connections (main chain + LFO modulation)', async () => {
      const example = examples.find(e => e.id === 'stereo-panner')
      await example.create()

      // Wait for edges to be created
      await waitFor(() => {
        expect(store.visualEdges).toHaveLength(5)
      })
    })

    it('should configure LFO for panning automation', async () => {
      const example = examples.find(e => e.id === 'stereo-panner')
      await example.create()

      // Wait for nodes to be created and properties to be set
      await waitFor(() => {
        // Find the LFO oscillator (should be at y: 350)
        const lfoNode = store.adaptedNodes.find(
          n => n.nodeType === 'OscillatorNode' && n.position.y === 350
        )
        expect(lfoNode).toBeDefined()
        expect(lfoNode?.properties.get('frequency')).toBe(0.2)

        // Find the LFO gain node
        const lfoGainNode = store.adaptedNodes.find(
          n => n.nodeType === 'GainNode' && n.position.y === 350
        )
        expect(lfoGainNode).toBeDefined()
        expect(lfoGainNode?.properties.get('gain')).toBe(1)

        // Find the oscillator gain node
        const oscGainNode = store.adaptedNodes.find(
          n => n.nodeType === 'GainNode' && n.position.y === 150
        )
        expect(oscGainNode).toBeDefined()
        expect(oscGainNode?.properties.get('gain')).toBe(0.5)
      })
    })
  })

  describe('Filter Sweep Example', () => {
    it('should create exactly 6 nodes', async () => {
      const example = examples.find(e => e.id === 'filter-sweep')
      expect(example).toBeDefined()

      await example.create()

      // Wait for nodes to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(6)
      })
      expect(store.adaptedNodes.filter(n => n.nodeType === 'OscillatorNode')).toHaveLength(2) // Main + LFO
      expect(store.adaptedNodes.filter(n => n.nodeType === 'GainNode')).toHaveLength(2) // Osc + LFO gain
      expect(store.adaptedNodes.some(n => n.nodeType === 'BiquadFilterNode')).toBe(true)
      expect(store.adaptedNodes.some(n => n.nodeType === 'AudioDestinationNode')).toBe(true)
    })

    it('should configure filter and LFO properly', async () => {
      const example = examples.find(e => e.id === 'filter-sweep')
      await example.create()

      // Wait for nodes to be created and properties to be set
      await waitFor(() => {
        // Check filter configuration
        const filterNode = store.adaptedNodes.find(n => n.nodeType === 'BiquadFilterNode')
        expect(filterNode).toBeDefined()
        expect(filterNode?.properties.get('type')).toBe('lowpass')
        expect(filterNode?.properties.get('frequency')).toBe(800)
        expect(filterNode?.properties.get('Q')).toBe(10)

        // Check LFO configuration
        const lfoNode = store.adaptedNodes.find(
          n => n.nodeType === 'OscillatorNode' && n.position.y === 350
        )
        expect(lfoNode).toBeDefined()
        expect(lfoNode?.properties.get('frequency')).toBe(0.5)

        // Check oscillator gain
        const oscGainNode = store.adaptedNodes.find(
          n => n.nodeType === 'GainNode' && n.position.y === 100
        )
        expect(oscGainNode).toBeDefined()
        expect(oscGainNode?.properties.get('gain')).toBe(0.5)
      })
    })
  })

  describe('All Examples', () => {
    it('should create and clear examples without errors', async () => {
      for (const example of examples) {
        // Clear any previous nodes
        store.clearAllNodes()
        expect(store.adaptedNodes).toHaveLength(0)
        expect(store.visualEdges).toHaveLength(0)

        // Create the example
        await example.create()

        // Wait for nodes to be created
        await waitFor(() => {
          expect(store.adaptedNodes.length).toBeGreaterThan(0)
        })

        // Clear again
        store.clearAllNodes()
        expect(store.adaptedNodes).toHaveLength(0)
        expect(store.visualEdges).toHaveLength(0)
      }
    })

    it('should maintain consistent structure across multiple runs', async () => {
      const example = examples.find(e => e.id === 'basic-oscillator')

      // Run the example twice
      await example.create()
      const firstRunNodeCount = store.adaptedNodes.length
      const firstRunEdgeCount = store.visualEdges.length

      store.clearAllNodes()

      await example.create()
      const secondRunNodeCount = store.adaptedNodes.length
      const secondRunEdgeCount = store.visualEdges.length

      // Should create the same structure both times
      expect(secondRunNodeCount).toBe(firstRunNodeCount)
      expect(secondRunEdgeCount).toBe(firstRunEdgeCount)
    })
  })
})

describe('Examples UI Integration Tests', () => {
  let store: AudioGraphStoreType

  beforeEach(async () => {
    store = createAudioGraphStore()
    store.loadMetadata()

    const { useAudioGraphStore } = await import('~/stores/AudioGraphStore')
    vi.mocked(useAudioGraphStore).mockReturnValue(store)
  })

  describe('Examples Connection Functionality', () => {
    it('should create basic oscillator with audio connections', async () => {
      const { result } = renderHook(() => useExamples())
      const basicOscExample = result.current.examples.find(e => e.id === 'basic-oscillator')
      expect(basicOscExample).toBeDefined()
      if (!basicOscExample) return

      await basicOscExample.create()

      // Wait for nodes and edges to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(3)
        expect(store.visualEdges).toHaveLength(2)
      })

      // Verify connection structure
      const oscNode = store.adaptedNodes.find(n => n.nodeType === 'OscillatorNode')
      const gainNode = store.adaptedNodes.find(n => n.nodeType === 'GainNode')
      const destNode = store.adaptedNodes.find(n => n.nodeType === 'AudioDestinationNode')

      expect(oscNode).toBeDefined()
      expect(gainNode).toBeDefined()
      expect(destNode).toBeDefined()

      // Check connections exist
      const oscToGain = store.visualEdges.find(
        e => e.source === oscNode?.id && e.target === gainNode?.id
      )
      const gainToDest = store.visualEdges.find(
        e => e.source === gainNode?.id && e.target === destNode?.id
      )

      expect(oscToGain).toBeDefined()
      expect(gainToDest).toBeDefined()
    })

    it('should create filter sweep with LFO modulation', async () => {
      const { result } = renderHook(() => useExamples())
      const filterExample = result.current.examples.find(e => e.id === 'filter-sweep')
      expect(filterExample).toBeDefined()
      if (!filterExample) return

      await filterExample.create()

      // Wait for nodes and edges to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(6)
        expect(store.visualEdges).toHaveLength(5)
      })

      // Verify LFO modulation connection exists
      const lfoNode = store.adaptedNodes.find(
        n => n.nodeType === 'OscillatorNode' && n.position.y === 350
      )
      const filterNode = store.adaptedNodes.find(n => n.nodeType === 'BiquadFilterNode')

      expect(lfoNode).toBeDefined()
      expect(filterNode).toBeDefined()

      // Should have a modulation connection (through LFO gain)
      const lfoGainNode = store.adaptedNodes.find(
        n => n.nodeType === 'GainNode' && n.position.y === 350
      )
      expect(lfoGainNode).toBeDefined()

      const modulationConnection = store.visualEdges.find(
        e => e.source === lfoGainNode?.id && e.target === filterNode?.id
      )
      expect(modulationConnection).toBeDefined()
    })
  })

  describe('Example Structure Validation', () => {
    it('should create all expected node types for complex examples', async () => {
      const { result } = renderHook(() => useExamples())
      const chordExample = result.current.examples.find(e => e.id === 'chord-synthesis')
      expect(chordExample).toBeDefined()
      if (!chordExample) return

      await chordExample.create()

      // Wait for nodes to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(8)
      })

      // Should have oscillators for chord notes
      const oscillators = store.adaptedNodes.filter(n => n.nodeType === 'OscillatorNode')
      expect(oscillators).toHaveLength(3) // C, E, G

      // Should have individual gains for each oscillator
      const gains = store.adaptedNodes.filter(n => n.nodeType === 'GainNode')
      expect(gains).toHaveLength(4) // 3 individual + 1 mixer

      // Should have destination
      const destination = store.adaptedNodes.filter(n => n.nodeType === 'AudioDestinationNode')
      expect(destination).toHaveLength(1)
    })

    it('should maintain consistent connection patterns', async () => {
      const { result } = renderHook(() => useExamples())
      const tremoloExample = result.current.examples.find(e => e.id === 'tremolo-effect')
      expect(tremoloExample).toBeDefined()
      if (!tremoloExample) return

      await tremoloExample.create()

      // Wait for nodes and edges to be created
      await waitFor(() => {
        expect(store.visualEdges).toHaveLength(5)
        expect(store.adaptedNodes).toHaveLength(6)
      })

      // Verify tremolo structure: Osc → OscGain → TremoloGain → Dest
      //                          LFO → LFOGain → TremoloGain
      const mainOsc = store.adaptedNodes.find(
        n => n.nodeType === 'OscillatorNode' && n.position.y === 100
      )
      const lfoOsc = store.adaptedNodes.find(
        n => n.nodeType === 'OscillatorNode' && n.position.y === 350
      )

      expect(mainOsc).toBeDefined()
      expect(lfoOsc).toBeDefined()
      expect(mainOsc?.id).not.toBe(lfoOsc?.id)
    })
  })
})
