import type { NodeMetadata } from '~/types'
import { AudioNodeFactory } from './AudioNodeFactory'
import { CustomNodeFactory, type CustomNode } from './CustomNodeFactory'

// Unified interface for all nodes (Web Audio API and custom)
export interface UnifiedNode {
  id: string
  type: string
  metadata: NodeMetadata
  properties: Map<string, any>

  // Connection methods
  connect(targetNode: UnifiedNode, outputName?: string, inputName?: string): void
  disconnect(targetNode?: UnifiedNode): void

  // Property management
  updateProperty(propertyName: string, value: any): void
  getProperty(propertyName: string): any

  // Lifecycle methods
  start?(): void
  stop?(): void
  cleanup(): void

  // UI integration (for custom nodes with UI elements)
  createUIElement?(container: HTMLElement): void

  // Internal access to the wrapped node
  getInternalNode(): AudioNode | CustomNode
}

// Adapter for Web Audio API nodes
export class WebAudioNodeAdapter implements UnifiedNode {
  id: string
  type: string
  metadata: NodeMetadata
  properties: Map<string, any> = new Map()

  private audioNode: AudioNode
  private audioNodeFactory: AudioNodeFactory
  private connections: Array<{ target: UnifiedNode; outputName?: string; inputName?: string }> = []

  constructor(
    id: string,
    type: string,
    metadata: NodeMetadata,
    audioNode: AudioNode,
    audioNodeFactory: AudioNodeFactory,
    initialProperties: Record<string, any> = {}
  ) {
    this.id = id
    this.type = type
    this.metadata = metadata
    this.audioNode = audioNode
    this.audioNodeFactory = audioNodeFactory

    // Initialize properties
    metadata.properties.forEach((prop: { name: string; defaultValue: any }) => {
      const value =
        initialProperties[prop.name] !== undefined
          ? initialProperties[prop.name]
          : prop.defaultValue
      this.properties.set(prop.name, value)
    })
  }

  connect(targetNode: UnifiedNode, outputName = 'output', inputName = 'input'): void {
    this.connections.push({ target: targetNode, outputName, inputName })

    const targetInternalNode = targetNode.getInternalNode()

    if (targetInternalNode instanceof AudioNode) {
      // Web Audio to Web Audio connection
      const targetInputDef = targetNode.metadata.inputs.find(input => input.name === inputName)

      if (targetInputDef?.type === 'control') {
        // Connect to AudioParam
        const targetNodeWithParams = targetInternalNode as unknown as Record<string, AudioParam>
        const audioParam = targetNodeWithParams[inputName]

        if (audioParam && typeof audioParam.value !== 'undefined') {
          this.audioNode.connect(audioParam)
        }
      } else {
        // Normal audio connection
        this.audioNode.connect(targetInternalNode)
      }
    } else {
      // Web Audio to Custom node connection
      // Custom nodes will handle this through their receiveInput method
      console.log(`Connected Web Audio node ${this.id} to custom node ${targetNode.id}`)
    }
  }

  disconnect(targetNode?: UnifiedNode): void {
    if (targetNode) {
      this.connections = this.connections.filter(conn => conn.target !== targetNode)
      // Disconnect specific target
      const targetInternalNode = targetNode.getInternalNode()
      if (targetInternalNode instanceof AudioNode) {
        this.audioNode.disconnect(targetInternalNode)
      }
    } else {
      // Disconnect all
      this.connections = []
      this.audioNode.disconnect()
    }
  }

  updateProperty(propertyName: string, value: any): void {
    this.properties.set(propertyName, value)

    // Try to update using the factory
    const success = this.audioNodeFactory.updateNodeProperty(
      this.audioNode,
      this.type,
      this.metadata,
      propertyName,
      value
    )

    if (!success) {
      console.warn(`Failed to update property ${propertyName} on Web Audio node ${this.type}`)
    }
  }

  getProperty(propertyName: string): any {
    return this.properties.get(propertyName)
  }

  start(): void {
    if ('start' in this.audioNode && typeof this.audioNode.start === 'function') {
      ;(this.audioNode as OscillatorNode | AudioBufferSourceNode).start()
    }
  }

  stop(): void {
    if ('stop' in this.audioNode && typeof this.audioNode.stop === 'function') {
      ;(this.audioNode as OscillatorNode | AudioBufferSourceNode).stop()
    }
  }

