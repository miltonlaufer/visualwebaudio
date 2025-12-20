/**
 * Service for dynamically fetching models from provider APIs
 */
import { type ProviderId, type ModelInfo, getProviderConfig, getDefaultModels } from '~/config'

interface OpenAIModelResponse {
  data: Array<{
    id: string
    object: string
    created?: number
    owned_by?: string
  }>
}

interface OpenRouterModelResponse {
  data: Array<{
    id: string
    name: string
    description?: string
    context_length?: number
    pricing?: {
      prompt: string
      completion: string
    }
  }>
}

interface OllamaTagsResponse {
  models: Array<{
    name: string
    model: string
    modified_at: string
    size: number
    digest: string
    details?: {
      parameter_size?: string
      quantization_level?: string
    }
  }>
}

// Cache for fetched models
const modelCache = new Map<ProviderId, { models: ModelInfo[]; timestamp: number }>()
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Check if cached models are still valid
 */
function isCacheValid(providerId: ProviderId): boolean {
  const cached = modelCache.get(providerId)
  if (!cached) return false
  return Date.now() - cached.timestamp < CACHE_DURATION_MS
}

/**
 * Get cached models if available and valid
 */
export function getCachedModels(providerId: ProviderId): ModelInfo[] | null {
  if (isCacheValid(providerId)) {
    return modelCache.get(providerId)!.models
  }
  return null
}

/**
 * Clear cached models for a provider
 */
export function clearModelCache(providerId?: ProviderId): void {
  if (providerId) {
    modelCache.delete(providerId)
  } else {
    modelCache.clear()
  }
}

/**
 * Fetch models from OpenAI-compatible API
 */
async function fetchOpenAICompatibleModels(
  baseUrl: string,
  apiKey: string,
  filterFn?: (model: { id: string }) => boolean
): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
  }

  const data: OpenAIModelResponse = await response.json()

  let models = data.data
  if (filterFn) {
    models = models.filter(filterFn)
  }

  return models.map(model => ({
    id: model.id,
    name: formatModelName(model.id),
    supportsTools: guessToolSupport(model.id),
  }))
}

/**
 * Fetch models from OpenRouter API (public, no auth required for listing)
 */
async function fetchOpenRouterModels(apiKey?: string): Promise<ModelInfo[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // API key is optional for listing models but helps with rate limits
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const response = await fetch('https://openrouter.ai/api/v1/models', { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenRouter models: ${response.status}`)
  }

  const data: OpenRouterModelResponse = await response.json()

  // Filter to only include popular/recommended models to avoid overwhelming the UI
  const popularPrefixes = [
    'openai/',
    'anthropic/',
    'google/',
    'meta-llama/',
    'mistralai/',
    'deepseek/',
    'cohere/',
  ]

  const filteredModels = data.data.filter(model =>
    popularPrefixes.some(prefix => model.id.startsWith(prefix))
  )

  return filteredModels.slice(0, 50).map(model => ({
    id: model.id,
    name: model.name || formatModelName(model.id),
    supportsTools: guessToolSupport(model.id),
    description: model.description,
    contextLength: model.context_length,
  }))
}

/**
 * Fetch models from Ollama local API
 */
async function fetchOllamaModels(): Promise<ModelInfo[]> {
  const config = getProviderConfig('ollama')
  const baseUrl = config.baseUrl || 'http://localhost:11434'

  const response = await fetch(`${baseUrl}/api/tags`, {
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Failed to connect to Ollama: ${response.status}`)
  }

  const data: OllamaTagsResponse = await response.json()

  return data.models.map(model => ({
    id: model.name,
    name: formatModelName(model.name),
    supportsTools: guessToolSupport(model.name),
    description: model.details?.parameter_size
      ? `${model.details.parameter_size} parameters`
      : undefined,
  }))
}

/**
 * Format model ID into human-readable name
 */
function formatModelName(modelId: string): string {
  // Remove provider prefix for OpenRouter models
  let name = modelId.includes('/') ? modelId.split('/').pop()! : modelId

  // Common transformations
  name = name
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/(\d+)([a-z])/gi, '$1 $2')
    .replace(/([a-z])(\d)/gi, '$1 $2')

  // Capitalize words
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Guess if a model supports tool calling based on its ID
 */
