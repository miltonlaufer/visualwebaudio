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
        const oscGainId = store.addNode('GainNode', { x: 250, y: 100 })
        const filterId = store.addNode('BiquadFilterNode', { x: 400, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 250, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 100 })

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
        const oscGainId = store.addNode('GainNode', { x: 250, y: 150 })
        const pannerId = store.addNode('StereoPannerNode', { x: 400, y: 150 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 250, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 150 })

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
        const oscGainId = store.addNode('GainNode', { x: 250, y: 150 })
        const compressorId = store.addNode('DynamicsCompressorNode', { x: 400, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 150 })

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
        const oscGainId = store.addNode('GainNode', { x: 250, y: 100 })
        const gainId = store.addNode('GainNode', { x: 400, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 300 })
        const lfoGainId = store.addNode('GainNode', { x: 250, y: 300 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 100 })

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
        const osc1GainId = store.addNode('GainNode', { x: 250, y: 100 })
        const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 300 })
        const osc2GainId = store.addNode('GainNode', { x: 250, y: 300 })
        const gainId = store.addNode('GainNode', { x: 400, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 200 })

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
        const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 200 })
        const osc3Id = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const gain1Id = store.addNode('GainNode', { x: 250, y: 50 })
        const gain2Id = store.addNode('GainNode', { x: 250, y: 200 })
        const gain3Id = store.addNode('GainNode', { x: 250, y: 350 })
        const mixerId = store.addNode('GainNode', { x: 500, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 750, y: 200 })

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
        const oscGainId = store.addNode('GainNode', { x: 250, y: 150 })
        const gainId = store.addNode('GainNode', { x: 400, y: 150 })
        const waveshaperId = store.addNode('WaveShaperNode', { x: 650, y: 150 })
        const outputGainId = store.addNode('GainNode', { x: 900, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 1150, y: 150 })

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
        const oscGainId = store.addNode('GainNode', { x: 250, y: 150 })
        const filter1Id = store.addNode('BiquadFilterNode', { x: 400, y: 100 })
        const filter2Id = store.addNode('BiquadFilterNode', { x: 400, y: 200 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 250, y: 350 })
        const mixerId = store.addNode('GainNode', { x: 650, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 900, y: 150 })

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
        const noiseGainId = store.addNode('GainNode', { x: 250, y: 150 })
        const filterId = store.addNode('BiquadFilterNode', { x: 400, y: 150 })
        const gainId = store.addNode('GainNode', { x: 650, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 900, y: 150 })

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
        const oscGainId = store.addNode('GainNode', { x: 250, y: 100 })
        const envelopeId = store.addNode('GainNode', { x: 400, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 300 })
        const lfoGainId = store.addNode('GainNode', { x: 250, y: 300 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 100 })

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
        const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 300 })
        const gain1Id = store.addNode('GainNode', { x: 250, y: 100 })
        const gain2Id = store.addNode('GainNode', { x: 250, y: 300 })
        const mixerId = store.addNode('GainNode', { x: 500, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 750, y: 200 })

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
        const oscGainId = store.addNode('GainNode', { x: 250, y: 150 })
        const gainId = store.addNode('GainNode', { x: 400, y: 150 })
        const reverbId = store.addNode('ConvolverNode', { x: 650, y: 150 })
        const dryGainId = store.addNode('GainNode', { x: 650, y: 50 })
        const wetGainId = store.addNode('GainNode', { x: 650, y: 250 })
        const mixerId = store.addNode('GainNode', { x: 900, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 1150, y: 150 })

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
          const micGainId = store.addNode('GainNode', { x: 250, y: 150 })
          const gainId = store.addNode('GainNode', { x: 400, y: 150 })
          const reverbId = store.addNode('ConvolverNode', { x: 650, y: 200 })
          const dryGainId = store.addNode('GainNode', { x: 650, y: 50 })
          const wetGainId = store.addNode('GainNode', { x: 650, y: 300 })
          const mixerId = store.addNode('GainNode', { x: 900, y: 150 })
          const destId = store.addNode('AudioDestinationNode', { x: 1150, y: 150 })

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
        const oscGainId = store.addNode('GainNode', { x: 250, y: 200 })
        const splitterId = store.addNode('ChannelSplitterNode', { x: 450, y: 200 })
        const leftGainId = store.addNode('GainNode', { x: 750, y: 100 })
        const rightGainId = store.addNode('GainNode', { x: 750, y: 300 })
        const mergerId = store.addNode('ChannelMergerNode', { x: 1050, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 1350, y: 200 })

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
          const micGainId = store.addNode('GainNode', { x: 250, y: 150 })
          const carrierOscId = store.addNode('OscillatorNode', { x: 100, y: 350 })
          const carrierGainId = store.addNode('GainNode', { x: 250, y: 350 })
          const ringModId = store.addNode('GainNode', { x: 450, y: 250 })
          const outputGainId = store.addNode('GainNode', { x: 650, y: 250 })
          const destId = store.addNode('AudioDestinationNode', { x: 850, y: 250 })

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
          const micGainId = store.addNode('GainNode', { x: 200, y: 200 })

          // Create multiple band-pass filters for vocoder bands
          const filter1Id = store.addNode('BiquadFilterNode', { x: 350, y: 100 })
          const filter2Id = store.addNode('BiquadFilterNode', { x: 350, y: 200 })
          const filter3Id = store.addNode('BiquadFilterNode', { x: 350, y: 300 })

          // Create oscillators for each band
          const osc1Id = store.addNode('OscillatorNode', { x: 100, y: 100 })
          const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 300 })
          const osc3Id = store.addNode('OscillatorNode', { x: 100, y: 500 })

          // Create gain nodes for oscillators (sound generator rule)
          const osc1GainId = store.addNode('GainNode', { x: 250, y: 100 })
          const osc2GainId = store.addNode('GainNode', { x: 250, y: 300 })
          const osc3GainId = store.addNode('GainNode', { x: 250, y: 500 })

          // Create gain nodes for each band (controlled by filtered voice)
          const band1GainId = store.addNode('GainNode', { x: 550, y: 100 })
          const band2GainId = store.addNode('GainNode', { x: 550, y: 200 })
          const band3GainId = store.addNode('GainNode', { x: 550, y: 300 })

          // Create mixer and output
          const mixerId = store.addNode('GainNode', { x: 750, y: 200 })
          const destId = store.addNode('AudioDestinationNode', { x: 950, y: 200 })

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
          store.updateNodeProperty(osc1Id, 'type', 'sawtooth')

          store.updateNodeProperty(osc2Id, 'frequency', 220) // A3
          store.updateNodeProperty(osc2Id, 'type', 'sawtooth')

          store.updateNodeProperty(osc3Id, 'frequency', 440) // A4
          store.updateNodeProperty(osc3Id, 'type', 'sawtooth')

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
          const micGainId = store.addNode('GainNode', { x: 300, y: 200 })

          // Create harmony oscillators (3rd and 5th intervals)
          const harmony3rdId = store.addNode('OscillatorNode', { x: 100, y: 350 })
          const harmony5thId = store.addNode('OscillatorNode', { x: 100, y: 500 })

          // Create gain nodes for oscillators (sound generator rule)
          const harmony3rdGainId = store.addNode('GainNode', { x: 300, y: 350 })
          const harmony5thGainId = store.addNode('GainNode', { x: 300, y: 500 })

          // Create gain node for voice level control
          const voiceGainId = store.addNode('GainNode', { x: 500, y: 200 })

          // Create mixer and output
          const mixerId = store.addNode('GainNode', { x: 700, y: 350 })
          const destId = store.addNode('AudioDestinationNode', { x: 900, y: 350 })

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
          const micGainId = store.addNode('GainNode', { x: 250, y: 200 })

          // Create delay-based pitch shifting
          const delayId = store.addNode('DelayNode', { x: 400, y: 200 })
          const lfoId = store.addNode('OscillatorNode', { x: 400, y: 350 })
          const lfoGainId = store.addNode('GainNode', { x: 550, y: 350 })

          // Create dry/wet mix
          const dryGainId = store.addNode('GainNode', { x: 700, y: 150 })
          const wetGainId = store.addNode('GainNode', { x: 700, y: 250 })
          const mixerId = store.addNode('GainNode', { x: 850, y: 200 })
          const destId = store.addNode('AudioDestinationNode', { x: 1000, y: 200 })

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

          // Main signal path from microphone gain
          store.addEdge(micId, micGainId, 'output', 'input')

          // Dry path
          store.addEdge(micGainId, dryGainId, 'output', 'input')
          store.addEdge(dryGainId, mixerId, 'output', 'input')

          // Wet path (pitch shifted)
          store.addEdge(micGainId, delayId, 'output', 'input')
          store.addEdge(delayId, wetGainId, 'output', 'input')
          store.addEdge(wetGainId, mixerId, 'output', 'input')

          // LFO modulation of delay time
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, delayId, 'output', 'delayTime')

          // Output
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
