/**
 * Chat Store
 *
 * Manages AI chat conversations with persistence to IndexedDB.
 * Supports multiple conversations, auto-naming, and history.
 */

import { types, Instance, flow } from 'mobx-state-tree'
import { ChatPersistenceService } from '~/services/ChatPersistenceService'

/******************* TYPES ***********************/

export interface SerializedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  toolCalls?: Array<{
    name: string
    args: Record<string, unknown>
    result?: string
  }>
}

export interface SerializedConversation {
  id: string
  title: string
  messages: SerializedMessage[]
  createdAt: string
  updatedAt: string
}

/******************* MODELS ***********************/

const ToolCallModel = types.model('ToolCall', {
  name: types.string,
  args: types.frozen<Record<string, unknown>>({}),
  result: types.maybe(types.string),
})

const MessageModel = types.model('Message', {
  id: types.identifier,
  role: types.enumeration(['user', 'assistant', 'system']),
  content: types.string,
  timestamp: types.Date,
  toolCalls: types.optional(types.array(ToolCallModel), []),
})

const ConversationModel = types
  .model('Conversation', {
    id: types.identifier,
    title: types.string,
    messages: types.array(MessageModel),
    createdAt: types.Date,
    updatedAt: types.Date,
  })
  .actions(self => ({
    addMessage(message: {
      id: string
      role: 'user' | 'assistant' | 'system'
      content: string
      timestamp: Date
      toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: string }>
    }) {
      self.messages.push(message)
      self.updatedAt = new Date()
    },

    setTitle(title: string) {
      self.title = title
      self.updatedAt = new Date()
    },

    clearMessages() {
      self.messages.clear()
      self.updatedAt = new Date()
    },
  }))
  .views(self => ({
    get messageCount(): number {
      return self.messages.length
    },

    get lastMessage(): Instance<typeof MessageModel> | undefined {
      return self.messages[self.messages.length - 1]
    },

    get preview(): string {
      const firstUserMessage = self.messages.find(m => m.role === 'user')
      if (firstUserMessage) {
        return (
          firstUserMessage.content.slice(0, 50) +
          (firstUserMessage.content.length > 50 ? '...' : '')
        )
      }
      return 'New conversation'
    },

    toJSON(): SerializedConversation {
      return {
        id: self.id,
        title: self.title,
        messages: self.messages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: m.timestamp.toISOString(),
          toolCalls: m.toolCalls.map(tc => ({
            name: tc.name,
            args: tc.args as Record<string, unknown>,
            result: tc.result,
          })),
        })),
        createdAt: self.createdAt.toISOString(),
        updatedAt: self.updatedAt.toISOString(),
      }
    },
  }))

/******************* STORE ***********************/

