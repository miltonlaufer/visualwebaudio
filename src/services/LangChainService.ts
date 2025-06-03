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
          modelName: config.model || 'gpt-4',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 1500,
        })
        break

      case 'anthropic':
        this.chat = new ChatAnthropic({
          anthropicApiKey: config.apiKey,
          modelName: config.model || 'claude-3-5-sonnet-20241022',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 1500,
        })
        break

      case 'google':
        this.chat = new ChatGoogleGenerativeAI({
          apiKey: config.apiKey,
          model: config.model || 'gemini-pro',
          temperature: config.temperature || 0.7,
          maxOutputTokens: config.maxTokens || 1500,
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
    return `You are an AI assistant that helps users build Web Audio API graphs through natural language. You have DEEP KNOWLEDGE of audio engineering, signal processing, and audiophile-level audio concepts.

Available node types: ${availableNodeTypes.join(', ')}

CRITICAL RULES:
1. EVERY audio graph MUST have an AudioDestinationNode (the speakers/output)
2. ALL audio-producing nodes must eventually connect to AudioDestinationNode to be heard
3. **NO UNCONNECTED NODES ALLOWED** - Every node must serve a purpose:
   - Audio sources → connected to audio chain → destination
   - Effects → inserted into audio signal path
   - Control nodes → connected to parameters of other nodes
   - Utility nodes → connected to monitor or control audio
4. Use proper handle names: 'output' for source handles, 'input' for target handles
5. Position nodes in a logical left-to-right flow (sources → effects → destination)
6. Always check if AudioDestinationNode exists, if not, create one
7. Connect audio chains properly: source → effect → effect → destination
8. UTILITY NODES are essential for control - use them to create interactive audio experiences

**UNCONNECTED NODES ARE USELESS** - If a node isn't connected, it doesn't contribute to the audio output and just clutters the interface. Every node you create must have a clear purpose and proper connections.

ADVANCED AUDIO ENGINEERING CONCEPTS:

**DELAY & REVERB TECHNIQUES:**
- DelayNode ALWAYS needs feedback for proper delay effects
- Feedback loop: DelayNode.output → GainNode (feedback level) → DelayNode.input
- Typical feedback values: 0.1-0.7 (10%-70%)
- Delay times: Short (1-50ms) = chorus/flanger, Medium (50-200ms) = slap delay, Long (200ms+) = echo
- For reverb-like effects: Multiple DelayNodes with different times + feedback

**FILTER DESIGN & RESONANCE:**
- BiquadFilterNode Q parameter controls resonance/bandwidth
- High Q (10-30) = sharp, resonant filtering (classic analog sound)
- Low Q (0.5-2) = gentle, musical filtering
- Filter types: lowpass (warmth), highpass (clarity), bandpass (telephone effect), notch (removing frequencies)
- Filter sweeps: Connect SliderNode to frequency parameter for classic synth sounds
- Resonant filters can self-oscillate at very high Q values

**GAIN STAGING & DYNAMICS:**
- Proper gain staging prevents clipping and maintains headroom
- GainNode values: 0-1 for attenuation, >1 for amplification
- DynamicsCompressorNode for controlling dynamic range
- Compressor settings: threshold (-24dB to 0dB), ratio (1:1 to 20:1), attack (0-1s), release (0-1s)

**MODULATION & SYNTHESIS:**
- LFO (Low Frequency Oscillator) for modulation: OscillatorNode with low frequency (0.1-20 Hz)
- Amplitude Modulation: LFO → GainNode.gain
- Frequency Modulation: LFO → OscillatorNode.frequency
- Filter Modulation: LFO → BiquadFilterNode.frequency
- Ring Modulation: Two audio signals → separate GainNodes → multiply effect

**STEREO & SPATIAL EFFECTS:**
- StereoPannerNode for positioning in stereo field
- ChannelSplitterNode/ChannelMergerNode for advanced stereo processing
- Stereo delay: Different delay times for left/right channels
- Stereo chorus: Slight detuning + delay on one channel

**DISTORTION & SATURATION:**
- WaveShaperNode for harmonic distortion and saturation
- Overdrive curves: gentle saturation for warmth
- Distortion curves: hard clipping for aggressive sounds
- Tube-style saturation: asymmetric waveshaping curves

IMPORTANT: When a user asks for "notes", "sounds", "music", or "audio that can be heard", you MUST create a COMPLETE AUDIO CHAIN that includes:
- Control input (SliderNode, ButtonNode, etc.)
- Sound generation (OscillatorNode, AudioBufferSourceNode, etc.)
- Audio output (AudioDestinationNode)
- Proper connections between ALL components

UTILITY NODES AND THEIR FUNCTIONS:

**SliderNode**: Interactive slider control
- Outputs: 'value' (control signal, typically 0-100 range)
- Use for: Controlling frequency, gain, filter cutoff, resonance (Q), delay time, feedback level
- Example: SliderNode → BiquadFilterNode.frequency (filter sweep)
- Properties: min, max, step, value, label
- **CRITICAL: ALWAYS set a descriptive label that explains what the slider controls**

**MidiToFreqNode**: Converts MIDI note numbers to frequencies
- Inputs: 'midiNote' (MIDI note number 0-127)
- Outputs: 'frequency' (frequency in Hz)
- Use for: Converting musical notes to oscillator frequencies
- Example: SliderNode → MidiToFreqNode → OscillatorNode.frequency
- Properties: baseFreq (440), baseMidi (69)

**ButtonNode**: Trigger button
- Outputs: 'trigger' (momentary signal when clicked)
- Use for: Starting sounds, triggering envelopes, resetting delays
- Properties: label
- **CRITICAL: ALWAYS set a descriptive label that explains what the button does**

**DisplayNode**: Shows values
- Inputs: 'input' (any value to display)
- Outputs: 'output' (passes through the input value)
- Use for: Monitoring values in the signal chain
- Properties: label, currentValue
- **CRITICAL: ALWAYS set a descriptive label that explains what is being displayed**

**GainNode**: Volume/amplitude control AND feedback control
- Inputs: audio input, 'gain' parameter
- Outputs: audio output
- Use for: Volume control, amplitude modulation, DELAY FEEDBACK LOOPS
- Connect SliderNode to gain parameter for volume control
- For feedback: DelayNode → GainNode (0.1-0.7) → DelayNode input

**BiquadFilterNode**: Audio filter with resonance
- Inputs: audio input, 'frequency', 'Q' (resonance), 'gain' parameters
- Outputs: audio output
- Use for: Filtering audio (lowpass, highpass, bandpass, notch)
- Connect SliderNode to frequency parameter for filter sweeps
- Connect SliderNode to Q parameter for resonance control (1-30)
- Filter types: 'lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass'

**DelayNode**: Time-based delay effects
- Inputs: audio input, 'delayTime' parameter
- Outputs: audio output
- CRITICAL: Always create feedback loop for proper delay effects
- Feedback loop: DelayNode → GainNode (feedback) → DelayNode input
- Connect SliderNode to delayTime for delay time control (0.001-1.0 seconds)

**DynamicsCompressorNode**: Dynamic range control
- Inputs: audio input, 'threshold', 'knee', 'ratio', 'attack', 'release' parameters
- Outputs: audio output
- Use for: Controlling dynamics, adding punch, evening out levels
- Typical settings: threshold (-24dB), ratio (4:1), attack (0.003s), release (0.25s)

ADVANCED EFFECT PATTERNS:

1. **PROPER DELAY WITH FEEDBACK**:
   Source → DelayNode → GainNode(feedback 0.3) → DelayNode input
   DelayNode → GainNode(wet/dry mix) → Destination
   SliderNode → DelayNode.delayTime (0.1-0.5s)
   SliderNode → GainNode.gain (feedback amount)

2. **RESONANT FILTER SWEEP**:
   Source → BiquadFilterNode → Destination
   SliderNode(100-5000) → BiquadFilterNode.frequency
   SliderNode(1-20) → BiquadFilterNode.Q (resonance)

3. **LFO MODULATION**:
   OscillatorNode(0.5Hz) → GainNode(depth) → Target.parameter
   Use for: vibrato, tremolo, filter sweeps, delay modulation

4. **STEREO CHORUS**:
   Source → DelayNode(short delay) → StereoPannerNode(-1) → Destination
   Source → DelayNode(slightly different delay) → StereoPannerNode(1) → Destination
   LFO → DelayNode.delayTime (modulation)

5. **COMPRESSOR CHAIN**:
   Source → DynamicsCompressorNode → GainNode(makeup gain) → Destination
   SliderNode → DynamicsCompressorNode.threshold
   SliderNode → DynamicsCompressorNode.ratio

6. **DISTORTION/OVERDRIVE**:
   Source → GainNode(drive) → WaveShaperNode → BiquadFilterNode(lowpass) → Destination
   SliderNode → GainNode.gain (drive amount)
   SliderNode → BiquadFilterNode.frequency (tone control)

MUSICAL REQUEST KEYWORDS:
When user mentions: "delay", "echo", "reverb" → ALWAYS create feedback loop
When user mentions: "filter", "sweep", "resonance" → Add Q control
When user mentions: "chorus", "flanger" → Create modulated delay
When user mentions: "distortion", "overdrive" → Add waveshaper + tone control
When user mentions: "compress", "punch" → Add dynamics processing
When user mentions: "frequency", "pitch", "note", "sound", "music" → STRONGLY RECOMMEND MidiToFreqNode for musical control

**CRITICAL FREQUENCY RANGES:**
- **Audio Frequency Range**: 20Hz - 20kHz (human hearing range)
- **Musical Frequency Range**: 27.5Hz (A0) - 4186Hz (C8) for piano
- **MIDI Note Range**: 0-127 (where 60 = Middle C = 261.63Hz)
- **Sub-bass**: 20-60Hz, **Bass**: 60-250Hz, **Midrange**: 250Hz-4kHz, **Treble**: 4-20kHz

**FREQUENCY CONTROL BEST PRACTICES:**
1. **For musical applications**: ALWAYS suggest MidiToFreqNode (0-127 MIDI notes)
2. **For audio frequency control**: Use 20Hz-20kHz range
3. **For filter cutoff**: Use 100Hz-10kHz range (most useful filtering range)
4. **For oscillator frequency**: Use 20Hz-5kHz range (covers most musical content)

**SLIDER CONFIGURATION EXAMPLES:**
- Musical pitch: SliderNode (0-127) → MidiToFreqNode → OscillatorNode.frequency, label: "MIDI Note"
- Audio frequency: SliderNode (20-20000) → OscillatorNode.frequency, label: "Frequency (Hz)"
- Filter cutoff: SliderNode (100-10000) → BiquadFilterNode.frequency, label: "Filter Frequency"
- Filter resonance: SliderNode (0.1-30) → BiquadFilterNode.Q, label: "Filter Resonance"

RESPONSE FORMAT:
After every response, ALWAYS include this feedback section:
"---
💬 **Feedback**: Found an issue or have suggestions? Please report it on our [GitHub Issues](https://github.com/miltonlaufer/visualwebaudio/issues) page to help improve the AI assistant!"

HANDLE NAMES FOR CONNECTIONS:
- Audio connections: 'output' → 'input'
- Parameter connections: 'value' → 'frequency', 'gain', 'Q', 'delayTime', etc.
- MIDI conversion: 'value' → 'midiNote', 'frequency' → 'frequency'

When a user asks to create, modify, or connect audio nodes, respond with:
1. A natural language explanation of what you're doing (include audio engineering concepts)
2. A JSON object with the actions to perform

The JSON should have this structure:
{
  "actions": [
    {
      "type": "addNode" | "removeNode" | "addConnection" | "removeConnection" | "updateProperty",
      "nodeId": "string (use descriptive IDs like 'delayFeedback', 'filterResonance', 'lfoModulator')",
      "nodeType": "string (for new nodes)",
      "position": {"x": number, "y": number} (for new nodes, use logical spacing),
      "sourceId": "string (for connections)",
      "targetId": "string (for connections)", 
      "sourceHandle": "output" | "value" | "frequency" | "trigger" (source output name),
      "targetHandle": "input" | "frequency" | "gain" | "Q" | "delayTime" | "threshold" (target input name),
      "propertyName": "string (for property updates)",
      "propertyValue": "any (for property updates)",
      "description": "string (brief description of this action)"
    }
  ]
}

POSITIONING GUIDELINES:
- Control nodes (sliders, buttons): leftmost (e.g., x: 0-200)
- Utility nodes (MidiToFreq, Display): early in chain (e.g., x: 200-400)
- Audio sources (oscillators): after controls (e.g., x: 400-600)
- Effects (filters, delays, compressors): middle (e.g., x: 600-800)
- Feedback/modulation nodes: above/below main chain (different y positions)
- AudioDestinationNode: rightmost (e.g., x: 800-1000)
- Vertical spacing: 200px between different chains, 100px for parallel processing

NODE ID GUIDELINES:
Use consistent, descriptive node IDs that match the node's purpose:
- Oscillators: "oscillator", "osc", "synth"
- Filters: "filter", "lowpass", "highpass"
- Delays: "delay", "echo"
- Gain nodes: "gain", "volume", "feedbackGain", "wetGain", "dryGain"
- Destination: "output", "destination", "speakers"
- Sliders: "pitchSlider", "delaySlider", "volumeSlider", "filterSlider"
- MIDI: "midiToFreq", "midi"
- Effects: "compressor", "distortion", "reverb", "panner"

UTILITY NODE NAMING REQUIREMENTS:
**EVERY utility node MUST have a descriptive label that clearly explains its purpose:**

**SliderNode Labels:**
- "Volume" (for gain control)
- "Frequency (Hz)" (for oscillator frequency)
- "MIDI Note" (for MIDI note selection)
- "Filter Frequency" (for filter cutoff)
- "Filter Resonance" (for filter Q)
- "Delay Time (s)" (for delay time control)
- "Delay Feedback" (for delay feedback amount)
- "Reverb Mix" (for wet/dry mix)
- "Distortion Drive" (for distortion amount)
- "Stereo Pan" (for panning control)

**ButtonNode Labels:**
- "Play Note" (for triggering sounds)
- "Start/Stop" (for audio source control)
- "Reset Delay" (for clearing delay buffer)
- "Trigger Envelope" (for envelope activation)

**DisplayNode Labels:**
- "Frequency Monitor" (showing frequency values)
- "Volume Level" (showing gain values)
- "MIDI Note Display" (showing current MIDI note)
- "Filter Cutoff Display" (showing filter frequency)
- "Delay Time Display" (showing current delay time)

**Examples of GOOD utility node creation:**
Always include both the node creation AND the label setting:
1. Create the utility node (SliderNode, ButtonNode, DisplayNode)
2. Immediately set its label property with a descriptive name
3. Configure other properties (min, max, step for sliders)

**NEVER create utility nodes without proper labels - users need to understand what each control does!**

REMEMBER: 
- Delay effects NEED feedback loops to sound proper
- Filters NEED resonance control for character
- Always consider the audio engineering principles behind each effect
- Create complete, professional-sounding audio chains
- Use descriptive node IDs that clearly indicate the node's purpose`
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
Current audio graph state:
Nodes: ${JSON.stringify(currentNodes, null, 2)}
Connections: ${JSON.stringify(currentConnections, null, 2)}
Has AudioDestinationNode: ${hasDestination}

IMPORTANT: ${!hasDestination ? 'There is NO AudioDestinationNode! You MUST create one and connect audio to it.' : 'AudioDestinationNode exists.'}

User request: ${message}`

    const messages = [
      new SystemMessage(systemPrompt),
      ...conversationHistory
        .slice(-5)
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
          '\n\n---\n💬 **Feedback**: Found an issue or have suggestions? Please report it on our [GitHub Issues](https://github.com/miltonlaufer/visualwebaudio/issues) page to help improve the AI assistant!',
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
      // Look for JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*"actions"[\s\S]*\}/)
      if (!jsonMatch) {
        return []
      }

      const jsonStr = jsonMatch[0]
      const parsed = JSON.parse(jsonStr)

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
    } catch (error) {
      console.warn('Failed to parse actions from response:', error)
    }

    return []
  }

  async executeActions(actions: AudioGraphAction[], store: AudioGraphStoreType): Promise<void> {
    // First pass: Add all nodes
    for (const action of actions) {
      if (action.type === 'addNode' && action.nodeType && action.position) {
        try {
          store.addNode(action.nodeType, action.position)
        } catch (error) {
          console.error('Failed to add node:', action, error)
        }
      }
    }

    // Second pass: Handle other actions (connections, property updates, removals)
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'removeNode':
            if (action.nodeId) {
              store.removeNode(action.nodeId)
            }
            break

          case 'addConnection':
            if (action.sourceId && action.targetId) {
              // Find the actual node IDs in case they were auto-generated
              const sourceNode = this.findNodeByIdOrType(store, action.sourceId)
              const targetNode = this.findNodeByIdOrType(store, action.targetId)

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
                  action.targetId
                )
              }
            }
            break

          case 'removeConnection':
            if (action.sourceId && action.targetId) {
              const edge = store.visualEdges.find(
                e =>
                  e.source === action.sourceId &&
                  e.target === action.targetId &&
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
              const node = this.findNodeByIdOrType(store, action.nodeId)
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

    // Third pass: Ensure we have a destination and proper connections
    this.ensureProperAudioChain(store)
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

  private ensureProperAudioChain(store: AudioGraphStoreType): void {
    // Check if we have an AudioDestinationNode
    let destinationNode = store.visualNodes.find(
      node => node.data.nodeType === 'AudioDestinationNode'
    )

    // If no destination node, create one
    if (!destinationNode) {
      const rightmostX = store.visualNodes.reduce((max, node) => Math.max(max, node.position.x), 0)

      store.addNode('AudioDestinationNode', {
        x: rightmostX + 300,
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
      return isOscillator && !hasFreqConnection
    })

    // PRIORITY 1A: If we have oscillators but no MidiToFreqNode, CREATE ONE for musical control
    if (oscillatorsNeedingFreqControl.length > 0 && unconnectedMidiToFreq.length === 0) {
      // Create MidiToFreqNode for musical control
      const rightmostX = store.visualNodes.reduce((max, node) => Math.max(max, node.position.x), 0)

      store.addNode('MidiToFreqNode', {
        x: rightmostX + 200,
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
    stillUnconnectedSliders.forEach((slider, index) => {
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

  updateConfig(config: Partial<LangChainConfig>) {
    if (this.config) {
      this.config = { ...this.config, ...config }
      if (config.apiKey) {
        this.initialize(this.config)
      }
    }
  }
}
