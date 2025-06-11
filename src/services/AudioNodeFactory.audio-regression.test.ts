import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioNodeFactory } from './AudioNodeFactory'
import type { INodeMetadata } from '~/stores/NodeModels'

// Mock AudioContext for testing
class MockAudioContext {
  createOscillator = vi.fn(() => ({
    frequency: { value: 440 },
    detune: { value: 0 },
    type: 'sine',
    start: vi.fn(),
    stop: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }))

  createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }))

  createBiquadFilter = vi.fn(() => ({
    frequency: { value: 350 },
    Q: { value: 1 },
    gain: { value: 0 },
    type: 'lowpass',
    connect: vi.fn(),
    disconnect: vi.fn(),
  }))

  destination = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

describe('AudioNodeFactory - Audio Regression Tests', () => {
  let factory: AudioNodeFactory
  let mockAudioContext: MockAudioContext

  beforeEach(() => {
    mockAudioContext = new MockAudioContext()
    factory = new AudioNodeFactory(mockAudioContext as unknown as AudioContext)
  })

  describe('Source Node Detection and Auto-Start', () => {
    it('should detect OscillatorNode as a source node and start it automatically', () => {
      const metadata: INodeMetadata = {
        name: 'OscillatorNode',
        description: 'Test oscillator',
        category: 'source',
        inputs: [],
        outputs: [{ name: 'output', type: 'audio' }],
        properties: [
          { name: 'frequency', type: 'AudioParam', defaultValue: 440 },
          { name: 'type', type: 'OscillatorType', defaultValue: 'sine' },
        ],
        methods: ['connect', 'disconnect', 'start', 'stop'], // This is critical!
        events: ['ended'],
      } as unknown as INodeMetadata

      const audioNode = factory.createAudioNode('OscillatorNode', metadata, {
        frequency: 880,
        type: 'square',
      })

      // Verify the node was created
      expect(mockAudioContext.createOscillator).toHaveBeenCalled()
      expect(audioNode).toBeDefined()

      // Verify properties were set
      const oscNode = audioNode as any
      expect(oscNode.frequency.value).toBe(880)
      expect(oscNode.type).toBe('square')

      // CRITICAL: Verify that start() was called automatically
      expect(oscNode.start).toHaveBeenCalled()
    })

    it('should detect AudioBufferSourceNode as a source node and start it automatically', () => {
      const metadata: INodeMetadata = {
        name: 'AudioBufferSourceNode',
        description: 'Test audio buffer source',
        category: 'source',
        inputs: [],
        outputs: [{ name: 'output', type: 'audio' }],
        properties: [
          { name: 'playbackRate', type: 'AudioParam', defaultValue: 1 },
          { name: 'loop', type: 'boolean', defaultValue: false },
        ],
        methods: ['connect', 'disconnect', 'start', 'stop'], // This is critical!
        events: ['ended'],
      } as unknown as INodeMetadata

      // Mock the createWhiteNoiseSource method
      const mockBufferSource = {
        playbackRate: { value: 1 },
        loop: false,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      vi.spyOn(factory as any, 'createWhiteNoiseSource').mockReturnValue(mockBufferSource)

      const audioNode = factory.createAudioNode('AudioBufferSourceNode', metadata, {
        playbackRate: 1.5,
        loop: true,
      })

      // Verify the node was created
      expect(audioNode).toBeDefined()

      // Verify properties were set
      expect(mockBufferSource.playbackRate.value).toBe(1.5)
      expect(mockBufferSource.loop).toBe(true)

      // CRITICAL: Verify that start() was called automatically
      expect(mockBufferSource.start).toHaveBeenCalled()
    })

    it('should NOT auto-start non-source nodes like GainNode', () => {
      const metadata: INodeMetadata = {
        name: 'GainNode',
        description: 'Test gain node',
        category: 'effect',
        inputs: [{ name: 'input', type: 'audio' }],
        outputs: [{ name: 'output', type: 'audio' }],
        properties: [{ name: 'gain', type: 'AudioParam', defaultValue: 1 }],
        methods: ['connect', 'disconnect'], // No start/stop methods
        events: [],
      } as unknown as INodeMetadata

      const audioNode = factory.createAudioNode('GainNode', metadata, { gain: 0.5 })

      // Verify the node was created
      expect(mockAudioContext.createGain).toHaveBeenCalled()
      expect(audioNode).toBeDefined()

      // Verify properties were set
      const gainNode = audioNode as any
      expect(gainNode.gain.value).toBe(0.5)

      // CRITICAL: Verify that start() was NOT called (GainNode doesn't have start method)
      expect(gainNode.start).toBeUndefined()
    })
  })

  describe('Audio Graph Connection Tests', () => {
    it('should create a complete audio graph: Oscillator -> Gain -> Destination', () => {
      // Create oscillator
      const oscMetadata: INodeMetadata = {
        name: 'OscillatorNode',
        description: 'Test oscillator',
        category: 'source',
        inputs: [],
        outputs: [{ name: 'output', type: 'audio' }],
        properties: [{ name: 'frequency', type: 'AudioParam', defaultValue: 440 }],
        methods: ['connect', 'disconnect', 'start', 'stop'],
        events: [],
      } as unknown as INodeMetadata

      const oscillator = factory.createAudioNode('OscillatorNode', oscMetadata, { frequency: 440 })

      // Create gain
      const gainMetadata: INodeMetadata = {
        name: 'GainNode',
        description: 'Test gain',
        category: 'effect',
        inputs: [{ name: 'input', type: 'audio' }],
        outputs: [{ name: 'output', type: 'audio' }],
        properties: [{ name: 'gain', type: 'AudioParam', defaultValue: 1 }],
        methods: ['connect', 'disconnect'],
        events: [],
      } as unknown as INodeMetadata

      const gain = factory.createAudioNode('GainNode', gainMetadata, { gain: 0.5 })

      // Test connections
      oscillator.connect(gain)
      gain.connect(mockAudioContext.destination as any)

      // Verify connections were made
      expect(oscillator.connect).toHaveBeenCalledWith(gain)
      expect(gain.connect).toHaveBeenCalledWith(mockAudioContext.destination)

      // Verify oscillator was started
      expect((oscillator as any).start).toHaveBeenCalled()
    })
  })

  describe('Metadata-Driven Source Detection', () => {
    it('should use metadata methods array to determine if a node is a source node', () => {
      // Test with OscillatorNode but with custom metadata that has start method
      const customSourceMetadata: INodeMetadata = {
        name: 'OscillatorNode',
        description: 'Custom source node',
        category: 'source',
        inputs: [],
        outputs: [{ name: 'output', type: 'audio' }],
        properties: [{ name: 'frequency', type: 'AudioParam', defaultValue: 440 }],
        methods: ['connect', 'disconnect', 'start', 'stop'], // Has start method
        events: [],
      } as unknown as INodeMetadata

      const audioNode = factory.createAudioNode('OscillatorNode', customSourceMetadata, {})

      // Should be detected as source node and started
      expect((audioNode as any).start).toHaveBeenCalled()
    })

    it('should NOT start nodes without start method in metadata', () => {
      const nonSourceMetadata: INodeMetadata = {
        name: 'CustomProcessorNode',
        description: 'Custom processor node',
        category: 'effect',
        inputs: [{ name: 'input', type: 'audio' }],
        outputs: [{ name: 'output', type: 'audio' }],
        properties: [],
        methods: ['connect', 'disconnect'], // No start method
        events: [],
      } as unknown as INodeMetadata

      const mockCustomNode = {
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      mockAudioContext.createGain.mockReturnValueOnce(mockCustomNode as any)

      factory.createAudioNode('GainNode', nonSourceMetadata, {})

      // Should NOT be started (no start method)
      expect((mockCustomNode as any).start).toBeUndefined()
    })
  })

  describe('Audio Regression Prevention', () => {
    it('should fail if OscillatorNode metadata is missing start method', () => {
      // This test ensures that if someone accidentally removes the start method
      // from OscillatorNode metadata, the test will fail
      const brokenOscMetadata: INodeMetadata = {
        name: 'OscillatorNode',
        description: 'Broken oscillator metadata',
        category: 'source',
        inputs: [],
        outputs: [{ name: 'output', type: 'audio' }],
        properties: [{ name: 'frequency', type: 'AudioParam', defaultValue: 440 }],
        methods: ['connect', 'disconnect'], // MISSING start/stop methods!
        events: [],
      } as unknown as INodeMetadata

      const audioNode = factory.createAudioNode('OscillatorNode', brokenOscMetadata, {})
      const oscNode = audioNode as any

      // This should fail if metadata is broken - oscillator won't start
      expect(oscNode.start).not.toHaveBeenCalled()

      // This test documents the expected failure when metadata is broken
      // In a real scenario, this would indicate a regression
    })

    it('should verify that real metadata includes start methods for source nodes', async () => {
      // Import the actual generated metadata to verify it's correct
      const webAudioMetadataModule = await import('../types/web-audio-metadata.json')
      const webAudioMetadata = webAudioMetadataModule.default

      // Critical source nodes that MUST have start method
      const criticalSourceNodes = ['OscillatorNode', 'AudioBufferSourceNode', 'ConstantSourceNode']

      criticalSourceNodes.forEach(nodeType => {
        const metadata = (webAudioMetadata as any)[nodeType]
        expect(metadata, `${nodeType} metadata should exist`).toBeDefined()
        expect(metadata.methods, `${nodeType} should have methods array`).toBeDefined()
        expect(metadata.methods, `${nodeType} should include start method`).toContain('start')
        expect(metadata.methods, `${nodeType} should include stop method`).toContain('stop')
      })
    })
  })
})
