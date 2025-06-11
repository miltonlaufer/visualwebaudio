import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { Listbox, Transition } from '@headlessui/react'
import {
  ChevronUpDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import MicrophoneInput from './MicrophoneInput'

interface NodePaletteProps {
  onClose?: () => void
}

const NodePalette: React.FC<NodePaletteProps> = observer(({ onClose }) => {
  const store = useAudioGraphStore()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = useState(false)

  // Filtering state
  const [searchText, setSearchText] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Get all available categories
  const allCategories = useMemo(() => {
    const categories = new Set<string>()
    store.availableNodeTypes.forEach(nodeType => {
      const metadata = store.webAudioMetadata[nodeType]
      if (metadata?.category) {
        categories.add(metadata.category)
      }
    })
    return Array.from(categories).sort()
  }, [store.availableNodeTypes, store.webAudioMetadata])

  // Filter nodes based on search text and selected categories
  const filteredNodeTypes = useMemo(() => {
    return store.availableNodeTypes.filter(nodeType => {
      const metadata = store.webAudioMetadata[nodeType]
      if (!metadata) return false

      // Filter by search text (only search in node name)
      if (searchText) {
        const searchLower = searchText.toLowerCase()
        const nameMatch = nodeType.toLowerCase().includes(searchLower)
        if (!nameMatch) return false
      }

      // Filter by selected categories
      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(metadata.category)) return false
      }

      return true
    })
  }, [store.availableNodeTypes, store.webAudioMetadata, searchText, selectedCategories])

  // Clear filters function
  const clearFilters = () => {
    setSearchText('')
    setSelectedCategories([])
  }

  // Set up scroll detection
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Check if scroll indicator should be shown
    const checkScrollIndicator = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isScrollable = scrollHeight > clientHeight
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px threshold

      setShowScrollIndicator(isScrollable && !isAtBottom)
    }

    // Initial check
    checkScrollIndicator()

    // Add scroll listener
    container.addEventListener('scroll', checkScrollIndicator)

    // Add resize observer to detect content changes
    const resizeObserver = new ResizeObserver(checkScrollIndicator)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', checkScrollIndicator)
      resizeObserver.disconnect()
    }
  }, [store.availableNodeTypes]) // Re-run when node types change

  // Remove useCallback from simple HTML element handlers
  const handleScrollDown = () => {
    const container = scrollContainerRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }

  const handleDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleNodeClick = useCallback(
    (nodeType: string) => {
      // Add node at a default position with automatic spacing
      const basePosition = { x: 100, y: 100 }
      const nodeSpacing = 400 // Increased from 250 to 400 for better spacing
      const existingNodes = store.adaptedNodes

      // Find a good position that doesn't overlap
      let position = { ...basePosition }
      let attempts = 0
      const maxAttempts = 20

      while (attempts < maxAttempts) {
        let tooClose = false

        for (const existingNode of existingNodes) {
          const distance = Math.sqrt(
            Math.pow(position.x - existingNode.position.x, 2) +
              Math.pow(position.y - existingNode.position.y, 2)
          )

          if (distance < nodeSpacing) {
            tooClose = true
            break
          }
        }

        if (!tooClose) break

        // Adjust position in a spiral pattern
        const angle = attempts * 0.5 * Math.PI
        const radius = nodeSpacing + attempts * 50
        position = {
          x: basePosition.x + Math.cos(angle) * radius,
          y: basePosition.y + Math.sin(angle) * radius,
        }

        attempts++
      }

      store.addAdaptedNode(nodeType, position)
    },
    [store]
  )

  const handleSearchTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value)
  }

  const handleClearSearch = () => {
    setSearchText('')
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'source':
        return 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200'
      case 'effect':
        return 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200'
      case 'destination':
        return 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
      case 'analysis':
        return 'bg-purple-50 dark:bg-purple-900 border-purple-200 dark:border-purple-700 text-purple-800 dark:text-purple-200'
      case 'processing':
        return 'bg-yellow-50 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200'
      case 'context':
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200'
      // Custom node categories
      case 'control':
        return 'bg-pink-50 dark:bg-pink-900 border-pink-200 dark:border-pink-700 text-pink-800 dark:text-pink-200'
      case 'logic':
        return 'bg-indigo-50 dark:bg-indigo-900 border-indigo-200 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
      case 'input':
        return 'bg-teal-50 dark:bg-teal-900 border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-200'
      case 'misc':
        return 'bg-orange-50 dark:bg-orange-900 border-orange-200 dark:border-orange-700 text-orange-800 dark:text-orange-200'
      default:
        return 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200'
    }
  }

  // Custom node types
  const customNodeTypes = [
    'ButtonNode',
    'SliderNode',
    'GreaterThanNode',
    'EqualsNode',
    'SelectNode',
    'MidiInputNode',
    'MidiToFreqNode',
    'ScaleToMidiNode',
    'DisplayNode',
    'SoundFileNode',
    'RandomNode',
    'TimerNode',
  ]

  // Group nodes by category, separating Web Audio and Custom nodes
  const webAudioCategories: Record<string, Array<{ nodeType: string; metadata: any }>> = {}
  const customNodeCategories: Record<string, Array<{ nodeType: string; metadata: any }>> = {}

  filteredNodeTypes.forEach(nodeType => {
    const metadata = store.webAudioMetadata[nodeType]
    if (metadata) {
      const category = metadata.category
      const isCustomNode = customNodeTypes.includes(nodeType)

      if (isCustomNode) {
        if (!customNodeCategories[category]) {
          customNodeCategories[category] = []
        }
        customNodeCategories[category].push({ nodeType, metadata })
      } else {
        if (!webAudioCategories[category]) {
          webAudioCategories[category] = []
        }
        webAudioCategories[category].push({ nodeType, metadata })
      }
    }
  })

  return (
    <div className="flex flex-col h-full relative">
      {/* Scrollable content area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Node Palette</h2>
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

        {/* Microphone Input */}
        <MicrophoneInput />

        {/* Connection Type Legend */}
        <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Connection Types
          </h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-2 border-2"
                style={{
                  backgroundColor: '#10b981',
                  borderColor: '#059669',
                }}
              />
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mr-2">
                Audio
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Sound signals</span>
            </div>
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-2 border-2"
                style={{
                  backgroundColor: '#f59e0b',
                  borderColor: '#d97706',
                }}
              />
              <span className="text-xs text-amber-700 dark:text-amber-400 font-medium mr-2">
                Control
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Parameter modulation</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            💡 Audio can connect to audio or control. Control can only connect to control.
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mb-4 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search nodes to add..."
              value={searchText}
              onChange={handleSearchTextChange}
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {searchText && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  onClick={handleClearSearch}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Listbox value={selectedCategories} onChange={setSelectedCategories} multiple>
              <div className="relative">
                <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm text-gray-900 dark:text-white">
                  <span className="block truncate">
                    {selectedCategories.length === 0
                      ? 'All categories'
                      : selectedCategories.length === 1
                        ? `${selectedCategories[0]} category`
                        : `${selectedCategories.length} categories selected`}
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronUpDownIcon
                      className="h-4 w-4 text-gray-400 dark:text-gray-500"
                      aria-hidden="true"
                    />
                  </span>
                </Listbox.Button>

                <Transition
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-sm shadow-lg ring-1 ring-black dark:ring-gray-600 ring-opacity-5 focus:outline-none">
                    {allCategories.map(category => (
                      <Listbox.Option
                        key={category}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                              : 'text-gray-900 dark:text-gray-100'
                          }`
                        }
                        value={category}
                      >
                        {({ selected }) => (
                          <>
                            <span
                              className={`block truncate ${selected ? 'font-medium' : 'font-normal'} capitalize`}
                            >
                              {category}
                            </span>
                            {selected ? (
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                <CheckIcon className="h-4 w-4" aria-hidden="true" />
                              </span>
                            ) : null}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>

          {/* Clear Filters Button */}
          {(searchText || selectedCategories.length > 0) && (
            <button
              onClick={clearFilters}
              className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-1 px-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear filters ({filteredNodeTypes.length} of {store.availableNodeTypes.length} nodes
              shown)
            </button>
          )}
        </div>
        {/* Web Audio API Nodes */}
        <div className="mb-8">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
            🔊 Web Audio API Nodes
          </h2>
          {Object.entries(webAudioCategories).map(([category, nodes]) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                {category} Nodes
              </h3>
              <div className="space-y-2">
                {nodes.map(({ nodeType, metadata }) => (
                  <div
                    key={nodeType}
                    draggable
                    onDragStart={e => handleDragStart(e, nodeType)}
                    onClick={() => handleNodeClick(nodeType)}
                    className={`
                      p-3 rounded-lg border cursor-pointer transition-all duration-200
                      hover:shadow-md hover:scale-105
                      ${getCategoryColor(category)}
                    `}
                  >
                    <div className="text-sm font-medium">{nodeType.replace('Node', '')}</div>
                    {metadata.description && (
                      <div
                        className="text-xs opacity-75 mt-1 line-clamp-2"
                        title={metadata.description}
                      >
                        {metadata.description.split('.')[0]}.
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-1">
                        {metadata.inputs.length > 0 && (
                          <span className="text-xs bg-white dark:bg-gray-600 bg-opacity-50 dark:bg-opacity-50 px-1 rounded">
                            {metadata.inputs.length} in
                          </span>
                        )}
                        {metadata.outputs.length > 0 && (
                          <span className="text-xs bg-white dark:bg-gray-600 bg-opacity-50 dark:bg-opacity-50 px-1 rounded">
                            {metadata.outputs.length} out
                          </span>
                        )}
                      </div>
                      <span className="text-xs opacity-75">{category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Utility Nodes */}
        {Object.keys(customNodeCategories).length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
              🎛️ Utility Nodes
            </h2>
            {Object.entries(customNodeCategories).map(([category, nodes]) => (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                  {category} Nodes
                </h3>
                <div className="space-y-2">
                  {nodes.map(({ nodeType, metadata }) => (
                    <div
                      key={nodeType}
                      draggable
                      onDragStart={e => handleDragStart(e, nodeType)}
                      onClick={() => handleNodeClick(nodeType)}
                      className={`
                        p-3 rounded-lg border cursor-pointer transition-all duration-200
                        hover:shadow-md hover:scale-105
                        ${getCategoryColor(category)}
                      `}
                    >
                      <div className="text-sm font-medium">{metadata.name}</div>
                      {metadata.description && (
                        <div
                          className="text-xs opacity-75 mt-1 line-clamp-2"
                          title={metadata.description}
                        >
                          {metadata.description.split('.')[0]}.
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-1">
                          {metadata.inputs.length > 0 && (
                            <span className="text-xs bg-white dark:bg-gray-600 bg-opacity-50 dark:bg-opacity-50 px-1 rounded">
                              {metadata.inputs.length} in
                            </span>
                          )}
                          {metadata.outputs.length > 0 && (
                            <span className="text-xs bg-white dark:bg-gray-600 bg-opacity-50 dark:bg-opacity-50 px-1 rounded">
                              {metadata.outputs.length} out
                            </span>
                          )}
                        </div>
                        <span className="text-xs opacity-75">{category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Node Categories - Legacy fallback */}
        {Object.keys(webAudioCategories).length === 0 &&
          Object.keys(customNodeCategories).length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              {searchText || selectedCategories.length > 0 ? (
                <div>
                  <p className="mb-2">No nodes match your filters</p>
                  <button
                    onClick={clearFilters}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm underline"
                  >
                    Clear filters to see all nodes
                  </button>
                </div>
              ) : (
                <p>No nodes available. Check store configuration.</p>
              )}
            </div>
          )}
      </div>

      {/* Floating scroll indicator */}
      {showScrollIndicator && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={handleScrollDown}
            className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg transition-all duration-200 hover:scale-110 animate-bounce"
            title="Scroll down to see more nodes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
})

export default NodePalette
