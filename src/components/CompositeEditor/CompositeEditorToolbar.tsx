/**
 * Composite Editor Toolbar
 *
 * Floating toolbar for adding inputs/outputs and auto-layout.
 */

import React from 'react'
import { AutoLayoutPanelWithContext } from '../AutoLayoutPanel'
import type { LayoutDirection } from '~/utils/autoLayout'

/******************* TYPES ***********************/

export interface CompositeEditorToolbarProps {
  /** Whether dark mode is enabled */
  isDark: boolean
  /** Number of nodes in the graph */
  nodeCount: number
  /** Handler to open add input dialog */
  onAddInput: () => void
  /** Handler to open add output dialog */
  onAddOutput: () => void
  /** Handler for auto-layout */
  onAutoLayout: (direction: LayoutDirection) => void
  /** Whether the toolbar is visible (not read-only) */
  visible: boolean
}

/******************* COMPONENT ***********************/

const CompositeEditorToolbar: React.FC<CompositeEditorToolbarProps> = ({
  isDark,
  nodeCount,
  onAddInput,
  onAddOutput,
  onAutoLayout,
  visible,
}) => {
  if (!visible) return null

  return (
    <div
      className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
    >
      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Add:</span>

      {/* Add Input Button */}
      <button
        onClick={onAddInput}
        data-testid="add-input-button"
        className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${isDark ? 'bg-emerald-900 text-emerald-300 hover:bg-emerald-800' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Input
      </button>

      {/* Add Output Button */}
      <button
        onClick={onAddOutput}
        data-testid="add-output-button"
        className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${isDark ? 'bg-amber-900 text-amber-300 hover:bg-amber-800' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Output
      </button>

      {/* Separator */}
      <div className={`w-px h-4 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />

      {/* View only label for reference */}
      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>View only</span>

      {/* Auto-layout button */}
      <AutoLayoutPanelWithContext
        isDark={isDark}
        nodeCount={nodeCount}
        isReadOnly={false}
        onAutoLayout={onAutoLayout}
      />
    </div>
  )
}

export default CompositeEditorToolbar
