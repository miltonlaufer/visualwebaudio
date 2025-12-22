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
import { compositeNodeDefinitionStore } from '~/stores/CompositeNodeDefinitionStore'
import {
  BASE_NODE_PARAMS,
  getToolCallingSystemPrompt,
  getJsonModeSystemPrompt,
  formatParamInfo,
} from './prompts'

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

  /******************* COMPOSITE NODE INFO GENERATION ***********************/

  /**
   * Generates parameter info for a composite node definition
   */
  private getCompositeNodeParamInfo(def: {
    inputs: Array<{ id: string; type: string }>
    description?: string
  }): string {
    const inputParams = def.inputs.map(input => `${input.id}(${input.type})`).join(', ')

    const shortDesc = def.description
      ? ` - ${def.description.split('.')[0]}` // Take first sentence
      : ''

    return `${inputParams}${shortDesc}`
  }

  /**
   * Generates composite node documentation for AI prompts
   * Dynamically pulls from CompositeNodeDefinitionStore
   */
  private getCompositeNodesDocumentation(): string {
    const allDefs = compositeNodeDefinitionStore.allDefinitions

    if (allDefs.length === 0) {
      return ''
    }

    const lines: string[] = [
      'COMPOSITE NODES (prebuilt and user-created effect chains - USE THESE for quick professional effects!):',
    ]

    // Group by prebuilt vs user
    const prebuilt = allDefs.filter(d => d.isPrebuilt)
    const userCreated = allDefs.filter(d => !d.isPrebuilt)

    // Add prebuilt nodes
    for (const def of prebuilt) {
      const inputs = def.inputs.map(i => `${i.id}(${i.type})`).join(', ')
      const outputs = def.outputs.map(o => `${o.id}(${o.type})`).join(', ')
      lines.push(
        `- Composite_${def.id}: inputs=${inputs}; outputs=${outputs}. ${def.description || def.name}`
      )
    }

    // Add user-created nodes if any
    if (userCreated.length > 0) {
      lines.push('')
      lines.push('USER-CREATED COMPOSITE NODES:')
      for (const def of userCreated) {
        const inputs = def.inputs.map(i => `${i.id}(${i.type})`).join(', ')
        const outputs = def.outputs.map(o => `${o.id}(${o.type})`).join(', ')
        lines.push(
          `- Composite_${def.id}: inputs=${inputs}; outputs=${outputs}. ${def.description || def.name}`
        )
      }
    }

    return lines.join('\n')
  }

  /**
   * Generates composite node entries for the essentialParams lookup
   */
  private getCompositeNodeParams(): Record<string, string> {
    const params: Record<string, string> = {}

    for (const def of compositeNodeDefinitionStore.allDefinitions) {
      const nodeType = `Composite_${def.id}`
      params[nodeType] = this.getCompositeNodeParamInfo(def)
    }

    return params
  }

  /******************* SYSTEM PROMPT ***********************/

  private getSystemPrompt(availableNodeTypes: string[], useToolCalling: boolean): string {
    // Merge base params with dynamically generated composite node params
    const essentialParams: Record<string, string> = {
      ...BASE_NODE_PARAMS,
      ...this.getCompositeNodeParams(),
    }

    // Format param info for the prompt
    const paramInfo = formatParamInfo(availableNodeTypes, essentialParams)

    // Get composite nodes documentation
    const compositeNodesDocumentation = this.getCompositeNodesDocumentation()

    // Build prompt options
    const promptOptions = {
      availableNodeTypes,
      paramInfo,
      compositeNodesDocumentation,
    }

    // Return the appropriate prompt based on tool calling support
    if (useToolCalling) {
      return getToolCallingSystemPrompt(promptOptions)
    }

    // Fallback prompt for non-tool providers (JSON mode)
    return getJsonModeSystemPrompt(promptOptions)
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
