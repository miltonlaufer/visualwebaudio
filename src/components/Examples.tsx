import { useAudioGraphStore } from '~/stores/AudioGraphStore'

export interface Example {
  id: string
  name: string
  description: string
  create: () => void | Promise<void>
}

export const useExamples = () => {
  const store = useAudioGraphStore()

  // Helper function to create examples without undo/redo recording
  const createExample = (exampleFn: () => void | Promise<void>) => {
    return async () => {
      store.setCreatingExample(true)
      try {
        await exampleFn()
      } finally {
        // Always reset the flag, even if there's an error
        store.setCreatingExample(false)
      }
    }
  }

  const examples: Example[] = [
    {
      id: 'vintage-analog-synth',
      name: 'Vintage Analog Synth',
      description:
        'Classic analog synthesizer with multiple oscillators, resonant filter, delay, and automated sequences',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        // Timer for automated triggering
        const timerId = store.addNode('TimerNode', { x: 50, y: 50 })

        // Note control using MIDI to Frequency conversion
        const noteSlider = store.addNode('SliderNode', { x: 50, y: 200 })
        const midiToFreqId = store.addNode('MidiToFreqNode', { x: 300, y: 200 })

        // Envelope gain node controlled by timer
        const envelopeGainId = store.addNode('GainNode', { x: 800, y: 50 })

        // Multiple oscillators for rich vintage sound
        const osc1Id = store.addNode('OscillatorNode', { x: 550, y: 100 })
        const osc2Id = store.addNode('OscillatorNode', { x: 550, y: 200 })
        const osc3Id = store.addNode('OscillatorNode', { x: 550, y: 300 })

        // Individual gain controls for oscillators (sound generator rule)
        const osc1GainId = store.addNode('GainNode', { x: 800, y: 100 })
        const osc2GainId = store.addNode('GainNode', { x: 800, y: 200 })
        const osc3GainId = store.addNode('GainNode', { x: 800, y: 300 })

        // Mixer for combining oscillators
        const mixerId = store.addNode('GainNode', { x: 1050, y: 200 })

        // Resonant filter (the heart of vintage analog sound!)
        const filterId = store.addNode('BiquadFilterNode', { x: 1300, y: 200 })

        // LFO for filter modulation
        const lfoId = store.addNode('OscillatorNode', { x: 1050, y: 400 })
        const lfoGainId = store.addNode('GainNode', { x: 1300, y: 400 })

        // Delay for vintage echo
        const delayId = store.addNode('DelayNode', { x: 1550, y: 200 })
        const feedbackId = store.addNode('GainNode', { x: 1550, y: 400 })

        // Final output gain
        const outputGainId = store.addNode('GainNode', { x: 1800, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 2050, y: 200 })

        // User controls
        const filterCutoffSliderId = store.addNode('SliderNode', { x: 50, y: 350 })
        const filterResSliderId = store.addNode('SliderNode', { x: 50, y: 500 })

        console.log('Vintage Analog Synth: Setting up timer...')
        // Timer settings for automatic note triggering
        store.updateNodeProperty(timerId, 'mode', 'loop')
        store.updateNodeProperty(timerId, 'delay', 500)
        store.updateNodeProperty(timerId, 'interval', 2000)
        store.updateNodeProperty(timerId, 'startMode', 'auto')

        console.log('Vintage Analog Synth: Setting up note control...')
        // Note slider (MIDI note range)
        store.updateNodeProperty(noteSlider, 'min', 36) // C2
        store.updateNodeProperty(noteSlider, 'max', 84) // C6
        store.updateNodeProperty(noteSlider, 'value', 45) // A2
        store.updateNodeProperty(noteSlider, 'step', 1)
        store.updateNodeProperty(noteSlider, 'label', 'Note (MIDI)')

        // MIDI to Frequency converter
        store.updateNodeProperty(midiToFreqId, 'baseFreq', 440)
        store.updateNodeProperty(midiToFreqId, 'baseMidi', 69)

        console.log('Vintage Analog Synth: Setting up envelope...')
        // Envelope gain - this will be modulated by timer but needs a base level for sound
        store.updateNodeProperty(envelopeGainId, 'gain', 0.8)

        console.log('Vintage Analog Synth: Setting up oscillators...')
        // Oscillator 1: Fundamental frequency (sawtooth for vintage character)
        store.updateNodeProperty(osc1Id, 'frequency', 110) // Will be controlled by note slider
        store.updateNodeProperty(osc1Id, 'type', 'sawtooth')
        store.updateNodeProperty(osc1GainId, 'gain', 0.3)

        // Oscillator 2: Slightly detuned for richness
        store.updateNodeProperty(osc2Id, 'frequency', 110.5) // Will be controlled by note slider + detune
        store.updateNodeProperty(osc2Id, 'type', 'sawtooth')
        store.updateNodeProperty(osc2GainId, 'gain', 0.2)

        // Oscillator 3: Octave up for brightness
        store.updateNodeProperty(osc3Id, 'frequency', 220) // Will be controlled by note slider * 2
        store.updateNodeProperty(osc3Id, 'type', 'square')
        store.updateNodeProperty(osc3GainId, 'gain', 0.15)

        // Mixer
        store.updateNodeProperty(mixerId, 'gain', 1)

        console.log('Vintage Analog Synth: Setting up resonant filter...')
        // Resonant lowpass filter (classic analog sound!)
        store.updateNodeProperty(filterId, 'type', 'lowpass')
        store.updateNodeProperty(filterId, 'frequency', 800)
        store.updateNodeProperty(filterId, 'Q', 15) // High resonance for vintage character

        console.log('Vintage Analog Synth: Setting up LFO modulation...')
        // LFO for filter sweep
        store.updateNodeProperty(lfoId, 'frequency', 0.3) // Slow sweep
        store.updateNodeProperty(lfoId, 'type', 'sine')
        store.updateNodeProperty(lfoGainId, 'gain', 400) // Modulation depth

        console.log('Vintage Analog Synth: Setting up delay effect...')
        // Vintage delay
        store.updateNodeProperty(delayId, 'delayTime', 0.25) // 250ms
        store.updateNodeProperty(feedbackId, 'gain', 0.4) // Moderate feedback

        // Output gain
        store.updateNodeProperty(outputGainId, 'gain', 0.6)

        console.log('Vintage Analog Synth: Setting up user controls...')
        // User control sliders with proper labels
        store.updateNodeProperty(filterCutoffSliderId, 'min', 200)
        store.updateNodeProperty(filterCutoffSliderId, 'max', 4000)
        store.updateNodeProperty(filterCutoffSliderId, 'value', 800)
        store.updateNodeProperty(filterCutoffSliderId, 'label', 'Filter Cutoff')

        store.updateNodeProperty(filterResSliderId, 'min', 1)
        store.updateNodeProperty(filterResSliderId, 'max', 30)
        store.updateNodeProperty(filterResSliderId, 'value', 15)
        store.updateNodeProperty(filterResSliderId, 'label', 'Resonance')

        console.log('Vintage Analog Synth: Connecting note control...')
        // Connect note control chain
        store.addEdge(noteSlider, midiToFreqId, 'value', 'midiNote')
        store.addEdge(midiToFreqId, osc1Id, 'frequency', 'frequency')
        store.addEdge(midiToFreqId, osc2Id, 'frequency', 'frequency') // Will add slight detune
        store.addEdge(midiToFreqId, osc3Id, 'frequency', 'frequency') // Will be doubled for octave

        console.log('Vintage Analog Synth: Connecting timer automation...')
        // Connect timer to create rhythmic filter sweeps - timer triggers will add to the LFO modulation
        store.addEdge(timerId, filterId, 'trigger', 'frequency')

        console.log('Vintage Analog Synth: Connecting audio chain...')
        // Connect oscillators to their gain nodes
        store.addEdge(osc1Id, osc1GainId, 'output', 'input')
        store.addEdge(osc2Id, osc2GainId, 'output', 'input')
        store.addEdge(osc3Id, osc3GainId, 'output', 'input')

        // Mix oscillators
        store.addEdge(osc1GainId, mixerId, 'output', 'input')
        store.addEdge(osc2GainId, mixerId, 'output', 'input')
        store.addEdge(osc3GainId, mixerId, 'output', 'input')

        // Through envelope (controlled by timer)
        store.addEdge(mixerId, envelopeGainId, 'output', 'input')

        // Through filter
        store.addEdge(envelopeGainId, filterId, 'output', 'input')

        // LFO modulation of filter
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, filterId, 'output', 'frequency')

        // User control of filter
        store.addEdge(filterCutoffSliderId, filterId, 'value', 'frequency')
        store.addEdge(filterResSliderId, filterId, 'value', 'Q')

        // Through delay
        store.addEdge(filterId, delayId, 'output', 'input')
        store.addEdge(delayId, feedbackId, 'output', 'input')
        store.addEdge(feedbackId, delayId, 'output', 'input') // Feedback loop

        // To output
        store.addEdge(delayId, outputGainId, 'output', 'input')
        store.addEdge(outputGainId, destId, 'output', 'input')

        console.log(
          'Vintage Analog Synth: Setup complete! Use the Note slider to change pitch, and other controls for filter tweaking!'
        )
      }),
    },
    {
      id: 'midi-to-frequency',
      name: 'MIDI to Frequency',
      description: 'Control oscillator frequency with a slider via MIDI note conversion',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const sliderId = store.addNode('SliderNode', {
          x: -2.6200660464996304,
          y: -27.92407649604229,
        })
        const displayNode1Id = store.addNode('DisplayNode', {
          x: -0.683888634989259,
          y: 194.5119899292198,
        })
        const midiToFreqId = store.addNode('MidiToFreqNode', {
          x: 255.03647005056547,
          y: -12.888551203235835,
        })
        const displayNode2Id = store.addNode('DisplayNode', {
          x: 283.60216452982104,
          y: 200.40628596561203,
        })
        const oscId = store.addNode('OscillatorNode', {
          x: 543.047959716879,
          y: -28.436677674416615,
        })
        const destId = store.addNode('AudioDestinationNode', {
          x: 520.3458360566071,
          y: 263.8463363195132,
        })

        store.updateNodeProperty(sliderId, 'min', 48)
        store.updateNodeProperty(sliderId, 'max', 84)
        store.updateNodeProperty(sliderId, 'value', 60)
        store.updateNodeProperty(sliderId, 'label', 'MIDI Note')

        store.updateNodeProperty(midiToFreqId, 'baseFreq', 440)
        store.updateNodeProperty(midiToFreqId, 'baseMidi', 69)

        // Add labels to display nodes for better UX
        store.updateNodeProperty(displayNode1Id, 'label', 'MIDI Value')
        store.updateNodeProperty(displayNode2Id, 'label', 'Frequency (Hz)')

        // Don't set frequency here - it will be controlled by the MIDI input
        store.updateNodeProperty(oscId, 'type', 'sine')

        store.addEdge(sliderId, displayNode1Id, 'value', 'input')
        store.addEdge(displayNode1Id, midiToFreqId, 'output', 'midiNote')
        store.addEdge(midiToFreqId, displayNode2Id, 'frequency', 'input')
        store.addEdge(displayNode2Id, oscId, 'output', 'frequency')
        store.addEdge(oscId, destId, 'output', 'input')

        // Trigger initial value propagation through the chain
        store.updateNodeProperty(sliderId, 'value', 60) // This will trigger the chain
      }),
    },
    {
      id: 'midi-delay-effect',
      name: 'MIDI Delay Effect',
      description: 'Complex delay effect with MIDI-controlled oscillator and feedback loops',
      create: createExample(async () => {
        // Clear existing nodes first
        store.clearAllNodes()

        // Load the complete project data
        const projectData = {
          version: '1.0.0',
          timestamp: '2025-05-31T11:40:09.763Z',
          visualNodes: [
            {
              id: 'SliderNode-1748685942561-12',
              type: 'audioNode',
              position: {
                x: 385.5774441943615,
                y: 261.76777366889877,
              },
              data: {
                nodeType: 'SliderNode',
                metadata: {
                  name: 'Slider',
                  description:
                    'A horizontal slider control with customizable range and step. Outputs the current value.',
                  category: 'control',
                  inputs: [],
                  outputs: [
                    {
                      name: 'value',
                      type: 'control',
                    },
                  ],
                  properties: [
                    {
                      name: 'min',
                      type: 'number',
                      defaultValue: 0,
                      min: -1000,
                      max: 1000,
                    },
                    {
                      name: 'max',
                      type: 'number',
                      defaultValue: 100,
                      min: -1000,
                      max: 1000,
                    },
                    {
                      name: 'step',
                      type: 'number',
                      defaultValue: 1,
                      min: 0.001,
                      max: 100,
                    },
                    {
                      name: 'value',
                      type: 'number',
                      defaultValue: 50,
                    },
                    {
                      name: 'label',
                      type: 'string',
                      defaultValue: 'Slider',
                    },
                  ],
                  methods: [],
                  events: [],
                },
                properties: {
                  min: 48,
                  max: 84,
                  step: 1,
                  value: 58,
                  label: 'MIDI Note',
                },
              },
            },
            {
              id: 'DisplayNode-1748685942566-13',
              type: 'audioNode',
              position: {
                x: 150.91684723106914,
                y: 263.37758138748734,
              },
              data: {
                nodeType: 'DisplayNode',
                metadata: {
                  name: 'Display',
                  description:
                    'Displays the current value flowing through it. Useful for debugging signal flow and monitoring values.',
                  category: 'misc',
                  inputs: [
                    {
                      name: 'input',
                      type: 'control',
                    },
                  ],
                  outputs: [
                    {
                      name: 'output',
                      type: 'control',
                    },
                  ],
                  properties: [
                    {
                      name: 'currentValue',
                      type: 'number',
                      defaultValue: 0,
                    },
                    {
                      name: 'precision',
                      type: 'number',
                      defaultValue: 2,
                      min: 0,
                      max: 6,
                    },
                    {
                      name: 'label',
                      type: 'string',
                      defaultValue: 'Display',
                    },
                  ],
                  methods: [],
                  events: [],
                },
                properties: {
                  currentValue: 0,
                  precision: 2,
                  label: 'MIDI Value',
                },
              },
            },
            {
              id: 'MidiToFreqNode-1748685942567-14',
              type: 'audioNode',
              position: {
                x: 117.95752238641381,
                y: 71.09560283174109,
              },
              data: {
                nodeType: 'MidiToFreqNode',
                metadata: {
                  name: 'MIDI to Frequency',
                  description: 'Converts MIDI note numbers to frequency values. 69 = 440Hz (A4).',
                  category: 'misc',
                  inputs: [
                    {
                      name: 'midiNote',
                      type: 'control',
                    },
                  ],
                  outputs: [
                    {
                      name: 'frequency',
                      type: 'control',
                    },
                  ],
                  properties: [
                    {
                      name: 'baseFreq',
                      type: 'number',
                      defaultValue: 440,
                      min: 1,
                      max: 20000,
                    },
                    {
                      name: 'baseMidi',
                      type: 'number',
                      defaultValue: 69,
                      min: 0,
                      max: 127,
                    },
                  ],
                  methods: [],
                  events: [],
                },
                properties: {
                  baseFreq: 440,
                  baseMidi: 69,
                },
              },
            },
            {
              id: 'DisplayNode-1748685942567-15',
              type: 'audioNode',
              position: {
                x: 331.7326115802977,
                y: 58.327338301460344,
              },
              data: {
                nodeType: 'DisplayNode',
                metadata: {
                  name: 'Display',
                  description:
                    'Displays the current value flowing through it. Useful for debugging signal flow and monitoring values.',
                  category: 'misc',
                  inputs: [
                    {
                      name: 'input',
                      type: 'control',
                    },
                  ],
                  outputs: [
                    {
                      name: 'output',
                      type: 'control',
                    },
                  ],
                  properties: [
                    {
                      name: 'currentValue',
                      type: 'number',
                      defaultValue: 0,
                    },
                    {
                      name: 'precision',
                      type: 'number',
                      defaultValue: 2,
                      min: 0,
                      max: 6,
                    },
                    {
                      name: 'label',
                      type: 'string',
                      defaultValue: 'Display',
                    },
                  ],
                  methods: [],
                  events: [],
                },
                properties: {
                  currentValue: 0,
                  precision: 2,
                  label: 'Frequency (Hz)',
                },
              },
            },
            {
              id: 'OscillatorNode-1748685942568-16',
              type: 'audioNode',
              position: {
                x: 543.047959716879,
                y: -28.436677674416615,
              },
              data: {
                nodeType: 'OscillatorNode',
                metadata: {
                  name: 'OscillatorNode',
                  description:
                    'The OscillatorNode interface represents a periodic waveform, such as a sine wave. It is an AudioScheduledSourceNode audio-processing module that causes a specified frequency of a given wave to be created—in effect, a constant tone.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/API/OscillatorNode)',
                  category: 'source',
                  inputs: [
                    {
                      name: 'frequency',
                      type: 'control',
                    },
                    {
                      name: 'detune',
                      type: 'control',
                    },
                  ],
                  outputs: [
                    {
                      name: 'output',
                      type: 'audio',
                    },
                  ],
                  properties: [
                    {
                      name: 'detune',
                      type: 'AudioParam',
                      defaultValue: null,
                      min: -1200,
                      max: 1200,
                    },
                    {
                      name: 'frequency',
                      type: 'AudioParam',
                      defaultValue: 440,
                      min: 0,
                      max: 20000,
                    },
                    {
                      name: 'type',
                      type: 'OscillatorType',
                      defaultValue: 'sine',
                    },
                  ],
                  methods: [],
                  events: [],
                },
                properties: {
                  detune: null,
                  frequency: 440,
                  type: 'sawtooth',
                },
              },
            },
            {
              id: 'AudioDestinationNode-1748685942570-17',
              type: 'audioNode',
              position: {
                x: 1025.3458360566071,
                y: 54.84633631951323,
              },
              data: {
                nodeType: 'AudioDestinationNode',
                metadata: {
                  name: 'AudioDestinationNode',
                  description:
                    'AudioDestinationNode has no output (as it is the output, no more AudioNode can be linked after it in the audio graph) and one input. The number of channels in the input must be between 0 and the maxChannelCount value or an exception is raised.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDestinationNode)',
                  category: 'destination',
                  inputs: [
                    {
                      name: 'input',
                      type: 'audio',
                    },
                  ],
                  outputs: [],
                  properties: [],
                  methods: [],
                  events: [],
                },
                properties: {},
              },
            },
            {
              id: 'DelayNode-1748685958111-18',
              type: 'audioNode',
              position: {
                x: 728.9734113388032,
                y: 186.1700619630344,
              },
              data: {
                nodeType: 'DelayNode',
                metadata: {
                  name: 'DelayNode',
                  description:
                    'A delay-line; an AudioNode audio-processing module that causes a delay between the arrival of an input data and its propagation to the output.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/API/DelayNode)',
                  category: 'effect',
                  inputs: [
                    {
                      name: 'input',
                      type: 'audio',
                    },
                    {
                      name: 'delayTime',
                      type: 'control',
                    },
                  ],
                  outputs: [
                    {
                      name: 'output',
                      type: 'audio',
                    },
                  ],
                  properties: [
                    {
                      name: 'delayTime',
                      type: 'AudioParam',
                      defaultValue: null,
                      min: 0,
                      max: 1,
                    },
                  ],
                  methods: [],
                  events: [],
                },
                properties: {
                  delayTime: 0.6,
                },
              },
            },
            {
              id: 'GainNode-1748686091720-23',
              type: 'audioNode',
              position: {
                x: 785.0000000000002,
                y: -20.90365219116211,
              },
              data: {
                nodeType: 'GainNode',
                metadata: {
                  name: 'GainNode',
                  description:
                    'A change in volume. It is an AudioNode audio-processing module that causes a given gain to be applied to the input data before its propagation to the output. A GainNode always has exactly one input and one output, both with the same number of channels.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/API/GainNode)',
                  category: 'effect',
                  inputs: [
                    {
                      name: 'input',
                      type: 'audio',
                    },
                    {
                      name: 'gain',
                      type: 'control',
                    },
                  ],
                  outputs: [
                    {
                      name: 'output',
                      type: 'audio',
                    },
                  ],
                  properties: [
                    {
                      name: 'gain',
                      type: 'AudioParam',
                      defaultValue: 1,
                      min: 0,
                      max: 1,
                    },
                  ],
                  methods: [],
                  events: [],
                },
                properties: {
                  gain: 0.61,
                },
              },
            },
            {
              id: 'GainNode-1748686196223-24',
              type: 'audioNode',
              position: {
                x: 970.3574119732923,
                y: 283.7122795990003,
              },
              data: {
                nodeType: 'GainNode',
                metadata: {
                  name: 'GainNode',
                  description:
                    'A change in volume. It is an AudioNode audio-processing module that causes a given gain to be applied to the input data before its propagation to the output. A GainNode always has exactly one input and one output, both with the same number of channels.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/API/GainNode)',
                  category: 'effect',
                  inputs: [
                    {
                      name: 'input',
                      type: 'audio',
                    },
                    {
                      name: 'gain',
                      type: 'control',
                    },
                  ],
                  outputs: [
                    {
                      name: 'output',
                      type: 'audio',
                    },
                  ],
                  properties: [
                    {
                      name: 'gain',
                      type: 'AudioParam',
                      defaultValue: 1,
                      min: 0,
                      max: 1,
                    },
                  ],
                  methods: [],
                  events: [],
                },
                properties: {
                  gain: 0.3,
                },
              },
            },
            {
              id: 'DelayNode-1748686239866-25',
              type: 'audioNode',
              position: {
                x: 616.9581478393507,
                y: 423.96961872534393,
              },
              data: {
                nodeType: 'DelayNode',
                metadata: {
                  name: 'DelayNode',
                  description:
                    'A delay-line; an AudioNode audio-processing module that causes a delay between the arrival of an input data and its propagation to the output.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/API/DelayNode)',
                  category: 'effect',
                  inputs: [
                    {
                      name: 'input',
                      type: 'audio',
                    },
                    {
                      name: 'delayTime',
                      type: 'control',
                    },
                  ],
                  outputs: [
                    {
                      name: 'output',
                      type: 'audio',
                    },
                  ],
                  properties: [
                    {
                      name: 'delayTime',
                      type: 'AudioParam',
                      defaultValue: null,
                      min: 0,
                      max: 1,
                    },
                  ],
                  methods: [],
                  events: [],
                },
                properties: {
                  delayTime: 0.4,
                },
              },
            },
            {
              id: 'GainNode-1748686283731-26',
              type: 'audioNode',
              position: {
                x: 865.8395852626412,
                y: 494.96525071744213,
              },
              data: {
                nodeType: 'GainNode',
                metadata: {
                  name: 'GainNode',
                  description:
                    'A change in volume. It is an AudioNode audio-processing module that causes a given gain to be applied to the input data before its propagation to the output. A GainNode always has exactly one input and one output, both with the same number of channels.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/API/GainNode)',
                  category: 'effect',
                  inputs: [
                    {
                      name: 'input',
                      type: 'audio',
                    },
                    {
                      name: 'gain',
                      type: 'control',
                    },
                  ],
                  outputs: [
                    {
                      name: 'output',
                      type: 'audio',
                    },
                  ],
                  properties: [
                    {
                      name: 'gain',
                      type: 'AudioParam',
                      defaultValue: 1,
                      min: 0,
                      max: 1,
                    },
                  ],
                  methods: [],
                  events: [],
                },
                properties: {
                  gain: 0.5,
                },
              },
            },
          ],
          visualEdges: [
            {
              id: 'SliderNode-1748685942561-12-DisplayNode-1748685942566-13-value-input',
              source: 'SliderNode-1748685942561-12',
              target: 'DisplayNode-1748685942566-13',
              sourceHandle: 'value',
              targetHandle: 'input',
            },
            {
              id: 'DisplayNode-1748685942566-13-MidiToFreqNode-1748685942567-14-output-midiNote',
              source: 'DisplayNode-1748685942566-13',
              target: 'MidiToFreqNode-1748685942567-14',
              sourceHandle: 'output',
              targetHandle: 'midiNote',
            },
            {
              id: 'MidiToFreqNode-1748685942567-14-DisplayNode-1748685942567-15-frequency-input',
              source: 'MidiToFreqNode-1748685942567-14',
              target: 'DisplayNode-1748685942567-15',
              sourceHandle: 'frequency',
              targetHandle: 'input',
            },
            {
              id: 'DisplayNode-1748685942567-15-OscillatorNode-1748685942568-16-output-frequency',
              source: 'DisplayNode-1748685942567-15',
              target: 'OscillatorNode-1748685942568-16',
              sourceHandle: 'output',
              targetHandle: 'frequency',
            },
            {
              id: 'OscillatorNode-1748685942568-16-DelayNode-1748685958111-18-output-input',
              source: 'OscillatorNode-1748685942568-16',
              target: 'DelayNode-1748685958111-18',
              sourceHandle: 'output',
              targetHandle: 'input',
            },
            {
              id: 'OscillatorNode-1748685942568-16-GainNode-1748686091720-23-output-input',
              source: 'OscillatorNode-1748685942568-16',
              target: 'GainNode-1748686091720-23',
              sourceHandle: 'output',
              targetHandle: 'input',
            },
            {
              id: 'GainNode-1748686091720-23-AudioDestinationNode-1748685942570-17-output-input',
              source: 'GainNode-1748686091720-23',
              target: 'AudioDestinationNode-1748685942570-17',
              sourceHandle: 'output',
              targetHandle: 'input',
            },
            {
              id: 'GainNode-1748686196223-24-AudioDestinationNode-1748685942570-17-output-input',
              source: 'GainNode-1748686196223-24',
              target: 'AudioDestinationNode-1748685942570-17',
              sourceHandle: 'output',
              targetHandle: 'input',
            },
            {
              id: 'DelayNode-1748685958111-18-GainNode-1748686196223-24-output-input',
              source: 'DelayNode-1748685958111-18',
              target: 'GainNode-1748686196223-24',
              sourceHandle: 'output',
              targetHandle: 'input',
            },
            {
              id: 'DelayNode-1748685958111-18-DelayNode-1748686239866-25-output-input',
              source: 'DelayNode-1748685958111-18',
              target: 'DelayNode-1748686239866-25',
              sourceHandle: 'output',
              targetHandle: 'input',
            },
            {
              id: 'DelayNode-1748686239866-25-GainNode-1748686283731-26-output-input',
              source: 'DelayNode-1748686239866-25',
              target: 'GainNode-1748686283731-26',
              sourceHandle: 'output',
              targetHandle: 'input',
            },
            {
              id: 'GainNode-1748686283731-26-DelayNode-1748685958111-18-output-input',
              source: 'GainNode-1748686283731-26',
              target: 'DelayNode-1748685958111-18',
              sourceHandle: 'output',
              targetHandle: 'input',
            },
          ],
          audioConnections: [
            {
              sourceNodeId: 'SliderNode-1748685942561-12',
              targetNodeId: 'DisplayNode-1748685942566-13',
              sourceOutput: 'value',
              targetInput: 'input',
            },
            {
              sourceNodeId: 'DisplayNode-1748685942566-13',
              targetNodeId: 'MidiToFreqNode-1748685942567-14',
              sourceOutput: 'output',
              targetInput: 'midiNote',
            },
            {
              sourceNodeId: 'MidiToFreqNode-1748685942567-14',
              targetNodeId: 'DisplayNode-1748685942567-15',
              sourceOutput: 'frequency',
              targetInput: 'input',
            },
            {
              sourceNodeId: 'DisplayNode-1748685942567-15',
              targetNodeId: 'OscillatorNode-1748685942568-16',
              sourceOutput: 'output',
              targetInput: 'frequency',
            },
            {
              sourceNodeId: 'OscillatorNode-1748685942568-16',
              targetNodeId: 'DelayNode-1748685958111-18',
              sourceOutput: 'output',
              targetInput: 'input',
            },
            {
              sourceNodeId: 'OscillatorNode-1748685942568-16',
              targetNodeId: 'GainNode-1748686091720-23',
              sourceOutput: 'output',
              targetInput: 'input',
            },
            {
              sourceNodeId: 'GainNode-1748686091720-23',
              targetNodeId: 'AudioDestinationNode-1748685942570-17',
              sourceOutput: 'output',
              targetInput: 'input',
            },
            {
              sourceNodeId: 'GainNode-1748686196223-24',
              targetNodeId: 'AudioDestinationNode-1748685942570-17',
              sourceOutput: 'output',
              targetInput: 'input',
            },
            {
              sourceNodeId: 'DelayNode-1748685958111-18',
              targetNodeId: 'GainNode-1748686196223-24',
              sourceOutput: 'output',
              targetInput: 'input',
            },
            {
              sourceNodeId: 'DelayNode-1748685958111-18',
              targetNodeId: 'DelayNode-1748686239866-25',
              sourceOutput: 'output',
              targetInput: 'input',
            },
            {
              sourceNodeId: 'DelayNode-1748686239866-25',
              targetNodeId: 'GainNode-1748686283731-26',
              sourceOutput: 'output',
              targetInput: 'input',
            },
            {
              sourceNodeId: 'GainNode-1748686283731-26',
              targetNodeId: 'DelayNode-1748685958111-18',
              sourceOutput: 'output',
              targetInput: 'input',
            },
          ],
          customNodes: {
            'SliderNode-1748685942561-12': {
              id: 'SliderNode-1748685942561-12',
              type: 'SliderNode',
              properties: {
                min: 48,
                max: 84,
                step: 1,
                value: 58,
                label: 'MIDI Note',
              },
              outputs: {
                value: 58,
              },
            },
            'DisplayNode-1748685942566-13': {
              id: 'DisplayNode-1748685942566-13',
              type: 'DisplayNode',
              properties: {
                currentValue: 58,
                precision: 2,
                label: 'MIDI Value',
              },
              outputs: {
                output: 58,
              },
            },
            'MidiToFreqNode-1748685942567-14': {
              id: 'MidiToFreqNode-1748685942567-14',
              type: 'MidiToFreqNode',
              properties: {
                baseFreq: 440,
                baseMidi: 69,
              },
              outputs: {
                frequency: 233.08188075904496,
              },
            },
            'DisplayNode-1748685942567-15': {
              id: 'DisplayNode-1748685942567-15',
              type: 'DisplayNode',
              properties: {
                currentValue: 233.08188075904496,
                precision: 2,
                label: 'Frequency (Hz)',
              },
              outputs: {
                output: 233.08188075904496,
              },
            },
          },
        }

        // Apply the project snapshot to load all nodes and connections
        store.setLoadingProject(true)
        try {
          // Apply the snapshot using MST's applySnapshot
          const { applySnapshot } = await import('mobx-state-tree')
          applySnapshot(store, projectData)

          // Recreate the audio graph to ensure everything is connected properly
          await store.recreateAudioGraph()
        } catch (error) {
          console.warn('Failed to apply snapshot, falling back to manual creation:', error)
          // Fallback: create a simpler version manually
          const sliderId = store.addNode('SliderNode', { x: 385, y: 261 })
          const displayId = store.addNode('DisplayNode', { x: 150, y: 263 })
          const midiToFreqId = store.addNode('MidiToFreqNode', { x: 117, y: 71 })
          const freqDisplayId = store.addNode('DisplayNode', { x: 331, y: 58 })
          const oscId = store.addNode('OscillatorNode', { x: 543, y: -28 })
          const gainId = store.addNode('GainNode', { x: 785, y: -20 })
          const destId = store.addNode('AudioDestinationNode', { x: 1025, y: 54 })

          // Configure nodes with labels
          store.updateNodeProperty(sliderId, 'min', 48)
          store.updateNodeProperty(sliderId, 'max', 84)
          store.updateNodeProperty(sliderId, 'value', 58)
          store.updateNodeProperty(sliderId, 'label', 'MIDI Note')
          store.updateNodeProperty(displayId, 'label', 'MIDI Value')
          store.updateNodeProperty(freqDisplayId, 'label', 'Frequency (Hz)')
          store.updateNodeProperty(oscId, 'type', 'sawtooth')
          store.updateNodeProperty(gainId, 'gain', 0.61)

          // Create connections
          store.addEdge(sliderId, displayId, 'value', 'input')
          store.addEdge(displayId, midiToFreqId, 'output', 'midiNote')
          store.addEdge(midiToFreqId, freqDisplayId, 'frequency', 'input')
          store.addEdge(freqDisplayId, oscId, 'output', 'frequency')
          store.addEdge(oscId, gainId, 'output', 'input')
          store.addEdge(gainId, destId, 'output', 'input')
        } finally {
          store.setLoadingProject(false)
        }
      }),
    },
    {
      id: 'basic-oscillator',
      name: 'Basic Oscillator',
      description: 'Simple sine wave connected to output',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const gainId = store.addNode('GainNode', { x: 350, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 600, y: 150 })

        console.log('Basic Oscillator: Setting gain value...')
        store.updateNodeProperty(gainId, 'gain', 0.5)
        console.log('Basic Oscillator: Connecting to destination...')
        store.addEdge(oscId, gainId, 'output', 'input')
        store.addEdge(gainId, destId, 'output', 'input')
      }),
    },
    {
      id: 'microphone-input',
      name: 'Microphone Input with Delay',
      description: 'Live microphone input with delay and feedback',
      create: createExample(async () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        try {
          // Use the store's microphone input action which handles permissions
          const micId = await store.addMicrophoneInput({ x: 100, y: 150 })
          const micGainId = store.addNode('GainNode', { x: 350, y: 150 })
          const delayId = store.addNode('DelayNode', { x: 650, y: 150 })
          const feedbackId = store.addNode('GainNode', { x: 650, y: 350 })
          const destId = store.addNode('AudioDestinationNode', { x: 950, y: 150 })

          console.log('Microphone Input: Setting up delay effect...')
          // Set microphone gain to 0.5 (sound generator rule)
          store.updateNodeProperty(micGainId, 'gain', 0.5)
          // Set delay time and feedback gain
          store.updateNodeProperty(delayId, 'delayTime', 0.3)
          store.updateNodeProperty(feedbackId, 'gain', 0.7)

          // Connect the nodes
          console.log('Microphone Input: Connecting main audio chain...')
          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, delayId, 'output', 'input')
          store.addEdge(delayId, destId, 'output', 'input')

          console.log('Microphone Input: Connecting feedback loop...')
          store.addEdge(delayId, feedbackId, 'output', 'input')
          store.addEdge(feedbackId, delayId, 'output', 'input')
        } catch (error) {
          console.error('Failed to create microphone input example:', error)
          // Show user-friendly error message
          alert(
            'Microphone access denied or not available. Please allow microphone access and try again.'
          )
        }
      }),
    },
    {
      id: 'sound-file-player',
      name: 'Sound File Player',
      description: 'Button-triggered sound file playback with sample audio',
      create: createExample(async () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const soundFileId = store.addNode('SoundFileNode', { x: 629, y: 117 })
        const buttonId = store.addNode('ButtonNode', { x: 350, y: 100 })
        const destId = store.addNode('AudioDestinationNode', { x: 1015, y: 162 })

        console.log('Sound File Player: Setting up button...')
        store.updateNodeProperty(buttonId, 'label', 'Play Sound')
        store.updateNodeProperty(buttonId, 'outputValue', 1)

        console.log('Sound File Player: Setting up sound file node...')
        store.updateNodeProperty(soundFileId, 'gain', 1)
        store.updateNodeProperty(soundFileId, 'loop', false)
        store.updateNodeProperty(soundFileId, 'playbackRate', 1)
        // Set the filename property early so it shows in the UI
        store.updateNodeProperty(soundFileId, 'fileName', 'test-sound.wav')

        // Connect the nodes
        console.log('Sound File Player: Connecting button to sound file...')
        store.addEdge(buttonId, soundFileId, 'trigger', 'trigger')

        console.log('Sound File Player: Connecting sound file to destination...')
        store.addEdge(soundFileId, destId, 'output', 'input')

        // Load the sample audio file
        try {
          console.log('Sound File Player: Loading sample audio...')
          const response = await fetch('./samples/test-sound.wav')
          if (!response.ok) {
            throw new Error(`Failed to load sample: ${response.statusText}`)
          }

          const blob = await response.blob()
          const file = new File([blob], 'test-sound.wav', { type: 'audio/wav' })

          // Get the custom node and load the file
          const customNode = store.customNodes.get(soundFileId)
          if (customNode && customNode.loadAudioFile) {
            await customNode.loadAudioFile(file)
            console.log('Sound File Player: Sample audio loaded successfully')
          }
        } catch (error) {
          console.error('Sound File Player: Failed to load sample audio:', error)
          console.log('You can still upload your own audio file using the file input')
        }
      }),
    },
    {
      id: 'auto-file-player',
      name: 'Auto File Player',
      description: 'Timer-triggered automatic sound file playback with sample audio',
      create: createExample(async () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const soundFileId = store.addNode('SoundFileNode', { x: 629, y: 117 })
        const timerId = store.addNode('TimerNode', { x: 350, y: 100 })
        const destId = store.addNode('AudioDestinationNode', { x: 1015, y: 162 })

        console.log('Auto File Player: Setting up timer...')
        store.updateNodeProperty(timerId, 'mode', 'loop')
        store.updateNodeProperty(timerId, 'delay', 1000) // 1 second initial delay
        store.updateNodeProperty(timerId, 'interval', 3000) // Play every 3 seconds
        store.updateNodeProperty(timerId, 'startMode', 'auto')
        store.updateNodeProperty(timerId, 'enabled', 'true')

        console.log('Auto File Player: Setting up sound file node...')
        store.updateNodeProperty(soundFileId, 'gain', 1)
        store.updateNodeProperty(soundFileId, 'loop', false)
        store.updateNodeProperty(soundFileId, 'playbackRate', 1)
        // Set the filename property early so it shows in the UI
        store.updateNodeProperty(soundFileId, 'fileName', 'test-sound.wav')

        // Connect the nodes
        console.log('Auto File Player: Connecting timer to sound file...')
        store.addEdge(timerId, soundFileId, 'trigger', 'trigger')

        console.log('Auto File Player: Connecting sound file to destination...')
        store.addEdge(soundFileId, destId, 'output', 'input')

        // Load the sample audio file
        try {
          console.log('Auto File Player: Loading sample audio...')
          const response = await fetch('./samples/test-sound.wav')
          if (!response.ok) {
            throw new Error(`Failed to load sample: ${response.statusText}`)
          }

          const blob = await response.blob()
          const file = new File([blob], 'test-sound.wav', { type: 'audio/wav' })

          // Get the custom node and load the file
          const customNode = store.customNodes.get(soundFileId)
          if (customNode && customNode.loadAudioFile) {
            await customNode.loadAudioFile(file)
            console.log('Auto File Player: Sample audio loaded successfully')
          }
        } catch (error) {
          console.error('Auto File Player: Failed to load sample audio:', error)
          console.log('You can still upload your own audio file using the file input')
        }
      }),
    },
    {
      id: 'delay-effect',
      name: 'Delay Effect',
      description: 'Oscillator with delay and feedback',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addNode('GainNode', { x: 350, y: 150 })
        const delayId = store.addNode('DelayNode', { x: 650, y: 150 })
        const feedbackId = store.addNode('GainNode', { x: 650, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 950, y: 150 })

        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)
        // Set delay time and feedback gain
        store.updateNodeProperty(delayId, 'delayTime', 0.3)
        store.updateNodeProperty(feedbackId, 'gain', 1)

        // Connect the nodes
        console.log('Delay Effect: Connecting main audio chain...')
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, delayId, 'output', 'input')
        store.addEdge(delayId, destId, 'output', 'input')

        console.log('Delay Effect: Connecting feedback loop...')
        store.addEdge(delayId, feedbackId, 'output', 'input')
        store.addEdge(feedbackId, delayId, 'output', 'input')
      }),
    },
    {
      id: 'filter-sweep',
      name: 'Filter Sweep',
      description: 'Oscillator with animated lowpass filter',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const oscGainId = store.addNode('GainNode', { x: 400, y: 100 })
        const filterId = store.addNode('BiquadFilterNode', { x: 700, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 400, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 1000, y: 100 })

        // Set up the main oscillator
        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        store.updateNodeProperty(oscId, 'frequency', 220)
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Set up the filter
        store.updateNodeProperty(filterId, 'type', 'lowpass')
        store.updateNodeProperty(filterId, 'frequency', 800)
        store.updateNodeProperty(filterId, 'Q', 10)

        // Set up the LFO for filter modulation
        store.updateNodeProperty(lfoId, 'frequency', 0.5)
        store.updateNodeProperty(lfoGainId, 'gain', 1)

        // Connect the audio chain
        console.log('Filter Sweep: Connecting main audio chain...')
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, filterId, 'output', 'input')
        store.addEdge(filterId, destId, 'output', 'input')

        // Connect the LFO to modulate filter frequency
        console.log('Filter Sweep: Connecting LFO modulation...')
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, filterId, 'output', 'frequency')
      }),
    },
    {
      id: 'stereo-panner',
      name: 'Stereo Panning',
      description: 'Oscillator with automated stereo panning effect',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addNode('GainNode', { x: 400, y: 150 })
        const pannerId = store.addNode('StereoPannerNode', { x: 700, y: 150 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 400, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 1000, y: 150 })

        // Set up the main oscillator
        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sine')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Set up the LFO for panning automation
        store.updateNodeProperty(lfoId, 'frequency', 0.2) // Slow panning
        store.updateNodeProperty(lfoGainId, 'gain', 1) // Full range panning

        // Set initial panning (will be modulated by LFO)
        store.updateNodeProperty(pannerId, 'pan', 0)

        // Connect the audio chain
        console.log('Stereo Panning: Connecting main audio chain...')
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, pannerId, 'output', 'input')
        store.addEdge(pannerId, destId, 'output', 'input')

        // Connect the LFO for panning modulation
        console.log('Stereo Panning: Connecting LFO modulation...')
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, pannerId, 'output', 'pan')
      }),
    },
    {
      id: 'compressor-effect',
      name: 'Compressor Effect',
      description: 'Oscillator with dynamic range compression',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addNode('GainNode', { x: 400, y: 150 })
        const compressorId = store.addNode('DynamicsCompressorNode', { x: 700, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 1000, y: 150 })

        // Set oscillator properties
        store.updateNodeProperty(oscId, 'frequency', 220)
        store.updateNodeProperty(oscId, 'type', 'square')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Set compressor properties
        store.updateNodeProperty(compressorId, 'threshold', -24)
        store.updateNodeProperty(compressorId, 'knee', 30)
        store.updateNodeProperty(compressorId, 'ratio', 12)
        store.updateNodeProperty(compressorId, 'attack', 0.003)
        store.updateNodeProperty(compressorId, 'release', 0.25)

        // Connect the nodes
        console.log('Compressor Effect: Connecting audio chain...')
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, compressorId, 'output', 'input')
        store.addEdge(compressorId, destId, 'output', 'input')
      }),
    },
    {
      id: 'tremolo-effect',
      name: 'Tremolo Effect',
      description: 'Oscillator with amplitude modulation',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const oscGainId = store.addNode('GainNode', { x: 400, y: 100 })
        const gainId = store.addNode('GainNode', { x: 700, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 400, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 1000, y: 100 })

        // Set up the main oscillator
        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sine')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Set up the tremolo gain node
        store.updateNodeProperty(gainId, 'gain', 0.5)

        // Set up the LFO for tremolo
        store.updateNodeProperty(lfoId, 'frequency', 5)
        store.updateNodeProperty(lfoGainId, 'gain', 0.3)

        // Connect the audio chain
        console.log('Tremolo Effect: Connecting main audio chain...')
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, gainId, 'output', 'input')
        store.addEdge(gainId, destId, 'output', 'input')

        // Connect the LFO for tremolo effect
        console.log('Tremolo Effect: Connecting LFO modulation...')
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, gainId, 'output', 'gain')
      }),
    },
    {
      id: 'ring-modulation',
      name: 'Ring Modulation',
      description: 'Two oscillators with ring modulation effect',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const osc1Id = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const osc1GainId = store.addNode('GainNode', { x: 400, y: 100 })
        const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const osc2GainId = store.addNode('GainNode', { x: 400, y: 350 })
        const gainId = store.addNode('GainNode', { x: 700, y: 225 })
        const destId = store.addNode('AudioDestinationNode', { x: 1000, y: 225 })

        // Set up the carrier oscillator
        store.updateNodeProperty(osc1Id, 'frequency', 440)
        store.updateNodeProperty(osc1Id, 'type', 'sine')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(osc1GainId, 'gain', 0.5)

        // Set up the modulator oscillator
        store.updateNodeProperty(osc2Id, 'frequency', 30)
        store.updateNodeProperty(osc2Id, 'type', 'sine')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(osc2GainId, 'gain', 0.5)

        // Set up the ring modulation gain node
        store.updateNodeProperty(gainId, 'gain', 0.5)

        // Connect for ring modulation
        console.log('Ring Modulation: Connecting audio chain...')
        store.addEdge(osc1Id, osc1GainId, 'output', 'input')
        store.addEdge(osc1GainId, gainId, 'output', 'input')
        store.addEdge(osc2Id, osc2GainId, 'output', 'input')
        store.addEdge(osc2GainId, gainId, 'output', 'gain')
        store.addEdge(gainId, destId, 'output', 'input')
      }),
    },
    {
      id: 'chord-synthesis',
      name: 'Chord Synthesis',
      description: 'Multiple oscillators creating a chord',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const osc1Id = store.addNode('OscillatorNode', { x: 100, y: 50 })
        const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 225 })
        const osc3Id = store.addNode('OscillatorNode', { x: 100, y: 400 })
        const gain1Id = store.addNode('GainNode', { x: 400, y: 50 })
        const gain2Id = store.addNode('GainNode', { x: 400, y: 225 })
        const gain3Id = store.addNode('GainNode', { x: 400, y: 400 })
        const mixerId = store.addNode('GainNode', { x: 700, y: 225 })
        const destId = store.addNode('AudioDestinationNode', { x: 1000, y: 225 })

        // Set up C major chord (C4, E4, G4)
        store.updateNodeProperty(osc1Id, 'frequency', 261.63) // C4
        store.updateNodeProperty(osc2Id, 'frequency', 329.63) // E4
        store.updateNodeProperty(osc3Id, 'frequency', 392.0) // G4

        // Set all oscillators to sine wave
        store.updateNodeProperty(osc1Id, 'type', 'sine')
        store.updateNodeProperty(osc2Id, 'type', 'sine')
        store.updateNodeProperty(osc3Id, 'type', 'sine')

        // Set individual gains to 0.5 (sound generator rule)
        store.updateNodeProperty(gain1Id, 'gain', 0.5)
        store.updateNodeProperty(gain2Id, 'gain', 0.5)
        store.updateNodeProperty(gain3Id, 'gain', 0.5)

        // Set mixer gain
        store.updateNodeProperty(mixerId, 'gain', 1)

        // Connect the chord
        console.log('Chord Synthesis: Connecting audio chain...')
        store.addEdge(osc1Id, gain1Id, 'output', 'input')
        store.addEdge(osc2Id, gain2Id, 'output', 'input')
        store.addEdge(osc3Id, gain3Id, 'output', 'input')
        store.addEdge(gain1Id, mixerId, 'output', 'input')
        store.addEdge(gain2Id, mixerId, 'output', 'input')
        store.addEdge(gain3Id, mixerId, 'output', 'input')
        store.addEdge(mixerId, destId, 'output', 'input')
      }),
    },
    {
      id: 'waveshaper-distortion',
      name: 'Waveshaper Distortion',
      description: 'Oscillator with waveshaper distortion effect',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addNode('GainNode', { x: 400, y: 150 })
        const gainId = store.addNode('GainNode', { x: 700, y: 150 })
        const waveshaperId = store.addNode('WaveShaperNode', { x: 1000, y: 150 })
        const outputGainId = store.addNode('GainNode', { x: 1300, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 1600, y: 150 })

        // Set up the oscillator
        store.updateNodeProperty(oscId, 'frequency', 220)
        store.updateNodeProperty(oscId, 'type', 'sine')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Set up the input gain (drive)
        store.updateNodeProperty(gainId, 'gain', 2)

        // Set up the output gain (to control volume after distortion)
        store.updateNodeProperty(outputGainId, 'gain', 0.3)

        // Connect the audio chain
        console.log('Waveshaper Distortion: Connecting audio chain...')
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, gainId, 'output', 'input')
        store.addEdge(gainId, waveshaperId, 'output', 'input')
        store.addEdge(waveshaperId, outputGainId, 'output', 'input')
        store.addEdge(outputGainId, destId, 'output', 'input')
      }),
    },
    {
      id: 'phaser-effect',
      name: 'Phaser Effect',
      description: 'Oscillator with phaser effect using multiple filters',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addNode('GainNode', { x: 400, y: 150 })
        const filter1Id = store.addNode('BiquadFilterNode', { x: 700, y: 100 })
        const filter2Id = store.addNode('BiquadFilterNode', { x: 700, y: 200 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 400 })
        const lfoGainId = store.addNode('GainNode', { x: 400, y: 400 })
        const mixerId = store.addNode('GainNode', { x: 1000, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 1300, y: 150 })

        // Set up the main oscillator
        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Set up the filters for phasing
        store.updateNodeProperty(filter1Id, 'type', 'allpass')
        store.updateNodeProperty(filter1Id, 'frequency', 1000)
        store.updateNodeProperty(filter1Id, 'Q', 1)

        store.updateNodeProperty(filter2Id, 'type', 'allpass')
        store.updateNodeProperty(filter2Id, 'frequency', 1000)
        store.updateNodeProperty(filter2Id, 'Q', 1)

        // Set up the LFO for phasing
        store.updateNodeProperty(lfoId, 'frequency', 0.5)
        store.updateNodeProperty(lfoGainId, 'gain', 1)

        // Set up the mixer
        store.updateNodeProperty(mixerId, 'gain', 0.5)

        // Connect the audio chain
        console.log('Phaser Effect: Connecting main audio chain...')
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, filter1Id, 'output', 'input')
        store.addEdge(filter1Id, filter2Id, 'output', 'input')
        store.addEdge(filter2Id, mixerId, 'output', 'input')
        store.addEdge(mixerId, destId, 'output', 'input')

        // Connect the LFO for phasing modulation
        console.log('Phaser Effect: Connecting LFO modulation...')
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, filter1Id, 'output', 'frequency')
        store.addEdge(lfoGainId, filter2Id, 'output', 'frequency')
      }),
    },
    {
      id: 'simple-noise',
      name: 'Simple Noise',
      description: 'White noise generator with filter',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        // Note: We'll use an AudioBufferSourceNode with noise data
        const noiseId = store.addNode('AudioBufferSourceNode', { x: 100, y: 150 })
        const noiseGainId = store.addNode('GainNode', { x: 400, y: 150 })
        const filterId = store.addNode('BiquadFilterNode', { x: 700, y: 150 })
        const gainId = store.addNode('GainNode', { x: 1000, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 1300, y: 150 })

        // Set noise gain to 0.5 (sound generator rule)
        store.updateNodeProperty(noiseGainId, 'gain', 0.5)

        // Set up the filter
        store.updateNodeProperty(filterId, 'type', 'lowpass')
        store.updateNodeProperty(filterId, 'frequency', 2000)
        store.updateNodeProperty(filterId, 'Q', 1)

        // Set up the output gain
        store.updateNodeProperty(gainId, 'gain', 0.3)

        // Connect the audio chain
        console.log('Simple Noise: Connecting audio chain...')
        store.addEdge(noiseId, noiseGainId, 'output', 'input')
        store.addEdge(noiseGainId, filterId, 'output', 'input')
        store.addEdge(filterId, gainId, 'output', 'input')
        store.addEdge(gainId, destId, 'output', 'input')
      }),
    },
    {
      id: 'amplitude-envelope',
      name: 'Amplitude Envelope',
      description: 'Oscillator with LFO envelope modulation',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const oscGainId = store.addNode('GainNode', { x: 400, y: 100 })
        const envelopeId = store.addNode('GainNode', { x: 700, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 400, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 1000, y: 100 })

        // Set up the main oscillator
        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Set up the envelope gain (base level)
        store.updateNodeProperty(envelopeId, 'gain', 0.3)

        // Set up the LFO for envelope modulation (slow attack/decay)
        store.updateNodeProperty(lfoId, 'frequency', 0.2) // Very slow for envelope effect
        store.updateNodeProperty(lfoGainId, 'gain', 0.3) // Modulation depth

        // Connect the audio chain
        console.log('Amplitude Envelope: Connecting audio chain...')
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, envelopeId, 'output', 'input')
        store.addEdge(envelopeId, destId, 'output', 'input')

        // Connect the LFO for envelope modulation
        console.log('Amplitude Envelope: Connecting LFO envelope...')
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, envelopeId, 'output', 'gain')
      }),
    },
    {
      id: 'beat-frequency',
      name: 'Beat Frequency',
      description: 'Two slightly detuned oscillators creating beats',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const osc1Id = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const gain1Id = store.addNode('GainNode', { x: 400, y: 100 })
        const gain2Id = store.addNode('GainNode', { x: 400, y: 350 })
        const mixerId = store.addNode('GainNode', { x: 700, y: 225 })
        const destId = store.addNode('AudioDestinationNode', { x: 1000, y: 225 })

        // Set up slightly detuned oscillators for beat frequency
        store.updateNodeProperty(osc1Id, 'frequency', 440) // A4
        store.updateNodeProperty(osc2Id, 'frequency', 444) // Slightly sharp A4 (4Hz beat)

        // Set both to sine waves
        store.updateNodeProperty(osc1Id, 'type', 'sine')
        store.updateNodeProperty(osc2Id, 'type', 'sine')

        // Set individual gains to 0.5 (sound generator rule)
        store.updateNodeProperty(gain1Id, 'gain', 0.5)
        store.updateNodeProperty(gain2Id, 'gain', 0.5)

        // Set mixer gain
        store.updateNodeProperty(mixerId, 'gain', 1)

        // Connect the audio chain
        console.log('Beat Frequency: Connecting audio chain...')
        store.addEdge(osc1Id, gain1Id, 'output', 'input')
        store.addEdge(osc2Id, gain2Id, 'output', 'input')
        store.addEdge(gain1Id, mixerId, 'output', 'input')
        store.addEdge(gain2Id, mixerId, 'output', 'input')
        store.addEdge(mixerId, destId, 'output', 'input')
      }),
    },
    {
      id: 'convolution-reverb',
      name: 'Convolution Reverb',
      description: 'Oscillator with convolution reverb effect',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addNode('GainNode', { x: 400, y: 150 })
        const gainId = store.addNode('GainNode', { x: 700, y: 150 })
        const reverbId = store.addNode('ConvolverNode', { x: 1000, y: 200 })
        const dryGainId = store.addNode('GainNode', { x: 1000, y: 50 })
        const wetGainId = store.addNode('GainNode', { x: 1000, y: 350 })
        const mixerId = store.addNode('GainNode', { x: 1300, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 1600, y: 150 })

        // Set up the oscillator
        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sine')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Set up the input gain
        store.updateNodeProperty(gainId, 'gain', 0.5)

        // Set up dry/wet mix
        store.updateNodeProperty(dryGainId, 'gain', 0.7) // Dry signal
        store.updateNodeProperty(wetGainId, 'gain', 0.3) // Wet signal

        // Set up the mixer
        store.updateNodeProperty(mixerId, 'gain', 1)

        // Connect the audio chain
        console.log('Convolution Reverb: Connecting audio chain...')
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, gainId, 'output', 'input')

        // Dry path
        store.addEdge(gainId, dryGainId, 'output', 'input')
        store.addEdge(dryGainId, mixerId, 'output', 'input')

        // Wet path (through reverb)
        store.addEdge(gainId, reverbId, 'output', 'input')
        store.addEdge(reverbId, wetGainId, 'output', 'input')
        store.addEdge(wetGainId, mixerId, 'output', 'input')

        // Output
        store.addEdge(mixerId, destId, 'output', 'input')
      }),
    },
    {
      id: 'microphone-reverb',
      name: 'Microphone Reverb',
      description: 'Live microphone input with convolution reverb effect',
      create: createExample(async () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        try {
          // Use the store's microphone input action which handles permissions
          const micId = await store.addMicrophoneInput({ x: 100, y: 150 })
          const micGainId = store.addNode('GainNode', { x: 400, y: 150 })
          const gainId = store.addNode('GainNode', { x: 700, y: 150 })
          const reverbId = store.addNode('ConvolverNode', { x: 1000, y: 200 })
          const dryGainId = store.addNode('GainNode', { x: 1000, y: 50 })
          const wetGainId = store.addNode('GainNode', { x: 1000, y: 350 })
          const mixerId = store.addNode('GainNode', { x: 1300, y: 150 })
          const destId = store.addNode('AudioDestinationNode', { x: 1600, y: 150 })

          // Set microphone gain to 0.5 (sound generator rule)
          store.updateNodeProperty(micGainId, 'gain', 0.5)

          // Set up the input gain (moderate to prevent feedback but allow reverb)
          store.updateNodeProperty(gainId, 'gain', 0.4)

          // Set up dry/wet mix (balanced for audible reverb without feedback)
          store.updateNodeProperty(dryGainId, 'gain', 0.6) // Dry signal
          store.updateNodeProperty(wetGainId, 'gain', 0.4) // Wet signal (increased for audible reverb)

          // Set up the mixer (moderate volume)
          store.updateNodeProperty(mixerId, 'gain', 0.7)

          // Connect the audio chain
          console.log('Microphone Reverb: Connecting audio chain...')
          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, gainId, 'output', 'input')

          // Dry path
          store.addEdge(gainId, dryGainId, 'output', 'input')
          store.addEdge(dryGainId, mixerId, 'output', 'input')

          // Wet path (through reverb)
          store.addEdge(gainId, reverbId, 'output', 'input')
          store.addEdge(reverbId, wetGainId, 'output', 'input')
          store.addEdge(wetGainId, mixerId, 'output', 'input')

          // Output
          store.addEdge(mixerId, destId, 'output', 'input')
        } catch (error) {
          console.error('Failed to create microphone reverb example:', error)
          // Show user-friendly error message
          alert(
            'Microphone access denied or not available. Please allow microphone access and try again.'
          )
        }
      }),
    },
    {
      id: 'stereo-effects',
      name: 'Stereo Effects',
      description: 'Stereo processing with channel splitting and merging',
      create: createExample(() => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 200 })
        const oscGainId = store.addNode('GainNode', { x: 400, y: 200 })
        const splitterId = store.addNode('ChannelSplitterNode', { x: 700, y: 200 })
        const leftGainId = store.addNode('GainNode', { x: 1000, y: 100 })
        const rightGainId = store.addNode('GainNode', { x: 1000, y: 300 })
        const mergerId = store.addNode('ChannelMergerNode', { x: 1300, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 1600, y: 200 })

        // Set up the oscillator
        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Set up different gains for left and right channels
        store.updateNodeProperty(leftGainId, 'gain', 0.8) // Left channel
        store.updateNodeProperty(rightGainId, 'gain', 0.4) // Right channel (quieter)

        // Connect the audio chain
        console.log('Stereo Effects: Connecting audio chain...')
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, splitterId, 'output', 'input')

        // Connect specific channels from splitter to gain nodes
        // output0 = left channel, output1 = right channel
        store.addEdge(splitterId, leftGainId, 'output0', 'input')
        store.addEdge(splitterId, rightGainId, 'output1', 'input')

        // Connect gain nodes to specific merger inputs
        // input0 = left channel, input1 = right channel
        store.addEdge(leftGainId, mergerId, 'output', 'input0')
        store.addEdge(rightGainId, mergerId, 'output', 'input1')

        // Connect merger to destination
        store.addEdge(mergerId, destId, 'output', 'input')
      }),
    },
    {
      id: 'robot-voice-ring-mod',
      name: 'Robot Voice (Ring Mod)',
      description: 'Transform your voice into a robot using ring modulation',
      create: createExample(async () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        try {
          // Use microphone input
          const micId = await store.addMicrophoneInput({ x: 100, y: 150 })
          const micGainId = store.addNode('GainNode', { x: 400, y: 150 })
          const carrierOscId = store.addNode('OscillatorNode', { x: 100, y: 400 })
          const carrierGainId = store.addNode('GainNode', { x: 400, y: 400 })
          const ringModId = store.addNode('GainNode', { x: 700, y: 275 })
          const outputGainId = store.addNode('GainNode', { x: 1000, y: 275 })
          const destId = store.addNode('AudioDestinationNode', { x: 1300, y: 275 })

          // Set microphone gain to 0.5 (sound generator rule)
          store.updateNodeProperty(micGainId, 'gain', 0.5)

          // Set up carrier oscillator for ring modulation (musical frequency)
          store.updateNodeProperty(carrierOscId, 'frequency', 200) // Low frequency for robot effect
          store.updateNodeProperty(carrierOscId, 'type', 'sine')
          // Set carrier oscillator gain to 0.5 (sound generator rule)
          store.updateNodeProperty(carrierGainId, 'gain', 0.5)

          // Set up ring modulator gain
          store.updateNodeProperty(ringModId, 'gain', 1)

          // Set up output gain
          store.updateNodeProperty(outputGainId, 'gain', 0.6)

          // Connect the audio chain for ring modulation
          console.log('Robot Voice (Ring Mod): Connecting audio chain...')
          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, ringModId, 'output', 'input')
          store.addEdge(carrierOscId, carrierGainId, 'output', 'input')
          store.addEdge(carrierGainId, ringModId, 'output', 'gain') // Ring modulation
          store.addEdge(ringModId, outputGainId, 'output', 'input')
          store.addEdge(outputGainId, destId, 'output', 'input')
        } catch (error) {
          console.error('Failed to create robot voice example:', error)
          alert('Microphone access denied. Please allow microphone access and try again.')
        }
      }),
    },
    {
      id: 'vocoder-voice',
      name: 'Vocoder Voice',
      description: 'Multi-band vocoder effect using multiple filters',
      create: createExample(async () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        try {
          // Use microphone input
          const micId = await store.addMicrophoneInput({ x: 100, y: 200 })
          const micGainId = store.addNode('GainNode', { x: 400, y: 200 })

          // Create multiple band-pass filters for vocoder bands
          const filter1Id = store.addNode('BiquadFilterNode', { x: 700, y: 100 })
          const filter2Id = store.addNode('BiquadFilterNode', { x: 700, y: 200 })
          const filter3Id = store.addNode('BiquadFilterNode', { x: 700, y: 300 })

          // Create oscillators for each band
          const osc1Id = store.addNode('OscillatorNode', { x: 100, y: 100 })
          const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 350 })
          const osc3Id = store.addNode('OscillatorNode', { x: 100, y: 600 })

          // Create gain nodes for oscillators (sound generator rule)
          const osc1GainId = store.addNode('GainNode', { x: 400, y: 100 })
          const osc2GainId = store.addNode('GainNode', { x: 400, y: 350 })
          const osc3GainId = store.addNode('GainNode', { x: 400, y: 600 })

          // Create gain nodes for each band (controlled by filtered voice)
          const band1GainId = store.addNode('GainNode', { x: 1000, y: 100 })
          const band2GainId = store.addNode('GainNode', { x: 1000, y: 200 })
          const band3GainId = store.addNode('GainNode', { x: 1000, y: 300 })

          // Create mixer and output
          const mixerId = store.addNode('GainNode', { x: 1300, y: 200 })
          const destId = store.addNode('AudioDestinationNode', { x: 1600, y: 200 })

          // Set microphone gain to 0.5 (sound generator rule)
          store.updateNodeProperty(micGainId, 'gain', 0.5)

          // Set up band-pass filters for different frequency ranges
          store.updateNodeProperty(filter1Id, 'type', 'bandpass')
          store.updateNodeProperty(filter1Id, 'frequency', 300) // Low band
          store.updateNodeProperty(filter1Id, 'Q', 3)

          store.updateNodeProperty(filter2Id, 'type', 'bandpass')
          store.updateNodeProperty(filter2Id, 'frequency', 1000) // Mid band
          store.updateNodeProperty(filter2Id, 'Q', 3)

          store.updateNodeProperty(filter3Id, 'type', 'bandpass')
          store.updateNodeProperty(filter3Id, 'frequency', 3000) // High band
          store.updateNodeProperty(filter3Id, 'Q', 3)

          // Set up oscillators with harmonic frequencies
          store.updateNodeProperty(osc1Id, 'frequency', 110) // A2
          store.updateNodeProperty(osc1Id, 'type', 'sine')

          store.updateNodeProperty(osc2Id, 'frequency', 220) // A3
          store.updateNodeProperty(osc2Id, 'type', 'sine')

          store.updateNodeProperty(osc3Id, 'frequency', 440) // A4
          store.updateNodeProperty(osc3Id, 'type', 'sine')

          // Set oscillator gains to 0.5 (sound generator rule)
          store.updateNodeProperty(osc1GainId, 'gain', 0.5)
          store.updateNodeProperty(osc2GainId, 'gain', 0.5)
          store.updateNodeProperty(osc3GainId, 'gain', 0.5)

          // Set up band gains (start with low values to avoid noise)
          store.updateNodeProperty(band1GainId, 'gain', 0.1)
          store.updateNodeProperty(band2GainId, 'gain', 0.1)
          store.updateNodeProperty(band3GainId, 'gain', 0.1)

          // Set up mixer
          store.updateNodeProperty(mixerId, 'gain', 0.3)

          // Connect the vocoder chain
          console.log('Vocoder Voice: Connecting audio chain...')

          // Voice input to filters
          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, filter1Id, 'output', 'input')
          store.addEdge(micGainId, filter2Id, 'output', 'input')
          store.addEdge(micGainId, filter3Id, 'output', 'input')

          // Oscillators to their gain nodes first
          store.addEdge(osc1Id, osc1GainId, 'output', 'input')
          store.addEdge(osc2Id, osc2GainId, 'output', 'input')
          store.addEdge(osc3Id, osc3GainId, 'output', 'input')

          // Oscillator gains to band gains
          store.addEdge(osc1GainId, band1GainId, 'output', 'input')
          store.addEdge(osc2GainId, band2GainId, 'output', 'input')
          store.addEdge(osc3GainId, band3GainId, 'output', 'input')

          // Filtered voice controls band gains (simplified vocoder)
          store.addEdge(filter1Id, band1GainId, 'output', 'gain')
          store.addEdge(filter2Id, band2GainId, 'output', 'gain')
          store.addEdge(filter3Id, band3GainId, 'output', 'gain')

          // Mix all bands
          store.addEdge(band1GainId, mixerId, 'output', 'input')
          store.addEdge(band2GainId, mixerId, 'output', 'input')
          store.addEdge(band3GainId, mixerId, 'output', 'input')

          // Output
          store.addEdge(mixerId, destId, 'output', 'input')
        } catch (error) {
          console.error('Failed to create vocoder voice example:', error)
          alert('Microphone access denied. Please allow microphone access and try again.')
        }
      }),
    },
    {
      id: 'voice-harmonizer',
      name: 'Voice Harmonizer',
      description: 'Layer your voice with musical harmonies',
      create: createExample(async () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        try {
          // Use microphone input
          const micId = await store.addMicrophoneInput({ x: 100, y: 200 })
          const micGainId = store.addNode('GainNode', { x: 400, y: 200 })

          // Create harmony oscillators (3rd and 5th intervals)
          const harmony3rdId = store.addNode('OscillatorNode', { x: 100, y: 400 })
          const harmony5thId = store.addNode('OscillatorNode', { x: 100, y: 600 })

          // Create gain nodes for oscillators (sound generator rule)
          const harmony3rdGainId = store.addNode('GainNode', { x: 400, y: 400 })
          const harmony5thGainId = store.addNode('GainNode', { x: 400, y: 600 })

          // Create gain node for voice level control
          const voiceGainId = store.addNode('GainNode', { x: 700, y: 200 })

          // Create mixer and output
          const mixerId = store.addNode('GainNode', { x: 1000, y: 400 })
          const destId = store.addNode('AudioDestinationNode', { x: 1300, y: 400 })

          // Set microphone gain to 0.5 (sound generator rule)
          store.updateNodeProperty(micGainId, 'gain', 0.5)

          // Set up harmony oscillators (C major chord: C-E-G)
          store.updateNodeProperty(harmony3rdId, 'frequency', 329.63) // E4 (major 3rd)
          store.updateNodeProperty(harmony3rdId, 'type', 'sine')

          store.updateNodeProperty(harmony5thId, 'frequency', 392.0) // G4 (perfect 5th)
          store.updateNodeProperty(harmony5thId, 'type', 'sine')

          // Set oscillator gains to 0.5 (sound generator rule) but adjust harmony levels
          store.updateNodeProperty(harmony3rdGainId, 'gain', 0.15) // Lower harmony level
          store.updateNodeProperty(harmony5thGainId, 'gain', 0.15) // Lower harmony level

          // Set up voice levels
          store.updateNodeProperty(voiceGainId, 'gain', 0.7) // Original voice

          // Set up mixer
          store.updateNodeProperty(mixerId, 'gain', 0.8)

          // Connect the harmonizer chain (no redundant gains)
          console.log('Voice Harmonizer: Connecting audio chain...')

          // Voice path
          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, voiceGainId, 'output', 'input')
          store.addEdge(voiceGainId, mixerId, 'output', 'input')

          // Harmony paths - direct connection from oscillator gains to mixer
          store.addEdge(harmony3rdId, harmony3rdGainId, 'output', 'input')
          store.addEdge(harmony5thId, harmony5thGainId, 'output', 'input')
          store.addEdge(harmony3rdGainId, mixerId, 'output', 'input')
          store.addEdge(harmony5thGainId, mixerId, 'output', 'input')

          // Output
          store.addEdge(mixerId, destId, 'output', 'input')
        } catch (error) {
          console.error('Failed to create voice harmonizer example:', error)
          alert('Microphone access denied. Please allow microphone access and try again.')
        }
      }),
    },
    {
      id: 'voice-pitch-shifter',
      name: 'Voice Pitch Shifter',
      description: 'Pitch shift your voice using delay-based modulation',
      create: createExample(async () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        try {
          // Use microphone input
          const micId = await store.addMicrophoneInput({ x: 100, y: 200 })
          const micGainId = store.addNode('GainNode', { x: 400, y: 200 })

          // Create delay-based pitch shifting
          const delayId = store.addNode('DelayNode', { x: 700, y: 200 })
          const lfoId = store.addNode('OscillatorNode', { x: 700, y: 400 })
          const lfoGainId = store.addNode('GainNode', { x: 1000, y: 400 })

          // Create dry/wet mix
          const dryGainId = store.addNode('GainNode', { x: 1000, y: 100 })
          const wetGainId = store.addNode('GainNode', { x: 1000, y: 300 })
          const mixerId = store.addNode('GainNode', { x: 1300, y: 200 })
          const destId = store.addNode('AudioDestinationNode', { x: 1600, y: 200 })

          // Set microphone gain to 0.5 (sound generator rule)
          store.updateNodeProperty(micGainId, 'gain', 0.5)

          // Set up delay for pitch shifting
          store.updateNodeProperty(delayId, 'delayTime', 0.02) // 20ms base delay

          // Set up LFO for pitch modulation
          store.updateNodeProperty(lfoId, 'frequency', 6) // 6Hz modulation
          store.updateNodeProperty(lfoId, 'type', 'sine')
          store.updateNodeProperty(lfoGainId, 'gain', 0.005) // Small modulation depth

          // Set up dry/wet mix
          store.updateNodeProperty(dryGainId, 'gain', 0.3) // Less dry signal
          store.updateNodeProperty(wetGainId, 'gain', 0.7) // More wet signal

          // Set up mixer
          store.updateNodeProperty(mixerId, 'gain', 0.8)

          // Connect the pitch shifter chain
          console.log('Voice Pitch Shifter: Connecting audio chain...')
          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, dryGainId, 'output', 'input')
          store.addEdge(micGainId, delayId, 'output', 'input')
          store.addEdge(delayId, wetGainId, 'output', 'input')

          // Connect dry and wet to mixer
          store.addEdge(dryGainId, mixerId, 'output', 'input')
          store.addEdge(wetGainId, mixerId, 'output', 'input')
          store.addEdge(mixerId, destId, 'output', 'input')

          // Connect LFO modulation to delay time
          console.log('Voice Pitch Shifter: Connecting LFO modulation...')
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, delayId, 'output', 'delayTime')
        } catch (error) {
          console.error('Failed to create voice pitch shifter example:', error)
          alert('Microphone access denied. Please allow microphone access and try again.')
        }
      }),
    },
  ]

  return { examples }
}
