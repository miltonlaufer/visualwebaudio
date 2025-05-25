import React, { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import { testFrequencyAnalyzer } from '~/test-frequency-analyzer'

interface HeaderProps {
  store: AudioGraphStoreType
  onProjectModalOpen: () => void
  onForceUpdate: () => void
}

const Header: React.FC<HeaderProps> = observer(({ store, onProjectModalOpen, onForceUpdate }) => {
  const handlePlayToggle = useCallback(() => {
    store.togglePlayback()
  }, [store])

  const handleQuickTest = useCallback(() => {
    // Clear existing nodes first using the safe method
    store.clearAllNodes()

    // Create a simple test chain: Oscillator -> Gain -> Destination
    const oscId = store.addNode('OscillatorNode', { x: 100, y: 200 })
    const gainId = store.addNode('GainNode', { x: 300, y: 200 })
    const destId = store.addNode('AudioDestinationNode', { x: 500, y: 200 })

    // Connect them
    setTimeout(() => {
      store.addEdge(oscId, gainId)
      store.addEdge(gainId, destId)
      onForceUpdate()
    }, 100)
  }, [store, onForceUpdate])

  const handleClearAll = useCallback(() => {
    console.log('=== CLEAR ALL BUTTON PRESSED ===')
    store.clearAllNodes()
    onForceUpdate()
  }, [store, onForceUpdate])

  const handleUndo = useCallback(() => {
    store.undo()
    onForceUpdate()
  }, [store, onForceUpdate])

  const handleRedo = useCallback(() => {
    store.redo()
    onForceUpdate()
  }, [store, onForceUpdate])

  const handleTestAnalyzer = useCallback(() => {
    testFrequencyAnalyzer()
  }, [])

  return (
    <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between w-full">
      <div className="flex items-center space-x-3">
        <img src="/logo.png" alt="Visual Web Audio Logo" className="w-8 h-8" />
        <h1 className="text-xl font-bold text-gray-800">Visual Web Audio</h1>
      </div>
      <div className="flex items-center space-x-4">
        {/* Undo/Redo buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleUndo}
            disabled={!store.canUndo}
            className={`p-2 rounded-md transition-colors ${
              store.canUndo ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
            }`}
            title="Undo (Cmd/Ctrl+Z)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </button>
          <button
            onClick={handleRedo}
            disabled={!store.canRedo}
            className={`p-2 rounded-md transition-colors ${
              store.canRedo ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
            }`}
            title="Redo (Cmd/Ctrl+Y or Cmd/Ctrl+Shift+Z)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
              />
            </svg>
          </button>
        </div>

        <div className="h-6 border-l border-gray-300"></div>

        <button
          onClick={handlePlayToggle}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            store.isPlaying
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {store.isPlaying ? 'Stop' : 'Play'}
        </button>
        <button
          onClick={handleQuickTest}
          className="px-4 py-2 rounded-md font-medium text-gray-600 hover:bg-gray-200"
        >
          Quick Test
        </button>
        <button
          onClick={handleClearAll}
          className="px-4 py-2 rounded-md font-medium text-gray-600 hover:bg-gray-200"
        >
          Clear All
        </button>
        <button
          onClick={handleTestAnalyzer}
          className="px-4 py-2 rounded-md font-medium text-blue-600 hover:bg-blue-100"
        >
          Test Analyzer
        </button>
        <button
          onClick={onProjectModalOpen}
          className="px-4 py-2 rounded-md font-medium text-gray-600 hover:bg-gray-200"
        >
          Project
        </button>
        <div className="text-sm text-gray-600">
          Nodes: {store.visualNodes.length} | Connections: {store.visualEdges.length}
        </div>
      </div>
    </div>
  )
})

export default Header
