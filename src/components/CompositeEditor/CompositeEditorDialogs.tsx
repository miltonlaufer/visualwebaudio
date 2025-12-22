/**
 * Composite Editor Dialogs
 *
 * Dialog components for Save As and Add Port functionality.
 */

import React from 'react'

/******************* TYPES ***********************/

export interface SaveAsDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Current name value */
  name: string
  /** Handler for name changes */
  onNameChange: (name: string) => void
  /** Handler for save action */
  onSave: () => void
  /** Handler for cancel action */
  onCancel: () => void
  /** Whether dark mode is enabled */
  isDark: boolean
}

export interface AddPortDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Direction of the port */
  direction: 'input' | 'output'
  /** Current name value */
  name: string
  /** Handler for name changes */
  onNameChange: (name: string) => void
  /** Current type value */
  type: 'audio' | 'control'
  /** Handler for type changes */
  onTypeChange: (type: 'audio' | 'control') => void
  /** Handler for add action */
  onAdd: () => void
  /** Handler for cancel action */
  onCancel: () => void
  /** Whether dark mode is enabled */
  isDark: boolean
}

/******************* SAVE AS DIALOG ***********************/

export const SaveAsDialog: React.FC<SaveAsDialogProps> = ({
  isOpen,
  name,
  onNameChange,
  onSave,
  onCancel,
  isDark,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Dialog */}
      <div
        data-testid="save-as-dialog"
        className={`relative p-6 rounded-lg shadow-xl w-96 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      >
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
          Save As New Composite
        </h3>

        <input
          type="text"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="New composite name..."
          autoFocus
          onKeyDown={e => e.key === 'Enter' && onSave()}
          className={`
            w-full px-3 py-2 rounded border mb-4
            ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}
          `}
        />

        <div className="flex justify-end space-x-2">
          <button
            onClick={onCancel}
            className={`px-4 py-2 rounded ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

/******************* ADD PORT DIALOG ***********************/

export const AddPortDialog: React.FC<AddPortDialogProps> = ({
  isOpen,
  direction,
  name,
  onNameChange,
  type,
  onTypeChange,
  onAdd,
  onCancel,
  isDark,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Dialog */}
      <div
        data-testid="add-port-dialog"
        className={`relative p-6 rounded-lg shadow-xl w-80 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
      >
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
          Add {direction === 'input' ? 'Input' : 'Output'} Port
        </h3>

        {/* Name input */}
        <div className="mb-4">
          <label
            className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Port Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => onNameChange(e.target.value)}
            placeholder={`Enter ${direction} name...`}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && name.trim() && onAdd()}
            className={`
              w-full px-3 py-2 rounded border
              ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}
            `}
          />
        </div>

        {/* Type selector */}
        <div className="mb-4">
          <label
            className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Port Type
          </label>
          <select
            value={type}
            onChange={e => onTypeChange(e.target.value as 'audio' | 'control')}
            className={`
              w-full px-3 py-2 rounded border
              ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}
            `}
          >
            <option value="audio">Audio (main signal)</option>
            <option value="control">Control (parameters)</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-2">
          <button
            onClick={onCancel}
            className={`px-4 py-2 rounded ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Cancel
          </button>
          <button
            onClick={onAdd}
            disabled={!name.trim()}
            className={`px-4 py-2 rounded ${
              direction === 'input'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-amber-600 hover:bg-amber-700'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
