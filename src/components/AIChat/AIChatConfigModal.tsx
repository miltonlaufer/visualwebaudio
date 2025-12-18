/**
 * AI Chat Configuration Modal
 */

import React, { useCallback } from 'react'
import { type ProviderId, type ModelInfo, getProviderIds, getProviderConfig } from '~/config'

/******************* TYPES ***********************/

interface AIChatConfigModalProps {
  // State
  provider: ProviderId
  model: string
  temperature: number
  apiKey: string
  storageType: 'session' | 'encrypted'
  encryptionPassword: string
  availableModels: ModelInfo[]
  isLoadingModels: boolean
  isValidatingKey: boolean
  hasStoredKey: boolean
  error: string | null
  // Callbacks
  onProviderChange: (provider: ProviderId) => void
  onModelChange: (model: string) => void
  onTemperatureChange: (temp: number) => void
  onApiKeyChange: (key: string) => void
  onStorageTypeChange: (type: 'session' | 'encrypted') => void
  onEncryptionPasswordChange: (password: string) => void
  onRefreshModels: () => void
  onValidateApiKey: () => void
  onSave: () => void
  onClearStorage: () => void
  onClose: () => void
}

/******************* COMPONENT ***********************/

const AIChatConfigModal: React.FC<AIChatConfigModalProps> = ({
  provider,
  model,
  temperature,
  apiKey,
  storageType,
  encryptionPassword,
  availableModels,
  isLoadingModels,
  isValidatingKey,
  hasStoredKey,
  error,
  onProviderChange,
  onModelChange,
  onTemperatureChange,
  onApiKeyChange,
  onStorageTypeChange,
  onEncryptionPasswordChange,
  onRefreshModels,
  onValidateApiKey,
  onSave,
  onClearStorage,
  onClose,
}) => {
  const providerIds = getProviderIds()
  const currentProviderConfig = getProviderConfig(provider)
  const currentModelInfo = availableModels.find(m => m.id === model)

  /******************* HANDLERS ***********************/

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onProviderChange(e.target.value as ProviderId)
    },
    [onProviderChange]
  )

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onModelChange(e.target.value)
    },
    [onModelChange]
  )

  const handleTemperatureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onTemperatureChange(parseFloat(e.target.value))
    },
    [onTemperatureChange]
  )

  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onApiKeyChange(e.target.value)
    },
    [onApiKeyChange]
  )

  const handleStorageTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onStorageTypeChange(e.target.value as 'session' | 'encrypted')
    },
    [onStorageTypeChange]
  )

  const handleEncryptionPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onEncryptionPasswordChange(e.target.value)
    },
    [onEncryptionPasswordChange]
  )

  /******************* RENDER ***********************/

  return (
    <div className="absolute inset-0 bg-white rounded-lg z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">AI Configuration</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
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

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Privacy Notice */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-start">
            <svg
              className="w-4 h-4 text-green-600 mt-0.5 mr-2 flex-shrink-0"
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
              <h4 className="font-semibold text-green-800 text-xs">Your Privacy is Protected</h4>
              <p className="text-green-700 text-xs mt-0.5">
                API keys are stored locally in your browser, never on our servers.
              </p>
            </div>
          </div>
        </div>

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
          <select
            value={provider}
            onChange={handleProviderChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            {providerIds.map(id => {
              const config = getProviderConfig(id)
              return (
                <option key={id} value={id}>
                  {config.name}
                </option>
              )
            })}
          </select>
        </div>

        {/* Provider Instructions */}
        {currentProviderConfig.instructions && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-blue-800 text-xs">{currentProviderConfig.instructions}</p>
            {currentProviderConfig.apiKeyUrl && (
              <a
                href={currentProviderConfig.apiKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs mt-1 inline-block"
              >
                Browse available models
              </a>
            )}
          </div>
        )}

        {/* API Key */}
        {currentProviderConfig.requiresApiKey && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={handleApiKeyChange}
                onBlur={onValidateApiKey}
                placeholder={`Enter your ${currentProviderConfig.name} API key`}
                className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              {isValidatingKey && (
                <div className="flex items-center px-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            {currentProviderConfig.apiKeyUrl && (
              <p className="text-xs text-gray-500 mt-1">
                Get your API key from:{' '}
                <a
                  href={currentProviderConfig.apiKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {currentProviderConfig.name}
                </a>
              </p>
            )}
          </div>
        )}

        {/* Model Selection */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Model</label>
            <button
              onClick={onRefreshModels}
              disabled={isLoadingModels}
              className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 flex items-center gap-1"
              title="Refresh models from API"
            >
              <svg
                className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
          <select
            value={model}
            onChange={handleModelChange}
            disabled={isLoadingModels}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} {m.supportsTools ? '' : '(no tools)'}
              </option>
            ))}
          </select>
          {currentModelInfo && !currentModelInfo.supportsTools && (
            <p className="text-xs text-amber-600 mt-1">
              This model doesn't support tool calling. Using JSON fallback mode.
            </p>
          )}
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Temperature: {temperature}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={handleTemperatureChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>More Focused</span>
            <span>More Creative</span>
          </div>
        </div>

        {/* Storage Type */}
        {currentProviderConfig.requiresApiKey && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Storage Type</label>
            <div className="space-y-1">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="session"
                  checked={storageType === 'session'}
                  onChange={handleStorageTypeChange}
                  className="mr-2"
                />
                <span className="text-sm">Session only (cleared when browser closes)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="encrypted"
                  checked={storageType === 'encrypted'}
                  onChange={handleStorageTypeChange}
                  className="mr-2"
                />
                <span className="text-sm">Encrypted permanent storage</span>
              </label>
            </div>
          </div>
        )}

        {/* Encryption Password */}
        {storageType === 'encrypted' && currentProviderConfig.requiresApiKey && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Encryption Password
            </label>
            <input
              type="password"
              value={encryptionPassword}
              onChange={handleEncryptionPasswordChange}
              placeholder="Enter a password to encrypt your API key"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              This password encrypts your API key locally.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-2">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={onSave}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors text-sm"
        >
          Save Configuration
        </button>
        {hasStoredKey && (
          <button
            onClick={onClearStorage}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors text-sm"
          >
            Clear Stored Keys
          </button>
        )}
      </div>
    </div>
  )
}

export default AIChatConfigModal
