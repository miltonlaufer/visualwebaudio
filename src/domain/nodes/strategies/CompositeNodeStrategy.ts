/**
 * Composite Node Strategy
 *
 * Handles composite nodes - nodes that contain an internal graph of other nodes.
 * The strategy creates and manages the internal audio graph, routing inputs
 * to internal nodes and outputs from them.
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'
import type { CompositeNodeInternalGraph, CompositeNodePort, SerializedNode } from '~/types'
import { compositeNodeDefinitionStore } from '~/stores/CompositeNodeDefinitionStore'
import {
  getImpulseResponseWithFallback,
  getAvailableImpulseResponseIds,
  generateFallbackImpulseResponse,
} from '~/utils/impulseResponseLoader'

// Valid impulse response preset IDs
type IRPreset = ReturnType<typeof getAvailableImpulseResponseIds>[number]

/******************* TYPES ***********************/

interface InternalNode {
  id: string
  nodeType: string
  audioNode?: AudioNode
  gainNode?: GainNode // For envelope nodes
  properties: Map<string, unknown>
}

interface InternalEdge {
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
}

interface InternalGraphState {
  audioContext: AudioContext
  nodes: Map<string, InternalNode>
  inputGains: Map<string, GainNode> // External input port ID -> GainNode
  outputGains: Map<string, GainNode> // External output port ID -> GainNode
  edges: InternalEdge[] // Store edges for control input routing
  adsrState?: ADSRState // For envelope composite nodes
}

interface ADSRState {
  attack: number
  decay: number
  sustain: number
  release: number
  isGateOpen: boolean
  currentGain: number
}

/******************* STATE MANAGEMENT ***********************/

// Store internal graph state outside the strategy instance (volatile state)
const internalGraphs = new Map<string, InternalGraphState>()

/******************* STRATEGY IMPLEMENTATION ***********************/

export class CompositeNodeStrategy extends BaseNodeStrategy {
  readonly nodeType = 'CompositeNode'

  /******************* LIFECYCLE ***********************/

  initialize(context: INodeStrategyContext): void {
    const definitionId = context.state.properties.get('definitionId') as string
    if (!definitionId) {
      console.error('CompositeNodeStrategy: No definitionId provided')
      return
    }

    // Initialization will happen when audio context is available
    if (context.audioContext) {
      this.setupInternalGraph(context, definitionId)
    }
  }

  cleanup(context: INodeStrategyContext): void {
    const state = internalGraphs.get(context.state.id)
    if (state) {
      // Disconnect all internal nodes
      state.nodes.forEach(node => {
        if (node.audioNode) {
          try {
            node.audioNode.disconnect()
          } catch {
            // Ignore disconnect errors
          }
        }
        if (node.gainNode) {
          try {
            node.gainNode.disconnect()
          } catch {
            // Ignore disconnect errors
          }
        }
      })

      // Disconnect input/output gains
      state.inputGains.forEach(gain => {
        try {
          gain.disconnect()
        } catch {
          // Ignore
        }
      })
      state.outputGains.forEach(gain => {
        try {
          gain.disconnect()
        } catch {
          // Ignore
        }
      })

      internalGraphs.delete(context.state.id)
    }
  }

  onAudioContextChange(context: INodeStrategyContext, audioContext: AudioContext): void {
    // Clean up old graph
    this.cleanup(context)

    // Rebuild with new context
    const definitionId = context.state.properties.get('definitionId') as string
    if (definitionId) {
      this.setupInternalGraph(context, definitionId, audioContext)
    }
  }

  /******************* INPUT HANDLING ***********************/

