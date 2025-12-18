/**
 * Type definitions for the AI models configuration
 */

export interface ModelInfo {
  id: string
  name: string
  supportsTools: boolean
  description?: string
  contextLength?: number
}

export interface ProviderConfig {
  name: string
  apiKeyUrl?: string
  baseUrl?: string
  modelsEndpoint?: string
  supportsModelFetch: boolean
  requiresApiKey: boolean
  openaiCompatible?: boolean
  instructions?: string
  defaultModels: ModelInfo[]
}

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'xai'
  | 'openrouter'
  | 'ollama'

export interface ModelsConfig {
  providers: Record<ProviderId, ProviderConfig>
}

/**
 * Runtime model state (may differ from config due to dynamic fetching)
 */
export interface ProviderState {
  providerId: ProviderId
  config: ProviderConfig
  models: ModelInfo[]
  isLoading: boolean
  lastFetched: Date | null
  error: string | null
}
