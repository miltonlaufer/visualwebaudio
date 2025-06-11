import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioNodeFactory } from '../services/AudioNodeFactory'
import webAudioMetadata from '../types/web-audio-metadata.json'

// Mock Web Audio API
const mockAudioContext = {
  createOscillator: vi.fn(),
  createGain: vi.fn(),
  createConstantSource: vi.fn(),
  currentTime: 0,
} as unknown as AudioContext

const mockOscillatorNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  frequency: { value: 440 },
  detune: { value: 0 },
  type: 'sine',
} as unknown as OscillatorNode

describe('Oscillator Autostart Functionality', () => {
  let factory: AudioNodeFactory
  let metadata: any

  beforeEach(() => {
    vi.clearAllMocks()
    factory = new AudioNodeFactory(mockAudioContext)
    metadata = webAudioMetadata['OscillatorNode']

    // Setup mock returns
    mockAudioContext.createOscillator = vi.fn().mockReturnValue(mockOscillatorNode)
  })

  it('should start oscillator automatically when autostart is true (default)', () => {
    const properties = { autostart: true }
    factory.createAudioNode('OscillatorNode', metadata, properties)

    expect(mockOscillatorNode.start).toHaveBeenCalled()
  })

  it('should start oscillator automatically when autostart is undefined (default behavior)', () => {
    const properties = {}
    factory.createAudioNode('OscillatorNode', metadata, properties)

    expect(mockOscillatorNode.start).toHaveBeenCalled()
  })

  it('should not start oscillator automatically when autostart is false', () => {
    const properties = { autostart: false }
    factory.createAudioNode('OscillatorNode', metadata, properties)

    expect(mockOscillatorNode.start).not.toHaveBeenCalled()
  })

  it('should be able to trigger oscillator manually when autostart is false', () => {
    const properties = { autostart: false }
    const oscillator = factory.createAudioNode('OscillatorNode', metadata, properties)

    // Clear the mock to ensure we're testing the trigger
    vi.clearAllMocks()

    // Trigger the oscillator manually
    factory.triggerSourceNode(oscillator, 'OscillatorNode')

    expect(mockOscillatorNode.start).toHaveBeenCalled()
  })

  it('should handle trigger gracefully when oscillator is already started', () => {
    const properties = { autostart: true }
    const oscillator = factory.createAudioNode('OscillatorNode', metadata, properties)

    // Mock start to throw error (already started)
    mockOscillatorNode.start = vi.fn().mockImplementation(() => {
      throw new Error('Cannot start node: already started')
    })

    // Should not throw error
    expect(() => {
      factory.triggerSourceNode(oscillator, 'OscillatorNode')
    }).not.toThrow()
  })

  it('should include trigger input in oscillator metadata', () => {
    const triggerInput = metadata.inputs.find((input: any) => input.name === 'trigger')

    expect(triggerInput).toBeDefined()
    expect(triggerInput.type).toBe('control')
    expect(triggerInput.description.toLowerCase()).toContain('trigger')
  })

  it('should include autostart property in oscillator metadata', () => {
    const autostartProperty = metadata.properties.find((prop: any) => prop.name === 'autostart')

    expect(autostartProperty).toBeDefined()
    expect(autostartProperty.type).toBe('boolean')
    expect(autostartProperty.defaultValue).toBe(true)
  })
})