function guessToolSupport(modelId: string): boolean {
  const lowerModelId = modelId.toLowerCase()

  // Models known to NOT support tools (check these FIRST)
  const noToolSupport = [
    'deepseek-reasoner',
    'deepseek-r1',
    'o1-preview',
    'o1-mini',
    'text-davinci',
    'code-davinci',
    'text-embedding',
    'embedding',
    'whisper',
    'tts',
    'dall-e',
    'realtime', // realtime models use different API
    'audio',
    'image',
    'codex', // codex models don't support tools
    'search-api', // search models
  ]

  if (noToolSupport.some(pattern => lowerModelId.includes(pattern))) {
    return false
  }

  // Modern chat models that support tools
  const toolSupportPatterns = [
    // OpenAI GPT models (all versions)
    'gpt-5',
    'gpt-4',
    'gpt-3.5-turbo',
    'o4', // o4 reasoning models
    'o3', // o3 reasoning models
    'chatgpt',
    // Anthropic
    'claude',
    // Google
    'gemini',
    // Meta
    'llama-4',
    'llama-3',
    'llama4',
    'llama3',
    // Mistral
    'mistral',
    'mixtral',
    // DeepSeek (chat, not reasoner)
    'deepseek-chat',
    'deepseek-v',
    // xAI
    'grok',
    // Cohere
    'command',
    // Qwen
    'qwen',
    // Phi
    'phi',
  ]

  return toolSupportPatterns.some(pattern => lowerModelId.includes(pattern))
}

/**
 * Filter function for OpenAI models - only include chat models
 */
function filterOpenAIModels(model: { id: string }): boolean {
  const id = model.id.toLowerCase()

  // Exclude non-chat models first
  const excludePatterns = [
    'embedding',
    'whisper',
    'tts',
    'dall-e',
    'audio',
    'moderation',
    'babbage',
    'davinci',
    'curie',
    'ada',
  ]

  if (excludePatterns.some(pattern => id.includes(pattern))) {
    return false
  }

  // Include chat/completion models
  const includePrefixes = ['gpt-5', 'gpt-4', 'gpt-3.5', 'o4-', 'o3-', 'o1-', 'chatgpt-']

  return includePrefixes.some(prefix => id.startsWith(prefix))
}

/**
 * Filter function for DeepSeek models
 */
function filterDeepSeekModels(model: { id: string }): boolean {
  const id = model.id.toLowerCase()
  return id.includes('deepseek-chat') || id.includes('deepseek-reasoner')
}

/**
 * Filter function for xAI models
 */
function filterXAIModels(model: { id: string }): boolean {
  const id = model.id.toLowerCase()
  return id.includes('grok')
}

/**
 * Main function to fetch models for a provider
 */
export async function fetchModels(
  providerId: ProviderId,
  apiKey?: string,
  forceRefresh = false
): Promise<ModelInfo[]> {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedModels(providerId)
    if (cached) return cached
  }

  const config = getProviderConfig(providerId)

  // If provider doesn't support fetching, return defaults
  if (!config.supportsModelFetch) {
    return getDefaultModels(providerId)
  }

  // If API key is required but not provided, return defaults
  if (config.requiresApiKey && !apiKey) {
    return getDefaultModels(providerId)
  }

  try {
    let models: ModelInfo[]

    switch (providerId) {
      case 'openai':
        models = await fetchOpenAICompatibleModels(
          config.baseUrl || 'https://api.openai.com/v1',
          apiKey!,
          filterOpenAIModels
        )
        break

      case 'deepseek':
        models = await fetchOpenAICompatibleModels(
          config.baseUrl || 'https://api.deepseek.com/v1',
          apiKey!,
          filterDeepSeekModels
        )
        break

      case 'xai':
        models = await fetchOpenAICompatibleModels(
          config.baseUrl || 'https://api.x.ai/v1',
          apiKey!,
          filterXAIModels
        )
        break

      case 'openrouter':
        models = await fetchOpenRouterModels(apiKey)
        break

      case 'ollama':
        models = await fetchOllamaModels()
        break

      default:
        // For providers without custom fetch logic, return defaults
        return getDefaultModels(providerId)
    }

    // If no models returned, fall back to defaults
    if (models.length === 0) {
      models = getDefaultModels(providerId)
    }

    // Cache the results
    modelCache.set(providerId, { models, timestamp: Date.now() })

    return models
  } catch (error) {
    console.warn(`Failed to fetch models for ${providerId}:`, error)
    // Return defaults on error
    return getDefaultModels(providerId)
  }
}

/**
 * Validate an API key by attempting to fetch models
 */
export async function validateApiKey(providerId: ProviderId, apiKey: string): Promise<boolean> {
  const config = getProviderConfig(providerId)

  if (!config.requiresApiKey) {
    return true // No validation needed
  }

  if (!config.supportsModelFetch) {
    // For providers without model fetch, try a simple API call
    // For now, assume the key is valid if it's non-empty
    return apiKey.length > 0
  }

  try {
    const models = await fetchModels(providerId, apiKey, true)
    return models.length > 0
  } catch {
    return false
  }
}
