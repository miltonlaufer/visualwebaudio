import React from 'react'
import { Handle, Position } from '@xyflow/react'
import type { VisualNodeData } from '~/types'

interface AudioNodeProps {
  data: VisualNodeData
  selected?: boolean
}

const AudioNode: React.FC<AudioNodeProps> = ({ data, selected }) => {
  console.log('AudioNode rendering:', data.nodeType)

  const { metadata, nodeType, properties } = data

  // Error handling
  if (!metadata) {
    console.error('AudioNode: metadata is undefined for nodeType:', nodeType)
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
      default:
        return 'bg-white border-gray-300'
    }
  }

  return (
    <div
      className={`
        relative min-w-32 p-3 rounded-lg shadow-md border-2 
        ${getCategoryColor(metadata.category)}
        ${selected ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      {/* Input Handles */}
      {metadata.inputs.map((input, index) => (
        <Handle
          key={`input-${input.name}`}
          type="target"
          position={Position.Left}
          id={input.name}
          style={{
            top: `${30 + index * 25}px`,
            backgroundColor: input.type === 'audio' ? '#10b981' : '#f59e0b',
            border: `2px solid ${input.type === 'audio' ? '#059669' : '#d97706'}`,
            width: '12px',
            height: '12px',
          }}
          title={`${input.name} (${input.type})`}
        />
      ))}

      {/* Output Handles */}
      {metadata.outputs.map((output, index) => (
        <Handle
          key={`output-${output.name}`}
          type="source"
          position={Position.Right}
          id={output.name}
          style={{
            top: `${30 + index * 25}px`,
            backgroundColor: output.type === 'audio' ? '#10b981' : '#f59e0b',
            border: `2px solid ${output.type === 'audio' ? '#059669' : '#d97706'}`,
            width: '12px',
            height: '12px',
          }}
          title={`${output.name} (${output.type})`}
        />
      ))}

      {/* Node Header */}
      <div className="text-sm font-semibold text-gray-800 mb-2">{nodeType.replace('Node', '')}</div>

      {/* Node Properties */}
      {metadata.properties.length > 0 && (
        <div className="space-y-1">
          {metadata.properties.slice(0, 3).map(prop => (
            <div key={prop.name} className="text-xs text-gray-600">
              <span className="font-medium">{prop.name}:</span>{' '}
              <span className="text-gray-500">
                {properties[prop.name]?.toString() || prop.defaultValue?.toString()}
              </span>
            </div>
          ))}
          {metadata.properties.length > 3 && (
            <div className="text-xs text-gray-400">+{metadata.properties.length - 3} more...</div>
          )}
        </div>
      )}

      {/* Category Badge */}
      <div className="mt-2">
        <span className="inline-block px-2 py-1 text-xs font-medium text-gray-600 bg-white rounded-full">
          {metadata.category}
        </span>
      </div>
    </div>
  )
}

export default AudioNode
