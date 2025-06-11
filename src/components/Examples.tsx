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
      store.clearAllNodes()

      setTimeout(async () => {
        try {
          await exampleFn()
        } finally {
          // Always reset the flag, even if there's an error
          store.setCreatingExample(false)
        }
      }, 1)
    }
  }

  const examples: Example[] = [
    {
      id: 'vintage-analog-synth',
      name: 'Vintage Analog Synth',
      description:
        'Classic analog synthesizer with multiple oscillators, resonant filter, delay, and automated sequences',
      create: createExample(() => {
        // Timer for automated triggering
        const timerId = store.addAdaptedNode('TimerNode', { x: 50, y: 50 })

        // Note control using MIDI to Frequency conversion
        const noteSlider = store.addAdaptedNode('SliderNode', { x: 50, y: 200 })
        const midiToFreqId = store.addAdaptedNode('MidiToFreqNode', { x: 300, y: 200 })

        // Envelope gain node controlled by timer
        const envelopeGainId = store.addAdaptedNode('GainNode', { x: 800, y: 50 })

        // Multiple oscillators for rich vintage sound
        const osc1Id = store.addAdaptedNode('OscillatorNode', { x: 550, y: 100 })
        const osc2Id = store.addAdaptedNode('OscillatorNode', { x: 550, y: 200 })
        const osc3Id = store.addAdaptedNode('OscillatorNode', { x: 550, y: 300 })

        // Individual gain controls for oscillators (sound generator rule)
        const osc1GainId = store.addAdaptedNode('GainNode', { x: 800, y: 100 })
        const osc2GainId = store.addAdaptedNode('GainNode', { x: 800, y: 200 })
        const osc3GainId = store.addAdaptedNode('GainNode', { x: 800, y: 300 })

        // Mixer for combining oscillators
        const mixerId = store.addAdaptedNode('GainNode', { x: 1050, y: 200 })

        // Resonant filter (the heart of vintage analog sound!)
        const filterId = store.addAdaptedNode('BiquadFilterNode', { x: 1300, y: 200 })

        // LFO for filter modulation
        const lfoId = store.addAdaptedNode('OscillatorNode', { x: 1050, y: 400 })
        const lfoGainId = store.addAdaptedNode('GainNode', { x: 1300, y: 400 })

        // Delay for vintage echo
        const delayId = store.addAdaptedNode('DelayNode', { x: 1550, y: 200 })
        const feedbackId = store.addAdaptedNode('GainNode', { x: 1550, y: 400 })

        // Final output gain
        const outputGainId = store.addAdaptedNode('GainNode', { x: 1800, y: 200 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 2050, y: 200 })

        // User controls
        const filterCutoffSliderId = store.addAdaptedNode('SliderNode', { x: 50, y: 350 })
        const filterResSliderId = store.addAdaptedNode('SliderNode', { x: 50, y: 500 })

        // Timer settings for automatic note triggering
        store.updateNodeProperty(timerId, 'mode', 'loop')
        store.updateNodeProperty(timerId, 'delay', 500)
        store.updateNodeProperty(timerId, 'interval', 2000)
        store.updateNodeProperty(timerId, 'startMode', 'auto')

        // Note slider (MIDI note range)
        store.updateNodeProperty(noteSlider, 'min', 36) // C2
        store.updateNodeProperty(noteSlider, 'max', 84) // C6
        store.updateNodeProperty(noteSlider, 'value', 45) // A2
        store.updateNodeProperty(noteSlider, 'step', 1)
        store.updateNodeProperty(noteSlider, 'label', 'Note (MIDI)')

        // MIDI to Frequency converter
        store.updateNodeProperty(midiToFreqId, 'baseFreq', 440)
        store.updateNodeProperty(midiToFreqId, 'baseMidi', 69)

        // Envelope gain - this will be modulated by timer but needs a base level for sound
        store.updateNodeProperty(envelopeGainId, 'gain', 0.8)

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

        // Resonant lowpass filter (classic analog sound!)
        store.updateNodeProperty(filterId, 'type', 'lowpass')
        store.updateNodeProperty(filterId, 'frequency', 800)
        store.updateNodeProperty(filterId, 'Q', 15) // High resonance for vintage character

        // LFO for filter sweep
        store.updateNodeProperty(lfoId, 'frequency', 0.3) // Slow sweep
        store.updateNodeProperty(lfoId, 'type', 'sine')
        store.updateNodeProperty(lfoGainId, 'gain', 400) // Modulation depth

        // Vintage delay
        store.updateNodeProperty(delayId, 'delayTime', 0.25) // 250ms
        store.updateNodeProperty(feedbackId, 'gain', 0.4) // Moderate feedback

        // Output gain
        store.updateNodeProperty(outputGainId, 'gain', 0.6)

        // User control sliders with proper labels
        store.updateNodeProperty(filterCutoffSliderId, 'min', 200)
        store.updateNodeProperty(filterCutoffSliderId, 'max', 4000)
        store.updateNodeProperty(filterCutoffSliderId, 'value', 800)
        store.updateNodeProperty(filterCutoffSliderId, 'label', 'Filter Cutoff')

        store.updateNodeProperty(filterResSliderId, 'min', 1)
        store.updateNodeProperty(filterResSliderId, 'max', 30)
        store.updateNodeProperty(filterResSliderId, 'value', 15)
        store.updateNodeProperty(filterResSliderId, 'label', 'Resonance')

        // Connect note control chain
        store.addEdge(noteSlider, midiToFreqId, 'value', 'midiNote')
        store.addEdge(midiToFreqId, osc1Id, 'frequency', 'frequency')
        store.addEdge(midiToFreqId, osc2Id, 'frequency', 'frequency') // Will add slight detune
        store.addEdge(midiToFreqId, osc3Id, 'frequency', 'frequency') // Will be doubled for octave

        // Connect timer to create rhythmic filter sweeps - timer triggers will add to the LFO modulation
        store.addEdge(timerId, filterId, 'trigger', 'frequency')

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
      }),
    },
    {
      id: 'midi-to-frequency',
      name: 'MIDI to Frequency',
      description: 'Control oscillator frequency with a slider via MIDI note conversion',
      create: createExample(() => {
        const sliderId = store.addAdaptedNode('SliderNode', {
          x: -2.6200660464996304,
          y: -27.92407649604229,
        })
        const displayNode1Id = store.addAdaptedNode('DisplayNode', {
          x: -0.683888634989259,
          y: 194.5119899292198,
        })
        const midiToFreqId = store.addAdaptedNode('MidiToFreqNode', {
          x: 255.03647005056547,
          y: -12.888551203235835,
        })
        const displayNode2Id = store.addAdaptedNode('DisplayNode', {
          x: 283.60216452982104,
          y: 200.40628596561203,
        })
        const oscId = store.addAdaptedNode('OscillatorNode', {
          x: 543.047959716879,
          y: -28.436677674416615,
        })
        const destId = store.addAdaptedNode('AudioDestinationNode', {
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
        // Fallback: create a simpler version manually
        const sliderId = store.addAdaptedNode('SliderNode', { x: 385, y: 261 })
        const displayId = store.addAdaptedNode('DisplayNode', { x: 150, y: 263 })
        const midiToFreqId = store.addAdaptedNode('MidiToFreqNode', { x: 117, y: 71 })
        const freqDisplayId = store.addAdaptedNode('DisplayNode', { x: 331, y: 58 })
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 543, y: -28 })
        const gainId = store.addAdaptedNode('GainNode', { x: 785, y: -20 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1025, y: 54 })
        const delayId = store.addAdaptedNode('DelayNode', { x: 1025, y: 200 })
        const feedbackId = store.addAdaptedNode('GainNode', { x: 800, y: 200 })

        // Configure nodes with labels
        store.updateNodeProperty(sliderId, 'min', 48)
        store.updateNodeProperty(sliderId, 'max', 84)
        store.updateNodeProperty(sliderId, 'value', 58)
        store.updateNodeProperty(sliderId, 'label', 'MIDI Note')
        store.updateNodeProperty(displayId, 'label', 'MIDI Value')
        store.updateNodeProperty(freqDisplayId, 'label', 'Frequency (Hz)')
        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        store.updateNodeProperty(gainId, 'gain', 0.61)
        // Vintage delay with feedback
        store.updateNodeProperty(delayId, 'delayTime', 0.7)
        store.updateNodeProperty(feedbackId, 'gain', 0.4) // Moderate feedback
        // Create connections
        store.addEdge(sliderId, displayId, 'value', 'input')
        store.addEdge(displayId, midiToFreqId, 'output', 'midiNote')
        store.addEdge(midiToFreqId, freqDisplayId, 'frequency', 'input')
        store.addEdge(freqDisplayId, oscId, 'output', 'frequency')
        store.addEdge(oscId, gainId, 'output', 'input')
        store.addEdge(gainId, destId, 'output', 'input')
        store.addEdge(gainId, delayId, 'output', 'input')

        store.addEdge(delayId, feedbackId, 'output', 'input')
        store.addEdge(feedbackId, delayId, 'output', 'input')
        store.addEdge(delayId, destId, 'output', 'input')
      }),
    },
    {
      id: 'midi-pentatonic',
      name: 'MIDI Pentatonic',
      description:
        'Pentatonic scale synthesizer with multiple oscillators, resonant filter, and delay effects',
      create: createExample(() => {
        // Note control slider
        const noteSlider = store.addAdaptedNode('SliderNode', { x: -216, y: 118 })

        // Scale to MIDI converter for pentatonic scale
        const scaleToMidiId = store.addAdaptedNode('ScaleToMidiNode', { x: 22, y: 112 })

        // MIDI to frequency converter
        const midiToFreqId = store.addAdaptedNode('MidiToFreqNode', { x: 272, y: 138 })

        // Multiple oscillators for rich sound
        const osc1Id = store.addAdaptedNode('OscillatorNode', { x: 776, y: -4 })
        const osc2Id = store.addAdaptedNode('OscillatorNode', { x: 706, y: 176 })
        const osc3Id = store.addAdaptedNode('OscillatorNode', { x: 360, y: 442 })

        // Individual gain controls for oscillators
        const osc1GainId = store.addAdaptedNode('GainNode', { x: 1084, y: -26 })
        const osc2GainId = store.addAdaptedNode('GainNode', { x: 698, y: 420 })
        const osc3GainId = store.addAdaptedNode('GainNode', { x: 598, y: 706 })

        // Mixer for combining oscillators
        const mixerId = store.addAdaptedNode('GainNode', { x: 980, y: 586 })
        const mainGainId = store.addAdaptedNode('GainNode', { x: 1012, y: 410 })

        // Resonant filter
        const filterId = store.addAdaptedNode('BiquadFilterNode', { x: 1338, y: 138 })

        // LFO for filter modulation
        const lfoId = store.addAdaptedNode('OscillatorNode', { x: 378, y: -112 })
        const lfoGainId = store.addAdaptedNode('GainNode', { x: 968, y: -252 })

        // Delay effect
        const delayId = store.addAdaptedNode('DelayNode', { x: 1566, y: 206 })
        const delayGainId = store.addAdaptedNode('GainNode', { x: 1558, y: -54 })
        const feedbackId = store.addAdaptedNode('GainNode', { x: 1556, y: 458 })

        // Output
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1836, y: 296 })

        // User control sliders
        const filterCutoffSlider = store.addAdaptedNode('SliderNode', { x: -111, y: 396 })
        const filterResSlider = store.addAdaptedNode('SliderNode', { x: -46, y: 658 })

        // Configure note slider
        store.updateNodeProperty(noteSlider, 'min', -10)
        store.updateNodeProperty(noteSlider, 'max', 10)
        store.updateNodeProperty(noteSlider, 'value', 0)
        store.updateNodeProperty(noteSlider, 'step', 1)
        store.updateNodeProperty(noteSlider, 'label', 'Note (MIDI)')

        // Configure scale to MIDI converter for pentatonic minor
        store.updateNodeProperty(scaleToMidiId, 'scaleDegree', 0)
        store.updateNodeProperty(scaleToMidiId, 'key', 'C')
        store.updateNodeProperty(scaleToMidiId, 'mode', 'pentatonic_minor')
        store.updateNodeProperty(scaleToMidiId, 'midiNote', 60)

        // Configure MIDI to frequency converter
        store.updateNodeProperty(midiToFreqId, 'midiNote', 60)
        store.updateNodeProperty(midiToFreqId, 'frequency', 261.63)
        store.updateNodeProperty(midiToFreqId, 'baseFreq', 440)
        store.updateNodeProperty(midiToFreqId, 'baseMidi', 69)

        // Configure oscillators
        store.updateNodeProperty(osc1Id, 'frequency', 110)
        store.updateNodeProperty(osc1Id, 'type', 'sawtooth')
        store.updateNodeProperty(osc1Id, 'detune', null)

        store.updateNodeProperty(osc2Id, 'frequency', 110.5)
        store.updateNodeProperty(osc2Id, 'type', 'sawtooth')
        store.updateNodeProperty(osc2Id, 'detune', null)

        store.updateNodeProperty(osc3Id, 'frequency', 220)
        store.updateNodeProperty(osc3Id, 'type', 'square')
        store.updateNodeProperty(osc3Id, 'detune', null)

        // Configure oscillator gains
        store.updateNodeProperty(osc1GainId, 'gain', 0.3)
        store.updateNodeProperty(osc2GainId, 'gain', 0.2)
        store.updateNodeProperty(osc3GainId, 'gain', 0.15)

        // Configure mixer and main gain
        store.updateNodeProperty(mixerId, 'gain', 1)
        store.updateNodeProperty(mainGainId, 'gain', 0.8)

        // Configure resonant filter
        store.updateNodeProperty(filterId, 'type', 'lowpass')
        store.updateNodeProperty(filterId, 'frequency', 800)
        store.updateNodeProperty(filterId, 'Q', 15)
        store.updateNodeProperty(filterId, 'gain', 1)
        store.updateNodeProperty(filterId, 'detune', null)

        // Configure LFO for filter modulation
        store.updateNodeProperty(lfoId, 'frequency', 0.3)
        store.updateNodeProperty(lfoId, 'type', 'sine')
        store.updateNodeProperty(lfoId, 'detune', null)
        store.updateNodeProperty(lfoGainId, 'gain', 400)

        // Configure delay
        store.updateNodeProperty(delayId, 'delayTime', 0.25)
        store.updateNodeProperty(delayGainId, 'gain', 0.4)
        store.updateNodeProperty(feedbackId, 'gain', 0.2)

        // Configure user control sliders
        store.updateNodeProperty(filterCutoffSlider, 'min', 200)
        store.updateNodeProperty(filterCutoffSlider, 'max', 4000)
        store.updateNodeProperty(filterCutoffSlider, 'value', 3185)
        store.updateNodeProperty(filterCutoffSlider, 'step', 1)
        store.updateNodeProperty(filterCutoffSlider, 'label', 'Filter Cutoff')

        store.updateNodeProperty(filterResSlider, 'min', 1)
        store.updateNodeProperty(filterResSlider, 'max', 30)
        store.updateNodeProperty(filterResSlider, 'value', 30)
        store.updateNodeProperty(filterResSlider, 'step', 1)
        store.updateNodeProperty(filterResSlider, 'label', 'Resonance')

        // Connect note control chain
        store.addEdge(noteSlider, scaleToMidiId, 'value', 'scaleDegree')
        store.addEdge(scaleToMidiId, midiToFreqId, 'midiNote', 'midiNote')

        // Connect frequency to oscillators
        store.addEdge(midiToFreqId, osc1Id, 'frequency', 'frequency')
        store.addEdge(midiToFreqId, osc2Id, 'frequency', 'frequency')
        store.addEdge(midiToFreqId, osc3Id, 'frequency', 'frequency')

        // Connect oscillators to their gain nodes
        store.addEdge(osc1Id, osc1GainId, 'output', 'input')
        store.addEdge(osc2Id, osc2GainId, 'output', 'input')
        store.addEdge(osc3Id, osc3GainId, 'output', 'input')

        // Mix oscillators
        store.addEdge(osc1GainId, mixerId, 'output', 'input')
        store.addEdge(osc2GainId, mixerId, 'output', 'input')
        store.addEdge(osc3GainId, mixerId, 'output', 'input')

        // Through main gain
        store.addEdge(mixerId, mainGainId, 'output', 'input')

        // Through filter
        store.addEdge(mainGainId, filterId, 'output', 'input')

        // LFO modulation of filter
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, filterId, 'output', 'frequency')

        // User control of filter
        store.addEdge(filterCutoffSlider, filterId, 'value', 'frequency')
        store.addEdge(filterResSlider, filterId, 'value', 'Q')

        // Through delay
        store.addEdge(filterId, delayId, 'output', 'input')
        store.addEdge(delayId, delayGainId, 'output', 'input')
        store.addEdge(delayGainId, delayId, 'output', 'input') // Feedback loop
        store.addEdge(delayId, feedbackId, 'output', 'input')

        // To output
        store.addEdge(feedbackId, destId, 'output', 'input')
      }),
    },
    {
      id: 'basic-oscillator',
      name: 'Basic Oscillator',
      description: 'Simple sine wave connected to output',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 150 })
        const gainId = store.addAdaptedNode('GainNode', { x: 350, y: 150 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 600, y: 150 })

        store.updateNodeProperty(gainId, 'gain', 0.5)
        store.addEdge(oscId, gainId, 'output', 'input')
        store.addEdge(gainId, destId, 'output', 'input')
      }),
    },
    {
      id: 'microphone-input',
      name: 'Microphone Input with Delay',
      description: 'Live microphone input with delay and feedback',
      create: createExample(async () => {
        try {
          // Use the store's microphone input action which handles permissions
          const micGainId = store.addAdaptedNode('GainNode', { x: 350, y: 150 })
          const delayId = store.addAdaptedNode('DelayNode', { x: 650, y: 150 })
          const feedbackId = store.addAdaptedNode('GainNode', { x: 650, y: 350 })
          const destId = store.addAdaptedNode('AudioDestinationNode', { x: 950, y: 150 })
          const micId = await store.addMicrophoneInput({ x: 100, y: 150 })

          // Set microphone gain to 0.5 (sound generator rule)
          store.updateNodeProperty(micGainId, 'gain', 0.5)
          // Set delay time and feedback gain
          store.updateNodeProperty(delayId, 'delayTime', 0.3)
          store.updateNodeProperty(feedbackId, 'gain', 0.7)

          // Connect the nodes
          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, delayId, 'output', 'input')
          store.addEdge(delayId, destId, 'output', 'input')

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
        const soundFileId = store.addAdaptedNode('SoundFileNode', { x: 629, y: 117 })
        const buttonId = store.addAdaptedNode('ButtonNode', { x: 350, y: 100 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1015, y: 162 })

        store.updateNodeProperty(buttonId, 'label', 'Play Sound')
        store.updateNodeProperty(buttonId, 'outputValue', 1)

        store.updateNodeProperty(soundFileId, 'gain', 1)
        store.updateNodeProperty(soundFileId, 'loop', false)
        store.updateNodeProperty(soundFileId, 'playbackRate', 1)
        // Set the filename property early so it shows in the UI
        store.updateNodeProperty(soundFileId, 'fileName', 'test-sound.wav')

        // Connect the nodes
        store.addEdge(buttonId, soundFileId, 'trigger', 'trigger')

        store.addEdge(soundFileId, destId, 'output', 'input')

        // Load the sample audio file
        try {
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
          }
        } catch (error) {
          console.error('Sound File Player: Failed to load sample audio:', error)
        }
      }),
    },
    /* {
      id: 'auto-file-player',
      name: 'Auto File Player',
      description: 'Timer-triggered automatic sound file playback with sample audio',
      create: createExample(async () => {
        const soundFileId = store.addAdaptedNode('SoundFileNode', { x: 629, y: 117 })
        const timerId = store.addAdaptedNode('TimerNode', { x: 350, y: 100 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1015, y: 162 })

        store.updateNodeProperty(timerId, 'mode', 'loop')
        store.updateNodeProperty(timerId, 'delay', 1000) // 1 second initial delay
        store.updateNodeProperty(timerId, 'interval', 3000) // Play every 3 seconds
        store.updateNodeProperty(timerId, 'startMode', 'auto')
        store.updateNodeProperty(timerId, 'enabled', 'true')

        store.updateNodeProperty(soundFileId, 'gain', 1)
        store.updateNodeProperty(soundFileId, 'loop', false)
        store.updateNodeProperty(soundFileId, 'playbackRate', 1)
        // Set the filename property early so it shows in the UI
        store.updateNodeProperty(soundFileId, 'fileName', 'test-sound.wav')

        // Connect the nodes
        store.addEdge(timerId, soundFileId, 'trigger', 'trigger')

        store.addEdge(soundFileId, destId, 'output', 'input')

        // Load the sample audio file
        try {
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
          }
        } catch (error) {
          console.error('Auto File Player: Failed to load sample audio:', error)
        }
      }),
    }, */
    {
      id: 'delay-effect',
      name: 'Delay Effect',
      description: 'Oscillator with delay and feedback',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addAdaptedNode('GainNode', { x: 350, y: 150 })
        const delayId = store.addAdaptedNode('DelayNode', { x: 650, y: 150 })
        const feedbackId = store.addAdaptedNode('GainNode', { x: 650, y: 350 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 950, y: 150 })

        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)
        // Set delay time and feedback gain
        store.updateNodeProperty(delayId, 'delayTime', 0.3)
        store.updateNodeProperty(feedbackId, 'gain', 1)

        // Connect the nodes
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, delayId, 'output', 'input')
        store.addEdge(delayId, destId, 'output', 'input')

        store.addEdge(delayId, feedbackId, 'output', 'input')
        store.addEdge(feedbackId, delayId, 'output', 'input')
      }),
    },
    {
      id: 'filter-sweep',
      name: 'Filter Sweep',
      description: 'Oscillator with animated lowpass filter',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
        const oscGainId = store.addAdaptedNode('GainNode', { x: 400, y: 100 })
        const filterId = store.addAdaptedNode('BiquadFilterNode', { x: 700, y: 100 })
        const lfoId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addAdaptedNode('GainNode', { x: 400, y: 350 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1000, y: 100 })

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
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, filterId, 'output', 'input')
        store.addEdge(filterId, destId, 'output', 'input')

        // Connect the LFO to modulate filter frequency
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, filterId, 'output', 'frequency')
      }),
    },
    {
      id: 'stereo-panner',
      name: 'Stereo Panning',
      description: 'Oscillator with automated stereo panning effect',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addAdaptedNode('GainNode', { x: 400, y: 150 })
        const pannerId = store.addAdaptedNode('StereoPannerNode', { x: 700, y: 150 })
        const lfoId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addAdaptedNode('GainNode', { x: 400, y: 350 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1000, y: 150 })

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
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, pannerId, 'output', 'input')
        store.addEdge(pannerId, destId, 'output', 'input')

        // Connect the LFO for panning modulation
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, pannerId, 'output', 'pan')
      }),
    },
    {
      id: 'compressor-effect',
      name: 'Compressor Effect',
      description: 'Oscillator with dynamic range compression',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addAdaptedNode('GainNode', { x: 400, y: 150 })
        const compressorId = store.addAdaptedNode('DynamicsCompressorNode', { x: 700, y: 150 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1000, y: 150 })

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
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
        const oscGainId = store.addAdaptedNode('GainNode', { x: 400, y: 100 })
        const gainId = store.addAdaptedNode('GainNode', { x: 700, y: 100 })
        const lfoId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addAdaptedNode('GainNode', { x: 400, y: 350 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1000, y: 100 })

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
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, gainId, 'output', 'input')
        store.addEdge(gainId, destId, 'output', 'input')

        // Connect the LFO for tremolo effect
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, gainId, 'output', 'gain')
      }),
    },
    {
      id: 'ring-modulation',
      name: 'Ring Modulation',
      description: 'Two oscillators with ring modulation effect',
      create: createExample(() => {
        const osc1Id = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
        const osc1GainId = store.addAdaptedNode('GainNode', { x: 400, y: 100 })
        const osc2Id = store.addAdaptedNode('OscillatorNode', { x: 100, y: 350 })
        const osc2GainId = store.addAdaptedNode('GainNode', { x: 400, y: 350 })
        const gainId = store.addAdaptedNode('GainNode', { x: 700, y: 225 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1000, y: 225 })

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
        const osc1Id = store.addAdaptedNode('OscillatorNode', { x: 100, y: 50 })
        const osc2Id = store.addAdaptedNode('OscillatorNode', { x: 100, y: 225 })
        const osc3Id = store.addAdaptedNode('OscillatorNode', { x: 100, y: 400 })
        const gain1Id = store.addAdaptedNode('GainNode', { x: 400, y: 50 })
        const gain2Id = store.addAdaptedNode('GainNode', { x: 400, y: 225 })
        const gain3Id = store.addAdaptedNode('GainNode', { x: 400, y: 400 })
        const mixerId = store.addAdaptedNode('GainNode', { x: 700, y: 225 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1000, y: 225 })

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
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addAdaptedNode('GainNode', { x: 400, y: 150 })
        const gainId = store.addAdaptedNode('GainNode', { x: 700, y: 150 })
        const waveshaperId = store.addAdaptedNode('WaveShaperNode', { x: 1000, y: 150 })
        const outputGainId = store.addAdaptedNode('GainNode', { x: 1300, y: 150 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1600, y: 150 })

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
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addAdaptedNode('GainNode', { x: 400, y: 150 })
        const filter1Id = store.addAdaptedNode('BiquadFilterNode', { x: 700, y: 100 })
        const filter2Id = store.addAdaptedNode('BiquadFilterNode', { x: 700, y: 200 })
        const lfoId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 400 })
        const lfoGainId = store.addAdaptedNode('GainNode', { x: 400, y: 400 })
        const mixerId = store.addAdaptedNode('GainNode', { x: 1000, y: 150 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1300, y: 150 })

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
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, filter1Id, 'output', 'input')
        store.addEdge(filter1Id, filter2Id, 'output', 'input')
        store.addEdge(filter2Id, mixerId, 'output', 'input')
        store.addEdge(mixerId, destId, 'output', 'input')

        // Connect the LFO for phasing modulation
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
        // Note: We'll use an AudioBufferSourceNode with noise data
        const noiseId = store.addAdaptedNode('AudioBufferSourceNode', { x: 100, y: 150 })
        const noiseGainId = store.addAdaptedNode('GainNode', { x: 400, y: 150 })
        const filterId = store.addAdaptedNode('BiquadFilterNode', { x: 700, y: 150 })
        const gainId = store.addAdaptedNode('GainNode', { x: 1000, y: 150 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1300, y: 150 })

        // Set noise gain to 0.5 (sound generator rule)
        store.updateNodeProperty(noiseGainId, 'gain', 0.5)

        // Set up the filter
        store.updateNodeProperty(filterId, 'type', 'lowpass')
        store.updateNodeProperty(filterId, 'frequency', 2000)
        store.updateNodeProperty(filterId, 'Q', 1)

        // Set up the output gain
        store.updateNodeProperty(gainId, 'gain', 0.3)

        // Connect the audio chain
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
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
        const oscGainId = store.addAdaptedNode('GainNode', { x: 400, y: 100 })
        const envelopeId = store.addAdaptedNode('GainNode', { x: 700, y: 100 })
        const lfoId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addAdaptedNode('GainNode', { x: 400, y: 350 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1000, y: 100 })

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
        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, envelopeId, 'output', 'input')
        store.addEdge(envelopeId, destId, 'output', 'input')

        // Connect the LFO for envelope modulation
        store.addEdge(lfoId, lfoGainId, 'output', 'input')
        store.addEdge(lfoGainId, envelopeId, 'output', 'gain')
      }),
    },
    {
      id: 'beat-frequency',
      name: 'Beat Frequency',
      description: 'Two slightly detuned oscillators creating beats',
      create: createExample(() => {
        const osc1Id = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
        const osc2Id = store.addAdaptedNode('OscillatorNode', { x: 100, y: 350 })
        const gain1Id = store.addAdaptedNode('GainNode', { x: 400, y: 100 })
        const gain2Id = store.addAdaptedNode('GainNode', { x: 400, y: 350 })
        const mixerId = store.addAdaptedNode('GainNode', { x: 700, y: 225 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1000, y: 225 })

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
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 150 })
        const oscGainId = store.addAdaptedNode('GainNode', { x: 400, y: 150 })
        const gainId = store.addAdaptedNode('GainNode', { x: 700, y: 150 })
        const reverbId = store.addAdaptedNode('ConvolverNode', { x: 1000, y: 200 })
        const dryGainId = store.addAdaptedNode('GainNode', { x: 1000, y: 50 })
        const wetGainId = store.addAdaptedNode('GainNode', { x: 1000, y: 350 })
        const mixerId = store.addAdaptedNode('GainNode', { x: 1300, y: 150 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1600, y: 150 })

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
        try {
          const micGainId = store.addAdaptedNode('GainNode', { x: 400, y: 150 })
          const gainId = store.addAdaptedNode('GainNode', { x: 700, y: 150 })
          const reverbId = store.addAdaptedNode('ConvolverNode', { x: 1000, y: 200 })
          const dryGainId = store.addAdaptedNode('GainNode', { x: 1000, y: 50 })
          const wetGainId = store.addAdaptedNode('GainNode', { x: 1000, y: 350 })
          const mixerId = store.addAdaptedNode('GainNode', { x: 1300, y: 150 })
          const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1600, y: 150 })
          // Use the store's microphone input action which handles permissions
          const micId = await store.addMicrophoneInput({ x: 100, y: 150 })

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
        const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })
        const oscGainId = store.addAdaptedNode('GainNode', { x: 400, y: 200 })
        const splitterId = store.addAdaptedNode('ChannelSplitterNode', { x: 700, y: 200 })
        const leftGainId = store.addAdaptedNode('GainNode', { x: 1000, y: 100 })
        const rightGainId = store.addAdaptedNode('GainNode', { x: 1000, y: 300 })
        const mergerId = store.addAdaptedNode('ChannelMergerNode', { x: 1300, y: 200 })
        const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1600, y: 200 })

        // Set up the oscillator
        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        // Set oscillator gain to 0.5 (sound generator rule)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Set up different gains for left and right channels
        store.updateNodeProperty(leftGainId, 'gain', 0.8) // Left channel
        store.updateNodeProperty(rightGainId, 'gain', 0.4) // Right channel (quieter)

        // Connect the audio chain
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
        try {
          const micGainId = store.addAdaptedNode('GainNode', { x: 400, y: 150 })
          const carrierOscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 400 })
          const carrierGainId = store.addAdaptedNode('GainNode', { x: 400, y: 400 })
          const ringModId = store.addAdaptedNode('GainNode', { x: 700, y: 275 })
          const outputGainId = store.addAdaptedNode('GainNode', { x: 1000, y: 275 })
          const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1300, y: 275 })
          // Use microphone input
          const micId = await store.addMicrophoneInput({ x: 100, y: 150 })

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
        try {
          const micGainId = store.addAdaptedNode('GainNode', { x: 400, y: 200 })

          // Create multiple band-pass filters for vocoder bands
          const filter1Id = store.addAdaptedNode('BiquadFilterNode', { x: 700, y: 100 })
          const filter2Id = store.addAdaptedNode('BiquadFilterNode', { x: 700, y: 200 })
          const filter3Id = store.addAdaptedNode('BiquadFilterNode', { x: 700, y: 300 })

          // Create oscillators for each band
          const osc1Id = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
          const osc2Id = store.addAdaptedNode('OscillatorNode', { x: 100, y: 350 })
          const osc3Id = store.addAdaptedNode('OscillatorNode', { x: 100, y: 600 })

          // Create gain nodes for oscillators (sound generator rule)
          const osc1GainId = store.addAdaptedNode('GainNode', { x: 400, y: 100 })
          const osc2GainId = store.addAdaptedNode('GainNode', { x: 400, y: 350 })
          const osc3GainId = store.addAdaptedNode('GainNode', { x: 400, y: 600 })

          // Create gain nodes for each band (controlled by filtered voice)
          const band1GainId = store.addAdaptedNode('GainNode', { x: 1000, y: 100 })
          const band2GainId = store.addAdaptedNode('GainNode', { x: 1000, y: 200 })
          const band3GainId = store.addAdaptedNode('GainNode', { x: 1000, y: 300 })

          // Create mixer and output
          const mixerId = store.addAdaptedNode('GainNode', { x: 1300, y: 200 })
          const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1600, y: 200 })
          // Use microphone input
          const micId = await store.addMicrophoneInput({ x: 100, y: 200 })

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
        try {
          const micGainId = store.addAdaptedNode('GainNode', { x: 400, y: 200 })

          // Create harmony oscillators (3rd and 5th intervals)
          const harmony3rdId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 400 })
          const harmony5thId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 600 })

          // Create gain nodes for oscillators (sound generator rule)
          const harmony3rdGainId = store.addAdaptedNode('GainNode', { x: 400, y: 400 })
          const harmony5thGainId = store.addAdaptedNode('GainNode', { x: 400, y: 600 })

          // Create gain node for voice level control
          const voiceGainId = store.addAdaptedNode('GainNode', { x: 700, y: 200 })

          // Create mixer and output
          const mixerId = store.addAdaptedNode('GainNode', { x: 1000, y: 400 })
          const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1300, y: 400 })
          // Use microphone input
          const micId = await store.addMicrophoneInput({ x: 100, y: 200 })

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
        try {
          const micGainId = store.addAdaptedNode('GainNode', { x: 400, y: 200 })

          // Create delay-based pitch shifting
          const delayId = store.addAdaptedNode('DelayNode', { x: 700, y: 200 })
          const lfoId = store.addAdaptedNode('OscillatorNode', { x: 700, y: 400 })
          const lfoGainId = store.addAdaptedNode('GainNode', { x: 1000, y: 400 })

          // Create dry/wet mix
          const dryGainId = store.addAdaptedNode('GainNode', { x: 1000, y: 100 })
          const wetGainId = store.addAdaptedNode('GainNode', { x: 1000, y: 300 })
          const mixerId = store.addAdaptedNode('GainNode', { x: 1300, y: 200 })
          const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1600, y: 200 })
          // Use microphone input
          const micId = await store.addMicrophoneInput({ x: 100, y: 200 })

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
          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, dryGainId, 'output', 'input')
          store.addEdge(micGainId, delayId, 'output', 'input')
          store.addEdge(delayId, wetGainId, 'output', 'input')

          // Connect dry and wet to mixer
          store.addEdge(dryGainId, mixerId, 'output', 'input')
          store.addEdge(wetGainId, mixerId, 'output', 'input')
          store.addEdge(mixerId, destId, 'output', 'input')

          // Connect LFO modulation to delay time
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
