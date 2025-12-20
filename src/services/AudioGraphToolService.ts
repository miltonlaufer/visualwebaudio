/**
 * Audio Graph Tool Service
 * Defines tools (functions) that the AI can call to manipulate the audio graph
 */
import { z } from 'zod'
import { tool } from '@langchain/core/tools'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import webAudioMetadata from '~/types/web-audio-metadata.json'
import customNodesMetadata from '~/types/custom-nodes-metadata.json'

/******************* HANDLE VALIDATION ***********************/

interface NodeMetadata {
  inputs?: Array<{ name: string; type: string }>
  outputs?: Array<{ name: string; type: string }>
}

const allMetadata: Record<string, NodeMetadata> = {
  ...webAudioMetadata,
  ...customNodesMetadata,
}

/**
 * AudioParam names that can be modulated on various node types
 * These are valid target handles even if not explicitly listed in metadata
 */
const audioParamsByNodeType: Record<string, string[]> = {
  OscillatorNode: ['frequency', 'detune'],
  GainNode: ['gain'],
  DelayNode: ['delayTime'],
  BiquadFilterNode: ['frequency', 'Q', 'gain', 'detune'],
  DynamicsCompressorNode: ['threshold', 'knee', 'ratio', 'attack', 'release'],
  StereoPannerNode: ['pan'],
  PannerNode: [
    'positionX',
    'positionY',
    'positionZ',
    'orientationX',
    'orientationY',
    'orientationZ',
  ],
  ConstantSourceNode: ['offset'],
  AudioBufferSourceNode: ['playbackRate', 'detune'],
}

/**
 * Get valid output handles for a node type
 */
function getValidOutputs(nodeType: string): string[] {
  const metadata = allMetadata[nodeType]
  if (!metadata?.outputs) return ['output']
  return metadata.outputs.map(o => o.name)
}

/**
 * Get valid input handles for a node type
 * Includes both metadata inputs and AudioParam names that can be modulated
 */
function getValidInputs(nodeType: string): string[] {
  const metadata = allMetadata[nodeType]
  const metadataInputs = metadata?.inputs?.map(i => i.name) || ['input']
  const audioParams = audioParamsByNodeType[nodeType] || []

  // Combine and deduplicate
  return [...new Set([...metadataInputs, ...audioParams])]
}

/**
 * Validate connection handles and return error message if invalid
 */
function validateConnection(
  sourceNodeType: string,
  targetNodeType: string,
  sourceHandle: string,
  targetHandle: string
): { valid: boolean; error?: string; suggestion?: string } {
  const validOutputs = getValidOutputs(sourceNodeType)
  const validInputs = getValidInputs(targetNodeType)

  if (!validOutputs.includes(sourceHandle)) {
    return {
      valid: false,
      error: `Invalid sourceHandle "${sourceHandle}" for ${sourceNodeType}`,
      suggestion: `Valid outputs for ${sourceNodeType}: ${validOutputs.join(', ')}`,
    }
  }

  if (!validInputs.includes(targetHandle)) {
    return {
      valid: false,
      error: `Invalid targetHandle "${targetHandle}" for ${targetNodeType}`,
      suggestion: `Valid inputs for ${targetNodeType}: ${validInputs.join(', ')}`,
    }
  }

  return { valid: true }
}

/******************* ZOD SCHEMAS ***********************/

/**
 * Available node types in the system
 */
export const NodeTypeSchema = z.enum([
  // Web Audio API nodes
  'AnalyserNode',
  'AudioBufferSourceNode',
  'AudioDestinationNode',
  'BiquadFilterNode',
  'ChannelMergerNode',
  'ChannelSplitterNode',
  'ConstantSourceNode',
  'ConvolverNode',
  'DelayNode',
  'DynamicsCompressorNode',
  'GainNode',
  'IIRFilterNode',
  'MediaStreamAudioDestinationNode',
  'MediaStreamAudioSourceNode',
  'OscillatorNode',
  'PannerNode',
  'StereoPannerNode',
  'WaveShaperNode',
  // Custom nodes
  'ButtonNode',
  'SliderNode',
  'GreaterThanNode',
  'EqualsNode',
  'SelectNode',
  'MidiInputNode',
  'MidiToFreqNode',
  'SoundFileNode',
  'DisplayNode',
  'RandomNode',
  'TimerNode',
  'ScaleToMidiNode',
])

