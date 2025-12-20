/**
 * AI Chat Messages Display
 */

import React, { useRef, useEffect } from 'react'
import type { ChatMessage } from '~/services/LangChainService'

/******************* TYPES ***********************/

interface AIChatMessagesProps {
  messages: ChatMessage[]
  isLoading: boolean
  isInitialized: boolean
  onOpenConfig: () => void
}

interface ToolCall {
  name: string
  args?: Record<string, unknown>
  result?: string
}

/******************* HELPERS ***********************/

/**
 * Format tool calls into a concise, non-repetitive summary
 */
function formatToolCallSummary(toolCalls: ToolCall[]): string {
  // Count occurrences of each action type
  const counts: Record<string, number> = {}

  for (const tc of toolCalls) {
    // For batchActions, count the individual actions inside
    if (tc.name === 'batchActions' && tc.args?.actions) {
      const actions = tc.args.actions as Array<{ type: string }>
      for (const action of actions) {
        const type = action.type || 'action'
        counts[type] = (counts[type] || 0) + 1
      }
    } else {
      counts[tc.name] = (counts[tc.name] || 0) + 1
    }
  }

  // Format as readable summary
  const parts: string[] = []

  if (counts.addNode) {
    parts.push(`${counts.addNode} node${counts.addNode > 1 ? 's' : ''} added`)
  }
  if (counts.removeNode) {
    parts.push(`${counts.removeNode} node${counts.removeNode > 1 ? 's' : ''} removed`)
  }
  if (counts.connect) {
    parts.push(`${counts.connect} connection${counts.connect > 1 ? 's' : ''}`)
  }
  if (counts.disconnect) {
    parts.push(`${counts.disconnect} disconnection${counts.disconnect > 1 ? 's' : ''}`)
  }
  if (counts.updateProperty) {
    parts.push(`${counts.updateProperty} propert${counts.updateProperty > 1 ? 'ies' : 'y'} updated`)
  }

  // Add any other tool types not covered above
  for (const [name, count] of Object.entries(counts)) {
    if (
      ![
        'addNode',
        'removeNode',
        'connect',
        'disconnect',
        'updateProperty',
        'batchActions',
      ].includes(name)
    ) {
      parts.push(`${count}x ${name}`)
    }
  }

  return parts.length > 0 ? `Actions: ${parts.join(', ')}` : 'Actions executed'
}

/******************* COMPONENT ***********************/

const AIChatMessages: React.FC<AIChatMessagesProps> = ({
  messages,
  isLoading,
  isInitialized,
  onOpenConfig,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  /******************* EFFECTS ***********************/

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /******************* RENDER ***********************/

  if (!isInitialized) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-gray-500 mt-8">
          <p className="mb-4">Configure your AI assistant to get started</p>
          <button
            onClick={onOpenConfig}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
          >
            Open Settings
          </button>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-gray-500 mt-8">
          <p>What do you want to build?</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map(message => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading && <LoadingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  )
}

/******************* SUB-COMPONENTS ***********************/

interface MessageBubbleProps {
  message: ChatMessage
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] p-3 rounded-lg ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
        }`}
      >
        <div
          className="text-sm whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: message.content }}
        />
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 text-xs opacity-75">{formatToolCallSummary(message.toolCalls)}</div>
        )}
      </div>
    </div>
  )
}

const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          <span className="text-sm">AI is thinking...</span>
        </div>
      </div>
    </div>
  )
}

export default AIChatMessages
