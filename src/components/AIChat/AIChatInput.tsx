/**
 * AI Chat Input Area
 */

import React, { useRef, useCallback, useEffect } from 'react'

/******************* TYPES ***********************/

interface AIChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  isLoading: boolean
  isInitialized: boolean
  confirmOperations: boolean
  onConfirmOperationsChange: (checked: boolean) => void
  error: string | null
  autoFocus?: boolean
}

/******************* COMPONENT ***********************/

const AIChatInput: React.FC<AIChatInputProps> = ({
  value,
  onChange,
  onSend,
  isLoading,
  isInitialized,
  confirmOperations,
  onConfirmOperationsChange,
  error,
  autoFocus = true,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /******************* EFFECTS ***********************/

  // Auto-focus when initialized
  useEffect(() => {
    if (autoFocus && isInitialized && !isLoading && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }, [autoFocus, isInitialized, isLoading])

  /******************* FUNCTIONS ***********************/

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSend()
      }
    },
    [onSend]
  )

  const handleConfirmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onConfirmOperationsChange(e.target.checked)
    },
    [onConfirmOperationsChange]
  )

  /******************* EFFECTS ***********************/

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [value])

  /******************* RENDER ***********************/

  return (
    <div className="p-3 border-t border-gray-200">
      {/* Error Display */}
      {error && (
        <div className="mb-2 bg-red-50 border border-red-200 rounded-md p-2">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Confirm Operations Checkbox */}
      <div className="mb-2 flex items-start gap-2">
        <input
          type="checkbox"
          id="confirmOperations"
          checked={confirmOperations}
          onChange={handleConfirmChange}
          className="mt-0.5 h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="confirmOperations" className="text-xs text-gray-600 leading-tight">
          <span className="font-medium">Verify results</span>
          <span className="block text-gray-400 text-[10px]">
            AI reviews its work (uses more tokens)
          </span>
        </label>
      </div>

      {/* Input Area */}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder={isInitialized ? 'Ask me to create audio nodes...' : 'Configure AI first'}
          disabled={!isInitialized || isLoading}
          className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-sm resize-none min-h-[38px] max-h-[120px]"
          rows={1}
        />
        <button
          onClick={onSend}
          disabled={!isInitialized || isLoading || !value.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-2 rounded-md transition-colors h-[38px]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default AIChatInput
