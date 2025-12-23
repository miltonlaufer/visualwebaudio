/**
 * ID Generation Utilities
 *
 * Centralized ID generation for consistent and maintainable ID formats across the app.
 */

/**
 * Generates a unique random string suffix using timestamp and random characters.
 * Format: {timestamp}_{randomChars}
 */
export function generateUniqueIdSuffix(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Generates a unique ID for user-created composite node definitions.
 * Format: user_{timestamp}_{randomChars}
 */
export function generateCompositeNodeId(): string {
  return `user_${generateUniqueIdSuffix()}`
}

/**
 * Generates a unique ID for copied/pasted nodes.
 * Format: {originalId}_copy_{timestamp}_{index}
 */
export function generateCopiedNodeId(
  originalId: string,
  index: number,
  timestamp?: number
): string {
  const ts = timestamp ?? Date.now()
  return `${originalId}_copy_${ts}_${index}`
}

/**
 * Generates a unique ID for a node based on its type.
 * Format: {nodeType}-{timestamp}-{counter}
 */
export function generateNodeIdFromType(nodeType: string, counter: number): string {
  return `${nodeType}-${Date.now()}-${counter}`
}
