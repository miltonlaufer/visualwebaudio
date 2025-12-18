/**
 * Unified LLM Provider Service
 * Provides a consistent interface for all supported LLM providers
 */
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatXAI } from '@langchain/xai'
import { ChatOllama } from '@langchain/ollama'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { StructuredToolInterface } from '@langchain/core/tools'

import { type ProviderId, type ModelInfo, getProviderConfig } from '~/config'
import {
  fetchModels,
  validateApiKey,
  getCachedModels,
  clearModelCache,
} from './ModelFetcherService'

export interface LLMProviderConfig {
  providerId: ProviderId
  apiKey?: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface LLMProviderState {
  isInitialized: boolean
  providerId: ProviderId | null
  model: string | null
  supportsTools: boolean
  error: string | null
}

type ChatModel = BaseChatModel

/**
 * Create a chat model instance for the given provider
 */
function createChatModel(config: LLMProviderConfig): ChatModel {
  const providerConfig = getProviderConfig(config.providerId)
  const temperature = config.temperature ?? 0.7
  const maxTokens = config.maxTokens ?? 4096

  // Validate API key for providers that require it
  if (providerConfig.requiresApiKey && !config.apiKey?.trim()) {
    throw new Error(`API key is required for ${providerConfig.name}`)
  }

  switch (config.providerId) {
    case 'openai':
      return new ChatOpenAI({
        apiKey: config.apiKey!,
        model: config.model,
        temperature,
        maxTokens,
      })

    case 'anthropic':
      return new ChatAnthropic({
        apiKey: config.apiKey!,
        model: config.model,
        temperature,
        maxTokens,
      })

    case 'google':
      return new ChatGoogleGenerativeAI({
        apiKey: config.apiKey!,
        model: config.model,
        temperature,
        maxOutputTokens: maxTokens,
      })

    case 'deepseek':
      // DeepSeek uses OpenAI-compatible API
      return new ChatOpenAI({
        apiKey: config.apiKey!,
        model: config.model,
        temperature,
        maxTokens,
        configuration: {
          baseURL: providerConfig.baseUrl || 'https://api.deepseek.com/v1',
        },
      })

    case 'xai':
      return new ChatXAI({
        apiKey: config.apiKey!,
        model: config.model,
        temperature,
        maxTokens,
      })

    case 'openrouter':
      // OpenRouter uses OpenAI-compatible API
      return new ChatOpenAI({
        apiKey: config.apiKey!,
        model: config.model,
        temperature,
        maxTokens,
        configuration: {
          baseURL: providerConfig.baseUrl || 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Visual Web Audio',
          },
        },
      })

    case 'ollama':
      return new ChatOllama({
        baseUrl: providerConfig.baseUrl || 'http://localhost:11434',
        model: config.model,
        temperature,
      })

    default:
      throw new Error(`Unsupported provider: ${config.providerId}`)
  }
}

/**
 * LLM Provider Service class
 * Manages LLM initialization, model selection, and tool binding
 */
export class LLMProviderService {
  private chatModel: ChatModel | null = null
  private config: LLMProviderConfig | null = null
  private _supportsTools = false

  /******************* INITIALIZATION ***********************/

  /**
   * Initialize the provider with configuration
   */
  initialize(config: LLMProviderConfig): void {
    this.config = config
    this.chatModel = createChatModel(config)
    this._supportsTools = this.checkToolSupport(config.providerId, config.model)
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.chatModel !== null && this.config !== null
  }

  /**
   * Get current state
   */
  getState(): LLMProviderState {
    return {
      isInitialized: this.isInitialized(),
      providerId: this.config?.providerId ?? null,
      model: this.config?.model ?? null,
      supportsTools: this._supportsTools,
      error: null,
    }
  }

  /******************* MODEL MANAGEMENT ***********************/

  /**
   * Get the raw chat model (for advanced use)
   */
  getChatModel(): ChatModel | null {
    return this.chatModel
  }

  /**
   * Get chat model with tools bound
   */
  getChatModelWithTools(tools: StructuredToolInterface[]): ChatModel {
    if (!this.chatModel) {
      throw new Error('Provider not initialized')
    }

    if (!this._supportsTools) {
      console.warn('Provider/model does not support tools, returning base model')
      return this.chatModel
    }

    // bindTools returns a Runnable, cast to ChatModel for compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boundModel = (this.chatModel as any).bindTools(tools)
    return boundModel as ChatModel
  }

  /**
   * Check if current model supports tool calling
   */
  get supportsTools(): boolean {
    return this._supportsTools
  }

  /**
   * Check tool support for a specific provider/model
   */
  private checkToolSupport(providerId: ProviderId, modelId: string): boolean {
    // Check cached models first
    const cachedModels = getCachedModels(providerId)
    if (cachedModels) {
      const model = cachedModels.find(m => m.id === modelId)
      if (model) return model.supportsTools
    }

    // Fall back to default models
    const providerConfig = getProviderConfig(providerId)
    const defaultModel = providerConfig.defaultModels.find(m => m.id === modelId)
    if (defaultModel) return defaultModel.supportsTools

    // Guess based on model ID
    return this.guessToolSupport(modelId)
  }

  /**
   * Guess tool support based on model name patterns
   */
  private guessToolSupport(modelId: string): boolean {
    const lowerModelId = modelId.toLowerCase()

    // Known non-tool models
    const noToolPatterns = ['reasoner', 'o1-preview', 'o1-mini', 'embedding', 'whisper']
    if (noToolPatterns.some(p => lowerModelId.includes(p))) {
      return false
    }

    // Most modern chat models support tools
    return true
  }

  /******************* STATIC HELPERS ***********************/

  /**
   * Fetch available models for a provider
   */
  static async fetchModels(providerId: ProviderId, apiKey?: string): Promise<ModelInfo[]> {
    return fetchModels(providerId, apiKey)
  }

  /**
   * Refresh models (force fetch)
   */
  static async refreshModels(providerId: ProviderId, apiKey?: string): Promise<ModelInfo[]> {
    return fetchModels(providerId, apiKey, true)
  }

  /**
   * Validate an API key
   */
  static async validateApiKey(providerId: ProviderId, apiKey: string): Promise<boolean> {
    return validateApiKey(providerId, apiKey)
  }

  /**
   * Clear model cache
   */
  static clearCache(providerId?: ProviderId): void {
    clearModelCache(providerId)
  }
}
