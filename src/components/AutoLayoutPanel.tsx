/**
 * Auto Layout Panel
 *
 * A reusable component for auto-arranging nodes in a graph.
 * Works with both main graph and composite editor contexts.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { LAYOUT_DIRECTIONS, type LayoutDirection } from '~/utils/autoLayout'

/******************* TYPES ***********************/

export interface FitViewOptions {
  padding?: number
  duration?: number
  maxZoom?: number
}

export interface AutoLayoutPanelProps {
  /** Whether the UI is in dark mode */
  isDark: boolean
  /** Number of nodes in the graph */
  nodeCount: number
  /** Whether the graph is in read-only mode */
  isReadOnly?: boolean
  /** Callback to perform the auto-layout */
  onAutoLayout: (direction: LayoutDirection) => void | Promise<void>
  /** Callback after layout is complete */
  onLayoutComplete?: () => void
  /** Optional fitView function - must be provided when used outside ReactFlow context */
  fitView?: (options?: FitViewOptions) => void
}

/******************* COMPONENT ***********************/

const AutoLayoutPanel: React.FC<AutoLayoutPanelProps> = ({
  isDark,
  nodeCount,
  isReadOnly = false,
  onAutoLayout,
  onLayoutComplete,
  fitView,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [direction, setDirection] = useState<LayoutDirection>('LR')
  const [isLayouting, setIsLayouting] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  /******************* EFFECTS ***********************/

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as globalThis.Node)) {
        setIsOpen(false)
      }
    }

    // Delay adding the listener to avoid catching the opening click
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  /******************* HANDLERS ***********************/

  const handleAutoLayout = useCallback(async () => {
    if (nodeCount === 0 || isReadOnly) return

    setIsLayouting(true)

    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 50))

    try {
      await onAutoLayout(direction)

      // Force ReactFlow to re-render with new positions
      onLayoutComplete?.()

      // Fit view to show all nodes (if fitView callback is provided)
      if (fitView) {
        setTimeout(() => {
          fitView({
            padding: 0.1,
            duration: 500,
            maxZoom: 1.2,
          })
        }, 100)
      }
    } finally {
      setIsLayouting(false)
      setIsOpen(false)
    }
  }, [nodeCount, isReadOnly, direction, onAutoLayout, onLayoutComplete, fitView])

  /******************* RENDER ***********************/

  const buttonBaseClass = isDark
    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600'
    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'

  const disabledClass = nodeCount === 0 || isReadOnly ? 'opacity-50 cursor-not-allowed' : ''

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={e => {
          e.stopPropagation()
          if (!isReadOnly) {
            setIsOpen(!isOpen)
          }
        }}
        data-testid="auto-layout-button"
        className={`p-2 rounded-lg shadow-md border ${buttonBaseClass} ${disabledClass} transition-colors`}
        title={isReadOnly ? 'Auto-arrange (disabled in read-only mode)' : 'Auto-arrange nodes'}
        disabled={nodeCount === 0 || isReadOnly}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M10 8h4M8 14v-4M16 10v4"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && !isReadOnly && (
        <div
          className={`absolute top-full mt-2 right-0 rounded-lg shadow-lg border p-3 min-w-[180px] z-50 ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          <div className="mb-3">
            <label
              className={`text-xs font-medium mb-1 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            >
              Direction
            </label>
            <select
              value={direction}
              onChange={e => setDirection(e.target.value as LayoutDirection)}
              className={`w-full px-2 py-1.5 rounded text-sm border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {LAYOUT_DIRECTIONS.map(d => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAutoLayout}
            disabled={isLayouting || nodeCount === 0}
            className={`w-full py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-600 disabled:text-gray-400'
                : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500'
            }`}
          >
            {isLayouting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Arranging...
              </span>
            ) : (
              'Auto-arrange'
            )}
          </button>

          <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {nodeCount} node{nodeCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

export default AutoLayoutPanel

/******************* WRAPPER WITH REACT FLOW CONTEXT ***********************/

/**
 * AutoLayoutPanel wrapper that automatically gets fitView from ReactFlow context.
 * Use this when the AutoLayoutPanel is rendered inside a ReactFlow component.
 */
export const AutoLayoutPanelWithContext: React.FC<
  Omit<AutoLayoutPanelProps, 'fitView'>
> = props => {
  const { fitView } = useReactFlow()
  return <AutoLayoutPanel {...props} fitView={fitView} />
}
