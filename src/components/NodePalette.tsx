import React from 'react'
import { observer } from 'mobx-react-lite'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import MicrophoneInput from './MicrophoneInput'

interface NodePaletteProps {
  store: AudioGraphStoreType
}

const NodePalette: React.FC<NodePaletteProps> = observer(({ store }) => {
  const nodeCategories = {
    source: ['OscillatorNode', 'AudioBufferSourceNode', 'MediaElementAudioSourceNode'],
    effect: [
      'GainNode',
      'BiquadFilterNode',
      'DelayNode',
      'DynamicsCompressorNode',
      'WaveShaperNode',
      'StereoPannerNode',
    ],
    processing: ['ChannelSplitterNode', 'ChannelMergerNode', 'ConvolverNode'],
    analysis: ['AnalyserNode'],
    destination: ['AudioDestinationNode'],
    context: ['AudioContext'],
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'source':
        return 'bg-green-50 border-green-200'
      case 'effect':
        return 'bg-blue-50 border-blue-200'
      case 'destination':
        return 'bg-red-50 border-red-200'
      case 'analysis':
        return 'bg-purple-50 border-purple-200'
      case 'processing':
        return 'bg-yellow-50 border-yellow-200'
      case 'context':
        return 'bg-gray-50 border-gray-200'
      default:
        return 'bg-white border-gray-200'
    }
  }

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleAddNode = (nodeType: string) => {
    console.log('Adding node:', nodeType)
    console.log('Available metadata:', Object.keys(store.webAudioMetadata))

    try {
      // Add node at a random position for now
      const position = {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      }
      const nodeId = store.addNode(nodeType, position)
      console.log('Node added successfully:', nodeId)
    } catch (error) {
      console.error('Error adding node:', error)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Audio Nodes</h2>

      {/* Microphone Input */}
      <MicrophoneInput store={store} />

      <div className="mb-4 text-xs text-gray-500">
        Metadata loaded: {Object.keys(store.webAudioMetadata).length} nodes
      </div>

      {Object.entries(nodeCategories).map(([category, nodes]) => (
        <div key={category} className="mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2 capitalize">{category}</h3>

          <div className="space-y-2">
            {nodes.map(nodeType => (
              <div
                key={nodeType}
                draggable
                onDragStart={e => handleDragStart(e, nodeType)}
                onClick={() => handleAddNode(nodeType)}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all duration-200
                  hover:shadow-md hover:scale-105 active:scale-95
                  ${getCategoryColor(category)}
                `}
              >
                <div className="text-sm font-medium text-gray-800">
                  {nodeType.replace('Node', '')}
                </div>
                <div className="text-xs text-gray-500 mt-1">{nodeType}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Instructions</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Click to add a node</li>
          <li>• Drag to canvas to place</li>
          <li>• Connect outputs to inputs</li>
          <li>• Select nodes to edit properties</li>
        </ul>
      </div>
    </div>
  )
})

export default NodePalette
