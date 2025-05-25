import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioNodeFactory } from './AudioNodeFactory'
import type { NodeMetadata } from '~/types'

// Mock AudioContext
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

  createDelay = vi.fn(() => ({
    delayTime: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }))

  destination = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

describe('AudioNodeFactory', () => {
  let factory: AudioNodeFactory
  let mockAudioContext: MockAudioContext

  beforeEach(() => {
    mockAudioContext = new MockAudioContext()
    factory = new AudioNodeFactory(mockAudioContext as any)
  })

  const createMockMetadata = (nodeType: string): NodeMetadata => ({
    name: nodeType,
    category: 'source' as const,
    inputs: [{ name: 'input', type: 'audio' as const }],
    outputs: [{ name: 'output', type: 'audio' as const }],
    properties: [
      { name: 'frequency', type: 'AudioParam', defaultValue: 440, min: 0, max: 20000 },
      { name: 'type', type: 'OscillatorType', defaultValue: 'sine' },
    ],
    methods: ['start', 'stop'],
    events: ['ended'],
  })

  it('creates an OscillatorNode with metadata-driven approach', () => {
    const metadata = createMockMetadata('OscillatorNode')
    const properties = { frequency: 880, type: 'square' }

    const audioNode = factory.createAudioNode('OscillatorNode', metadata, properties)

    expect(mockAudioContext.createOscillator).toHaveBeenCalled()
    expect(audioNode).toBeDefined()

    // Should apply properties from metadata
    const oscNode = audioNode as any
    expect(oscNode.frequency.value).toBe(880)
    expect(oscNode.type).toBe('square')

    // Should start source nodes automatically
    expect(oscNode.start).toHaveBeenCalled()
  })

  it('creates a GainNode with default properties', () => {
    const metadata: NodeMetadata = {
      name: 'GainNode',
      category: 'effect',
      inputs: [{ name: 'input', type: 'audio' }],
      outputs: [{ name: 'output', type: 'audio' }],
      properties: [{ name: 'gain', type: 'AudioParam', defaultValue: 0.5, min: 0, max: 1 }],
      methods: [],
      events: [],
    }

    const audioNode = factory.createAudioNode('GainNode', metadata, {})

    expect(mockAudioContext.createGain).toHaveBeenCalled()

    // Should use default value when property not provided
    const gainNode = audioNode as any
    expect(gainNode.gain.value).toBe(0.5)
  })

  it('throws error for unknown node type', () => {
    const metadata = createMockMetadata('UnknownNode')

    expect(() => {
      factory.createAudioNode('UnknownNode', metadata, {})
    }).toThrow('Unknown node type: UnknownNode')
  })

  it('handles AudioDestinationNode correctly', () => {
    const metadata: NodeMetadata = {
      name: 'AudioDestinationNode',
      category: 'destination',
      inputs: [{ name: 'input', type: 'audio' }],
      outputs: [],
      properties: [],
      methods: [],
      events: [],
    }

    const audioNode = factory.createAudioNode('AudioDestinationNode', metadata, {})

    expect(audioNode).toBe(mockAudioContext.destination)
  })

  it('stops source nodes correctly', () => {
    const mockOscillator = {
      stop: vi.fn(),
    }

    factory.stopSourceNode(mockOscillator as any, 'OscillatorNode')

    expect(mockOscillator.stop).toHaveBeenCalled()
  })

  it('handles stop errors gracefully', () => {
    const mockOscillator = {
      stop: vi.fn(() => {
        throw new Error('Already stopped')
      }),
    }

    // Should not throw
    expect(() => {
      factory.stopSourceNode(mockOscillator as any, 'OscillatorNode')
    }).not.toThrow()
  })

  it('updates node properties successfully', () => {
    const metadata = createMockMetadata('GainNode')
    metadata.properties = [{ name: 'gain', type: 'AudioParam', defaultValue: 1 }]

    const mockGainNode = {
      gain: { value: 1 },
    }

    const result = factory.updateNodeProperty(
      mockGainNode as any,
      'GainNode',
      metadata,
      'gain',
      0.5
    )

    expect(result).toBe(true)
    expect(mockGainNode.gain.value).toBe(0.5)
  })

  it('detects when property requires recreation', () => {
    const metadata = createMockMetadata('OscillatorNode')
    const mockOscillator = { type: 'sine' }

    const result = factory.updateNodeProperty(
      mockOscillator as any,
      'OscillatorNode',
      metadata,
      'type',
      'square'
    )

    // Should return false indicating recreation is needed
    expect(result).toBe(false)
  })

  it('handles property not found in metadata', () => {
    const metadata = createMockMetadata('GainNode')
    const mockGainNode = {}

    const result = factory.updateNodeProperty(
      mockGainNode as any,
      'GainNode',
      metadata,
      'nonexistent',
      'value'
    )

    expect(result).toBe(false)
  })

  it('applies properties with different types correctly', () => {
    const metadata: NodeMetadata = {
      name: 'TestNode',
      category: 'effect',
      inputs: [],
      outputs: [],
      properties: [
        { name: 'audioParam', type: 'AudioParam', defaultValue: 100 },
        { name: 'regularProp', type: 'string', defaultValue: 'test' },
      ],
      methods: [],
      events: [],
    }

    const mockNode = {
      gain: { value: 1 }, // Required by the mock type
      audioParam: { value: 0 },
      regularProp: '',
      connect: vi.fn(),
      disconnect: vi.fn(),
    }

    // Mock the createGain to return our test node for this test
    mockAudioContext.createGain.mockImplementationOnce(() => mockNode as any)

    const properties = { audioParam: 200, regularProp: 'updated' }
    factory.createAudioNode('GainNode', metadata, properties)

    expect(mockNode.audioParam.value).toBe(200)
    expect(mockNode.regularProp).toBe('updated')
  })

  it('warns when property not found on audio node', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const metadata: NodeMetadata = {
      name: 'TestNode',
      category: 'effect',
      inputs: [],
      outputs: [],
      properties: [{ name: 'missingProp', type: 'AudioParam', defaultValue: 100 }],
      methods: [],
      events: [],
    }

    const mockNode = {} // No properties
    mockAudioContext.createGain = vi.fn(() => mockNode)

    factory.createAudioNode('GainNode', metadata, { missingProp: 200 })

    expect(consoleSpy).toHaveBeenCalledWith('Property missingProp not found on audio node')

    consoleSpy.mockRestore()
  })

  it('should create nodes using dynamic method calls', () => {
    const metadata: NodeMetadata = {
      name: 'DelayNode',
      category: 'effect',
      inputs: [{ name: 'input', type: 'audio' }],
      outputs: [{ name: 'output', type: 'audio' }],
      properties: [],
      methods: ['connect', 'disconnect'],
      events: [],
    }

    const audioNode = factory.createAudioNode('DelayNode', metadata)

    expect(mockAudioContext.createDelay).toHaveBeenCalled()
    expect(audioNode).toBeDefined()
  })

  it('should handle unknown node types gracefully', () => {
    const metadata: NodeMetadata = {
      name: 'UnknownNode',
      category: 'effect',
      inputs: [],
      outputs: [],
      properties: [],
      methods: [],
      events: [],
    }

    expect(() => {
      factory.createAudioNode('UnknownNode', metadata)
    }).toThrow('Unknown node type: UnknownNode. Method createUnknown not found on AudioContext.')
  })
})
