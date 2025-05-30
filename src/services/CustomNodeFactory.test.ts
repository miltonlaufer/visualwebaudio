/* eslint-disable */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  CustomNodeFactory,
  ButtonNode,
  SliderNode,
  MidiToFreqNode,
  SoundFileNode,
} from './CustomNodeFactory'
import type { NodeMetadata } from '~/types'

// Get MobXCustomNodeAdapter from the factory file
const { MobXCustomNodeAdapter } = await import('./CustomNodeFactory')

// Mock AudioContext for testing
const mockAudioContext = {
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    loop: false,
    playbackRate: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  decodeAudioData: vi.fn(() =>
    Promise.resolve({
      duration: 2.5,
      sampleRate: 44100,
      numberOfChannels: 2,
    })
  ),
  state: 'running',
} as unknown as AudioContext

describe('CustomNodeFactory', () => {
  let factory: CustomNodeFactory

  beforeEach(() => {
    vi.clearAllMocks()
    factory = new CustomNodeFactory(mockAudioContext)
  })

  it('identifies custom node types correctly', () => {
    expect(factory.isCustomNodeType('ButtonNode')).toBe(true)
    expect(factory.isCustomNodeType('SliderNode')).toBe(true)
    expect(factory.isCustomNodeType('MidiInputNode')).toBe(true)
    expect(factory.isCustomNodeType('OscillatorNode')).toBe(false)
    expect(factory.isCustomNodeType('GainNode')).toBe(false)
  })

  it('creates a ButtonNode with correct properties', () => {
    const metadata: NodeMetadata = {
      name: 'Button',
      description: 'Test button',
      category: 'effect',
      inputs: [],
      outputs: [{ name: 'trigger', type: 'control' }],
      properties: [
        { name: 'label', type: 'string', defaultValue: 'Button' },
        { name: 'outputValue', type: 'number', defaultValue: 1 },
      ],
      methods: [],
      events: [],
    }

    const button = factory.createCustomNode('ButtonNode', metadata)

    expect(button.type).toBe('ButtonNode')
    expect(button.properties.get('label')).toBe('Button')
    expect(button.properties.get('outputValue')).toBe(1)
    expect(button.outputs.get('trigger')).toBe(null)
  })

  it('creates a SliderNode with correct initial value', () => {
    const metadata: NodeMetadata = {
      name: 'Slider',
      description: 'Test slider',
      category: 'control',
      inputs: [],
      outputs: [{ name: 'value', type: 'control' }],
      properties: [
        { name: 'min', type: 'number', defaultValue: 0 },
        { name: 'max', type: 'number', defaultValue: 100 },
        { name: 'step', type: 'number', defaultValue: 1 },
        { name: 'value', type: 'number', defaultValue: 50 },
        { name: 'label', type: 'string', defaultValue: 'Slider' },
      ],
      methods: [],
      events: [],
    }

    const slider = factory.createCustomNode('SliderNode', metadata)

    expect(slider).toBeInstanceOf(SliderNode)
    expect(slider.properties.get('value')).toBe(50)
    expect(slider.outputs.get('value')).toBe(50)
  })

  it('ButtonNode triggers correctly', () => {
    const metadata: NodeMetadata = {
      name: 'Button',
      description: 'Test button',
      category: 'control',
      inputs: [],
      outputs: [{ name: 'trigger', type: 'control' }],
      properties: [
        { name: 'label', type: 'string', defaultValue: 'Button' },
        { name: 'outputValue', type: 'number', defaultValue: 1 },
      ],
      methods: [],
      events: [],
    }

    const button = factory.createCustomNode('ButtonNode', metadata) as ButtonNode

    // Test trigger functionality
    button.trigger?.()
    expect(button.outputs.get('trigger')).toBe(1)

    // Test with custom output value
    button.properties.set('outputValue', 5)
    button.trigger?.()
    expect(button.outputs.get('trigger')).toBe(5)
  })

  it('MidiToFreqNode converts MIDI notes to frequencies correctly', () => {
    const metadata: NodeMetadata = {
      name: 'MIDI to Frequency',
      description: 'Test MIDI converter',
      category: 'processing',
      inputs: [{ name: 'midiNote', type: 'control' }],
      outputs: [{ name: 'frequency', type: 'control' }],
      properties: [
        { name: 'baseFreq', type: 'number', defaultValue: 440 },
        { name: 'baseMidi', type: 'number', defaultValue: 69 },
      ],
      methods: [],
      events: [],
    }

    const converter = factory.createCustomNode('MidiToFreqNode', metadata) as MidiToFreqNode

    // Test A4 (MIDI note 69 = 440Hz)
    converter.receiveInput?.('midiNote', 69)
    expect(converter.outputs.get('frequency')).toBe(440)

    // Test A5 (MIDI note 81 = 880Hz)
    converter.receiveInput?.('midiNote', 81)
    expect(converter.outputs.get('frequency')).toBe(880)

    // Test A3 (MIDI note 57 = 220Hz)
    converter.receiveInput?.('midiNote', 57)
    expect(converter.outputs.get('frequency')).toBe(220)
  })

  it('applies initial properties correctly', () => {
    const metadata = {
      name: 'Slider',
      description: 'Test slider',
      category: 'control',
      inputs: [],
      outputs: [{ name: 'value', type: 'control' }],
      properties: [{ name: 'value', type: 'number', defaultValue: 50 }],
      methods: [],
      events: [],
    }

    const slider = factory.createCustomNode('SliderNode', metadata, { value: 75 })

    expect(slider.properties.get('value')).toBe(75)
    expect(slider.outputs.get('value')).toBe(75)
  })

  it('throws error for unknown node type', () => {
    const metadata = {
      name: 'Unknown',
      description: 'Unknown node',
      category: 'unknown',
      inputs: [],
      outputs: [],
      properties: [],
      methods: [],
      events: [],
    }

    expect(() => {
      factory.createCustomNode('UnknownNode', metadata)
    }).toThrow('Unknown custom node type: UnknownNode')
  })
})

