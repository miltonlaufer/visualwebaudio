import React, { useState, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { observer } from 'mobx-react-lite'
import type { INodeAdapter } from '~/stores/NodeAdapter'
import CustomNodeRenderer from './customNodes'
import { customNodeStore } from '~/stores/CustomNodeStore'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

interface AdaptedAudioNodeProps {
  data: {
    nodeAdapter: INodeAdapter
  }
  selected?: boolean
}

const AdaptedAudioNode: React.FC<AdaptedAudioNodeProps> = observer(({ data, selected }) => {
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const store = useAudioGraphStore()

  const { nodeAdapter } = data
  const { metadata, nodeType, properties, id: nodeId } = nodeAdapter

  // Check if this is a custom node type
  const customNodeTypes = [
    'ButtonNode',
    'SliderNode',
    'GreaterThanNode',
    'EqualsNode',
    'SelectNode',
    'MidiInputNode',
    'MidiToFreqNode',
    'DisplayNode',
    'SoundFileNode',
    'RandomNode',
    'TimerNode',
    'ScaleToMidiNode',
  ]
  const isCustomNode = customNodeTypes.includes(nodeType)

  // Get the MobX custom node state directly from customNodeStore
  const mobxCustomNode = isCustomNode && nodeId ? customNodeStore.getNode(nodeId) : null

  // Memoized handlers for better performance
  const handleMouseEnterHandle = useCallback((handleId: string) => {
    return () => setHoveredHandle(handleId)
  }, [])

  const handleMouseLeaveHandle = useCallback(() => {
    setHoveredHandle(null)
  }, [])

  const handleMouseEnterNode = useCallback(() => {
    setIsConnecting(true)
  }, [])

  const handleMouseLeaveNode = useCallback(() => {
    setIsConnecting(false)
  }, [])

  // Helper function to safely get property value from NodeAdapter properties
  const getPropertyValue = (properties: any, propertyName: string): unknown => {
    if (!properties) return undefined

    // NodeAdapter uses MST map, so use .get method
    if (typeof properties.get === 'function') {
      return properties.get(propertyName)
    } else if (typeof properties === 'object') {
      return properties[propertyName]
    }
    return undefined
  }

  // Error handling
  if (!metadata) {
    console.error('AdaptedAudioNode: metadata is undefined for nodeType:', nodeType)
    return (
      <div className="min-w-32 p-3 rounded-lg shadow-md border-2 bg-red-100 border-red-300">
        <div className="text-sm font-semibold text-red-800">Error: No metadata</div>
        <div className="text-xs text-red-600">{nodeType}</div>
      </div>
    )
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'source':
        return 'bg-green-100 border-green-300'
      case 'effect':
        return 'bg-blue-100 border-blue-300'
      case 'destination':
        return 'bg-red-100 border-red-300'
      case 'analysis':
        return 'bg-purple-100 border-purple-300'
      case 'processing':
        return 'bg-yellow-100 border-yellow-300'
      case 'context':
        return 'bg-gray-100 border-gray-300'
      // Custom node categories
      case 'control':
        return 'bg-pink-100 border-pink-300'
      case 'logic':
        return 'bg-indigo-100 border-indigo-300'
      case 'input':
        return 'bg-teal-100 border-teal-300'
      case 'misc':
        return 'bg-orange-100 border-orange-300'
      default:
        return 'bg-white border-gray-300'
    }
  }

  const getHandleColors = (type: string) => {
    if (type === 'audio') {
      return {
        bgClass: 'bg-emerald-600',
        borderClass: 'border-emerald-700',
        labelClass: 'text-emerald-800',
      }
    } else {
      return {
        bgClass: 'bg-red-600',
        borderClass: 'border-red-700',
        labelClass: 'text-red-800',
      }
    }
  }

  // Calculate node height based on content
  const maxHandles = Math.max(metadata.inputs.length, metadata.outputs.length)
  const baseHeight = isCustomNode ? 120 : 80 // More height for custom nodes with UI
  const handleHeight = maxHandles * 30 // 30px per handle
  const nodeHeight = Math.max(baseHeight, handleHeight + 40) // Ensure minimum height

  // Determine the type label for the corner
  const getTypeLabel = () => {
    return isCustomNode ? 'Utility' : 'WebAudio'
  }

  const getTypeLabelColors = () => {
    if (isCustomNode) {
      return 'bg-orange-500 text-white'
    } else {
      return 'bg-blue-500 text-white'
    }
  }

  const getTypeLabelPositioning = () => {
    if (isCustomNode) {
      // Utility: width: 67px, top: 7px, right: -17px, text-align: center
      return 'w-[67px] top-[7px] -right-[17px] text-center'
    } else {
      // WebAudio: width: 75px, top: 12px, right: -16px
      return 'w-[75px] top-[10px] -right-4'
    }
  }

  return (
    <div
      className={`
        relative min-w-48 p-3 rounded-lg shadow-md border-2 flex flex-col items-center justify-center
        ${getCategoryColor(metadata.category)}
        ${selected ? 'ring-2 ring-blue-500' : ''}
      `}
      style={{ minHeight: `${nodeHeight}px` }}
      onMouseEnter={handleMouseEnterNode}
      onMouseLeave={handleMouseLeaveNode}
    >
      {/* Corner Type Label */}
      <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden pointer-events-none">
        <div
          className={`
            ${getTypeLabelColors()}
            ${getTypeLabelPositioning()}
            text-[10px] font-medium px-3 py-0.5 shadow-sm
            transform rotate-45 origin-center
            absolute
          `}
        >
          {getTypeLabel()}
        </div>
      </div>

      {/* Input Handles and Labels */}
      {metadata.inputs.map((input: any, index: number) => {
        const topPosition = 35 + index * 30
        const handleId = `input-${input.name}`
        const showLabel = hoveredHandle === handleId || isConnecting
        const colors = getHandleColors(input.type)

        return (
          <div key={handleId} className="absolute left-0" style={{ top: `${topPosition}px` }}>
            <Handle
              type="target"
              position={Position.Left}
              id={input.name}
              data-handletype={input.type}
              className={`w-[14px] h-[14px] z-10 -left-[7px] border-2 ${colors.bgClass} ${colors.borderClass}`}
              title={`${input.name} (${input.type})`}
              onMouseEnter={handleMouseEnterHandle(handleId)}
              onMouseLeave={handleMouseLeaveHandle}
            />
            {/* Input Label - Only show on hover or when connecting */}
            {showLabel && (
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2 flex items-center pointer-events-none z-20">
                <span
                  className={`text-xs font-medium ${colors.labelClass} bg-white px-1 rounded shadow-sm`}
                >
                  {input.name}
                </span>
              </div>
            )}
          </div>
        )
      })}

      {/* Output Handles and Labels */}
      {metadata.outputs.map((output: any, index: number) => {
        const topPosition = 35 + index * 30
        const handleId = `output-${output.name}`
        const showLabel = hoveredHandle === handleId || isConnecting
        const colors = getHandleColors(output.type)

        return (
          <div key={handleId} className="absolute right-0" style={{ top: `${topPosition}px` }}>
            <Handle
              type="source"
              position={Position.Right}
              id={output.name}
              data-handletype={output.type}
              className={`w-[14px] h-[14px] z-10 -right-[7px] border-2 ${colors.bgClass} ${colors.borderClass}`}
              title={`${output.name} (${output.type})`}
              onMouseEnter={handleMouseEnterHandle(handleId)}
              onMouseLeave={handleMouseLeaveHandle}
            />
            {/* Output Label - Only show on hover or when connecting */}
            {showLabel && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center justify-end pointer-events-none z-20">
                <span
                  className={`text-xs font-medium ${colors.labelClass} bg-white px-1 rounded shadow-sm`}
                >
                  {output.name}
                </span>
              </div>
            )}
          </div>
        )
      })}

      {/* Node Header */}
      <div className="text-sm font-semibold text-gray-800 mb-2 text-center">
        {nodeType.replace('Node', '')}
      </div>

      {/* Custom Node UI Container */}
      {isCustomNode && mobxCustomNode && nodeId && (
        <div className="w-full flex justify-center items-center my-2">
          <CustomNodeRenderer nodeId={nodeId} nodeType={nodeType} />
        </div>
      )}

      {/* Special UI for OscillatorNode */}
      {!isCustomNode && nodeType === 'OscillatorNode' && (
        <div className="space-y-2 mt-4 w-full">
          {/* Autostart checkbox */}
          <div className="flex items-center justify-center space-x-2">
            <input
              type="checkbox"
              id={`autostart-${nodeId}`}
              checked={getPropertyValue(properties, 'autostart') !== false}
              onChange={e => {
                store.updateNodeProperty(nodeId, 'autostart', e.target.checked)
              }}
              className="w-3 h-3"
              onClick={e => e.stopPropagation()}
            />
            <label htmlFor={`autostart-${nodeId}`} className="text-xs text-gray-600">
              Autostart
            </label>
          </div>

          {/* Manual trigger/stop button */}
          <div className="flex justify-center">
            <button
              onClick={e => {
                e.stopPropagation()
                const isOscRunning = store.getNodeState(nodeId)?.isRunning || false

                if (isOscRunning) {
                  // Stop the oscillator
                  const audioNode = store.audioNodes.get(nodeId)
                  if (audioNode && store.audioNodeFactory) {
                    store.audioNodeFactory.stopSourceNode(audioNode, nodeType)
                    store.setNodeState(nodeId, { isRunning: false })
                  }
                } else {
                  // Start/restart the oscillator (recreate if needed)
                  store.recreateAndStartOscillator(nodeId)
                }
              }}
              className={`px-2 py-1 text-xs text-white rounded transition-colors ${
                store.getNodeState(nodeId)?.isRunning
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {store.getNodeState(nodeId)?.isRunning ? '⏹ Stop' : '▶ Start'}
            </button>
          </div>

          {/* Show key properties */}
          <div className="space-y-1">
            {['type', 'frequency'].map(propName => {
              const prop = metadata.properties.find((p: any) => p.name === propName)
              if (!prop) return null
              return (
                <div key={prop.name} className="text-xs text-gray-600 text-center">
                  <span className="font-medium">{prop.name}:</span>{' '}
                  <span className="text-gray-500">
                    {getPropertyValue(properties, prop.name)?.toString() ||
                      prop.defaultValue?.toString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Node Properties - Show properties for other nodes with fewer handles or important properties (only for non-custom nodes) */}
      {!isCustomNode &&
        nodeType !== 'OscillatorNode' &&
        metadata.properties.length > 0 &&
        (maxHandles <= 3 ||
          metadata.properties.some((p: any) => p.name === 'type' || p.name === 'frequency')) && (
          <div className="space-y-1 mt-4">
            {metadata.properties.slice(0, maxHandles > 3 ? 1 : 2).map((prop: any) => (
              <div key={prop.name} className="text-xs text-gray-600 text-center">
                <span className="font-medium">{prop.name}:</span>{' '}
                <span className="text-gray-500">
                  {getPropertyValue(properties, prop.name)?.toString() ||
                    prop.defaultValue?.toString()}
                </span>
              </div>
            ))}
            {metadata.properties.length > (maxHandles > 3 ? 1 : 2) && (
              <div className="text-xs text-gray-400 text-center">
                +{metadata.properties.length - (maxHandles > 3 ? 1 : 2)} more...
              </div>
            )}
          </div>
        )}

      {/* Category Badge */}
      <div className="w-full flex justify-center mt-2">
        <span className="inline-block px-2 py-1 text-xs font-medium text-gray-600 bg-white rounded-full">
          {metadata.category}
        </span>
      </div>
    </div>
  )
})

export default AdaptedAudioNode