export type NodeType = z.infer<typeof NodeTypeSchema>

/**
 * Position schema
 */
const PositionSchema = z.object({
  x: z.number().describe('X coordinate on the canvas'),
  y: z.number().describe('Y coordinate on the canvas'),
})

/**
 * Add node parameters
 */
const AddNodeSchema = z.object({
  nodeType: NodeTypeSchema.describe('Type of audio node to create'),
  nodeId: z.string().optional().describe('Optional friendly ID for referencing this node later'),
  position: PositionSchema.optional().describe(
    'Position on canvas (auto-positioned if not specified)'
  ),
})

/**
 * Remove node parameters
 */
const RemoveNodeSchema = z.object({
  nodeId: z.string().describe('ID of the node to remove'),
})

/**
 * Connect nodes parameters
 */
const ConnectSchema = z.object({
  sourceId: z.string().describe('ID of the source node'),
  targetId: z.string().describe('ID of the target node'),
  sourceHandle: z.string().default('output').describe('Output handle name (default: "output")'),
  targetHandle: z
    .string()
    .default('input')
    .describe('Input handle name (e.g., "input", "frequency", "gain")'),
})

/**
 * Disconnect nodes parameters
 */
const DisconnectSchema = z.object({
  sourceId: z.string().describe('ID of the source node'),
  targetId: z.string().describe('ID of the target node'),
  sourceHandle: z.string().optional().describe('Output handle name'),
  targetHandle: z.string().optional().describe('Input handle name'),
})

/**
 * Update property parameters
 * Note: propertyValue supports primitives and arrays (for WaveShaperNode curves, etc.)
 */
const UpdatePropertySchema = z.object({
  nodeId: z.string().describe('ID of the node to update'),
  propertyName: z.string().describe('Name of the property to update'),
  propertyValue: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.number())])
    .describe(
      'New value for the property (string, number, boolean, or array of numbers for curves)'
    ),
})

/**
 * Single action in a batch
 */
const BatchActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('addNode'),
    nodeType: NodeTypeSchema,
    nodeId: z.string().optional(),
    position: PositionSchema.optional(),
  }),
  z.object({
    type: z.literal('removeNode'),
    nodeId: z.string(),
  }),
  z.object({
    type: z.literal('connect'),
    sourceId: z.string(),
    targetId: z.string(),
    sourceHandle: z.string().default('output'),
    targetHandle: z.string().default('input'),
  }),
  z.object({
    type: z.literal('disconnect'),
    sourceId: z.string(),
    targetId: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
  }),
  z.object({
    type: z.literal('updateProperty'),
    nodeId: z.string(),
    propertyName: z.string(),
    propertyValue: z.union([z.string(), z.number(), z.boolean(), z.array(z.number())]),
  }),
])

/**
 * Batch actions schema
 */
const BatchActionsSchema = z.object({
  actions: z.array(BatchActionSchema).describe('Array of actions to execute in order'),
})

export type BatchAction = z.infer<typeof BatchActionSchema>

/******************* TOOL EXECUTOR ***********************/

/**
 * Manages node ID mapping between AI-provided IDs and actual store IDs
 */
class NodeIdMapper {
  private mapping = new Map<string, string>()

  set(aiId: string, storeId: string): void {
    this.mapping.set(aiId, storeId)
  }

  get(aiId: string): string {
    return this.mapping.get(aiId) || aiId
  }

  clear(): void {
    this.mapping.clear()
  }
}

/**
 * Smart positioning to avoid overlaps
 */
