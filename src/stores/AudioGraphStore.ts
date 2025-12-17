import { types, flow, getEnv, destroy, getParent } from 'mobx-state-tree'
import type { Instance } from 'mobx-state-tree'
import { reaction } from 'mobx'
import { VisualEdgeModel, AudioConnectionModel, INodeMetadata } from './NodeModels'
import { NodeAdapter } from './NodeAdapter'
import { AudioNodeFactory } from '~/services/AudioNodeFactory'
import { CustomNodeFactory, type CustomNode } from '~/services/CustomNodeFactory'
import { customNodeStore } from '~/stores/CustomNodeStore'
import UndoManager from './UndoManager'
import { createContext, useContext } from 'react'
// Import the JSON metadata directly
import webAudioMetadataJson from '~/types/web-audio-metadata.json'
import customNodesMetadataJson from '~/types/custom-nodes-metadata.json'

// Use the imported metadata directly
const getWebAudioMetadata = (): Record<string, INodeMetadata> => {
  return webAudioMetadataJson as unknown as Record<string, INodeMetadata>
}

const getCustomNodesMetadata = (): Record<string, INodeMetadata> => {
  return customNodesMetadataJson as unknown as Record<string, INodeMetadata>
}

// Combine both metadata sources
const getAllNodesMetadata = (): Record<string, INodeMetadata> => {
  return {
    ...getWebAudioMetadata(),
    ...getCustomNodesMetadata(),
  }
}

