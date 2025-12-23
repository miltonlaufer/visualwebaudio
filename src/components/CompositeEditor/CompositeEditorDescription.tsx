/**
 * Composite Editor Description
 *
 * The description textarea field for composite nodes.
 */

import React from 'react'

/******************* TYPES ***********************/

export interface CompositeEditorDescriptionProps {
  /** Current description value */
  description: string
  /** Handler for description changes */
  onDescriptionChange: (description: string) => void
  /** Whether the field is read-only */
  isReadOnly: boolean
  /** Whether dark mode is enabled */
  isDark: boolean
}

/******************* COMPONENT ***********************/

const CompositeEditorDescription: React.FC<CompositeEditorDescriptionProps> = ({
  description,
  onDescriptionChange,
  isReadOnly,
  isDark,
}) => {
  return (
    <div
      className={`px-4 py-3 border-b shrink-0 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}
    >
      <label
        className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
      >
        Description
      </label>
      <textarea
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        placeholder="Describe what this composite node does..."
        disabled={isReadOnly}
        rows={2}
        data-testid="composite-description"
        className={`
          w-full px-3 py-2 rounded border text-sm resize-none
          ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}
          ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      />
    </div>
  )
}

export default CompositeEditorDescription
