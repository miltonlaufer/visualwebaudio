import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  actions?: AudioGraphAction[]
}

export interface AudioGraphAction {
  type: 'addNode' | 'removeNode' | 'addConnection' | 'removeConnection' | 'updateProperty'
  nodeId?: string
  nodeType?: string
  position?: { x: number; y: number }
  sourceId?: string
  targetId?: string
  sourceHandle?: string
  targetHandle?: string
  propertyName?: string
  propertyValue?: unknown
  description?: string
}

export interface LangChainConfig {
  apiKey: string
  provider?: 'openai' | 'anthropic' | 'google'
  model?: string
  temperature?: number
  maxTokens?: number
}

export class LangChainService {
  private chat: ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI | null = null
  private config: LangChainConfig | null = null

  constructor(config?: LangChainConfig) {
    if (config) {
      this.initialize(config)
    }
  }

  initialize(config: LangChainConfig) {
    this.config = config
    const provider = config.provider || 'openai'

    switch (provider) {
      case 'openai':
        this.chat = new ChatOpenAI({
          openAIApiKey: config.apiKey,
          modelName: config.model || 'gpt-3.5-turbo',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 800,
        })
        break

      case 'anthropic':
        this.chat = new ChatAnthropic({
          anthropicApiKey: config.apiKey,
          modelName: config.model || 'claude-3-5-sonnet-20241022',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 800,
        })
        break

      case 'google':
        this.chat = new ChatGoogleGenerativeAI({
          apiKey: config.apiKey,
          model: config.model || 'gemini-pro',
          temperature: config.temperature || 0.7,
          maxOutputTokens: config.maxTokens || 800,
        })
        break

      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  isInitialized(): boolean {
    return this.chat !== null && this.config !== null
  }

  private getSystemPrompt(availableNodeTypes: string[]): string {
    return `You are a senior audio engineer building Web Audio API graphs. Available: ${availableNodeTypes.join(', ')}

CRITICAL RULES:
1. Every graph needs AudioDestinationNode
2. No unconnected nodes
3. Audio flow: sources → effects → AudioDestinationNode
4. Check existing nodes - don't duplicate
5. PROVIDE COMPLETE SETUPS IN ONE REQUEST - include all nodes, connections, and controls needed

WHEN TO CREATE NODES:
- User asks to "create", "add", "make", "build" something new
- User requests specific audio setup (e.g. "vintage synth", "delay effect")
- User wants to add controls to existing nodes

WHEN NOT TO CREATE NODES (return {"actions": []}):
- User asks questions ("can I...", "how do I...", "is it possible...")
- User asks for information or explanations
- User requests already exist in current graph
- User asks about existing functionality

You are a senior audio engineer. Think about all the parameters of the nodes and their relations with the task requested.

COMPLETE SETUPS:
For requests like "vintage synth with delay" or "synth with user control", provide ALL necessary components:
- Audio sources (OscillatorNode with proper waveform)
- Effects chain (filters, delays, etc. with proper parameters)
- User controls (SliderNode + MidiToFreqNode for musical control)
- All connections between nodes
- AudioDestinationNode for output

MUSICAL CONTROL PATTERN:
For musical instruments, always include:
- SliderNode (0-127 MIDI range) → MidiToFreqNode → OscillatorNode.frequency
- This provides proper musical note control

AUDIO ENGINEERING KNOWLEDGE:
- Vintage synths: sawtooth/square waves + lowpass filter + envelope (GainNode) + chorus/delay
- Classic chains: Oscillator → Filter → Gain → Destination
- Musical control: MIDI notes (0-127) via MidiToFreqNode for proper pitch
- Effects order: Distortion → Filter → Delay → Reverb → Gain → Destination

NODE BEHAVIOR:
- OscillatorNode: needs frequency input OR direct property OR silent
- MidiToFreqNode: needs midiNote input (0-127) OR outputs 0Hz
- Audio effects: must be in signal path
- Control nodes: must connect to parameters

FREQUENCY STRATEGY:
- Specific frequency ("440Hz"): set property directly, no controls
- Variable frequency: SliderNode → OscillatorNode.frequency  
- Musical notes: SliderNode(0-127) → MidiToFreqNode → OscillatorNode.frequency
- Add controls only when requested

EXISTING GRAPH:
- Request satisfied: return {"actions": []}
- Need modification: use updateProperty
- Need connections: add missing connections only
- Create new nodes only when necessary

ADDING CONTROLS TO EXISTING PROPERTIES:
- To add slider control to existing property (e.g. frequency=440):
  1. Remove existing property: {"type": "updateProperty", "nodeId": "nodeId", "propertyName": "frequency", "propertyValue": null}
  2. Add slider with that value as default
  3. Connect slider to parameter

CONNECTIONS:
- Audio: "output" → "input"
- Control: "value" → parameter name
- MIDI: "value" → "midiNote", "frequency" → "frequency"

ABSOLUTELY FORBIDDEN: 
- AudioContext nodes
- ANY explanatory text, descriptions, markdown, text before/after JSON
- Creating nodes for questions
- Responding with anything other than pure JSON
- Adding nodes without proper parameters
- Creating unconnected nodes

RESPOND WITH PURE JSON ONLY - NO TEXT WHATSOEVER - NOT EVEN A SINGLE WORD

FORMAT:
{"actions": [
  {"type": "addNode", "nodeType": "NodeType", "nodeId": "uniqueId"},
  {"type": "addConnection", "sourceId": "sourceId", "targetId": "targetId", "sourceHandle": "output", "targetHandle": "input"},
  {"type": "updateProperty", "nodeId": "nodeId", "propertyName": "propertyName", "propertyValue": value}
]}

Use "nodeId" not "id", "propertyValue" not "value". Complete all connections. Positions handled automatically.`
  }

  async processMessage(
    message: string,
    store: AudioGraphStoreType,
    conversationHistory: ChatMessage[] = []
  ): Promise<ChatMessage> {
    if (!this.isInitialized()) {
      throw new Error('LangChain service not initialized. Please provide API key.')
    }

    const availableNodeTypes = store.availableNodeTypes
    const currentNodes = store.visualNodes.map(node => ({
      id: node.id,
      type: node.data.nodeType,
      position: node.position,
    }))
    const currentConnections = store.visualEdges.map(edge => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }))

    // Check if there's an AudioDestinationNode
    const hasDestination = currentNodes.some(node => node.type === 'AudioDestinationNode')

    const systemPrompt = this.getSystemPrompt(availableNodeTypes)
    const contextPrompt = `
Current: ${currentNodes.length} nodes, ${currentConnections.length} connections
${!hasDestination ? '⚠️ NO AudioDestinationNode - MUST CREATE ONE' : '✓ Has AudioDestinationNode'}

Request: ${message}`

    const messages = [
      new SystemMessage(systemPrompt),
      ...conversationHistory
        .slice(-2)
        .map(msg =>
          msg.role === 'user' ? new HumanMessage(msg.content) : new SystemMessage(msg.content)
        ),
      new HumanMessage(contextPrompt),
    ]

    try {
      const response = await this.chat!.invoke(messages)
      const responseContent = response.content as string

      // Try to extract JSON from the response
      const actions = this.extractActionsFromResponse(responseContent)

      const chatMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content:
          responseContent +
          '\n\n---\n💬 **Feedback**: Found an issue or have suggestions? Please report it on our <a href="https://github.com/miltonlaufer/visualwebaudio/issues" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">GitHub Issues</a> page to help improve the AI assistant!',
        timestamp: new Date(),
        actions,
      }

      return chatMessage
    } catch (error) {
      console.error('LangChain API error:', error)
      throw new Error(
        `Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private extractActionsFromResponse(response: string): AudioGraphAction[] {
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanResponse = response.trim()

      // Remove markdown code blocks
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '')

      // Check for truncated JSON (common signs)
      if (cleanResponse.includes('"source') && !cleanResponse.includes('"}]')) {
        console.warn('Detected truncated JSON response - attempting to fix')
        // Try to close the JSON properly
        if (cleanResponse.endsWith('"source')) {
          cleanResponse += 'Handle": "output", "targetHandle": "input"}]}'
        } else if (cleanResponse.endsWith('"sourceHandle": "output", "targetHandle": "input"')) {
          cleanResponse += '}]}'
        } else if (!cleanResponse.endsWith(']}')) {
          cleanResponse += '}]}'
        }
      }

      // Try to find JSON in the response - look for both array and object formats
      let jsonMatch = cleanResponse.match(/\{[\s\S]*"actions"[\s\S]*\}/)

      if (!jsonMatch) {
        // Try to find a direct array format
        jsonMatch = cleanResponse.match(/\[[\s\S]*\]/)
      }

      if (!jsonMatch) {
        // Try to parse the entire response as JSON
        jsonMatch = [cleanResponse]
      }

      if (!jsonMatch) {
        console.warn('No JSON found in response:', response)
        return []
      }

      const jsonStr = jsonMatch[0]

      // Validate JSON before parsing
      try {
        JSON.parse(jsonStr)
      } catch (parseError) {
        console.warn('Invalid JSON detected, attempting to fix:', parseError)
        console.warn('JSON string was:', jsonStr)
        return []
      }

      const parsed = JSON.parse(jsonStr)

      // Handle object with actions array
      if (parsed.actions && Array.isArray(parsed.actions)) {
        return parsed.actions.map((action: any) => ({
          type: action.type,
          nodeId: action.nodeId,
          nodeType: action.nodeType,
          position: action.position,
          sourceId: action.sourceId,
          targetId: action.targetId,
          sourceHandle: action.sourceHandle || 'output',
          targetHandle: action.targetHandle || 'input',
          propertyName: action.propertyName,
          propertyValue: action.propertyValue,
          description: action.description,
        }))
      }

      // Handle direct array format
      if (Array.isArray(parsed)) {
        return parsed.map((action: any) => ({
          type: action.type,
          nodeId: action.nodeId,
          nodeType: action.nodeType,
          position: action.position,
          sourceId: action.sourceId,
          targetId: action.targetId,
          sourceHandle: action.sourceHandle || 'output',
          targetHandle: action.targetHandle || 'input',
          propertyName: action.propertyName,
          propertyValue: action.propertyValue,
          description: action.description,
        }))
      }

      console.warn('Parsed JSON does not contain actions array or is not an array:', parsed)
      return []
    } catch (error) {
      console.warn('Failed to parse actions from response:', error)
      console.warn('Response was:', response)
      return []
    }
  }

  async executeActions(actions: AudioGraphAction[], store: AudioGraphStoreType): Promise<void> {
    // Create a mapping from AI-provided nodeIds to actual generated nodeIds
    const nodeIdMapping: Record<string, string> = {}

    // First pass: Add all nodes (except forbidden ones) and build ID mapping
    for (const action of actions) {
      if (action.type === 'addNode' && action.nodeType) {
        // Skip forbidden node types
        if (action.nodeType === 'AudioContext') {
          console.warn('Skipping AudioContext node - managed automatically')
          continue
        }

        try {
          const nodeCountBefore = store.visualNodes.length
          // Use provided position or default to (0, 0) - will be repositioned by smart layout
          const position = action.position || { x: 0, y: 0 }
          store.addNode(action.nodeType, position)

          // Map AI's nodeId to the actual generated nodeId
          if (action.nodeId && store.visualNodes.length > nodeCountBefore) {
            const newNode = store.visualNodes[store.visualNodes.length - 1]
            nodeIdMapping[action.nodeId] = newNode.id
            console.log(`Mapped AI nodeId "${action.nodeId}" to actual nodeId "${newNode.id}"`)
          }
        } catch (error) {
          console.error('Failed to add node:', action, error)
        }
      }
    }

    // Second pass: Handle other actions (connections, property updates, removals) using the mapping
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'removeNode':
            if (action.nodeId) {
              const actualNodeId = nodeIdMapping[action.nodeId] || action.nodeId
              store.removeNode(actualNodeId)
            }
            break

          case 'addConnection':
            if (action.sourceId && action.targetId) {
              // Use mapped IDs if available, otherwise try to find nodes
              const sourceId = nodeIdMapping[action.sourceId] || action.sourceId
              const targetId = nodeIdMapping[action.targetId] || action.targetId

              let sourceNode = store.visualNodes.find(n => n.id === sourceId)
              let targetNode = store.visualNodes.find(n => n.id === targetId)

              // Fallback to intelligent matching if direct ID lookup fails
              if (!sourceNode) {
                sourceNode = this.findNodeByIdOrType(store, action.sourceId)
              }
              if (!targetNode) {
                targetNode = this.findNodeByIdOrType(store, action.targetId)
              }

              if (sourceNode && targetNode) {
                store.addEdge(
                  sourceNode.id,
                  targetNode.id,
                  action.sourceHandle || 'output',
                  action.targetHandle || 'input'
                )
                console.log(
                  `✅ Connected ${sourceNode.data.nodeType} → ${targetNode.data.nodeType}`
                )
              } else {
                console.warn(
                  'Could not find nodes for connection:',
                  action.sourceId,
                  '→',
                  action.targetId
                )
              }
            }
            break

          case 'removeConnection':
            if (action.sourceId && action.targetId) {
              const sourceId = nodeIdMapping[action.sourceId] || action.sourceId
              const targetId = nodeIdMapping[action.targetId] || action.targetId

              const edge = store.visualEdges.find(
                e =>
                  e.source === sourceId &&
                  e.target === targetId &&
                  e.sourceHandle === (action.sourceHandle || 'output') &&
                  e.targetHandle === (action.targetHandle || 'input')
              )
              if (edge) {
                store.removeEdge(edge.id)
              }
            }
            break

          case 'updateProperty':
            if (action.nodeId && action.propertyName && action.propertyValue !== undefined) {
              const actualNodeId = nodeIdMapping[action.nodeId] || action.nodeId
              let node = store.visualNodes.find(n => n.id === actualNodeId)

              // Fallback to intelligent matching if direct ID lookup fails
              if (!node) {
                node = this.findNodeByIdOrType(store, action.nodeId)
              }

              if (node) {
                store.updateNodeProperty(node.id, action.propertyName, action.propertyValue)
              }
            }
            break

          default:
            if (action.type !== 'addNode') {
              console.warn('Unknown action type:', action.type)
            }
        }
      } catch (error) {
        console.error('Failed to execute action:', action, error)
      }
    }

    // Third pass: Only ensure proper audio chain if we added new nodes AND the AI didn't provide explicit connections
    const hasAddNodeActions = actions.some(action => action.type === 'addNode')
    const hasConnectionActions = actions.some(action => action.type === 'addConnection')

    // If AI provided explicit connections, trust them and only do minimal auto-connection
    if (hasAddNodeActions && !hasConnectionActions) {
      console.log('AI provided no connections - running full auto-connection')
      this.ensureProperAudioChain(store)
    } else if (hasAddNodeActions && hasConnectionActions) {
      console.log('AI provided explicit connections - only connecting truly unconnected nodes')
      this.connectOnlyUnconnectedNodes(store)
    }

    // Always apply pro audio engineering (including labeling) when nodes are added
    if (hasAddNodeActions) {
      console.log('Applying pro audio engineering and labeling')
      const availableSliders = store.visualNodes.filter(node => {
        const isSlider = node.data.nodeType === 'SliderNode'
        const isUnconnected = !store.visualEdges.some(edge => edge.source === node.id)
        return isSlider && isUnconnected
      })
      this.applyProAudioEngineering(store, availableSliders)
    }

    // Fourth pass: Smart auto-layout to prevent overlapping nodes
    if (hasAddNodeActions) {
      console.log('Applying smart auto-layout to prevent overlapping')
      this.applySmartLayout(store)
    }
  }

  private findNodeByIdOrType(store: AudioGraphStoreType, identifier: string) {
    // First try to find by exact ID
    let node = store.visualNodes.find(n => n.id === identifier)

    // If not found, try intelligent matching based on AI intent
    if (!node) {
      // Create a mapping of common AI identifiers to node types
      const identifierToNodeType: Record<string, string> = {
        oscillator: 'OscillatorNode',
        osc: 'OscillatorNode',
        synth: 'OscillatorNode',
        filter: 'BiquadFilterNode',
        biquad: 'BiquadFilterNode',
        lowpass: 'BiquadFilterNode',
        highpass: 'BiquadFilterNode',
        delay: 'DelayNode',
        echo: 'DelayNode',
        reverb: 'ConvolverNode',
        gain: 'GainNode',
        volume: 'GainNode',
        amp: 'GainNode',
        output: 'AudioDestinationNode',
        destination: 'AudioDestinationNode',
        speakers: 'AudioDestinationNode',
        compressor: 'DynamicsCompressorNode',
        dynamics: 'DynamicsCompressorNode',
        limiter: 'DynamicsCompressorNode',
        panner: 'StereoPannerNode',
        pan: 'StereoPannerNode',
        stereo: 'StereoPannerNode',
        waveshaper: 'WaveShaperNode',
        distortion: 'WaveShaperNode',
        overdrive: 'WaveShaperNode',
        analyser: 'AnalyserNode',
        analyzer: 'AnalyserNode',
        fft: 'AnalyserNode',
        pitchSlider: 'SliderNode',
        delaySlider: 'SliderNode',
        volumeSlider: 'SliderNode',
        slider: 'SliderNode',
        control: 'SliderNode',
        midiToFreq: 'MidiToFreqNode',
        midi: 'MidiToFreqNode',
        frequency: 'MidiToFreqNode',
        feedbackGain: 'GainNode',
        feedback: 'GainNode',
        wetGain: 'GainNode',
        dryGain: 'GainNode',
        mixGain: 'GainNode',
      }

      // Try to find by mapped node type
      const expectedNodeType = identifierToNodeType[identifier.toLowerCase()]
      if (expectedNodeType) {
        // Find the most recently added node of this type that doesn't have the connections we expect
        const candidateNodes = store.visualNodes
          .filter(n => n.data.nodeType === expectedNodeType)
          .sort((a, b) => {
            // Sort by creation time (assuming higher IDs are more recent)
            const aTime = parseInt(a.id.split('-').pop() || '0')
            const bTime = parseInt(b.id.split('-').pop() || '0')
            return bTime - aTime
          })

        // For specific identifiers, try to find the most appropriate node
        if (identifier.toLowerCase().includes('feedback') && expectedNodeType === 'GainNode') {
          // For feedback gain, find a gain node that's positioned near a delay node
          node = candidateNodes.find(gainNode => {
            const nearbyDelayNode = store.visualNodes.find(
              delayNode =>
                delayNode.data.nodeType === 'DelayNode' &&
                Math.abs(delayNode.position.x - gainNode.position.x) < 200 &&
                Math.abs(delayNode.position.y - gainNode.position.y) < 200
            )
            return nearbyDelayNode !== undefined
          })
        }

        if (!node && candidateNodes.length > 0) {
          // Default to the most recently created node of the expected type
          node = candidateNodes[0]
        }
      }

      // If still not found, try broader matching
      if (!node) {
        node = store.visualNodes.find(
          n =>
            n.data.nodeType === identifier ||
            n.data.nodeType.toLowerCase().includes(identifier.toLowerCase()) ||
            identifier.toLowerCase().includes(n.data.nodeType.toLowerCase()) ||
            n.id.toLowerCase().includes(identifier.toLowerCase())
        )
      }

      // If still not found, try partial matching on the node type
      if (!node) {
        const lowerIdentifier = identifier.toLowerCase()
        node = store.visualNodes.find(n => {
          const nodeTypeLower = n.data.nodeType.toLowerCase()
          return (
            nodeTypeLower.includes(lowerIdentifier) ||
            lowerIdentifier.includes(nodeTypeLower.replace('node', ''))
          )
        })
      }
    }

    if (node) {
      console.log(
        `🎯 Found node for identifier "${identifier}": ${node.data.nodeType} (${node.id})`
      )
    } else {
      console.warn(`❌ Could not find node for identifier "${identifier}"`)
    }

    return node
  }

  private connectOnlyUnconnectedNodes(store: AudioGraphStoreType): void {
    // This is a more conservative version of ensureProperAudioChain
    // It only connects nodes that are completely unconnected, without overriding AI's explicit connections

    // Ensure we have an AudioDestinationNode
    let destinationNode = store.visualNodes.find(
      node => node.data.nodeType === 'AudioDestinationNode'
    )

    if (!destinationNode) {
      const rightmostX = store.visualNodes.reduce((max, node) => Math.max(max, node.position.x), 0)
      store.addNode('AudioDestinationNode', {
        x: rightmostX + 400,
        y: 100,
      })
      destinationNode = store.visualNodes[store.visualNodes.length - 1]
    }

    if (!destinationNode) return

    // Only connect nodes that have NO connections at all (completely isolated)
    const completelyUnconnectedNodes = store.visualNodes.filter(node => {
      const hasAnyConnection = store.visualEdges.some(
        edge => edge.source === node.id || edge.target === node.id
      )
      return !hasAnyConnection && node.data.nodeType !== 'AudioDestinationNode'
    })

    // Connect only audio source nodes that are completely unconnected
    completelyUnconnectedNodes.forEach(node => {
      const nodeType = node.data.nodeType
      const isAudioSource = [
        'OscillatorNode',
        'AudioBufferSourceNode',
        'MediaStreamAudioSourceNode',
        'MediaElementAudioSourceNode',
        'ConstantSourceNode',
      ].includes(nodeType)

      if (isAudioSource) {
        try {
          store.addEdge(node.id, destinationNode!.id, 'output', 'input')
          console.log(`Connected isolated ${nodeType} to destination`)
        } catch (error) {
          console.error('Failed to connect isolated source to destination:', error)
        }
      }
    })

    console.log('Minimal auto-connection complete - preserved AI connections')
  }

  private ensureProperAudioChain(store: AudioGraphStoreType): void {
    // Check if we have an AudioDestinationNode
    let destinationNode = store.visualNodes.find(
      node => node.data.nodeType === 'AudioDestinationNode'
    )

    // If no destination node, create one
    if (!destinationNode) {
      const rightmostX = store.visualNodes.reduce((max, node) => Math.max(max, node.position.x), 0)

      store.addNode('AudioDestinationNode', {
        x: rightmostX + 400, // Increased spacing from 300 to 400
        y: 100,
      })

      destinationNode = store.visualNodes[store.visualNodes.length - 1]
    }

    if (!destinationNode) return

    // CRITICAL: NO UNCONNECTED NODES ALLOWED
    // Every node must either:
    // 1. Be part of the audio signal chain (audio input/output connections)
    // 2. Control parameters of other nodes (parameter connections)
    // 3. Be connected to the destination if it's an audio source

    // PRIORITY 1: Complete MIDI musical setups (PREFERRED FOR MUSICAL APPLICATIONS)
    // Find components for complete musical chain
    const unconnectedSliders = store.visualNodes.filter(node => {
      const isSlider = node.data.nodeType === 'SliderNode'
      const hasOutgoingConnection = store.visualEdges.some(edge => edge.source === node.id)
      return isSlider && !hasOutgoingConnection
    })

    const unconnectedMidiToFreq = store.visualNodes.filter(node => {
      const isMidiToFreq = node.data.nodeType === 'MidiToFreqNode'
      const hasIncomingConnection = store.visualEdges.some(edge => edge.target === node.id)
      return isMidiToFreq && !hasIncomingConnection
    })

    const oscillatorsNeedingFreqControl = store.visualNodes.filter(node => {
      const isOscillator = node.data.nodeType === 'OscillatorNode'
      const hasFreqConnection = store.visualEdges.some(
        edge => edge.target === node.id && edge.targetHandle === 'frequency'
      )
      // Check if frequency property is already set
      const hasFreqProperty =
        node.data.properties.has('frequency') && node.data.properties.get('frequency') !== undefined
      return isOscillator && !hasFreqConnection && !hasFreqProperty
    })

    // PRIORITY 1A: If we have oscillators that need frequency control AND no MidiToFreqNode, CREATE ONE for musical control
    // BUT ONLY if the oscillators don't already have their frequency set
    if (oscillatorsNeedingFreqControl.length > 0 && unconnectedMidiToFreq.length === 0) {
      // Create MidiToFreqNode for musical control with better spacing
      const rightmostX = store.visualNodes.reduce((max, node) => Math.max(max, node.position.x), 0)

      store.addNode('MidiToFreqNode', {
        x: rightmostX + 400, // Increased spacing from 200 to 400
        y: oscillatorsNeedingFreqControl[0].position.y,
      })

      // Update the list to include the newly created MidiToFreqNode
      const newMidiToFreq = store.visualNodes[store.visualNodes.length - 1]
      if (newMidiToFreq && newMidiToFreq.data.nodeType === 'MidiToFreqNode') {
        console.log('Created MidiToFreqNode for musical frequency control')
      }
    }

    // Re-fetch after potential creation
    const updatedUnconnectedMidiToFreq = store.visualNodes.filter(node => {
      const isMidiToFreq = node.data.nodeType === 'MidiToFreqNode'
      const hasIncomingConnection = store.visualEdges.some(edge => edge.target === node.id)
      return isMidiToFreq && !hasIncomingConnection
    })

    // PRIORITY 1B: Create complete MIDI musical setup if components are available
    if (
      unconnectedSliders.length > 0 &&
      updatedUnconnectedMidiToFreq.length > 0 &&
      oscillatorsNeedingFreqControl.length > 0
    ) {
      const slider = unconnectedSliders[0]
      const midiToFreq = updatedUnconnectedMidiToFreq[0]
      const oscillator = oscillatorsNeedingFreqControl[0]

      try {
        // Create complete MIDI control chain: Slider → MidiToFreq → Oscillator.frequency
        store.addEdge(slider.id, midiToFreq.id, 'value', 'midiNote')
        store.addEdge(midiToFreq.id, oscillator.id, 'frequency', 'frequency')

        // Set up slider for MIDI range (0-127)
        store.updateNodeProperty(slider.id, 'min', 0)
        store.updateNodeProperty(slider.id, 'max', 127)
        store.updateNodeProperty(slider.id, 'value', 60) // Middle C
        store.updateNodeProperty(slider.id, 'step', 1)
        store.updateNodeProperty(slider.id, 'label', 'MIDI Note')

        console.log('Created complete MIDI control chain')
      } catch (error) {
        console.error('Failed to create MIDI control chain:', error)
      }
    }
    // If we have MidiToFreq and Oscillator but no slider, still connect them
    else if (updatedUnconnectedMidiToFreq.length > 0 && oscillatorsNeedingFreqControl.length > 0) {
      const midiToFreq = updatedUnconnectedMidiToFreq[0]
      const oscillator = oscillatorsNeedingFreqControl[0]

      try {
        store.addEdge(midiToFreq.id, oscillator.id, 'frequency', 'frequency')
        console.log('Connected MidiToFreq to Oscillator')
      } catch (error) {
        console.error('Failed to connect MidiToFreq to Oscillator:', error)
      }
    }
    // If we have sliders and oscillators but no MidiToFreq, connect directly for frequency control
    else if (unconnectedSliders.length > 0 && oscillatorsNeedingFreqControl.length > 0) {
      const slider = unconnectedSliders[0]
      const oscillator = oscillatorsNeedingFreqControl[0]

      try {
        store.addEdge(slider.id, oscillator.id, 'value', 'frequency')

        // Set up slider for frequency range
        store.updateNodeProperty(slider.id, 'min', 100)
        store.updateNodeProperty(slider.id, 'max', 2000)
        store.updateNodeProperty(slider.id, 'value', 440)
        store.updateNodeProperty(slider.id, 'step', 10)
        store.updateNodeProperty(slider.id, 'label', 'Frequency (Hz)')

        console.log('Created direct frequency control')
      } catch (error) {
        console.error('Failed to create frequency control:', error)
      }
    }

    // PRIORITY 2: Connect ALL unconnected audio source nodes to destination
    const allAudioSources = store.visualNodes.filter(node => {
      const nodeType = node.data.nodeType
      const isAudioSource = [
        'OscillatorNode',
        'AudioBufferSourceNode',
        'MediaStreamAudioSourceNode',
        'MediaElementAudioSourceNode',
        'ConstantSourceNode',
      ].includes(nodeType)

      // Check if this node has any outgoing audio connections
      const hasOutgoingAudioConnection = store.visualEdges.some(
        edge => edge.source === node.id && edge.sourceHandle === 'output'
      )

      return isAudioSource && !hasOutgoingAudioConnection
    })

    // Connect ALL unconnected source nodes to destination
    allAudioSources.forEach(sourceNode => {
      try {
        store.addEdge(sourceNode.id, destinationNode!.id, 'output', 'input')
        console.log(`Connected ${sourceNode.data.nodeType} to destination`)
      } catch (error) {
        console.error('Failed to connect source to destination:', error)
      }
    })

    // PRIORITY 3: Insert effect nodes into existing audio chains
    const unconnectedEffectNodes = store.visualNodes.filter(node => {
      const nodeType = node.data.nodeType
      const isEffect = [
        'GainNode',
        'BiquadFilterNode',
        'DelayNode',
        'ConvolverNode',
        'DynamicsCompressorNode',
        'WaveShaperNode',
        'StereoPannerNode',
      ].includes(nodeType)

      const hasAudioConnections = store.visualEdges.some(
        edge =>
          (edge.source === node.id && edge.sourceHandle === 'output') ||
          (edge.target === node.id && edge.targetHandle === 'input')
      )

      return isEffect && !hasAudioConnections
    })

    // Find existing audio chains to insert effects into
    const connectedSources = store.visualNodes.filter(node => {
      const nodeType = node.data.nodeType
      const isAudioSource = [
        'OscillatorNode',
        'AudioBufferSourceNode',
        'MediaStreamAudioSourceNode',
        'MediaElementAudioSourceNode',
        'ConstantSourceNode',
      ].includes(nodeType)

      const hasOutgoingConnection = store.visualEdges.some(
        edge => edge.source === node.id && edge.sourceHandle === 'output'
      )

      return isAudioSource && hasOutgoingConnection
    })

    // Insert unconnected effects into existing chains
    unconnectedEffectNodes.forEach(effectNode => {
      if (connectedSources.length > 0) {
        const sourceNode = connectedSources[0]

        try {
          // Find the current connection from source to destination
          const directConnection = store.visualEdges.find(
            edge => edge.source === sourceNode.id && edge.target === destinationNode.id
          )

          if (directConnection) {
            // Remove direct connection
            store.removeEdge(directConnection.id)

            // Create source → effect → destination chain
            store.addEdge(sourceNode.id, effectNode.id, 'output', 'input')
            store.addEdge(effectNode.id, destinationNode.id, 'output', 'input')
            console.log(`Inserted ${effectNode.data.nodeType} into audio chain`)
          }
        } catch (error) {
          console.error('Failed to insert effect into chain:', error)
        }
      }
    })

    // PRIORITY 4: Connect ALL remaining sliders to available parameters
    const stillUnconnectedSliders = store.visualNodes.filter(node => {
      const isSlider = node.data.nodeType === 'SliderNode'
      const hasOutgoingConnection = store.visualEdges.some(edge => edge.source === node.id)
      return isSlider && !hasOutgoingConnection
    })

    // 🎛️ PRO AUDIO ENGINEERING: Apply proper parameter controls for audio effects
    this.applyProAudioEngineering(store, stillUnconnectedSliders)

    // Re-fetch unconnected sliders after pro audio setup
    const remainingUnconnectedSliders = store.visualNodes.filter(node => {
      const isSlider = node.data.nodeType === 'SliderNode'
      const hasOutgoingConnection = store.visualEdges.some(edge => edge.source === node.id)
      return isSlider && !hasOutgoingConnection
    })

    // Find nodes with uncontrolled parameters
    const nodesNeedingControl = store.visualNodes.filter(node => {
      const nodeType = node.data.nodeType

      // Define which nodes have which controllable parameters
      const controllableParams: Record<string, string[]> = {
        GainNode: ['gain'],
        BiquadFilterNode: ['frequency', 'Q', 'gain'],
        DelayNode: ['delayTime'],
        DynamicsCompressorNode: ['threshold', 'ratio', 'attack', 'release'],
        OscillatorNode: ['frequency', 'detune'],
        StereoPannerNode: ['pan'],
        WaveShaperNode: ['curve'],
        ConvolverNode: ['normalize'],
        AnalyserNode: ['fftSize', 'smoothingTimeConstant'],
      }

      const params = controllableParams[nodeType] || []

      // Check if any parameter is uncontrolled
      return params.some(param => {
        const hasParamConnection = store.visualEdges.some(
          edge => edge.target === node.id && edge.targetHandle === param
        )
        return !hasParamConnection
      })
    })

    // Connect remaining sliders to available parameters
    remainingUnconnectedSliders.forEach((slider, index) => {
      if (index < nodesNeedingControl.length) {
        const targetNode = nodesNeedingControl[index]
        const nodeType = targetNode.data.nodeType

        // Determine best parameter to control and slider configuration
        let targetParam = 'gain'
        let sliderConfig = { min: 0, max: 100, value: 50, step: 1, label: 'Control' }

        if (nodeType === 'GainNode') {
          targetParam = 'gain'
          sliderConfig = { min: 0, max: 100, value: 50, step: 1, label: 'Volume' }
        } else if (nodeType === 'BiquadFilterNode') {
          // Check if frequency is already controlled
          const hasFreqControl = store.visualEdges.some(
            edge => edge.target === targetNode.id && edge.targetHandle === 'frequency'
          )
          if (!hasFreqControl) {
            targetParam = 'frequency'
            sliderConfig = {
              min: 100,
              max: 10000,
              value: 1000,
              step: 10,
              label: 'Filter Frequency',
            }
          } else {
            targetParam = 'Q'
            sliderConfig = { min: 0.1, max: 30, value: 5, step: 0.1, label: 'Filter Resonance' }
          }
        } else if (nodeType === 'DelayNode') {
          targetParam = 'delayTime'
          sliderConfig = { min: 0.001, max: 1.0, value: 0.3, step: 0.001, label: 'Delay Time (s)' }
        } else if (nodeType === 'OscillatorNode') {
          // Check if frequency is already controlled
          const hasFreqControl = store.visualEdges.some(
            edge => edge.target === targetNode.id && edge.targetHandle === 'frequency'
          )
          if (!hasFreqControl) {
            targetParam = 'frequency'
            sliderConfig = { min: 20, max: 5000, value: 440, step: 1, label: 'Frequency (Hz)' }
          } else {
            targetParam = 'detune'
            sliderConfig = { min: -100, max: 100, value: 0, step: 1, label: 'Detune (cents)' }
          }
        } else if (nodeType === 'DynamicsCompressorNode') {
          targetParam = 'threshold'
          sliderConfig = { min: -50, max: 0, value: -24, step: 1, label: 'Compressor Threshold' }
        } else if (nodeType === 'StereoPannerNode') {
          targetParam = 'pan'
          sliderConfig = { min: -1, max: 1, value: 0, step: 0.1, label: 'Stereo Pan' }
        } else if (nodeType === 'WaveShaperNode') {
          targetParam = 'curve'
          sliderConfig = { min: 0, max: 100, value: 50, step: 1, label: 'Distortion Drive' }
        } else if (nodeType === 'ConvolverNode') {
          targetParam = 'normalize'
          sliderConfig = { min: 0, max: 1, value: 1, step: 0.1, label: 'Reverb Mix' }
        }

        try {
          store.addEdge(slider.id, targetNode.id, 'value', targetParam)

          // Configure slider with descriptive label and appropriate range
          store.updateNodeProperty(slider.id, 'min', sliderConfig.min)
          store.updateNodeProperty(slider.id, 'max', sliderConfig.max)
          store.updateNodeProperty(slider.id, 'value', sliderConfig.value)
          store.updateNodeProperty(slider.id, 'step', sliderConfig.step)
          store.updateNodeProperty(slider.id, 'label', sliderConfig.label)

          console.log(`Connected slider "${sliderConfig.label}" to ${nodeType}.${targetParam}`)
        } catch (error) {
          console.error('Failed to connect slider to parameter:', error)
        }
      }
    })

    // PRIORITY 5: Handle special delay feedback loops
    const delayNodes = store.visualNodes.filter(node => node.data.nodeType === 'DelayNode')

    delayNodes.forEach(delayNode => {
      // Check if delay has feedback loop
      const hasFeedbackLoop = store.visualEdges.some(
        edge => edge.source === delayNode.id && edge.target === delayNode.id
      )

      if (!hasFeedbackLoop) {
        // Find or create a GainNode for feedback
        let feedbackGain = store.visualNodes.find(node => {
          const isGain = node.data.nodeType === 'GainNode'
          const isUnconnected = !store.visualEdges.some(
            edge => edge.source === node.id || edge.target === node.id
          )
          return isGain && isUnconnected
        })

        if (!feedbackGain) {
          // Create feedback gain node
          store.addNode('GainNode', {
            x: delayNode.position.x,
            y: delayNode.position.y + 100,
          })
          feedbackGain = store.visualNodes[store.visualNodes.length - 1]

          // Set feedback gain to 30%
          store.updateNodeProperty(feedbackGain.id, 'gain', 0.3)
        }

        try {
          // Create feedback loop: DelayNode → GainNode → DelayNode
          store.addEdge(delayNode.id, feedbackGain.id, 'output', 'input')
          store.addEdge(feedbackGain.id, delayNode.id, 'output', 'input')
          console.log('Created delay feedback loop')
        } catch (error) {
          console.error('Failed to create delay feedback loop:', error)
        }
      }
    })

    // PRIORITY 6: Final check - connect ANY remaining unconnected nodes
    const finalUnconnectedNodes = store.visualNodes.filter(node => {
      const hasAnyConnection = store.visualEdges.some(
        edge => edge.source === node.id || edge.target === node.id
      )
      return !hasAnyConnection && node.data.nodeType !== 'AudioDestinationNode'
    })

    // Force connect any remaining nodes
    finalUnconnectedNodes.forEach(node => {
      const nodeType = node.data.nodeType

      try {
        if (['ButtonNode', 'DisplayNode'].includes(nodeType)) {
          // Connect utility nodes to the first available audio source
          const audioSource = store.visualNodes.find(n =>
            ['OscillatorNode', 'AudioBufferSourceNode'].includes(n.data.nodeType)
          )
          if (audioSource) {
            if (nodeType === 'DisplayNode') {
              // Connect audio source to display for monitoring
              store.addEdge(audioSource.id, node.id, 'output', 'input')
              // Set descriptive label for display
              store.updateNodeProperty(node.id, 'label', 'Audio Level Monitor')
              console.log(`Connected DisplayNode "Audio Level Monitor" to audio chain`)
            } else if (nodeType === 'ButtonNode') {
              // Connect button to audio source start/stop (if available)
              store.addEdge(node.id, audioSource.id, 'trigger', 'start')
              // Set descriptive label for button
              store.updateNodeProperty(node.id, 'label', 'Play/Stop')
              console.log(`Connected ButtonNode "Play/Stop" to audio chain`)
            }
          }
        } else {
          // For any other unconnected node, try to connect it to destination as audio
          store.addEdge(node.id, destinationNode!.id, 'output', 'input')
          console.log(`Force-connected ${nodeType} to destination`)
        }
      } catch (error) {
        console.error(`Failed to force-connect ${nodeType}:`, error)
      }
    })

    console.log('Audio chain verification complete - NO UNCONNECTED NODES ALLOWED')
  }

  private applyProAudioEngineering(store: AudioGraphStoreType, availableSliders: any[]): void {
    // 🎛️ PRO AUDIO ENGINEERING: Apply proper parameter controls for audio effects

    // 1. DelayNode: ALWAYS add delayTime control
    const delayNodes = store.visualNodes.filter(node => {
      const isDelay = node.data.nodeType === 'DelayNode'
      const hasDelayTimeControl = store.visualEdges.some(
        edge => edge.target === node.id && edge.targetHandle === 'delayTime'
      )
      return isDelay && !hasDelayTimeControl
    })

    delayNodes.forEach(delayNode => {
      if (availableSliders.length > 0) {
        const slider = availableSliders.shift()
        try {
          store.addEdge(slider.id, delayNode.id, 'value', 'delayTime')
          store.updateNodeProperty(slider.id, 'min', 0.001)
          store.updateNodeProperty(slider.id, 'max', 1.0)
          store.updateNodeProperty(slider.id, 'value', 0.3)
          store.updateNodeProperty(slider.id, 'step', 0.001)
          store.updateNodeProperty(slider.id, 'label', 'Delay Time')
          console.log('Added delay time control')
        } catch (error) {
          console.error('Failed to add delay time control:', error)
        }
      }
    })

    // 2. BiquadFilterNode: Add frequency control
    const filterNodes = store.visualNodes.filter(node => {
      const isFilter = node.data.nodeType === 'BiquadFilterNode'
      const hasFreqControl = store.visualEdges.some(
        edge => edge.target === node.id && edge.targetHandle === 'frequency'
      )
      return isFilter && !hasFreqControl
    })

    filterNodes.forEach(filterNode => {
      if (availableSliders.length > 0) {
        const slider = availableSliders.shift()
        try {
          store.addEdge(slider.id, filterNode.id, 'value', 'frequency')
          store.updateNodeProperty(slider.id, 'min', 100)
          store.updateNodeProperty(slider.id, 'max', 10000)
          store.updateNodeProperty(slider.id, 'value', 1000)
          store.updateNodeProperty(slider.id, 'step', 10)
          store.updateNodeProperty(slider.id, 'label', 'Filter Freq')
          console.log('Added filter frequency control')
        } catch (error) {
          console.error('Failed to add filter frequency control:', error)
        }
      }
    })

    // 3. GainNode: Add gain control (if not already used for volume in audio chain)
    const gainNodes = store.visualNodes.filter(node => {
      const isGain = node.data.nodeType === 'GainNode'
      const hasGainControl = store.visualEdges.some(
        edge => edge.target === node.id && edge.targetHandle === 'gain'
      )
      return isGain && !hasGainControl
    })

    gainNodes.forEach(gainNode => {
      if (availableSliders.length > 0) {
        const slider = availableSliders.shift()
        try {
          store.addEdge(slider.id, gainNode.id, 'value', 'gain')
          store.updateNodeProperty(slider.id, 'min', 0)
          store.updateNodeProperty(slider.id, 'max', 100)
          store.updateNodeProperty(slider.id, 'value', 50)
          store.updateNodeProperty(slider.id, 'step', 1)
          store.updateNodeProperty(slider.id, 'label', 'Volume')
          console.log('Added volume control')
        } catch (error) {
          console.error('Failed to add volume control:', error)
        }
      }
    })

    // 4. DynamicsCompressorNode: Add threshold control
    const compressorNodes = store.visualNodes.filter(node => {
      const isCompressor = node.data.nodeType === 'DynamicsCompressorNode'
      const hasThresholdControl = store.visualEdges.some(
        edge => edge.target === node.id && edge.targetHandle === 'threshold'
      )
      return isCompressor && !hasThresholdControl
    })

    compressorNodes.forEach(compressorNode => {
      if (availableSliders.length > 0) {
        const slider = availableSliders.shift()
        try {
          store.addEdge(slider.id, compressorNode.id, 'value', 'threshold')
          store.updateNodeProperty(slider.id, 'min', -50)
          store.updateNodeProperty(slider.id, 'max', 0)
          store.updateNodeProperty(slider.id, 'value', -24)
          store.updateNodeProperty(slider.id, 'step', 1)
          store.updateNodeProperty(slider.id, 'label', 'Threshold')
          console.log('Added compressor threshold control')
        } catch (error) {
          console.error('Failed to add compressor threshold control:', error)
        }
      }
    })

    // 5. Label all remaining utility nodes that don't have labels
    this.labelUtilityNodes(store)
  }

  private labelUtilityNodes(store: AudioGraphStoreType): void {
    // Label unlabeled utility nodes
    store.visualNodes.forEach(node => {
      const nodeType = node.data.nodeType
      const currentLabel = node.data.properties.get('label')

      if (!currentLabel || currentLabel === '') {
        let defaultLabel = ''

        if (nodeType === 'SliderNode') {
          defaultLabel = 'Control'
        } else if (nodeType === 'ButtonNode') {
          defaultLabel = 'Trigger'
        } else if (nodeType === 'DisplayNode') {
          defaultLabel = 'Monitor'
        }

        if (defaultLabel) {
          try {
            store.updateNodeProperty(node.id, 'label', defaultLabel)
            console.log(`Labeled ${nodeType} as "${defaultLabel}"`)
          } catch (error) {
            console.error(`Failed to label ${nodeType}:`, error)
          }
        }
      }
    })
  }

  private applySmartLayout(store: AudioGraphStoreType): void {
    // Create a flow-based layout that follows the audio signal chain
    const nodes = store.visualNodes
    const edges = store.visualEdges

    if (nodes.length === 0) return

    // Find the audio signal flow by starting from sources and following connections
    const audioSources = nodes.filter(node =>
      [
        'OscillatorNode',
        'AudioBufferSourceNode',
        'MediaStreamAudioSourceNode',
        'MediaElementAudioSourceNode',
        'ConstantSourceNode',
      ].includes(node.data.nodeType)
    )

    // Layout configuration
    const HORIZONTAL_SPACING = 200
    const VERTICAL_SPACING = 150
    const START_X = 50
    const START_Y = 100

    // Track positioned nodes to avoid duplicates
    const positionedNodes = new Set<string>()

    // Position audio signal chain(s)
    audioSources.forEach((source, sourceIndex) => {
      const chain = this.buildAudioChain(source, edges, nodes)
      const baseY = START_Y + sourceIndex * VERTICAL_SPACING * 2

      chain.forEach((node, index) => {
        if (!positionedNodes.has(node.id)) {
          const newPosition = {
            x: START_X + index * HORIZONTAL_SPACING,
            y: baseY,
          }
          store.updateNodePosition(node.id, newPosition)
          positionedNodes.add(node.id)
          console.log(`Positioned ${node.data.nodeType} at (${newPosition.x}, ${newPosition.y})`)
        }
      })
    })

    // Position control nodes (sliders, buttons, etc.) above their targets
    const controlNodes = nodes.filter(node =>
      ['SliderNode', 'ButtonNode', 'MidiToFreqNode', 'RandomNode', 'TimerNode'].includes(
        node.data.nodeType
      )
    )

    controlNodes.forEach(controlNode => {
      if (!positionedNodes.has(controlNode.id)) {
        // Find what this control node connects to
        const targetEdge = edges.find(edge => edge.source === controlNode.id)
        if (targetEdge) {
          const targetNode = nodes.find(n => n.id === targetEdge.target)
          if (targetNode && positionedNodes.has(targetNode.id)) {
            // Position control node above its target
            const newPosition = {
              x: targetNode.position.x,
              y: targetNode.position.y - VERTICAL_SPACING,
            }
            store.updateNodePosition(controlNode.id, newPosition)
            positionedNodes.add(controlNode.id)
            console.log(
              `🎛️ Positioned ${controlNode.data.nodeType} above ${targetNode.data.nodeType}`
            )
          }
        }
      }
    })

    // Position any remaining unpositioned nodes in a grid
    const unpositionedNodes = nodes.filter(node => !positionedNodes.has(node.id))
    unpositionedNodes.forEach((node, index) => {
      const gridX = START_X + (index % 4) * HORIZONTAL_SPACING
      const gridY = START_Y + Math.floor(index / 4) * VERTICAL_SPACING + VERTICAL_SPACING * 3

      const newPosition = { x: gridX, y: gridY }
      store.updateNodePosition(node.id, newPosition)
      console.log(
        `📋 Positioned remaining ${node.data.nodeType} in grid at (${newPosition.x}, ${newPosition.y})`
      )
    })

    console.log('Smart layout complete - nodes positioned based on signal flow')
  }

  private buildAudioChain(startNode: any, edges: any[], allNodes: any[]): any[] {
    const chain = [startNode]
    const visited = new Set([startNode.id])

    let currentNode = startNode

    // Follow the audio output connections to build the chain
    while (true) {
      const nextEdge = edges.find(
        (edge: any) =>
          edge.source === currentNode.id &&
          edge.sourceHandle === 'output' &&
          !visited.has(edge.target)
      )

      if (!nextEdge) break

      const nextNode = allNodes.find((n: any) => n.id === nextEdge.target)
      if (!nextNode) break

      chain.push(nextNode)
      visited.add(nextNode.id)
      currentNode = nextNode

      // Stop if we reach the destination
      if (nextNode.data.nodeType === 'AudioDestinationNode') break
    }

    return chain
  }

  updateConfig(config: Partial<LangChainConfig>) {
    if (this.config) {
      this.config = { ...this.config, ...config }
      if (config.apiKey) {
        this.initialize(this.config)
      }
    }
  }
}
