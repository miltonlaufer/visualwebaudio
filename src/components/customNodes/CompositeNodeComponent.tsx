/**
 * Composite Node Component
 *
 * Visual representation of a composite node in the main graph.
 * Features:
 * - Dynamic handles based on definition
 * - Editable input fields for control-type parameters (like normal nodes)
 * - Edit button to open the composite editor
 */

import React, { useCallback, useMemo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { observer } from 'mobx-react-lite'
import { compositeNodeDefinitionStore } from '~/stores/CompositeNodeDefinitionStore'
import { compositeEditorStore } from '~/stores/CompositeEditorStore'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import type { CompositeNodePort } from '~/types'

/******************* TYPES ***********************/

interface CompositeNodeComponentProps {
  id: string
  data: {
    nodeAdapter?: {
      id: string
      nodeType: string
      properties: Map<string, unknown>
    }
    definitionId?: string
  }
  selected?: boolean
}

/******************* COMPONENT ***********************/

const CompositeNodeComponent: React.FC<CompositeNodeComponentProps> = observer(
  ({ id, data, selected }) => {
    const store = useAudioGraphStore()
    const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)

    /******************* COMPUTED ***********************/

    // Get definition ID from node type or data
    const definitionId = useMemo(() => {
      if (data.definitionId) return data.definitionId
      const nodeType = data.nodeAdapter?.nodeType || ''
      if (nodeType.startsWith('Composite_')) {
        return nodeType.replace('Composite_', '')
      }
      return null
    }, [data.definitionId, data.nodeAdapter?.nodeType])

    const definition = definitionId
      ? compositeNodeDefinitionStore.getDefinition(definitionId)
      : null

    const isUserCreated = useMemo(() => {
      return definition?.category === 'user-composite'
    }, [definition?.category])

    const inputs = useMemo(() => {
      return definition?.inputs || []
    }, [definition?.inputs])

    const outputs = useMemo(() => {
      return definition?.outputs || []
    }, [definition?.outputs])

    // Separate audio and control inputs
    const audioInputs = useMemo(() => inputs.filter(i => i.type === 'audio'), [inputs])
    const controlInputs = useMemo(() => inputs.filter(i => i.type === 'control'), [inputs])

    // Get current parameter values from node adapter
    const getParameterValue = useCallback(
      (paramName: string, defaultValue: number = 0) => {
        if (data.nodeAdapter?.properties) {
          const value = data.nodeAdapter.properties.get(paramName)
          if (value !== undefined) return value as number
        }
        return defaultValue
      },
      [data.nodeAdapter?.properties]
    )

    // Calculate node dimensions
    const nodeWidth = 200
    const controlsHeight = controlInputs.length > 0 ? controlInputs.length * 36 + 16 : 0
    const maxHandles = Math.max(audioInputs.length, outputs.length)
    const handlesHeight = maxHandles * 32 + 20
    const nodeHeight = Math.max(100, 70 + controlsHeight + handlesHeight)

    /******************* HANDLERS ***********************/

    const handleEditClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        if (definitionId) {
          // Pass the node id so we can update it after "Save As"
          compositeEditorStore.openEditor(definitionId, id)
        }
      },
      [definitionId, id]
    )

    const handleParameterChange = useCallback(
      (paramName: string, value: number) => {
        if (data.nodeAdapter?.id) {
          store.updateNodeProperty(data.nodeAdapter.id, paramName, value)
        }
      },
      [data.nodeAdapter?.id, store]
    )

    const handleMouseEnterHandle = useCallback((handleId: string) => {
      return () => setHoveredHandle(handleId)
    }, [])

    const handleMouseLeaveHandle = useCallback(() => {
      setHoveredHandle(null)
    }, [])

    /******************* RENDER HELPERS ***********************/

    const getHandleColor = useCallback((type: 'audio' | 'control') => {
      return type === 'audio' ? '#10b981' : '#f59e0b'
    }, [])

    /******************* RENDER ***********************/

    if (!definition) {
      return (
        <div className="min-w-[160px] p-3 rounded-lg border-2 border-red-300 bg-red-50 dark:bg-red-900">
          <div className="text-sm font-semibold text-red-800 dark:text-red-200">
            Definition not found
          </div>
          <div className="text-xs text-red-600 dark:text-red-400">{definitionId}</div>
        </div>
      )
    }

    return (
      <div
        className={`
          relative rounded-lg border-2 shadow-md transition-all duration-200 hover:shadow-lg
          ${
            isUserCreated
              ? 'border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-900'
              : 'border-cyan-400 dark:border-cyan-600 bg-cyan-50 dark:bg-cyan-900'
          }
          ${selected ? 'ring-2 ring-blue-500' : ''}
        `}
        style={{ width: nodeWidth, minHeight: nodeHeight }}
        onMouseEnter={() => setIsConnecting(true)}
        onMouseLeave={() => setIsConnecting(false)}
      >
        {/* Header */}
        <div
          className={`px-3 py-2 border-b ${isUserCreated ? 'border-violet-200 dark:border-violet-700' : 'border-cyan-200 dark:border-cyan-700'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-6">
              <div
                className={`text-sm font-semibold truncate ${isUserCreated ? 'text-violet-800 dark:text-violet-200' : 'text-cyan-800 dark:text-cyan-200'}`}
              >
                {definition.name}
              </div>
            </div>

            {/* Category badge */}
            <span
              className={`
                text-[9px] font-bold uppercase px-1.5 py-0.5 rounded
                ${isUserCreated ? 'bg-violet-500 text-white' : 'bg-cyan-500 text-white'}
              `}
            >
              {isUserCreated ? 'User' : 'Preset'}
            </span>
          </div>

          {/* Description (truncated) */}
          {definition.description && (
            <div
              className={`text-[10px] mt-1 truncate ${isUserCreated ? 'text-violet-600 dark:text-violet-400' : 'text-cyan-600 dark:text-cyan-400'}`}
              title={definition.description}
            >
              {definition.description}
            </div>
          )}
        </div>

        {/* Edit button */}
        <button
          onClick={handleEditClick}
          className={`absolute top-2 right-8 p-1 rounded transition-colors ${isUserCreated ? 'hover:bg-violet-200 dark:hover:bg-violet-700' : 'hover:bg-cyan-200 dark:hover:bg-cyan-700'}`}
          title="Edit composite node"
        >
          <svg
            className={`w-3.5 h-3.5 ${isUserCreated ? 'text-violet-600 dark:text-violet-400' : 'text-cyan-600 dark:text-cyan-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>

        {/* Control Parameters - Editable inputs */}
        {controlInputs.length > 0 && (
          <div className="px-3 py-2 space-y-2">
            {controlInputs.map((input: CompositeNodePort) => (
              <div key={input.id} className="flex items-center justify-between gap-2">
                <label
                  className={`text-xs font-medium ${isUserCreated ? 'text-violet-700 dark:text-violet-300' : 'text-cyan-700 dark:text-cyan-300'}`}
                >
                  {input.name}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={getParameterValue(input.name, 0)}
                  onChange={e => handleParameterChange(input.name, parseFloat(e.target.value) || 0)}
                  onClick={e => e.stopPropagation()}
                  className={`
                    w-20 px-2 py-1 text-xs text-right rounded border
                    bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
                    ${isUserCreated ? 'border-violet-300 dark:border-violet-600' : 'border-cyan-300 dark:border-cyan-600'}
                    focus:outline-none focus:ring-1 focus:ring-blue-500
                  `}
                />
                {/* Control input handle */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={input.id}
                  style={{
                    background: getHandleColor('control'),
                    width: 10,
                    height: 10,
                    border: '2px solid white',
                    left: -5,
                  }}
                  onMouseEnter={handleMouseEnterHandle(`input-${input.id}`)}
                  onMouseLeave={handleMouseLeaveHandle}
                />
              </div>
            ))}
          </div>
        )}

        {/* Audio Input/Output Handles Section */}
        <div className="relative" style={{ minHeight: handlesHeight }}>
          {/* Audio Input handles */}
          {audioInputs.map((input: CompositeNodePort, index: number) => {
            const topPosition = 10 + index * 32
            const handleId = `input-${input.id}`
            const showLabel = hoveredHandle === handleId || isConnecting

            return (
              <div
                key={handleId}
                className="absolute left-0 flex items-center"
                style={{ top: topPosition }}
              >
                <Handle
                  type="target"
                  position={Position.Left}
                  id={input.id}
                  style={{
                    background: getHandleColor('audio'),
                    width: 12,
                    height: 12,
                    border: '2px solid white',
                    left: -6,
                  }}
                  onMouseEnter={handleMouseEnterHandle(handleId)}
                  onMouseLeave={handleMouseLeaveHandle}
                />
                {showLabel && (
                  <span
                    className={`ml-2 text-[10px] font-medium bg-white dark:bg-gray-800 px-1 rounded shadow ${isUserCreated ? 'text-violet-700 dark:text-violet-300' : 'text-cyan-700 dark:text-cyan-300'}`}
                  >
                    {input.name}
                  </span>
                )}
              </div>
            )
          })}

          {/* Output handles */}
          {outputs.map((output: CompositeNodePort, index: number) => {
            const topPosition = 10 + index * 32
            const handleId = `output-${output.id}`
            const showLabel = hoveredHandle === handleId || isConnecting

            return (
              <div
                key={handleId}
                className="absolute right-0 flex items-center justify-end"
                style={{ top: topPosition }}
              >
                {showLabel && (
                  <span
                    className={`mr-2 text-[10px] font-medium bg-white dark:bg-gray-800 px-1 rounded shadow ${isUserCreated ? 'text-violet-700 dark:text-violet-300' : 'text-cyan-700 dark:text-cyan-300'}`}
                  >
                    {output.name}
                  </span>
                )}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={output.id}
                  style={{
                    background: getHandleColor(output.type),
                    width: 12,
                    height: 12,
                    border: '2px solid white',
                    right: -6,
                  }}
                  onMouseEnter={handleMouseEnterHandle(handleId)}
                  onMouseLeave={handleMouseLeaveHandle}
                />
              </div>
            )
          })}
        </div>

        {/* Node ID (small) */}
        <div
          className={`absolute bottom-1 left-2 text-[8px] ${isUserCreated ? 'text-violet-400 dark:text-violet-600' : 'text-cyan-400 dark:text-cyan-600'}`}
        >
          {id.substring(0, 8)}
        </div>
      </div>
    )
  }
)

export default CompositeNodeComponent