function getSmartPosition(
  store: AudioGraphStoreType,
  requestedPosition?: { x: number; y: number }
): { x: number; y: number } {
  const basePosition = requestedPosition || { x: 100, y: 100 }
  const nodeSpacing = 200
  const existingNodes = store.adaptedNodes

  if (existingNodes.length === 0) {
    return basePosition
  }

  let position = { ...basePosition }
  let attempts = 0
  const maxAttempts = 20

  while (attempts < maxAttempts) {
    let tooClose = false

    for (const existingNode of existingNodes) {
      const distance = Math.sqrt(
        Math.pow(position.x - existingNode.position.x, 2) +
          Math.pow(position.y - existingNode.position.y, 2)
      )

      if (distance < nodeSpacing) {
        tooClose = true
        break
      }
    }

    if (!tooClose) break

    const angle = attempts * 0.5 * Math.PI
    const radius = nodeSpacing + attempts * 50
    position = {
      x: basePosition.x + Math.cos(angle) * radius,
      y: basePosition.y + Math.sin(angle) * radius,
    }

    attempts++
  }

  return position
}

/**
 * Find a node by ID or by type matching
 */
function findNode(store: AudioGraphStoreType, identifier: string, nodeIdMapper: NodeIdMapper) {
  // First try mapped ID
  const mappedId = nodeIdMapper.get(identifier)
  let node = store.adaptedNodes.find(n => n.id === mappedId)
  if (node) return node

  // Try direct ID
  node = store.adaptedNodes.find(n => n.id === identifier)
  if (node) return node

  // Try matching by type patterns
  const identifierToNodeType: Record<string, string> = {
    oscillator: 'OscillatorNode',
    osc: 'OscillatorNode',
    filter: 'BiquadFilterNode',
    biquad: 'BiquadFilterNode',
    delay: 'DelayNode',
    gain: 'GainNode',
    volume: 'GainNode',
    output: 'AudioDestinationNode',
    destination: 'AudioDestinationNode',
    dest: 'AudioDestinationNode',
    compressor: 'DynamicsCompressorNode',
    panner: 'StereoPannerNode',
    slider: 'SliderNode',
    button: 'ButtonNode',
    midiToFreq: 'MidiToFreqNode',
    midi2freq: 'MidiToFreqNode',
    display: 'DisplayNode',
    timer: 'TimerNode',
    random: 'RandomNode',
  }

  const baseIdentifier = identifier.toLowerCase().replace(/\d+$/, '')
  const expectedNodeType =
    identifierToNodeType[baseIdentifier] || identifierToNodeType[identifier.toLowerCase()]

  if (expectedNodeType) {
    const candidates = store.adaptedNodes.filter(n => n.nodeType === expectedNodeType)
    if (candidates.length > 0) {
      return candidates[candidates.length - 1] // Return most recent
    }
  }

  // Partial matching
  node = store.adaptedNodes.find(
    n =>
      n.nodeType.toLowerCase().includes(identifier.toLowerCase()) ||
      identifier.toLowerCase().includes(n.nodeType.toLowerCase().replace('node', ''))
  )

  return node
}

/******************* TOOL FACTORY ***********************/

/**
 * Create audio graph tools bound to a specific store instance
 */