  handleInput(
    context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void {
    const state = internalGraphs.get(context.state.id)
    if (!state) return

    const numValue = Number(value)
    if (isNaN(numValue)) return

    // Route to internal graph based on input name
    const inputGain = state.inputGains.get(inputName)
    if (inputGain) {
      // For audio inputs, we don't set gain value - the audio connection handles it
      // This is for control inputs that modulate parameters
      return
    }

    // Handle control inputs
    this.handleControlInput(context, state, inputName, numValue)
  }

  onPropertyChange(
    context: INodeStrategyContext,
    propertyName: string,
    value: unknown
  ): IInputProcessingResult | void {
    const state = internalGraphs.get(context.state.id)
    if (!state) return

    const numValue = Number(value)
    if (isNaN(numValue)) return

    // Handle ADSR property changes
    if (state.adsrState && ['attack', 'decay', 'sustain', 'release'].includes(propertyName)) {
      state.adsrState[propertyName as keyof ADSRState] = numValue as never
    }

    // Route property changes to internal nodes via control inputs
    // This handles properties like delayTime, feedback, cutoff, resonance, etc.
    this.handleControlInput(context, state, propertyName, numValue)
  }

  /******************* INTERNAL GRAPH SETUP ***********************/

  private setupInternalGraph(
    context: INodeStrategyContext,
    definitionId: string,
    audioContextOverride?: AudioContext
  ): void {
    const definition = compositeNodeDefinitionStore.getDefinition(definitionId)
    if (!definition) {
      console.error(`CompositeNodeStrategy: Definition ${definitionId} not found`)
      return
    }

    const audioContext = audioContextOverride || context.audioContext
    if (!audioContext) {
      console.error('CompositeNodeStrategy: No AudioContext available')
      return
    }

    const graphState: InternalGraphState = {
      audioContext,
      nodes: new Map(),
      inputGains: new Map(),
      outputGains: new Map(),
      edges: definition.internalGraph.edges.map(e => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || '',
        targetHandle: e.targetHandle || '',
      })),
    }

    // Create input gain nodes for external audio inputs
    definition.inputs.forEach((input: CompositeNodePort) => {
      if (input.type === 'audio') {
        const gain = audioContext.createGain()
        gain.gain.value = 1
        graphState.inputGains.set(input.id, gain)
      }
    })

    // Create output gain nodes for external audio outputs
    definition.outputs.forEach((output: CompositeNodePort) => {
      if (output.type === 'audio') {
        const gain = audioContext.createGain()
        gain.gain.value = 1
        graphState.outputGains.set(output.id, gain)
      }
    })

    // Create internal nodes
    this.createInternalNodes(graphState, definition.internalGraph, audioContext)

    // Connect internal nodes
    this.connectInternalNodes(graphState, definition.internalGraph)

    // Initialize ADSR if this is an envelope composite
    if (definitionId === 'EnvelopeADSR') {
      graphState.adsrState = {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        isGateOpen: false,
        currentGain: 0,
      }
    }