  cleanup(): void {
    this.disconnect()
    this.stop()
  }

  getInternalNode(): AudioNode {
    return this.audioNode
  }
}

// Adapter for custom nodes
export class CustomNodeAdapter implements UnifiedNode {
  id: string
  type: string
  metadata: NodeMetadata
  properties: Map<string, any> = new Map()

  private customNode: CustomNode
  private connections: Array<{ target: UnifiedNode; outputName?: string; inputName?: string }> = []

  constructor(id: string, type: string, metadata: NodeMetadata, customNode: CustomNode) {
    this.id = id
    this.type = type
    this.metadata = metadata
    this.customNode = customNode
    this.properties = customNode.properties
  }

  connect(targetNode: UnifiedNode, outputName = 'output', inputName = 'input'): void {
    this.connections.push({ target: targetNode, outputName, inputName })

    const targetInternalNode = targetNode.getInternalNode()

    if (targetInternalNode instanceof AudioNode) {
      // Custom to Web Audio connection
      console.log(`Connected custom node ${this.id} to Web Audio node ${targetNode.id}`)
      // Custom nodes will notify their connections when values change
    } else {
      // Custom to Custom connection
      this.customNode.connect(targetInternalNode as CustomNode, outputName, inputName)
    }
  }

  disconnect(targetNode?: UnifiedNode): void {
    if (targetNode) {
      this.connections = this.connections.filter(conn => conn.target !== targetNode)
    } else {
      this.connections = []
      this.customNode.disconnect()
    }
  }

  updateProperty(propertyName: string, value: any): void {
    this.properties.set(propertyName, value)

    // Update the custom node's property
    if (this.customNode.setValue && propertyName === 'value') {
      this.customNode.setValue(value)
    }
  }

  getProperty(propertyName: string): any {
    return this.properties.get(propertyName)
  }

  start(): void {
    // Custom nodes don't typically have start methods, but trigger might be similar
    if (this.customNode.trigger) {
      this.customNode.trigger()
    }
  }

  stop(): void {
    if ('stop' in this.customNode && typeof this.customNode.stop === 'function') {
      this.customNode.stop()
    }
  }

  cleanup(): void {
    this.disconnect()
    this.stop()
  }

  createUIElement(container: HTMLElement): void {
    if (
      'createUIElement' in this.customNode &&
      typeof this.customNode.createUIElement === 'function'
    ) {
      this.customNode.createUIElement(container)
    }
  }

  getInternalNode(): CustomNode {
    return this.customNode
  }
}

// Unified factory that creates adapters for any node type
export class UnifiedNodeFactory {
  private audioContext: AudioContext
  private audioNodeFactory: AudioNodeFactory
  private customNodeFactory: CustomNodeFactory

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.audioNodeFactory = new AudioNodeFactory(audioContext)
    this.customNodeFactory = new CustomNodeFactory(audioContext)
  }

  createNode(
    id: string,
    nodeType: string,
    metadata: NodeMetadata,
    properties: Record<string, any> = {}
  ): UnifiedNode {
    // Check if it's a custom node type
    if (this.customNodeFactory.isCustomNodeType(nodeType)) {
      const customNode = this.customNodeFactory.createCustomNode(nodeType, metadata, properties)
      return new CustomNodeAdapter(id, nodeType, metadata, customNode)
    } else {
      // Handle special cases for Web Audio API nodes
      if (nodeType === 'MediaStreamAudioSourceNode') {
        throw new Error(
          'MediaStreamAudioSourceNode requires special handling - use createMicrophoneNode instead'
        )
      }

      const audioNode = this.audioNodeFactory.createAudioNode(nodeType, metadata, properties)
      return new WebAudioNodeAdapter(
        id,
        nodeType,
        metadata,
        audioNode,
        this.audioNodeFactory,
        properties
      )
    }
  }

  createMicrophoneNode(id: string, metadata: NodeMetadata, mediaStream: MediaStream): UnifiedNode {
    const micSource = this.audioContext.createMediaStreamSource(mediaStream)
    return new WebAudioNodeAdapter(
      id,
      'MediaStreamAudioSourceNode',
      metadata,
      micSource,
      this.audioNodeFactory
    )
  }

  // Helper method to check if a node type is custom
  isCustomNodeType(nodeType: string): boolean {
    return this.customNodeFactory.isCustomNodeType(nodeType)
  }
}
