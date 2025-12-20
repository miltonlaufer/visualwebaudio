/**
 * LangChain Service
 * Handles AI-powered audio graph manipulation with tool calling support
 */
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import type { AIMessageChunk } from '@langchain/core/messages'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import { type ProviderId } from '~/config'
import { LLMProviderService, type LLMProviderConfig } from './LLMProviderService'
import { createAudioGraphTools, type BatchAction } from './AudioGraphToolService'
import { parseAndValidateJSON, extractTextContent } from '~/utils/jsonRepair'

/******************* TYPES ***********************/

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  actions?: AudioGraphAction[]
  toolCalls?: ToolCallInfo[]
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

export interface ToolCallInfo {
  name: string
  args: Record<string, unknown>
  result?: string
}

export interface LangChainConfig {
  apiKey?: string
  provider: ProviderId
  model: string
  temperature?: number
  maxTokens?: number
}

export interface ProcessMessageOptions {
  /** When true, AI sees results and can make adjustments (costs more tokens) */
  confirmOperations?: boolean
  /** Maximum retry iterations for error correction (default: 5) */
  maxErrorRetries?: number
}

const MAX_ERROR_RETRIES = 5

/******************* SERVICE CLASS ***********************/

export class LangChainService {
  private providerService: LLMProviderService
  private config: LangChainConfig | null = null

  constructor(config?: LangChainConfig) {
    this.providerService = new LLMProviderService()
    if (config) {
      this.initialize(config)
    }
  }

  /******************* INITIALIZATION ***********************/

  initialize(config: LangChainConfig): void {
    this.config = config

    const providerConfig: LLMProviderConfig = {
      providerId: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
    }

    this.providerService.initialize(providerConfig)
  }

  isInitialized(): boolean {
    return this.providerService.isInitialized()
  }

  get supportsTools(): boolean {
    return this.providerService.supportsTools
  }

  /******************* SYSTEM PROMPT ***********************/

