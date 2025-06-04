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
          maxTokens: config.maxTokens || 2000,
        })
        break

      case 'anthropic':
        this.chat = new ChatAnthropic({
          anthropicApiKey: config.apiKey,
          modelName: config.model || 'claude-3-5-sonnet-20241022',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 2000,
        })
        break

      case 'google':
        this.chat = new ChatGoogleGenerativeAI({
          apiKey: config.apiKey,
          model: config.model || 'gemini-pro',
          temperature: config.temperature || 0.7,
          maxOutputTokens: config.maxTokens || 2000,
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
    // Create concise parameter info - only essential parameters
    const essentialParams: Record<string, string> = {
      DelayNode: 'delayTime(0-1s)',
      OscillatorNode: 'frequency(Hz), type(sine/square/sawtooth/triangle)',
      BiquadFilterNode: 'frequency(Hz), Q(resonance), type(lowpass/highpass/etc)',
      GainNode: 'gain(0-2)',
      DynamicsCompressorNode: 'threshold(-100-0), ratio(1-20), attack(0-1), release(0-1)',
      StereoPannerNode: 'pan(-1 to 1)',
      SliderNode: 'min, max, value, step, label',
      MidiToFreqNode: 'midiNote(0-127)',
    }

    const paramInfo = availableNodeTypes
      .filter(type => essentialParams[type])
      .map(type => `${type}: ${essentialParams[type]}`)
      .join(', ')

    return `You are a senior audio engineer building Web Audio API graphs.

AVAILABLE NODES: ${availableNodeTypes.join(', ')}
KEY PARAMETERS: ${paramInfo}

🔥 CRITICAL: ALWAYS CREATE COMPLETE AUDIO CHAINS WITH ALL CONNECTIONS! 🔥

MANDATORY RULES:
1. Every graph needs AudioDestinationNode
2. NO UNCONNECTED NODES - every node must connect to the audio signal path
3. Audio flow: sources → effects → AudioDestinationNode
4. INCLUDE ALL CONNECTIONS in your response
5. Set essential parameters for each node

COMPLETE SETUPS REQUIRED:
For "vintage synth with delay", provide ALL:
- Audio chain: Oscillator → Filter → Delay → Destination
- Control chain: SliderNode → MidiToFreqNode → Oscillator.frequency
- Effect controls: Sliders → Filter/Delay parameters
- Feedback loops: Delay → GainNode → Delay input

MUSICAL CONTROL PATTERN:
SliderNode(0-127) → MidiToFreqNode → OscillatorNode.frequency

CONNECTIONS FORMAT:
- Audio: {"type": "addConnection", "sourceId": "osc", "targetId": "filter", "sourceHandle": "output", "targetHandle": "input"}
- Control: {"type": "addConnection", "sourceId": "slider", "targetId": "osc", "sourceHandle": "value", "targetHandle": "frequency"}

SLIDER SETUP (use separate updateProperty actions):
{"type": "addNode", "nodeType": "SliderNode", "nodeId": "slider1"},
{"type": "updateProperty", "nodeId": "slider1", "propertyName": "min", "propertyValue": 0},
{"type": "updateProperty", "nodeId": "slider1", "propertyName": "max", "propertyValue": 127},
{"type": "updateProperty", "nodeId": "slider1", "propertyName": "value", "propertyValue": 60},
{"type": "updateProperty", "nodeId": "slider1", "propertyName": "label", "propertyValue": "MIDI Note"}

RESPOND WITH PURE JSON ONLY - NO TEXT BEFORE/AFTER:
{"actions": [
  {"type": "addNode", "nodeType": "OscillatorNode", "nodeId": "osc"},
  {"type": "addNode", "nodeType": "AudioDestinationNode", "nodeId": "dest"},
  {"type": "addConnection", "sourceId": "osc", "targetId": "dest", "sourceHandle": "output", "targetHandle": "input"}
]}

REMEMBER: Include ALL nodes AND ALL connections in one complete response!`
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
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '')

      // Try to find JSON in the response - look for both array and object formats
      let jsonMatch = cleanResponse.match(/\{[\s\S]*"actions"[\s\S]*\}/)
      if (!jsonMatch) {
        jsonMatch = cleanResponse.match(/\[[\s\S]*\]/)
      }
      if (!jsonMatch) {
        jsonMatch = [cleanResponse]
      }

      if (!jsonMatch) {
        console.warn('No JSON found in AI response')
        return []
      }

      const jsonStr = jsonMatch[0]

      // Try to parse JSON with basic error recovery
      try {
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

        console.warn('Parsed JSON does not contain actions array or is not an array')
        return []
      } catch (parseError) {
        // Basic JSON repair for common issues
        let fixedJson = jsonStr

        // Fix smart quotes and encoding issues
        fixedJson = fixedJson.replace(/[""]/g, '"').replace(/['']/g, "'")

        // Remove non-printable characters
        fixedJson = fixedJson.replace(/[^\x20-\x7E\n\r\t]/g, '')

        // Try to balance brackets and braces for truncated JSON
        if (fixedJson.includes('"actions"') && fixedJson.includes('[')) {
          const openBraces = (fixedJson.match(/\{/g) || []).length
          const closeBraces = (fixedJson.match(/\}/g) || []).length
          const openBrackets = (fixedJson.match(/\[/g) || []).length
          const closeBrackets = (fixedJson.match(/\]/g) || []).length

          for (let i = 0; i < openBrackets - closeBrackets; i++) {
            fixedJson += ']'
          }
          for (let i = 0; i < openBraces - closeBraces; i++) {
            fixedJson += '}'
          }
        }

        try {
          const parsed = JSON.parse(fixedJson)

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
        } catch {
          console.warn('Failed to parse AI response JSON:', parseError)
        }

        return []
      }
    } catch (error) {
      console.warn('Failed to extract actions from AI response:', error)
      return []
    }
  }

  async executeActions(actions: AudioGraphAction[], store: AudioGraphStoreType): Promise<void> {
    // Create a mapping from AI-provided nodeIds to actual generated nodeIds
    const nodeIdMapping: Record<string, string> = {}

    // Smart positioning to avoid overlaps
    const getSmartPosition = (requestedPosition?: { x: number; y: number }) => {
      const basePosition = requestedPosition || { x: 100, y: 100 }
      const nodeSpacing = 200 // Reduced from 400 to 200 for more compact layout
      const existingNodes = store.visualNodes

      // If no existing nodes, use the base position
      if (existingNodes.length === 0) {
        return basePosition
      }

      // Check if position is too close to existing nodes
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

        // Adjust position in a spiral pattern
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

          // Use smart positioning to avoid overlaps
          const smartPosition = getSmartPosition(action.position)

          store.addNode(action.nodeType, smartPosition)

          // Map AI's nodeId to the actual generated nodeId
          if (action.nodeId && store.visualNodes.length > nodeCountBefore) {
            const newNode = store.visualNodes[store.visualNodes.length - 1]
            nodeIdMapping[action.nodeId] = newNode.id
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

              let sourceNode = store.visualNodes.find(n => n.id === sourceId)
              let targetNode = store.visualNodes.find(n => n.id === targetId)

              if (!sourceNode) {
                sourceNode = this.findNodeByIdOrType(store, action.sourceId)
              }
              if (!targetNode) {
                targetNode = this.findNodeByIdOrType(store, action.targetId)
              }

              if (sourceNode && targetNode) {
                const edge = store.visualEdges.find(
                  e =>
                    e.source === sourceNode.id &&
                    e.target === targetNode.id &&
                    e.sourceHandle === (action.sourceHandle || 'output') &&
                    e.targetHandle === (action.targetHandle || 'input')
                )

                if (edge) {
                  store.removeEdge(edge.id)
                } else {
                  console.warn(
                    'Could not find edge for disconnection:',
                    action.sourceId,
                    '→',
                    action.targetId
                  )
                }
              } else {
                console.warn(
                  'Could not find nodes for disconnection:',
                  action.sourceId,
                  '→',
                  action.targetId
                )
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
              } else {
                console.warn('Could not find node for property update:', action.nodeId)
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

      // Try to find by mapped node type (handle numbered identifiers like "osc1", "midiToFreq1")
      const baseIdentifier = identifier.toLowerCase().replace(/\d+$/, '') // Remove trailing numbers
      const expectedNodeType =
        identifierToNodeType[baseIdentifier] || identifierToNodeType[identifier.toLowerCase()]
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
      console.log(`Found node for identifier "${identifier}": ${node.data.nodeType} (${node.id})`)
    } else {
      console.warn(`Could not find node for identifier "${identifier}"`)
    }

    return node
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
