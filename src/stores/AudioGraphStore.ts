import { types, flow, onPatch, applyPatch, getEnv, destroy } from 'mobx-state-tree'
import type { Instance, IJsonPatch } from 'mobx-state-tree'
import { reaction } from 'mobx'
import { VisualEdgeModel, AudioConnectionModel, INodeMetadata } from './NodeModels'
import { NodeAdapter } from './NodeAdapter'
import { AudioNodeFactory } from '~/services/AudioNodeFactory'
import { CustomNodeFactory, type CustomNode } from '~/services/CustomNodeFactory'
import { customNodeStore } from '~/stores/CustomNodeStore'
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

export const AudioGraphStore = types
  .model('AudioGraphStore', {
    adaptedNodes: types.array(NodeAdapter), // Unified node system
    visualEdges: types.array(VisualEdgeModel),
    audioConnections: types.array(AudioConnectionModel),
    selectedNodeId: types.maybe(types.string),
    isPlaying: types.optional(types.boolean, false),
    // Move undo/redo stacks to main model so they're observable
    undoStack: types.array(types.frozen()),
    redoStack: types.array(types.frozen()),
    // Add a counter to track property changes for React re-renders
    propertyChangeCounter: types.optional(types.number, 0),
    // Add a counter to track graph structure changes for React re-renders
    graphChangeCounter: types.optional(types.number, 0),
    // Track if the current project has been modified (default false for new projects)
    isProjectModified: types.optional(types.boolean, false),
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
    customNodeBridges: null as Map<string, ConstantSourceNode> | null,
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
        this.applyUndo()
      },

      redo() {
        this.applyRedo()
      },

      addToUndoStack(patches: { forward: IJsonPatch[]; inverse: IJsonPatch[] }) {
        self.undoStack.push(patches)
        // Clear redo stack when new action is performed
        self.redoStack.clear()
      },

      moveToRedoStack() {
        if (self.undoStack.length > 0) {
          const patches = self.undoStack.pop()
          if (patches) {
            self.redoStack.push(patches)
            return patches
          }
        }
        return null
      },

      moveToUndoStack() {
        if (self.redoStack.length > 0) {
          const patches = self.redoStack.pop()
          if (patches) {
            self.undoStack.push(patches)
            return patches
          }
        }
        return null
      },

      setApplyingPatch(value: boolean) {
        self.isApplyingPatch = value
      },

      setCreatingExample(value: boolean) {
        self.isCreatingExample = value
      },

      setClearingAllNodes(value: boolean) {
        self.isClearingAllNodes = value
      },

      setUpdatingPlayState(value: boolean) {
        self.isUpdatingPlayState = value
      },

      // Action to set/reset project loading state
      setLoadingProject(value: boolean) {
        self.isLoadingProject = value
      },

      // Action to set/reset stopping state
      setIsStoppedByTheUser(value: boolean) {
        self.isStoppedByTheUser = value
      },

      // Action to set playing state
      setIsPlaying(value: boolean) {
        if (!self.isStoppedByTheUser) {
          self.isPlaying = value
        }
      },

      // Action to set project modified state
      setProjectModified(value: boolean) {
        self.isProjectModified = value
      },

      // Action to mark project as modified (when changes are made)
      markProjectModified() {
        self.isProjectModified = true
      },

      // Action to force React re-render by incrementing graph change counter
      forceRerender() {
        self.graphChangeCounter += 1
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

      applyUndo() {
        const patches = this.moveToRedoStack()
        if (patches) {
          this.setApplyingPatch(true)
          applyPatch(self, patches.inverse)
          this.setApplyingPatch(false)
          // Audio nodes will be created/destroyed automatically by lifecycle hooks
        }
      },

      applyRedo() {
        const patches = this.moveToUndoStack()
        if (patches) {
          this.setApplyingPatch(true)
          applyPatch(self, patches.forward)
          this.setApplyingPatch(false)
          // Audio nodes will be created/destroyed automatically by lifecycle hooks
        }
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
        self.graphChangeCounter += 1

        // Mark project as modified
        this.markProjectModified()

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

        // Remove the adapted node (this will trigger beforeDestroy)
        const nodeIndex = self.adaptedNodes.findIndex(node => node.id === nodeId)
        if (nodeIndex !== -1) {
          // Use MST destroy() to properly trigger lifecycle hooks
          destroy(self.adaptedNodes[nodeIndex])
        }

        // Increment graph change counter to force React re-render
        self.graphChangeCounter += 1

        // Mark project as modified
        this.markProjectModified()
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
                bridge.stop()
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
                metadata,
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
        this.setIsStoppedByTheUser(false)
        this.setIsPlaying(false)
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
        self.undoStack.clear()
        self.redoStack.clear()

        // Reset play state since no audio is playing
        this.setUpdatingPlayState(true)
        self.isPlaying = false
        this.setUpdatingPlayState(false)

        // Increment graph change counter to force React re-render
        // (do this before resetting flag to avoid recording in undo history)
        self.graphChangeCounter += 1

        // Reset flag to allow recording future operations
        this.setClearingAllNodes(false)

        // Reset project modification state since we've cleared everything
        self.isProjectModified = false
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
        if (!this.isValidConnection(source, target, sourceHandle, targetHandle)) {
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

        // Increment graph change counter to force React re-render
        self.graphChangeCounter += 1

        // Mark project as modified
        this.markProjectModified()
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
        const sourceMetadata = sourceVisualNode
          ? sourceVisualNode.metadata
          : sourceAdaptedNode?.metadata
        const targetMetadata = targetVisualNode
          ? targetVisualNode.metadata
          : targetAdaptedNode?.metadata

        const sourceOutput = sourceMetadata?.outputs.find(
          (output: any) => output.name === outputName
        )
        const targetInput = targetMetadata?.inputs.find((input: any) => input.name === inputName)

        if (!sourceOutput || !targetInput) {
          console.warn('Output or input not found:', { outputName, inputName })
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
          this.markProjectModified()
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
                  /*console.log(
                    `Connected custom node audio output to ${targetVisualNode?.nodeType}`
                  )*/
                }
              } else {
                console.error(`Custom node ${sourceId} does not have audio output available`)
                return
              }
            } else if (isControlConnection) {
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
                    /*   console.log(
                      `Connected custom node ${sourceNodeType} to frequency AudioParam: direct control, set base to 0`
                    ) */
                  } else {
                    // Default: keep base value for modulation
                    /* console.log(
                      `Connected custom node ${sourceNodeType} to frequency AudioParam: keeping base value`
                    ) */
                  }
                } else {
                  // For other AudioParams (gain, detune, etc.), set base to 0 for direct control
                  audioParam.value = 0
                  /* console.log(
                    `Connected custom node to AudioParam: ${targetInput}, set base value to 0`
                  ) */
                }

                // Store the bridge source for updates and cleanup
                if (!self.customNodeBridges) {
                  self.customNodeBridges = new Map()
                }
                self.customNodeBridges.set(`${sourceId}-${targetId}`, constantSource)

                /* console.log(
                  `Bridge created for custom node ${sourceNodeType} → ${targetInput} with initial value: ${currentValue}`
                ) */

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
              if (!isTestEnvironment) {
                this.setIsPlaying(true)
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
                    /* console.log(
                      `Connected to frequency AudioParam from ${sourceNodeType}: direct control, set base to 0`
                    ) */
                  } else if (sourceNodeType === 'OscillatorNode') {
                    // LFO modulation - oscillator output adds to base frequency
                    /* console.log(
                      `Connected to frequency AudioParam from ${sourceNodeType}: modulation, keeping base value`
                    ) */
                  } else {
                    // Default: keep base value for modulation
                    /* console.log(
                      `Connected to frequency AudioParam from ${sourceNodeType}: keeping base value`
                    ) */
                  }
                } else {
                  // For other AudioParams (gain, detune, etc.), set base to 0 for direct control
                  audioParam.value = 0
                }
              } else {
                console.error(`AudioParam ${targetInput} not found on target node`)
                return
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
              if (!isTestEnvironment) {
                this.setIsPlaying(true)
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

        // Handle custom node to audio node disconnections
        if (sourceCustomNode && targetNode) {
          try {
            // Clean up the bridge
            if (self.customNodeBridges) {
              const bridgeKey = `${sourceId}-${targetId}`
              const bridge = self.customNodeBridges.get(bridgeKey)
              if (bridge) {
                bridge.stop()
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
                  /* console.log(
                    `Disconnected custom node: restored ${connection.targetInput} to default value: ${paramMetadata.defaultValue}`
                  ) */
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
                    /* console.log(
                      `Disconnected from AudioParam: ${connection.targetInput}, restored default value: ${paramMetadata.defaultValue}`
                    ) */
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
                self.isPlaying = false
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
            // Find the connection that uses this bridge
            const connection = self.audioConnections.find(
              conn =>
                conn.sourceNodeId === nodeId &&
                bridgeKey === `${conn.sourceNodeId}-${conn.targetNodeId}` &&
                conn.sourceOutput === outputName
            )

            if (connection) {
              bridge.offset.value = value
            }
          }
        })
      },

      selectNode(nodeId: string | undefined) {
        self.selectedNodeId = nodeId
      },

      updateNodePosition(nodeId: string, position: { x: number; y: number }) {
        const visualNode = self.adaptedNodes.find(n => n.id === nodeId)
        const adaptedNode = self.adaptedNodes.find(n => n.id === nodeId)

        if (visualNode) {
          visualNode.position.x = position.x
          visualNode.position.y = position.y
        } else if (adaptedNode) {
          adaptedNode.position.x = position.x
          adaptedNode.position.y = position.y
        }
      },
    }
  })
  .actions(self => {
    return {
      togglePlayback: flow(function* (): Generator<Promise<unknown>, void, unknown> {
        if (self.isPlaying) {
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
          self.isPlaying = false
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

          self.setIsPlaying(true)

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
      }),

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
          self.graphChangeCounter += 1

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

        /* console.log(
          `Copied ${self.clipboardNodes.length} nodes and ${self.clipboardEdges.length} edges to clipboard`
        ) */
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
          navigator.clipboard
            .writeText(clipboardText)
            .then(() => {
              self.clipboardPermissionState = 'granted'
              self.clipboardError = null
            })
            .catch(error => {
              console.warn('Failed to write to system clipboard:', error)
              self.clipboardPermissionState = 'denied'
              self.clipboardError =
                'Clipboard access denied. Copy/paste will work within this tab only.'
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
              data: {
                ...node.data,
                metadata: JSON.parse(JSON.stringify(node.metadata)), // Deep copy metadata
                properties: { ...node.properties },
              },
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
          // Generate new unique ID
          self.nodeIdCounter += 1
          const newNodeId = `${clipboardNode.nodeType}-${Date.now()}-${self.nodeIdCounter}`
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
            nodeType: clipboardNode.nodeType,
            position: newPosition,
            metadata: { ...clipboardNode.metadata },
            properties: { ...clipboardNode.properties },
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

        /* console.log(
          `Pasted ${newNodeIds.length} nodes with ${clipboardData.edges.length} connections`
        ) */

        // Clear clipboard state after successful paste to clean up UI
        self.clipboardNodes = []
        self.clipboardEdges = []
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
                    self.propertyChangeCounter += 1
                  } else if (targetAdaptedNode) {
                    targetAdaptedNode.updateProperty(propertyName, value)
                    self.propertyChangeCounter += 1
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

          // Start source nodes immediately if we're currently playing
          if (
            (nodeType === 'OscillatorNode' || nodeType === 'AudioBufferSourceNode') &&
            self.isPlaying
          ) {
            if ('start' in audioNode && typeof audioNode.start === 'function') {
              try {
                ;(audioNode as OscillatorNode | AudioBufferSourceNode).start()
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
            observableData.nodes.forEach(nodeState => {
              if (!nodeState.hasAudioNode) {
                try {
                  this.createAudioNode(nodeState.id, nodeState.nodeType)

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

            // After creating all audio nodes, recreate audio connections
            // For source nodes (like oscillators), we need to recreate them because
            // they can only be started once in Web Audio API
            self.audioNodes.forEach((audioNode, nodeId) => {
              const visualNode = self.adaptedNodes.find(node => node.id === nodeId)
              const nodeType = visualNode?.nodeType

              if (nodeType && self.audioNodeFactory) {
                // Check if this is a source node that needs to be recreated
                const isSourceNode = ['OscillatorNode', 'AudioBufferSourceNode'].includes(nodeType)

                if (isSourceNode) {
                  try {
                    // Stop and disconnect the old node
                    audioNode.disconnect()

                    // For source nodes, try to stop them manually
                    if ('stop' in audioNode && typeof audioNode.stop === 'function') {
                      try {
                        ;(audioNode as OscillatorNode | AudioBufferSourceNode).stop()
                      } catch {
                        // Node might already be stopped, ignore
                      }
                    }

                    // Create a new node with the same properties
                    const metadata = visualNode.metadata as unknown as INodeMetadata
                    const properties = Object.fromEntries(visualNode.properties.entries())
                    const newAudioNode = self.audioNodeFactory.createAudioNode(
                      nodeType,
                      metadata,
                      properties
                    )

                    // Replace the old node with the new one
                    self.audioNodes.set(nodeId, newAudioNode)
                  } catch (error) {
                    console.error(`Error recreating source node ${nodeType}:`, error)
                  }
                } else {
                  // For non-source nodes, just disconnect
                  try {
                    audioNode.disconnect()
                  } catch {
                    // Ignore errors from already disconnected nodes
                  }
                }
              }
            })

            // Recreate connections based on the audioConnections array
            self.audioConnections.forEach(connection => {
              try {
                self.connectAudioNodes(
                  connection.sourceNodeId,
                  connection.targetNodeId,
                  connection.sourceOutput,
                  connection.targetInput,
                  true // Skip adding to array since connections already exist in the array
                )
              } catch (error) {
                console.error(`Error recreating audio connection:`, error, connection)
              }
            })
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
      if (!self.selectedNodeId) return undefined

      // Look in both visual nodes (legacy) and adapted nodes (new system)
      const visualNode = self.adaptedNodes.find(node => node.id === self.selectedNodeId)
      const adaptedNode = self.adaptedNodes.find(node => node.id === self.selectedNodeId)

      return visualNode || adaptedNode
    },

    get availableNodeTypes() {
      return Object.keys(self.webAudioMetadata)
    },

    get canUndo() {
      return self.undoStack.length > 0
    },

    get canRedo() {
      return self.redoStack.length > 0
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
          self.propertyChangeCounter += 1
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
            // Check if this is an AudioParam with an active control connection
            const propertyDef = metadata.properties.find(p => p.name === propertyName)
            if (propertyDef?.type === 'AudioParam') {
              // Check if there's an active control connection to this AudioParam
              const hasControlConnection = self.audioConnections.some(
                conn => conn.targetNodeId === nodeId && conn.targetInput === propertyName
              )

              if (hasControlConnection) {
                /*  console.log(
                   `⚠️ Skipping direct AudioParam update for ${propertyName} - control connection active`
                 ) */
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

// Factory function to create store with patch middleware
export const createAudioGraphStore = () => {
  const store = AudioGraphStore.create({
    undoStack: [],
    redoStack: [],
  })

  // Set up patch middleware for automatic undo/redo tracking
  let patchRecorder: { forward: IJsonPatch; inverse: IJsonPatch }[] = []
  let isRecording = false

  onPatch(store, (patch, reversePatch) => {
    // Don't record patches when we're applying undo/redo
    if (store.isApplyingPatch) return

    // Don't record patches when creating examples
    if (store.isCreatingExample) return

    // Don't record patches when clearing all nodes
    if (store.isClearingAllNodes) return

    // Don't record patches when updating play state automatically
    if (store.isUpdatingPlayState) return

    // Don't record patches when loading a project
    if (store.isLoadingProject) return

    // Don't record patches to the history stacks themselves (prevents recursion)
    if (patch.path.startsWith('/undoStack') || patch.path.startsWith('/redoStack')) {
      return
    }

    // Don't record play/pause state changes in undo history
    if (patch.path === '/isPlaying') {
      return
    }

    // Don't record node selection changes in undo history
    if (patch.path === '/selectedNodeId') {
      return
    }

    // Don't record property change counter updates (these are just for React re-renders)
    if (patch.path === '/propertyChangeCounter') {
      return
    }

    // Don't record graph change counter updates
    if (patch.path === '/graphChangeCounter') {
      return
    }

    // Don't record modification state changes (prevents recursion)
    if (patch.path === '/isProjectModified') {
      return
    }

    // Mark project as modified for meaningful changes
    if (!store.isProjectModified) {
      store.markProjectModified()
    }

    // Start recording if not already
    if (!isRecording) {
      isRecording = true
      patchRecorder = []

      // Use microtask to batch patches that happen in the same tick
      queueMicrotask(() => {
        if (patchRecorder.length > 0) {
          // Add to undo stack using store action
          store.addToUndoStack({
            forward: patchRecorder.map(p => p.forward),
            inverse: patchRecorder.map(p => p.inverse).reverse(),
          })
        }

        isRecording = false
        patchRecorder = []
      })
    }

    // Record the patch
    patchRecorder.push({ forward: patch, inverse: reversePatch })
  })

  // Undo/redo actions are now properly implemented in the MST model

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