  private getSystemPrompt(availableNodeTypes: string[], useToolCalling: boolean): string {
    const essentialParams: Record<string, string> = {
      DelayNode: 'delayTime(0-1s)',
      OscillatorNode: 'frequency(Hz), type(sine/square/sawtooth/triangle)',
      BiquadFilterNode: 'frequency(Hz), Q(resonance), type(lowpass/highpass/bandpass)',
      GainNode: 'gain(0-2)',
      DynamicsCompressorNode: 'threshold(-100-0), ratio(1-20), attack(0-1), release(0-1)',
      StereoPannerNode: 'pan(-1 to 1)',
      SliderNode: 'min, max, value, step, label',
      MidiToFreqNode: 'midiNote(0-127)',
      TimerNode: 'interval(ms), mode(loop/oneshot)',
      RandomNode: 'min, max, rate',
    }

    const paramInfo = availableNodeTypes
      .filter(type => essentialParams[type])
      .map(type => `${type}: ${essentialParams[type]}`)
      .join('\n')

    if (useToolCalling) {
      return `You are a PROFESSOR OF AUDIO ENGINEERING AND SOUND DESIGN with 30+ years of experience teaching synthesis, mixing, acoustics, and music production. 
      Current seminar is about the WebAudio API. You need to both help the students to understand and use the Web Audio API and give them suggestions about how to improve what they are doing. 
      You are passionate about helping students understand audio concepts deeply.

MUSICAL MINDSET - CRITICAL:
Your goal is to create MUSICAL, PLEASANT sounds - not noise or harsh textures (unless specifically requested).

DEFAULT TO MUSICAL FREQUENCIES:
- Use standard musical pitches: A4=440Hz, C4=261.63Hz, E4=329.63Hz, G4=392Hz
- For bass: A2=110Hz, C3=130.81Hz, E2=82.41Hz
- For higher notes: A5=880Hz, C5=523.25Hz
- When creating multiple oscillators, use harmonious intervals:
  - Octave: 2:1 ratio (e.g., 220Hz and 440Hz)
  - Perfect fifth: 3:2 ratio (e.g., 440Hz and 660Hz)  
  - Major third: 5:4 ratio (e.g., 440Hz and 550Hz)
- AVOID random frequencies like 1000Hz, 500Hz, 2000Hz - these are not musical notes!

PLEASANT SOUND DEFAULTS:
- Waveforms: Start with "sine" for pure tones, "triangle" for soft sounds. Use "sawtooth" or "square" only when richness/buzz is wanted
- Gain levels: Keep between 0.2-0.5 to avoid harsh loudness (NEVER use gain=1 or higher without good reason)
- Filter frequencies: Gentle lowpass at 2000-5000Hz removes harshness while keeping warmth
- Q/resonance: Keep Q between 1-5 for musical resonance (higher values screech!)
- Modulation rates: Use musical timing - 0.5Hz-4Hz for vibrato/tremolo, 0.1Hz for slow sweeps

AVOID THESE COMMON "NOISE" MISTAKES:
- High frequencies (>2000Hz) at full volume = ear-piercing
- Multiple detuned oscillators with no filter = harsh buzz
- High Q values (>10) on filters = screeching resonance
- Fast random modulation = chaos/noise
- Full gain (1.0) on multiple sources = distorted mess

YOUR TEACHING PHILOSOPHY:
- Don't just execute requests - EDUCATE and MENTOR
- Explain WHY you're making certain choices (e.g., "I'm using A4 at 440Hz because it's the standard concert pitch")
- Suggest improvements and alternatives the user might not have considered
- Share relevant audio engineering wisdom and best practices
- Ask thought-provoking questions: "Have you considered adding modulation to make it more dynamic?"

WHEN A USER ASKS FOR SOMETHING SIMPLE:
- Build what they asked for, BUT ALSO:
- Suggest enhancements: "This basic setup works, but you might want to add X for a more professional sound"
- Explain trade-offs: "A higher Q will give more resonance but can sound harsh at high volumes"
- Recommend next steps: "Now that you have a filter, try automating the cutoff frequency with a SliderNode for a classic sweep effect"

PROACTIVE ADVICE - Always consider suggesting:
- Better parameter values than defaults
- Additional nodes that would complement the setup
- Common techniques used in professional audio
- Ways to make the sound more interesting or controllable

UNDERSTANDING USER INTENT:
- If the message is unclear or unrelated to audio, ASK for clarification with helpful examples
- Random text -> "What would you like to create? I can help with synthesizers, effects, instruments, or audio processing chains."
- Vague requests -> Ask follow-up questions about their goal

AUDIO ENGINEERING EXCELLENCE:
- Build COMPLETE, USABLE setups - not bare minimum
- Always consider: signal flow, gain staging, feedback loops, wet/dry mix
- Think like a studio engineer setting up a proper signal chain
- ALWAYS include a GainNode before AudioDestinationNode to control overall volume

COMMON EFFECT PATTERNS (use these as starting points):

DELAY EFFECT (not just a bare DelayNode!):
- DelayNode for the delay time
- GainNode for feedback (connect delay output back to delay input)
- GainNode for wet/dry mix
- Typical setup: Source -> [dry path] -> Gain (mix) -> Output
                 Source -> Delay -> Feedback Gain -> back to Delay
                 Delay -> Wet Gain -> mix with dry -> Output

FILTER SWEEP:
- BiquadFilterNode with SliderNode controlling frequency
- Set appropriate Q for resonance
- Consider adding a subtle gain boost after filtering

VINTAGE/WARM SOUND:
- Lowpass filter (cut highs, frequency ~3000-8000Hz)
- Subtle saturation/distortion
- Maybe slight pitch wobble (very slow LFO on detune)

PLAYABLE INSTRUMENT:
- Direct MIDI: SliderNode (0-127 MIDI range) -> MidiToFreqNode(midiNote) -> OscillatorNode(frequency)
- With scales: SliderNode (scale degrees) -> ScaleToMidiNode(scaleDegree) -> ScaleToMidiNode(frequency) -> OscillatorNode(frequency)
- ScaleToMidiNode outputs frequency directly, so no need for MidiToFreqNode!
- Add envelope control with GainNode
- Consider adding harmonics with multiple oscillators

PENTATONIC/SCALE NOTES:
- SliderNode controls scale degree (0-7 for one octave, can go negative or higher)
- ScaleToMidiNode converts degree to MIDI/frequency based on key/mode setting
- Connect ScaleToMidiNode's "frequency" output to OscillatorNode's "frequency" input
- Example: SliderNode(value)->ScaleToMidiNode(scaleDegree), ScaleToMidiNode(frequency)->OscillatorNode(frequency)

AVAILABLE NODE TYPES: ${availableNodeTypes.join(', ')}

KEY PARAMETERS:
${paramInfo}

CONNECTION HANDLES (use EXACT names - CRITICAL!):
Audio nodes:
- output="output", input="input"

Custom control nodes:
- SliderNode: output="value"
- ButtonNode: output="trigger"
- MidiToFreqNode: input="midiNote", output="frequency"
- ScaleToMidiNode: input="scaleDegree", outputs="midiNote" OR "frequency"
- RandomNode: output="value"
- TimerNode: output="trigger"
- DisplayNode: input="value"

Audio node parameters (as targetHandle):
- OscillatorNode: "frequency", "detune"
- GainNode: "gain"
- DelayNode: "delayTime"
- BiquadFilterNode: "frequency", "Q", "gain"

IMPORTANT: ScaleToMidiNode outputs frequency directly - no need for MidiToFreqNode after it!

CRITICAL RULES:
1. **EVERY NODE MUST BE CONNECTED** - Do NOT create orphan nodes. If you add a node, connect it immediately in the same batch.
2. Always ensure AudioDestinationNode exists for sound output
3. **CHECK YOUR CONNECTIONS** - After adding nodes, verify each one has at least one input or output connected
4. Use batchActions to create complete setups in one go - include ALL connections in the same batch
5. Set sensible default values (don't leave everything at 0)
6. When modifying existing graphs, integrate with what's already there
7. **CONNECT NEW NODES TO EXISTING SIGNAL CHAIN** - Don't leave new nodes floating

COMMON PATTERNS:
- Sound source chain: OscillatorNode -> GainNode -> AudioDestinationNode
- With effects: Source -> Effect -> GainNode -> AudioDestinationNode
- Delay with feedback: Source -> DelayNode -> FeedbackGain -> back to DelayNode, DelayNode -> WetGain -> Output
- Pitch control: SliderNode(value) -> ScaleToMidiNode(scaleDegree), ScaleToMidiNode(frequency) -> OscillatorNode(frequency)

Explain your approach and reasoning, build a COMPLETE setup, then suggest improvements or next steps the user might want to explore!`
    }

    // Fallback prompt for non-tool providers (JSON mode)
    return `You are a PROFESSOR OF AUDIO ENGINEERING AND SOUND DESIGN with 30+ years of experience teaching synthesis, mixing, acoustics, and music production. 
      Current seminar is about the WebAudio API. You need to both help the students to understand and use the Web Audio API and give them suggestions about how to improve what they are doing. 
      You are passionate about helping students understand audio concepts deeply.

MUSICAL MINDSET - CRITICAL:
Create MUSICAL, PLEASANT sounds - not noise! Use standard pitches (A4=440Hz, C4=261.63Hz), 
harmonious intervals (octaves, fifths), moderate gain (0.2-0.5), and gentle filter settings.
Avoid random frequencies, high Q values, or multiple full-volume oscillators.

YOUR APPROACH:
- Build what's requested, then SUGGEST improvements and explain your reasoning
- Share audio engineering wisdom: "I'm setting the Q to 2 because higher values can cause harsh resonance"
- Recommend next steps: "Try adding a SliderNode to control the filter cutoff in real-time"
- Ask if the user wants to explore related techniques

UNDERSTANDING USER INTENT:
- If unclear, ask for clarification with helpful examples
- Don't assume - engage in dialogue about their goals

AUDIO ENGINEERING EXCELLENCE:
- Build COMPLETE setups, not bare minimum
- Always consider signal flow, gain staging, wet/dry mix
- ALWAYS include a GainNode before AudioDestinationNode

CRITICAL RULE: **EVERY NODE MUST BE CONNECTED** - Never create orphan nodes!

AVAILABLE NODES: ${availableNodeTypes.join(', ')}
KEY PARAMETERS: ${paramInfo}

CONNECTION HANDLES (use exact names):
- Audio: sourceHandle="output", targetHandle="input"
- SliderNode output: "value"
- MidiToFreqNode: input="midiNote", output="frequency"
- ScaleToMidiNode: input="scaleDegree", output="frequency" (connects directly to OscillatorNode.frequency)
- Param inputs: "frequency", "gain", "delayTime", "Q", "detune"

RESPOND WITH JSON containing an "actions" array:
- addNode: { type: "addNode", nodeType: "...", nodeId: "myId" }
- connect: { type: "connect", sourceId: "...", targetId: "...", sourceHandle: "output", targetHandle: "input" }
- updateProperty: { type: "updateProperty", nodeId: "...", propertyName: "...", propertyValue: 440 }

DELAY EFFECT EXAMPLE (notice ALL nodes are connected):
\`\`\`json
{
  "actions": [
    { "type": "addNode", "nodeType": "DelayNode", "nodeId": "delay" },
    { "type": "addNode", "nodeType": "GainNode", "nodeId": "feedback" },
    { "type": "addNode", "nodeType": "GainNode", "nodeId": "wetGain" },
    { "type": "updateProperty", "nodeId": "delay", "propertyName": "delayTime", "propertyValue": 0.3 },
    { "type": "updateProperty", "nodeId": "feedback", "propertyName": "gain", "propertyValue": 0.5 },
    { "type": "connect", "sourceId": "delay", "targetId": "feedback", "sourceHandle": "output", "targetHandle": "input" },
    { "type": "connect", "sourceId": "feedback", "targetId": "delay", "sourceHandle": "output", "targetHandle": "input" },
    { "type": "connect", "sourceId": "delay", "targetId": "wetGain", "sourceHandle": "output", "targetHandle": "input" }
  ]
}
\`\`\`

Briefly explain your approach, then provide the JSON with ALL connections included.`
  }

