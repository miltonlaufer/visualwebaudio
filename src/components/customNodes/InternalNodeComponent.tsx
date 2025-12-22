/**
 * Internal Node Component
 *
 * A simplified node component for use inside the Composite Editor.
 * Unlike AdaptedAudioNode, this doesn't require a full NodeAdapter instance.
 * It displays basic information about the node and provides handles for connections.
 */

import React, { useMemo, useCallback, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { NodeRegistry } from '~/domain/nodes/NodeRegistry'

/******************* TYPES ***********************/

interface InternalNodeData {
  nodeType: string
  properties?: Map<string, unknown>
}

interface InternalNodeComponentProps {
  data: InternalNodeData
  selected?: boolean
}

/******************* COMPONENT ***********************/

const InternalNodeComponent: React.FC<InternalNodeComponentProps> = ({ data, selected }) => {
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const { nodeType, properties } = data

  /******************* COMPUTED ***********************/

  // Try to get metadata from registry for proper inputs/outputs
  const metadata = useMemo(() => {
    try {
      return NodeRegistry.getMetadata(nodeType)
    } catch {
      // Return default metadata for unknown nodes
      return null
    }
  }, [nodeType])

  // Default metadata if not found in registry
  const effectiveMetadata = metadata ?? {
    name: nodeType,
    category: 'misc' as const,
    description: '',
    inputs: [{ name: 'input', type: 'audio' }],
    outputs: [{ name: 'output', type: 'audio' }],
    properties: [],
    methods: [],
    events: [],
  }

  const displayName = useMemo(() => {
    return nodeType.replace('Node', '')
  }, [nodeType])

  const categoryColor = useMemo(() => {
    switch (effectiveMetadata.category) {
      case 'source':
        return 'bg-green-50 border-green-300'
      case 'effect':
        return 'bg-blue-50 border-blue-300'
      case 'destination':
        return 'bg-red-50 border-red-300'
      case 'analysis':
        return 'bg-purple-50 border-purple-300'
      case 'processing':
        return 'bg-yellow-50 border-yellow-300'
      case 'context':
        return 'bg-gray-50 border-gray-300'
      case 'control':
        return 'bg-pink-50 border-pink-300'
      default:
        return 'bg-slate-50 border-slate-300'
    }
  }, [effectiveMetadata.category])

  // Calculate node height based on number of handles
  const maxHandles = Math.max(effectiveMetadata.inputs.length, effectiveMetadata.outputs.length)
  const nodeHeight = Math.max(80, 40 + maxHandles * 28)

  /******************* HANDLERS ***********************/

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

  /******************* RENDER HELPERS ***********************/

  const getHandleColor = useCallback((type: string) => {
    if (type === 'audio') {
      return {
        bgClass: 'bg-emerald-500',
        borderClass: 'border-emerald-600',
      }
    } else {
      return {
        bgClass: 'bg-amber-500',
        borderClass: 'border-amber-600',
      }
    }
  }, [])

  /******************* RENDER ***********************/

  return (
    <div
      className={`
        relative rounded-lg border-2 shadow-sm min-w-[140px] p-2
        ${categoryColor}
        ${selected ? 'ring-2 ring-blue-500' : ''}
      `}
      style={{ minHeight: nodeHeight }}
      onMouseEnter={handleMouseEnterNode}
      onMouseLeave={handleMouseLeaveNode}
    >
      {/* Node title */}
      <div className="text-xs font-semibold text-gray-700 text-center mb-1 truncate">
        {displayName}
      </div>

      {/* Category badge */}
      <div className="text-center mb-2">
        <span className="inline-block px-1.5 py-0.5 text-[9px] font-medium text-gray-500 bg-white rounded-full">
          {effectiveMetadata.category}
        </span>
      </div>

      {/* Display some properties if available */}
      {properties && properties.size > 0 && (
        <div className="text-[9px] text-gray-500 space-y-0.5">
          {Array.from(properties.entries())
            .slice(0, 2)
            .map(([key, value]) => (
              <div key={key} className="truncate">
                <span className="font-medium">{key}:</span>{' '}
                <span>{String(value).substring(0, 15)}</span>
              </div>
            ))}
        </div>
      )}

      {/* Input handles */}
      {effectiveMetadata.inputs.map((input, index) => {
        const topPosition = 35 + index * 26
        const handleId = `input-${input.name}`
        const showLabel = hoveredHandle === handleId || isConnecting
        const colors = getHandleColor(input.type)

        return (
          <div key={handleId} className="absolute left-0" style={{ top: `${topPosition}px` }}>
            <Handle
              type="target"
              position={Position.Left}
              id={input.name}
              data-handletype={input.type}
              className={`w-[10px] h-[10px] -left-[5px] border ${colors.bgClass} ${colors.borderClass}`}
              title={`${input.name} (${input.type})`}
              onMouseEnter={handleMouseEnterHandle(handleId)}
              onMouseLeave={handleMouseLeaveHandle}
            />
            {showLabel && (
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-600 bg-white px-0.5 rounded whitespace-nowrap">
                {input.name}
              </span>
            )}
          </div>
        )
      })}

      {/* Output handles */}
      {effectiveMetadata.outputs.map((output, index) => {
        const topPosition = 35 + index * 26
        const handleId = `output-${output.name}`
        const showLabel = hoveredHandle === handleId || isConnecting
        const colors = getHandleColor(output.type)

        return (
          <div key={handleId} className="absolute right-0" style={{ top: `${topPosition}px` }}>
            <Handle
              type="source"
              position={Position.Right}
              id={output.name}
              data-handletype={output.type}
              className={`w-[10px] h-[10px] -right-[5px] border ${colors.bgClass} ${colors.borderClass}`}
              title={`${output.name} (${output.type})`}
              onMouseEnter={handleMouseEnterHandle(handleId)}
              onMouseLeave={handleMouseLeaveHandle}
            />
            {showLabel && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-600 bg-white px-0.5 rounded whitespace-nowrap">
                {output.name}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default InternalNodeComponent
