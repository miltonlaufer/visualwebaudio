/**
 * AI Chat Types and Helpers
 */

import type { ChatMessage } from '~/services/LangChainService'
import type { ProviderId, ModelInfo } from '~/config'

/******************* TYPES ***********************/

export interface AIAction {
  id: string
  type: 'addNode' | 'removeNode' | 'connect' | 'disconnect' | 'updateProperty' | 'batch'
  description: string
  success: boolean
  timestamp: Date
  children?: AIAction[]
}

export interface BatchAction {
  type: string
  nodeType?: string
  nodeId?: string
  sourceId?: string
  targetId?: string
  sourceHandle?: string
  targetHandle?: string
  propertyName?: string
  propertyValue?: unknown
  position?: { x: number; y: number }
}

export interface AIChatState {
  isOpen: boolean
  isConfigOpen: boolean
  messages: ChatMessage[]
  inputMessage: string
  isLoading: boolean
  error: string | null
}

export interface AIChatConfigState {
  apiKey: string
  provider: ProviderId
  model: string
  temperature: number
  storageType: 'session' | 'encrypted'
  encryptionPassword: string
  hasStoredKey: boolean
  needsPassword: boolean
  availableModels: ModelInfo[]
  isLoadingModels: boolean
  isValidatingKey: boolean
  confirmOperations: boolean
}

export interface AIChatUIState {
  chatHeight: number
  isResizing: boolean
  showActionsPanel: boolean
  showSidebar: boolean
  aiActions: AIAction[]
  expandedBatches: Set<string>
  chatStoreReady: boolean
}

/******************* HELPERS ***********************/

/**
 * Format a property value for display, keeping it readable but concise
 */
function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return '?'
  if (typeof value === 'number') {
    // Format numbers nicely (show 2 decimal places for floats, round large numbers)
    if (Number.isInteger(value)) return String(value)
    return value.toFixed(2).replace(/\.?0+$/, '')
  }
  if (typeof value === 'string') {
    // Show string values in quotes, truncate if too long
    const truncated = value.length > 15 ? value.slice(0, 12) + '...' : value
    return `"${truncated}"`
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (value.length <= 3) return `[${value.slice(0, 3).join(', ')}]`
    return `[${value.length} items]`
  }
  return '[object]'
}

/**
 * Extract a readable node name from an ID (e.g., "OscillatorNode-123-1" -> "Oscillator")
 */
function getNodeDisplayName(nodeId: string | undefined): string {
  if (!nodeId) return 'node'
  // Extract node type from ID pattern like "OscillatorNode-timestamp-counter"
  const match = nodeId.match(/^([A-Za-z]+)Node/)
  if (match) return match[1]
  // Try to get first part before dash
  const firstPart = nodeId.split('-')[0]
  return firstPart.replace(/Node$/, '') || nodeId
}

export function formatSingleAction(action: BatchAction): string {
  switch (action.type) {
    case 'addNode': {
      const nodeType = action.nodeType?.replace(/Node$/, '') || 'node'
      const pos = action.position ? ` at (${action.position.x}, ${action.position.y})` : ''
      return `Add ${nodeType}${pos}`
    }
    case 'removeNode':
      return `Remove ${getNodeDisplayName(action.nodeId)}`
    case 'connect': {
      const srcName = getNodeDisplayName(action.sourceId)
      const tgtName = getNodeDisplayName(action.targetId)
      const srcHandle =
        action.sourceHandle && action.sourceHandle !== 'output' ? `.${action.sourceHandle}` : ''
      const tgtHandle =
        action.targetHandle && action.targetHandle !== 'input' ? `.${action.targetHandle}` : ''
      return `${srcName}${srcHandle} -> ${tgtName}${tgtHandle}`
    }
    case 'disconnect': {
      const srcName = getNodeDisplayName(action.sourceId)
      const tgtName = getNodeDisplayName(action.targetId)
      return `Disconnect ${srcName} from ${tgtName}`
    }
    case 'updateProperty': {
      const nodeName = getNodeDisplayName(action.nodeId)
      const propName = action.propertyName || 'property'
      const value = formatPropertyValue(action.propertyValue)
      return `${nodeName}.${propName} = ${value}`
    }
    default:
      return action.type || 'unknown'
  }
}

let actionIdCounter = 0

export function parseActionsFromToolCall(
  toolName: string,
  args: Record<string, unknown>,
  result?: string
): AIAction[] {
  const timestamp = new Date()
  const isError = result?.includes('ERROR:')
  const baseId = `${Date.now()}-${++actionIdCounter}`

  if (toolName === 'batchActions') {
    const batchActions = args.actions as BatchAction[] | undefined
    if (!batchActions || batchActions.length === 0) {
      return [
        {
          id: `${baseId}-batch-empty`,
          type: 'batch',
          description: 'Empty batch',
          success: !isError,
          timestamp,
        },
      ]
    }

    const resultLines = result?.split('\n') || []
    const children: AIAction[] = batchActions
      .map((action, idx) => {
        const resultLine = resultLines[idx] || ''
        const actionSuccess = !resultLine.includes('ERROR:')
        return {
          id: `${baseId}-child-${idx}-${action.type}`,
          type: action.type as AIAction['type'],
          description: formatSingleAction(action),
          success: actionSuccess,
          timestamp,
        }
      })
      .reverse() // Reverse so newest (last executed) appears at top

    const successCount = children.filter(c => c.success).length
    const failCount = children.length - successCount

    return [
      {
        id: `${baseId}-batch`,
        type: 'batch',
        description: `Batch: ${successCount} ok${failCount > 0 ? `, ${failCount} failed` : ''}`,
        success: failCount === 0,
        timestamp,
        children,
      },
    ]
  }

  // For single (non-batch) tool calls, format the description properly
  const singleAction: BatchAction = {
    type: toolName,
    nodeType: args.nodeType as string | undefined,
    nodeId: args.nodeId as string | undefined,
    sourceId: args.sourceId as string | undefined,
    targetId: args.targetId as string | undefined,
    sourceHandle: args.sourceHandle as string | undefined,
    targetHandle: args.targetHandle as string | undefined,
    propertyName: args.propertyName as string | undefined,
    propertyValue: args.propertyValue,
    position: args.position as { x: number; y: number } | undefined,
  }

  return [
    {
      id: `${baseId}-${toolName}`,
      type: toolName as AIAction['type'],
      description: formatSingleAction(singleAction),
      success: !isError,
      timestamp,
    },
  ]
}
