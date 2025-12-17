/**
 * Nodes Domain Module
 *
 * Provides node-related domain logic including:
 * - Node strategies (behavior patterns for each node type)
 * - Node registry (centralized metadata access)
 */

// Re-export strategies
export * from './strategies'

// Re-export node registry
export { NodeRegistry, getAllNodesMetadata, type NodeCategory, type NodeInfo } from './NodeRegistry'