export const ChatStore = types
  .model('ChatStore', {
    conversations: types.array(ConversationModel),
    activeConversationId: types.maybe(types.string),
  })
  .volatile(() => ({
    isLoading: false,
    isSaving: false,
    isGeneratingTitle: false,
    persistenceService: null as ChatPersistenceService | null,
  }))
  .views(self => ({
    get activeConversation(): Instance<typeof ConversationModel> | undefined {
      if (!self.activeConversationId) return undefined
      return self.conversations.find(c => c.id === self.activeConversationId)
    },

    get sortedConversations(): Instance<typeof ConversationModel>[] {
      return [...self.conversations].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    },

    get conversationCount(): number {
      return self.conversations.length
    },

    getConversationById(id: string): Instance<typeof ConversationModel> | undefined {
      return self.conversations.find(c => c.id === id)
    },
  }))
  .actions(self => {
    /******************* INTERNAL ACTIONS ***********************/

    const setLoading = (value: boolean) => {
      self.isLoading = value
    }

    const setSaving = (value: boolean) => {
      self.isSaving = value
    }

    const setGeneratingTitle = (value: boolean) => {
      self.isGeneratingTitle = value
    }

    /******************* PUBLIC ACTIONS ***********************/

    const initialize = flow(function* () {
      self.persistenceService = new ChatPersistenceService()
      yield self.persistenceService.initialize()
      yield loadConversations()
    })

    const loadConversations = flow(function* () {
      if (!self.persistenceService) return

      setLoading(true)
      try {
        const stored: SerializedConversation[] = yield self.persistenceService.getAllConversations()

        self.conversations.clear()
        for (const conv of stored) {
          self.conversations.push({
            id: conv.id,
            title: conv.title,
            messages: conv.messages.map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp),
              toolCalls: m.toolCalls || [],
            })),
            createdAt: new Date(conv.createdAt),
            updatedAt: new Date(conv.updatedAt),
          })
        }

        // Set active conversation to most recent if none selected
        if (!self.activeConversationId && self.conversations.length > 0) {
          const sorted = self.sortedConversations
          self.activeConversationId = sorted[0].id
        }
      } finally {
        setLoading(false)
      }
    })

    const createConversation = flow(function* (title = 'New conversation') {
      const id = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const now = new Date()

      const conversation = {
        id,
        title,
        messages: [],
        createdAt: now,
        updatedAt: now,
      }

      self.conversations.push(conversation)
      self.activeConversationId = id

      // Persist
      if (self.persistenceService) {
        const conv = self.getConversationById(id)
        if (conv) {
          yield self.persistenceService.saveConversation(conv.toJSON())
        }
      }

      return id
    })

    const setActiveConversation = (id: string | null) => {
      self.activeConversationId = id || undefined
    }

    const addMessageToActive = flow(function* (message: {
      id: string
      role: 'user' | 'assistant' | 'system'
      content: string
      timestamp: Date
      toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: string }>
    }) {
      const conversation = self.activeConversation
      if (!conversation) {
        // Create a new conversation if none active
        yield createConversation()
      }

      const activeConv = self.activeConversation
      if (activeConv) {
        activeConv.addMessage(message)

        // Persist
        if (self.persistenceService) {
          yield self.persistenceService.saveConversation(activeConv.toJSON())
        }
      }
    })

    const updateConversationTitle = flow(function* (conversationId: string, title: string) {
      const conversation = self.getConversationById(conversationId)
      if (conversation) {
        conversation.setTitle(title)

        // Persist
        if (self.persistenceService) {
          yield self.persistenceService.saveConversation(conversation.toJSON())
        }
      }
    })

    const deleteConversation = flow(function* (id: string) {
      const index = self.conversations.findIndex(c => c.id === id)
      if (index === -1) return

      const wasActive = self.activeConversationId === id

      self.conversations.splice(index, 1)

      // Persist deletion
      if (self.persistenceService) {
        yield self.persistenceService.deleteConversation(id)
      }

      // If deleting the active conversation, switch to another or clear
      if (wasActive) {
        if (self.conversations.length > 0) {
          // Switch to the most recent conversation
          const sorted = self.sortedConversations
          self.activeConversationId = sorted[0].id
        } else {
          // No conversations left - just clear the active ID
          // UI will show a fresh welcome state, conversation created when user sends message
          self.activeConversationId = undefined
        }
      }
    })

    const saveCurrentConversation = flow(function* () {
      const conversation = self.activeConversation
      if (!conversation || !self.persistenceService) return

      setSaving(true)
      try {
        yield self.persistenceService.saveConversation(conversation.toJSON())
      } finally {
        setSaving(false)
      }
    })

    const generateTitleForActive = flow(function* (
      generateTitle: (messages: Array<{ role: string; content: string }>) => Promise<string>
    ) {
      const conversation = self.activeConversation
      if (!conversation || conversation.messages.length < 2) return

      // Only generate title if it's still the default
      if (conversation.title !== 'New conversation') return

      setGeneratingTitle(true)
      try {
        const messagesForTitle = conversation.messages.slice(0, 4).map(m => ({
          role: m.role,
          content: m.content,
        }))

        const title: string = yield generateTitle(messagesForTitle)
        conversation.setTitle(title)

        // Persist
        if (self.persistenceService) {
          yield self.persistenceService.saveConversation(conversation.toJSON())
        }
      } catch (error) {
        console.error('Failed to generate title:', error)
        // Use first user message as fallback
        const firstUser = conversation.messages.find(m => m.role === 'user')
        if (firstUser) {
          const fallbackTitle =
            firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '...' : '')
          conversation.setTitle(fallbackTitle)
        }
      } finally {
        setGeneratingTitle(false)
      }
    })

    const clearAllConversations = flow(function* () {
      if (!self.persistenceService) return

      for (const conv of [...self.conversations]) {
        yield self.persistenceService.deleteConversation(conv.id)
      }

      self.conversations.clear()
      self.activeConversationId = undefined
    })

    return {
      initialize,
      loadConversations,
      createConversation,
      setActiveConversation,
      addMessageToActive,
      updateConversationTitle,
      deleteConversation,
      saveCurrentConversation,
      generateTitleForActive,
      clearAllConversations,
    }
  })

/******************* EXPORTS ***********************/

export interface IChatStore extends Instance<typeof ChatStore> {}
export interface IConversation extends Instance<typeof ConversationModel> {}
export interface IMessage extends Instance<typeof MessageModel> {}
