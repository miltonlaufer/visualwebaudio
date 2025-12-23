import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useExamples } from './Examples'
import { RootStore } from '~/stores/RootStore'
import { customNodeStore } from '~/stores/CustomNodeStore'
import { compositeNodeDefinitionStore } from '~/stores/CompositeNodeDefinitionStore'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import prebuiltDefinitions from '~/types/composite-nodes-prebuilt.json'

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
        disconnect: vi.fn(),
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

// Mock fetch for audio file loading in examples
global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('test-sound.wav') || url.includes('.wav')) {
    // Mock audio file response with empty ArrayBuffer
    return Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      blob: () => Promise.resolve(new Blob([new ArrayBuffer(1024)], { type: 'audio/wav' })),
    })
  }
  return Promise.reject(new Error(`Unmocked fetch: ${url}`))
})

// Mock the store hook to return our test store
vi.mock('~/stores/AudioGraphStore', async importOriginal => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    useAudioGraphStore: vi.fn(),
  }
})

// Helper to load composite definitions
const loadCompositeDefinitions = () => {
  // Convert the JSON definitions to the format expected by loadPrebuiltDefinitions
  const definitions = Object.values(prebuiltDefinitions).map((def: any) => ({
    id: def.id,
    name: def.name,
    description: def.description,
    category: def.category,
    isPrebuilt: true,
    inputs: def.inputs,
    outputs: def.outputs,
    internalGraph: def.internalGraph,
  }))
  compositeNodeDefinitionStore.loadPrebuiltDefinitions(definitions)
}

describe('Examples Structure Tests', () => {
  let store: AudioGraphStoreType
  let examples: any[]

  beforeEach(async () => {
    // Clear the custom node store
    customNodeStore.clear()

    // Load composite node definitions
    loadCompositeDefinitions()

    // Create a real store instance for testing with CustomNodeStore environment
    const rootStore = RootStore.create({ audioGraph: { history: {} } }, { customNodeStore })
    store = rootStore.audioGraph
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

  describe('Delay Effect Example (with Composite)', () => {
    it('should create 4 nodes including DelayEffect composite', async () => {
      const example = examples.find(e => e.id === 'delay-effect')
      expect(example).toBeDefined()

      await example.create()

      // Wait for nodes to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(4)
      })

      expect(store.adaptedNodes.some(n => n.nodeType === 'OscillatorNode')).toBe(true)
      expect(store.adaptedNodes.filter(n => n.nodeType === 'GainNode')).toHaveLength(1)
      expect(store.adaptedNodes.some(n => n.nodeType === 'Composite_DelayEffect')).toBe(true)
      expect(store.adaptedNodes.some(n => n.nodeType === 'AudioDestinationNode')).toBe(true)
    })

    it('should create exactly 3 connections', async () => {
      const example = examples.find(e => e.id === 'delay-effect')
      await example.create()

      // Wait for edges to be created
      await waitFor(() => {
        expect(store.visualEdges).toHaveLength(3)
      })
    })
  })

  describe('Filter Sweep Example (with Composite)', () => {
    it('should create 4 nodes including FilterSweep composite', async () => {
      const example = examples.find(e => e.id === 'filter-sweep')
      expect(example).toBeDefined()

      await example.create()

      // Wait for nodes to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(4)
      })

      expect(store.adaptedNodes.some(n => n.nodeType === 'OscillatorNode')).toBe(true)
      expect(store.adaptedNodes.filter(n => n.nodeType === 'GainNode')).toHaveLength(1)
      expect(store.adaptedNodes.some(n => n.nodeType === 'Composite_FilterSweep')).toBe(true)
      expect(store.adaptedNodes.some(n => n.nodeType === 'AudioDestinationNode')).toBe(true)
    })
  })

  describe('Tremolo Effect Example (with Composite)', () => {
    it('should create 4 nodes including Tremolo composite', async () => {
      const example = examples.find(e => e.id === 'tremolo-effect')
      expect(example).toBeDefined()

      await example.create()

      // Wait for nodes to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(4)
      })

      expect(store.adaptedNodes.some(n => n.nodeType === 'OscillatorNode')).toBe(true)
      expect(store.adaptedNodes.filter(n => n.nodeType === 'GainNode')).toHaveLength(1)
      expect(store.adaptedNodes.some(n => n.nodeType === 'Composite_Tremolo')).toBe(true)
      expect(store.adaptedNodes.some(n => n.nodeType === 'AudioDestinationNode')).toBe(true)
    })
  })

  describe('Stereo Panner Example (with Composite)', () => {
    it('should create 4 nodes including AutoPanner composite', async () => {
      const example = examples.find(e => e.id === 'stereo-panner')
      expect(example).toBeDefined()

      await example.create()

      // Wait for nodes to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(4)
      })

      expect(store.adaptedNodes.some(n => n.nodeType === 'OscillatorNode')).toBe(true)
      expect(store.adaptedNodes.filter(n => n.nodeType === 'GainNode')).toHaveLength(1)
      expect(store.adaptedNodes.some(n => n.nodeType === 'Composite_AutoPanner')).toBe(true)
      expect(store.adaptedNodes.some(n => n.nodeType === 'AudioDestinationNode')).toBe(true)
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
    // Load composite node definitions
    loadCompositeDefinitions()

    const rootStore = RootStore.create({ audioGraph: { history: {} } })
    store = rootStore.audioGraph
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

    it('should create filter sweep with composite node', async () => {
      const { result } = renderHook(() => useExamples())
      const filterExample = result.current.examples.find(e => e.id === 'filter-sweep')
      expect(filterExample).toBeDefined()
      if (!filterExample) return

      await filterExample.create()

      // Wait for nodes and edges to be created
      await waitFor(() => {
        expect(store.adaptedNodes).toHaveLength(4)
        expect(store.visualEdges).toHaveLength(3)
      })

      // Verify FilterSweep composite is present
      const filterSweepNode = store.adaptedNodes.find(n => n.nodeType === 'Composite_FilterSweep')
      expect(filterSweepNode).toBeDefined()
    })
  })

  describe('Example Structure Validation', () => {
    it('should create all expected node types for chord synthesis', async () => {
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

    it('should create vintage synth with composites', async () => {
      const { result } = renderHook(() => useExamples())
      const vintageExample = result.current.examples.find(e => e.id === 'vintage-analog-synth')
      expect(vintageExample).toBeDefined()
      if (!vintageExample) return

      await vintageExample.create()

      // Wait for nodes to be created
      await waitFor(() => {
        expect(store.adaptedNodes.length).toBeGreaterThan(0)
      })

      // Should have OscillatorBank composite
      const oscBank = store.adaptedNodes.find(n => n.nodeType === 'Composite_OscillatorBank')
      expect(oscBank).toBeDefined()

      // Should have FilterSweep composite
      const filterSweep = store.adaptedNodes.find(n => n.nodeType === 'Composite_FilterSweep')
      expect(filterSweep).toBeDefined()

      // Should have DelayEffect composite
      const delay = store.adaptedNodes.find(n => n.nodeType === 'Composite_DelayEffect')
      expect(delay).toBeDefined()
    })
  })
})
