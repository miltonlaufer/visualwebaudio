import { useAudioGraphStore } from '~/stores/AudioGraphStore'

export interface Example {
  id: string
  name: string
  description: string
  create: () => void | Promise<void>
}

export const useExamples = () => {
  const store = useAudioGraphStore()

  const examples: Example[] = [
    {
      id: 'basic-oscillator',
      name: 'Basic Oscillator',
      description: 'Simple sine wave connected to output',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const gainId = store.addNode('GainNode', { x: 350, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 600, y: 150 })
        setTimeout(() => {
          console.log('Basic Oscillator: Setting gain value...')
          store.updateNodeProperty(gainId, 'gain', 0.5)
          console.log('Basic Oscillator: Connecting to destination...')
          store.addEdge(oscId, gainId, 'output', 'input')
          store.addEdge(gainId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'microphone-input',
      name: 'Microphone Input with Delay',
      description: 'Live microphone input with delay and feedback',
      create: async () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        try {
          // Use the store's microphone input action which handles permissions
          const micId = await store.addMicrophoneInput({ x: 100, y: 150 })
          const gainId = store.addNode('GainNode', { x: 350, y: 150 })
          const delayId = store.addNode('DelayNode', { x: 600, y: 150 })
          const feedbackId = store.addNode('GainNode', { x: 600, y: 350 })
          const destId = store.addNode('AudioDestinationNode', { x: 850, y: 150 })

          setTimeout(() => {
            console.log('Microphone Input: Setting up delay effect...')
            // Set delay time and feedback gain
            store.updateNodeProperty(delayId, 'delayTime', 0.3)
            store.updateNodeProperty(feedbackId, 'gain', 0.7)
            store.updateNodeProperty(gainId, 'gain', 0.7)

            // Connect the nodes
            console.log('Microphone Input: Connecting main audio chain...')
            store.addEdge(micId, gainId, 'output', 'input')
            store.addEdge(gainId, delayId, 'output', 'input')
            store.addEdge(delayId, destId, 'output', 'input')

            console.log('Microphone Input: Connecting feedback loop...')
            store.addEdge(delayId, feedbackId, 'output', 'input')
            store.addEdge(feedbackId, delayId, 'output', 'input')
          }, 200)
        } catch (error) {
          console.error('Failed to create microphone input example:', error)
          // Show user-friendly error message
          alert(
            'Microphone access denied or not available. Please allow microphone access and try again.'
          )
        }
      },
    },
    {
      id: 'delay-effect',
      name: 'Delay Effect',
      description: 'Oscillator with delay and feedback',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const gainId = store.addNode('GainNode', { x: 350, y: 150 })
        const delayId = store.addNode('DelayNode', { x: 600, y: 150 })
        const feedbackId = store.addNode('GainNode', { x: 600, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 850, y: 150 })

        setTimeout(() => {
          // Set delay time and feedback gain
          store.updateNodeProperty(delayId, 'delayTime', 0.3)
          store.updateNodeProperty(feedbackId, 'gain', 1)
          store.updateNodeProperty(gainId, 'gain', 0.7)

          // Connect the nodes
          console.log('Delay Effect: Connecting main audio chain...')
          store.addEdge(oscId, gainId, 'output', 'input')
          store.addEdge(gainId, delayId, 'output', 'input')
          store.addEdge(delayId, destId, 'output', 'input')

          console.log('Delay Effect: Connecting feedback loop...')
          store.addEdge(delayId, feedbackId, 'output', 'input')
          store.addEdge(feedbackId, delayId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'filter-sweep',
      name: 'Filter Sweep',
      description: 'Oscillator with animated lowpass filter',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const filterId = store.addNode('BiquadFilterNode', { x: 350, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 350, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 600, y: 100 })

        setTimeout(() => {
          // Set up the main oscillator
          store.updateNodeProperty(oscId, 'type', 'sawtooth')
          store.updateNodeProperty(oscId, 'frequency', 220)

          // Set up the filter
          store.updateNodeProperty(filterId, 'type', 'lowpass')
          store.updateNodeProperty(filterId, 'frequency', 800)
          store.updateNodeProperty(filterId, 'Q', 10)

          // Set up the LFO for filter modulation
          store.updateNodeProperty(lfoId, 'frequency', 0.5)
          store.updateNodeProperty(lfoGainId, 'gain', 1)

          // Connect the audio chain
          console.log('Filter Sweep: Connecting main audio chain...')
          store.addEdge(oscId, filterId, 'output', 'input')
          store.addEdge(filterId, destId, 'output', 'input')

          // Connect the LFO to modulate filter frequency
          console.log('Filter Sweep: Connecting LFO modulation...')
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, filterId, 'output', 'frequency')
        }, 200)
      },
    },
    {
      id: 'stereo-panner',
      name: 'Stereo Panning',
      description: 'Oscillator with stereo panning effect',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const pannerId = store.addNode('StereoPannerNode', { x: 350, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 600, y: 150 })

        setTimeout(() => {
          // Set oscillator frequency
          store.updateNodeProperty(oscId, 'frequency', 440)
          store.updateNodeProperty(oscId, 'type', 'sine')

          // Set panning (0 = center, -1 = left, 1 = right)
          store.updateNodeProperty(pannerId, 'pan', 0.5)

          // Connect the nodes
          console.log('Stereo Panning: Connecting audio chain...')
          store.addEdge(oscId, pannerId, 'output', 'input')
          store.addEdge(pannerId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'compressor-effect',
      name: 'Compressor Effect',
      description: 'Oscillator with dynamic range compression',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const compressorId = store.addNode('DynamicsCompressorNode', { x: 350, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 600, y: 150 })

        setTimeout(() => {
          // Set oscillator properties
          store.updateNodeProperty(oscId, 'frequency', 220)
          store.updateNodeProperty(oscId, 'type', 'square')

          // Set compressor properties
          store.updateNodeProperty(compressorId, 'threshold', -24)
          store.updateNodeProperty(compressorId, 'knee', 30)
          store.updateNodeProperty(compressorId, 'ratio', 12)
          store.updateNodeProperty(compressorId, 'attack', 0.003)
          store.updateNodeProperty(compressorId, 'release', 0.25)

          // Connect the nodes
          console.log('Compressor Effect: Connecting audio chain...')
          store.addEdge(oscId, compressorId, 'output', 'input')
          store.addEdge(compressorId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'tremolo-effect',
      name: 'Tremolo Effect',
      description: 'Oscillator with amplitude modulation',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const gainId = store.addNode('GainNode', { x: 350, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 300 })
        const lfoGainId = store.addNode('GainNode', { x: 350, y: 300 })
        const destId = store.addNode('AudioDestinationNode', { x: 600, y: 100 })

        setTimeout(() => {
          // Set up the main oscillator
          store.updateNodeProperty(oscId, 'frequency', 440)
          store.updateNodeProperty(oscId, 'type', 'sine')

          // Set up the gain node
          store.updateNodeProperty(gainId, 'gain', 0.5)

          // Set up the LFO for tremolo
          store.updateNodeProperty(lfoId, 'frequency', 5)
          store.updateNodeProperty(lfoGainId, 'gain', 0.3)

          // Connect the audio chain
          console.log('Tremolo Effect: Connecting main audio chain...')
          store.addEdge(oscId, gainId, 'output', 'input')
          store.addEdge(gainId, destId, 'output', 'input')

          // Connect the LFO for tremolo effect
          console.log('Tremolo Effect: Connecting LFO modulation...')
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, gainId, 'output', 'gain')
        }, 200)
      },
    },
    {
      id: 'ring-modulation',
      name: 'Ring Modulation',
      description: 'Two oscillators with ring modulation effect',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const osc1Id = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 300 })
        const gainId = store.addNode('GainNode', { x: 350, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 600, y: 200 })

        setTimeout(() => {
          // Set up the carrier oscillator
          store.updateNodeProperty(osc1Id, 'frequency', 440)
          store.updateNodeProperty(osc1Id, 'type', 'sine')

          // Set up the modulator oscillator
          store.updateNodeProperty(osc2Id, 'frequency', 30)
          store.updateNodeProperty(osc2Id, 'type', 'sine')

          // Set up the gain node
          store.updateNodeProperty(gainId, 'gain', 0.5)

          // Connect for ring modulation
          console.log('Ring Modulation: Connecting audio chain...')
          store.addEdge(osc1Id, gainId, 'output', 'input')
          store.addEdge(osc2Id, gainId, 'output', 'gain')
          store.addEdge(gainId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'chord-synthesis',
      name: 'Chord Synthesis',
      description: 'Multiple oscillators creating a chord',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const osc1Id = store.addNode('OscillatorNode', { x: 100, y: 50 })
        const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 200 })
        const osc3Id = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const gain1Id = store.addNode('GainNode', { x: 350, y: 50 })
        const gain2Id = store.addNode('GainNode', { x: 350, y: 200 })
        const gain3Id = store.addNode('GainNode', { x: 350, y: 350 })
        const mixerId = store.addNode('GainNode', { x: 600, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 850, y: 200 })

        setTimeout(() => {
          // Set up C major chord (C4, E4, G4)
          store.updateNodeProperty(osc1Id, 'frequency', 261.63) // C4
          store.updateNodeProperty(osc2Id, 'frequency', 329.63) // E4
          store.updateNodeProperty(osc3Id, 'frequency', 392.0) // G4

          // Set all oscillators to sine wave
          store.updateNodeProperty(osc1Id, 'type', 'sine')
          store.updateNodeProperty(osc2Id, 'type', 'sine')
          store.updateNodeProperty(osc3Id, 'type', 'sine')

          // Set individual gains
          store.updateNodeProperty(gain1Id, 'gain', 0.3)
          store.updateNodeProperty(gain2Id, 'gain', 0.3)
          store.updateNodeProperty(gain3Id, 'gain', 0.3)

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
        }, 200)
      },
    },
    {
      id: 'waveshaper-distortion',
      name: 'Waveshaper Distortion',
      description: 'Oscillator with waveshaper distortion effect',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const gainId = store.addNode('GainNode', { x: 350, y: 150 })
        const waveshaperId = store.addNode('WaveShaperNode', { x: 600, y: 150 })
        const outputGainId = store.addNode('GainNode', { x: 850, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 1100, y: 150 })

        setTimeout(() => {
          // Set up the oscillator
          store.updateNodeProperty(oscId, 'frequency', 220)
          store.updateNodeProperty(oscId, 'type', 'sine')

          // Set up the input gain (drive)
          store.updateNodeProperty(gainId, 'gain', 2)

          // Set up the output gain (to control volume after distortion)
          store.updateNodeProperty(outputGainId, 'gain', 0.3)

          // Connect the audio chain
          console.log('Waveshaper Distortion: Connecting audio chain...')
          store.addEdge(oscId, gainId, 'output', 'input')
          store.addEdge(gainId, waveshaperId, 'output', 'input')
          store.addEdge(waveshaperId, outputGainId, 'output', 'input')
          store.addEdge(outputGainId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'phaser-effect',
      name: 'Phaser Effect',
      description: 'Oscillator with phaser effect using multiple filters',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const filter1Id = store.addNode('BiquadFilterNode', { x: 350, y: 100 })
        const filter2Id = store.addNode('BiquadFilterNode', { x: 350, y: 200 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 350, y: 350 })
        const mixerId = store.addNode('GainNode', { x: 600, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 850, y: 150 })

        setTimeout(() => {
          // Set up the main oscillator
          store.updateNodeProperty(oscId, 'frequency', 440)
          store.updateNodeProperty(oscId, 'type', 'sawtooth')

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
          store.addEdge(oscId, filter1Id, 'output', 'input')
          store.addEdge(filter1Id, filter2Id, 'output', 'input')
          store.addEdge(filter2Id, mixerId, 'output', 'input')
          store.addEdge(mixerId, destId, 'output', 'input')

          // Connect the LFO for phasing modulation
          console.log('Phaser Effect: Connecting LFO modulation...')
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, filter1Id, 'output', 'frequency')
          store.addEdge(lfoGainId, filter2Id, 'output', 'frequency')
        }, 200)
      },
    },
    {
      id: 'simple-noise',
      name: 'Simple Noise',
      description: 'White noise generator with filter',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        // Note: We'll use an AudioBufferSourceNode with noise data
        const noiseId = store.addNode('AudioBufferSourceNode', { x: 100, y: 150 })
        const filterId = store.addNode('BiquadFilterNode', { x: 350, y: 150 })
        const gainId = store.addNode('GainNode', { x: 600, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 850, y: 150 })

        setTimeout(() => {
          // Set up the filter
          store.updateNodeProperty(filterId, 'type', 'lowpass')
          store.updateNodeProperty(filterId, 'frequency', 2000)
          store.updateNodeProperty(filterId, 'Q', 1)

          // Set up the gain
          store.updateNodeProperty(gainId, 'gain', 0.3)

          // Connect the audio chain
          console.log('Simple Noise: Connecting audio chain...')
          store.addEdge(noiseId, filterId, 'output', 'input')
          store.addEdge(filterId, gainId, 'output', 'input')
          store.addEdge(gainId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'amplitude-envelope',
      name: 'Amplitude Envelope',
      description: 'Oscillator with LFO envelope modulation',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const envelopeId = store.addNode('GainNode', { x: 350, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 100, y: 300 })
        const lfoGainId = store.addNode('GainNode', { x: 350, y: 300 })
        const destId = store.addNode('AudioDestinationNode', { x: 600, y: 100 })

        setTimeout(() => {
          // Set up the main oscillator
          store.updateNodeProperty(oscId, 'frequency', 440)
          store.updateNodeProperty(oscId, 'type', 'sawtooth')

          // Set up the envelope gain (base level)
          store.updateNodeProperty(envelopeId, 'gain', 0.3)

          // Set up the LFO for envelope modulation (slow attack/decay)
          store.updateNodeProperty(lfoId, 'frequency', 0.2) // Very slow for envelope effect
          store.updateNodeProperty(lfoGainId, 'gain', 0.3) // Modulation depth

          // Connect the audio chain
          console.log('Amplitude Envelope: Connecting audio chain...')
          store.addEdge(oscId, envelopeId, 'output', 'input')
          store.addEdge(envelopeId, destId, 'output', 'input')

          // Connect the LFO for envelope modulation
          console.log('Amplitude Envelope: Connecting LFO envelope...')
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, envelopeId, 'output', 'gain')
        }, 200)
      },
    },
    {
      id: 'beat-frequency',
      name: 'Beat Frequency',
      description: 'Two slightly detuned oscillators creating beats',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const osc1Id = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const osc2Id = store.addNode('OscillatorNode', { x: 100, y: 300 })
        const gain1Id = store.addNode('GainNode', { x: 350, y: 100 })
        const gain2Id = store.addNode('GainNode', { x: 350, y: 300 })
        const mixerId = store.addNode('GainNode', { x: 600, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 850, y: 200 })

        setTimeout(() => {
          // Set up slightly detuned oscillators for beat frequency
          store.updateNodeProperty(osc1Id, 'frequency', 440) // A4
          store.updateNodeProperty(osc2Id, 'frequency', 444) // Slightly sharp A4 (4Hz beat)

          // Set both to sine waves
          store.updateNodeProperty(osc1Id, 'type', 'sine')
          store.updateNodeProperty(osc2Id, 'type', 'sine')

          // Set individual gains
          store.updateNodeProperty(gain1Id, 'gain', 0.3)
          store.updateNodeProperty(gain2Id, 'gain', 0.3)

          // Set mixer gain
          store.updateNodeProperty(mixerId, 'gain', 1)

          // Connect the audio chain
          console.log('Beat Frequency: Connecting audio chain...')
          store.addEdge(osc1Id, gain1Id, 'output', 'input')
          store.addEdge(osc2Id, gain2Id, 'output', 'input')
          store.addEdge(gain1Id, mixerId, 'output', 'input')
          store.addEdge(gain2Id, mixerId, 'output', 'input')
          store.addEdge(mixerId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'convolution-reverb',
      name: 'Convolution Reverb',
      description: 'Oscillator with convolution reverb effect',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const gainId = store.addNode('GainNode', { x: 350, y: 150 })
        const reverbId = store.addNode('ConvolverNode', { x: 600, y: 150 })
        const dryGainId = store.addNode('GainNode', { x: 600, y: 50 })
        const wetGainId = store.addNode('GainNode', { x: 600, y: 250 })
        const mixerId = store.addNode('GainNode', { x: 850, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 1100, y: 150 })

        setTimeout(() => {
          // Set up the oscillator
          store.updateNodeProperty(oscId, 'frequency', 440)
          store.updateNodeProperty(oscId, 'type', 'sine')

          // Set up the input gain
          store.updateNodeProperty(gainId, 'gain', 0.5)

          // Set up dry/wet mix
          store.updateNodeProperty(dryGainId, 'gain', 0.7) // Dry signal
          store.updateNodeProperty(wetGainId, 'gain', 0.3) // Wet signal

          // Set up the mixer
          store.updateNodeProperty(mixerId, 'gain', 1)

          // Connect the audio chain
          console.log('Convolution Reverb: Connecting audio chain...')
          store.addEdge(oscId, gainId, 'output', 'input')

          // Dry path
          store.addEdge(gainId, dryGainId, 'output', 'input')
          store.addEdge(dryGainId, mixerId, 'output', 'input')

          // Wet path (through reverb)
          store.addEdge(gainId, reverbId, 'output', 'input')
          store.addEdge(reverbId, wetGainId, 'output', 'input')
          store.addEdge(wetGainId, mixerId, 'output', 'input')

          // Output
          store.addEdge(mixerId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'microphone-reverb',
      name: 'Microphone Reverb',
      description: 'Live microphone input with convolution reverb effect',
      create: async () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        try {
          // Use the store's microphone input action which handles permissions
          const micId = await store.addMicrophoneInput({ x: 100, y: 150 })
          const gainId = store.addNode('GainNode', { x: 350, y: 150 })
          const reverbId = store.addNode('ConvolverNode', { x: 600, y: 150 })
          const dryGainId = store.addNode('GainNode', { x: 600, y: 50 })
          const wetGainId = store.addNode('GainNode', { x: 600, y: 250 })
          const mixerId = store.addNode('GainNode', { x: 850, y: 150 })
          const destId = store.addNode('AudioDestinationNode', { x: 1100, y: 150 })

          setTimeout(() => {
            // Set up the input gain
            store.updateNodeProperty(gainId, 'gain', 0.8)

            // Set up dry/wet mix
            store.updateNodeProperty(dryGainId, 'gain', 0.5) // Dry signal
            store.updateNodeProperty(wetGainId, 'gain', 0.5) // Wet signal (more reverb for mic)

            // Set up the mixer
            store.updateNodeProperty(mixerId, 'gain', 1)

            // Connect the audio chain
            console.log('Microphone Reverb: Connecting audio chain...')
            store.addEdge(micId, gainId, 'output', 'input')

            // Dry path
            store.addEdge(gainId, dryGainId, 'output', 'input')
            store.addEdge(dryGainId, mixerId, 'output', 'input')

            // Wet path (through reverb)
            store.addEdge(gainId, reverbId, 'output', 'input')
            store.addEdge(reverbId, wetGainId, 'output', 'input')
            store.addEdge(wetGainId, mixerId, 'output', 'input')

            // Output
            store.addEdge(mixerId, destId, 'output', 'input')
          }, 200)
        } catch (error) {
          console.error('Failed to create microphone reverb example:', error)
          // Show user-friendly error message
          alert(
            'Microphone access denied or not available. Please allow microphone access and try again.'
          )
        }
      },
    },
    {
      id: 'stereo-effects',
      name: 'Stereo Effects',
      description: 'Stereo processing with channel splitting and merging',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 200 })
        const splitterId = store.addNode('ChannelSplitterNode', { x: 400, y: 200 })
        const leftGainId = store.addNode('GainNode', { x: 700, y: 100 })
        const rightGainId = store.addNode('GainNode', { x: 700, y: 300 })
        const mergerId = store.addNode('ChannelMergerNode', { x: 1000, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 1300, y: 200 })

        setTimeout(() => {
          // Set up the oscillator
          store.updateNodeProperty(oscId, 'frequency', 440)
          store.updateNodeProperty(oscId, 'type', 'sawtooth')

          // Set up different gains for left and right channels
          store.updateNodeProperty(leftGainId, 'gain', 0.8) // Left channel
          store.updateNodeProperty(rightGainId, 'gain', 0.4) // Right channel (quieter)

          // Connect the audio chain
          console.log('Stereo Effects: Connecting audio chain...')
          store.addEdge(oscId, splitterId, 'output', 'input')

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
        }, 200)
      },
    },
  ]

  return { examples }
}
