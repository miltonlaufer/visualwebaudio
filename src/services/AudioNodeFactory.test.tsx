import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioNodeFactory } from './AudioNodeFactory'

// Mock Web Audio API
const mockAudioContext = {
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 },
    type: 'sine',
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  }),
  createBiquadFilter: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequency: { value: 350 },
    type: 'lowpass',
  }),
  createAnalyser: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 1024,
  }),
  createBuffer: vi.fn().mockReturnValue({}),
  createBufferSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    buffer: null,
  }),
  destination: { connect: vi.fn(), disconnect: vi.fn() },
  sampleRate: 44100,
  currentTime: 0,
}

// Mock metadata
const mockMetadata = {
  OscillatorNode: {
    name: 'OscillatorNode',
    category: 'source',
    properties: [
      { name: 'frequency', type: 'AudioParam', defaultValue: 440 },
      { name: 'type', type: 'OscillatorType', defaultValue: 'sine' },
    ],
    inputs: [],
    outputs: [{ name: 'output', type: 'audio' }],
  },
  GainNode: {
    name: 'GainNode',
    category: 'effect',
    properties: [{ name: 'gain', type: 'AudioParam', defaultValue: 1 }],
    inputs: [{ name: 'input', type: 'audio' }],
    outputs: [{ name: 'output', type: 'audio' }],
  },
}

describe('AudioNodeFactory', () => {
  let factory: AudioNodeFactory

  beforeEach(() => {
    vi.clearAllMocks()
    factory = new AudioNodeFactory(mockAudioContext as unknown as AudioContext)
  })

  it('creates an oscillator node', () => {
    const metadata = mockMetadata.OscillatorNode
    const node = factory.createAudioNode('OscillatorNode', metadata)

    expect(mockAudioContext.createOscillator).toHaveBeenCalled()
    expect(node).toBeDefined()
  })

  it('creates a gain node', () => {
    const metadata = mockMetadata.GainNode
    const node = factory.createAudioNode('GainNode', metadata)

    expect(mockAudioContext.createGain).toHaveBeenCalled()
    expect(node).toBeDefined()
  })

  it('handles unknown node types', () => {
    const metadata = {
      name: 'UnknownNode',
      category: 'unknown',
      properties: [],
      inputs: [],
      outputs: [],
    }

    expect(() => {
      factory.createAudioNode('UnknownNode', metadata)
    }).toThrow()
  })

  it('updates node properties successfully', () => {
    const metadata = mockMetadata.OscillatorNode
    const node = factory.createAudioNode('OscillatorNode', metadata)

    const result = factory.updateNodeProperty(node, 'OscillatorNode', metadata, 'frequency', 880)
    expect(result).toBe(true)
  })

  it('handles property update errors gracefully', () => {
    const metadata = mockMetadata.OscillatorNode
    const node = factory.createAudioNode('OscillatorNode', metadata)

    // Try to update a non-existent property
    const result = factory.updateNodeProperty(
      node,
      'OscillatorNode',
      metadata,
      'nonExistentProperty',
      123
    )
    expect(result).toBe(false)
  })
})