  /******************* MESSAGE PROCESSING ***********************/

  async processMessage(
    message: string,
    store: AudioGraphStoreType,
    conversationHistory: ChatMessage[] = [],
    options: ProcessMessageOptions = {}
  ): Promise<ChatMessage> {
    if (!this.isInitialized()) {
      throw new Error('LangChain service not initialized. Please provide API key.')
    }

    // Additional check for API key
    if (!this.config?.apiKey?.trim()) {
      throw new Error('API key is missing or empty. Please reconfigure the AI assistant.')
    }

    const { confirmOperations = false, maxErrorRetries = MAX_ERROR_RETRIES } = options
    const availableNodeTypes = store.availableNodeTypes
    const useToolCalling = this.supportsTools

    // Build initial context
    const systemPrompt = this.getSystemPrompt(availableNodeTypes, useToolCalling)
    const initialContext = this.buildGraphContext(store, message)

    const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
      new SystemMessage(systemPrompt),
      ...conversationHistory
        .slice(-4)
        .map(msg =>
          msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
        ),
      new HumanMessage(initialContext),
    ]

    let iteration = 0
    let lastResult: ChatMessage | null = null
    let accumulatedContent = ''
    let allToolCalls: ToolCallInfo[] = []

    while (iteration < maxErrorRetries) {
      iteration++

      // Clear error queue before processing to capture only errors from this iteration
      store.clearErrors()

      try {
        // Process the message
        const result = useToolCalling
          ? await this.processWithTools(messages, store)
          : await this.processWithFallback(messages, store)

        accumulatedContent += (accumulatedContent ? '\n\n' : '') + result.content.split('\n---')[0]
        allToolCalls = [...allToolCalls, ...(result.toolCalls || [])]

        // Check for errors or warnings in tool results
        const hasToolErrors = result.toolCalls?.some(
          tc =>
            tc.result?.includes('ERROR:') ||
            tc.result?.includes('WARNING - UNCONNECTED NODES') ||
            tc.result?.includes('WARNING: AudioDestinationNode exists but nothing is connected') ||
            tc.result?.includes('RUNTIME ERRORS DETECTED')
        )

        // OUR SIDE CHECK: Detect unconnected nodes regardless of what tools reported
        const unconnectedCheck = this.checkUnconnectedNodes(store)
        const hasErrors = hasToolErrors || unconnectedCheck.hasUnconnected

        if (hasErrors && iteration < maxErrorRetries) {
          // Build error context - prefer our unconnected check message if we found issues
          const errorContext = unconnectedCheck.hasUnconnected
            ? unconnectedCheck.message
            : this.buildErrorContext(result.toolCalls || [])

          messages.push(new AIMessage(result.content))
          messages.push(new HumanMessage(errorContext))
          continue
        }

        // If confirm operations is enabled and there were successful actions, let AI verify
        if (confirmOperations && result.toolCalls && result.toolCalls.length > 0 && !hasErrors) {
          const confirmContext = this.buildConfirmationContext(store, result.toolCalls)
          messages.push(new AIMessage(result.content))
          messages.push(new HumanMessage(confirmContext))

          // Get confirmation/adjustment from AI
          const confirmResult = useToolCalling
            ? await this.processWithTools(messages, store)
            : await this.processWithFallback(messages, store)

          accumulatedContent += '\n\n[Verification] ' + confirmResult.content.split('\n---')[0]
          allToolCalls = [...allToolCalls, ...(confirmResult.toolCalls || [])]

          // Check if AI made more changes - if so, do one more confirmation round
          if (confirmResult.toolCalls && confirmResult.toolCalls.length > 0) {
            const hasMoreErrors = confirmResult.toolCalls.some(tc => tc.result?.includes('ERROR:'))
            if (!hasMoreErrors) {
              // Final state after adjustments
              accumulatedContent += '\n\n[Adjustments applied]'
            }
          }
        }

        // Build final result
        lastResult = {
          id: Date.now().toString(),
          role: 'assistant',
          content: this.formatFinalContent(accumulatedContent, allToolCalls),
          timestamp: new Date(),
          toolCalls: allToolCalls,
        }

        return lastResult
      } catch (error) {
        console.error('LangChain API error:', error)
        if (iteration >= maxErrorRetries) {
          throw new Error(
            `Failed to process message after ${iteration} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
        // Add error to context for retry
        messages.push(
          new HumanMessage(
            `Error occurred: ${error instanceof Error ? error.message : 'Unknown error'}. Please try a different approach.`
          )
        )
      }
    }

    throw new Error('Failed to process message: Maximum retries exceeded')
  }

  /**
   * Build context about current graph state
   */
  private buildGraphContext(store: AudioGraphStoreType, userMessage: string): string {
    const currentNodes = store.adaptedNodes.map(node => ({
      id: node.id,
      type: node.nodeType,
    }))
    const currentConnections = store.visualEdges.map(edge => ({
      from: `${edge.source}(${edge.sourceHandle || 'output'})`,
      to: `${edge.target}(${edge.targetHandle || 'input'})`,
    }))
    const hasDestination = currentNodes.some(node => node.type === 'AudioDestinationNode')

    // Build detailed connection info to help AI understand what's connected
    const connectionInfo =
      currentConnections.length > 0
        ? `\nExisting connections:\n${currentConnections.map(c => `  ${c.from} -> ${c.to}`).join('\n')}`
        : '\nNo connections exist yet.'

    // Identify unconnected nodes
    const connectedSources = new Set(store.visualEdges.map(e => e.source))
    const connectedTargets = new Set(store.visualEdges.map(e => e.target))
    const unconnectedNodes = currentNodes.filter(
      n =>
        !connectedSources.has(n.id) &&
        !connectedTargets.has(n.id) &&
        n.type !== 'AudioDestinationNode'
    )
    const unconnectedInfo =
      unconnectedNodes.length > 0
        ? `\nWARNING - Unconnected nodes: ${unconnectedNodes.map(n => `${n.id}(${n.type})`).join(', ')}`
        : ''

    return `CURRENT GRAPH STATE:
- Nodes (${currentNodes.length}): ${currentNodes.length > 0 ? currentNodes.map(n => `${n.id}(${n.type})`).join(', ') : 'none'}
- Connections: ${currentConnections.length}${connectionInfo}
${!hasDestination ? '- WARNING: No AudioDestinationNode - must create one for sound output!' : '- Has AudioDestinationNode for output'}${unconnectedInfo}

USER REQUEST: ${userMessage}`
  }

  /**
   * Build error context for auto-retry
   */
  private buildErrorContext(toolCalls: ToolCallInfo[]): string {
    const issues: string[] = []

    for (const tc of toolCalls) {
      if (!tc.result) continue

      if (tc.result.includes('ERROR:')) {
        issues.push(`ERROR in ${tc.name}: ${tc.result}`)
      }
      if (tc.result.includes('WARNING - UNCONNECTED NODES')) {
        // Extract the unconnected nodes warning
        const match = tc.result.match(/WARNING - UNCONNECTED NODES DETECTED: ([^.]+)/)
        if (match) {
          issues.push(`UNCONNECTED NODES: ${match[1]}`)
        }
      }
      if (tc.result.includes('WARNING: AudioDestinationNode exists but nothing is connected')) {
        issues.push(
          'NO AUDIO PATH: Nothing is connected to AudioDestinationNode - no sound will be produced!'
        )
      }
    }

    return `ISSUES DETECTED - You must fix these before continuing:
${issues.map(i => `- ${i}`).join('\n')}

CRITICAL: Every node you create MUST be connected. Check the handles you're using are correct:
- SliderNode output: "value"
- ScaleToMidiNode outputs: "frequency" (use this directly for pitch!) or "midiNote"
- OscillatorNode inputs: "frequency", "detune"
- GainNode inputs: "input", "gain"
- Audio nodes: output="output", input="input"

Create the missing connections NOW.`
  }

  /**
   * Build confirmation context with current graph state
   */
  private buildConfirmationContext(store: AudioGraphStoreType, toolCalls: ToolCallInfo[]): string {
    const nodes = store.adaptedNodes.map(n => ({
      id: n.id,
      type: n.nodeType,
    }))
    const connections = store.visualEdges.map(e => ({
      from: `${e.source}(${e.sourceHandle || 'output'})`,
      to: `${e.target}(${e.targetHandle || 'input'})`,
    }))

    const executedActions = toolCalls.map(tc => `- ${tc.name}: ${tc.result}`).join('\n')

    return `Operations executed:
${executedActions}

Current graph state after your changes:
- Nodes (${nodes.length}): ${nodes.map(n => `${n.type}`).join(', ')}
- Connections (${connections.length}): ${connections.map(c => `${c.from} -> ${c.to}`).join(', ')}

Review the result. If everything looks correct, respond with a brief confirmation. If adjustments are needed, make them now.`
  }

  /**
   * Format final content with action summary
   */
  private formatFinalContent(content: string, toolCalls: ToolCallInfo[]): string {
    const successCount = toolCalls.filter(tc => !tc.result?.includes('ERROR:')).length
    const errorCount = toolCalls.length - successCount

    // Remove any existing "Tools:" lines from content (avoid duplication with UI)
    const cleanedContent = content.replace(/\nTools:.*$/gm, '').trim()

    let summary = ''
    if (toolCalls.length > 0) {
      summary = `\n\n[Executed ${toolCalls.length} action(s)`
      if (errorCount > 0) {
        summary += ` - ${errorCount} failed`
      }
      summary += ']'
      // Tools are shown separately in the UI, no need to add here
    }

    return cleanedContent + summary
  }

  /**
   * Check for unconnected nodes in the graph (our side validation)
   */
  private checkUnconnectedNodes(store: AudioGraphStoreType): {
    hasUnconnected: boolean
    unconnectedNodes: Array<{ id: string; type: string }>
    message: string
  } {
    const connectedSources = new Set(store.visualEdges.map(e => e.source))
    const connectedTargets = new Set(store.visualEdges.map(e => e.target))

    const unconnectedNodes = store.adaptedNodes
      .filter(
        n =>
          !connectedSources.has(n.id) &&
          !connectedTargets.has(n.id) &&
          n.nodeType !== 'AudioDestinationNode'
      )
      .map(n => ({ id: n.id, type: n.nodeType }))

    if (unconnectedNodes.length === 0) {
      return { hasUnconnected: false, unconnectedNodes: [], message: '' }
    }

    const message = `CRITICAL: You left ${unconnectedNodes.length} node(s) unconnected! 
Unconnected nodes: ${unconnectedNodes.map(n => `${n.id}(${n.type})`).join(', ')}

You MUST connect these nodes NOW. Here's the current graph state:
- Existing connections: ${store.visualEdges.map(e => `${e.source}(${e.sourceHandle}) -> ${e.target}(${e.targetHandle})`).join(', ') || 'none'}

Use the connect tool or batchActions to connect these orphan nodes to the signal chain.`

    return { hasUnconnected: true, unconnectedNodes, message }
  }

  /******************* TOOL CALLING MODE ***********************/

  private async processWithTools(
    messages: (SystemMessage | HumanMessage | AIMessage)[],
    store: AudioGraphStoreType
  ): Promise<ChatMessage> {
    const { tools, nodeIdMapper } = createAudioGraphTools(store)
    const chatModel = this.providerService.getChatModelWithTools(tools)

    // Invoke with tools - wrap in try-catch for schema validation errors
    let response
    try {
      response = await chatModel.invoke(messages)
    } catch (error) {
      // Handle tool parsing errors gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('ToolInputParsingException') || errorMessage.includes('schema')) {
        console.error('Tool schema validation failed:', error)
        // Return a helpful error message instead of crashing
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: `I encountered an error while processing your request. The tool parameters were invalid.\n\nError details: ${errorMessage}\n\nPlease try rephrasing your request or breaking it into smaller steps.`,
          timestamp: new Date(),
          toolCalls: [],
        }
      }
      throw error
    }

    const toolCalls: ToolCallInfo[] = []
    let textContent = ''

    // Extract text content
    if (typeof response.content === 'string') {
      textContent = response.content
    } else if (Array.isArray(response.content)) {
      textContent = response.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('\n')
    }

    // Process tool calls if any
    const aiMessage = response as AIMessageChunk
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      for (const toolCall of aiMessage.tool_calls) {
        const matchedTool = tools.find(t => t.name === toolCall.name)
        if (matchedTool) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (matchedTool as any).invoke(toolCall.args)
            toolCalls.push({
              name: toolCall.name,
              args: toolCall.args as Record<string, unknown>,
              result: String(result),
            })
          } catch (error) {
            console.error(`Tool ${toolCall.name} failed:`, error)
            toolCalls.push({
              name: toolCall.name,
              args: toolCall.args as Record<string, unknown>,
              result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            })
          }
        }
      }
    }

    // Clear the node ID mapper after processing
    nodeIdMapper.clear()

    // Return raw result - formatting is handled by processMessage
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: textContent,
      timestamp: new Date(),
      toolCalls,
    }
  }

  /******************* FALLBACK MODE (JSON) ***********************/

  private async processWithFallback(
    messages: (SystemMessage | HumanMessage | AIMessage)[],
    store: AudioGraphStoreType
  ): Promise<ChatMessage> {
    const chatModel = this.providerService.getChatModel()
    if (!chatModel) {
      throw new Error('Chat model not initialized')
    }

    const response = await chatModel.invoke(messages)
    const responseContent =
      typeof response.content === 'string' ? response.content : JSON.stringify(response.content)

    // Parse JSON from response
    const parseResult = parseAndValidateJSON(responseContent)
    const actions = this.convertBatchActionsToLegacy(parseResult.actions)

    // Extract text content for display
    const textContent = extractTextContent(responseContent)

    // Execute actions
    if (actions.length > 0) {
      await this.executeActions(actions, store)
    }

    // Convert actions to toolCalls format for consistent handling
    const toolCalls: ToolCallInfo[] = actions.map(action => ({
      name: action.type,
      args: action as unknown as Record<string, unknown>,
      result: 'SUCCESS',
    }))

    // Return raw result - formatting is handled by processMessage
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: textContent || responseContent,
      timestamp: new Date(),
      actions,
      toolCalls,
    }
  }

  /**
   * Convert new BatchAction format to legacy AudioGraphAction format
   */
  private convertBatchActionsToLegacy(batchActions: BatchAction[]): AudioGraphAction[] {
    return batchActions.map(action => {
      switch (action.type) {
        case 'addNode':
          return {
            type: 'addNode' as const,
            nodeType: action.nodeType,
            nodeId: action.nodeId,
            position: action.position,
          }
        case 'removeNode':
          return {
            type: 'removeNode' as const,
            nodeId: action.nodeId,
          }
        case 'connect':
          return {
            type: 'addConnection' as const,
            sourceId: action.sourceId,
            targetId: action.targetId,
            sourceHandle: action.sourceHandle,
            targetHandle: action.targetHandle,
          }
        case 'disconnect':
          return {
            type: 'removeConnection' as const,
            sourceId: action.sourceId,
            targetId: action.targetId,
            sourceHandle: action.sourceHandle,
            targetHandle: action.targetHandle,
          }
        case 'updateProperty':
          return {
            type: 'updateProperty' as const,
            nodeId: action.nodeId,
            propertyName: action.propertyName,
            propertyValue: action.propertyValue,
          }
      }
    })
  }

  /******************* LEGACY ACTION EXECUTION ***********************/

  /**
   * Execute actions (for fallback mode compatibility)
   */
  async executeActions(actions: AudioGraphAction[], store: AudioGraphStoreType): Promise<void> {
    const nodeIdMapping: Record<string, string> = {}

    const getSmartPosition = (requestedPosition?: { x: number; y: number }) => {
      const basePosition = requestedPosition || { x: 100, y: 100 }
      const nodeSpacing = 200
      const existingNodes = store.adaptedNodes

      if (existingNodes.length === 0) return basePosition

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

    // First pass: Add all nodes
    for (const action of actions) {
      if (action.type === 'addNode' && action.nodeType) {
        if (action.nodeType === 'AudioContext') continue

        try {
          const nodeCountBefore = store.adaptedNodes.length
          const smartPosition = getSmartPosition(action.position)
          store.addAdaptedNode(action.nodeType, smartPosition)

          if (action.nodeId && store.adaptedNodes.length > nodeCountBefore) {
            const newNode = store.adaptedNodes[store.adaptedNodes.length - 1]
            nodeIdMapping[action.nodeId] = newNode.id
          }
        } catch (error) {
          console.error('Failed to add node:', action, error)
        }
      }
    }

    // Second pass: Connections and properties
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'removeNode':
            if (action.nodeId) {
              const actualNodeId = nodeIdMapping[action.nodeId] || action.nodeId
              const node = store.adaptedNodes.find(n => n.id === actualNodeId)
              if (node) store.removeNode(node.id)
            }
            break

          case 'addConnection':
            if (action.sourceId && action.targetId) {
              const sourceId = nodeIdMapping[action.sourceId] || action.sourceId
              const targetId = nodeIdMapping[action.targetId] || action.targetId

              let sourceNode = store.adaptedNodes.find(n => n.id === sourceId)
              let targetNode = store.adaptedNodes.find(n => n.id === targetId)

              if (!sourceNode) sourceNode = this.findNodeByIdOrType(store, action.sourceId)
              if (!targetNode) targetNode = this.findNodeByIdOrType(store, action.targetId)

              if (sourceNode && targetNode) {
                store.addEdge(
                  sourceNode.id,
                  targetNode.id,
                  action.sourceHandle || 'output',
                  action.targetHandle || 'input'
                )
              }
            }
            break

          case 'removeConnection':
            if (action.sourceId && action.targetId) {
              const sourceId = nodeIdMapping[action.sourceId] || action.sourceId
              const targetId = nodeIdMapping[action.targetId] || action.targetId

              const sourceNode = store.adaptedNodes.find(n => n.id === sourceId)
              const targetNode = store.adaptedNodes.find(n => n.id === targetId)

              if (sourceNode && targetNode) {
                const edge = store.visualEdges.find(
                  e =>
                    e.source === sourceNode.id &&
                    e.target === targetNode.id &&
                    e.sourceHandle === (action.sourceHandle || 'output') &&
                    e.targetHandle === (action.targetHandle || 'input')
                )
                if (edge) store.removeEdge(edge.id)
              }
            }
            break

          case 'updateProperty':
            if (action.nodeId && action.propertyName && action.propertyValue !== undefined) {
              const actualNodeId = nodeIdMapping[action.nodeId] || action.nodeId
              let node = store.adaptedNodes.find(n => n.id === actualNodeId)
              if (!node) node = this.findNodeByIdOrType(store, action.nodeId)
              if (node) {
                store.updateNodeProperty(node.id, action.propertyName, action.propertyValue)
              }
            }
            break
        }
      } catch (error) {
        console.error('Failed to execute action:', action, error)
      }
    }
  }

  /**
   * Find a node by ID or by type matching (legacy support)
   */
  private findNodeByIdOrType(store: AudioGraphStoreType, identifier: string) {
    let node = store.adaptedNodes.find(n => n.id === identifier)
    if (node) return node

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
      midiToFreq: 'MidiToFreqNode',
      midi2freq: 'MidiToFreqNode',
    }

    const baseIdentifier = identifier.toLowerCase().replace(/\d+$/, '')
    const expectedNodeType =
      identifierToNodeType[baseIdentifier] || identifierToNodeType[identifier.toLowerCase()]

    if (expectedNodeType) {
      const candidates = store.adaptedNodes.filter(n => n.nodeType === expectedNodeType)
      if (candidates.length > 0) {
        return candidates[candidates.length - 1]
      }
    }

    node = store.adaptedNodes.find(
      n =>
        n.nodeType.toLowerCase().includes(identifier.toLowerCase()) ||
        identifier.toLowerCase().includes(n.nodeType.toLowerCase().replace('node', ''))
    )

    return node
  }

  /******************* CONFIG UPDATE ***********************/

  updateConfig(config: Partial<LangChainConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...config }
      if (config.apiKey || config.provider || config.model) {
        this.initialize(this.config)
      }
    }
  }

  /******************* TITLE GENERATION ***********************/

  /**
   * Generate a short title for a conversation based on its messages
   */
  async generateTitle(messages: Array<{ role: string; content: string }>): Promise<string> {
    if (!this.isInitialized()) {
      throw new Error('LangChain service not initialized')
    }

    const chatModel = this.providerService.getChatModel()
    if (!chatModel) {
      throw new Error('Chat model not available')
    }

    // Create a simple prompt to generate a title
    const conversationPreview = messages
      .slice(0, 4)
      .map(m => `${m.role}: ${m.content.slice(0, 100)}`)
      .join('\n')

    const titlePrompt = `Based on this conversation start, generate a very short title (3-6 words max, no quotes):

${conversationPreview}

Title:`

    try {
      const response = await chatModel.invoke([new HumanMessage(titlePrompt)])
      // Extract text content from response
      let rawContent: string
      if (typeof response.content === 'string') {
        rawContent = response.content
      } else if (Array.isArray(response.content)) {
        rawContent = response.content
          .filter(
            (c): c is { type: 'text'; text: string } =>
              typeof c === 'object' && c !== null && 'type' in c && c.type === 'text'
          )
          .map(c => c.text)
          .join('\n')
      } else {
        rawContent = String(response.content)
      }
      const content = extractTextContent(rawContent)
      // Clean up the title - remove quotes, trim, limit length
      let title = content
        .trim()
        .replace(/^["']|["']$/g, '')
        .trim()
      if (title.length > 50) {
        title = title.slice(0, 47) + '...'
      }
      return title || 'New conversation'
    } catch (error) {
      console.error('Failed to generate title:', error)
      // Fallback to first user message
      const firstUser = messages.find(m => m.role === 'user')
      if (firstUser) {
        const fallback = firstUser.content.slice(0, 40)
        return fallback + (firstUser.content.length > 40 ? '...' : '')
      }
      return 'New conversation'
    }
  }
}
