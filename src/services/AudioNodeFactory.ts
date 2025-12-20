import type { INodeMetadata } from '~/stores/NodeModels'
import type { GraphError } from '~/stores/AudioGraphStore'

export type ErrorReporter = (error: Omit<GraphError, 'id' | 'timestamp'>) => void

export class AudioNodeFactory {
  public audioContext: AudioContext
  private errorReporter: ErrorReporter | null = null

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  /**
   * Set the error reporter callback for sending errors to the store
   */
  setErrorReporter(reporter: ErrorReporter): void {
    this.errorReporter = reporter
  }

  /**
   * Report an error to the queue (if reporter is set)
   */
  private reportError(error: Omit<GraphError, 'id' | 'timestamp'>): void {
    if (this.errorReporter) {
      this.errorReporter(error)
    }
  }

  createAudioNode(
    nodeType: string,
    metadata: INodeMetadata,
    properties: Record<string, unknown> = {}
  ): AudioNode {
    let audioNode: AudioNode

    // Handle special cases that require specific parameters or different creation methods
    switch (nodeType) {
      case 'AudioDestinationNode':
        audioNode = this.audioContext.destination
        break
      case 'AudioBufferSourceNode':
        // Create AudioBufferSourceNode with white noise buffer
        audioNode = this.createWhiteNoiseSource()
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

    // Start source nodes automatically only if autostart is enabled
    // Use the provided metadata to check if this is a source node
    if (this.isSourceNodeFromMetadata(metadata)) {
      const autostart = properties.autostart ?? true // Default to true for backward compatibility
      if (autostart) {
        this.startSourceNode(audioNode, nodeType)
      }
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

    // Skip custom properties that don't exist on the actual audio node
    if (propertyName === 'autostart') {
      // autostart is a custom property for our logic, not a Web Audio API property
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
            this.reportError({
              category: 'property',
              severity: 'error',
              message: `Cannot set AudioParam ${propertyName} to non-finite value: ${value}`,
              details: { propertyName, value, propertyType },
            })
            return
          }
          audioParam.value = numValue
        }
      } else {
        nodeWithProperty[propertyName] = value
      }
    } else {
      console.warn(`Property ${propertyName} not found on audio node`)
      this.reportError({
        category: 'property',
        severity: 'warning',
        message: `Property ${propertyName} not found on audio node`,
        details: { propertyName, value },
      })
    }
  }

  private isSourceNodeFromMetadata(metadata: INodeMetadata): boolean {
    // Check if this node has a 'start' method in the provided metadata
    // Source nodes are characterized by having start/stop methods
    return metadata?.methods?.includes('start') ?? false
  }

  private startSourceNode(audioNode: AudioNode, nodeType: string): void {
    try {
      if (nodeType === 'OscillatorNode') {
        ;(audioNode as OscillatorNode).start()
      } else if (nodeType === 'AudioBufferSourceNode') {
        // AudioBufferSourceNode now has a buffer, so we can start it
        ;(audioNode as AudioBufferSourceNode).start()
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
      }
    } catch (error) {
      console.error(`${nodeType} was already stopped or stopping failed:`, error)
    }
  }

  triggerSourceNode(audioNode: AudioNode, nodeType: string): void {
    try {
      if (nodeType === 'OscillatorNode') {
        const oscNode = audioNode as OscillatorNode
        // Check if oscillator is already started by checking if it has been connected
        // We can't directly check if it's started, so we'll try to start it
        oscNode.start()
      } else if (nodeType === 'AudioBufferSourceNode') {
        const bufferNode = audioNode as AudioBufferSourceNode
        bufferNode.start()
      }
    } catch (error) {
      // If already started, this will throw an error, which is expected
      console.warn(
        `${nodeType} trigger failed (might already be started):`,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  updateNodeProperty(
    audioNode: AudioNode,
    nodeType: string,
    metadata: INodeMetadata,
    propertyName: string,
    value: unknown
  ): boolean {
    // Check if this property requires node recreation
    if (this.requiresRecreation(nodeType, propertyName)) {
      return false // Indicate that recreation is needed
    }

    // Find the property in metadata
    const propertyDef = metadata.properties.find(p => p.name === propertyName)
    if (!propertyDef) {
      console.error(`Property ${propertyName} not found in metadata for ${nodeType}`)
      this.reportError({
        category: 'property',
        severity: 'error',
        message: `Property ${propertyName} not found in metadata for ${nodeType}`,
        nodeType,
        details: { propertyName },
      })
      return false
    }

    // Validate the input value
    const validatedValue = this.validatePropertyValue(value, propertyDef, propertyName)
    if (validatedValue === null) {
      console.error(`Invalid value for property ${propertyName}: ${value}`)
      this.reportError({
        category: 'property',
        severity: 'error',
        message: `Invalid value for property ${propertyName}: ${value}`,
        nodeType,
        details: { propertyName, value },
      })
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
          this.reportError({
            category: 'property',
            severity: 'warning',
            message: `Property ${propertyName} value ${numValue} is below minimum ${propertyDef.min}. Clamped to ${propertyDef.min}.`,
            details: { propertyName, value: numValue, min: propertyDef.min },
          })
          return propertyDef.min
        }
        if (propertyDef.max !== undefined && numValue > propertyDef.max) {
          console.warn(
            `Property ${propertyName} value ${numValue} is above maximum ${propertyDef.max}`
          )
          this.reportError({
            category: 'property',
            severity: 'warning',
            message: `Property ${propertyName} value ${numValue} is above maximum ${propertyDef.max}. Clamped to ${propertyDef.max}.`,
            details: { propertyName, value: numValue, max: propertyDef.max },
          })
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

  private createWhiteNoiseSource(): AudioBufferSourceNode {
    const bufferSize = this.audioContext.sampleRate * 2 // 2 seconds of noise
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate)
    const output = buffer.getChannelData(0)

    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1 // Random values between -1 and 1
    }

    const source = this.audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true // Loop the noise for continuous playback

    return source
  }
}
