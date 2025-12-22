/**
 * Node Registry
 *
 * Single source of truth for all node metadata in the application.
 * Combines Web Audio API metadata and custom node metadata into a unified registry.
 *
 * This implements the Repository Pattern to:
 * - Provide centralized access to node metadata
 * - Abstract the source of metadata (JSON files)
 * - Enable easy extension with new node types
 */

import type { INodeMetadata } from '~/stores/NodeModels'
import webAudioMetadata from '~/types/web-audio-metadata.json'
import customNodesMetadata from '~/types/custom-nodes-metadata.json'
import { isCustomNodeType, type CustomNodeType, CUSTOM_NODE_TYPES } from './strategies'
import type { CompositeNodeDefinition } from '~/types'

/******************* TYPES ***********************/

export type NodeCategory =
  | 'source'
  | 'destination'
  | 'effect'
  | 'analyzer'
  | 'control'
  | 'utility'
  | 'custom'
  | 'composite'
  | 'user-composite'

export interface NodeInfo {
  nodeType: string
  metadata: INodeMetadata
  category: NodeCategory
  isCustom: boolean
  isWebAudio: boolean
  isComposite: boolean
}

/******************* REGISTRY IMPLEMENTATION ***********************/

/**
 * NodeRegistry provides centralized access to all node metadata.
 * It lazily loads and caches metadata for efficient access.
 */
class NodeRegistryImpl {
  private metadataCache: Map<string, INodeMetadata> = new Map()
  private compositeNodeCache: Map<string, CompositeNodeDefinition> = new Map()
  private isInitialized = false

  /******************* INITIALIZATION ***********************/

  /**
   * Ensures the registry is initialized with all metadata
   */
  private ensureInitialized(): void {
    if (this.isInitialized) return

    // Load Web Audio metadata (cast through unknown to satisfy TypeScript)
    const webAudio = webAudioMetadata as unknown as Record<string, INodeMetadata>
    Object.entries(webAudio).forEach(([key, value]) => {
      this.metadataCache.set(key, value)
    })

    // Load custom node metadata (cast through unknown to satisfy TypeScript)
    const customNodes = customNodesMetadata as unknown as Record<string, INodeMetadata>
    Object.entries(customNodes).forEach(([key, value]) => {
      this.metadataCache.set(key, value)
    })

    this.isInitialized = true
  }

  /******************* METADATA ACCESS ***********************/

  /**
   * Gets metadata for a specific node type
   */
  getMetadata(nodeType: string): INodeMetadata | undefined {
    this.ensureInitialized()

    // Check if this is a composite node
    if (nodeType.startsWith('Composite_')) {
      const compositeId = nodeType.replace('Composite_', '')
      return this.getCompositeNodeMetadata(compositeId)
    }

    return this.metadataCache.get(nodeType)
  }

  /**
   * Generates metadata from a composite node definition
   * Returns a plain object that can be used like INodeMetadata
   */
  private getCompositeNodeMetadata(definitionId: string): INodeMetadata | undefined {
    const definition = this.compositeNodeCache.get(definitionId)
    if (!definition) return undefined

    // Return as 'any' since we're creating a plain object that mimics INodeMetadata
    // The actual MobX-state-tree model handles the real metadata for proper nodes
    return {
      name: definition.name,
      description: definition.description,
      category: definition.category as
        | 'source'
        | 'effect'
        | 'destination'
        | 'analysis'
        | 'processing'
        | 'context'
        | 'control'
        | 'logic'
        | 'input'
        | 'utility'
        | 'misc',
      inputs: definition.inputs.map(input => ({
        name: input.name,
        type: input.type as 'audio' | 'control',
      })),
      outputs: definition.outputs.map(output => ({
        name: output.name,
        type: output.type as 'audio' | 'control',
      })),
      properties: [
        {
          name: 'definitionId',
          type: 'string',
          defaultValue: definitionId,
          min: undefined,
          max: undefined,
          step: undefined,
          options: undefined,
          description: 'ID of the composite node definition',
          readOnly: true,
        },
      ],
      methods: [],
      events: [],
    } as unknown as INodeMetadata
  }

