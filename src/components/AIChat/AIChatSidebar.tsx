/**
 * AI Chat Sidebar - Conversation list
 */

import React from 'react'
import { observer } from 'mobx-react-lite'
import type { IChatStore, IConversation } from '~/stores/ChatStore'

/******************* TYPES ***********************/

interface AIChatSidebarProps {
  chatStore: IChatStore
  height: number
  onClose: () => void
  onSelectConversation: (conv: IConversation) => void
  onNewConversation: () => void
  onDeleteConversation: (convId: string, e: React.MouseEvent) => void
}

/******************* COMPONENT ***********************/

const AIChatSidebar: React.FC<AIChatSidebarProps> = observer(
  ({
    chatStore,
    height,
    onClose,
    onSelectConversation,
    onNewConversation,
    onDeleteConversation,
  }) => {
    return (
      <div className="w-56 bg-gray-900 rounded-lg shadow-2xl flex flex-col" style={{ height }}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <h4 className="font-medium text-sm text-gray-200">Conversations</h4>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400">
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

        {/* New Conversation Button */}
        <div className="p-2 border-b border-gray-700">
          <button
            onClick={onNewConversation}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New chat
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chatStore.sortedConversations.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No conversations yet</p>
          ) : (
            chatStore.sortedConversations.map(conv => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={chatStore.activeConversationId === conv.id}
                onSelect={() => onSelectConversation(conv)}
                onDelete={e => onDeleteConversation(conv.id, e)}
              />
            ))
          )}
        </div>
      </div>
    )
  }
)

/******************* SUB-COMPONENTS ***********************/

interface ConversationItemProps {
  conversation: IConversation
  isActive: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
  onDelete,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
        isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{conversation.title}</p>
        <p className="text-[10px] text-gray-500">
          {conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}
        </p>
      </div>
      <button
        onClick={onDelete}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-600 rounded text-gray-400 hover:text-red-400 transition-all"
        title="Delete conversation"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  )
}

export default AIChatSidebar
