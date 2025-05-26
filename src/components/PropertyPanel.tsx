import React, { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import FrequencyAnalyzer from './FrequencyAnalyzer'

const PropertyPanel: React.FC = observer(() => {
  const store = useAudioGraphStore()
  const selectedNode = store.selectedNodeId
    ? store.visualNodes.find(n => n.id === store.selectedNodeId)
    : null
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  // Helper function to safely get property value whether properties is a Map or object
  const getPropertyValue = (properties: unknown, propertyName: string): unknown => {
    if (!properties) return undefined

    // Check if it's a MobX State Tree Map or regular Map with .get method
    if (typeof (properties as any).get === 'function') {
      return (properties as any).get(propertyName)
    } else if (typeof properties === 'object') {
      return (properties as Record<string, unknown>)[propertyName]
    }
    return undefined
  }

  const handlePropertyChange = (propertyName: string, value: string | number) => {
    if (!selectedNode) return

    console.log(`Updating property ${propertyName} to ${value} for node ${selectedNode.id}`)
    store.updateNodeProperty(selectedNode.id, propertyName, value)
  }

  const renderDescription = (description: string) => {
    const lines = description.split('\n').filter(line => line.trim())
    const firstLine = lines[0] || ''
    const hasMoreContent = lines.length > 1 || firstLine.length > 100

    if (!hasMoreContent) {
      return <div className="text-xs text-blue-700 leading-relaxed">{description}</div>
    }

    const displayText = isDescriptionExpanded
      ? description
      : firstLine.length > 100
        ? `${firstLine.substring(0, 100)}...`
        : `${firstLine}...`

    return (
      <div>
        <div className="text-xs text-blue-700 leading-relaxed">{displayText}</div>
        <button
          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
          className="mt-2 flex items-center text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          <svg
            className={`w-3 h-3 mr-1 transition-transform ${isDescriptionExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {isDescriptionExpanded ? 'Show less' : 'Show more'}
        </button>
      </div>
    )
  }

  const renderPropertyInput = (property: {
    name: string
    type: string
    defaultValue: unknown
    min?: number
    max?: number
  }) => {
    const currentValue = selectedNode?.data.properties
      ? (getPropertyValue(selectedNode.data.properties, property.name) ?? property.defaultValue)
      : property.defaultValue

    switch (property.type) {
      case 'AudioParam': {
        // Ensure the value is always a number, never undefined
        const numericValue =
          typeof currentValue === 'number' ? currentValue : (property.defaultValue as number) || 0
        return (
          <input
            type="number"
            value={numericValue}
            onChange={e => handlePropertyChange(property.name, parseFloat(e.target.value))}
            step="0.01"
            min={property.min}
            max={property.max}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )
      }

      case 'OscillatorType': {
        // Ensure the value is always a string, never undefined
        const oscValue =
          typeof currentValue === 'string'
            ? currentValue
            : (property.defaultValue as string) || 'sine'
        return (
          <select
            value={oscValue}
            onChange={e => handlePropertyChange(property.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="triangle">Triangle</option>
          </select>
        )
      }

      case 'BiquadFilterType': {
        // Ensure the value is always a string, never undefined
        const filterValue =
          typeof currentValue === 'string'
            ? currentValue
            : (property.defaultValue as string) || 'lowpass'
        return (
          <select
            value={filterValue}
            onChange={e => handlePropertyChange(property.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="lowpass">Low Pass</option>
            <option value="highpass">High Pass</option>
            <option value="bandpass">Band Pass</option>
            <option value="lowshelf">Low Shelf</option>
            <option value="highshelf">High Shelf</option>
            <option value="peaking">Peaking</option>
            <option value="notch">Notch</option>
            <option value="allpass">All Pass</option>
          </select>
        )
      }

      default: {
        // Ensure the value is always a string, never undefined
        const stringValue =
          currentValue !== undefined && currentValue !== null
            ? currentValue.toString()
            : property.defaultValue?.toString() || ''
        return (
          <input
            type="text"
            value={stringValue}
            onChange={e => handlePropertyChange(property.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Properties</h2>

        {!selectedNode ? (
          <p className="text-gray-500 text-sm">Select a node to edit its properties</p>
        ) : (
          <>
            {/* Node Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Node Info</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Type:</span> {selectedNode.data.nodeType}
                </div>
                <div>
                  <span className="font-medium">Category:</span>{' '}
                  {selectedNode.data.metadata.category}
                </div>
                <div>
                  <span className="font-medium">ID:</span> {selectedNode.id}
                </div>
                {selectedNode.data.metadata.description && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-md border-l-4 border-blue-200">
                    <div className="text-xs font-medium text-blue-800 mb-1">Description</div>
                    {renderDescription(selectedNode.data.metadata.description)}
                  </div>
                )}
              </div>
            </div>

            {/* Inputs */}
            {selectedNode.data.metadata.inputs.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Inputs</h3>
                <div className="space-y-2">
                  {selectedNode.data.metadata.inputs.map(input => (
                    <div
                      key={input.name}
                      className="flex items-center justify-between p-2 bg-blue-50 rounded-md"
                    >
                      <span className="text-sm font-medium text-gray-700">{input.name}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          input.type === 'audio'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {input.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outputs */}
            {selectedNode.data.metadata.outputs.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Outputs</h3>
                <div className="space-y-2">
                  {selectedNode.data.metadata.outputs.map(output => (
                    <div
                      key={output.name}
                      className="flex items-center justify-between p-2 bg-green-50 rounded-md"
                    >
                      <span className="text-sm font-medium text-gray-700">{output.name}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          output.type === 'audio'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {output.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Properties */}
            {selectedNode.data.metadata.properties.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Parameters</h3>
                <div className="space-y-4">
                  {selectedNode.data.metadata.properties.map(prop => (
                    <div key={prop.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {prop.name}
                        {prop.type === 'AudioParam' && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({prop.min !== undefined ? `${prop.min} - ${prop.max}` : 'AudioParam'})
                          </span>
                        )}
                      </label>
                      {renderPropertyInput(prop)}
                      <div className="text-xs text-gray-500 mt-1">
                        Default: {prop.defaultValue?.toString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Methods */}
            {selectedNode.data.metadata.methods.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Methods</h3>
                <div className="space-y-2">
                  {selectedNode.data.metadata.methods.map(method => (
                    <button
                      key={method}
                      onClick={() => {
                        // Handle method calls - this would need to be implemented
                        console.log(`Calling ${method} on ${selectedNode.id}`)
                      }}
                      className="w-full px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      {method}()
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Events */}
            {selectedNode.data.metadata.events.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Events</h3>
                <div className="space-y-1">
                  {selectedNode.data.metadata.events.map(event => (
                    <div
                      key={event}
                      className="text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-md"
                    >
                      {event}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 pt-4 border-t border-gray-200">
              <button
                onClick={() => store.removeNode(selectedNode.id)}
                className="w-full px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
              >
                Delete Node
              </button>
            </div>
          </>
        )}
      </div>

      {/* Fixed Frequency Analyzer at bottom */}
      <div className="border-t border-gray-200">
        <FrequencyAnalyzer store={store} />
      </div>
    </div>
  )
})

export default PropertyPanel
