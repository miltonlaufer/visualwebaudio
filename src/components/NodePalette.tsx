import React, { useState, useEffect, useRef, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import MicrophoneInput from './MicrophoneInput'

interface NodePaletteProps {
  onClose?: () => void
}

const NodePalette: React.FC<NodePaletteProps> = observer(({ onClose }) => {
  const store = useAudioGraphStore()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollIndicator, setShowScrollIndicator] = useState(false)

  // Check if scroll indicator should be shown
  const checkScrollIndicator = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isScrollable = scrollHeight > clientHeight
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10 // 10px threshold

    setShowScrollIndicator(isScrollable && !isAtBottom)
  }, [])

  // Set up scroll detection
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

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
  }, [checkScrollIndicator, store.availableNodeTypes]) // Re-run when node types change

  const handleScrollDown = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [])

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleNodeClick = (nodeType: string) => {
    // Add node at a default position with automatic spacing
    const basePosition = { x: 100, y: 100 }
    const nodeSpacing = 250
    const existingNodes = store.visualNodes

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

    store.addNode(nodeType, position)
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'source':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'effect':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      case 'destination':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'analysis':
        return 'bg-purple-50 border-purple-200 text-purple-800'
      case 'processing':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'context':
        return 'bg-gray-50 border-gray-200 text-gray-800'
      default:
        return 'bg-white border-gray-200 text-gray-800'
    }
  }

  // Group nodes by category
  const nodesByCategory = store.availableNodeTypes.reduce(
    (acc, nodeType) => {
      const metadata = store.webAudioMetadata[nodeType]
      if (metadata) {
        const category = metadata.category
        if (!acc[category]) {
          acc[category] = []
        }
        acc[category].push({ nodeType, metadata })
      }
      return acc
    },
    {} as Record<string, Array<{ nodeType: string; metadata: any }>>
  )

  return (
    <div className="flex flex-col h-full relative">
      {/* Scrollable content area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Node Palette</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded lg:hidden"
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
        <div className="mb-6 p-3 bg-gray-50 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Connection Types</h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-2 border-2"
                style={{
                  backgroundColor: '#10b981',
                  borderColor: '#059669',
                }}
              />
              <span className="text-xs text-emerald-700 font-medium mr-2">Audio</span>
              <span className="text-xs text-gray-500">Sound signals</span>
            </div>
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-2 border-2"
                style={{
                  backgroundColor: '#f59e0b',
                  borderColor: '#d97706',
                }}
              />
              <span className="text-xs text-amber-700 font-medium mr-2">Control</span>
              <span className="text-xs text-gray-500">Parameter modulation</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            💡 Audio can connect to audio or control. Control can only connect to control.
          </div>
        </div>

        {/* Node Categories */}
        {Object.entries(nodesByCategory).map(([category, nodes]) => (
          <div key={category} className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2 capitalize">{category} Nodes</h3>
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
                        <span className="text-xs bg-white bg-opacity-50 px-1 rounded">
                          {metadata.inputs.length} in
                        </span>
                      )}
                      {metadata.outputs.length > 0 && (
                        <span className="text-xs bg-white bg-opacity-50 px-1 rounded">
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