export function createAudioGraphTools(store: AudioGraphStoreType) {
  const nodeIdMapper = new NodeIdMapper()

  const addNodeTool = tool(
    async input => {
      const { nodeType, nodeId, position } = input

      const smartPosition = getSmartPosition(store, position)
      const nodeCountBefore = store.adaptedNodes.length

      store.addAdaptedNode(nodeType, smartPosition)

      if (store.adaptedNodes.length > nodeCountBefore) {
        const newNode = store.adaptedNodes[store.adaptedNodes.length - 1]
        if (nodeId) {
          nodeIdMapper.set(nodeId, newNode.id)
        }
        return `Created ${nodeType} with ID: ${newNode.id}`
      }

      return `Failed to create ${nodeType}`
    },
    {
      name: 'addNode',
      description:
        'Add a new audio node to the graph. Available types include OscillatorNode, GainNode, BiquadFilterNode, DelayNode, AudioDestinationNode, SliderNode, MidiToFreqNode, etc.',
      schema: AddNodeSchema,
    }
  )

  const removeNodeTool = tool(
    async input => {
      const { nodeId } = input
      const node = findNode(store, nodeId, nodeIdMapper)

      if (!node) {
        return `Node not found: ${nodeId}`
      }

      store.removeNode(node.id)
      return `Removed node: ${node.id}`
    },
    {
      name: 'removeNode',
      description: 'Remove a node from the audio graph',
      schema: RemoveNodeSchema,
    }
  )

  const connectTool = tool(
    async input => {
      const { sourceId, targetId, sourceHandle, targetHandle } = input
      const sourceNode = findNode(store, sourceId, nodeIdMapper)
      const targetNode = findNode(store, targetId, nodeIdMapper)

      if (!sourceNode) {
        return `ERROR: Source node not found: ${sourceId}. Use getGraphState to see available nodes.`
      }
      if (!targetNode) {
        return `ERROR: Target node not found: ${targetId}. Use getGraphState to see available nodes.`
      }

      // Validate connection handles BEFORE attempting
      const validation = validateConnection(
        sourceNode.nodeType,
        targetNode.nodeType,
        sourceHandle,
        targetHandle
      )

      if (!validation.valid) {
        return `ERROR: ${validation.error}. ${validation.suggestion}. Please retry with correct handle names.`
      }

      store.addEdge(sourceNode.id, targetNode.id, sourceHandle, targetHandle)
      return `SUCCESS: Connected ${sourceNode.nodeType} (${sourceHandle}) -> ${targetNode.nodeType} (${targetHandle})`
    },
    {
      name: 'connect',
      description: `Connect two nodes. CRITICAL - use exact handle names:
CONTROL NODES:
- SliderNode: output="value"
- MidiToFreqNode: input="midiNote", output="frequency"
- ScaleToMidiNode: input="scaleDegree", outputs="midiNote" OR "frequency" (use frequency directly!)
- RandomNode: output="value"
- TimerNode: output="trigger"
- ButtonNode: output="trigger"
AUDIO NODES:
- OscillatorNode: input="frequency"/"detune", output="output"
- GainNode: input="input"/"gain", output="output"
- DelayNode: input="input"/"delayTime", output="output"
- BiquadFilterNode: input="input"/"frequency"/"Q"/"gain", output="output"
EXAMPLES:
- Slider to pitch: SliderNode(value) -> ScaleToMidiNode(scaleDegree), ScaleToMidiNode(frequency) -> OscillatorNode(frequency)
- Direct MIDI: SliderNode(value) -> MidiToFreqNode(midiNote), MidiToFreqNode(frequency) -> OscillatorNode(frequency)`,
      schema: ConnectSchema,
    }
  )

  const disconnectTool = tool(
    async input => {
      const { sourceId, targetId, sourceHandle, targetHandle } = input
      const sourceNode = findNode(store, sourceId, nodeIdMapper)
      const targetNode = findNode(store, targetId, nodeIdMapper)

      if (!sourceNode || !targetNode) {
        return `Node not found for disconnection`
      }

      const edge = store.visualEdges.find(
        e =>
          e.source === sourceNode.id &&
          e.target === targetNode.id &&
          (!sourceHandle || e.sourceHandle === sourceHandle) &&
          (!targetHandle || e.targetHandle === targetHandle)
      )

      if (edge) {
        store.removeEdge(edge.id)
        return `Disconnected ${sourceNode.id} from ${targetNode.id}`
      }

      return `No connection found between ${sourceId} and ${targetId}`
    },
    {
      name: 'disconnect',
      description: 'Remove a connection between two nodes',
      schema: DisconnectSchema,
    }
  )

  const updatePropertyTool = tool(
    async input => {
      const { nodeId, propertyName, propertyValue } = input
      const node = findNode(store, nodeId, nodeIdMapper)

      if (!node) {
        return `Node not found: ${nodeId}`
      }

      store.updateNodeProperty(node.id, propertyName, propertyValue)
      return `Updated ${node.id}.${propertyName} = ${propertyValue}`
    },
    {
      name: 'updateProperty',
      description:
        'Update a property on a node. Common properties: frequency, gain, delayTime, type (for oscillator/filter), min/max/value/label (for slider)',
      schema: UpdatePropertySchema,
    }
  )

  const batchActionsTool = tool(
    async input => {
      const { actions } = input
      const results: string[] = []
      let hasErrors = false

      // First pass: add all nodes
      for (const action of actions) {
        if (action.type === 'addNode') {
          const smartPosition = getSmartPosition(store, action.position)
          const nodeCountBefore = store.adaptedNodes.length

          store.addAdaptedNode(action.nodeType, smartPosition)

          if (store.adaptedNodes.length > nodeCountBefore) {
            const newNode = store.adaptedNodes[store.adaptedNodes.length - 1]
            if (action.nodeId) {
              nodeIdMapper.set(action.nodeId, newNode.id)
            }
            results.push(`Created ${action.nodeType}: ${newNode.id}`)
          }
        }
      }

      // Second pass: connections, properties, removals
      for (const action of actions) {
        switch (action.type) {
          case 'connect': {
            const sourceNode = findNode(store, action.sourceId, nodeIdMapper)
            const targetNode = findNode(store, action.targetId, nodeIdMapper)

            if (!sourceNode) {
              results.push(`ERROR: Source node not found: ${action.sourceId}`)
              hasErrors = true
              break
            }
            if (!targetNode) {
              results.push(`ERROR: Target node not found: ${action.targetId}`)
              hasErrors = true
              break
            }

            const srcHandle = action.sourceHandle || 'output'
            const tgtHandle = action.targetHandle || 'input'

            // Validate connection
            const validation = validateConnection(
              sourceNode.nodeType,
              targetNode.nodeType,
              srcHandle,
              tgtHandle
            )

            if (!validation.valid) {
              results.push(`ERROR: ${validation.error}. ${validation.suggestion}`)
              hasErrors = true
              break
            }

            store.addEdge(sourceNode.id, targetNode.id, srcHandle, tgtHandle)
            results.push(
              `SUCCESS: Connected ${sourceNode.nodeType}(${srcHandle}) -> ${targetNode.nodeType}(${tgtHandle})`
            )
            break
          }

          case 'disconnect': {
            const sourceNode = findNode(store, action.sourceId, nodeIdMapper)
            const targetNode = findNode(store, action.targetId, nodeIdMapper)

            if (sourceNode && targetNode) {
              const edge = store.visualEdges.find(
                e => e.source === sourceNode.id && e.target === targetNode.id
              )
              if (edge) {
                store.removeEdge(edge.id)
                results.push(`Disconnected ${sourceNode.id} from ${targetNode.id}`)
              }
            }
            break
          }

          case 'updateProperty': {
            const node = findNode(store, action.nodeId, nodeIdMapper)
            if (node) {
              store.updateNodeProperty(node.id, action.propertyName, action.propertyValue)
              results.push(`Updated ${node.id}.${action.propertyName}`)
            } else {
              results.push(`Node not found for property update: ${action.nodeId}`)
            }
            break
          }

          case 'removeNode': {
            const node = findNode(store, action.nodeId, nodeIdMapper)
            if (node) {
              store.removeNode(node.id)
              results.push(`Removed ${node.id}`)
            }
            break
          }
        }
      }

      // Check for unconnected nodes (excluding AudioDestinationNode)
      const connectedSources = new Set(store.visualEdges.map(e => e.source))
      const connectedTargets = new Set(store.visualEdges.map(e => e.target))
      const unconnectedNodes = store.adaptedNodes.filter(
        n =>
          !connectedSources.has(n.id) &&
          !connectedTargets.has(n.id) &&
          n.nodeType !== 'AudioDestinationNode'
      )

      let unconnectedWarning = ''
      if (unconnectedNodes.length > 0) {
        unconnectedWarning = `\n\nWARNING - UNCONNECTED NODES DETECTED: ${unconnectedNodes.map(n => `${n.id}(${n.nodeType})`).join(', ')}. You MUST connect these nodes or remove them.`
      }

      // Check if audio path reaches destination
      const hasDestination = store.adaptedNodes.some(n => n.nodeType === 'AudioDestinationNode')
      const destinationConnected = store.visualEdges.some(e => {
        const target = store.adaptedNodes.find(n => n.id === e.target)
        return target?.nodeType === 'AudioDestinationNode'
      })

      let pathWarning = ''
      if (hasDestination && !destinationConnected) {
        pathWarning =
          '\n\nWARNING: AudioDestinationNode exists but nothing is connected to it. No sound will be produced!'
      }

      const summary = hasErrors
        ? `\n\n--- ERRORS DETECTED: Please check the error messages above and retry with correct handle names. ---`
        : `\n\n--- All ${results.length} actions completed successfully. ---`

      // Check error queue for runtime errors (property validation, connection failures, etc.)
      const runtimeErrors = store.getRecentErrors()
      let runtimeErrorReport = ''
      if (runtimeErrors.length > 0) {
        const errorMessages = runtimeErrors
          .map(
            e =>
              `${e.severity.toUpperCase()}: [${e.category}] ${e.message}${e.nodeId ? ` (node: ${e.nodeId})` : ''}`
          )
          .join('\n')
        runtimeErrorReport = `\n\nRUNTIME ERRORS DETECTED:\n${errorMessages}`
      }

      return results.join('\n') + summary + unconnectedWarning + pathWarning + runtimeErrorReport
    },
    {
      name: 'batchActions',
      description: `Execute multiple actions in a single call. CRITICAL handle names:
CONTROL NODES:
- SliderNode: output="value"
- MidiToFreqNode: input="midiNote", output="frequency"
- ScaleToMidiNode: input="scaleDegree", outputs="midiNote" OR "frequency"
- RandomNode/TimerNode/ButtonNode: output="value" or "trigger"
AUDIO NODES:
- OscillatorNode: inputs="frequency"/"detune", output="output"
- GainNode: inputs="input"/"gain", output="output"
- DelayNode: inputs="input"/"delayTime", output="output"
NOTE: ScaleToMidiNode outputs frequency directly - no need for MidiToFreqNode after it!
Actions are processed: addNode first, then connections and updates.`,
      schema: BatchActionsSchema,
    }
  )

  const getGraphStateTool = tool(
    async () => {
      const nodes = store.adaptedNodes.map(n => ({
        id: n.id,
        type: n.nodeType,
        position: n.position,
      }))
      const connections = store.visualEdges.map(e => ({
        from: `${e.source}:${e.sourceHandle}`,
        to: `${e.target}:${e.targetHandle}`,
      }))

      return JSON.stringify({ nodes, connections }, null, 2)
    },
    {
      name: 'getGraphState',
      description: 'Get the current state of the audio graph including all nodes and connections',
      schema: z.object({}),
    }
  )

  const clearGraphTool = tool(
    async () => {
      store.clearAllNodes()
      nodeIdMapper.clear()
      return 'Cleared all nodes from the graph'
    },
    {
      name: 'clearGraph',
      description: 'Remove all nodes and connections from the audio graph. Use with caution.',
      schema: z.object({}),
    }
  )

  return {
    tools: [
      addNodeTool,
      removeNodeTool,
      connectTool,
      disconnectTool,
      updatePropertyTool,
      batchActionsTool,
      getGraphStateTool,
      clearGraphTool,
    ],
    nodeIdMapper,
  }
}

/******************* EXPORTED SCHEMAS ***********************/

export {
  AddNodeSchema,
  RemoveNodeSchema,
  ConnectSchema,
  DisconnectSchema,
  UpdatePropertySchema,
  BatchActionsSchema,
  BatchActionSchema,
}
