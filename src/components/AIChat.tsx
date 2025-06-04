import React, { useState, useRef, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import { LangChainService, type ChatMessage } from '~/services/LangChainService'
import { KeyStorageService } from '~/services/KeyStorageService'

const AIChat: React.FC = observer(() => {
  const [isOpen, setIsOpen] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Configuration state
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'google'>('openai')
  const [model, setModel] = useState('gpt-4')
  const [temperature, setTemperature] = useState(0.7)
  const [storageType, setStorageType] = useState<'session' | 'encrypted'>('session')
  const [encryptionPassword, setEncryptionPassword] = useState('')
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const store = useAudioGraphStore()
  const langChainService = useRef(new LangChainService())

  // Model options for different providers
  const modelOptions = {
    openai: [
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
    ],
    google: [
      { value: 'gemini-pro', label: 'Gemini Pro' },
      { value: 'gemini-pro-vision', label: 'Gemini Pro Vision' },
    ],
  }

  // Update model when provider changes
  useEffect(() => {
    const defaultModels = {
      openai: 'gpt-4',
      anthropic: 'claude-3-5-sonnet-20241022',
      google: 'gemini-pro',
    }
    setModel(defaultModels[provider])
  }, [provider])

  // Check for stored keys on mount
  useEffect(() => {
    const checkStoredKeys = async () => {
      try {
        const hasSession = await KeyStorageService.hasKey(provider, 'session')
        const hasEncrypted = await KeyStorageService.hasKey(provider, 'encrypted')

        setHasStoredKey(hasSession || hasEncrypted)

        if (hasSession) {
          // Session storage - load immediately
          setStorageType('session')
          const key = await KeyStorageService.retrieveKey(provider, { storageType: 'session' })
          if (key) {
            setApiKey(key)
            langChainService.current.initialize({ apiKey: key, provider, model, temperature })
          }
        } else if (hasEncrypted) {
          // Encrypted storage - need password
          setStorageType('encrypted')
          setNeedsPassword(true)
        }
      } catch (error) {
        console.error('Error checking stored keys:', error)
      }
    }

    checkStoredKeys()
  }, [langChainService, provider, model, temperature])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSaveConfig = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key')
      return
    }

    try {
      setError(null)

      // Store the API key
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

      // Initialize the service
      langChainService.current.initialize({
        apiKey,
        provider,
        model,
        temperature,
      })

      setHasStoredKey(true)
      setIsConfigOpen(false)

      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Hello! I'm your AI assistant for building Web Audio API graphs. I can help you create audio nodes, connect them, and build complete musical setups. Try asking me something like "create a slider that produces actual notes and it sounds" or "add a filter to control the brightness of the sound".`,
        timestamp: new Date(),
      }
      setMessages([welcomeMessage])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save configuration')
    }
  }

  const handleClearStorage = async () => {
    try {
      await KeyStorageService.removeKey(provider, 'session')
      await KeyStorageService.removeKey(provider, 'encrypted')
      setApiKey('')
      setEncryptionPassword('')
      setHasStoredKey(false)
      setNeedsPassword(false)
      setMessages([])
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to clear storage')
    }
  }

  const handleSendMessage = async () => {
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

    try {
      const response = await langChainService.current.processMessage(
        userMessage.content,
        store,
        messages
      )

      setMessages(prev => [...prev, response])

      // Execute actions if any
      if (response.actions && response.actions.length > 0) {
        await langChainService.current.executeActions(response.actions, store)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to process message')
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handlePasswordSubmit = async () => {
    if (!encryptionPassword.trim()) {
      setError('Please enter your encryption password')
      return
    }

    try {
      setError(null)
      const key = await KeyStorageService.retrieveKey(provider, {
        storageType: 'encrypted',
        password: encryptionPassword,
      })

      if (key) {
        setApiKey(key)
        langChainService.current.initialize({ apiKey: key, provider, model, temperature })
        setNeedsPassword(false)

        // Add welcome message
        const welcomeMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Hello! I'm your AI assistant for building Web Audio API graphs. I can help you create audio nodes, connect them, and build complete musical setups. Try asking me something like "create a slider that produces actual notes and it sounds" or "add a filter to control the brightness of the sound".`,
          timestamp: new Date(),
        }
        setMessages([welcomeMessage])
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to decrypt key. Please check your password.'
      )
    }
  }

  const handlePasswordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handlePasswordSubmit()
    }
  }

  useEffect(() => {
    if (isOpen && !isConfigOpen && langChainService.current.isInitialized()) {
      // Use a small delay to ensure the input is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, isConfigOpen])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-105 z-50"
        title="Open AI Assistant"
      >
        <span className="text-lg font-bold">AI</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50 select-text">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-600 text-white rounded-t-lg">
        <h3 className="font-semibold">AI Assistant (mega alpha)</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConfigOpen(true)}
            className="p-1 hover:bg-blue-700 rounded"
            title="Settings"
          >
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
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-blue-700 rounded"
            title="Close"
          >
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

      {/* Configuration Modal */}
      {isConfigOpen && (
        <div className="absolute inset-0 bg-white rounded-lg z-10 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">AI Configuration</h3>
            <button
              onClick={() => setIsConfigOpen(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
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

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {/* Privacy Notice */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-600 mt-0.5 mr-2 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <div>
                  <h4 className="font-semibold text-green-800 text-sm">
                    🔒 Your Privacy is Protected
                  </h4>
                  <p className="text-green-700 text-xs mt-1">
                    <strong>We NEVER store your API keys on our servers.</strong> All keys are
                    stored locally in your browser using encryption. You can choose temporary
                    session storage or encrypted permanent storage with your own password.
                  </p>
                </div>
              </div>
            </div>

            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value as 'openai' | 'anthropic' | 'google')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="google">Google (Gemini)</option>
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={`Enter your ${provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Google'} API key`}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from:{' '}
                {provider === 'openai' && (
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    OpenAI Platform
                  </a>
                )}
                {provider === 'anthropic' && (
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Anthropic Console
                  </a>
                )}
                {provider === 'google' && (
                  <a
                    href="https://makersuite.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Google AI Studio
                  </a>
                )}
              </p>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {modelOptions[provider].map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature: {temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>More Focused</span>
                <span>More Creative</span>
              </div>
            </div>

            {/* Storage Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Storage Type</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="session"
                    checked={storageType === 'session'}
                    onChange={e => setStorageType(e.target.value as 'session')}
                    className="mr-2"
                  />
                  <span className="text-sm">Session only (cleared when browser closes)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="encrypted"
                    checked={storageType === 'encrypted'}
                    onChange={e => setStorageType(e.target.value as 'encrypted')}
                    className="mr-2"
                  />
                  <span className="text-sm">Encrypted permanent storage</span>
                </label>
              </div>
            </div>

            {/* Encryption Password */}
            {storageType === 'encrypted' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Encryption Password
                </label>
                <input
                  type="password"
                  value={encryptionPassword}
                  onChange={e => setEncryptionPassword(e.target.value)}
                  placeholder="Enter a password to encrypt your API key"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This password encrypts your API key locally. If you forget it, you'll need to
                  re-enter your API key.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              onClick={handleSaveConfig}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
            >
              Save Configuration
            </button>
            {hasStoredKey && (
              <button
                onClick={handleClearStorage}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors"
              >
                Clear Stored Keys
              </button>
            )}
          </div>
        </div>
      )}

      {/* Password Prompt for Encrypted Keys */}
      {needsPassword && !isConfigOpen && (
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
              Your {provider} API key is encrypted. Please enter your password to unlock it.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <input
                type="password"
                value={encryptionPassword}
                onChange={e => setEncryptionPassword(e.target.value)}
                onKeyPress={handlePasswordKeyPress}
                placeholder="Enter your encryption password"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={handlePasswordSubmit}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
              >
                Unlock
              </button>
              <button
                onClick={() => {
                  setNeedsPassword(false)
                  setIsConfigOpen(true)
                  setEncryptionPassword('')
                  setError(null)
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-md transition-colors"
              >
                Use Different Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Content */}
      {!isConfigOpen && !needsPassword && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!langChainService.current.isInitialized() ? (
              <div className="text-center text-gray-500 mt-8">
                <p className="mb-4">Configure your AI assistant to get started</p>
                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
                >
                  Open Settings
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>What do you want to build?</p>
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div
                      className="text-sm whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-2 text-xs opacity-75">
                        Executed {message.actions.length} action(s)
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            {error && (
              <div className="mb-2 bg-red-50 border border-red-200 rounded-md p-2">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  langChainService.current.isInitialized()
                    ? 'Ask me to create audio nodes...'
                    : 'Configure AI first'
                }
                disabled={!langChainService.current.isInitialized() || isLoading}
                className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                ref={inputRef}
              />
              <button
                onClick={handleSendMessage}
                disabled={
                  !langChainService.current.isInitialized() || isLoading || !inputMessage.trim()
                }
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-2 rounded-md transition-colors"
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
        </>
      )}
    </div>
  )
})

export default AIChat
