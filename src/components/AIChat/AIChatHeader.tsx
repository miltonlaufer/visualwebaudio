/**
 * AI Chat Header
 */

import React from 'react'

/******************* TYPES ***********************/

interface AIChatHeaderProps {
  showSidebar: boolean
  showActionsPanel: boolean
  onToggleSidebar: () => void
  onToggleActionsPanel: () => void
  onOpenConfig: () => void
  onClose: () => void
}

/******************* COMPONENT ***********************/

const AIChatHeader: React.FC<AIChatHeaderProps> = ({
  showSidebar,
  showActionsPanel,
  onToggleSidebar,
  onToggleActionsPanel,
  onOpenConfig,
  onClose,
}) => {
  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-blue-600 text-white rounded-t-lg">
      <h3 className="font-semibold text-sm">AI Assistant (beta)</h3>
      <div className="flex items-center gap-1">
        {/* Chat History */}
        <button
          onClick={onToggleSidebar}
          className={`p-1 rounded transition-colors ${showSidebar ? 'bg-blue-700' : 'hover:bg-blue-700'}`}
          title="Chat history"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
        </button>

        {/* Actions Log */}
        <button
          onClick={onToggleActionsPanel}
          className={`p-1 rounded transition-colors ${showActionsPanel ? 'bg-blue-700' : 'hover:bg-blue-700'}`}
          title="Actions log"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
        </button>

        {/* Settings */}
        <button onClick={onOpenConfig} className="p-1 hover:bg-blue-700 rounded" title="Settings">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        {/* Close */}
        <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded" title="Close">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export default AIChatHeader
