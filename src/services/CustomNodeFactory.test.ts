import { describe, it, expect, beforeEach } from 'vitest'
import { CustomNodeFactory, ButtonNode, SliderNode, MidiToFreqNode } from './CustomNodeFactory'

// Mock AudioContext for testing
const mockAudioContext = {
  createGain: () => ({
    gain: { value: 1 },
    connect: () => {},
    disconnect: () => {},
  }),
  createBufferSource: () => ({
    buffer: null,
    loop: false,
    playbackRate: { value: 1 },
    connect: () => {},
    disconnect: () => {},
    start: () => {},
    stop: () => {},
  }),
  decodeAudioData: async () => ({}),
} as unknown as AudioContext

describe('CustomNodeFactory', () => {
  let factory: CustomNodeFactory

  beforeEach(() => {
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
    const metadata = {
      name: 'Button',
      description: 'Test button',
      category: 'control',
      inputs: [],
      outputs: [{ name: 'trigger', type: 'control' }],
      properties: [
        { name: 'label', type: 'string', defaultValue: 'Button' },
        { name: 'outputValue', type: 'number', defaultValue: 1 }
      ],
      methods: [],
      events: []
    }

    const button = factory.createCustomNode('ButtonNode', metadata)
    
    expect(button).toBeInstanceOf(ButtonNode)
    expect(button.type).toBe('ButtonNode')
    expect(button.properties.get('label')).toBe('Button')
    expect(button.properties.get('outputValue')).toBe(1)
    expect(button.outputs.has('trigger')).toBe(true)
  })

  it('creates a SliderNode with correct initial value', () => {
    const metadata = {
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
        { name: 'label', type: 'string', defaultValue: 'Slider' }
      ],
      methods: [],
      events: []
    }

    const slider = factory.createCustomNode('SliderNode', metadata)
    
    expect(slider).toBeInstanceOf(SliderNode)
    expect(slider.properties.get('value')).toBe(50)
    expect(slider.outputs.get('value')).toBe(50)
  })

  it('ButtonNode triggers correctly', () => {
    const metadata = {
      name: 'Button',
      description: 'Test button',
      category: 'control',
      inputs: [],
      outputs: [{ name: 'trigger', type: 'control' }],
      properties: [
        { name: 'label', type: 'string', defaultValue: 'Button' },
        { name: 'outputValue', type: 'number', defaultValue: 1 }
      ],
      methods: [],
      events: []
    }

    const button = factory.createCustomNode('ButtonNode', metadata) as ButtonNode
    
    // Test trigger functionality
    button.trigger()
    expect(button.outputs.get('trigger')).toBe(1)
    
    // Test with custom output value
    button.properties.set('outputValue', 5)
    button.trigger()
    expect(button.outputs.get('trigger')).toBe(5)
  })

  it('MidiToFreqNode converts MIDI notes to frequencies correctly', () => {
    const metadata = {
      name: 'MIDI to Frequency',
      description: 'Test MIDI converter',
      category: 'utility',
      inputs: [{ name: 'midiNote', type: 'control' }],
      outputs: [{ name: 'frequency', type: 'control' }],
      properties: [
        { name: 'baseFreq', type: 'number', defaultValue: 440 },
        { name: 'baseMidi', type: 'number', defaultValue: 69 }
      ],
      methods: [],
      events: []
    }

    const converter = factory.createCustomNode('MidiToFreqNode', metadata) as MidiToFreqNode
    
    // Test A4 (MIDI note 69 = 440Hz)
    converter.receiveInput('midiNote', 69)
    expect(converter.outputs.get('frequency')).toBe(440)
    
    // Test A5 (MIDI note 81 = 880Hz)
    converter.receiveInput('midiNote', 81)
    expect(converter.outputs.get('frequency')).toBe(880)
    
    // Test A3 (MIDI note 57 = 220Hz)
    converter.receiveInput('midiNote', 57)
    expect(converter.outputs.get('frequency')).toBe(220)
  })

  it('applies initial properties correctly', () => {
    const metadata = {
      name: 'Slider',
      description: 'Test slider',
      category: 'control',
      inputs: [],
      outputs: [{ name: 'value', type: 'control' }],
      properties: [
        { name: 'value', type: 'number', defaultValue: 50 }
      ],
      methods: [],
      events: []
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
      events: []
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
        { name: 'input2', type: 'control' }
      ],
      outputs: [{ name: 'result', type: 'control' }],
      properties: [{ name: 'threshold', type: 'number', defaultValue: 0 }],
      methods: [],
      events: []
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
        { name: 'input', type: 'control' }
      ],
      outputs: [
        { name: 'output0', type: 'control' },
        { name: 'output1', type: 'control' },
        { name: 'output2', type: 'control' },
        { name: 'output3', type: 'control' }
      ],
      properties: [{ name: 'numOutputs', type: 'number', defaultValue: 2 }],
      methods: [],
      events: []
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