  /**
   * Gets metadata for all node types
   */
  getAllMetadata(): Record<string, INodeMetadata> {
    this.ensureInitialized()
    const result: Record<string, INodeMetadata> = {}
    this.metadataCache.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  /**
   * Checks if a node type exists in the registry
   */
  hasNodeType(nodeType: string): boolean {
    this.ensureInitialized()
    return this.metadataCache.has(nodeType)
  }

  /******************* NODE TYPE QUERIES ***********************/

  /**
   * Gets all registered node types
   */
  getNodeTypes(): string[] {
    this.ensureInitialized()
    return Array.from(this.metadataCache.keys())
  }

  /**
   * Gets all Web Audio node types
   */
  getWebAudioNodeTypes(): string[] {
    this.ensureInitialized()
    return Array.from(this.metadataCache.keys()).filter(type => !isCustomNodeType(type))
  }

  /**
   * Gets all custom node types
   */
  getCustomNodeTypes(): CustomNodeType[] {
    return [...CUSTOM_NODE_TYPES]
  }

  /**
   * Checks if a node type is a custom node
   */
  isCustomNode(nodeType: string): boolean {
    return isCustomNodeType(nodeType)
  }

  /**
   * Checks if a node type is a Web Audio node
   */
  isWebAudioNode(nodeType: string): boolean {
    this.ensureInitialized()
    return (
      this.metadataCache.has(nodeType) &&
      !isCustomNodeType(nodeType) &&
      !this.isCompositeNode(nodeType)
    )
  }

  /**
   * Checks if a node type is a composite node
   */
  isCompositeNode(nodeType: string): boolean {
    return nodeType.startsWith('Composite_')
  }

  /******************* COMPOSITE NODE MANAGEMENT ***********************/

  /**
   * Registers a composite node definition
   */
  registerCompositeNode(definition: CompositeNodeDefinition): void {
    this.compositeNodeCache.set(definition.id, definition)
  }

  /**
   * Unregisters a composite node definition
   */
  unregisterCompositeNode(definitionId: string): void {
    this.compositeNodeCache.delete(definitionId)
  }

  /**
   * Gets all registered composite node types
   */
  getCompositeNodeTypes(): string[] {
    return Array.from(this.compositeNodeCache.keys()).map(id => `Composite_${id}`)
  }

  /**
   * Gets a composite node definition by ID
   */
  getCompositeNodeDefinition(definitionId: string): CompositeNodeDefinition | undefined {
    return this.compositeNodeCache.get(definitionId)
  }

  /**
   * Registers multiple composite node definitions
   */
  registerCompositeNodes(definitions: CompositeNodeDefinition[]): void {
    definitions.forEach(def => this.registerCompositeNode(def))
  }

  /**
   * Clears all composite node registrations
   */
  clearCompositeNodes(): void {
    this.compositeNodeCache.clear()
  }

  /******************* CATEGORY QUERIES ***********************/

  /**
   * Gets the category for a node type
   */
  getCategory(nodeType: string): NodeCategory | undefined {
    const metadata = this.getMetadata(nodeType)
    return metadata?.category as NodeCategory | undefined
  }

  /**
   * Gets all node types for a specific category
   */
  getNodeTypesByCategory(category: NodeCategory): string[] {
    this.ensureInitialized()
    const result: string[] = []
    this.metadataCache.forEach((metadata, nodeType) => {
      if (metadata.category === category) {
        result.push(nodeType)
      }
    })
    return result
  }

  /**
   * Gets all unique categories
   */
  getCategories(): NodeCategory[] {
    this.ensureInitialized()
    const categories = new Set<NodeCategory>()
    this.metadataCache.forEach(metadata => {
      if (metadata.category) {
        categories.add(metadata.category as NodeCategory)
      }
    })
    return Array.from(categories)
  }

  /******************* NODE INFO ***********************/

  /**
   * Gets complete node info including type classification
   */
  getNodeInfo(nodeType: string): NodeInfo | undefined {
    const metadata = this.getMetadata(nodeType)
    if (!metadata) return undefined

    const isCustom = isCustomNodeType(nodeType)
    const isComposite = this.isCompositeNode(nodeType)

    return {
      nodeType,
      metadata,
      category: metadata.category as NodeCategory,
      isCustom,
      isWebAudio: !isCustom && !isComposite,
      isComposite,
    }
  }

  /******************* PROPERTY QUERIES ***********************/

  /**
   * Gets the properties for a node type
   */
  getProperties(nodeType: string): INodeMetadata['properties'] | undefined {
    const metadata = this.getMetadata(nodeType)
    return metadata?.properties
  }

  /**
   * Gets the inputs for a node type
   */
  getInputs(nodeType: string): INodeMetadata['inputs'] | undefined {
    const metadata = this.getMetadata(nodeType)
    return metadata?.inputs
  }

  /**
   * Gets the outputs for a node type
   */
  getOutputs(nodeType: string): INodeMetadata['outputs'] | undefined {
    const metadata = this.getMetadata(nodeType)
    return metadata?.outputs
  }

  /******************* DEFAULT VALUES ***********************/

  /**
   * Gets default property values for a node type
   */
  getDefaultProperties(nodeType: string): Record<string, unknown> {
    const properties = this.getProperties(nodeType)
    if (!properties) return {}

    const defaults: Record<string, unknown> = {}
    properties.forEach(prop => {
      defaults[prop.name] = prop.defaultValue
    })
    return defaults
  }
}

/******************* SINGLETON INSTANCE ***********************/

/**
 * Singleton instance of the node registry
 */
export const NodeRegistry = new NodeRegistryImpl()

/**
 * Helper function to get all node metadata (for backward compatibility)
 */
export function getAllNodesMetadata(): Record<string, INodeMetadata> {
  return NodeRegistry.getAllMetadata()
}
