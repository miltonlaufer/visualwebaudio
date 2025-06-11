import React, { useState, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import FrequencyAnalyzer from './FrequencyAnalyzer'

interface PropertyPanelProps {
  onClose?: () => void
}

const PropertyPanel: React.FC<PropertyPanelProps> = observer(({ onClose }) => {
  const store = useAudioGraphStore()
  const selectedNode = store.selectedNodeId
    ? store.adaptedNodes.find(n => n.id === store.selectedNodeId)
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

  const handlePropertyChange = useCallback(
    (propertyName: string, value: string | number) => {
      if (!selectedNode) return

      store.updateNodeProperty(selectedNode.id, propertyName, value)
    },
    [selectedNode, store]
  )

  const handleToggleDescription = () => {
    setIsDescriptionExpanded(!isDescriptionExpanded)
  }

  const handleRemoveNode = () => {
    if (!selectedNode) return
    store.removeNode(selectedNode.id)
  }

  const handleNumberPropertyChange = useCallback(
    (propertyName: string) => {
      return (e: React.ChangeEvent<HTMLInputElement>) => {
        handlePropertyChange(propertyName, parseFloat(e.target.value))
      }
    },
    [handlePropertyChange]
  )

  const handleStringPropertyChange = useCallback(
    (propertyName: string) => {
      return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        handlePropertyChange(propertyName, e.target.value)
      }
    },
    [handlePropertyChange]
  )

  const renderDescription = (description: string) => {
    const lines = description.split('\n').filter(line => line.trim())
    const firstLine = lines[0] || ''
    const hasMoreContent = lines.length > 1 || firstLine.length > 100

    if (!hasMoreContent) {
      return (
        <div className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          {description}
        </div>
      )
    }

    const displayText = isDescriptionExpanded
      ? description
      : firstLine.length > 100
        ? `${firstLine.substring(0, 100)}...`
        : `${firstLine}...`

    return (
      <div>
        <div className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          {displayText}
        </div>
        <button
          onClick={handleToggleDescription}
          className="mt-2 flex items-center text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
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
    step?: number
    options?: unknown[]
  }) => {
    const currentValue = selectedNode?.properties
      ? (getPropertyValue(selectedNode.properties, property.name) ?? property.defaultValue)
      : property.defaultValue

    // If property has options, render as dropdown
    if (property.options && Array.isArray(property.options)) {
      const selectValue =
        currentValue !== undefined && currentValue !== null
          ? currentValue.toString()
          : property.defaultValue?.toString() || ''

      return (
        <select
          value={selectValue}
          onChange={handleStringPropertyChange(property.name)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          {property.options.map(option => (
            <option key={option?.toString()} value={option?.toString()}>
              {option?.toString()}
            </option>
          ))}
        </select>
      )
    }

    switch (property.type) {
      case 'number': {
        // Handle numeric properties with proper step, min, max
        const numericValue =
          typeof currentValue === 'number' ? currentValue : (property.defaultValue as number) || 0
        return (
          <input
            type="number"
            value={numericValue}
            onChange={handleNumberPropertyChange(property.name)}
            step={
              property.step || (property.name === 'delay' || property.name === 'interval' ? 10 : 1)
            }
            min={property.min}
            max={property.max}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        )
      }

      case 'boolean': {
        // Handle boolean properties as checkboxes
        const boolValue =
          typeof currentValue === 'boolean'
            ? currentValue
            : (property.defaultValue as boolean) || false
        return (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={boolValue}
              onChange={e => {
                const newValue = e.target.checked
                store.updateNodeProperty(selectedNode!.id, property.name, newValue)
              }}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {boolValue ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        )
      }

      case 'AudioParam': {
        // Ensure the value is always a number, never undefined
        const numericValue =
          typeof currentValue === 'number' ? currentValue : (property.defaultValue as number) || 0
        return (
          <input
            type="number"
            value={numericValue}
            onChange={handleNumberPropertyChange(property.name)}
            step="0.01"
            min={property.min}
            max={property.max}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
            onChange={handleStringPropertyChange(property.name)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
            onChange={handleStringPropertyChange(property.name)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
            onChange={handleStringPropertyChange(property.name)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        )
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Properties</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded lg:hidden"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {!selectedNode ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Select a node to edit its properties
          </p>
        ) : (
          <>
            {/* Node Info */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Node Info
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Type:</span>{' '}
                  <span className="text-gray-700 dark:text-gray-300">{selectedNode.nodeType}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Category:</span>{' '}
                  <span className="text-gray-700 dark:text-gray-300">
                    {selectedNode.metadata.category}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">ID:</span>{' '}
                  <span className="text-gray-700 dark:text-gray-300">{selectedNode.id}</span>
                </div>
                {selectedNode.metadata.description && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border-l-4 border-blue-200 dark:border-blue-600">
                    <div className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Description
                    </div>
                    {renderDescription(selectedNode.metadata.description)}
                  </div>
                )}
              </div>
            </div>

            {/* Inputs */}
            {selectedNode.metadata.inputs.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Inputs
                </h3>
                <div className="space-y-2">
                  {selectedNode.metadata.inputs.map(input => (
                    <div
                      key={input.name}
                      className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md"
                    >
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {input.name}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          input.type === 'audio'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
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
            {selectedNode.metadata.outputs.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Outputs
                </h3>
                <div className="space-y-2">
                  {selectedNode.metadata.outputs.map(output => (
                    <div
                      key={output.name}
                      className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-md"
                    >
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {output.name}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          output.type === 'audio'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
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
            {selectedNode.metadata.properties.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Parameters
                </h3>
                <div className="space-y-4">
                  {selectedNode.metadata.properties.map(prop => (
                    <div key={prop.name}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {prop.name}
                        {prop.type === 'AudioParam' && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            ({prop.min !== undefined ? `${prop.min} - ${prop.max}` : 'AudioParam'})
                          </span>
                        )}
                      </label>
                      {renderPropertyInput(prop)}
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Default: {prop.defaultValue?.toString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Methods */}
            {selectedNode.metadata.methods.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Methods
                </h3>
                <div className="space-y-2">
                  {selectedNode.metadata.methods.map(method => (
                    <button
                      key={method}
                      onClick={() => {
                        /* Method calls not implemented yet */
                      }}
                      className="w-full px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-600 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      {method}()
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Events */}
            {selectedNode.metadata.events.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Events
                </h3>
                <div className="space-y-1">
                  {selectedNode.metadata.events.map(event => (
                    <div
                      key={event}
                      className="text-sm text-gray-600 dark:text-gray-400 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md"
                    >
                      {event}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleRemoveNode}
                className="w-full px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-600 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                Delete Node
              </button>
            </div>
          </>
        )}
      </div>

      {/* Fixed Frequency Analyzer at bottom */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <FrequencyAnalyzer />
      </div>
    </div>
  )
})

export default PropertyPanel
