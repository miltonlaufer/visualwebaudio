/**
 * Domain Layer
 *
 * Contains pure business logic and domain models.
 * This layer has no dependencies on React, MobX stores, or UI concerns.
 *
 * Modules:
 * - music: MIDI and scale conversion utilities
 * - nodes: Node strategies and registry
 * - audio: Audio connection facade
 */

// Re-export all domain modules
export * from './music'
export * from './nodes'
export * from './audio'