// Helper function to encode Float32Array to WAV format
const encodeWAV = (
  leftChannel: Float32Array,
  rightChannel: Float32Array,
  sampleRate: number
): Blob => {
  const length = leftChannel.length
  const buffer = new ArrayBuffer(44 + length * 4) // WAV header (44 bytes) + stereo data (4 bytes per sample)
  const view = new DataView(buffer)

  // Write WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length * 4, true) // File size
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size
  view.setUint16(20, 1, true) // AudioFormat (PCM)
  view.setUint16(22, 2, true) // NumChannels (stereo)
  view.setUint32(24, sampleRate, true) // SampleRate
  view.setUint32(28, sampleRate * 4, true) // ByteRate
  view.setUint16(32, 4, true) // BlockAlign
  view.setUint16(34, 16, true) // BitsPerSample
  writeString(36, 'data')
  view.setUint32(40, length * 4, true) // Subchunk2Size

  // Convert float samples to 16-bit PCM
  let offset = 44
  for (let i = 0; i < length; i++) {
    // Left channel
    const leftSample = Math.max(-1, Math.min(1, leftChannel[i]))
    view.setInt16(offset, leftSample * 0x7fff, true)
    offset += 2

    // Right channel
    const rightSample = Math.max(-1, Math.min(1, rightChannel[i]))
    view.setInt16(offset, rightSample * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export const AudioGraphStore = types
  .model('AudioGraphStore', {
    adaptedNodes: types.array(NodeAdapter), // Unified node system
    visualEdges: types.array(VisualEdgeModel),
    audioConnections: types.array(AudioConnectionModel),
    // UndoManager for proper undo/redo functionality
    history: types.optional(UndoManager, {}),
  })
  .volatile(() => ({
    audioContext: null as AudioContext | null,
    audioNodes: new Map<string, AudioNode>(),
    customNodes: new Map<string, CustomNode>(),
    webAudioMetadata: {} as Record<string, INodeMetadata>,
    audioNodeFactory: null as AudioNodeFactory | null,
    customNodeFactory: null as CustomNodeFactory | null,
    // Keep only the patch application flag in volatile
    isApplyingPatch: false,
    // Flag to disable undo/redo recording (for examples)
    isCreatingExample: false,
    // Flag to disable undo/redo recording (for clearing all nodes)
    isClearingAllNodes: false,
    // Flag to disable undo/redo recording (for automatic play state changes)
    isUpdatingPlayState: false,
    // Flag to disable modification tracking during project loading
    isLoadingProject: false,
    // Flag to prevent audio context recreation when intentionally stopping
    isStoppedByTheUser: false,
    // Global analyzer for frequency analysis
    globalAnalyzer: null as AnalyserNode | null,
    // Counter to ensure unique node IDs
    nodeIdCounter: 0,
    // Store media streams for microphone nodes
    mediaStreams: new Map<string, MediaStream>(),
    // New field for custom node bridges
    customNodeBridges: null as Map<string, ConstantSourceNode | GainNode> | null,
    // Clipboard for copy/paste functionality
    clipboardNodes: [] as any[],
    clipboardEdges: [] as any[],
    // Clipboard permission state
    clipboardPermissionState: 'unknown' as 'granted' | 'denied' | 'prompt' | 'unknown',
    clipboardError: null as string | null,
    // Reaction disposer for automatic audio node creation
    audioNodeCreationReactionDisposer: null as (() => void) | null,
    // Reaction disposers for source node play state reactions
    sourceNodeReactionDisposers: null as Map<string, () => void> | null,
    // Node runtime state (for tracking individual node states like isRunning)
    nodeStates: new Map<string, { isRunning?: boolean; [key: string]: any }>(),
    // Recording state
    isRecording: false,
    recordingProcessor: null as ScriptProcessorNode | null,
    recordingBuffers: [[], []] as Float32Array[][],
    recordingStartTime: null as number | null,
  }))
  .preProcessSnapshot((snapshot: any) => {
    // Apply migration logic when loading snapshots
    if (!snapshot.adaptedNodes) return snapshot

    const migratedSnapshot = { ...snapshot }

    // Migrate nodes from old format (data.nodeType, data.metadata) to new format (nodeType, metadata)
    migratedSnapshot.adaptedNodes = snapshot.adaptedNodes.map((node: any) => {
      if (node.data && node.data.nodeType && node.data.metadata) {
        // Old format - migrate to new format
        return {
          id: node.id,
          nodeType: node.data.nodeType,
          position: node.position,
          metadata: node.data.metadata,
          properties: node.data.properties || {},
          type: node.type || 'audioNode',
          selected: node.selected || false,
          dragging: node.dragging || false,
          inputConnections: node.inputConnections || [],
          outputConnections: node.outputConnections || [],
          audioNodeCreated: false,
        }
      }
      // New format - return as is (but ensure audioNodeCreated is present)
      return {
        ...node,
        audioNodeCreated: node.audioNodeCreated || false,
      }
    })

    return migratedSnapshot
  })
  .views(self => ({
    get root(): any {
      return getParent(self)
    },
  }))
  .actions(self => {
    return {
      loadMetadata() {
        try {
          self.webAudioMetadata = getAllNodesMetadata()
        } catch {
          console.error('STORE: Error loading metadata:')
        }
      },

      undo() {
        self.history.undo()
      },

      redo() {
        self.history.redo()
      },

      setApplyingPatch(value: boolean) {
        self.history.withoutUndo(() => {
          self.isApplyingPatch = value
        })
      },

      setCreatingExample(value: boolean) {
        self.isCreatingExample = value
      },

      setClearingAllNodes(value: boolean) {
        self.history.withoutUndo(() => {
          self.isClearingAllNodes = value
        })
      },

      setUpdatingPlayState(value: boolean) {
        self.history.withoutUndo(() => {
          self.isUpdatingPlayState = value
        })
      },

      // Action to set/reset project loading state
      setLoadingProject(value: boolean) {
        self.isLoadingProject = value
      },

      // Action to set/reset stopping state
      setIsStoppedByTheUser(value: boolean) {
        self.isStoppedByTheUser = value
      },

      // Set node runtime state
      setNodeState(nodeId: string, state: { isRunning?: boolean; [key: string]: any }) {
        const currentState = self.nodeStates.get(nodeId) || {}
        self.nodeStates.set(nodeId, { ...currentState, ...state })
      },

      // Clear node state when node is removed
      clearNodeState(nodeId: string) {
        if (self.nodeStates.has(nodeId)) {
          self.nodeStates.delete(nodeId)
        }
      },

      // Recreate and start an oscillator (needed because oscillators can only be started once)
      recreateAndStartOscillator(nodeId: string) {
        const visualNode = self.adaptedNodes.find(node => node.id === nodeId)
        if (!visualNode || visualNode.nodeType !== 'OscillatorNode') {
          console.error('Node not found or not an oscillator:', nodeId)
          return
        }

        // Get current properties
        const properties = Object.fromEntries(visualNode.properties.entries())
        const metadata = visualNode.metadata as unknown as INodeMetadata

        // Stop and disconnect the old oscillator
        const oldAudioNode = self.audioNodes.get(nodeId)
        if (oldAudioNode) {
          try {
            oldAudioNode.disconnect()
            if ('stop' in oldAudioNode && typeof oldAudioNode.stop === 'function') {
              oldAudioNode.stop()
            }
          } catch {
            // Ignore errors when stopping/disconnecting
          }
        }

        // Create a new oscillator
        if (self.audioNodeFactory) {
          try {
            const newAudioNode = self.audioNodeFactory.createAudioNode(
              'OscillatorNode',
              metadata,
              properties
            )
            self.audioNodes.set(nodeId, newAudioNode)

            // Start the new oscillator
            self.audioNodeFactory.triggerSourceNode(newAudioNode, 'OscillatorNode')
            this.setNodeState(nodeId, { isRunning: true })

            // Reconnect all existing connections
            this.reconnectNodeConnections(nodeId)
          } catch (error) {
            console.error('Failed to recreate oscillator:', error)
          }
        }
      },

      // Reconnect all connections for a node (used after recreating oscillators)
      reconnectNodeConnections(nodeId: string) {
        // Reconnect audio connections where this node is the source
        const sourceConnections = self.audioConnections.filter(conn => conn.sourceNodeId === nodeId)
        sourceConnections.forEach(conn => {
          try {
            this.connectAudioNodes(
              conn.sourceNodeId,
              conn.targetNodeId,
              conn.sourceOutput,
              conn.targetInput,
              true // Skip adding to array since it's already there
            )
          } catch (error) {
            console.warn('Failed to reconnect source connection:', error)
          }
        })

        // Reconnect audio connections where this node is the target
        const targetConnections = self.audioConnections.filter(conn => conn.targetNodeId === nodeId)
        targetConnections.forEach(conn => {
          try {
            this.connectAudioNodes(
              conn.sourceNodeId,
              conn.targetNodeId,
              conn.sourceOutput,
              conn.targetInput,
              true // Skip adding to array since it's already there
            )
          } catch (error) {
            console.warn('Failed to reconnect target connection:', error)
          }
        })
      },

      // Check clipboard permissions
      checkClipboardPermission: flow(function* () {
        try {
          const nav = navigator as any
          if (!nav.clipboard) {
            self.clipboardPermissionState = 'denied'
            self.clipboardError = 'Clipboard API not supported in this browser'
            return 'denied'
          }

          // Try to check permission if available
          if ('permissions' in navigator) {
            try {
              const permission = yield nav.permissions.query({ name: 'clipboard-read' })
              self.clipboardPermissionState = permission.state as 'granted' | 'denied' | 'prompt'
              self.clipboardError = null
              return permission.state
            } catch {
              // Fallback: try to read clipboard to test permission
              try {
                yield nav.clipboard.readText()
                self.clipboardPermissionState = 'granted'
                self.clipboardError = null
                return 'granted'
              } catch {
                self.clipboardPermissionState = 'denied'
                self.clipboardError = 'Clipboard access denied'
                return 'denied'
              }
            }
          } else {
            // Fallback: try to read clipboard to test permission
            try {
              yield nav.clipboard.readText()
              self.clipboardPermissionState = 'granted'
              self.clipboardError = null
              return 'granted'
            } catch {
              self.clipboardPermissionState = 'denied'
              self.clipboardError = 'Clipboard access denied'
              return 'denied'
            }
          }
        } catch {
          self.clipboardPermissionState = 'denied'
          self.clipboardError = 'Failed to check clipboard permission'
          return 'denied'
        }
      }),

      // Clear clipboard error
      clearClipboardError() {
        self.clipboardError = null
      },

      // Test helper to set clipboard data directly (for testing only)
      setClipboardDataForTesting(nodes: any[], edges: any[]) {
        self.clipboardNodes = nodes
        self.clipboardEdges = edges
      },

      // Test helper to set clipboard error directly (for testing only)
      setClipboardErrorForTesting(error: string | null) {
        self.clipboardError = error
      },

      // Helper action to set clipboard permission state and error (for async callbacks)
      setClipboardPermissionState(
        state: 'granted' | 'denied' | 'prompt' | 'unknown',
        error: string | null = null
      ) {
        self.clipboardPermissionState = state
        self.clipboardError = error
      },

      // DEPRECATED: Audio nodes are now created automatically by lifecycle hooks
      // recreateAudioGraph: flow(function* () {
      //   // This method is no longer needed as audio nodes are created/destroyed
      //   // automatically when visual nodes are added/removed via afterCreate/beforeDestroy
      // }),

      initializeAudioContext() {
        if (!self.audioContext && !self.isStoppedByTheUser) {
          self.audioContext = new AudioContext()
          self.audioNodeFactory = new AudioNodeFactory(self.audioContext)
          self.customNodeFactory = new CustomNodeFactory(self.audioContext)

          // Create global analyzer for frequency analysis
          self.globalAnalyzer = self.audioContext.createAnalyser()
          self.globalAnalyzer.fftSize = 1024
          self.globalAnalyzer.smoothingTimeConstant = 0.8
        }
      },

      // New method to add adapted nodes using the NodeAdapter system
      addAdaptedNode(nodeType: string, position: { x: number; y: number }) {
        // Check both WebAudio and Custom node metadata
        const allMetadata = getAllNodesMetadata()
        const metadata = allMetadata[nodeType]

        if (!metadata) {
          console.error('STORE: Unknown node type:', nodeType)
          throw new Error(`Unknown node type: ${nodeType}`)
        }

        // Increment counter and use it with timestamp to ensure uniqueness
        self.nodeIdCounter += 1
        const nodeId = `${nodeType}-${Date.now()}-${self.nodeIdCounter}`

        // Apply smart positioning to prevent overlapping
        const finalPosition = this.findAvailablePosition(position)

        // Create properties from metadata
        const propertiesObj: Record<string, unknown> = {}
        metadata.properties.forEach(prop => {
          propertiesObj[prop.name] = prop.defaultValue
        })

        // Create the adapted node using MST model
        const adaptedNode = NodeAdapter.create({
          id: nodeId,
          nodeType,
          position: {
            x: finalPosition.x,
            y: finalPosition.y,
          },
          metadata: {
            name: metadata.name,
            description: metadata.description,
            category: metadata.category,
            inputs: metadata.inputs,
            outputs: metadata.outputs,
            properties: metadata.properties,
            methods: metadata.methods,
            events: metadata.events,
          },
          properties: propertiesObj,
          inputConnections: [],
          outputConnections: [],
        })

        // Add the adapted node to the store
        try {
          self.adaptedNodes.push(adaptedNode)

          // Initialize the adapted node after it's added to the store
          adaptedNode.initialize()
        } catch (error) {
          console.error('STORE: Error adding adapted node:', error)
          throw error
        }

        // Increment graph change counter to force React re-render
        self.root.forceRerender()
        self.root.markProjectModified()

        return nodeId
      },

      // Helper method to find available position (smart positioning)
      findAvailablePosition(requestedPosition: { x: number; y: number }): { x: number; y: number } {
        const NODE_WIDTH = 200
        const NODE_HEIGHT = 100
        const SPACING = 20

        // Get all existing node positions
        const existingPositions = [
          ...self.adaptedNodes.map(node => ({ x: node.position.x, y: node.position.y })),
        ]

        // Check if requested position is available
        const isPositionAvailable = (pos: { x: number; y: number }) => {
          return !existingPositions.some(
            existing =>
              Math.abs(existing.x - pos.x) < NODE_WIDTH + SPACING &&
              Math.abs(existing.y - pos.y) < NODE_HEIGHT + SPACING
          )
        }

        // If requested position is available, use it
        if (isPositionAvailable(requestedPosition)) {
          return requestedPosition
        }

        // Otherwise, find the next available position
        const startX = requestedPosition.x
        const startY = requestedPosition.y

        // Try positions in a spiral pattern
        for (let offset = 0; offset < 1000; offset += NODE_WIDTH + SPACING) {
          const positions = [
            { x: startX + offset, y: startY },
            { x: startX, y: startY + offset },
            { x: startX - offset, y: startY },
            { x: startX, y: startY - offset },
            { x: startX + offset, y: startY + offset },
            { x: startX - offset, y: startY + offset },
            { x: startX + offset, y: startY - offset },
            { x: startX - offset, y: startY - offset },
          ]

          for (const pos of positions) {
            if (isPositionAvailable(pos)) {
              return pos
            }
          }
        }

        // Fallback: use requested position with random offset
        return {
          x: requestedPosition.x + Math.random() * 100,
          y: requestedPosition.y + Math.random() * 100,
        }
      },

      removeNode(nodeId: string) {
        const adaptedNode = self.adaptedNodes.find(node => node.id === nodeId)

        if (!adaptedNode) {
          return
        }

        // Remove connected edges
        const connectedEdges = self.visualEdges.filter(
          edge => edge.source === nodeId || edge.target === nodeId
        )
        connectedEdges.forEach(edge => {
          this.removeEdge(edge.id)
        })

        // Explicitly cleanup audio node before destroying the visual node
        this.cleanupAudioNode(nodeId)

        // Remove the adapted node (this will trigger beforeDestroy)
        const nodeIndex = self.adaptedNodes.findIndex(node => node.id === nodeId)
        if (nodeIndex !== -1) {
          // Use MST destroy() to properly trigger lifecycle hooks
          destroy(self.adaptedNodes[nodeIndex])
        }

        // Increment graph change counter to force React re-render
        self.root?.forceRerender()

        // Mark project as modified
        self.root?.markProjectModified()
      },

      // Get custom node by ID (for external access)
      getCustomNode(nodeId: string) {
        return self.customNodes.get(nodeId)
      },

      // New method to handle audio node cleanup (called by VisualNode beforeDestroy)
      cleanupAudioNode(nodeId: string) {
        const audioNode = self.audioNodes.get(nodeId)
        const customNode = self.customNodes.get(nodeId)

        if (audioNode) {
          // Disconnect all outputs
          try {
            audioNode.disconnect()
          } catch (error) {
            console.error('Error disconnecting audio node:', error)
          }

          // Stop source nodes
          if ('stop' in audioNode && typeof audioNode.stop === 'function') {
            try {
              ;(audioNode as OscillatorNode | AudioBufferSourceNode).stop()
            } catch (error) {
              console.error('Error stopping source node:', error)
            }
          }

          // For source nodes, try to stop them manually
          if ('stop' in audioNode && typeof audioNode.stop === 'function') {
            try {
              ;(audioNode as OscillatorNode | AudioBufferSourceNode).stop()
            } catch {
              // Node might already be stopped, ignore
            }
          }

          self.audioNodes.delete(nodeId)
        } else if (customNode) {
          // Clean up custom node
          if ('stop' in customNode && typeof customNode.stop === 'function') {
            try {
              ;(customNode as any).stop()
            } catch (error) {
              console.error('Error stopping custom node:', error)
            }
          }

          if ('disconnect' in customNode && typeof customNode.disconnect === 'function') {
            try {
              customNode.disconnect()
            } catch (error) {
              console.error('Error disconnecting custom node:', error)
            }
          }

          self.customNodes.delete(nodeId)

          // Also remove from CustomNodeStore
          try {
            const customNodeStore = getEnv(self).customNodeStore
            if (customNodeStore && customNodeStore.removeNode) {
              try {
                customNodeStore.removeNode(nodeId)
              } catch (error) {
                console.error('Error removing from CustomNodeStore:', error)
              }
            }
          } catch {
            // Environment not available (e.g., in tests), skip CustomNodeStore cleanup
            console.warn('CustomNodeStore environment not available, skipping cleanup')
          }
        }

        // Clean up any media streams
        const mediaStream = self.mediaStreams.get(nodeId)
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => {
            track.stop()
          })
          self.mediaStreams.delete(nodeId)
        }

        // Clean up any custom node bridges
        if (self.customNodeBridges) {
          const bridgesToRemove: string[] = []
          self.customNodeBridges.forEach((bridge, key) => {
            if (key.includes(nodeId)) {
              try {
                if ('stop' in bridge && typeof bridge.stop === 'function') {
                  bridge.stop()
                }
                bridge.disconnect()
                bridgesToRemove.push(key)
              } catch (error) {
                console.error(`Error cleaning up bridge ${key}:`, error)
              }
            }
          })
          bridgesToRemove.forEach(key => self.customNodeBridges!.delete(key))
        }

        // Remove audio connections involving this node
        const connectionsToRemove = self.audioConnections.filter(
          conn => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId
        )
        connectionsToRemove.forEach(conn => {
          const index = self.audioConnections.indexOf(conn)
          if (index !== -1) {
            self.audioConnections.splice(index, 1)
          }
        })

        // Clear node runtime state
        this.clearNodeState(nodeId)
      },

      // New method to sync audio node properties (called by VisualNode reaction)
      syncAudioNodeProperties(nodeId: string, properties: Record<string, any>) {
        const audioNode = self.audioNodes.get(nodeId)
        const customNode = self.customNodes.get(nodeId)
        const visualNode = self.adaptedNodes.find(node => node.id === nodeId)

        if (!visualNode) return

        const nodeType = visualNode.nodeType
        const metadata = visualNode.metadata

        if (audioNode && self.audioNodeFactory) {
          // Update regular audio node properties
          Object.entries(properties).forEach(([propertyName, value]) => {
            try {
              const success = self.audioNodeFactory!.updateNodeProperty(
                audioNode,
                nodeType,
                metadata as INodeMetadata,
                propertyName,
                value
              )

              if (!success) {
                console.warn(`Property ${propertyName} not found on node ${nodeId}`)
              }
            } catch (error) {
              console.error(`Error updating audio property ${propertyName}:`, error)
            }
          })
        } else if (customNode) {
          // Update custom node properties
          const mobxNode = customNodeStore.getNode(nodeId)
          if (mobxNode) {
            Object.entries(properties).forEach(([propertyName, value]) => {
              try {
                mobxNode.setProperty(propertyName, value)
                // Also update outputs if needed
                const hasCorrespondingOutput = metadata.outputs?.some(
                  (output: any) => output.name === propertyName
                )
                if (hasCorrespondingOutput || propertyName === 'value') {
                  mobxNode.setOutput(propertyName === 'value' ? 'value' : propertyName, value)
                }
              } catch (error) {
                console.error(`Error updating custom node property ${propertyName}:`, error)
              }
            })
          }
        }
      },

      clearAllNodes() {
        self.history.withoutUndo(() => {
          this.setIsStoppedByTheUser(false)
          self.root?.setIsPlaying(false)
          // Set flag to prevent recording this operation in undo history
          this.setClearingAllNodes(true)

          // Get all node IDs first to avoid modifying array while iterating
          const visualNodeIds = self.adaptedNodes.map(node => node.id)
          const adaptedNodeIds = self.adaptedNodes.map(node => node.id)
          const allNodeIds = [...visualNodeIds, ...adaptedNodeIds]

          // Remove each node properly
          allNodeIds.forEach(nodeId => {
            this.removeNode(nodeId)
          })

          // Perform comprehensive audio cleanup
          this.performComprehensiveAudioCleanup()

          // Double-check that everything is cleared
          if (self.adaptedNodes.length > 0) {
            console.warn('Some visual nodes were not removed, force clearing...')
            self.adaptedNodes.clear()
          }

          if (self.adaptedNodes.length > 0) {
            console.warn('Some adapted nodes were not removed, force clearing...')
            self.adaptedNodes.clear()
          }

          if (self.visualEdges.length > 0) {
            console.warn('Some edges were not removed, force clearing...')
            self.visualEdges.clear()
          }

          if (self.audioConnections.length > 0) {
            console.warn('Some audio connections were not removed, force clearing...')
            self.audioConnections.clear()
          }

          // Clear undo/redo history since there's nothing left to undo to
          self.history.clear()

          // Reset play state since no audio is playing
          this.setUpdatingPlayState(true)
          self.root?.setIsPlaying(false)
          this.setUpdatingPlayState(false)

          // Increment graph change counter to force React re-render
          // (do this before resetting flag to avoid recording in undo history)
          self.root?.forceRerender()

          // Reset flag to allow recording future operations
          this.setClearingAllNodes(false)

          // Reset project modification state since we've cleared everything
          self.root.setProjectModified(false)
        })
      },

      performComprehensiveAudioCleanup() {
        // Stop and disconnect all remaining audio nodes
        if (self.audioNodes.size > 0) {
          self.audioNodes.forEach((audioNode, nodeId) => {
            try {
              // Disconnect all connections
              audioNode.disconnect()

              // Stop source nodes (OscillatorNode, AudioBufferSourceNode)
              if ('stop' in audioNode && typeof audioNode.stop === 'function') {
                try {
                  ;(audioNode as OscillatorNode | AudioBufferSourceNode).stop()
                } catch (stopError) {
                  // Node might already be stopped, ignore
                  console.error(`Node ${nodeId} already stopped or stopping failed:`, stopError)
                }
              }

              // Close MediaStreamAudioSourceNode streams
              if (audioNode.constructor.name === 'MediaStreamAudioSourceNode') {
                const mediaNode = audioNode as MediaStreamAudioSourceNode
                if (mediaNode.mediaStream) {
                  mediaNode.mediaStream.getTracks().forEach(track => {
                    track.stop()
                  })
                }
              }
            } catch (error) {
              console.error(`Error cleaning up audio node ${nodeId}:`, error)
            }
          })

          self.audioNodes.clear()
        }

        // Clean up global analyzer
        if (self.globalAnalyzer) {
          try {
            self.globalAnalyzer.disconnect()
          } catch (error) {
            console.error('Error disconnecting global analyzer:', error)
          }
          self.globalAnalyzer = null
        }

        // Clean up all stored media streams
        if (self.mediaStreams.size > 0) {
          self.mediaStreams.forEach((stream, nodeId) => {
            try {
              stream.getTracks().forEach(track => {
                track.stop()
              })
            } catch (error) {
              console.error(`Error stopping media stream for node ${nodeId}:`, error)
            }
          })
          self.mediaStreams.clear()
        }

        // Reinitialize audio context for a fresh start
        if (self.audioContext) {
          try {
            // Close the current audio context
            if (self.audioContext.state !== 'closed') {
              self.audioContext.close()
            }
          } catch (error) {
            console.error('Error closing audio context:', error)
          }

          // Reset audio context and factory
          self.audioContext = null
          self.audioNodeFactory = null
          self.customNodeFactory = null

          // Create new audio context
          this.initializeAudioContext()
        }
      },

      forceAudioCleanup() {
        // Suspend audio context first to stop all processing
        if (self.audioContext && self.audioContext.state === 'running') {
          self.audioContext.suspend()
        }

        // Perform comprehensive cleanup
        this.performComprehensiveAudioCleanup()
      },

      addEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string) {
        // Validate connection before creating
        const isValid = this.isValidConnection(source, target, sourceHandle, targetHandle)

        if (!isValid) {
          console.warn('Invalid connection attempted:', {
            source,
            target,
            sourceHandle,
            targetHandle,
          })
          return
        }

        const edgeId = `${source}-${target}-${sourceHandle || 'output'}-${targetHandle || 'input'}`
        const edge = {
          id: edgeId,
          source,
          target,
          sourceHandle,
          targetHandle,
        }

        try {
          self.visualEdges.push(edge)
        } catch (error) {
          console.error('Error adding edge to visualEdges:', error)
          return
        }

        // Create audio connection
        try {
          this.connectAudioNodes(source, target, sourceHandle || 'output', targetHandle || 'input')
        } catch (error) {
          console.error('Error creating audio connection:', error)
        }

        // Mark project as modified
        self.root?.markProjectModified()

        // Increment graph change counter to force React re-render
        self.root?.forceRerender()
      },

      isValidConnection(
        sourceId: string,
        targetId: string,
        sourceHandle?: string,
        targetHandle?: string
      ): boolean {
        // Look for nodes in both visual and adapted nodes
        const sourceVisualNode = self.adaptedNodes.find(node => node.id === sourceId)
        const targetVisualNode = self.adaptedNodes.find(node => node.id === targetId)
        const sourceAdaptedNode = self.adaptedNodes.find(node => node.id === sourceId)
        const targetAdaptedNode = self.adaptedNodes.find(node => node.id === targetId)

        const sourceNode = sourceVisualNode || sourceAdaptedNode
        const targetNode = targetVisualNode || targetAdaptedNode

        if (!sourceNode || !targetNode) {
          console.warn('Source or target node not found for connection validation')
          return false
        }

        // Find the specific output and input
        const outputName = sourceHandle || 'output'
        const inputName = targetHandle || 'input'

        // Get metadata from the appropriate node type
        // For custom nodes, use the global metadata
        let sourceMetadata: any
        let targetMetadata: any

        if (sourceNode.nodeType && self.customNodeFactory?.isCustomNodeType(sourceNode.nodeType)) {
          // Custom node - get metadata from global custom nodes metadata
          const customMetadata = getCustomNodesMetadata()
          sourceMetadata = customMetadata[sourceNode.nodeType]
        } else {
          // Web Audio node - use node's metadata
          sourceMetadata = sourceVisualNode?.metadata || sourceAdaptedNode?.metadata
        }

        if (targetNode.nodeType && self.customNodeFactory?.isCustomNodeType(targetNode.nodeType)) {
          // Custom node - get metadata from global custom nodes metadata
          const customMetadata = getCustomNodesMetadata()
          targetMetadata = customMetadata[targetNode.nodeType]
        } else {
          // Web Audio node - use node's metadata
          targetMetadata = targetVisualNode?.metadata || targetAdaptedNode?.metadata
        }

        const sourceOutput = sourceMetadata?.outputs.find(
          (output: any) => output.name === outputName
        )
        const targetInput = targetMetadata?.inputs.find((input: any) => input.name === inputName)

        if (!sourceOutput || !targetInput) {
          console.warn('Output or input not found:', {
            outputName,
            inputName,
            sourceNodeType: sourceNode.nodeType,
            targetNodeType: targetNode.nodeType,
          })
          return false
        }

        // Check type compatibility
        // Allow: audio -> audio, audio -> control (for modulation), control -> control
        // Disallow: control -> audio
        const isCompatible =
          (sourceOutput.type === 'audio' && targetInput.type === 'audio') ||
          (sourceOutput.type === 'audio' && targetInput.type === 'control') ||
          (sourceOutput.type === 'control' && targetInput.type === 'control')

        if (!isCompatible) {
          console.warn('Incompatible connection types:', {
            sourceType: sourceOutput.type,
            targetType: targetInput.type,
          })
        }

        return isCompatible
      },

      removeEdge(edgeId: string) {
        const edgeIndex = self.visualEdges.findIndex(edge => edge.id === edgeId)
        if (edgeIndex !== -1) {
          const edge = self.visualEdges[edgeIndex]

          // Disconnect audio nodes
          this.disconnectAudioNodes(edge.source, edge.target)

          self.visualEdges.splice(edgeIndex, 1)

          // Mark project as modified
          self.root?.markProjectModified()

          // Increment graph change counter to force React re-render
          self.root?.forceRerender()
        }
      },

      connectAudioNodes(
        sourceId: string,
        targetId: string,
        sourceOutput: string,
        targetInput: string,
        skipAddingToArray = false
      ) {
        const sourceNode = self.audioNodes.get(sourceId)
        const targetNode = self.audioNodes.get(targetId)
        const sourceCustomNode = self.customNodes.get(sourceId)
        const targetCustomNode = self.customNodes.get(targetId)

        // Handle custom node to custom node connections
        if (sourceCustomNode && targetCustomNode) {
          try {
            // Connect the custom nodes via the MST store (correct parameter order)
            customNodeStore.connectNodes(sourceId, sourceOutput, targetId, targetInput)

            // Special handling for trigger connections - create bridge for updateCustomNodeBridges
            if (targetInput === 'trigger') {
              const triggerBridge = self.audioContext!.createGain()
              triggerBridge.gain.value = 0 // Silent bridge

              // Store the bridge for cleanup and mark it as a trigger bridge
              if (!self.customNodeBridges) {
                self.customNodeBridges = new Map()
              }
              self.customNodeBridges.set(`${sourceId}-${targetId}-trigger`, triggerBridge)
            }

            if (!skipAddingToArray) {
              self.audioConnections.push({
                sourceNodeId: sourceId,
                targetNodeId: targetId,
                sourceOutput,
                targetInput,
              })
            }
          } catch (error) {
            console.error('Failed to connect custom node to custom node:', error)
          }
          return
        }

        // Handle audio node to custom node connections
        if (sourceNode && targetCustomNode) {
          try {
            // Check if this is an audio connection to a logical controller
            const targetVisualNode = self.adaptedNodes.find(node => node.id === targetId)
            const targetMetadata = targetVisualNode?.metadata
            const targetInputDef = targetMetadata?.inputs.find(
              (input: any) => input.name === targetInput
            )
            const isAudioInput = targetInputDef?.type === 'audio'

            if (
              isAudioInput &&
              (targetVisualNode?.nodeType === 'GreaterThanNode' ||
                targetVisualNode?.nodeType === 'EqualsNode')
            ) {
              // Connect audio node to logical controller's audio input
              const audioOutput = targetCustomNode.getAudioOutput?.()
              if (audioOutput) {
                sourceNode.connect(audioOutput)
                // Notify the custom node that audio input is connected
                targetCustomNode.receiveInput?.(targetInput, true)
              } else {
                console.error(`Custom node ${targetId} does not have audio input available`)
                return
              }
            } else {
              console.error('Audio nodes can only connect to audio inputs of logical controllers')
              return
            }

            if (!skipAddingToArray) {
              self.audioConnections.push({
                sourceNodeId: sourceId,
                targetNodeId: targetId,
                sourceOutput,
                targetInput,
              })
            }
          } catch (error) {
            console.error('Failed to connect audio node to custom node:', error)
          }
          return
        }

        // Handle custom node to audio node connections
        if (sourceCustomNode && targetNode) {
          try {
            // Check if we're connecting to the destination node
            const targetVisualNode = self.adaptedNodes.find(node => node.id === targetId)
            const isDestinationConnection = targetVisualNode?.nodeType === 'AudioDestinationNode'

            // Check if this is a control connection (to an AudioParam)
            const targetMetadata = targetVisualNode?.metadata
            const targetInputDef = targetMetadata?.inputs.find(
              (input: any) => input.name === targetInput
            )
            const isControlConnection = targetInputDef?.type === 'control'

            // Check if this is an audio connection from custom node
            const sourceVisualNode = self.adaptedNodes.find(node => node.id === sourceId)
            const sourceMetadata = sourceVisualNode?.metadata
            const sourceOutputDef = sourceMetadata?.outputs.find(
              (output: any) => output.name === sourceOutput
            )
            const isAudioOutput = sourceOutputDef?.type === 'audio'
            const isAudioInput = targetInputDef?.type === 'audio'

            if (isAudioOutput && isAudioInput) {
              // Handle audio output from custom node to audio input of audio node
              const audioOutput = sourceCustomNode.getAudioOutput?.()
              if (audioOutput) {
                if (isDestinationConnection && self.globalAnalyzer) {
                  // Connect through analyzer for destination
                  audioOutput.connect(self.globalAnalyzer)
                  self.globalAnalyzer.connect(targetNode)
                } else {
                  // Direct audio connection
                  audioOutput.connect(targetNode)
                }
              } else {
                console.error(`Custom node ${sourceId} does not have audio output available`)
                return
              }
            } else if (isControlConnection) {
              // Special handling for trigger inputs
              if (targetInput === 'trigger') {
                // Create a trigger bridge for any node type that has a trigger input
                const triggerBridge = self.audioContext!.createGain()
                triggerBridge.gain.value = 0 // Silent bridge

                // Store the bridge for cleanup and mark it as a trigger bridge
                if (!self.customNodeBridges) {
                  self.customNodeBridges = new Map()
                }
                self.customNodeBridges.set(`${sourceId}-${targetId}-trigger`, triggerBridge)

                // The trigger mechanism will be handled in updateCustomNodeBridges
                // This works for OscillatorNode, SoundFileNode, and any other custom node with trigger input
              } else {
                // Create a ConstantSourceNode bridge for custom node control output
                const constantSource = self.audioContext!.createConstantSource()

                // Get current output value from custom node
                const currentValue = sourceCustomNode.outputs.get(sourceOutput) || 0
                constantSource.offset.value = currentValue

                // Connect to AudioParam
                const targetNodeWithParams = targetNode as unknown as Record<string, AudioParam>
                const audioParam = targetNodeWithParams[targetInput]

                if (audioParam && typeof audioParam.value !== 'undefined') {
                  constantSource.connect(audioParam)
                  constantSource.start()

                  // Get the source node info to determine connection type
                  const sourceVisualNode = self.adaptedNodes.find(node => node.id === sourceId)
                  const sourceNodeType = sourceVisualNode?.nodeType

                  // Smart base value handling based on parameter and source type
                  if (targetInput === 'frequency') {
                    // For frequency parameters, check the source type
                    if (sourceNodeType === 'SliderNode' || sourceNodeType === 'MidiToFreqNode') {
                      // Direct frequency control - these nodes output frequency values
                      audioParam.value = 0
                    }
                  } else {
                    // For other AudioParams (gain, detune, etc.), set base to 0 for direct control
                    audioParam.value = 0
                  }

                  // Store the bridge source for updates and cleanup
                  if (!self.customNodeBridges) {
                    self.customNodeBridges = new Map()
                  }
                  self.customNodeBridges.set(`${sourceId}-${targetId}`, constantSource)

                  // Force an immediate update to ensure the bridge has the latest value
                  // This handles the case where the custom node already has a valid output value
                  setTimeout(() => {
                    const latestValue = sourceCustomNode.outputs.get(sourceOutput)
                    if (latestValue !== undefined && latestValue !== currentValue) {
                      constantSource.offset.value = latestValue
                    }
                  }, 1)
                } else {
                  console.error(`AudioParam ${targetInput} not found on target node`)
                  return
                }
              }
            } else {
              console.error('Custom nodes can only connect to control inputs (AudioParams)')
              return
            }

            if (!skipAddingToArray) {
              self.audioConnections.push({
                sourceNodeId: sourceId,
                targetNodeId: targetId,
                sourceOutput,
                targetInput,
              })
            }

            if (isDestinationConnection && !skipAddingToArray && !self.isUpdatingPlayState) {
              // Audio is now playing through the destination, update play state
              // Only set automatically for user-initiated connections (not during reaction-based recreation)
              // Don't auto-start in test environment
              const isTestEnvironment = typeof globalThis !== 'undefined' && 'vi' in globalThis
              if (!isTestEnvironment && !self.isStoppedByTheUser) {
                self.root?.setIsPlaying(true)
              }
            }
          } catch (error) {
            console.error('Failed to connect custom node to audio node:', error)
          }
          return
        }

        // Handle audio node to audio node connections (existing logic)
        if (sourceNode && targetNode) {
          try {
            // Check if we're connecting to the destination node
            const targetVisualNode = self.adaptedNodes.find(node => node.id === targetId)
            const isDestinationConnection = targetVisualNode?.nodeType === 'AudioDestinationNode'

            // Check if this is a control connection (to an AudioParam)
            const targetMetadata = targetVisualNode?.metadata
            const targetInputDef = targetMetadata?.inputs.find(
              (input: any) => input.name === targetInput
            )
            const isControlConnection = targetInputDef?.type === 'control'

            if (isControlConnection) {
              // Special handling for trigger inputs
              if (targetInput === 'trigger') {
                // Create a trigger bridge for any node type that has a trigger input
                const triggerBridge = self.audioContext!.createGain()
                triggerBridge.gain.value = 0 // Silent bridge

                // Connect source to the bridge
                sourceNode.connect(triggerBridge)

                // Store the bridge for cleanup and mark it as a trigger bridge
                if (!self.customNodeBridges) {
                  self.customNodeBridges = new Map()
                }
                self.customNodeBridges.set(`${sourceId}-${targetId}-trigger`, triggerBridge)

                // For custom nodes that output trigger signals, we'll handle this in the custom node bridge update
                // This connection establishes the relationship for trigger handling
              } else {
                // Connect to AudioParam
                const targetNodeWithParams = targetNode as unknown as Record<string, AudioParam>
                const audioParam = targetNodeWithParams[targetInput]

                if (audioParam && typeof audioParam.value !== 'undefined') {
                  sourceNode.connect(audioParam)

                  // Get the source node info to determine connection type
                  const sourceVisualNode = self.adaptedNodes.find(node => node.id === sourceId)
                  const sourceNodeType = sourceVisualNode?.nodeType

                  // Smart base value handling based on parameter and source type
                  if (targetInput === 'frequency') {
                    // For frequency parameters, check the source type
                    if (sourceNodeType === 'SliderNode' || sourceNodeType === 'MidiToFreqNode') {
                      // Direct frequency control - these nodes output frequency values
                      audioParam.value = 0
                    }
                  } else {
                    // For other AudioParams (gain, detune, etc.), set base to 0 for direct control
                    audioParam.value = 0
                  }
                } else {
                  console.error(`AudioParam ${targetInput} not found on target node`)
                  return
                }
              }
            } else if (isDestinationConnection && self.globalAnalyzer) {
              // Connect through the analyzer: source -> analyzer -> destination
              sourceNode.connect(self.globalAnalyzer)
              self.globalAnalyzer.connect(targetNode)
            } else {
              // Normal audio connection
              sourceNode.connect(targetNode)
            }

            if (!skipAddingToArray) {
              self.audioConnections.push({
                sourceNodeId: sourceId,
                targetNodeId: targetId,
                sourceOutput,
                targetInput,
              })
            }

            if (isDestinationConnection && !skipAddingToArray && !self.isUpdatingPlayState) {
              // Audio is now playing through the destination, update play state
              // Only set automatically for user-initiated connections (not during reaction-based recreation)
              // Don't auto-start in test environment
              const isTestEnvironment = typeof globalThis !== 'undefined' && 'vi' in globalThis
              if (!isTestEnvironment && !self.isStoppedByTheUser) {
                self.root?.setIsPlaying(true)
              }
            }
          } catch (error) {
            console.error('Failed to connect audio nodes:', error)
          }
        }
      },

      disconnectAudioNodes(sourceId: string, targetId: string) {
        const sourceNode = self.audioNodes.get(sourceId)
        const targetNode = self.audioNodes.get(targetId)
        const sourceCustomNode = self.customNodes.get(sourceId)
        const targetCustomNode = self.customNodes.get(targetId)

        // Handle custom node disconnections
        if (sourceCustomNode && targetCustomNode) {
          try {
            // Disconnect the custom nodes directly
            sourceCustomNode.disconnect()

            const connectionIndex = self.audioConnections.findIndex(
              conn => conn.sourceNodeId === sourceId && conn.targetNodeId === targetId
            )
            if (connectionIndex !== -1) {
              self.audioConnections.splice(connectionIndex, 1)
            }
          } catch (error) {
            console.error('Failed to disconnect custom node from custom node:', error)
          }
          return
        }

        // Handle audio node to custom node disconnections
        if (sourceNode && targetCustomNode) {
          try {
            // Find the connection to determine the target input
            const connection = self.audioConnections.find(
              conn => conn.sourceNodeId === sourceId && conn.targetNodeId === targetId
            )

            if (connection) {
              const targetVisualNode = self.adaptedNodes.find(node => node.id === targetId)
              if (
                targetVisualNode?.nodeType === 'GreaterThanNode' ||
                targetVisualNode?.nodeType === 'EqualsNode'
              ) {
                // Disconnect from logical controller's audio input
                const audioOutput = targetCustomNode.getAudioOutput?.()
                if (audioOutput) {
                  sourceNode.disconnect(audioOutput)
                  // Notify the custom node that audio input is disconnected
                  targetCustomNode.receiveInput?.(connection.targetInput, false)
                }
              }
            }

            const connectionIndex = self.audioConnections.findIndex(
              conn => conn.sourceNodeId === sourceId && conn.targetNodeId === targetId
            )
            if (connectionIndex !== -1) {
              self.audioConnections.splice(connectionIndex, 1)
            }
          } catch (error) {
            console.error('Failed to disconnect audio node from custom node:', error)
          }
          return
        }

        // Handle custom node to audio node disconnections
        if (sourceCustomNode && targetNode) {
          try {
            // Clean up the bridge
            if (self.customNodeBridges) {
              const bridgeKey = `${sourceId}-${targetId}`
              const bridge = self.customNodeBridges.get(bridgeKey)
              if (bridge) {
                if ('stop' in bridge && typeof bridge.stop === 'function') {
                  bridge.stop()
                }
                bridge.disconnect()
                self.customNodeBridges.delete(bridgeKey)
              }
            }

            // Find the connection to determine the target input
            const connection = self.audioConnections.find(
              conn => conn.sourceNodeId === sourceId && conn.targetNodeId === targetId
            )

            if (connection) {
              // Restore the default value for this AudioParam
              const targetVisualNode = self.adaptedNodes.find(node => node.id === targetId)
              const targetMetadata = targetVisualNode?.metadata
              const paramMetadata = targetMetadata?.properties.find(
                prop => prop.name === connection.targetInput && prop.type === 'AudioParam'
              )

              if (paramMetadata && paramMetadata.defaultValue !== null) {
                const targetNodeWithParams = targetNode as unknown as Record<string, AudioParam>
                const audioParam = targetNodeWithParams[connection.targetInput]
                if (audioParam && typeof audioParam.value !== 'undefined') {
                  audioParam.value = paramMetadata.defaultValue
                }
              }
            }

            const connectionIndex = self.audioConnections.findIndex(
              conn => conn.sourceNodeId === sourceId && conn.targetNodeId === targetId
            )
            if (connectionIndex !== -1) {
              self.audioConnections.splice(connectionIndex, 1)
            }
          } catch (error) {
            console.error('Failed to disconnect custom node from audio node:', error)
          }
          return
        }

        // Handle audio node to audio node disconnections (existing logic)
        if (sourceNode && targetNode) {
          try {
            // Check if we're disconnecting from the destination node
            const targetVisualNode = self.adaptedNodes.find(node => node.id === targetId)
            const isDestinationConnection = targetVisualNode?.nodeType === 'AudioDestinationNode'

            // Find the connection to determine the target input
            const connection = self.audioConnections.find(
              conn => conn.sourceNodeId === sourceId && conn.targetNodeId === targetId
            )

            if (connection) {
              // Check if this is a control connection
              const targetMetadata = targetVisualNode?.metadata
              const targetInputDef = targetMetadata?.inputs.find(
                input => input.name === connection.targetInput
              )
              const isControlConnection = targetInputDef?.type === 'control'

              if (isControlConnection) {
                // Disconnect from AudioParam
                const targetNodeWithParams = targetNode as unknown as Record<string, AudioParam>
                const audioParam = targetNodeWithParams[connection.targetInput]

                if (audioParam && typeof audioParam.value !== 'undefined') {
                  sourceNode.disconnect(audioParam)

                  // Restore the default value for this AudioParam
                  const paramMetadata = targetMetadata?.properties.find(
                    prop => prop.name === connection.targetInput && prop.type === 'AudioParam'
                  )
                  if (paramMetadata && paramMetadata.defaultValue !== null) {
                    audioParam.value = paramMetadata.defaultValue
                  }
                } else {
                  console.error(`AudioParam ${connection.targetInput} not found on target node`)
                }
              } else if (isDestinationConnection && self.globalAnalyzer) {
                // Disconnect from analyzer: source -> analyzer -> destination
                sourceNode.disconnect(self.globalAnalyzer)
                // Note: We don't disconnect analyzer from destination as other sources might still be connected
              } else {
                // Normal disconnection
                sourceNode.disconnect(targetNode)
              }
            }

            const connectionIndex = self.audioConnections.findIndex(
              conn => conn.sourceNodeId === sourceId && conn.targetNodeId === targetId
            )
            if (connectionIndex !== -1) {
              self.audioConnections.splice(connectionIndex, 1)
            }

            if (isDestinationConnection) {
              // Check if there are any remaining connections to the destination
              const remainingDestinationConnections = self.audioConnections.filter(conn => {
                const connTargetNode = self.adaptedNodes.find(node => node.id === conn.targetNodeId)
                return connTargetNode?.nodeType === 'AudioDestinationNode'
              })

              if (remainingDestinationConnections.length === 0) {
                this.setUpdatingPlayState(true)
                self.root?.setIsPlaying(false)
                this.setUpdatingPlayState(false)

                // Disconnect analyzer from destination when no more sources
                if (self.globalAnalyzer) {
                  try {
                    self.globalAnalyzer.disconnect(targetNode)
                  } catch (error) {
                    console.warn('Error disconnecting analyzer from destination:', error)
                  }
                }
              }
            }
          } catch (error) {
            console.error('Failed to disconnect audio nodes:', error)
          }
        }
      },
    }
  })
  .actions(self => {
    return {
      updateCustomNodeBridges(nodeId: string, outputName: string, value: number) {
        if (!self.customNodeBridges) return

        // Update any bridges connected to this custom node's output
        self.customNodeBridges.forEach((bridge, bridgeKey) => {
          // Check if this bridge starts with the source node ID
          if (bridgeKey.startsWith(`${nodeId}-`)) {
            // Handle trigger connections specially
            if (bridgeKey.includes('-trigger')) {
              // For trigger bridges, extract target ID from bridge key: sourceId-targetId-trigger
              const parts = bridgeKey.split('-')
              if (parts.length >= 3 && parts[parts.length - 1] === 'trigger') {
                // Find the connection for this trigger bridge
                const connection = self.audioConnections.find(
                  conn =>
                    conn.sourceNodeId === nodeId &&
                    conn.sourceOutput === outputName &&
                    conn.targetInput === 'trigger'
                )

                if (connection && value > 0) {
                  const targetId = connection.targetNodeId
                  const targetAudioNode = self.audioNodes.get(targetId)
                  const targetCustomNode = self.customNodes.get(targetId)
                  const targetVisualNode = self.adaptedNodes.find(node => node.id === targetId)

                  if (
                    targetAudioNode &&
                    targetVisualNode?.nodeType === 'OscillatorNode' &&
                    self.audioNodeFactory
                  ) {
                    // Recreate and start the oscillator (since oscillators can only be started once)
                    self.recreateAndStartOscillator(targetId)
                  } else if (targetCustomNode && targetCustomNode.receiveInput) {
                    // For other custom nodes (SoundFileNode, etc.), send trigger signal directly
                    targetCustomNode.receiveInput('trigger', value)
                  }
                }
              }
            } else {
              // Handle regular control connections
              const connection = self.audioConnections.find(
                conn =>
                  conn.sourceNodeId === nodeId &&
                  bridgeKey === `${conn.sourceNodeId}-${conn.targetNodeId}` &&
                  conn.sourceOutput === outputName
              )

              if (connection && 'offset' in bridge && bridge.offset) {
                bridge.offset.value = value

                // Also update the target node's property in the store for UI display
                const targetAdaptedNode = self.adaptedNodes.find(
                  node => node.id === connection.targetNodeId
                )
                if (targetAdaptedNode && connection.targetInput) {
                  // Update the property so the UI reflects the new value
                  targetAdaptedNode.properties.set(connection.targetInput, value)
                  // Trigger a re-render
                  self.root?.incrementPropertyChangeCounter()
                }
              }
            }
          }
        })
      },

      selectNode(nodeId: string | undefined) {
        self.history.withoutUndo(() => {
          self.root.selectNode(nodeId)
        })
      },

      updateNodePosition(nodeId: string, position: { x: number; y: number }) {
        const visualNode = self.adaptedNodes.find(n => n.id === nodeId)
        const adaptedNode = self.adaptedNodes.find(n => n.id === nodeId)

        if (visualNode) {
          visualNode.position.x = position.x
          visualNode.position.y = position.y

          // Mark project as modified
          self.root?.markProjectModified()
        } else if (adaptedNode) {
          adaptedNode.position.x = position.x
          adaptedNode.position.y = position.y

          // Mark project as modified
          self.root?.markProjectModified()
        }
      },
    }
  })
  .actions(self => {
    return {
      togglePlayback: flow(function* (): Generator<Promise<unknown>, void, unknown> {
        self.setUpdatingPlayState(true)

        try {
          if (self.root.isPlaying) {
            // STOP: Close the audio context
            self.setIsStoppedByTheUser(true)

            if (self.audioContext) {
              try {
                yield self.audioContext.close()
              } catch (error) {
                console.error('Error closing audio context:', error)
              }
            }

            // Clear audio nodes but keep custom nodes so we can update them
            self.audioContext = null
            self.audioNodeFactory = null
            self.customNodeFactory = null
            self.globalAnalyzer = null
            self.audioNodes.clear()
            // Don't clear customNodes - we'll update them with fresh context
            // Update isPlaying state in root store
            try {
              self.root.setIsPlaying(false)
            } catch (error) {
              console.warn('Failed to update isPlaying state when stopping:', error)
            }
          } else {
            self.setIsStoppedByTheUser(false)
            // START: Create fresh audio context and rebuild everything

            // If we have an existing context, close it first
            if (self.audioContext) {
              try {
                yield self.audioContext.close()
              } catch (error) {
                console.error('Error closing existing audio context:', error)
              }
            }

            // Create brand new audio context
            self.initializeAudioContext()

            if (!self.audioContext) {
              console.error('Failed to create audio context')
              return
            }

            // Audio nodes will be recreated automatically when audio context changes
            // Update existing custom nodes with new audio context
            self.customNodes.forEach(customNode => {
              if (
                'updateAudioContext' in customNode &&
                typeof customNode.updateAudioContext === 'function'
              ) {
                ;(customNode as any).updateAudioContext(self.audioContext)
              }
            })

            // Update isPlaying state in root store
            try {
              self.root.setIsPlaying(true)
            } catch (error) {
              console.warn('Failed to update isPlaying state when starting:', error)
            }

            // Explicitly start all source nodes after setting isPlaying = true
            self.audioNodes.forEach((audioNode, nodeId) => {
              const visualNode = self.adaptedNodes.find(node => node.id === nodeId)
              const nodeType = visualNode?.nodeType

              if (nodeType === 'OscillatorNode' || nodeType === 'AudioBufferSourceNode') {
                // Type guard to ensure we have a source node with start method
                if (audioNode && typeof audioNode === 'object' && 'start' in audioNode) {
                  try {
                    ;(audioNode as any).start()
                  } catch (error) {
                    // Node might already be started, ignore
                    console.warn(`Source node ${nodeId} already started or failed to start:`, error)
                  }
                }
              }
            })
          }
        } finally {
          self.setUpdatingPlayState(false)
        }
      }),

      startRecording() {
        try {
          if (!self.audioContext) {
            throw new Error('Audio context not available')
          }

          // Check if there are any connections to the destination
          const destinationConnections = self.audioConnections.filter(conn => {
            const targetNode = self.adaptedNodes.find(node => node.id === conn.targetNodeId)
            return targetNode?.nodeType === 'AudioDestinationNode'
          })

          if (destinationConnections.length === 0) {
            throw new Error(
              'No audio connections to destination node. Connect some audio sources first.'
            )
          }

          // Create ScriptProcessorNode for WAV recording (deprecated but still works)
          // Use a buffer size of 4096 samples
          const bufferSize = 4096
          self.recordingProcessor = self.audioContext.createScriptProcessor(bufferSize, 2, 2)

          // Initialize recording buffers
          self.recordingBuffers = [[], []] // Left and right channels

          // Set up audio processing
          self.recordingProcessor.onaudioprocess = event => {
            if (!self.isRecording) return

            const inputBuffer = event.inputBuffer
            const leftChannel = inputBuffer.getChannelData(0)
            const rightChannel =
              inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : leftChannel

            // Copy audio data to recording buffers
            self.recordingBuffers[0].push(new Float32Array(leftChannel))
            self.recordingBuffers[1].push(new Float32Array(rightChannel))
          }

          // Connect all sources that were going to destination to also go to recording processor
          destinationConnections.forEach(conn => {
            const sourceId = conn.sourceNodeId
            const sourceNode = self.audioNodes.get(sourceId)
            const sourceCustomNode = self.customNodes.get(sourceId)

            if (sourceNode) {
              sourceNode.connect(self.recordingProcessor!)
            } else if (sourceCustomNode && sourceCustomNode.getAudioOutput) {
              const audioOutput = sourceCustomNode.getAudioOutput()
              if (audioOutput) {
                audioOutput.connect(self.recordingProcessor!)
              }
            }
          })

          // Connect processor to destination to avoid issues with some browsers
          self.recordingProcessor.connect(self.audioContext.destination)

          // Start recording
          self.isRecording = true
          self.recordingStartTime = Date.now()

          // Recording started successfully
        } catch (error) {
          console.error('Error starting recording:', error)
          throw error
        }
      },

      stopRecording() {
        try {
          if (!self.recordingProcessor || !self.isRecording) {
            return null
          }

          // Calculate duration before clearing recordingStartTime
          const duration = self.recordingStartTime
            ? (Date.now() - self.recordingStartTime) / 1000
            : 0

          // Stop recording
          self.isRecording = false

          // Flatten the recorded buffers
          const leftBuffers = self.recordingBuffers[0]
          const rightBuffers = self.recordingBuffers[1]

          if (leftBuffers.length === 0) {
            throw new Error('No audio data recorded')
          }

          // Calculate total length
          const totalLength = leftBuffers.reduce((sum, buffer) => sum + buffer.length, 0)

          // Create final arrays
          const leftChannel = new Float32Array(totalLength)
          const rightChannel = new Float32Array(totalLength)

          let offset = 0
          for (let i = 0; i < leftBuffers.length; i++) {
            leftChannel.set(leftBuffers[i], offset)
            rightChannel.set(rightBuffers[i], offset)
            offset += leftBuffers[i].length
          }

          // Encode to WAV format
          const sampleRate = self.audioContext?.sampleRate || 44100
          const recordingBlob = encodeWAV(leftChannel, rightChannel, sampleRate)

          // Clean up state within the action context
          self.recordingStartTime = null
          self.recordingBuffers = [[], []]

          // Disconnect recording processor
          if (self.recordingProcessor) {
            self.recordingProcessor.disconnect()
            self.recordingProcessor = null
          }

          return { blob: recordingBlob, duration }
        } catch (error) {
          console.error('Error stopping recording:', error)
          // Clean up on error (within action context)
          self.isRecording = false
          self.recordingStartTime = null
          self.recordingBuffers = [[], []]
          if (self.recordingProcessor) {
            self.recordingProcessor.disconnect()
            self.recordingProcessor = null
          }
          throw error
        }
      },

      addMicrophoneInput: flow(function* (position: { x: number; y: number }) {
        try {
          // Check if getUserMedia is available
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia is not supported in this browser')
          }

          // Request microphone access
          const stream = yield navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              autoGainControl: false,
              noiseSuppression: false,
            },
          })

          if (!self.audioContext) {
            self.initializeAudioContext()
          }

          if (!self.audioContext) {
            throw new Error('Failed to initialize audio context')
          }

          // Ensure audio context is running
          if (self.audioContext.state === 'suspended') {
            yield self.audioContext.resume()
          }

          // Create MediaStreamAudioSourceNode
          const micSource = self.audioContext.createMediaStreamSource(stream)

          // Generate unique node ID with counter
          self.nodeIdCounter += 1
          const nodeId = `MicrophoneInput-${Date.now()}-${self.nodeIdCounter}`

          // Get metadata for MediaStreamAudioSourceNode
          const metadata = self.webAudioMetadata['MediaStreamAudioSourceNode']
          if (!metadata) {
            throw new Error('MediaStreamAudioSourceNode metadata not found')
          }

          // Create properties from metadata (same as addNode method)
          const propertiesObj: Record<string, unknown> = {}
          metadata.properties.forEach(prop => {
            propertiesObj[prop.name] = prop.defaultValue
          })

          // Create the visual node with MST-compatible structure (flat, not nested)
          const visualNode = {
            id: nodeId,
            nodeType: 'MediaStreamAudioSourceNode',
            position: {
              x: position.x,
              y: position.y,
            },
            metadata: {
              name: 'Microphone Input',
              description: 'Live microphone input',
              category: metadata.category,
              inputs: metadata.inputs,
              outputs: metadata.outputs,
              properties: metadata.properties,
              methods: metadata.methods,
              events: metadata.events,
            },
            properties: propertiesObj,
            type: 'audioNode',
            selected: false,
            dragging: false,
            inputConnections: [],
            outputConnections: [],
            audioNodeCreated: false,
          }

          // Add to store using MST action
          self.adaptedNodes.push(visualNode)

          // Store the actual audio node
          self.audioNodes.set(nodeId, micSource)

          // Store the media stream
          self.mediaStreams.set(nodeId, stream)

          // Increment graph change counter to force React re-render
          self.root?.forceRerender()

          return nodeId
        } catch (error) {
          console.error('Error adding microphone input:', error)
          throw error
        }
      }),

      // Copy selected nodes to clipboard
      copySelectedNodes: flow(function* (selectedNodeIds: string[]) {
        // Clear any previous clipboard errors
        self.clipboardError = null

        // Get the selected nodes
        const nodesToCopy = self.adaptedNodes.filter(node => selectedNodeIds.includes(node.id))

        if (nodesToCopy.length === 0) {
          return
        }

        // Get edges between selected nodes
        const edgesToCopy = self.visualEdges.filter(
          edge => selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)
        )

        // Create deep copies of nodes and edges for clipboard
        const clipboardData = {
          nodes: nodesToCopy.map(node => ({
            id: node.id,
            type: node.type,
            position: { ...node.position },
            data: {
              nodeType: node.nodeType,
              metadata: JSON.parse(JSON.stringify(node.metadata)), // Deep copy metadata
              properties: Object.fromEntries(node.properties.entries()),
            },
          })),
          edges: edgesToCopy.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          })),
        }

        // Store in internal clipboard (already deep copied)
        self.clipboardNodes = clipboardData.nodes
        self.clipboardEdges = clipboardData.edges

        // Also store in browser clipboard for cross-tab functionality
        const clipboardText = JSON.stringify({
          type: 'visualwebaudio-nodes',
          version: '1.0',
          data: clipboardData,
        })

        // Try to write to system clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            yield navigator.clipboard.writeText(clipboardText)
            self.clipboardPermissionState = 'granted'
            self.clipboardError = null
          } catch (error) {
            console.warn('Failed to write to system clipboard:', error)
            self.clipboardPermissionState = 'denied'
            self.clipboardError =
              'Clipboard access denied. Copy/paste will work within this tab only.'
          }
        } else {
          self.clipboardPermissionState = 'denied'
          self.clipboardError =
            'Clipboard API not supported. Copy/paste will work within this tab only.'
        }
      }),

      // Cut selected nodes (copy + delete)
      cutSelectedNodes(selectedNodeIds: string[]) {
        // Get the selected nodes for copying
        const nodesToCopy = self.adaptedNodes.filter(node => selectedNodeIds.includes(node.id))

        if (nodesToCopy.length === 0) {
          return
        }

        // Get edges between selected nodes
        const edgesToCopy = self.visualEdges.filter(
          edge => selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)
        )

        // Create deep copies of nodes and edges for clipboard
        const clipboardData = {
          nodes: nodesToCopy.map(node => ({
            id: node.id,
            type: node.type,
            position: { ...node.position },
            data: {
              nodeType: node.nodeType,
              metadata: JSON.parse(JSON.stringify(node.metadata)), // Deep copy metadata
              properties: Object.fromEntries(node.properties.entries()),
            },
          })),
          edges: edgesToCopy.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          })),
        }

        // Store in internal clipboard (already deep copied)
        self.clipboardNodes = clipboardData.nodes
        self.clipboardEdges = clipboardData.edges

        // Try to write to system clipboard (async, but don't wait)
        const clipboardText = JSON.stringify({
          type: 'visualwebaudio-nodes',
          version: '1.0',
          data: clipboardData,
        })

        if (navigator.clipboard && navigator.clipboard.writeText) {
          const store = self as any
          navigator.clipboard
            .writeText(clipboardText)
            .then(() => {
              store.setClipboardPermissionState('granted', null)
            })
            .catch(error => {
              console.warn('Failed to write to system clipboard:', error)
              store.setClipboardPermissionState(
                'denied',
                'Clipboard access denied. Copy/paste will work within this tab only.'
              )
            })
        } else {
          self.clipboardPermissionState = 'denied'
          self.clipboardError =
            'Clipboard API not supported. Copy/paste will work within this tab only.'
        }

        // Delete the nodes
        selectedNodeIds.forEach(nodeId => {
          const nodeIndex = self.adaptedNodes.findIndex(node => node.id === nodeId)
          if (nodeIndex !== -1) {
            // Remove the node using the existing removeNode logic
            const visualNode = self.adaptedNodes[nodeIndex]
            const nodeType = visualNode.nodeType

            // Clean up audio/custom nodes
            const customNode = self.customNodes.get(nodeId)
            if (customNode) {
              try {
                customNode.cleanup()
                self.customNodes.delete(nodeId)
              } catch (error) {
                console.error('Error during custom node cleanup:', error)
              }
            }

            const audioNode = self.audioNodes.get(nodeId)
            if (audioNode) {
              try {
                audioNode.disconnect()
                if ('stop' in audioNode && typeof audioNode.stop === 'function') {
                  try {
                    ;(audioNode as OscillatorNode | AudioBufferSourceNode).stop()
                  } catch (stopError) {
                    console.error('Source node already stopped or stopping failed:', stopError)
                  }
                }
              } catch (error) {
                console.error('Error during audio node cleanup:', error)
              }
              self.audioNodes.delete(nodeId)
            }

            // Remove connected edges
            const edgesToRemove = self.visualEdges.filter(
              edge => edge.source === nodeId || edge.target === nodeId
            )
            edgesToRemove.forEach(edge => {
              const edgeIndex = self.visualEdges.findIndex(e => e.id === edge.id)
              if (edgeIndex !== -1) {
                self.visualEdges.splice(edgeIndex, 1)
              }
            })

            // Remove audio connections
            const connectionsToRemove = self.audioConnections.filter(
              conn => conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId
            )
            connectionsToRemove.forEach(conn => {
              const connIndex = self.audioConnections.findIndex(
                c =>
                  c.sourceNodeId === conn.sourceNodeId &&
                  c.targetNodeId === conn.targetNodeId &&
                  c.sourceOutput === conn.sourceOutput &&
                  c.targetInput === conn.targetInput
              )
              if (connIndex !== -1) {
                self.audioConnections.splice(connIndex, 1)
              }
            })

            // Remove the visual node
            self.adaptedNodes.splice(nodeIndex, 1)

            // Clean up media stream if this is a microphone node
            if (nodeType === 'MediaStreamAudioSourceNode') {
              const mediaStream = self.mediaStreams.get(nodeId)
              if (mediaStream) {
                mediaStream.getTracks().forEach(track => {
                  track.stop()
                })
                self.mediaStreams.delete(nodeId)
              }
            }
          }
        })
      },

      // Paste nodes from clipboard
      pasteNodes: flow(function* (pastePosition?: { x: number; y: number }) {
        // Clear any previous clipboard errors
        self.clipboardError = null

        let clipboardData = null

        // First try to get data from system clipboard
        if (navigator.clipboard && navigator.clipboard.readText) {
          try {
            const clipboardText = yield navigator.clipboard.readText()
            const parsed = JSON.parse(clipboardText)

            if (parsed.type === 'visualwebaudio-nodes' && parsed.data) {
              clipboardData = parsed.data
              self.clipboardPermissionState = 'granted'
            }
          } catch (error) {
            if (error instanceof Error && error.name === 'NotAllowedError') {
              self.clipboardPermissionState = 'denied'
              self.clipboardError = 'Clipboard access denied. Using internal clipboard only.'
            } else {
              // Could be a JSON parse error or other issue, not necessarily a permission error
            }
          }
        } else {
          self.clipboardPermissionState = 'denied'
          self.clipboardError = 'Clipboard API not supported. Using internal clipboard only.'
        }

        // Fall back to internal clipboard if system clipboard doesn't have our data
        if (!clipboardData && self.clipboardNodes.length > 0) {
          clipboardData = {
            nodes: self.clipboardNodes.map(node => ({
              ...node,
              // Ensure data structure is consistent - the internal clipboard already has the correct structure
            })),
            edges: self.clipboardEdges.map(edge => ({ ...edge })),
          }
        }

        if (!clipboardData || clipboardData.nodes.length === 0) {
          if (!self.clipboardError) {
            self.clipboardError = 'No nodes in clipboard to paste'
          }
          return []
        }

        // Calculate offset for pasting
        const offset = pastePosition ? { x: 50, y: 50 } : { x: 50, y: 50 }

        // Create mapping from old IDs to new IDs
        const idMapping = new Map<string, string>()
        const newNodeIds: string[] = []

        // Create new nodes with new IDs
        clipboardData.nodes.forEach((clipboardNode: any) => {
          // Extract nodeType, metadata, and properties from the correct location
          const nodeType = clipboardNode.data?.nodeType || clipboardNode.nodeType
          const metadata = clipboardNode.data?.metadata || clipboardNode.metadata
          const properties = clipboardNode.data?.properties || clipboardNode.properties

          // Generate new unique ID
          self.nodeIdCounter += 1
          const newNodeId = `${nodeType}-${Date.now()}-${self.nodeIdCounter}`
          idMapping.set(clipboardNode.id, newNodeId)
          newNodeIds.push(newNodeId)

          // Calculate new position
          const newPosition = {
            x: clipboardNode.position.x + offset.x,
            y: clipboardNode.position.y + offset.y,
          }

          // Create the visual node with MST-compatible structure (flat, not nested)
          const visualNode = {
            id: newNodeId,
            nodeType: nodeType,
            position: newPosition,
            metadata: { ...metadata },
            properties: { ...properties },
            type: clipboardNode.type,
            selected: false,
            dragging: false,
            inputConnections: [],
            outputConnections: [],
            audioNodeCreated: false,
          }

          // Add the visual node to the store
          // The audio node will be created automatically by the afterAttach lifecycle hook
          self.adaptedNodes.push(visualNode)
        })

        // Create new edges with updated IDs
        clipboardData.edges.forEach((clipboardEdge: any) => {
          const newSourceId = idMapping.get(clipboardEdge.source)
          const newTargetId = idMapping.get(clipboardEdge.target)

          if (newSourceId && newTargetId) {
            // Generate new edge ID
            const newEdgeId = `${newSourceId}-${newTargetId}-${clipboardEdge.sourceHandle || 'output'}-${clipboardEdge.targetHandle || 'input'}`

            // Create the visual edge
            const visualEdge = {
              id: newEdgeId,
              source: newSourceId,
              target: newTargetId,
              sourceHandle: clipboardEdge.sourceHandle,
              targetHandle: clipboardEdge.targetHandle,
            }

            self.visualEdges.push(visualEdge)

            // Create the audio connection
            try {
              self.connectAudioNodes(
                newSourceId,
                newTargetId,
                clipboardEdge.sourceHandle || 'output',
                clipboardEdge.targetHandle || 'input'
              )
            } catch (error) {
              console.error('Error creating audio connection during paste:', error)
            }
          }
        })
        // Don't clear clipboard state after paste - users expect to be able to paste multiple times
        // Only clear clipboard error since paste was successful
        self.clipboardError = null

        return newNodeIds
      }),

      createAudioNode(nodeId: string, nodeType: string) {
        if (!self.audioContext) {
          self.initializeAudioContext()
        }

        if (!self.audioContext || !self.audioNodeFactory || !self.customNodeFactory) {
          console.error('Failed to initialize audio context or factories')
          return
        }

        // Get the visual node or adapted node to extract properties and metadata
        const visualNode = self.adaptedNodes.find(node => node.id === nodeId)
        const adaptedNode = self.adaptedNodes.find(node => node.id === nodeId)

        // Use metadata from the node if available (for loaded projects),
        // otherwise fall back to global metadata (for new nodes)
        let metadata: INodeMetadata
        let properties: Record<string, any> = {}

        if (visualNode && visualNode.metadata) {
          metadata = visualNode.metadata as unknown as INodeMetadata
          properties = Object.fromEntries(visualNode.properties.entries())
        } else if (adaptedNode) {
          metadata = adaptedNode.metadata as unknown as INodeMetadata
          properties = Object.fromEntries(adaptedNode.properties.entries())
        } else {
          // Fall back to global metadata for both WebAudio and custom nodes
          const allMetadata = getAllNodesMetadata()
          metadata = allMetadata[nodeType]
        }

        if (!metadata) {
          console.error(`No metadata found for node type: ${nodeType}`)
          return
        }

        // Check if it's a custom node type
        if (self.customNodeFactory.isCustomNodeType(nodeType)) {
          try {
            const customNode = self.customNodeFactory.createNode(nodeId, nodeType, metadata)

            // Set up callback for output changes to update bridges
            if (
              'setOutputChangeCallback' in customNode &&
              typeof customNode.setOutputChangeCallback === 'function'
            ) {
              customNode.setOutputChangeCallback(
                (nodeId: string, outputName: string, value: number) => {
                  self.updateCustomNodeBridges(nodeId, outputName, value)
                }
              )
            }

            // Set up callback for DisplayNode to update visual properties
            if (
              nodeType === 'DisplayNode' &&
              'setPropertyChangeCallback' in customNode &&
              typeof (customNode as any).setPropertyChangeCallback === 'function'
            ) {
              ;(customNode as any).setPropertyChangeCallback(
                (nodeId: string, propertyName: string, value: any) => {
                  // Update the visual node property so it shows up in the properties panel
                  const targetVisualNode = self.adaptedNodes.find(node => node.id === nodeId)
                  const targetAdaptedNode = self.adaptedNodes.find(node => node.id === nodeId)
                  if (targetVisualNode) {
                    targetVisualNode.properties.set(propertyName, value)
                    self.root.incrementPropertyChangeCounter()
                  } else if (targetAdaptedNode) {
                    targetAdaptedNode.updateProperty(propertyName, value)
                    self.root.incrementPropertyChangeCounter()
                  }
                }
              )
            }

            self.customNodes.set(nodeId, customNode)

            // Apply properties to the MobX node that was already created by the factory
            const mobxNode = customNodeStore.getNode(nodeId)
            if (mobxNode && Object.keys(properties).length > 0) {
              // Use MST action to safely modify the node properties
              try {
                Object.entries(properties).forEach(([key, value]) => {
                  mobxNode.setProperty(key, value)
                  // Also set outputs for properties that correspond to outputs
                  const hasCorrespondingOutput = metadata.outputs?.some(
                    (output: any) => output.name === key
                  )
                  if (hasCorrespondingOutput) {
                    mobxNode.setOutput(key, value)
                  }
                  // Handle special case for 'value' property (most common output)
                  if (key === 'value') {
                    mobxNode.setOutput('value', value)
                  }
                })
              } catch (error) {
                console.error(`Error applying properties to MobX node ${nodeId}:`, error)
              }
            }
          } catch (error) {
            console.error('STORE: Error creating custom node:', error)
          }
          return
        }

        // Special handling for MediaStreamAudioSourceNode
        if (nodeType === 'MediaStreamAudioSourceNode') {
          const mediaStream = self.mediaStreams.get(nodeId)
          if (mediaStream) {
            try {
              const micSource = self.audioContext.createMediaStreamSource(mediaStream)
              self.audioNodes.set(nodeId, micSource)
              return
            } catch (error) {
              console.error('Error recreating MediaStreamAudioSourceNode:', error)
              return
            }
          } else {
            console.error(`No media stream found for microphone node: ${nodeId}`)
            return
          }
        }

        // Handle regular Web Audio API nodes
        try {
          const audioNode = self.audioNodeFactory.createAudioNode(nodeType, metadata, properties)
          self.audioNodes.set(nodeId, audioNode)

          // Auto-start source nodes if they have autostart enabled (regardless of global play state)
          if (nodeType === 'OscillatorNode' || nodeType === 'AudioBufferSourceNode') {
            // Check autostart property (default is true for both types)
            const shouldAutostart = properties.autostart !== false

            if (shouldAutostart && 'start' in audioNode && typeof audioNode.start === 'function') {
              try {
                ;(audioNode as OscillatorNode | AudioBufferSourceNode).start()
                self.setNodeState(nodeId, { isRunning: true })
              } catch (error) {
                // Node might already be started, ignore
                console.warn(`Source node ${nodeId} already started or failed to start:`, error)
              }
            }
          }
        } catch (error) {
          console.error('STORE: Error creating audio node:', error)
        }
      },

      // Deduplicate connections to prevent audio corruption from corrupted project files
      deduplicateConnections() {
        // Deduplicate audioConnections array
        const seen = new Set<string>()
        const deduplicatedConnections = self.audioConnections.filter(conn => {
          const key = `${conn.sourceNodeId}-${conn.targetNodeId}-${conn.sourceOutput}-${conn.targetInput}`
          if (seen.has(key)) {
            return false
          }
          seen.add(key)
          return true
        })

        // Replace the array with deduplicated version
        if (deduplicatedConnections.length !== self.audioConnections.length) {
          self.audioConnections.replace(deduplicatedConnections)
        }

        // Deduplicate custom node input connections
        try {
          // Try to get customNodeStore from environment, fallback to imported store
          let customNodeStoreInstance
          try {
            customNodeStoreInstance = getEnv(self).customNodeStore
          } catch {
            // In test environment, use the imported customNodeStore
            customNodeStoreInstance = customNodeStore
          }

          // If no environment store, use the imported one
          if (!customNodeStoreInstance) {
            customNodeStoreInstance = customNodeStore
          }

          if (customNodeStoreInstance) {
            customNodeStoreInstance.nodes.forEach((node: any) => {
              if (node.inputConnections && node.inputConnections.length > 1) {
                const seenInputs = new Set<string>()
                const deduplicatedInputs: {
                  sourceNodeId: string
                  sourceOutput: string
                  targetInput: string
                }[] = []

                // Extract connection data BEFORE clearing (to avoid MST tree access issues)
                const connectionData = node.inputConnections.map((conn: any) => ({
                  sourceNodeId: conn.sourceNodeId,
                  sourceOutput: conn.sourceOutput,
                  targetInput: conn.targetInput,
                }))

                connectionData.forEach(
                  (conn: { sourceNodeId: string; sourceOutput: string; targetInput: string }) => {
                    const key = `${conn.sourceNodeId}-${conn.sourceOutput}-${conn.targetInput}`
                    if (!seenInputs.has(key)) {
                      seenInputs.add(key)
                      deduplicatedInputs.push(conn)
                    }
                  }
                )

                if (deduplicatedInputs.length !== node.inputConnections.length) {
                  // Clear all connections first (this disposes reactions properly)
                  node.clearInputConnections()

                  // Re-add the deduplicated connections
                  deduplicatedInputs.forEach(
                    (conn: { sourceNodeId: string; sourceOutput: string; targetInput: string }) => {
                      node.addInputConnection(
                        conn.sourceNodeId,
                        conn.sourceOutput,
                        conn.targetInput
                      )
                    }
                  )
                }
              }
            })
          }
        } catch (error) {
          console.error('[AudioGraphStore] Error deduplicating custom node connections:', error)
        }
      },

      // Initialize the store - sets up reactions for automatic audio node creation
      init() {
        // Load metadata first
        self.loadMetadata()

        // Clean up any existing volatile audio state before initialization
        // This ensures clean state when loading projects via applySnapshot
        // Only clear volatile/transient state, not MST model arrays
        self.audioNodes.clear()
        self.customNodes.clear()
        self.customNodeBridges?.clear()
        self.mediaStreams.clear()
        // Note: Don't clear audioConnections as it's part of MST model

        // Deduplicate connections to prevent audio corruption from corrupted project files
        this.deduplicateConnections()

        // Clean up any existing reaction first
        if (self.audioNodeCreationReactionDisposer) {
          self.audioNodeCreationReactionDisposer()
          self.audioNodeCreationReactionDisposer = null
        }

        // Set up a reaction that watches for visual nodes and creates audio nodes when needed
        self.audioNodeCreationReactionDisposer = reaction(
          // Observable: watch the visual nodes array and audio context changes
          () => {
            // Include audioContext in the observable to trigger when it changes
            const audioContextExists = !!self.audioContext
            return {
              audioContextExists,
              nodes: self.adaptedNodes.map(node => ({
                id: node.id,
                nodeType: node.nodeType,
                hasAudioNode: self.audioNodes.has(node.id) || self.customNodes.has(node.id),
                isAttached: node.isAttached,
              })),
            }
          },
          // Effect: create audio nodes for nodes that don't have them yet
          observableData => {
            // Track which nodes are created in this reaction cycle
            const newlyCreatedNodes: string[] = []

            // Only create audio nodes for nodes that don't have them yet
            observableData.nodes.forEach(nodeState => {
              if (!nodeState.hasAudioNode && nodeState.isAttached) {
                try {
                  this.createAudioNode(nodeState.id, nodeState.nodeType)
                  newlyCreatedNodes.push(nodeState.id)

                  // Mark the visual node as having an audio node created
                  const visualNode = self.adaptedNodes.find(node => node.id === nodeState.id)
                  if (visualNode) {
                    visualNode.audioNodeCreated = true
                  }
                } catch (error) {
                  console.error(
                    `[AudioGraphStore reaction] Error creating audio node for ${nodeState.id}:`,
                    error
                  )
                }
              }
            })

            // Only recreate connections for newly created nodes
            // This prevents unnecessary audio disruption when adding unconnected nodes
            if (observableData.audioContextExists && newlyCreatedNodes.length > 0) {
              self.audioConnections.forEach(connection => {
                try {
                  // Only recreate connection if it involves a newly created node
                  const involvesNewNode =
                    newlyCreatedNodes.includes(connection.sourceNodeId) ||
                    newlyCreatedNodes.includes(connection.targetNodeId)

                  if (involvesNewNode) {
                    // Check that both nodes have audio nodes before connecting
                    const sourceHasAudioNode =
                      self.audioNodes.has(connection.sourceNodeId) ||
                      self.customNodes.has(connection.sourceNodeId)
                    const targetHasAudioNode =
                      self.audioNodes.has(connection.targetNodeId) ||
                      self.customNodes.has(connection.targetNodeId)

                    if (sourceHasAudioNode && targetHasAudioNode) {
                      self.connectAudioNodes(
                        connection.sourceNodeId,
                        connection.targetNodeId,
                        connection.sourceOutput,
                        connection.targetInput,
                        true // Skip adding to array since connections already exist in the array
                      )
                    }
                  }
                } catch (error) {
                  console.error(`Error recreating audio connection:`, error, connection)
                }
              })
            }
          },
          {
            name: 'AudioNodeCreationReaction',
            fireImmediately: true,
          }
        )
      },

      // Set up automatic audio node creation reaction
      afterCreate() {
        this.init()
      },

      // Clean up the reaction when the store is destroyed
      beforeDestroy() {
        if (self.audioNodeCreationReactionDisposer) {
          self.audioNodeCreationReactionDisposer()
          self.audioNodeCreationReactionDisposer = null
        }
      },

      // Migration helper for backward compatibility
      migrateSnapshot(snapshot: any): any {
        if (!snapshot.adaptedNodes) return snapshot

        const migratedSnapshot = { ...snapshot }

        // Migrate nodes from old format (data.nodeType, data.metadata) to new format (nodeType, metadata)
        migratedSnapshot.adaptedNodes = snapshot.adaptedNodes.map((node: any) => {
          if (node.data && node.data.nodeType && node.data.metadata) {
            // Old format - migrate to new format
            return {
              id: node.id,
              nodeType: node.data.nodeType,
              position: node.position,
              metadata: node.data.metadata,
              properties: node.data.properties || {},
              type: node.type || 'audioNode',
              selected: node.selected || false,
              dragging: node.dragging || false,
              inputConnections: node.inputConnections || [],
              outputConnections: node.outputConnections || [],
            }
          }
          // New format - return as is
          return node
        })

        return migratedSnapshot
      },
    }
  })
  .views(self => ({
    get selectedNode() {
      // Get selectedNodeId from root store
      const selectedNodeId = self.root.selectedNodeId
      if (!selectedNodeId) return undefined

      return self.adaptedNodes.find(node => node.id === selectedNodeId)
    },

    get availableNodeTypes() {
      return Object.keys(self.webAudioMetadata)
    },

    get canUndo() {
      return self.history.canUndo
    },

    get canRedo() {
      return self.history.canRedo
    },

    get frequencyAnalyzer() {
      return self.globalAnalyzer
    },

    get canPaste() {
      // Check if we have nodes in internal clipboard
      // Note: We can't easily check system clipboard synchronously in a view,
      // so we rely on the internal clipboard state
      return self.clipboardNodes.length > 0
    },

    get clipboardPermission() {
      return self.clipboardPermissionState
    },

    get clipboardErrorMessage() {
      return self.clipboardError
    },

    get hasClipboardAccess() {
      return self.clipboardPermissionState === 'granted'
    },

    // Get node runtime state (reactive computed property)
    getNodeState(nodeId: string) {
      // Access the counter to make this reactive
      void self.root.nodeStateChangeCounter
      return self.nodeStates.get(nodeId) || {}
    },
  }))
  .actions(self => {
    return {
      updateNodeProperty(nodeId: string, propertyName: string, value: unknown) {
        const adaptedNode = self.adaptedNodes.find(node => node.id === nodeId)
        const audioNode = self.audioNodes.get(nodeId)
        // Use the MST-based custom node store instead of legacy map
        const customNode = customNodeStore.getNode(nodeId)

        if (adaptedNode) {
          // Update the adapted node property
          adaptedNode.updateProperty(propertyName, value)

          // Increment the property change counter to trigger React re-renders
          self.root.incrementPropertyChangeCounter()

          // Mark project as modified
          self.root?.markProjectModified()
        }

        // Handle custom node property updates using MST store
        if (customNode && adaptedNode) {
          // Update the custom node's property using MST action
          customNode.setProperty(propertyName, value)

          // Check if this property corresponds to an output and update bridges
          const nodeMetadata = adaptedNode.metadata
          const hasCorrespondingOutput = nodeMetadata.outputs.some(
            (output: any) => output.name === propertyName
          )

          if (hasCorrespondingOutput) {
            // Update the custom node's output using MST action
            customNode.setOutput(propertyName, value)

            // Update any bridges connected to this custom node output
            self.updateCustomNodeBridges(nodeId, propertyName, value as number)
          }

          // Handle special case for 'value' property (most common output)
          if (propertyName === 'value') {
            customNode.setOutput('value', value)
            self.updateCustomNodeBridges(nodeId, 'value', value as number)
          }

          return
        }

        if (audioNode && adaptedNode && self.audioNodeFactory) {
          const nodeType = adaptedNode.nodeType
          const metadata = self.webAudioMetadata[nodeType] as INodeMetadata

          if (metadata) {
            // Special handling for autostart property on source nodes
            if (
              propertyName === 'autostart' &&
              (nodeType === 'OscillatorNode' || nodeType === 'AudioBufferSourceNode')
            ) {
              if (value === false) {
                // Stop the oscillator if autostart is set to false
                try {
                  if ('stop' in audioNode && typeof audioNode.stop === 'function') {
                    ;(audioNode as OscillatorNode | AudioBufferSourceNode).stop()
                    self.setNodeState(nodeId, { isRunning: false })
                  }
                } catch (error) {
                  // Node might already be stopped, ignore
                  console.warn(`Source node ${nodeId} already stopped or failed to stop:`, error)
                }
              }
              return // Don't process further for autostart property
            }

            // Check if this is an AudioParam with an active control connection
            const propertyDef = metadata.properties.find(p => p.name === propertyName)
            if (propertyDef?.type === 'AudioParam') {
              // Check if there's an active control connection to this AudioParam
              const hasControlConnection = self.audioConnections.some(
                conn => conn.targetNodeId === nodeId && conn.targetInput === propertyName
              )

              if (hasControlConnection) {
                return
              }
            }

            // Try to update using the factory
            const success = self.audioNodeFactory.updateNodeProperty(
              audioNode,
              nodeType,
              metadata,
              propertyName,
              value
            )

            if (!success) {
              // Store current connections
              const incomingConnections = self.audioConnections.filter(
                conn => conn.targetNodeId === nodeId
              )
              const outgoingConnections = self.audioConnections.filter(
                conn => conn.sourceNodeId === nodeId
              )

              // Remove and recreate the audio node
              audioNode.disconnect()
              self.audioNodeFactory.stopSourceNode(audioNode, nodeType)
              self.audioNodes.delete(nodeId)

              // Create new audio node
              self.createAudioNode(nodeId, nodeType)

              // Restore connections
              setTimeout(() => {
                incomingConnections.forEach(conn => {
                  self.connectAudioNodes(
                    conn.sourceNodeId,
                    conn.targetNodeId,
                    conn.sourceOutput,
                    conn.targetInput
                  )
                })
                outgoingConnections.forEach(conn => {
                  self.connectAudioNodes(
                    conn.sourceNodeId,
                    conn.targetNodeId,
                    conn.sourceOutput,
                    conn.targetInput
                  )
                })
              }, 10)
            }
          }
        }
      },
    }
  })

export type AudioGraphStoreType = Instance<typeof AudioGraphStore>

// Migration helper for backward compatibility removed (was unused)

// Factory function to create store with UndoManager
export const createAudioGraphStore = () => {
  const store = AudioGraphStore.create({
    history: {},
  })

  // The UndoManager will use getRoot(self) to find the target store automatically
  return store
}

// React Context for the store
export const AudioGraphStoreContext = createContext<AudioGraphStoreType | null>(null)

export interface IAudioGraphStore extends Instance<typeof AudioGraphStore> {}

export const useAudioGraphStore = () => {
  const store = useContext(AudioGraphStoreContext)
  if (!store) {
    throw new Error('useAudioGraphStore must be used within an AudioGraphStoreProvider')
  }
  return store
}
