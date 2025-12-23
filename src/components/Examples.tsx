import { useAudioGraphStore } from '~/stores/AudioGraphStore'

export interface Example {
  id: string
  name: string
  description: string
  create: () => void | Promise<void>
}

// Layout constants for consistent node positioning
const LAYOUT = {
  START_X: 100,
  START_Y: 150,
  X_SPACING: 250,
  Y_SPACING: 150,
}

// Helper to calculate grid position
const pos = (col: number, row: number) => ({
  x: LAYOUT.START_X + col * LAYOUT.X_SPACING,
  y: LAYOUT.START_Y + row * LAYOUT.Y_SPACING,
})

export const useExamples = () => {
  const store = useAudioGraphStore()

  // Helper function to create examples without undo/redo recording
  const createExample = (exampleFn: () => void | Promise<void>) => {
    return async () => {
      store.setCreatingExample(true)
      store.clearAllNodes()

      try {
        await exampleFn()
      } finally {
        store.setCreatingExample(false)
      }
    }
  }

  const examples: Example[] = [
    // ============== COMPLEX SYNTH EXAMPLES ==============
    {
      id: 'vintage-analog-synth',
      name: 'Vintage Analog Synth',
      description:
        'Classic analog synth with OscillatorBank, FilterSweep, and DelayEffect composites',
      create: createExample(() => {
        // Note control
        const noteSlider = store.addAdaptedNode('SliderNode', pos(0, 0))
        const midiToFreqId = store.addAdaptedNode('MidiToFreqNode', pos(1, 0))

        // Sound generation with OscillatorBank composite
        const oscBankId = store.addAdaptedNode('Composite_OscillatorBank', pos(2, 0))
        const mainGainId = store.addAdaptedNode('GainNode', pos(3, 0))

        // Filter with FilterSweep composite
        const filterSweepId = store.addAdaptedNode('Composite_FilterSweep', pos(4, 0))

        // Delay with DelayEffect composite
        const delayId = store.addAdaptedNode('Composite_DelayEffect', pos(5, 0))

        // Output
        const outputGainId = store.addAdaptedNode('GainNode', pos(6, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(7, 0))

        // User control sliders
        const filterCutoffSliderId = store.addAdaptedNode('SliderNode', pos(3, 1))
        const filterResSliderId = store.addAdaptedNode('SliderNode', pos(4, 1))

        // Note slider
        store.updateNodeProperty(noteSlider, 'min', 36)
        store.updateNodeProperty(noteSlider, 'max', 84)
        store.updateNodeProperty(noteSlider, 'value', 45)
        store.updateNodeProperty(noteSlider, 'step', 1)
        store.updateNodeProperty(noteSlider, 'label', 'Note (MIDI)')

        // Main gain
        store.updateNodeProperty(mainGainId, 'gain', 0.5)

        // Filter sweep settings
        store.updateNodeProperty(filterSweepId, 'cutoff', 800)
        store.updateNodeProperty(filterSweepId, 'resonance', 15)
        store.updateNodeProperty(filterSweepId, 'lfoRate', 0.3)
        store.updateNodeProperty(filterSweepId, 'lfoDepth', 400)

        // Delay settings
        store.updateNodeProperty(delayId, 'delayTime', 0.25)
        store.updateNodeProperty(delayId, 'feedback', 0.4)
        store.updateNodeProperty(delayId, 'wetDry', 0.3)

        // Output gain
        store.updateNodeProperty(outputGainId, 'gain', 0.6)

        // Control sliders
        store.updateNodeProperty(filterCutoffSliderId, 'min', 200)
        store.updateNodeProperty(filterCutoffSliderId, 'max', 4000)
        store.updateNodeProperty(filterCutoffSliderId, 'value', 800)
        store.updateNodeProperty(filterCutoffSliderId, 'label', 'Filter Cutoff')

        store.updateNodeProperty(filterResSliderId, 'min', 1)
        store.updateNodeProperty(filterResSliderId, 'max', 30)
        store.updateNodeProperty(filterResSliderId, 'value', 15)
        store.updateNodeProperty(filterResSliderId, 'label', 'Resonance')

        // Connections
        store.addEdge(noteSlider, midiToFreqId, 'value', 'midiNote')
        store.addEdge(midiToFreqId, oscBankId, 'frequency', 'frequency')
        store.addEdge(oscBankId, mainGainId, 'output', 'input')
        store.addEdge(mainGainId, filterSweepId, 'output', 'input')
        store.addEdge(filterCutoffSliderId, filterSweepId, 'value', 'cutoff')
        store.addEdge(filterResSliderId, filterSweepId, 'value', 'resonance')
        store.addEdge(filterSweepId, delayId, 'output', 'input')
        store.addEdge(delayId, outputGainId, 'output', 'input')
        store.addEdge(outputGainId, destId, 'output', 'input')
      }),
    },

    // ============== MIDI CONTROL EXAMPLES ==============
    {
      id: 'midi-to-frequency',
      name: 'MIDI to Frequency',
      description: 'Control oscillator frequency with slider via MIDI note conversion',
      create: createExample(() => {
        const sliderId = store.addAdaptedNode('SliderNode', pos(0, 0))
        const displayNode1Id = store.addAdaptedNode('DisplayNode', pos(1, 0))
        const midiToFreqId = store.addAdaptedNode('MidiToFreqNode', pos(2, 0))
        const displayNode2Id = store.addAdaptedNode('DisplayNode', pos(3, 0))
        const oscId = store.addAdaptedNode('OscillatorNode', pos(4, 0))
        const gainId = store.addAdaptedNode('GainNode', pos(5, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(6, 0))

        store.updateNodeProperty(sliderId, 'min', 48)
        store.updateNodeProperty(sliderId, 'max', 84)
        store.updateNodeProperty(sliderId, 'value', 60)
        store.updateNodeProperty(sliderId, 'label', 'MIDI Note')

        store.updateNodeProperty(displayNode1Id, 'label', 'MIDI Value')
        store.updateNodeProperty(displayNode2Id, 'label', 'Frequency (Hz)')

        store.updateNodeProperty(oscId, 'type', 'sine')
        store.updateNodeProperty(gainId, 'gain', 0.5)

        store.addEdge(sliderId, displayNode1Id, 'value', 'input')
        store.addEdge(displayNode1Id, midiToFreqId, 'output', 'midiNote')
        store.addEdge(midiToFreqId, displayNode2Id, 'frequency', 'input')
        store.addEdge(displayNode2Id, oscId, 'output', 'frequency')
        store.addEdge(oscId, gainId, 'output', 'input')
        store.addEdge(gainId, destId, 'output', 'input')
      }),
    },
    {
      id: 'midi-delay-effect',
      name: 'MIDI Delay Effect',
      description: 'MIDI-controlled oscillator with DelayEffect composite',
      create: createExample(() => {
        const sliderId = store.addAdaptedNode('SliderNode', pos(0, 0))
        const midiToFreqId = store.addAdaptedNode('MidiToFreqNode', pos(1, 0))
        const oscId = store.addAdaptedNode('OscillatorNode', pos(2, 0))
        const gainId = store.addAdaptedNode('GainNode', pos(3, 0))
        const delayId = store.addAdaptedNode('Composite_DelayEffect', pos(4, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(5, 0))

        store.updateNodeProperty(sliderId, 'min', 48)
        store.updateNodeProperty(sliderId, 'max', 84)
        store.updateNodeProperty(sliderId, 'value', 58)
        store.updateNodeProperty(sliderId, 'label', 'MIDI Note')

        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        store.updateNodeProperty(gainId, 'gain', 0.5)

        store.updateNodeProperty(delayId, 'delayTime', 0.4)
        store.updateNodeProperty(delayId, 'feedback', 0.5)
        store.updateNodeProperty(delayId, 'wetDry', 0.4)

        store.addEdge(sliderId, midiToFreqId, 'value', 'midiNote')
        store.addEdge(midiToFreqId, oscId, 'frequency', 'frequency')
        store.addEdge(oscId, gainId, 'output', 'input')
        store.addEdge(gainId, delayId, 'output', 'input')
        store.addEdge(delayId, destId, 'output', 'input')
      }),
    },
    {
      id: 'midi-pentatonic',
      name: 'MIDI Pentatonic',
      description: 'Pentatonic synthesizer with OscillatorBank, FilterSweep, and DelayEffect',
      create: createExample(() => {
        // Note control
        const noteSlider = store.addAdaptedNode('SliderNode', pos(0, 0))
        const scaleToMidiId = store.addAdaptedNode('ScaleToMidiNode', pos(1, 0))
        const midiToFreqId = store.addAdaptedNode('MidiToFreqNode', pos(2, 0))

        // Sound generation with composite
        const oscBankId = store.addAdaptedNode('Composite_OscillatorBank', pos(3, 0))
        const gainId = store.addAdaptedNode('GainNode', pos(4, 0))

        // Filter sweep composite
        const filterSweepId = store.addAdaptedNode('Composite_FilterSweep', pos(5, 0))

        // Delay composite
        const delayId = store.addAdaptedNode('Composite_DelayEffect', pos(6, 0))

        const destId = store.addAdaptedNode('AudioDestinationNode', pos(7, 0))

        // Control sliders
        const filterCutoffSlider = store.addAdaptedNode('SliderNode', pos(4, 1))
        const filterResSlider = store.addAdaptedNode('SliderNode', pos(5, 1))

        // Note slider
        store.updateNodeProperty(noteSlider, 'min', -10)
        store.updateNodeProperty(noteSlider, 'max', 10)
        store.updateNodeProperty(noteSlider, 'value', 0)
        store.updateNodeProperty(noteSlider, 'step', 1)
        store.updateNodeProperty(noteSlider, 'label', 'Note')

        // Scale to MIDI
        store.updateNodeProperty(scaleToMidiId, 'key', 'C')
        store.updateNodeProperty(scaleToMidiId, 'mode', 'pentatonic_minor')

        // Oscillator bank
        store.updateNodeProperty(oscBankId, 'detune', 10)

        // Gain
        store.updateNodeProperty(gainId, 'gain', 0.5)

        // Filter sweep
        store.updateNodeProperty(filterSweepId, 'cutoff', 1000)
        store.updateNodeProperty(filterSweepId, 'resonance', 15)
        store.updateNodeProperty(filterSweepId, 'lfoRate', 0.3)
        store.updateNodeProperty(filterSweepId, 'lfoDepth', 400)

        // Delay
        store.updateNodeProperty(delayId, 'delayTime', 0.25)
        store.updateNodeProperty(delayId, 'feedback', 0.3)
        store.updateNodeProperty(delayId, 'wetDry', 0.3)

        // Control sliders
        store.updateNodeProperty(filterCutoffSlider, 'min', 200)
        store.updateNodeProperty(filterCutoffSlider, 'max', 4000)
        store.updateNodeProperty(filterCutoffSlider, 'value', 1000)
        store.updateNodeProperty(filterCutoffSlider, 'label', 'Filter Cutoff')

        store.updateNodeProperty(filterResSlider, 'min', 1)
        store.updateNodeProperty(filterResSlider, 'max', 30)
        store.updateNodeProperty(filterResSlider, 'value', 15)
        store.updateNodeProperty(filterResSlider, 'label', 'Resonance')

        // Connections
        store.addEdge(noteSlider, scaleToMidiId, 'value', 'scaleDegree')
        store.addEdge(scaleToMidiId, midiToFreqId, 'midiNote', 'midiNote')
        store.addEdge(midiToFreqId, oscBankId, 'frequency', 'frequency')
        store.addEdge(oscBankId, gainId, 'output', 'input')
        store.addEdge(gainId, filterSweepId, 'output', 'input')
        store.addEdge(filterCutoffSlider, filterSweepId, 'value', 'cutoff')
        store.addEdge(filterResSlider, filterSweepId, 'value', 'resonance')
        store.addEdge(filterSweepId, delayId, 'output', 'input')
        store.addEdge(delayId, destId, 'output', 'input')
      }),
    },

    // ============== BASIC EXAMPLES ==============
    {
      id: 'basic-oscillator',
      name: 'Basic Oscillator',
      description: 'Simple sine wave connected to output - the starting point for all synthesis',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const gainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(2, 0))

        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sine')
        store.updateNodeProperty(gainId, 'gain', 0.5)

        store.addEdge(oscId, gainId, 'output', 'input')
        store.addEdge(gainId, destId, 'output', 'input')
      }),
    },

    // ============== VOICE / MICROPHONE EXAMPLES ==============
    {
      id: 'microphone-input',
      name: 'Microphone Input with Delay',
      description: 'Live microphone input with DelayEffect composite',
      create: createExample(async () => {
        try {
          const micGainId = store.addAdaptedNode('GainNode', pos(1, 0))
          const delayId = store.addAdaptedNode('Composite_DelayEffect', pos(2, 0))
          const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))
          const micId = await store.addMicrophoneInput(pos(0, 0))

          store.updateNodeProperty(micGainId, 'gain', 0.5)
          store.updateNodeProperty(delayId, 'delayTime', 0.3)
          store.updateNodeProperty(delayId, 'feedback', 0.5)
          store.updateNodeProperty(delayId, 'wetDry', 0.4)

          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, delayId, 'output', 'input')
          store.addEdge(delayId, destId, 'output', 'input')
        } catch (error) {
          console.error('Failed to create microphone input example:', error)
          alert('Microphone access denied. Please allow microphone access and try again.')
        }
      }),
    },

    // ============== SOUND FILE EXAMPLES ==============
    {
      id: 'sound-file-player',
      name: 'Sound File Player',
      description: 'Button-triggered sound file playback with sample audio',
      create: createExample(async () => {
        const buttonId = store.addAdaptedNode('ButtonNode', pos(0, 0))
        const soundFileId = store.addAdaptedNode('SoundFileNode', pos(1, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(2, 0))

        store.updateNodeProperty(buttonId, 'label', 'Play Sound')
        store.updateNodeProperty(buttonId, 'outputValue', 1)
        store.updateNodeProperty(soundFileId, 'gain', 1)
        store.updateNodeProperty(soundFileId, 'loop', false)
        store.updateNodeProperty(soundFileId, 'fileName', 'test-sound.wav')

        store.addEdge(buttonId, soundFileId, 'trigger', 'trigger')
        store.addEdge(soundFileId, destId, 'output', 'input')

        try {
          const response = await fetch('./samples/test-sound.wav')
          if (response.ok) {
            const blob = await response.blob()
            const file = new File([blob], 'test-sound.wav', { type: 'audio/wav' })
            const customNode = store.getCustomNode(soundFileId)
            if (customNode?.loadAudioFile) {
              await customNode.loadAudioFile(file)
            }
          }
        } catch (error) {
          console.error('Failed to load sample audio:', error)
        }
      }),
    },
    {
      id: 'auto-file-player',
      name: 'Auto File Player',
      description: 'Sound file player without manual trigger',
      create: createExample(async () => {
        const soundFileId = store.addAdaptedNode('SoundFileNode', pos(0, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(1, 0))

        store.updateNodeProperty(soundFileId, 'gain', 1)
        store.updateNodeProperty(soundFileId, 'loop', false)
        store.updateNodeProperty(soundFileId, 'fileName', 'test-sound.wav')

        store.addEdge(soundFileId, destId, 'output', 'input')

        try {
          const response = await fetch('./samples/test-sound.wav')
          if (response.ok) {
            const blob = await response.blob()
            const file = new File([blob], 'test-sound.wav', { type: 'audio/wav' })
            const customNode = store.getCustomNode(soundFileId)
            if (customNode?.loadAudioFile) {
              await customNode.loadAudioFile(file)
            }
          }
        } catch (error) {
          console.error('Failed to load sample audio:', error)
        }
      }),
    },

    // ============== EFFECT EXAMPLES ==============
    {
      id: 'delay-effect',
      name: 'Delay Effect',
      description: 'Oscillator with the DelayEffect composite for echo and rhythmic delays',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const delayId = store.addAdaptedNode('Composite_DelayEffect', pos(2, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))

        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sine')
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Configure delay composite
        store.updateNodeProperty(delayId, 'delayTime', 0.3)
        store.updateNodeProperty(delayId, 'feedback', 0.5)
        store.updateNodeProperty(delayId, 'wetDry', 0.4)

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, delayId, 'output', 'input')
        store.addEdge(delayId, destId, 'output', 'input')
      }),
    },
    {
      id: 'filter-sweep',
      name: 'Filter Sweep',
      description: 'Oscillator with the FilterSweep composite for animated wah effects',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const filterSweepId = store.addAdaptedNode('Composite_FilterSweep', pos(2, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))

        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        store.updateNodeProperty(oscId, 'frequency', 220)
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Configure filter sweep
        store.updateNodeProperty(filterSweepId, 'cutoff', 800)
        store.updateNodeProperty(filterSweepId, 'resonance', 10)
        store.updateNodeProperty(filterSweepId, 'lfoRate', 0.5)
        store.updateNodeProperty(filterSweepId, 'lfoDepth', 600)

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, filterSweepId, 'output', 'input')
        store.addEdge(filterSweepId, destId, 'output', 'input')
      }),
    },
    {
      id: 'stereo-panner',
      name: 'Stereo Panning',
      description: 'Oscillator with the AutoPanner composite for spatial movement',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const pannerId = store.addAdaptedNode('Composite_AutoPanner', pos(2, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))

        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sine')
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Configure auto panner
        store.updateNodeProperty(pannerId, 'rate', 0.2)
        store.updateNodeProperty(pannerId, 'depth', 1)

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, pannerId, 'output', 'input')
        store.addEdge(pannerId, destId, 'output', 'input')
      }),
    },
    {
      id: 'compressor-effect',
      name: 'Compressor Effect',
      description: 'Oscillator with the CompressorPreset composite for dynamic control',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const compressorId = store.addAdaptedNode('Composite_CompressorPreset', pos(2, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))

        store.updateNodeProperty(oscId, 'frequency', 220)
        store.updateNodeProperty(oscId, 'type', 'square')
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Configure compressor
        store.updateNodeProperty(compressorId, 'threshold', -24)
        store.updateNodeProperty(compressorId, 'ratio', 12)

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, compressorId, 'output', 'input')
        store.addEdge(compressorId, destId, 'output', 'input')
      }),
    },
    {
      id: 'tremolo-effect',
      name: 'Tremolo Effect',
      description: 'Oscillator with the Tremolo composite for pulsing amplitude modulation',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const tremoloId = store.addAdaptedNode('Composite_Tremolo', pos(2, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))

        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sine')
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Configure tremolo
        store.updateNodeProperty(tremoloId, 'rate', 5)
        store.updateNodeProperty(tremoloId, 'depth', 0.3)

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, tremoloId, 'output', 'input')
        store.addEdge(tremoloId, destId, 'output', 'input')
      }),
    },
    {
      id: 'ring-modulation',
      name: 'Ring Modulation',
      description: 'Two oscillators with RingModulator composite for metallic tones',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const ringModId = store.addAdaptedNode('Composite_RingModulator', pos(2, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))

        // Slider to control modulation frequency
        const modFreqSliderId = store.addAdaptedNode('SliderNode', pos(1, 1))

        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sine')
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        store.updateNodeProperty(modFreqSliderId, 'min', 20)
        store.updateNodeProperty(modFreqSliderId, 'max', 500)
        store.updateNodeProperty(modFreqSliderId, 'value', 200)
        store.updateNodeProperty(modFreqSliderId, 'label', 'Mod Frequency')

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, ringModId, 'output', 'input')
        store.addEdge(modFreqSliderId, ringModId, 'value', 'modFrequency')
        store.addEdge(ringModId, destId, 'output', 'input')
      }),
    },

    // ============== SYNTHESIS EXAMPLES ==============
    {
      id: 'chord-synthesis',
      name: 'Chord Synthesis',
      description: 'Three oscillator banks creating a rich chord',
      create: createExample(() => {
        const osc1Id = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const osc2Id = store.addAdaptedNode('OscillatorNode', pos(0, 1))
        const osc3Id = store.addAdaptedNode('OscillatorNode', pos(0, 2))
        const gain1Id = store.addAdaptedNode('GainNode', pos(1, 0))
        const gain2Id = store.addAdaptedNode('GainNode', pos(1, 1))
        const gain3Id = store.addAdaptedNode('GainNode', pos(1, 2))
        const mixerId = store.addAdaptedNode('GainNode', pos(2, 1))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 1))

        // C major chord (C4, E4, G4)
        store.updateNodeProperty(osc1Id, 'frequency', 261.63)
        store.updateNodeProperty(osc2Id, 'frequency', 329.63)
        store.updateNodeProperty(osc3Id, 'frequency', 392.0)

        store.updateNodeProperty(osc1Id, 'type', 'sine')
        store.updateNodeProperty(osc2Id, 'type', 'sine')
        store.updateNodeProperty(osc3Id, 'type', 'sine')

        store.updateNodeProperty(gain1Id, 'gain', 0.3)
        store.updateNodeProperty(gain2Id, 'gain', 0.3)
        store.updateNodeProperty(gain3Id, 'gain', 0.3)
        store.updateNodeProperty(mixerId, 'gain', 1)

        store.addEdge(osc1Id, gain1Id, 'output', 'input')
        store.addEdge(osc2Id, gain2Id, 'output', 'input')
        store.addEdge(osc3Id, gain3Id, 'output', 'input')
        store.addEdge(gain1Id, mixerId, 'output', 'input')
        store.addEdge(gain2Id, mixerId, 'output', 'input')
        store.addEdge(gain3Id, mixerId, 'output', 'input')
        store.addEdge(mixerId, destId, 'output', 'input')
      }),
    },

    // ============== UTILITY EXAMPLES ==============
    {
      id: 'waveshaper-distortion',
      name: 'Waveshaper Distortion',
      description: 'Oscillator with waveshaper for harmonic distortion',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const driveId = store.addAdaptedNode('GainNode', pos(2, 0))
        const waveshaperId = store.addAdaptedNode('WaveShaperNode', pos(3, 0))
        const outputGainId = store.addAdaptedNode('GainNode', pos(4, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(5, 0))

        store.updateNodeProperty(oscId, 'frequency', 220)
        store.updateNodeProperty(oscId, 'type', 'sine')
        store.updateNodeProperty(oscGainId, 'gain', 0.5)
        store.updateNodeProperty(driveId, 'gain', 2)
        store.updateNodeProperty(outputGainId, 'gain', 0.3)

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, driveId, 'output', 'input')
        store.addEdge(driveId, waveshaperId, 'output', 'input')
        store.addEdge(waveshaperId, outputGainId, 'output', 'input')
        store.addEdge(outputGainId, destId, 'output', 'input')
      }),
    },
    {
      id: 'phaser-effect',
      name: 'Phaser Effect',
      description: 'Oscillator with the PhaserEffect composite for swirling sounds',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const phaserId = store.addAdaptedNode('Composite_PhaserEffect', pos(2, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))

        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Configure phaser
        store.updateNodeProperty(phaserId, 'rate', 0.5)
        store.updateNodeProperty(phaserId, 'depth', 500)

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, phaserId, 'output', 'input')
        store.addEdge(phaserId, destId, 'output', 'input')
      }),
    },
    {
      id: 'simple-noise',
      name: 'Simple Noise',
      description: 'Noise generator with filter',
      create: createExample(() => {
        const noiseId = store.addAdaptedNode('AudioBufferSourceNode', pos(0, 0))
        const noiseGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const filterId = store.addAdaptedNode('BiquadFilterNode', pos(2, 0))
        const gainId = store.addAdaptedNode('GainNode', pos(3, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(4, 0))

        store.updateNodeProperty(noiseGainId, 'gain', 0.5)
        store.updateNodeProperty(filterId, 'type', 'lowpass')
        store.updateNodeProperty(filterId, 'frequency', 2000)
        store.updateNodeProperty(filterId, 'Q', 1)
        store.updateNodeProperty(gainId, 'gain', 0.3)

        store.addEdge(noiseId, noiseGainId, 'output', 'input')
        store.addEdge(noiseGainId, filterId, 'output', 'input')
        store.addEdge(filterId, gainId, 'output', 'input')
        store.addEdge(gainId, destId, 'output', 'input')
      }),
    },
    {
      id: 'amplitude-envelope',
      name: 'Amplitude Envelope',
      description: 'Oscillator with SimpleLFO controlling volume envelope',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const envelopeGainId = store.addAdaptedNode('GainNode', pos(2, 0))
        const lfoId = store.addAdaptedNode('Composite_SimpleLFO', pos(1, 1))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))

        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        store.updateNodeProperty(oscGainId, 'gain', 0.5)
        store.updateNodeProperty(envelopeGainId, 'gain', 0.3)

        // LFO for slow envelope
        store.updateNodeProperty(lfoId, 'rate', 0.2)
        store.updateNodeProperty(lfoId, 'depth', 0.3)

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, envelopeGainId, 'output', 'input')
        store.addEdge(lfoId, envelopeGainId, 'output', 'gain')
        store.addEdge(envelopeGainId, destId, 'output', 'input')
      }),
    },
    {
      id: 'beat-frequency',
      name: 'Beat Frequency',
      description: 'Two slightly detuned oscillators creating audible beats',
      create: createExample(() => {
        const osc1Id = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const osc2Id = store.addAdaptedNode('OscillatorNode', pos(0, 1))
        const gain1Id = store.addAdaptedNode('GainNode', pos(1, 0))
        const gain2Id = store.addAdaptedNode('GainNode', pos(1, 1))
        const mixerId = store.addAdaptedNode('GainNode', pos(2, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))

        store.updateNodeProperty(osc1Id, 'frequency', 440)
        store.updateNodeProperty(osc2Id, 'frequency', 444) // 4Hz beat
        store.updateNodeProperty(osc1Id, 'type', 'sine')
        store.updateNodeProperty(osc2Id, 'type', 'sine')
        store.updateNodeProperty(gain1Id, 'gain', 0.5)
        store.updateNodeProperty(gain2Id, 'gain', 0.5)
        store.updateNodeProperty(mixerId, 'gain', 1)

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
      description: 'Oscillator with Chapel Reverb composite for realistic room ambience',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 0))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 0))
        const reverbId = store.addAdaptedNode('Composite_ReverbChapel', pos(2, 0))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))

        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sine')
        store.updateNodeProperty(oscGainId, 'gain', 0.5)

        // Configure reverb
        store.updateNodeProperty(reverbId, 'wetDry', 0.4)

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, reverbId, 'output', 'input')
        store.addEdge(reverbId, destId, 'output', 'input')
      }),
    },
    {
      id: 'microphone-reverb',
      name: 'Microphone Reverb',
      description: 'Live microphone with Chapel Reverb composite',
      create: createExample(async () => {
        try {
          const micGainId = store.addAdaptedNode('GainNode', pos(1, 0))
          const reverbId = store.addAdaptedNode('Composite_ReverbChapel', pos(2, 0))
          const destId = store.addAdaptedNode('AudioDestinationNode', pos(3, 0))
          const micId = await store.addMicrophoneInput(pos(0, 0))

          store.updateNodeProperty(micGainId, 'gain', 0.5)
          store.updateNodeProperty(reverbId, 'wetDry', 0.4)

          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, reverbId, 'output', 'input')
          store.addEdge(reverbId, destId, 'output', 'input')
        } catch (error) {
          console.error('Failed to create microphone reverb example:', error)
          alert('Microphone access denied. Please allow microphone access and try again.')
        }
      }),
    },
    {
      id: 'stereo-effects',
      name: 'Stereo Effects',
      description: 'Stereo processing with channel splitting and merging',
      create: createExample(() => {
        const oscId = store.addAdaptedNode('OscillatorNode', pos(0, 1))
        const oscGainId = store.addAdaptedNode('GainNode', pos(1, 1))
        const splitterId = store.addAdaptedNode('ChannelSplitterNode', pos(2, 1))
        const leftGainId = store.addAdaptedNode('GainNode', pos(3, 0))
        const rightGainId = store.addAdaptedNode('GainNode', pos(3, 2))
        const mergerId = store.addAdaptedNode('ChannelMergerNode', pos(4, 1))
        const destId = store.addAdaptedNode('AudioDestinationNode', pos(5, 1))

        store.updateNodeProperty(oscId, 'frequency', 440)
        store.updateNodeProperty(oscId, 'type', 'sawtooth')
        store.updateNodeProperty(oscGainId, 'gain', 0.5)
        store.updateNodeProperty(leftGainId, 'gain', 0.8)
        store.updateNodeProperty(rightGainId, 'gain', 0.4)

        store.addEdge(oscId, oscGainId, 'output', 'input')
        store.addEdge(oscGainId, splitterId, 'output', 'input')
        store.addEdge(splitterId, leftGainId, 'output0', 'input')
        store.addEdge(splitterId, rightGainId, 'output1', 'input')
        store.addEdge(leftGainId, mergerId, 'output', 'input0')
        store.addEdge(rightGainId, mergerId, 'output', 'input1')
        store.addEdge(mergerId, destId, 'output', 'input')
      }),
    },
    {
      id: 'robot-voice-ring-mod',
      name: 'Robot Voice (Ring Mod)',
      description: 'Transform your voice into a robot using RingModulator composite',
      create: createExample(async () => {
        try {
          const micGainId = store.addAdaptedNode('GainNode', pos(1, 0))
          const ringModId = store.addAdaptedNode('Composite_RingModulator', pos(2, 0))
          const outputGainId = store.addAdaptedNode('GainNode', pos(3, 0))
          const destId = store.addAdaptedNode('AudioDestinationNode', pos(4, 0))
          const micId = await store.addMicrophoneInput(pos(0, 0))

          // Slider to control modulation frequency
          const modFreqSliderId = store.addAdaptedNode('SliderNode', pos(1, 1))

          store.updateNodeProperty(micGainId, 'gain', 0.5)
          store.updateNodeProperty(outputGainId, 'gain', 0.6)

          store.updateNodeProperty(modFreqSliderId, 'min', 50)
          store.updateNodeProperty(modFreqSliderId, 'max', 500)
          store.updateNodeProperty(modFreqSliderId, 'value', 200)
          store.updateNodeProperty(modFreqSliderId, 'label', 'Robot Frequency')

          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, ringModId, 'output', 'input')
          store.addEdge(modFreqSliderId, ringModId, 'value', 'modFrequency')
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
      description: 'Multi-band vocoder effect using filters and oscillators',
      create: createExample(async () => {
        try {
          const micGainId = store.addAdaptedNode('GainNode', pos(1, 1))

          // Band-pass filters for vocoder bands
          const filter1Id = store.addAdaptedNode('BiquadFilterNode', pos(2, 0))
          const filter2Id = store.addAdaptedNode('BiquadFilterNode', pos(2, 1))
          const filter3Id = store.addAdaptedNode('BiquadFilterNode', pos(2, 2))

          // Oscillator bank for carrier
          const oscBankId = store.addAdaptedNode('Composite_OscillatorBank', pos(0, 2))

          // Band gains controlled by filtered voice
          const band1GainId = store.addAdaptedNode('GainNode', pos(3, 0))
          const band2GainId = store.addAdaptedNode('GainNode', pos(3, 1))
          const band3GainId = store.addAdaptedNode('GainNode', pos(3, 2))

          const mixerId = store.addAdaptedNode('GainNode', pos(4, 1))
          const destId = store.addAdaptedNode('AudioDestinationNode', pos(5, 1))
          const micId = await store.addMicrophoneInput(pos(0, 1))

          // Frequency slider for oscillator bank
          const freqSliderId = store.addAdaptedNode('SliderNode', pos(0, 0))

          store.updateNodeProperty(micGainId, 'gain', 0.5)

          // Bandpass filters
          store.updateNodeProperty(filter1Id, 'type', 'bandpass')
          store.updateNodeProperty(filter1Id, 'frequency', 300)
          store.updateNodeProperty(filter1Id, 'Q', 3)

          store.updateNodeProperty(filter2Id, 'type', 'bandpass')
          store.updateNodeProperty(filter2Id, 'frequency', 1000)
          store.updateNodeProperty(filter2Id, 'Q', 3)

          store.updateNodeProperty(filter3Id, 'type', 'bandpass')
          store.updateNodeProperty(filter3Id, 'frequency', 3000)
          store.updateNodeProperty(filter3Id, 'Q', 3)

          // Oscillator bank
          store.updateNodeProperty(oscBankId, 'frequency', 110)
          store.updateNodeProperty(oscBankId, 'detune', 10)

          // Frequency slider
          store.updateNodeProperty(freqSliderId, 'min', 55)
          store.updateNodeProperty(freqSliderId, 'max', 440)
          store.updateNodeProperty(freqSliderId, 'value', 110)
          store.updateNodeProperty(freqSliderId, 'label', 'Carrier Freq')

          // Band gains
          store.updateNodeProperty(band1GainId, 'gain', 0.1)
          store.updateNodeProperty(band2GainId, 'gain', 0.1)
          store.updateNodeProperty(band3GainId, 'gain', 0.1)

          store.updateNodeProperty(mixerId, 'gain', 0.3)

          // Connect mic to filters
          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, filter1Id, 'output', 'input')
          store.addEdge(micGainId, filter2Id, 'output', 'input')
          store.addEdge(micGainId, filter3Id, 'output', 'input')

          // Connect frequency slider to oscillator bank
          store.addEdge(freqSliderId, oscBankId, 'value', 'frequency')

          // Connect oscillator bank to band gains
          store.addEdge(oscBankId, band1GainId, 'output', 'input')
          store.addEdge(oscBankId, band2GainId, 'output', 'input')
          store.addEdge(oscBankId, band3GainId, 'output', 'input')

          // Filtered voice controls band gains
          store.addEdge(filter1Id, band1GainId, 'output', 'gain')
          store.addEdge(filter2Id, band2GainId, 'output', 'gain')
          store.addEdge(filter3Id, band3GainId, 'output', 'gain')

          // Mix bands
          store.addEdge(band1GainId, mixerId, 'output', 'input')
          store.addEdge(band2GainId, mixerId, 'output', 'input')
          store.addEdge(band3GainId, mixerId, 'output', 'input')

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
      description: 'Layer your voice with OscillatorBank harmonies',
      create: createExample(async () => {
        try {
          const micGainId = store.addAdaptedNode('GainNode', pos(1, 0))
          const oscBankId = store.addAdaptedNode('Composite_OscillatorBank', pos(1, 1))
          const harmonyGainId = store.addAdaptedNode('GainNode', pos(2, 1))
          const mixerId = store.addAdaptedNode('GainNode', pos(3, 0))
          const destId = store.addAdaptedNode('AudioDestinationNode', pos(4, 0))
          const micId = await store.addMicrophoneInput(pos(0, 0))

          // Frequency slider for harmonies
          const freqSliderId = store.addAdaptedNode('SliderNode', pos(0, 1))

          store.updateNodeProperty(micGainId, 'gain', 0.7)
          store.updateNodeProperty(harmonyGainId, 'gain', 0.15)
          store.updateNodeProperty(mixerId, 'gain', 0.8)

          // Harmony frequency
          store.updateNodeProperty(freqSliderId, 'min', 200)
          store.updateNodeProperty(freqSliderId, 'max', 600)
          store.updateNodeProperty(freqSliderId, 'value', 330)
          store.updateNodeProperty(freqSliderId, 'label', 'Harmony Freq')

          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, mixerId, 'output', 'input')
          store.addEdge(freqSliderId, oscBankId, 'value', 'frequency')
          store.addEdge(oscBankId, harmonyGainId, 'output', 'input')
          store.addEdge(harmonyGainId, mixerId, 'output', 'input')
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
          const micGainId = store.addAdaptedNode('GainNode', pos(1, 0))
          const delayId = store.addAdaptedNode('DelayNode', pos(2, 0))
          const lfoId = store.addAdaptedNode('Composite_SimpleLFO', pos(1, 1))
          const dryGainId = store.addAdaptedNode('GainNode', pos(3, 0))
          const wetGainId = store.addAdaptedNode('GainNode', pos(3, 1))
          const mixerId = store.addAdaptedNode('GainNode', pos(4, 0))
          const destId = store.addAdaptedNode('AudioDestinationNode', pos(5, 0))
          const micId = await store.addMicrophoneInput(pos(0, 0))

          store.updateNodeProperty(micGainId, 'gain', 0.5)
          store.updateNodeProperty(delayId, 'delayTime', 0.02)
          store.updateNodeProperty(dryGainId, 'gain', 0.3)
          store.updateNodeProperty(wetGainId, 'gain', 0.7)
          store.updateNodeProperty(mixerId, 'gain', 0.8)

          // LFO for pitch modulation
          store.updateNodeProperty(lfoId, 'rate', 6)
          store.updateNodeProperty(lfoId, 'depth', 0.005)

          store.addEdge(micId, micGainId, 'output', 'input')
          store.addEdge(micGainId, dryGainId, 'output', 'input')
          store.addEdge(micGainId, delayId, 'output', 'input')
          store.addEdge(lfoId, delayId, 'output', 'delayTime')
          store.addEdge(delayId, wetGainId, 'output', 'input')
          store.addEdge(dryGainId, mixerId, 'output', 'input')
          store.addEdge(wetGainId, mixerId, 'output', 'input')
          store.addEdge(mixerId, destId, 'output', 'input')
        } catch (error) {
          console.error('Failed to create voice pitch shifter example:', error)
          alert('Microphone access denied. Please allow microphone access and try again.')
        }
      }),
    },
  ]

  return { examples }
}
