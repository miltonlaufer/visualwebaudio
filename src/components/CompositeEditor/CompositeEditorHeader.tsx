/**
 * Composite Editor Header
 *
 * Contains the title, name input, badges, and action buttons.
 */

import React, { useRef } from 'react'

/******************* TYPES ***********************/

export interface CompositeEditorHeaderProps {
  /** Current name of the composite */
  nodeName: string
  /** Handler for name changes */
  onNameChange: (name: string) => void
  /** Whether this is a new composite being created */
  isCreatingNew: boolean
  /** Whether this is a prebuilt (read-only) composite */
  isPrebuilt: boolean
  /** Whether dark mode is enabled */
  isDark: boolean
  /** Handler for save button */
  onSave: () => void
  /** Handler for opening save-as dialog */
  onSaveAs: () => void
  /** Handler for delete button */
  onDelete: () => void
  /** Handler for close button */
  onClose: () => void
  /** Handler for export button */
  onExport: () => void
  /** Handler for import */
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void
}

/******************* COMPONENT ***********************/

const CompositeEditorHeader: React.FC<CompositeEditorHeaderProps> = ({
  nodeName,
  onNameChange,
  isCreatingNew,
  isPrebuilt,
  isDark,
  onSave,
  onSaveAs,
  onDelete,
  onClose,
  onExport,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={`
        flex items-center justify-between px-4 py-3 border-b shrink-0
        ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}
      `}
    >
      {/* Left side: Title, name input, badges */}
      <div className="flex items-center space-x-3">
        <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
          {isCreatingNew ? 'Create Composite' : 'Edit Composite'}
        </h2>

        <input
          type="text"
          value={nodeName}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Node name..."
          disabled={isPrebuilt}
          data-testid="composite-name-input"
          className={`
            px-3 py-1.5 rounded border text-sm font-medium
            ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}
            ${isPrebuilt ? 'opacity-60 cursor-not-allowed' : ''}
          `}
        />

        {isPrebuilt && (
          <span className="px-2 py-1 text-xs font-medium bg-cyan-500 text-white rounded">
            Prebuilt (Read-only)
          </span>
        )}
        {isCreatingNew && (
          <span className="px-2 py-1 text-xs font-medium bg-violet-500 text-white rounded">
            New
          </span>
        )}
      </div>

      {/* Right side: Action buttons */}
      <div className="flex items-center space-x-2">
        {/* Export/Import - only for user composites */}
        {!isPrebuilt && (
          <>
            <button
              onClick={onExport}
              data-testid="composite-export-button"
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors flex items-center gap-1"
              title="Export as JSON"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Export
            </button>

            <label
              data-testid="composite-import-button"
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors cursor-pointer flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Import
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={onImport}
                className="hidden"
              />
            </label>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          </>
        )}

        {/* Save button */}
        {!isPrebuilt && !isCreatingNew && (
          <button
            onClick={onSave}
            data-testid="composite-save-button"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        )}

        {/* Save As button */}
        <button
          onClick={onSaveAs}
          data-testid="composite-save-as-button"
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
        >
          {isCreatingNew ? 'Save' : 'Save As'}
        </button>

        {/* Delete button */}
        {!isPrebuilt && !isCreatingNew && (
          <button
            onClick={onDelete}
            data-testid="composite-delete-button"
            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          data-testid="composite-close-button"
          className={`
            p-2 rounded transition-colors
            ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}
          `}
          title="Close (ESC)"
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
    </div>
  )
}

export default CompositeEditorHeader
