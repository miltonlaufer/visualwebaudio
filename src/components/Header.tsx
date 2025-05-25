import React, { useState } from 'react'
import { observer } from 'mobx-react-lite'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import ProjectModal from './ProjectModal'

interface HeaderProps {
  store: AudioGraphStoreType
}

const Header: React.FC<HeaderProps> = observer(({ store }) => {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [isExamplesOpen, setIsExamplesOpen] = useState(false)

  const examples = [
    {
      id: 'basic-oscillator',
      name: 'Basic Oscillator',
      description: 'Simple sine wave connected to output',
      create: () => {
        const oscId = store.addNode('OscillatorNode', { x: 100, y: 100 })
        const destId = store.addNode('AudioDestinationNode', { x: 300, y: 100 })
        setTimeout(() => {
          store.addEdge(oscId, destId, 'output', 'input')
        }, 100)
      },
    },
    {
      id: 'delay-effect',
      name: 'Delay Effect',
      description: 'Oscillator with delay and feedback',
      create: () => {
        const oscId = store.addNode('OscillatorNode', { x: 50, y: 100 })
        const gainId = store.addNode('GainNode', { x: 200, y: 100 })
        const delayId = store.addNode('DelayNode', { x: 350, y: 100 })
        const feedbackId = store.addNode('GainNode', { x: 350, y: 200 })
        const destId = store.addNode('AudioDestinationNode', { x: 500, y: 100 })

        setTimeout(() => {
          // Set delay time and feedback gain
          store.updateNodeProperty(delayId, 'delayTime', 0.3)
          store.updateNodeProperty(feedbackId, 'gain', 0.4)
          store.updateNodeProperty(gainId, 'gain', 0.7)

          // Connect the nodes
          store.addEdge(oscId, gainId, 'output', 'input')
          store.addEdge(gainId, delayId, 'output', 'input')
          store.addEdge(delayId, destId, 'output', 'input')
          store.addEdge(delayId, feedbackId, 'output', 'input')
          store.addEdge(feedbackId, delayId, 'output', 'input')
        }, 100)
      },
    },
    {
      id: 'filter-sweep',
      name: 'Filter Sweep',
      description: 'Oscillator with animated lowpass filter',
      create: () => {
        const oscId = store.addNode('OscillatorNode', { x: 50, y: 100 })
        const filterId = store.addNode('BiquadFilterNode', { x: 200, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 50, y: 250 })
        const lfoGainId = store.addNode('GainNode', { x: 200, y: 250 })
        const destId = store.addNode('AudioDestinationNode', { x: 350, y: 100 })

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
          store.updateNodeProperty(lfoGainId, 'gain', 400)

          // Connect the audio chain
          store.addEdge(oscId, filterId, 'output', 'input')
          store.addEdge(filterId, destId, 'output', 'input')

          // Connect the LFO to modulate filter frequency
          store.addEdge(lfoId, lfoGainId, 'output', 'input')
          store.addEdge(lfoGainId, filterId, 'output', 'frequency')
        }, 100)
      },
    },
    {
      id: 'stereo-panner',
      name: 'Stereo Panning',
      description: 'Oscillator with stereo panning effect',
      create: () => {
        const oscId = store.addNode('OscillatorNode', { x: 50, y: 100 })
        const pannerId = store.addNode('StereoPannerNode', { x: 200, y: 100 })
        const lfoId = store.addNode('OscillatorNode', { x: 50, y: 250 })
        const destId = store.addNode('AudioDestinationNode', { x: 350, y: 100 })

        setTimeout(() => {
          // Set up the main oscillator
          store.updateNodeProperty(oscId, 'frequency', 440)

          // Set up the LFO for panning
          store.updateNodeProperty(lfoId, 'frequency', 0.2)

          // Connect the nodes
          store.addEdge(oscId, pannerId, 'output', 'input')
          store.addEdge(pannerId, destId, 'output', 'input')
          store.addEdge(lfoId, pannerId, 'output', 'pan')
        }, 100)
      },
    },
    {
      id: 'compressor-effect',
      name: 'Compressor Effect',
      description: 'Oscillator with dynamics compression',
      create: () => {
        const oscId = store.addNode('OscillatorNode', { x: 50, y: 100 })
        const gainId = store.addNode('GainNode', { x: 200, y: 100 })
        const compId = store.addNode('DynamicsCompressorNode', { x: 350, y: 100 })
        const destId = store.addNode('AudioDestinationNode', { x: 500, y: 100 })

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
          store.addEdge(oscId, gainId, 'output', 'input')
          store.addEdge(gainId, compId, 'output', 'input')
          store.addEdge(compId, destId, 'output', 'input')
        }, 100)
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
            <img src="/logo.png" alt="Visual Web Audio" className="w-8 h-8" />
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
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-2">
                    <div className="text-sm font-medium text-gray-700 px-3 py-2 border-b border-gray-100">
                      Choose an example to add to your canvas:
                    </div>
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