    internalGraphs.set(context.state.id, graphState)
  }

  private createInternalNodes(
    graphState: InternalGraphState,
    internalGraph: CompositeNodeInternalGraph,
    audioContext: AudioContext
  ): void {
    internalGraph.nodes.forEach((nodeDef: SerializedNode) => {
      const internalNode: InternalNode = {
        id: nodeDef.id,
        nodeType: nodeDef.nodeType,
        properties: new Map(),
      }

      // Store properties
      nodeDef.properties.forEach(prop => {
        internalNode.properties.set(prop.name, prop.value)
      })

      // Create audio node based on type
      switch (nodeDef.nodeType) {
        case 'ExternalInputNode':
        case 'ExternalOutputNode':
          // These are placeholder nodes, no actual audio node needed
          break

        case 'GainNode':
          internalNode.audioNode = audioContext.createGain()
          this.applyGainProperties(internalNode.audioNode as GainNode, internalNode.properties)
          break

        case 'DelayNode':
          internalNode.audioNode = audioContext.createDelay(5) // Max 5 seconds
          this.applyDelayProperties(internalNode.audioNode as DelayNode, internalNode.properties)
          break

        case 'OscillatorNode':
          internalNode.audioNode = audioContext.createOscillator()
          this.applyOscillatorProperties(
            internalNode.audioNode as OscillatorNode,
            internalNode.properties
          )
          ;(internalNode.audioNode as OscillatorNode).start()
          break

        case 'BiquadFilterNode':
          internalNode.audioNode = audioContext.createBiquadFilter()
          this.applyFilterProperties(
            internalNode.audioNode as BiquadFilterNode,
            internalNode.properties
          )
          break

        case 'ConvolverNode':
          internalNode.audioNode = audioContext.createConvolver()
          this.applyConvolverProperties(
            internalNode.audioNode as ConvolverNode,
            internalNode.properties,
            audioContext
          )
          break

        case 'StereoPannerNode':
          internalNode.audioNode = audioContext.createStereoPanner()
          break

        case 'DynamicsCompressorNode':
          internalNode.audioNode = audioContext.createDynamicsCompressor()
          break

        default:
          console.warn(`CompositeNodeStrategy: Unknown node type ${nodeDef.nodeType}`)
      }

      graphState.nodes.set(nodeDef.id, internalNode)
    })
  }

  private connectInternalNodes(
    graphState: InternalGraphState,
    internalGraph: CompositeNodeInternalGraph
  ): void {
    internalGraph.connections.forEach(conn => {
      const sourceNode = graphState.nodes.get(conn.sourceNodeId)
      const targetNode = graphState.nodes.get(conn.targetNodeId)

      if (!sourceNode || !targetNode) return

      // Handle external input nodes
      if (sourceNode.nodeType === 'ExternalInputNode') {
        const portId = sourceNode.properties.get('portId') as string
        const inputGain = graphState.inputGains.get(portId)
        if (inputGain && targetNode.audioNode) {
          this.connectToTarget(inputGain, targetNode.audioNode, conn.targetInput)
        }
        return
      }

      // Handle external output nodes
      if (targetNode.nodeType === 'ExternalOutputNode') {
        const portId = targetNode.properties.get('portId') as string
        const outputGain = graphState.outputGains.get(portId)
        if (outputGain && sourceNode.audioNode) {
          sourceNode.audioNode.connect(outputGain)
        }
        return
      }

      // Regular internal connection
      if (sourceNode.audioNode && targetNode.audioNode) {
        this.connectToTarget(sourceNode.audioNode, targetNode.audioNode, conn.targetInput)
      }
    })
  }

  private connectToTarget(source: AudioNode, target: AudioNode, targetInput: string): void {
    // Handle parameter connections (e.g., delayTime, gain, frequency)
    const targetWithParams = target as unknown as Record<string, AudioParam | unknown>

    if (targetInput && targetInput !== 'input' && targetWithParams[targetInput]) {
      const param = targetWithParams[targetInput]
      if (param instanceof AudioParam) {
        source.connect(param)
        return
      }
    }

    // Default audio connection
    source.connect(target)
  }

  /******************* PROPERTY APPLICATION ***********************/

  private applyGainProperties(node: GainNode, properties: Map<string, unknown>): void {
    const gain = properties.get('gain')
    if (gain !== undefined) {
      node.gain.value = Number(gain)
    }
  }

  private applyDelayProperties(node: DelayNode, properties: Map<string, unknown>): void {
    const delayTime = properties.get('delayTime')
    if (delayTime !== undefined) {
      node.delayTime.value = Math.min(5, Math.max(0, Number(delayTime)))
    }
  }

  private applyOscillatorProperties(node: OscillatorNode, properties: Map<string, unknown>): void {
    const type = properties.get('type') as OscillatorType
    if (type) {
      node.type = type
    }

    const frequency = properties.get('frequency')
    if (frequency !== undefined) {
      node.frequency.value = Number(frequency)
    }

    const detune = properties.get('detune')
    if (detune !== undefined) {
      node.detune.value = Number(detune)
    }
  }

  private applyFilterProperties(node: BiquadFilterNode, properties: Map<string, unknown>): void {
    const type = properties.get('type') as BiquadFilterType
    if (type) {
      node.type = type
    }

    const frequency = properties.get('frequency')
    if (frequency !== undefined) {
      node.frequency.value = Number(frequency)
    }

    const Q = properties.get('Q')
    if (Q !== undefined) {
      node.Q.value = Number(Q)
    }

    const gain = properties.get('gain')
    if (gain !== undefined) {
      node.gain.value = Number(gain)
    }
  }

  private applyConvolverProperties(
    node: ConvolverNode,
    properties: Map<string, unknown>,
    audioContext: AudioContext
  ): void {
    // Get the IR preset ID (default to 'chapel' for good general-purpose reverb)
    const irPresetRaw = properties.get('impulseResponse') || 'chapel'
    const availableIds = getAvailableImpulseResponseIds()

    // Validate preset ID - use 'chapel' as default if invalid
    const irPreset: IRPreset = availableIds.includes(String(irPresetRaw))
      ? String(irPresetRaw)
      : 'chapel'

    // Set a temporary fallback buffer immediately so the convolver works
    // This prevents the "no buffer" error while loading
    try {
      node.buffer = generateFallbackImpulseResponse(audioContext, 2.0)
    } catch (error) {
      console.error('CompositeNodeStrategy: Failed to set fallback IR', error)
    }

    // Load the real impulse response asynchronously
    getImpulseResponseWithFallback(audioContext, irPreset)
      .then(buffer => {
        // Only update if the node is still valid (hasn't been disconnected)
        try {
          node.buffer = buffer
        } catch {
          // Node might have been disconnected - ignore
          console.warn('CompositeNodeStrategy: Could not set IR buffer (node may be disconnected)')
        }
      })
      .catch(error => {
        console.error('CompositeNodeStrategy: Failed to load impulse response', error)
      })
  }

  /******************* CONTROL INPUT HANDLING ***********************/

  private handleControlInput(
    _context: INodeStrategyContext,
    state: InternalGraphState,
    inputName: string,
    value: number
  ): void {
    // Find internal nodes that should receive this control input
    state.nodes.forEach(node => {
      if (node.nodeType === 'ExternalInputNode') {
        const portId = node.properties.get('portId')
        if (portId === inputName) {
          // Route to connected internal nodes
          this.routeControlValue(state, node.id, value)
        }
      }
    })

    // Handle ADSR-specific controls
    if (state.adsrState) {
      this.handleADSRControl(state, inputName, value)
    }
  }

  private routeControlValue(state: InternalGraphState, sourceId: string, value: number): void {
    // Find edges from this source node and update target parameters
    const outgoingEdges = state.edges.filter(edge => edge.source === sourceId)

    outgoingEdges.forEach(edge => {
      const targetNode = state.nodes.get(edge.target)
      if (!targetNode || !targetNode.audioNode) return

      const targetParam = edge.targetHandle
      if (!targetParam || targetParam === 'input') return // Skip audio connections

      const nodeWithParams = targetNode.audioNode as unknown as Record<string, AudioParam | unknown>
      const param = nodeWithParams[targetParam]

      if (param instanceof AudioParam) {
        // Apply value directly to AudioParam
        param.setValueAtTime(value, state.audioContext.currentTime)
      }
    })
  }

  private handleADSRControl(state: InternalGraphState, inputName: string, value: number): void {
    if (!state.adsrState) return

    switch (inputName) {
      case 'attack':
        state.adsrState.attack = Math.max(0.001, value)
        break
      case 'decay':
        state.adsrState.decay = Math.max(0.001, value)
        break
      case 'sustain':
        state.adsrState.sustain = Math.min(1, Math.max(0, value))
        break
      case 'release':
        state.adsrState.release = Math.max(0.001, value)
        break
      case 'trigger':
        if (value > 0) {
          this.triggerADSR(state)
        }
        break
    }
  }

  private triggerADSR(state: InternalGraphState): void {
    if (!state.adsrState) return

    // Find the envelope gain node
    const envelopeNode = Array.from(state.nodes.values()).find(
      n => n.nodeType === 'GainNode' && n.properties.get('_isEnvelope')
    )

    if (!envelopeNode || !envelopeNode.audioNode) return

    const gainNode = envelopeNode.audioNode as GainNode
    const now = state.audioContext.currentTime
    const { attack, decay, sustain, release } = state.adsrState

    // Cancel any scheduled changes
    gainNode.gain.cancelScheduledValues(now)

    // Start from current value
    gainNode.gain.setValueAtTime(gainNode.gain.value, now)

    // Attack phase
    gainNode.gain.linearRampToValueAtTime(1, now + attack)

    // Decay phase
    gainNode.gain.linearRampToValueAtTime(sustain, now + attack + decay)

    // Release phase (after a short sustain hold)
    const sustainHold = 0.5 // Hold sustain for 500ms
    gainNode.gain.setValueAtTime(sustain, now + attack + decay + sustainHold)
    gainNode.gain.linearRampToValueAtTime(0, now + attack + decay + sustainHold + release)
  }

  /******************* PUBLIC API ***********************/

  /**
   * Get the audio output node for connecting to external nodes
   */
  getAudioOutput(nodeId: string, outputId: string = 'output'): GainNode | null {
    const state = internalGraphs.get(nodeId)
    if (!state) return null
    return state.outputGains.get(outputId) || null
  }

  /**
   * Get the audio input node for connecting from external nodes
   */
  getAudioInput(nodeId: string, inputId: string = 'input'): GainNode | null {
    const state = internalGraphs.get(nodeId)
    if (!state) return null
    return state.inputGains.get(inputId) || null
  }

  /**
   * Check if internal graph is initialized
   */
  hasInternalGraph(nodeId: string): boolean {
    return internalGraphs.has(nodeId)
  }

  /**
   * Build internal graph for a composite node (public API for use by AudioGraphStore)
   * This is the main entry point for creating composite node audio graphs from the store.
   */
  buildInternalGraph(
    nodeId: string,
    internalGraph: CompositeNodeInternalGraph,
    inputs: CompositeNodePort[],
    outputs: CompositeNodePort[],
    audioContext: AudioContext,
    externalProperties?: Record<string, unknown>
  ): void {
    // Clean up any existing graph for this node
    const existing = internalGraphs.get(nodeId)
    if (existing) {
      existing.nodes.forEach(node => {
        if (node.audioNode) {
          try {
            node.audioNode.disconnect()
          } catch {
            // Ignore disconnect errors
          }
        }
      })
      existing.inputGains.forEach(gain => {
        try {
          gain.disconnect()
        } catch {
          // Ignore
        }
      })
      existing.outputGains.forEach(gain => {
        try {
          gain.disconnect()
        } catch {
          // Ignore
        }
      })
      internalGraphs.delete(nodeId)
    }

    const graphState: InternalGraphState = {
      audioContext,
      nodes: new Map(),
      inputGains: new Map(),
      outputGains: new Map(),
      edges: internalGraph.edges.map(e => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || '',
        targetHandle: e.targetHandle || '',
      })),
    }

    // Create input gain nodes for external audio inputs
    inputs.forEach((input: CompositeNodePort) => {
      if (input.type === 'audio') {
        const gain = audioContext.createGain()
        gain.gain.value = 1
        graphState.inputGains.set(input.id, gain)
      }
    })

    // Create output gain nodes for external audio outputs
    outputs.forEach((output: CompositeNodePort) => {
      if (output.type === 'audio') {
        const gain = audioContext.createGain()
        gain.gain.value = 1
        graphState.outputGains.set(output.id, gain)
      }
    })

    // Create internal nodes
    this.createInternalNodes(graphState, internalGraph, audioContext)

    // Apply external properties to internal nodes if provided
    if (externalProperties) {
      this.applyExternalProperties(graphState, externalProperties)
    }

    // Connect internal nodes
    this.connectInternalNodes(graphState, internalGraph)

    // Check if this is an envelope composite
    const definitionId = externalProperties?.definitionId as string
    if (definitionId === 'EnvelopeADSR') {
      graphState.adsrState = {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        isGateOpen: false,
        currentGain: 0,
      }
    }

    internalGraphs.set(nodeId, graphState)
  }

  /**
   * Apply external properties to internal nodes
   */
  private applyExternalProperties(
    graphState: InternalGraphState,
    externalProperties: Record<string, unknown>
  ): void {
    // For each external property, find the ExternalInputNode with matching portId
    // and route the value to connected internal nodes via edges
    Object.entries(externalProperties).forEach(([propName, propValue]) => {
      const numValue = Number(propValue)
      if (isNaN(numValue)) return

      // Find the ExternalInputNode for this property
      graphState.nodes.forEach(node => {
        if (node.nodeType === 'ExternalInputNode') {
          const portId = node.properties.get('portId')
          if (portId === propName) {
            // Route value through edges to connected internal nodes
            this.routeControlValue(graphState, node.id, numValue)
          }
        }
      })
    })
  }

  /**
   * Clean up internal graph for a node
   */
  cleanupNode(nodeId: string): void {
    const state = internalGraphs.get(nodeId)
    if (state) {
      state.nodes.forEach(node => {
        if (node.audioNode) {
          try {
            node.audioNode.disconnect()
          } catch {
            // Ignore disconnect errors
          }
        }
      })
      state.inputGains.forEach(gain => {
        try {
          gain.disconnect()
        } catch {
          // Ignore
        }
      })
      state.outputGains.forEach(gain => {
        try {
          gain.disconnect()
        } catch {
          // Ignore
        }
      })
      internalGraphs.delete(nodeId)
    }
  }
}

/******************* SINGLETON INSTANCE ***********************/

export const compositeNodeStrategy = new CompositeNodeStrategy()