describe('Custom Node Behaviors', () => {
  let mockAudioContext: AudioContext

  beforeEach(() => {
    mockAudioContext = {
      createGain: () => ({
        gain: { value: 1 },
        connect: () => {},
        disconnect: () => {},
      }),
    } as unknown as AudioContext
  })

  it('GreaterThanNode compares values correctly', () => {
    const factory = new CustomNodeFactory(mockAudioContext)
    const metadata = {
      name: 'Greater Than',
      description: 'Test comparison',
      category: 'logic',
      inputs: [
        { name: 'input1', type: 'control' },
        { name: 'input2', type: 'control' },
      ],
      outputs: [{ name: 'result', type: 'control' }],
      properties: [{ name: 'threshold', type: 'number', defaultValue: 0 }],
      methods: [],
      events: [],
    }

    const comp = factory.createCustomNode('GreaterThanNode', metadata)

    // Test 5 > 3 = 1
    comp.receiveInput('input1', 5)
    comp.receiveInput('input2', 3)
    expect(comp.outputs.get('result')).toBe(1)

    // Test 2 > 7 = 0
    comp.receiveInput('input1', 2)
    comp.receiveInput('input2', 7)
    expect(comp.outputs.get('result')).toBe(0)
  })

  it('SelectNode routes values correctly', () => {
    const factory = new CustomNodeFactory(mockAudioContext)
    const metadata = {
      name: 'Select',
      description: 'Test router',
      category: 'logic',
      inputs: [
        { name: 'selector', type: 'control' },
        { name: 'input', type: 'control' },
      ],
      outputs: [
        { name: 'output0', type: 'control' },
        { name: 'output1', type: 'control' },
        { name: 'output2', type: 'control' },
        { name: 'output3', type: 'control' },
      ],
      properties: [{ name: 'numOutputs', type: 'number', defaultValue: 2 }],
      methods: [],
      events: [],
    }

    const selector = factory.createCustomNode('SelectNode', metadata)

    // Route to output 0
    selector.receiveInput('selector', 0)
    selector.receiveInput('input', 42)
    expect(selector.outputs.get('output0')).toBe(42)

    // Route to output 1
    selector.receiveInput('selector', 1)
    selector.receiveInput('input', 99)
    expect(selector.outputs.get('output1')).toBe(99)
  })
})

