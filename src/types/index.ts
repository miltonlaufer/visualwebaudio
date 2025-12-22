// Web Audio Node Metadata Types
export interface NodeInput {
  name: string
  type: 'audio' | 'control'
}

export interface NodeOutput {
  name: string
  type: 'audio' | 'control'
}

export interface NodeProperty {
  name: string
  type: string
  defaultValue: unknown
  min?: number
  max?: number
}

import type { INodeMetadata } from '~/stores/NodeModels'

// Visual Node Types for React Flow
export interface VisualNodeData {
  nodeType: string
  metadata: INodeMetadata
  audioNode?: AudioNode
  properties: Map<string, unknown>
}

export interface VisualNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: VisualNodeData
}

export interface VisualEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

// Audio Graph Types
export interface AudioConnection {
  sourceNodeId: string
  targetNodeId: string
  sourceOutput: string
  targetInput: string
}

export interface AudioGraph {
  nodes: Map<string, AudioNode>
  connections: AudioConnection[]
  context: AudioContext
}

// Store Types
export interface AppState {
  adaptedNodes: VisualNode[]
  visualEdges: VisualEdge[]
  audioGraph: AudioGraph
  selectedNodeId: string | null
  isPlaying: boolean
}

/******************* COMPOSITE NODE TYPES ***********************/

export interface CompositeNodePort {
  id: string
  name: string
  type: 'audio' | 'control'
  description?: string
}

export interface SerializedNodeProperty {
  name: string
  value: unknown
}

export interface SerializedNode {
  id: string
  nodeType: string
  position: { x: number; y: number }
  properties: SerializedNodeProperty[]
}

export interface SerializedEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface SerializedConnection {
  sourceNodeId: string
  targetNodeId: string
  sourceOutput: string
  targetInput: string
}

export interface CompositeNodeInternalGraph {
  nodes: SerializedNode[]
  edges: SerializedEdge[]
  connections: SerializedConnection[]
}

export interface CompositeNodeDefinition {
  id: string
  name: string
  description: string
  category: 'composite' | 'user-composite'
  isPrebuilt: boolean
  inputs: CompositeNodePort[]
  outputs: CompositeNodePort[]
  internalGraph: CompositeNodeInternalGraph
  createdAt?: Date
  updatedAt?: Date
}

export interface SavedCompositeNode {
  id?: number
  definitionId: string
  name: string
  description: string
  inputs: CompositeNodePort[]
  outputs: CompositeNodePort[]
  internalGraph: string // JSON string of CompositeNodeInternalGraph
  createdAt: Date
  updatedAt: Date
}
