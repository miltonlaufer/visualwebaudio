/**
 * AI Chat - Main Container Component
 *
 * Orchestrates the AI chat interface with modular subcomponents
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import { LangChainService, type ChatMessage } from '~/services/LangChainService'
import { KeyStorageService } from '~/services/KeyStorageService'
import { fetchModels, validateApiKey } from '~/services/ModelFetcherService'
import { ChatStore, type IChatStore, type IConversation } from '~/stores/ChatStore'
import { type ProviderId, type ModelInfo, getProviderConfig, getDefaultModels } from '~/config'

// Subcomponents
import {
  AIChatHeader,
  AIChatSidebar,
  AIChatMessages,
  AIChatInput,
  AIChatActionsPanel,
  AIChatConfigModal,
  type AIAction,
  parseActionsFromToolCall,
} from './AIChat/index'

/******************* CHAT STORE SINGLETON ***********************/

let chatStoreInstance: IChatStore | null = null
const getChatStore = (): IChatStore => {
  chatStoreInstance ??= ChatStore.create({
    conversations: [],
    activeConversationId: undefined,
  })
  return chatStoreInstance
}

/******************* COMPONENT ***********************/

const AIChat: React.FC = observer(() => {
  /******************* STORE ***********************/

  const store = useAudioGraphStore()
  const langChainService = useRef(new LangChainService())
  const chatStore = useMemo(() => getChatStore(), [])

  /******************* STATE ***********************/

  // Core state
  const [isOpen, setIsOpen] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Configuration state
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState<ProviderId>('openai')
  const [model, setModel] = useState('gpt-4o')
  const [temperature, setTemperature] = useState(0.7)
  const [storageType, setStorageType] = useState<'session' | 'encrypted'>('session')
  const [encryptionPassword, setEncryptionPassword] = useState('')
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)

  // Models state
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [isValidatingKey, setIsValidatingKey] = useState(false)

  // AI behavior
  const [confirmOperations, setConfirmOperations] = useState(true)

  // UI state
  const [chatHeight, setChatHeight] = useState(500)
  const [isResizing, setIsResizing] = useState(false)
  const [showActionsPanel, setShowActionsPanel] = useState(false)
  const [aiActions, setAiActions] = useState<AIAction[]>([])
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
  const [showSidebar, setShowSidebar] = useState(false)
  const [chatStoreReady, setChatStoreReady] = useState(false)
  const [hasAutoOpenedActionsPanel, setHasAutoOpenedActionsPanel] = useState(false)

  // Refs
  const resizeRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /******************* COMPUTED ***********************/

  const currentProviderConfig = getProviderConfig(provider)
  const supportsTools = availableModels.find(m => m.id === model)?.supportsTools ?? true

  /******************* FUNCTIONS ***********************/

  const loadModelsForProvider = useCallback(
    async (providerId: ProviderId, key?: string) => {
      setIsLoadingModels(true)
      try {
        const models = await fetchModels(providerId, key)
        setAvailableModels(models)
        if (models.length > 0 && !models.find(m => m.id === model)) {
          setModel(models[0].id)
        }
      } catch {
        setAvailableModels(getDefaultModels(providerId))
      } finally {
        setIsLoadingModels(false)
      }
    },
    [model]
  )

  const handleRefreshModels = useCallback(async () => {
    if (!apiKey && currentProviderConfig.requiresApiKey) {
      setError('Please enter an API key first')
      return
    }
    setIsLoadingModels(true)
    setError(null)
    try {
      const models = await fetchModels(provider, apiKey, true)
      setAvailableModels(models)
      if (models.length === 0) {
        setError('No models found. Check your API key.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh models')
    } finally {
      setIsLoadingModels(false)
    }
  }, [provider, apiKey, currentProviderConfig.requiresApiKey])

  const handleValidateApiKey = useCallback(async () => {
    if (!apiKey.trim()) return
    setIsValidatingKey(true)
    setError(null)
    try {
      const isValid = await validateApiKey(provider, apiKey)
      if (isValid) {
        await loadModelsForProvider(provider, apiKey)
      } else {
        setError('Invalid API key')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate API key')
    } finally {
      setIsValidatingKey(false)
    }
  }, [apiKey, provider, loadModelsForProvider])

  const handleSaveConfig = useCallback(async () => {
    if (!apiKey.trim() && currentProviderConfig.requiresApiKey) {
      setError('Please enter an API key')
      return
    }

    try {
      setError(null)

      if (currentProviderConfig.requiresApiKey) {
        if (storageType === 'encrypted') {
          if (!encryptionPassword.trim()) {
            setError('Please enter an encryption password')
            return
          }
          await KeyStorageService.storeKey(provider, apiKey, {
            storageType: 'encrypted',
            password: encryptionPassword,
          })
        } else {
          await KeyStorageService.storeKey(provider, apiKey, {
            storageType: 'session',
          })
        }
      }

      langChainService.current.initialize({
        apiKey: currentProviderConfig.requiresApiKey ? apiKey : undefined,
        provider,
        model,
        temperature,
      })

      setHasStoredKey(true)
      setIsConfigOpen(false)

      const toolSupportNote = supportsTools
        ? 'I can directly modify your audio graph using tool calls.'
        : 'This model uses JSON mode for graph modifications.'

      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Hello! I'm your AI assistant for building Web Audio API graphs. ${toolSupportNote}\n\nWhat would you like to create?`,
        timestamp: new Date(),
      }
      setMessages([welcomeMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    }
  }, [
    apiKey,
    currentProviderConfig.requiresApiKey,
    storageType,
    encryptionPassword,
    provider,
    model,
    temperature,
    supportsTools,
  ])

  const handleClearStorage = useCallback(async () => {
    try {
      await KeyStorageService.removeKey(provider, 'session')
      await KeyStorageService.removeKey(provider, 'encrypted')
      setApiKey('')
      setEncryptionPassword('')
      setHasStoredKey(false)
      setNeedsPassword(false)
      setMessages([])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear storage')
    }
  }, [provider])

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || !langChainService.current.isInitialized()) {
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)
    setError(null)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const response = await langChainService.current.processMessage(
        userMessage.content,
        store,
        messages,
        { confirmOperations }
      )
      setMessages(prev => [...prev, response])

      if (response.toolCalls && response.toolCalls.length > 0) {
        const newActions: AIAction[] = response.toolCalls.flatMap(tc =>
          parseActionsFromToolCall(tc.name, tc.args, tc.result)
        )
        setAiActions(prev => [...newActions, ...prev].slice(0, 50))

        // Auto-open actions panel on first tool call in this chat session
        if (!hasAutoOpenedActionsPanel) {
          setShowActionsPanel(true)
          setHasAutoOpenedActionsPanel(true)
        }
      }

      if (chatStoreReady && chatStore.activeConversation?.title === 'New conversation') {
        chatStore.generateTitleForActive(async msgs => {
          return langChainService.current.generateTitle(msgs)
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response')
    } finally {
      setIsLoading(false)
    }
  }, [
    inputMessage,
    isLoading,
    store,
    messages,
    confirmOperations,
    chatStoreReady,
    chatStore,
    hasAutoOpenedActionsPanel,
  ])

  const handlePasswordSubmit = useCallback(async () => {
    if (!encryptionPassword.trim()) {
      setError('Please enter a password')
      return
    }

    try {
      setError(null)
      const storedKey = await KeyStorageService.retrieveKey(provider, {
        storageType: 'encrypted',
        password: encryptionPassword,
      })
      if (storedKey) {
        setApiKey(storedKey)
        langChainService.current.initialize({
          apiKey: storedKey,
          provider,
          model,
          temperature,
        })
        setNeedsPassword(false)
        setHasStoredKey(true)

        const welcomeMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Hello! I'm your AI assistant for building Web Audio API graphs. I can help you create audio nodes, connect them, and build complete musical setups.\n\nWhat would you like to create?`,
          timestamp: new Date(),
        }
        setMessages([welcomeMessage])
      } else {
        setError('Incorrect password or no stored key found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decrypt key')
    }
  }, [encryptionPassword, provider, model, temperature])

  /******************* CONVERSATION HANDLERS ***********************/

  const handleNewConversation = useCallback(() => {
    chatStore.setActiveConversation(null)
    setMessages([])
    setAiActions([])
    setHasAutoOpenedActionsPanel(false) // Reset for new conversation
  }, [chatStore])

  const handleSelectConversation = useCallback(
    async (conv: IConversation) => {
      chatStore.setActiveConversation(conv.id)
      setMessages(
        conv.messages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: new Date(m.timestamp),
          toolCalls: m.toolCalls.map(tc => ({
            name: tc.name,
            args: tc.args,
            result: tc.result,
          })),
        }))
      )
      setAiActions([])
      setShowSidebar(false)
      setHasAutoOpenedActionsPanel(false) // Reset for different conversation
    },
    [chatStore]
  )

  const handleDeleteConversation = useCallback(
    async (convId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const wasCurrentConversation = chatStore.activeConversationId === convId
      await chatStore.deleteConversation(convId)

      const activeConv = chatStore.activeConversation
      if (activeConv && activeConv.messages.length > 0) {
        setMessages(
          activeConv.messages.map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            timestamp: new Date(m.timestamp),
            toolCalls: m.toolCalls.map(tc => ({
              name: tc.name,
              args: tc.args,
              result: tc.result,
            })),
          }))
        )
      } else if (wasCurrentConversation) {
        const welcomeMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Hello! I'm your AI assistant for building Web Audio API graphs. I can help you create audio nodes, connect them, and build complete musical setups.\n\nWhat would you like to create?`,
          timestamp: new Date(),
        }
        setMessages([welcomeMessage])
      }
      setAiActions([])
    },
    [chatStore]
  )

  /******************* UI HANDLERS ***********************/

  const handleOpenChat = useCallback(() => setIsOpen(true), [])
  const handleCloseChat = useCallback(() => setIsOpen(false), [])
  const handleOpenConfig = useCallback(() => setIsConfigOpen(true), [])
  const handleCloseConfig = useCallback(() => setIsConfigOpen(false), [])
  const toggleSidebar = useCallback(() => setShowSidebar(prev => !prev), [])
  const toggleActionsPanel = useCallback(() => setShowActionsPanel(prev => !prev), [])

  const toggleBatchExpanded = useCallback((id: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleProviderChange = useCallback(
    async (newProvider: ProviderId) => {
      setProvider(newProvider)
      setApiKey('')
      setError(null)
      await loadModelsForProvider(newProvider)
    },
    [loadModelsForProvider]
  )

  const handleUseDifferentKey = useCallback(() => {
    setNeedsPassword(false)
    setIsConfigOpen(true)
  }, [])

  /******************* EFFECTS ***********************/

  // Initialize chat store
  useEffect(() => {
    const initChatStore = async () => {
      await chatStore.initialize()
      setChatStoreReady(true)

      // Auto-open sidebar if there are previous conversations
      if (chatStore.conversations.length > 0) {
        setShowSidebar(true)
      }

      const activeConv = chatStore.activeConversation
      if (activeConv && activeConv.messages.length > 0) {
        setMessages(
          activeConv.messages.map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            timestamp: new Date(m.timestamp),
            toolCalls: m.toolCalls.map(tc => ({
              name: tc.name,
              args: tc.args,
              result: tc.result,
            })),
          }))
        )
      }
    }
    initChatStore()
  }, [chatStore])

  // Sync messages to chat store (only when user has sent messages)
  useEffect(() => {
    if (!chatStoreReady || messages.length === 0) return

    const hasUserMessage = messages.some(m => m.role === 'user')
    if (!hasUserMessage) return

    const syncMessages = async () => {
      if (!chatStore.activeConversation) {
        await chatStore.createConversation()
      }

      const activeConv = chatStore.activeConversation
      if (activeConv) {
        for (const msg of messages) {
          const storeHasMessage = activeConv.messages.some(m => m.id === msg.id)
          if (!storeHasMessage) {
            await chatStore.addMessageToActive({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
              toolCalls: msg.toolCalls?.map(tc => ({
                name: tc.name,
                args: tc.args,
                result: tc.result,
              })),
            })
          }
        }
      }
    }
    syncMessages()
  }, [messages, chatStoreReady, chatStore])

  // Check for stored keys on mount
  useEffect(() => {
    const checkStoredKeys = async () => {
      const sessionKey = await KeyStorageService.retrieveKey(provider, { storageType: 'session' })
      if (sessionKey) {
        setApiKey(sessionKey)
        setHasStoredKey(true)
        langChainService.current.initialize({
          apiKey: sessionKey,
          provider,
          model,
          temperature,
        })
        return
      }

      const hasEncrypted = await KeyStorageService.hasKey(provider, 'encrypted')
      if (hasEncrypted) {
        setNeedsPassword(true)
        setHasStoredKey(true)
      }
    }
    checkStoredKeys()
    loadModelsForProvider(provider)
  }, [provider, model, temperature, loadModelsForProvider])

  // Resize handling
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newHeight = window.innerHeight - e.clientY - 24
      setChatHeight(Math.max(300, Math.min(800, newHeight)))
    }

    const handleMouseUp = () => setIsResizing(false)

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [inputMessage])

  /******************* RENDER ***********************/

  if (!isOpen) {
    return (
      <button
        onClick={handleOpenChat}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-105 z-50"
        title="Open AI Assistant"
      >
        <span className="text-lg font-bold">AI</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 flex gap-2 z-50">
      {/* Actions Panel */}
      {showActionsPanel && (
        <AIChatActionsPanel
          actions={aiActions}
          expandedBatches={expandedBatches}
          onToggleBatch={toggleBatchExpanded}
          onClose={toggleActionsPanel}
          height={chatHeight}
        />
      )}

      {/* Conversations Sidebar */}
      {showSidebar && (
        <AIChatSidebar
          chatStore={chatStore}
          height={chatHeight}
          onClose={toggleSidebar}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
        />
      )}

      {/* Main Chat Container */}
      <div
        className="w-96 bg-white rounded-lg shadow-2xl flex flex-col relative"
        style={{ height: chatHeight }}
      >
        {/* Resize Handle */}
        <div
          ref={resizeRef}
          className="absolute -top-2 left-0 right-0 h-4 cursor-ns-resize group flex items-center justify-center"
          onMouseDown={() => setIsResizing(true)}
        >
          <div className="w-12 h-1 bg-gray-300 rounded-full group-hover:bg-blue-400 transition-colors" />
        </div>

        {/* Header */}
        <AIChatHeader
          showSidebar={showSidebar}
          showActionsPanel={showActionsPanel}
          onToggleSidebar={toggleSidebar}
          onToggleActionsPanel={toggleActionsPanel}
          onOpenConfig={handleOpenConfig}
          onClose={handleCloseChat}
        />

        {/* Configuration Modal */}
        {isConfigOpen && (
          <AIChatConfigModal
            provider={provider}
            model={model}
            temperature={temperature}
            apiKey={apiKey}
            storageType={storageType}
            encryptionPassword={encryptionPassword}
            availableModels={availableModels}
            isLoadingModels={isLoadingModels}
            isValidatingKey={isValidatingKey}
            hasStoredKey={hasStoredKey}
            error={error}
            onProviderChange={handleProviderChange}
            onModelChange={setModel}
            onTemperatureChange={setTemperature}
            onApiKeyChange={setApiKey}
            onStorageTypeChange={setStorageType}
            onEncryptionPasswordChange={setEncryptionPassword}
            onRefreshModels={handleRefreshModels}
            onValidateApiKey={handleValidateApiKey}
            onSave={handleSaveConfig}
            onClearStorage={handleClearStorage}
            onClose={handleCloseConfig}
          />
        )}

        {/* Password Prompt for Encrypted Keys */}
        {needsPassword && !isConfigOpen && (
          <PasswordPrompt
            providerName={currentProviderConfig.name}
            password={encryptionPassword}
            error={error}
            onPasswordChange={setEncryptionPassword}
            onSubmit={handlePasswordSubmit}
            onUseDifferentKey={handleUseDifferentKey}
          />
        )}

        {/* Chat Content */}
        {!isConfigOpen && !needsPassword && (
          <>
            <AIChatMessages
              messages={messages}
              isLoading={isLoading}
              isInitialized={langChainService.current.isInitialized()}
              onOpenConfig={handleOpenConfig}
            />

            <AIChatInput
              value={inputMessage}
              onChange={setInputMessage}
              onSend={handleSendMessage}
              isLoading={isLoading}
              isInitialized={langChainService.current.isInitialized()}
              confirmOperations={confirmOperations}
              onConfirmOperationsChange={setConfirmOperations}
              error={error}
            />

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50 rounded-b-lg">
              <a
                href="https://github.com/miltonlaufer/visualwebaudio/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-gray-400 hover:text-blue-500 transition-colors"
              >
                Found an issue? Report on GitHub
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
})

/******************* SUB-COMPONENTS ***********************/

interface PasswordPromptProps {
  providerName: string
  password: string
  error: string | null
  onPasswordChange: (password: string) => void
  onSubmit: () => void
  onUseDifferentKey: () => void
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({
  providerName,
  password,
  error,
  onPasswordChange,
  onSubmit,
  onUseDifferentKey,
}) => {
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        onSubmit()
      }
    },
    [onSubmit]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onPasswordChange(e.target.value)
    },
    [onPasswordChange]
  )

  return (
    <div className="flex-1 flex flex-col justify-center p-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Enter Password</h3>
        <p className="text-sm text-gray-600 mb-4">
          Your {providerName} API key is encrypted. Please enter your password to unlock it.
        </p>
      </div>

      <div className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder="Enter your encryption password"
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={onSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
          >
            Unlock
          </button>
          <button
            onClick={onUseDifferentKey}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-md transition-colors"
          >
            Use Different Key
          </button>
        </div>
      </div>
    </div>
  )
}

export default AIChat
