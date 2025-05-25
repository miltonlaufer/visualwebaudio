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

export interface NodeMetadata {
  name: string
  description: string
  category: 'source' | 'effect' | 'destination' | 'analysis' | 'processing' | 'context'
  inputs: Array<{ name: string; type: 'audio' | 'control' }>
  outputs: Array<{ name: string; type: 'audio' | 'control' }>
  properties: Array<{
    name: string
    type: string
    defaultValue: unknown
    min?: number
    max?: number
  }>
  methods: string[]
  events: string[]
}

// Visual Node Types for React Flow
export interface VisualNodeData {
  nodeType: string
  metadata: NodeMetadata
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
  visualNodes: VisualNode[]
  visualEdges: VisualEdge[]
  audioGraph: AudioGraph
  selectedNodeId: string | null
  isPlaying: boolean
}
