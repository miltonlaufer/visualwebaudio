import type { NodeMetadata } from '~/types'

export class AudioNodeFactory {
  constructor(private audioContext: AudioContext) {}

  createAudioNode(
    nodeType: string,
    metadata: NodeMetadata,
    properties: Record<string, unknown> = {}
  ): AudioNode {
    console.log(`Creating ${nodeType} with metadata-driven approach`)

    let audioNode: AudioNode

    // Handle special cases that require specific parameters or different creation methods
    switch (nodeType) {
      case 'AudioDestinationNode':
        audioNode = this.audioContext.destination
        break
      case 'MediaElementAudioSourceNode':
      case 'MediaStreamAudioSourceNode':
      case 'ScriptProcessorNode':
      case 'AudioWorkletNode':
        // These require special parameters, create a basic gain node as placeholder
        audioNode = this.audioContext.createGain()
        break
      default: {
        // Dynamic method call for standard nodes
        const methodName = `create${nodeType.replace('Node', '')}` as keyof AudioContext
        const createMethod = this.audioContext[methodName]

        if (typeof createMethod === 'function') {
          audioNode = (createMethod as () => AudioNode).call(this.audioContext)
        } else {
          throw new Error(
            `Unknown node type: ${nodeType}. Method ${methodName} not found on AudioContext.`
          )
        }
        break
      }
    }

    // Apply properties from metadata
    metadata.properties.forEach(propertyDef => {
      const value = properties[propertyDef.name] ?? propertyDef.defaultValue
      this.applyProperty(audioNode, propertyDef.name, value, propertyDef.type)
    })

    // Start source nodes automatically
    if (this.isSourceNode(nodeType)) {
      this.startSourceNode(audioNode, nodeType)
    }

    return audioNode
  }

  private applyProperty(
    audioNode: AudioNode,
    propertyName: string,
    value: unknown,
    propertyType: string
  ): void {
    const nodeWithProperty = audioNode as unknown as Record<string, unknown>

    if (propertyName in nodeWithProperty) {
      if (propertyType === 'AudioParam') {
        const audioParam = nodeWithProperty[propertyName] as AudioParam
        if (audioParam && typeof audioParam.value !== 'undefined') {
          audioParam.value = value as number
          console.log(`Set AudioParam ${propertyName} to ${value}`)
        }
      } else {
        nodeWithProperty[propertyName] = value
        console.log(`Set property ${propertyName} to ${value}`)
      }
    } else {
      console.warn(`Property ${propertyName} not found on audio node`)
    }
  }

  private isSourceNode(nodeType: string): boolean {
    return [
      'OscillatorNode',
      'AudioBufferSourceNode',
      'MediaElementAudioSourceNode',
      'MediaStreamAudioSourceNode',
    ].includes(nodeType)
  }

  private startSourceNode(audioNode: AudioNode, nodeType: string): void {
    try {
      if (nodeType === 'OscillatorNode') {
        ;(audioNode as OscillatorNode).start()
        console.log(`Started ${nodeType}`)
      } else if (nodeType === 'AudioBufferSourceNode') {
        // AudioBufferSourceNode needs a buffer before it can start
        // We'll skip auto-starting for now
        console.log(`${nodeType} requires buffer before starting`)
      }
    } catch (error) {
      console.error(`Failed to start ${nodeType}:`, error)
    }
  }

  stopSourceNode(audioNode: AudioNode, nodeType: string): void {
    try {
      if (nodeType === 'OscillatorNode' || nodeType === 'AudioBufferSourceNode') {
        const sourceNode = audioNode as OscillatorNode | AudioBufferSourceNode
        sourceNode.stop()
        console.log(`Stopped ${nodeType}`)
      }
    } catch (error) {
      console.error(`${nodeType} was already stopped or stopping failed:`, error)
    }
  }

  updateNodeProperty(
    audioNode: AudioNode,
    nodeType: string,
    metadata: NodeMetadata,
    propertyName: string,
    value: unknown
  ): boolean {
    // Check if this property requires node recreation
    if (this.requiresRecreation(nodeType, propertyName)) {
      console.log(`Property ${propertyName} change requires node recreation`)
      return false // Indicate that recreation is needed
    }

    // Find the property in metadata
    const propertyDef = metadata.properties.find(p => p.name === propertyName)
    if (!propertyDef) {
      console.error(`Property ${propertyName} not found in metadata for ${nodeType}`)
      return false
    }

    // Apply the property update
    this.applyProperty(audioNode, propertyName, value, propertyDef.type)
    return true // Successfully updated
  }

  private requiresRecreation(nodeType: string, propertyName: string): boolean {
    // Some properties require recreating the entire node
    const recreationMap: Record<string, string[]> = {
      OscillatorNode: ['type'], // Changing oscillator type requires recreation
      BiquadFilterNode: ['type'], // Changing filter type requires recreation
    }

    return recreationMap[nodeType]?.includes(propertyName) ?? false
  }
}
