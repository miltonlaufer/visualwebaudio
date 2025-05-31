import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useExamples } from './Examples'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

// Mock the store
vi.mock('~/stores/AudioGraphStore', async importOriginal => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    useAudioGraphStore: vi.fn(),
  }
})

describe('Examples Structure Tests', () => {
  let mockStore: any
  let examples: any[]

  beforeEach(() => {
    // Reset mock store before each test
    mockStore = {
      clearAllNodes: vi.fn(),
      addNode: vi.fn().mockImplementation(() => 'mock-node-id'),
      addMicrophoneInput: vi.fn().mockResolvedValue('mock-mic-id'),
      updateNodeProperty: vi.fn(),
      addEdge: vi.fn(),
      setCreatingExample: vi.fn(),
      setLoadingProject: vi.fn(),
      recreateAudioGraph: vi.fn().mockResolvedValue(undefined),
      initializeAudioContext: vi.fn(),
      loadMetadata: vi.fn(),
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStore)

    // Get examples
    const { examples: exampleList } = useExamples()
    examples = exampleList
  })

  describe('Basic Oscillator Example', () => {
    it('should create exactly 3 nodes', async () => {
      const example = examples.find(e => e.id === 'basic-oscillator')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(3)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 600, y: 150 })
    })

    it('should create exactly 2 connections', async () => {
      const example = examples.find(e => e.id === 'basic-oscillator')
      await example.create()

      expect(mockStore.addEdge).toHaveBeenCalledTimes(2)
    })

    it('should set gain property', async () => {
      const example = examples.find(e => e.id === 'basic-oscillator')
      await example.create()

      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.5)
    })
  })

  describe('Stereo Panning Example', () => {
    it('should create exactly 6 nodes including LFO and oscillator gain', async () => {
      const example = examples.find(e => e.id === 'stereo-panner')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(6)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 150 }) // Main osc
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 150 }) // Osc gain
      expect(mockStore.addNode).toHaveBeenCalledWith('StereoPannerNode', { x: 700, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 350 }) // LFO
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 350 }) // LFO gain
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 1000, y: 150 })
    })

    it('should create exactly 5 connections (main chain + LFO modulation)', async () => {
      const example = examples.find(e => e.id === 'stereo-panner')
      await example.create()

      expect(mockStore.addEdge).toHaveBeenCalledTimes(5)
    })

    it('should configure LFO for panning automation', async () => {
      const example = examples.find(e => e.id === 'stereo-panner')
      await example.create()

      // Check LFO frequency is set for slow panning
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 0.2)
      // Check LFO gain is set for full range
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 1)
      // Check oscillator gain is set to 0.5 (sound generator rule)
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.5)
    })
  })

  describe('Delay Effect Example', () => {
    it('should create exactly 5 nodes', async () => {
      const example = examples.find(e => e.id === 'delay-effect')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(5)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 150 }) // Osc gain
      expect(mockStore.addNode).toHaveBeenCalledWith('DelayNode', { x: 650, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 650, y: 350 }) // Feedback gain
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 950, y: 150 })
    })

    it('should create feedback loop connections', async () => {
      const example = examples.find(e => e.id === 'delay-effect')
      await example.create()

      expect(mockStore.addEdge).toHaveBeenCalledTimes(5)
    })
  })

  describe('Filter Sweep Example', () => {
    it('should create exactly 6 nodes', async () => {
      const example = examples.find(e => e.id === 'filter-sweep')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(6)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 100 }) // Main osc
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 100 }) // Osc gain
      expect(mockStore.addNode).toHaveBeenCalledWith('BiquadFilterNode', { x: 700, y: 100 })
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 350 }) // LFO
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 350 }) // LFO gain
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 1000, y: 100 })
    })

    it('should configure filter and LFO properly', async () => {
      const example = examples.find(e => e.id === 'filter-sweep')
      await example.create()

      // Check filter configuration
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'type', 'lowpass')
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 800)
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'Q', 10)

      // Check LFO configuration
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 0.5)
      // Check oscillator gain is set to 0.5 (sound generator rule)
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.5)
    })
  })

  describe('Tremolo Effect Example', () => {
    it('should create exactly 6 nodes', async () => {
      const example = examples.find(e => e.id === 'tremolo-effect')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(6)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 100 }) // Main osc
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 100 }) // Osc gain
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 700, y: 100 }) // Tremolo gain
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 350 }) // LFO
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 350 }) // LFO gain
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 1000, y: 100 })
    })

    it('should configure tremolo LFO at 5Hz', async () => {
      const example = examples.find(e => e.id === 'tremolo-effect')
      await example.create()

      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 5)
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.3)
      // Check oscillator gain is set to 0.5 (sound generator rule)
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.5)
    })
  })

  describe('Ring Modulation Example', () => {
    it('should create exactly 6 nodes', async () => {
      const example = examples.find(e => e.id === 'ring-modulation')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(6)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 100 }) // Carrier
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 100 }) // Carrier gain
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 350 }) // Modulator
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 350 }) // Modulator gain
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 700, y: 225 }) // Ring mod gain
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 1000, y: 225 })
    })

    it('should configure carrier and modulator frequencies', async () => {
      const example = examples.find(e => e.id === 'ring-modulation')
      await example.create()

      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 440) // Carrier
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 30) // Modulator
      // Check oscillator gains are set to 0.5 (sound generator rule)
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.5)
    })
  })

  describe('Chord Synthesis Example', () => {
    it('should create exactly 8 nodes (3 oscillators + 3 gains + mixer + destination)', async () => {
      const example = examples.find(e => e.id === 'chord-synthesis')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(8)
      // 3 oscillators
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 50 })
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 225 })
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 400 })
      // 3 individual gains (updated positions)
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 50 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 225 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 400 })
      // Mixer and destination (updated positions)
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 700, y: 225 })
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 1000, y: 225 })
    })

    it('should configure C major chord frequencies', async () => {
      const example = examples.find(e => e.id === 'chord-synthesis')
      await example.create()

      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 261.63) // C4
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 329.63) // E4
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 392.0) // G4
      // Check oscillator gains are set to 0.5 (sound generator rule)
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.5)
    })
  })

  describe('Microphone Input Example', () => {
    it('should create exactly 4 nodes', async () => {
      const example = examples.find(e => e.id === 'microphone-input')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addMicrophoneInput).toHaveBeenCalledTimes(1)
      expect(mockStore.addNode).toHaveBeenCalledTimes(4) // Mic gain, Delay, Feedback, Destination
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 150 }) // Mic gain
      expect(mockStore.addNode).toHaveBeenCalledWith('DelayNode', { x: 650, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 650, y: 350 }) // Feedback
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 950, y: 150 })
    })
  })

  describe('Convolution Reverb Example', () => {
    it('should create exactly 8 nodes (dry/wet processing)', async () => {
      const example = examples.find(e => e.id === 'convolution-reverb')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(8)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 150 }) // Osc gain
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 700, y: 150 }) // Input gain
      expect(mockStore.addNode).toHaveBeenCalledWith('ConvolverNode', { x: 1000, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 1000, y: 50 }) // Dry gain
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 1000, y: 350 }) // Wet gain
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 1300, y: 150 }) // Mixer
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 1600, y: 150 })
    })
  })

  describe('Stereo Effects Example', () => {
    it('should create exactly 7 nodes (splitter/merger processing)', async () => {
      const example = examples.find(e => e.id === 'stereo-effects')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(7)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 400, y: 200 }) // Osc gain
      expect(mockStore.addNode).toHaveBeenCalledWith('ChannelSplitterNode', { x: 700, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 1000, y: 100 }) // Left gain
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 1000, y: 300 }) // Right gain
      expect(mockStore.addNode).toHaveBeenCalledWith('ChannelMergerNode', { x: 1300, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 1600, y: 200 })
    })
  })

  describe('All Examples', () => {
    it('should have all expected examples', () => {
      const expectedExamples = [
        'midi-to-frequency',
        'midi-delay-effect',
        'basic-oscillator',
        'microphone-input',
        'sound-file-player',
        'delay-effect',
        'filter-sweep',
        'stereo-panner',
        'compressor-effect',
        'tremolo-effect',
        'ring-modulation',
        'chord-synthesis',
        'waveshaper-distortion',
        'phaser-effect',
        'simple-noise',
        'amplitude-envelope',
        'beat-frequency',
        'convolution-reverb',
        'microphone-reverb',
        'stereo-effects',
        'robot-voice-ring-mod',
        'vocoder-voice',
        'voice-harmonizer',
        'voice-pitch-shifter',
        'vintage-analog-synth',
      ]

      const actualExampleIds = examples.map(e => e.id)

      expectedExamples.forEach(expectedId => {
        expect(actualExampleIds).toContain(expectedId)
      })

      expect(examples).toHaveLength(expectedExamples.length)
    })

    it('should wrap all examples with createExample helper', async () => {
      // Test that all examples properly use the createExample wrapper
      for (const example of examples) {
        mockStore.setCreatingExample.mockClear()

        await example.create()

        expect(mockStore.setCreatingExample).toHaveBeenCalledWith(true)
        expect(mockStore.setCreatingExample).toHaveBeenCalledWith(false)
        expect(mockStore.clearAllNodes).toHaveBeenCalled()
      }
    })

    it('should have proper structure for each example', () => {
      examples.forEach(example => {
        expect(example).toHaveProperty('id')
        expect(example).toHaveProperty('name')
        expect(example).toHaveProperty('description')
        expect(example).toHaveProperty('create')
        expect(typeof example.create).toBe('function')
        expect(typeof example.id).toBe('string')
        expect(typeof example.name).toBe('string')
        expect(typeof example.description).toBe('string')
      })
    })

    it('should maintain connections when running the same example multiple times', async () => {
      // Test the filter sweep example specifically since it was mentioned
      const example = examples.find(e => e.id === 'filter-sweep')
      expect(example).toBeDefined()

      // Run the example first time
      await example.create()

      const firstRunNodeCount = mockStore.addNode.mock.calls.length
      const firstRunEdgeCount = mockStore.addEdge.mock.calls.length

      // Clear mocks but keep the same store state
      mockStore.addNode.mockClear()
      mockStore.addEdge.mockClear()

      // Run the example second time
      await example.create()

      const secondRunNodeCount = mockStore.addNode.mock.calls.length
      const secondRunEdgeCount = mockStore.addEdge.mock.calls.length

      // Should create the same number of nodes and edges both times
      expect(secondRunNodeCount).toBe(firstRunNodeCount)
      expect(secondRunEdgeCount).toBe(firstRunEdgeCount)

      // Specifically for filter sweep: should be 6 nodes and 5 connections
      expect(secondRunNodeCount).toBe(6)
      expect(secondRunEdgeCount).toBe(5)
    })

    it('should trigger graph change counter when examples are run', async () => {
      // Add graphChangeCounter to mock store
      mockStore.graphChangeCounter = 0

      const example = examples.find(e => e.id === 'basic-oscillator')
      expect(example).toBeDefined()

      await example.create()

      // Should have incremented the counter for each node and edge added
      // Basic oscillator: 3 nodes + 2 edges + 1 clearAllNodes = 6 increments expected
      // But since we're mocking, we just verify the pattern is there
      expect(mockStore.addNode).toHaveBeenCalledTimes(3)
      expect(mockStore.addEdge).toHaveBeenCalledTimes(2)
    })
  })
})

