import React, { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import ProjectModal from './ProjectModal'

const Header: React.FC = observer(() => {
  const store = useAudioGraphStore()
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [isExamplesOpen, setIsExamplesOpen] = useState(false)

  const examples = [
    {
      id: 'basic-oscillator',
      name: 'Basic Oscillator',
      description: 'Simple sine wave connected to output',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 100, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 400, y: 150 })
        setTimeout(() => {
          console.log('Basic Oscillator: Connecting to destination...')
          store.addEdge(oscId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'delay-effect',
      name: 'Delay Effect',
      description: 'Oscillator with delay and feedback',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 50, y: 150 })
        const gainId = store.addNode('GainNode', { x: 250, y: 150 })
        const delayId = store.addNode('DelayNode', { x: 450, y: 150 })
        const feedbackId = store.addNode('GainNode', { x: 450, y: 300 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 150 })

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

        const oscId = store.addNode('OscillatorNode', { x: 50, y: 100 })
        const filterId = store.addNode('BiquadFilterNode', { x: 300, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 50, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 300, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 550, y: 100 })

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

        const oscId = store.addNode('OscillatorNode', { x: 50, y: 100 })
        const pannerId = store.addNode('StereoPannerNode', { x: 300, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 50, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 300, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 550, y: 100 })

        setTimeout(() => {
          // Set up the main oscillator
          store.updateNodeProperty(oscId, 'frequency', 440)

          // Set up the LFO for panning
          store.updateNodeProperty(lfoId, 'frequency', 0.2)
          store.updateNodeProperty(lfoGainId, 'gain', 0.8) // Pan range control

          // Connect the nodes
          console.log('Stereo Panning: Connecting main audio chain...')
          store.addEdge(oscId, pannerId, 'output', 'input')
          store.addEdge(pannerId, destId, 'output', 'input')

          console.log('Stereo Panning: Connecting LFO modulation...')
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, pannerId, 'output', 'pan')
        }, 200)
      },
    },
    {
      id: 'compressor-effect',
      name: 'Compressor Effect',
      description: 'Oscillator with dynamics compression',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 50, y: 150 })
        const gainId = store.addNode('GainNode', { x: 250, y: 150 })
        const compId = store.addNode('DynamicsCompressorNode', { x: 450, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 700, y: 150 })

        setTimeout(() => {
          // Set up a louder signal to trigger compression
          store.updateNodeProperty(oscId, 'type', 'square')
          store.updateNodeProperty(gainId, 'gain', 2)

          // Set up the compressor
          store.updateNodeProperty(compId, 'threshold', -20)
          store.updateNodeProperty(compId, 'ratio', 8)
          store.updateNodeProperty(compId, 'attack', 0.01)
          store.updateNodeProperty(compId, 'release', 0.1)

          // Connect the nodes
          console.log('Compressor Effect: Connecting audio chain...')
          store.addEdge(oscId, gainId, 'output', 'input')
          store.addEdge(gainId, compId, 'output', 'input')
          store.addEdge(compId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'tremolo-effect',
      name: 'Tremolo Effect',
      description: 'Amplitude modulation with LFO',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 50, y: 100 })
        const tremoloGainId = store.addNode('GainNode', { x: 300, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 50, y: 300 })
        const lfoGainId = store.addNode('GainNode', { x: 300, y: 300 })
        const destId = store.addNode('AudioDestinationNode', { x: 550, y: 100 })

        setTimeout(() => {
          // Set up the main oscillator
          store.updateNodeProperty(oscId, 'type', 'sine')
          store.updateNodeProperty(oscId, 'frequency', 440)

          // Set up the tremolo (amplitude modulation)
          store.updateNodeProperty(tremoloGainId, 'gain', 0.5) // Base amplitude

          // Set up the LFO for tremolo
          store.updateNodeProperty(lfoId, 'frequency', 4) // 4 Hz tremolo
          store.updateNodeProperty(lfoGainId, 'gain', 0.3) // Tremolo depth

          // Connect the audio chain
          console.log('Tremolo Effect: Connecting main audio chain...')
          store.addEdge(oscId, tremoloGainId, 'output', 'input')
          store.addEdge(tremoloGainId, destId, 'output', 'input')

          // Connect the LFO for tremolo modulation
          console.log('Tremolo Effect: Connecting LFO modulation...')
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, tremoloGainId, 'output', 'gain')
        }, 200)
      },
    },
    {
      id: 'ring-modulation',
      name: 'Ring Modulation',
      description: 'Two oscillators creating metallic tones',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const osc1Id = store.addNode('OscillatorNode', { x: 50, y: 100 })
        const osc2Id = store.addNode('OscillatorNode', { x: 50, y: 300 })
        const modulatorGainId = store.addNode('GainNode', { x: 300, y: 300 })
        const carrierGainId = store.addNode('GainNode', { x: 300, y: 100 })
        const destId = store.addNode('AudioDestinationNode', { x: 550, y: 200 })

        setTimeout(() => {
          // Set up carrier oscillator
          store.updateNodeProperty(osc1Id, 'frequency', 440)
          store.updateNodeProperty(carrierGainId, 'gain', 0.3)

          // Set up modulator oscillator
          store.updateNodeProperty(osc2Id, 'frequency', 30) // Low frequency modulator
          store.updateNodeProperty(modulatorGainId, 'gain', 0.5)

          // Connect for ring modulation
          console.log('Ring Modulation: Connecting oscillators...')
          store.addEdge(osc1Id, carrierGainId, 'output', 'input')
          store.addEdge(osc2Id, modulatorGainId, 'output', 'input')
          store.addEdge(modulatorGainId, carrierGainId, 'output', 'gain')
          store.addEdge(carrierGainId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'chord-synthesis',
      name: 'Chord Synthesis',
      description: 'Multiple oscillators creating a major chord',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        // Create three oscillators for a C major chord (C, E, G)
        const osc1Id = store.addNode('OscillatorNode', { x: 50, y: 100 }) // C
        const osc2Id = store.addNode('OscillatorNode', { x: 50, y: 250 }) // E
        const osc3Id = store.addNode('OscillatorNode', { x: 50, y: 400 }) // G

        // Single mixer gain and output
        const mixerGainId = store.addNode('GainNode', { x: 350, y: 250 })
        const destId = store.addNode('AudioDestinationNode', { x: 550, y: 250 })

        setTimeout(() => {
          // Set up the chord frequencies (C major: C4, E4, G4)
          store.updateNodeProperty(osc1Id, 'frequency', 261.63) // C4
          store.updateNodeProperty(osc2Id, 'frequency', 329.63) // E4
          store.updateNodeProperty(osc3Id, 'frequency', 392.0) // G4

          // Set overall chord volume
          store.updateNodeProperty(mixerGainId, 'gain', 0.2) // Lower volume since we're mixing 3 signals

          // Connect all oscillators directly to the mixer
          console.log('Chord Synthesis: Connecting oscillators to mixer...')
          store.addEdge(osc1Id, mixerGainId, 'output', 'input')
          store.addEdge(osc2Id, mixerGainId, 'output', 'input')
          store.addEdge(osc3Id, mixerGainId, 'output', 'input')

          // Connect mixer to destination
          store.addEdge(mixerGainId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'waveshaper-distortion',
      name: 'Waveshaper Distortion',
      description: 'Oscillator with waveshaping distortion',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 50, y: 150 })
        const preGainId = store.addNode('GainNode', { x: 200, y: 150 })
        const waveshaperId = store.addNode('WaveShaperNode', { x: 350, y: 150 })
        const postGainId = store.addNode('GainNode', { x: 500, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 150 })

        setTimeout(() => {
          // Set up the oscillator
          store.updateNodeProperty(oscId, 'type', 'sine')
          store.updateNodeProperty(oscId, 'frequency', 220)

          // Boost signal before waveshaping for more distortion
          store.updateNodeProperty(preGainId, 'gain', 3)

          // Reduce output level after distortion
          store.updateNodeProperty(postGainId, 'gain', 0.3)

          // Set up waveshaper (oversample for better quality)
          store.updateNodeProperty(waveshaperId, 'oversample', '4x')

          // Connect the nodes
          console.log('Waveshaper Distortion: Connecting audio chain...')
          store.addEdge(oscId, preGainId, 'output', 'input')
          store.addEdge(preGainId, waveshaperId, 'output', 'input')
          store.addEdge(waveshaperId, postGainId, 'output', 'input')
          store.addEdge(postGainId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'phaser-effect',
      name: 'Phaser Effect',
      description: 'Multiple all-pass filters creating sweeping phase shifts',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 50, y: 200 })
        const filter1Id = store.addNode('BiquadFilterNode', { x: 250, y: 100 })
        const filter2Id = store.addNode('BiquadFilterNode', { x: 250, y: 300 })
        const lfoId = store.addNode('OscillatorNode', { x: 50, y: 450 })
        const lfoGainId = store.addNode('GainNode', { x: 250, y: 450 })
        const mixGainId = store.addNode('GainNode', { x: 450, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 200 })

        setTimeout(() => {
          // Set up the main oscillator
          store.updateNodeProperty(oscId, 'type', 'sawtooth')
          store.updateNodeProperty(oscId, 'frequency', 220)

          // Set up all-pass filters for phasing
          store.updateNodeProperty(filter1Id, 'type', 'allpass')
          store.updateNodeProperty(filter1Id, 'frequency', 1000)
          store.updateNodeProperty(filter1Id, 'Q', 10)

          store.updateNodeProperty(filter2Id, 'type', 'allpass')
          store.updateNodeProperty(filter2Id, 'frequency', 1500)
          store.updateNodeProperty(filter2Id, 'Q', 10)

          // Set up LFO for sweeping
          store.updateNodeProperty(lfoId, 'frequency', 0.3)
          store.updateNodeProperty(lfoGainId, 'gain', 500)

          store.updateNodeProperty(mixGainId, 'gain', 0.7)

          // Connect the phaser chain
          console.log('Phaser Effect: Connecting filter chain...')
          store.addEdge(oscId, filter1Id, 'output', 'input')
          store.addEdge(filter1Id, filter2Id, 'output', 'input')
          store.addEdge(filter2Id, mixGainId, 'output', 'input')
          store.addEdge(mixGainId, destId, 'output', 'input')

          // Connect LFO to modulate both filters
          console.log('Phaser Effect: Connecting LFO modulation...')
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, filter1Id, 'output', 'frequency')
          store.addEdge(lfoGainId, filter2Id, 'output', 'frequency')
        }, 200)
      },
    },
    {
      id: 'white-noise',
      name: 'White Noise',
      description: 'True white noise using AudioBufferSourceNode',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const noiseId = store.addNode('AudioBufferSourceNode', { x: 100, y: 150 })
        const filterId = store.addNode('BiquadFilterNode', { x: 350, y: 150 })
        const gainId = store.addNode('GainNode', { x: 550, y: 150 })
        const destId = store.addNode('AudioDestinationNode', { x: 750, y: 150 })

        setTimeout(() => {
          // Set up the filter for shaping the noise
          store.updateNodeProperty(filterId, 'type', 'lowpass')
          store.updateNodeProperty(filterId, 'frequency', 2000)
          store.updateNodeProperty(filterId, 'Q', 0.5)

          // Set volume
          store.updateNodeProperty(gainId, 'gain', 0.1)

          // Set loop to true for continuous noise
          store.updateNodeProperty(noiseId, 'loop', true)

          // Connect the nodes
          console.log('White Noise: Connecting audio chain...')
          store.addEdge(noiseId, filterId, 'output', 'input')
          store.addEdge(filterId, gainId, 'output', 'input')
          store.addEdge(gainId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'amplitude-envelope',
      name: 'Amplitude Envelope',
      description: 'Oscillator with LFO creating repeating envelope effect',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 50, y: 150 })
        const envGainId = store.addNode('GainNode', { x: 300, y: 150 })
        const lfoId = store.addNode('OscillatorNode', { x: 50, y: 350 })
        const lfoGainId = store.addNode('GainNode', { x: 300, y: 350 })
        const destId = store.addNode('AudioDestinationNode', { x: 550, y: 150 })

        setTimeout(() => {
          // Set up the main oscillator
          store.updateNodeProperty(oscId, 'type', 'sawtooth')
          store.updateNodeProperty(oscId, 'frequency', 440)

          // Set up the envelope gain (base level)
          store.updateNodeProperty(envGainId, 'gain', 0.1)

          // Set up the LFO for envelope automation (slow triangle wave)
          store.updateNodeProperty(lfoId, 'type', 'triangle')
          store.updateNodeProperty(lfoId, 'frequency', 0.5) // 0.5 Hz = 2 second cycle
          store.updateNodeProperty(lfoGainId, 'gain', 0.4) // Envelope depth

          // Connect the audio chain
          console.log('Amplitude Envelope: Connecting main audio chain...')
          store.addEdge(oscId, envGainId, 'output', 'input')
          store.addEdge(envGainId, destId, 'output', 'input')

          // Connect the LFO for envelope automation
          console.log('Amplitude Envelope: Connecting LFO envelope...')
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, envGainId, 'output', 'gain')
        }, 200)
      },
    },
    {
      id: 'beat-frequency',
      name: 'Beat Frequency',
      description: 'Two oscillators at 440Hz and 444Hz creating 4Hz beats',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const osc1Id = store.addNode('OscillatorNode', { x: 50, y: 100 })
        const osc2Id = store.addNode('OscillatorNode', { x: 50, y: 300 })
        const gain1Id = store.addNode('GainNode', { x: 250, y: 100 })
        const gain2Id = store.addNode('GainNode', { x: 250, y: 300 })
        const mixerGainId = store.addNode('GainNode', { x: 450, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 200 })

        setTimeout(() => {
          // Set up oscillators with slight detuning for beat effect
          store.updateNodeProperty(osc1Id, 'frequency', 440.0) // A4
          store.updateNodeProperty(osc2Id, 'frequency', 444.0) // 4Hz higher = 4Hz beats

          // Set individual volumes (lower to hear beats clearly)
          store.updateNodeProperty(gain1Id, 'gain', 0.2)
          store.updateNodeProperty(gain2Id, 'gain', 0.2)
          store.updateNodeProperty(mixerGainId, 'gain', 1)

          // Connect the oscillators
          console.log('Beat Frequency: Connecting oscillators...')
          store.addEdge(osc1Id, gain1Id, 'output', 'input')
          store.addEdge(osc2Id, gain2Id, 'output', 'input')
          store.addEdge(gain1Id, mixerGainId, 'output', 'input')
          store.addEdge(gain2Id, mixerGainId, 'output', 'input')
          store.addEdge(mixerGainId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'convolution-reverb',
      name: 'Convolution Reverb',
      description: 'ConvolverNode creating realistic reverb effect',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 50, y: 150 })
        const dryGainId = store.addNode('GainNode', { x: 250, y: 100 })
        const convolverId = store.addNode('ConvolverNode', { x: 250, y: 250 })
        const wetGainId = store.addNode('GainNode', { x: 450, y: 250 })
        const mixerGainId = store.addNode('GainNode', { x: 650, y: 175 })
        const destId = store.addNode('AudioDestinationNode', { x: 850, y: 175 })

        setTimeout(() => {
          // Set up the oscillator
          store.updateNodeProperty(oscId, 'type', 'triangle')
          store.updateNodeProperty(oscId, 'frequency', 330)

          // Set up dry/wet mix
          store.updateNodeProperty(dryGainId, 'gain', 0.7) // Dry signal
          store.updateNodeProperty(wetGainId, 'gain', 0.4) // Wet (reverb) signal
          store.updateNodeProperty(mixerGainId, 'gain', 1)

          // Connect the reverb chain
          console.log('Convolution Reverb: Connecting dry signal...')
          store.addEdge(oscId, dryGainId, 'output', 'input')
          store.addEdge(dryGainId, mixerGainId, 'output', 'input')

          console.log('Convolution Reverb: Connecting wet signal...')
          store.addEdge(oscId, convolverId, 'output', 'input')
          store.addEdge(convolverId, wetGainId, 'output', 'input')
          store.addEdge(wetGainId, mixerGainId, 'output', 'input')

          store.addEdge(mixerGainId, destId, 'output', 'input')
        }, 200)
      },
    },
    {
      id: 'stereo-effects',
      name: 'Stereo Effects',
      description: 'Oscillator with stereo panning and different channel processing',
      create: () => {
        // Clear existing nodes first to avoid conflicts
        store.clearAllNodes()

        const oscId = store.addNode('OscillatorNode', { x: 50, y: 200 })
        const leftGainId = store.addNode('GainNode', { x: 250, y: 100 })
        const rightGainId = store.addNode('GainNode', { x: 250, y: 300 })
        const leftFilterId = store.addNode('BiquadFilterNode', { x: 450, y: 100 })
        const rightFilterId = store.addNode('BiquadFilterNode', { x: 450, y: 300 })
        const destId = store.addNode('AudioDestinationNode', { x: 650, y: 200 })

        setTimeout(() => {
          // Set up the oscillator
          store.updateNodeProperty(oscId, 'frequency', 440)

          // Set up different processing for left and right
          store.updateNodeProperty(leftGainId, 'gain', 0.3)
          store.updateNodeProperty(rightGainId, 'gain', 0.3)

          // Set up different filters for left and right channels
          store.updateNodeProperty(leftFilterId, 'type', 'lowpass')
          store.updateNodeProperty(leftFilterId, 'frequency', 800)

          store.updateNodeProperty(rightFilterId, 'type', 'highpass')
          store.updateNodeProperty(rightFilterId, 'frequency', 800)

          // Connect the stereo processing chain
          console.log('Stereo Effects: Connecting left channel...')
          store.addEdge(oscId, leftGainId, 'output', 'input')
          store.addEdge(leftGainId, leftFilterId, 'output', 'input')
          store.addEdge(leftFilterId, destId, 'output', 'input')

          console.log('Stereo Effects: Connecting right channel...')
          store.addEdge(oscId, rightGainId, 'output', 'input')
          store.addEdge(rightGainId, rightFilterId, 'output', 'input')
          store.addEdge(rightFilterId, destId, 'output', 'input')
        }, 200)
      },
    },
  ]

  const handleExampleSelect = (example: (typeof examples)[0]) => {
    example.create()
    setIsExamplesOpen(false)
  }

  return (
    <>
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src="./logo.png" alt="Visual Web Audio" className="w-8 h-8" />
            <h1 className="text-2xl font-bold text-gray-900">Visual Web Audio</h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Examples Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsExamplesOpen(!isExamplesOpen)}
                className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Quick Examples
                <svg
                  className={`w-4 h-4 ml-2 transition-transform ${isExamplesOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isExamplesOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[80vh] overflow-y-auto">
                  <div className="p-2">
                    <div className="text-sm font-medium text-gray-700 px-3 py-2 border-b border-gray-100 sticky top-0 bg-white">
                      Choose an example to add to your canvas:
                    </div>
                    <div className="max-h-[calc(80vh-4rem)] overflow-y-auto">
                      {examples.map(example => (
                        <button
                          key={example.id}
                          onClick={() => handleExampleSelect(example)}
                          className="w-full text-left px-3 py-3 hover:bg-gray-50 rounded-md transition-colors"
                        >
                          <div className="font-medium text-gray-900">{example.name}</div>
                          <div className="text-sm text-gray-500 mt-1">{example.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Play/Stop Button */}
            <button
              onClick={() => store.togglePlayback()}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                store.isPlaying
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {store.isPlaying ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  Stop
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  Play
                </>
              )}
            </button>

            {/* Clear All Button */}
            <button
              onClick={() => store.clearAllNodes()}
              className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Clear All
            </button>

            {/* Project Button */}
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Project
            </button>

            {/* Undo/Redo Buttons */}
            <div className="flex space-x-1">
              <button
                onClick={() => store.undo()}
                disabled={!store.canUndo}
                className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Undo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </button>
              <button
                onClick={() => store.redo()}
                disabled={!store.canRedo}
                className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Redo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
                  />
                </svg>
              </button>
            </div>

            {/* GitHub Repository Link */}
            <a
              href="https://github.com/miltonlaufer/visualwebaudio"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              title="View on GitHub"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Click outside to close dropdown */}
      {isExamplesOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsExamplesOpen(false)} />
      )}

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        store={store}
      />
    </>
  )
})

export default Header
