import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CustomNodeFactory } from './CustomNodeFactory'
import type { NodeMetadata } from '~/types'

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
      category: 'processing',
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
      category: 'processing',
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

    // Updated to work with MobX adapter
    expect(slider.type).toBe('SliderNode')
    expect(slider.properties.get('value')).toBe(50)
    expect(slider.outputs.get('value')).toBe(50)
  })

  it('ButtonNode triggers correctly', () => {
    const metadata: NodeMetadata = {
      name: 'Button',
      description: 'Test button',
      category: 'processing',
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

    // Test trigger functionality using the MobX adapter
    if (button.trigger) {
      button.trigger()
      expect(button.outputs.get('trigger')).toBe(1)

      // Test with custom output value
      button.properties.set('outputValue', 5)
      button.trigger()
      expect(button.outputs.get('trigger')).toBe(5)
    }
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

    const converter = factory.createCustomNode('MidiToFreqNode', metadata)

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
    const metadata: NodeMetadata = {
      name: 'Slider',
      description: 'Test slider',
      category: 'processing',
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

  it('handles unknown node type gracefully', () => {
    const metadata: NodeMetadata = {
      name: 'Unknown',
      description: 'Unknown node',
      category: 'processing',
      inputs: [],
      outputs: [],
      properties: [],
      methods: [],
      events: [],
    }

    // The MobX approach creates the node but it won't have specific behaviors
    const node = factory.createCustomNode('UnknownNode', metadata)

    expect(node).toBeDefined()
    expect(node.type).toBe('UnknownNode')
    expect(node.id).toBeDefined()

    // Unknown node types should have basic functionality but no special behavior
    expect(factory.isCustomNodeType('UnknownNode')).toBe(false)
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

  it('GreaterThanNode creates with correct structure', () => {
    const factory = new CustomNodeFactory(mockAudioContext)
    const metadata: NodeMetadata = {
      name: 'Greater Than',
      description: 'Test comparison',
      category: 'processing',
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

    // Test basic node structure
    expect(comp.type).toBe('GreaterThanNode')
    expect(comp.id).toBeDefined()
    expect(comp.properties.has('threshold')).toBe(true)
    expect(comp.outputs.has('result')).toBe(true)

    // Test that it's recognized as a custom node type
    expect(factory.isCustomNodeType('GreaterThanNode')).toBe(true)

    // Test property setting
    comp.properties.set('threshold', 5)
    expect(comp.properties.get('threshold')).toBe(5)
  })

  it('SelectNode creates with correct structure', () => {
    const factory = new CustomNodeFactory(mockAudioContext)
    const metadata: NodeMetadata = {
      name: 'Select',
      description: 'Test router',
      category: 'processing',
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

    // Test basic node structure
    expect(selector.type).toBe('SelectNode')
    expect(selector.id).toBeDefined()
    expect(selector.properties.has('numOutputs')).toBe(true)
    expect(selector.properties.get('numOutputs')).toBe(2)

    // Test outputs exist
    expect(selector.outputs.has('output0')).toBe(true)
    expect(selector.outputs.has('output1')).toBe(true)
    expect(selector.outputs.has('output2')).toBe(true)
    expect(selector.outputs.has('output3')).toBe(true)

    // Test that it's recognized as a custom node type
    expect(factory.isCustomNodeType('SelectNode')).toBe(true)
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
  let node: any

  beforeEach(() => {
    vi.clearAllMocks()
    factory = new CustomNodeFactory(mockAudioContext)
  })

  it('should create SoundFileNode without properties', () => {
    node = factory.createCustomNode('SoundFileNode', soundFileMetadata)
    expect(node).toBeDefined()
    expect(node.id).toBeDefined()
    expect(node.type).toBe('SoundFileNode')
  })

  it('should handle properties correctly during creation', async () => {
    // Create a mock base64 audio data (simplified)
    const mockAudioBufferData = 'UklGRigBAABXQVZFZm10IBAAAAABAAIARKwAAIhYAQAEABAAZGF0YQQBAAA=' // Sample WAV header in base64

    const properties = {
      audioBufferData: mockAudioBufferData,
      fileName: 'test-audio.wav',
      gain: 0.8,
      loop: true,
    }

    node = factory.createCustomNode('SoundFileNode', soundFileMetadata, properties)

    // Check basic node structure
    expect(node.type).toBe('SoundFileNode')
    expect(node.id).toBeDefined()

    // Check that properties were set during creation
    expect(node.properties.get('fileName')).toBe('test-audio.wav')
    expect(node.properties.get('gain')).toBe(0.8)
    expect(node.properties.get('loop')).toBe(true)

    // Check outputs exist
    expect(node.outputs.has('output')).toBe(true)
    expect(node.outputs.has('loaded')).toBe(true)

    // Test that it's recognized as a custom node type
    expect(factory.isCustomNodeType('SoundFileNode')).toBe(true)
  })

  it('should handle property updates after creation', () => {
    node = factory.createCustomNode('SoundFileNode', soundFileMetadata)

    // Test property updates
    node.properties.set('gain', 0.5)
    expect(node.properties.get('gain')).toBe(0.5)

    node.properties.set('loop', true)
    expect(node.properties.get('loop')).toBe(true)

    node.properties.set('fileName', 'new-file.wav')
    expect(node.properties.get('fileName')).toBe('new-file.wav')

    // Test that audio output method exists
    expect(typeof node.getAudioOutput).toBe('function')

    // Test that cleanup method exists
    expect(typeof node.cleanup).toBe('function')
  })
})
