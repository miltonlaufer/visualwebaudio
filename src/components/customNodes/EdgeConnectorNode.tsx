/**
 * Edge Connector Node
 *
 * A visual connector that appears at the edge of the canvas, representing
 * the boundary of the composite node "box". Shows the port name and a handle.
 */

import React from 'react'
import { Handle, Position } from '@xyflow/react'

/******************* TYPES ***********************/

interface EdgeConnectorNodeData {
  portId: string
  portName: string
  portType: 'audio' | 'control'
  direction: 'input' | 'output'
}

interface EdgeConnectorNodeProps {
  data: EdgeConnectorNodeData
}

/******************* COMPONENT ***********************/

const EdgeConnectorNode: React.FC<EdgeConnectorNodeProps> = ({ data }) => {
  const { portName, portType, direction } = data

  const isInput = direction === 'input'
  const isAudio = portType === 'audio'
  const handleColor = isAudio ? '#10b981' : '#f59e0b'
  const bgColor = isAudio ? 'bg-emerald-100' : 'bg-amber-100'
  const borderColor = isAudio ? 'border-emerald-400' : 'border-amber-400'
  const textColor = isAudio ? 'text-emerald-800' : 'text-amber-800'

  return (
    <div
      className={`
        relative flex items-center px-2 py-1 rounded-md border-2
        ${bgColor} ${borderColor}
      `}
      style={{
        minWidth: 80,
        height: 28,
        // Add a visual "tab" effect pointing to the edge
        borderLeft: isInput ? '4px solid' + (isAudio ? '#10b981' : '#f59e0b') : undefined,
        borderRight: !isInput ? '4px solid' + (isAudio ? '#10b981' : '#f59e0b') : undefined,
        borderRadius: isInput ? '0 6px 6px 0' : '6px 0 0 6px',
      }}
    >
      {/* Port name */}
      <span className={`text-xs font-semibold ${textColor} whitespace-nowrap`}>{portName}</span>

      {/* Handle */}
      {isInput ? (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{
            background: handleColor,
            width: 14,
            height: 14,
            border: '2px solid white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            right: -7,
          }}
        />
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{
            background: handleColor,
            width: 14,
            height: 14,
            border: '2px solid white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            left: -7,
          }}
        />
      )}
    </div>
  )
}

export default EdgeConnectorNode
