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
    // Skip if value is null or undefined
    if (value === null || value === undefined) {
      console.warn(`Skipping property ${propertyName} - value is null/undefined`)
      return
    }

    const nodeWithProperty = audioNode as unknown as Record<string, unknown>

    if (propertyName in nodeWithProperty) {
      if (propertyType === 'AudioParam') {
        const audioParam = nodeWithProperty[propertyName] as AudioParam
        if (audioParam && typeof audioParam.value !== 'undefined') {
          const numValue = Number(value)
          if (isNaN(numValue) || !isFinite(numValue)) {
            console.error(`Cannot set AudioParam ${propertyName} to non-finite value: ${value}`)
            return
          }
          audioParam.value = numValue
          console.log(`Set AudioParam ${propertyName} to ${numValue}`)
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

    // Validate the input value
    const validatedValue = this.validatePropertyValue(value, propertyDef, propertyName)
    if (validatedValue === null) {
      console.error(`Invalid value for property ${propertyName}: ${value}`)
      return false
    }

    // Apply the property update
    this.applyProperty(audioNode, propertyName, validatedValue, propertyDef.type)
    return true // Successfully updated
  }

  private validatePropertyValue(
    value: unknown,
    propertyDef: { name: string; type: string; min?: number; max?: number; defaultValue?: unknown },
    propertyName: string
  ): unknown | null {
    // Handle null/undefined values
    if (value === null || value === undefined) {
      return propertyDef.defaultValue ?? this.getTypeDefaultValue(propertyDef.type, propertyName)
    }

    // Validate based on property type
    switch (propertyDef.type) {
      case 'AudioParam':
      case 'number': {
        const numValue = Number(value)
        if (isNaN(numValue) || !isFinite(numValue)) {
          console.warn(`Property ${propertyName} expects a number, got: ${value}. Using default.`)
          return (
            propertyDef.defaultValue ?? this.getTypeDefaultValue(propertyDef.type, propertyName)
          )
        }

        // Check min/max bounds
        if (propertyDef.min !== undefined && numValue < propertyDef.min) {
          console.warn(
            `Property ${propertyName} value ${numValue} is below minimum ${propertyDef.min}`
          )
          return propertyDef.min
        }
        if (propertyDef.max !== undefined && numValue > propertyDef.max) {
          console.warn(
            `Property ${propertyName} value ${numValue} is above maximum ${propertyDef.max}`
          )
          return propertyDef.max
        }

        return numValue
      }

      case 'string':
        return String(value)

      case 'boolean':
        return Boolean(value)

      case 'OscillatorType':
        if (!['sine', 'square', 'sawtooth', 'triangle'].includes(value as string)) {
          console.warn(`Invalid oscillator type: ${value}. Using 'sine' instead.`)
          return 'sine'
        }
        return value

      case 'BiquadFilterType':
        if (
          ![
            'lowpass',
            'highpass',
            'bandpass',
            'lowshelf',
            'highshelf',
            'peaking',
            'notch',
            'allpass',
          ].includes(value as string)
        ) {
          console.warn(`Invalid filter type: ${value}. Using 'lowpass' instead.`)
          return 'lowpass'
        }
        return value

      case 'DistanceModelType':
        if (!['linear', 'inverse', 'exponential'].includes(value as string)) {
          console.warn(`Invalid distance model: ${value}. Using 'inverse' instead.`)
          return 'inverse'
        }
        return value

      case 'PanningModelType':
        if (!['equalpower', 'HRTF'].includes(value as string)) {
          console.warn(`Invalid panning model: ${value}. Using 'equalpower' instead.`)
          return 'equalpower'
        }
        return value

      case 'OverSampleType':
        if (!['none', '2x', '4x'].includes(value as string)) {
          console.warn(`Invalid oversample type: ${value}. Using 'none' instead.`)
          return 'none'
        }
        return value

      default:
        // For unknown types, just return the value as-is
        console.warn(`Unknown property type: ${propertyDef.type} for property ${propertyName}`)
        return value
    }
  }

  private getTypeDefaultValue(type: string, propertyName: string): unknown {
    // Provide sensible defaults for different property types
    switch (type) {
      case 'AudioParam':
      case 'number':
        // Special cases for known properties
        if (propertyName === 'pan') return 0 // Pan should default to center
        if (propertyName === 'gain') return 1 // Gain should default to unity
        if (propertyName === 'frequency') return 440 // Frequency should default to A4
        if (propertyName === 'Q') return 1 // Q should default to 1
        if (propertyName === 'detune') return 0 // Detune should default to 0
        return 0 // General default for numbers
      case 'string':
        return ''
      case 'boolean':
        return false
      case 'OscillatorType':
        return 'sine'
      case 'BiquadFilterType':
        return 'lowpass'
      default:
        return 0
    }
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
