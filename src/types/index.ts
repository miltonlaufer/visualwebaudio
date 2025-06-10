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