const soundFileMetadata: NodeMetadata = {
  name: 'Sound File',
  description: 'Loads and plays audio files',
  category: 'source' as const,
  inputs: [{ name: 'trigger', type: 'control' as const }],
  outputs: [
    { name: 'output', type: 'audio' as const },
    { name: 'loaded', type: 'control' as const },
  ],
  properties: [
    { name: 'fileName', type: 'string', defaultValue: 'No file loaded' },
    { name: 'loop', type: 'boolean', defaultValue: false },
    { name: 'gain', type: 'number', defaultValue: 1, min: 0, max: 2 },
    { name: 'playbackRate', type: 'number', defaultValue: 1, min: 0.1, max: 4 },
  ],
  methods: ['loadFile', 'play', 'stop'],
  events: [],
}

describe('SoundFileNode - Pause/Resume Functionality', () => {
  let factory: CustomNodeFactory
  let node: SoundFileNode

  beforeEach(() => {
    vi.clearAllMocks()
    factory = new CustomNodeFactory(mockAudioContext)
  })

  it('should create SoundFileNode without properties', () => {
    node = factory.createCustomNode('SoundFileNode', soundFileMetadata) as SoundFileNode
    expect(node).toBeDefined()
    expect(node.id).toBeDefined()
    expect(node.type).toBe('SoundFileNode')
  })

  it('should restore audio buffer data from properties', async () => {
    // Create a mock base64 audio data (simplified)
    const mockAudioBufferData = 'UklGRigBAABXQVZFZm10IBAAAAABAAIARKwAAIhYAQAEABAAZGF0YQQBAAA=' // Sample WAV header in base64

    const properties = {
      audioBufferData: mockAudioBufferData,
      fileName: 'test-audio.wav',
      gain: 0.8,
      loop: true,
    }

    node = factory.createCustomNode('SoundFileNode', soundFileMetadata, properties) as SoundFileNode

    // Wait for the restoration process to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check that properties were set
    expect(node.properties.get('audioBufferData')).toBe(mockAudioBufferData)
    expect(node.properties.get('fileName')).toBe('test-audio.wav')
    expect(node.properties.get('gain')).toBe(0.8)
    expect(node.properties.get('loop')).toBe(true)

    // Check that decodeAudioData was called
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalled()
  })

  it('should handle missing audio buffer data gracefully', async () => {
    const properties = {
      fileName: 'test-audio.wav',
      gain: 0.8,
      // audioBufferData is missing
    }

    node = factory.createCustomNode('SoundFileNode', soundFileMetadata, properties) as SoundFileNode

    // Wait for the restoration process to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check that it doesn't crash and sets loaded to 0
    expect(node.outputs.get('loaded')).toBe(0)
    expect(mockAudioContext.decodeAudioData).not.toHaveBeenCalled()
  })

  it('should handle decode errors gracefully', async () => {
    // Mock decodeAudioData to throw an error
    mockAudioContext.decodeAudioData = vi.fn(() => Promise.reject(new Error('Decode failed')))

    const properties = {
      audioBufferData: 'invalid-base64-data',
      fileName: 'test-audio.wav',
    }

    node = factory.createCustomNode('SoundFileNode', soundFileMetadata, properties) as SoundFileNode

    // Wait for the restoration process to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check that it handles the error gracefully
    expect(node.outputs.get('loaded')).toBe(0)
    expect(node.properties.get('audioBufferData')).toBe('invalid-base64-data') // Data should be preserved
  })

  it('should log detailed information during restoration', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const properties = {
      audioBufferData: 'UklGRigBAABXQVZFZm10IBAAAAABAAIARKwAAIhYAQAEABAAZGF0YQQBAAA=',
      fileName: 'test-audio.wav',
    }

    node = factory.createCustomNode('SoundFileNode', soundFileMetadata, properties) as SoundFileNode

    // Wait for the restoration process to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check that logging occurred with the correct format
    expect(consoleSpy).toHaveBeenCalledWith(
      '🏭 CustomNodeFactory: Creating SoundFileNode with properties:',
      expect.arrayContaining(['audioBufferData', 'fileName'])
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('🔍 SoundFileNode: Attempting to restore audio data')
    )

    consoleSpy.mockRestore()
  })
})