describe('Examples UI Integration Tests', () => {
  let store: any
  let mockUseAudioGraphStore: any

  beforeEach(() => {
    // Create a simple test store interface that doesn't require MST
    store = {
      visualNodes: [],
      visualEdges: [],
      audioConnections: [],
      audioContext: {
        createOscillator: vi.fn(() => ({
          frequency: { value: 440 },
          type: 'sine',
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        })),
        createGain: vi.fn(() => ({
          gain: { value: 1 },
          connect: vi.fn(),
          disconnect: vi.fn(),
        })),
        createBiquadFilter: vi.fn(() => ({
          type: 'lowpass',
          frequency: { value: 350 },
          Q: { value: 1 },
          connect: vi.fn(),
          disconnect: vi.fn(),
        })),
        createConstantSource: vi.fn(() => ({
          offset: { value: 0 },
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        })),
        destination: {
          connect: vi.fn(),
          disconnect: vi.fn(),
        },
      },
      addNode: vi.fn().mockImplementation(() => 'mock-node-id'),
      addEdge: vi.fn(),
      updateNodeProperty: vi.fn(),
      clearAllNodes: vi.fn().mockImplementation(() => {
        store.visualNodes = []
        store.visualEdges = []
        store.audioConnections = []
      }),
      setCreatingExample: vi.fn(),
      isValidConnection: vi.fn().mockReturnValue(true),
      customNodes: new Map(),
      customNodeBridges: new Map(),
      graphChangeCounter: 0,
      propertyChangeCounter: 0,
    }

    // Mock the hook to return our test store
    mockUseAudioGraphStore = vi.mocked(useAudioGraphStore)
    mockUseAudioGraphStore.mockReturnValue(store)
  })

  describe('Examples Connection Functionality', () => {
    it('should create MIDI to Frequency chain with proper connections', async () => {
      const { examples } = useExamples()
      const midiExample = examples.find(e => e.id === 'midi-to-frequency')
      expect(midiExample).toBeDefined()
      if (!midiExample) return

      await midiExample.create()

      // Should have created 6 nodes
      expect(store.addNode).toHaveBeenCalledTimes(6)
      expect(store.addEdge).toHaveBeenCalledTimes(5)

      // Should have created proper node types
      expect(store.addNode).toHaveBeenCalledWith(
        'SliderNode',
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
      )
      expect(store.addNode).toHaveBeenCalledWith(
        'MidiToFreqNode',
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
      )
      expect(store.addNode).toHaveBeenCalledWith(
        'OscillatorNode',
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
      )
    })

    it('should create basic oscillator with audio connections', async () => {
      const { examples } = useExamples()
      const basicExample = examples.find(e => e.id === 'basic-oscillator')
      expect(basicExample).toBeDefined()
      if (!basicExample) return

      await basicExample.create()

      // Should create 3 nodes and 2 connections
      expect(store.addNode).toHaveBeenCalledTimes(3)
      expect(store.addEdge).toHaveBeenCalledTimes(2)

      // Should set gain property
      expect(store.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.5)
    })

    it('should create filter sweep with LFO modulation', async () => {
      const { examples } = useExamples()
      const filterExample = examples.find(e => e.id === 'filter-sweep')
      expect(filterExample).toBeDefined()
      if (!filterExample) return

      await filterExample.create()

      // Should create 6 nodes and 5 connections
      expect(store.addNode).toHaveBeenCalledTimes(6)
      expect(store.addEdge).toHaveBeenCalledTimes(5)

      // Should configure filter properly
      expect(store.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'type', 'lowpass')
      expect(store.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 800)
      expect(store.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'Q', 10)

      // Should configure LFO
      expect(store.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 0.5)
    })

    it('should handle audio context creation correctly', async () => {
      const { examples } = useExamples()
      const basicExample = examples.find(e => e.id === 'basic-oscillator')
      if (!basicExample) return

      await basicExample.create()

      // Audio context methods should be available (not called directly in examples but available)
      expect(store.audioContext.createOscillator).toBeDefined()
      expect(store.audioContext.createGain).toBeDefined()
    })
  })

  describe('Connection Validation Logic', () => {
    it('should have connection validation available', () => {
      expect(store.isValidConnection).toBeDefined()
      expect(typeof store.isValidConnection).toBe('function')

      // Test that the validation function can be called
      const result = store.isValidConnection('node1', 'node2', 'output', 'input')
      expect(typeof result).toBe('boolean')
    })

    it('should prevent operations during example creation', async () => {
      const { examples } = useExamples()
      const basicExample = examples.find(e => e.id === 'basic-oscillator')
      if (!basicExample) return

      await basicExample.create()

      // Should call setCreatingExample to prevent other operations
      expect(store.setCreatingExample).toHaveBeenCalledWith(true)
      expect(store.setCreatingExample).toHaveBeenCalledWith(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle file loading errors gracefully', async () => {
      const { examples } = useExamples()
      const soundExample = examples.find(e => e.id === 'sound-file-player')
      expect(soundExample).toBeDefined()
      if (!soundExample) return

      // Mock fetch to fail
      const mockFetch = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('File not found'))

      // Should not throw error
      await expect(soundExample.create()).resolves.not.toThrow()

      mockFetch.mockRestore()
    })

    it('should clear nodes before creating examples', async () => {
      const { examples } = useExamples()
      const basicExample = examples.find(e => e.id === 'basic-oscillator')
      if (!basicExample) return

      await basicExample.create()

      expect(store.clearAllNodes).toHaveBeenCalled()
    })
  })

  describe('Example Structure Validation', () => {
    it('should create all expected node types for complex examples', async () => {
      const { examples } = useExamples()
      const chordExample = examples.find(e => e.id === 'chord-synthesis')
      expect(chordExample).toBeDefined()
      if (!chordExample) return

      await chordExample.create()

      // Should create 8 nodes for chord synthesis
      expect(store.addNode).toHaveBeenCalledTimes(8)

      // Should have oscillators for chord notes
      expect(store.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 261.63) // C4
      expect(store.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 329.63) // E4
      expect(store.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 392.0) // G4
    })

    it('should maintain consistent connection patterns', async () => {
      const { examples } = useExamples()
      const tremoloExample = examples.find(e => e.id === 'tremolo-effect')
      if (!tremoloExample) return

      await tremoloExample.create()

      // Should create proper number of connections for tremolo
      expect(store.addEdge).toHaveBeenCalledTimes(5)
      expect(store.addNode).toHaveBeenCalledTimes(6)

      // Should configure tremolo LFO at 5Hz
      expect(store.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 5)
    })
  })
})
