import modelsConfigJson from './models.config.json'
import type { ModelsConfig, ProviderId, ProviderConfig, ModelInfo } from './models.types'

export type {
  ModelsConfig,
  ProviderId,
  ProviderConfig,
  ModelInfo,
  ProviderState,
} from './models.types'

// Type-safe config export
export const modelsConfig: ModelsConfig = modelsConfigJson as ModelsConfig

/**
 * Get all available provider IDs
 */
export function getProviderIds(): ProviderId[] {
  return Object.keys(modelsConfig.providers) as ProviderId[]
}

/**
 * Get provider configuration by ID
 */
export function getProviderConfig(providerId: ProviderId): ProviderConfig {
  return modelsConfig.providers[providerId]
}

/**
 * Get default models for a provider
 */
export function getDefaultModels(providerId: ProviderId): ModelInfo[] {
  return modelsConfig.providers[providerId].defaultModels
}

/**
 * Check if a provider requires an API key
 */
export function requiresApiKey(providerId: ProviderId): boolean {
  return modelsConfig.providers[providerId].requiresApiKey
}

/**
 * Check if a provider supports dynamic model fetching
 */
export function supportsModelFetch(providerId: ProviderId): boolean {
  return modelsConfig.providers[providerId].supportsModelFetch
}
