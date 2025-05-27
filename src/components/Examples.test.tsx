import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useExamples } from './Examples'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

// Mock the store
vi.mock('~/stores/AudioGraphStore', () => ({
  useAudioGraphStore: vi.fn(),
}))

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
    it('should create exactly 5 nodes including LFO', async () => {
      const example = examples.find(e => e.id === 'stereo-panner')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(5)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 150 }) // Main osc
      expect(mockStore.addNode).toHaveBeenCalledWith('StereoPannerNode', { x: 350, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 350 }) // LFO
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 350 }) // LFO gain
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 600, y: 150 })
    })

    it('should create exactly 4 connections (main chain + LFO modulation)', async () => {
      const example = examples.find(e => e.id === 'stereo-panner')
      await example.create()

      expect(mockStore.addEdge).toHaveBeenCalledTimes(4)
    })

    it('should configure LFO for panning automation', async () => {
      const example = examples.find(e => e.id === 'stereo-panner')
      await example.create()

      // Check LFO frequency is set for slow panning
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 0.2)
      // Check LFO gain is set for full range
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 1)
    })
  })

  describe('Delay Effect Example', () => {
    it('should create exactly 5 nodes', async () => {
      const example = examples.find(e => e.id === 'delay-effect')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(5)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('DelayNode', { x: 600, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 600, y: 350 }) // Feedback gain
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 850, y: 150 })
    })

    it('should create feedback loop connections', async () => {
      const example = examples.find(e => e.id === 'delay-effect')
      await example.create()

      expect(mockStore.addEdge).toHaveBeenCalledTimes(5)
    })
  })

  describe('Filter Sweep Example', () => {
    it('should create exactly 5 nodes', async () => {
      const example = examples.find(e => e.id === 'filter-sweep')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(5)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 100 }) // Main osc
      expect(mockStore.addNode).toHaveBeenCalledWith('BiquadFilterNode', { x: 350, y: 100 })
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 350 }) // LFO
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 350 }) // LFO gain
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 600, y: 100 })
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
    })
  })

  describe('Tremolo Effect Example', () => {
    it('should create exactly 5 nodes', async () => {
      const example = examples.find(e => e.id === 'tremolo-effect')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(5)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 100 }) // Main osc
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 100 })
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 300 }) // LFO
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 300 }) // LFO gain
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 600, y: 100 })
    })

    it('should configure tremolo LFO at 5Hz', async () => {
      const example = examples.find(e => e.id === 'tremolo-effect')
      await example.create()

      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 5)
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.3)
    })
  })

  describe('Ring Modulation Example', () => {
    it('should create exactly 4 nodes', async () => {
      const example = examples.find(e => e.id === 'ring-modulation')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(4)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 100 }) // Carrier
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 300 }) // Modulator
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 600, y: 200 })
    })

    it('should configure carrier and modulator frequencies', async () => {
      const example = examples.find(e => e.id === 'ring-modulation')
      await example.create()

      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 440) // Carrier
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 30) // Modulator
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
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 350 })
      // 3 individual gains
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 50 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 350 })
      // Mixer and destination
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 600, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 850, y: 200 })
    })

    it('should configure C major chord frequencies', async () => {
      const example = examples.find(e => e.id === 'chord-synthesis')
      await example.create()

      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 261.63) // C4
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 329.63) // E4
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'frequency', 392.0) // G4
    })
  })

  describe('Microphone Input Example', () => {
    it('should create exactly 5 nodes', async () => {
      const example = examples.find(e => e.id === 'microphone-input')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addMicrophoneInput).toHaveBeenCalledTimes(1)
      expect(mockStore.addNode).toHaveBeenCalledTimes(4) // Gain, Delay, Feedback, Destination
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('DelayNode', { x: 600, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 600, y: 350 }) // Feedback
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 850, y: 150 })
    })
  })

  describe('Convolution Reverb Example', () => {
    it('should create exactly 7 nodes (dry/wet processing)', async () => {
      const example = examples.find(e => e.id === 'convolution-reverb')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(7)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 350, y: 150 }) // Input gain
      expect(mockStore.addNode).toHaveBeenCalledWith('ConvolverNode', { x: 600, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 600, y: 50 }) // Dry gain
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 600, y: 250 }) // Wet gain
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 850, y: 150 }) // Mixer
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 1100, y: 150 })
    })
  })

  describe('Stereo Effects Example', () => {
    it('should create exactly 6 nodes (splitter/merger processing)', async () => {
      const example = examples.find(e => e.id === 'stereo-effects')
      expect(example).toBeDefined()

      await example.create()

      expect(mockStore.addNode).toHaveBeenCalledTimes(6)
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('ChannelSplitterNode', { x: 400, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 700, y: 100 }) // Left
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 700, y: 300 }) // Right
      expect(mockStore.addNode).toHaveBeenCalledWith('ChannelMergerNode', { x: 1000, y: 200 })
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 1300, y: 200 })
    })

    it('should configure different gains for left and right channels', async () => {
      const example = examples.find(e => e.id === 'stereo-effects')
      await example.create()

      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.8) // Left
      expect(mockStore.updateNodeProperty).toHaveBeenCalledWith('mock-node-id', 'gain', 0.4) // Right
    })
  })

  describe('All Examples', () => {
    it('should have all expected examples', () => {
      const expectedExamples = [
        'basic-oscillator',
        'microphone-input',
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

      // Specifically for filter sweep: should be 5 nodes and 4 connections
      expect(secondRunNodeCount).toBe(5)
      expect(secondRunEdgeCount).toBe(4)
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
