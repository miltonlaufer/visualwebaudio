/**
 * Audio Connector Facade
 *
 * Provides a simplified API for audio connection operations.
 * Hides the complexity of connecting Web Audio nodes vs custom nodes.
 *
 * This facade implements the Facade Pattern to:
 * - Simplify complex audio connection logic
 * - Handle Web Audio API node connections
 * - Handle custom node connections via MobX stores
 * - Provide a unified interface for both types
 */

import type { IAudioGraphStore } from '~/stores/AudioGraphStore'
import { isCustomNodeType } from '~/domain/nodes/strategies'

/******************* TYPES ***********************/

export interface ConnectionInfo {
  sourceId: string
  targetId: string
  sourceOutput: string
  targetInput: string
}

export interface ConnectionResult {
  success: boolean
  error?: string
}

export type ConnectionType =
  | 'audio-to-audio'
  | 'audio-to-param'
  | 'custom-to-audio'
  | 'custom-to-custom'

/******************* FACADE ***********************/

/**
 * AudioConnector provides a clean interface for managing audio connections.
 * It abstracts away the complexity of different connection types.
 */
export class AudioConnector {
  private store: IAudioGraphStore

  constructor(store: IAudioGraphStore) {
    this.store = store
  }

  /******************* CONNECTION TYPE DETECTION ***********************/

  /**
   * Determines the type of connection based on source and target nodes
   */
  getConnectionType(sourceId: string, targetId: string): ConnectionType | null {
    const sourceNode = this.store.adaptedNodes.find(n => n.id === sourceId)
    const targetNode = this.store.adaptedNodes.find(n => n.id === targetId)

    if (!sourceNode || !targetNode) {
      return null
    }

    const sourceIsCustom = isCustomNodeType(sourceNode.nodeType)
    const targetIsCustom = isCustomNodeType(targetNode.nodeType)

    if (sourceIsCustom && targetIsCustom) {
      return 'custom-to-custom'
    } else if (sourceIsCustom && !targetIsCustom) {
      return 'custom-to-audio'
    } else if (!sourceIsCustom && targetIsCustom) {
      // Audio node to custom node - treated as custom connection
      return 'custom-to-custom'
    } else {
      return 'audio-to-audio'
    }
  }

  /******************* CONNECTION VALIDATION ***********************/

  /**
   * Validates if a connection can be made between two nodes
   */
  canConnect(info: ConnectionInfo): boolean {
    const sourceNode = this.store.adaptedNodes.find(n => n.id === info.sourceId)
    const targetNode = this.store.adaptedNodes.find(n => n.id === info.targetId)

    if (!sourceNode || !targetNode) {
      return false
    }

    // Check if source has the specified output
    const hasOutput = sourceNode.metadata.outputs.some(o => o.name === info.sourceOutput)
    if (!hasOutput) {
      return false
    }

    // Check if target has the specified input
    const hasInput = targetNode.metadata.inputs.some(i => i.name === info.targetInput)
    if (!hasInput) {
      return false
    }

    // Check for existing connection
    const alreadyConnected = this.store.audioConnections.some(
      c =>
        c.sourceNodeId === info.sourceId &&
        c.targetNodeId === info.targetId &&
        c.sourceOutput === info.sourceOutput &&
        c.targetInput === info.targetInput
    )

    return !alreadyConnected
  }

  /******************* CONNECTION QUERIES ***********************/

  /**
   * Gets all connections for a specific node
   */
  getConnectionsForNode(nodeId: string): ConnectionInfo[] {
    return this.store.audioConnections
      .filter(c => c.sourceNodeId === nodeId || c.targetNodeId === nodeId)
      .map(c => ({
        sourceId: c.sourceNodeId,
        targetId: c.targetNodeId,
        sourceOutput: c.sourceOutput,
        targetInput: c.targetInput,
      }))
  }

  /**
   * Gets all outgoing connections from a node
   */
  getOutgoingConnections(nodeId: string): ConnectionInfo[] {
    return this.store.audioConnections
      .filter(c => c.sourceNodeId === nodeId)
      .map(c => ({
        sourceId: c.sourceNodeId,
        targetId: c.targetNodeId,
        sourceOutput: c.sourceOutput,
        targetInput: c.targetInput,
      }))
  }

  /**
   * Gets all incoming connections to a node
   */
  getIncomingConnections(nodeId: string): ConnectionInfo[] {
    return this.store.audioConnections
      .filter(c => c.targetNodeId === nodeId)
      .map(c => ({
        sourceId: c.sourceNodeId,
        targetId: c.targetNodeId,
        sourceOutput: c.sourceOutput,
        targetInput: c.targetInput,
      }))
  }

  /**
   * Checks if a node has any connections
   */
  hasConnections(nodeId: string): boolean {
    return this.store.audioConnections.some(
      c => c.sourceNodeId === nodeId || c.targetNodeId === nodeId
    )
  }

  /**
   * Checks if two specific nodes are connected
   */
  areConnected(sourceId: string, targetId: string): boolean {
    return this.store.audioConnections.some(
      c => c.sourceNodeId === sourceId && c.targetNodeId === targetId
    )
  }

  /******************* CONNECTION STATISTICS ***********************/

  /**
   * Gets connection statistics for the graph
   */
  getConnectionStats(): {
    totalConnections: number
    audioToAudio: number
    customConnections: number
  } {
    let audioToAudio = 0
    let customConnections = 0

    this.store.audioConnections.forEach(conn => {
      const connectionType = this.getConnectionType(conn.sourceNodeId, conn.targetNodeId)
      if (connectionType === 'audio-to-audio' || connectionType === 'audio-to-param') {
        audioToAudio++
      } else {
        customConnections++
      }
    })

    return {
      totalConnections: this.store.audioConnections.length,
      audioToAudio,
      customConnections,
    }
  }
}

/******************* FACTORY FUNCTION ***********************/

/**
 * Creates an AudioConnector instance for a given store
 */
export function createAudioConnector(store: IAudioGraphStore): AudioConnector {
  return new AudioConnector(store)
}
