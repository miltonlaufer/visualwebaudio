/**
 * AI Chat Actions Panel - Shows AI tool executions
 */

import React from 'react'
import type { AIAction } from './types'

/******************* TYPES ***********************/

interface AIChatActionsPanelProps {
  actions: AIAction[]
  expandedBatches: Set<string>
  onToggleBatch: (id: string) => void
  onClose: () => void
  height: number
}

/******************* COMPONENT ***********************/

const AIChatActionsPanel: React.FC<AIChatActionsPanelProps> = ({
  actions,
  expandedBatches,
  onToggleBatch,
  onClose,
  height,
}) => {
  return (
    <div
      className="w-64 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col"
      style={{ height }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h4 className="font-medium text-sm text-gray-700">AI Actions</h4>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded text-gray-500">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Actions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {actions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No actions yet</p>
        ) : (
          actions.map(action => (
            <ActionItem
              key={action.id}
              action={action}
              isExpanded={expandedBatches.has(action.id)}
              onToggle={() => onToggleBatch(action.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

/******************* SUB-COMPONENTS ***********************/

interface ActionItemProps {
  action: AIAction
  isExpanded: boolean
  onToggle: () => void
}

const ActionItem: React.FC<ActionItemProps> = ({ action, isExpanded, onToggle }) => {
  return (
    <div>
      {/* Main action row */}
      <div
        className={`text-xs p-2 rounded ${action.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'} ${action.children ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
        onClick={action.children ? onToggle : undefined}
      >
        <div className="flex items-center gap-1">
          {/* Expand/collapse arrow for batches */}
          {action.children && (
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {/* Success/error icon */}
          <StatusIcon success={action.success} />
          <span className="truncate">{action.description}</span>
        </div>
      </div>

      {/* Expanded children for batch actions */}
      {action.children && isExpanded && (
        <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 pl-2">
          {action.children.map(child => (
            <div
              key={child.id}
              className={`text-[11px] py-1 px-2 rounded ${child.success ? 'text-green-700' : 'bg-red-50 text-red-700'}`}
            >
              <div className="flex items-center gap-1">
                <StatusIcon success={child.success} small />
                <span className="truncate">{child.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface StatusIconProps {
  success: boolean
  small?: boolean
}

const StatusIcon: React.FC<StatusIconProps> = ({ success, small }) => {
  const size = small ? 'w-2.5 h-2.5' : 'w-3 h-3'

  if (success) {
    return (
      <svg
        className={`${size} text-green-500 flex-shrink-0`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  return (
    <svg className={`${size} text-red-500 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default AIChatActionsPanel
