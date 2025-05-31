import { types, flow, onPatch, applyPatch } from 'mobx-state-tree'
import type { Instance, IJsonPatch } from 'mobx-state-tree'
import type { NodeMetadata } from '~/types'
import { VisualNodeModel, VisualEdgeModel, AudioConnectionModel } from '~/models/NodeModels'
import { AudioNodeFactory } from '~/services/AudioNodeFactory'
import { CustomNodeFactory, type CustomNode } from '~/services/CustomNodeFactory'
import { customNodeStore } from '~/stores/CustomNodeStore'
import { createContext, useContext } from 'react'
// Import the JSON metadata directly
import webAudioMetadataJson from '~/types/web-audio-metadata.json'
import customNodesMetadataJson from '~/types/custom-nodes-metadata.json'

// Use the imported metadata directly
const getWebAudioMetadata = (): Record<string, NodeMetadata> => {
  return webAudioMetadataJson as Record<string, NodeMetadata>
}

const getCustomNodesMetadata = (): Record<string, NodeMetadata> => {
  return customNodesMetadataJson as Record<string, NodeMetadata>
}

// Combine both metadata sources
const getAllNodesMetadata = (): Record<string, NodeMetadata> => {
  return {
    ...getWebAudioMetadata(),
    ...getCustomNodesMetadata(),
  }
}

export const AudioGraphStore = types
  .model('AudioGraphStore', {
    visualNodes: types.array(VisualNodeModel),
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
    webAudioMetadata: {} as Record<string, NodeMetadata>,
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
    // Global analyzer for frequency analysis
    globalAnalyzer: null as AnalyserNode | null,
    // Counter to ensure unique node IDs
    nodeIdCounter: 0,
    // Store media streams for microphone nodes
    mediaStreams: new Map<string, MediaStream>(),
    // New field for custom node bridges
    customNodeBridges: null as Map<string, ConstantSourceNode> | null,
  }))
  .actions(self => {
    const actions = {
      loadMetadata() {
        try {
          self.webAudioMetadata = getAllNodesMetadata()
        } catch (error) {
          console.error('STORE: Error loading metadata:', error)
        }
      },

      undo() {
        actions.applyUndo()
      },

      redo() {
        actions.applyRedo()
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

      // Action to set project modified state
      setProjectModified(value: boolean) {
        self.isProjectModified = value
      },

      // Action to mark project as modified (when changes are made)
      markProjectModified() {
        self.isProjectModified = true
      },

      applyUndo() {
        const patches = actions.moveToRedoStack()
        if (patches) {
          actions.setApplyingPatch(true)
          applyPatch(self, patches.inverse)
          actions.setApplyingPatch(false)
          actions.recreateAudioGraph()
        }
      },

      applyRedo() {
        const patches = actions.moveToUndoStack()
        if (patches) {
          actions.setApplyingPatch(true)
          applyPatch(self, patches.forward)
          actions.setApplyingPatch(false)
          actions.recreateAudioGraph()
        }
      },

      recreateAudioGraph: flow(function* () {
        // Clear existing audio nodes
        self.audioNodes.clear()

        // Update existing custom nodes with new audio context instead of recreating them
        console.log(
          `🔄 Updating ${self.customNodes.size} existing custom nodes with fresh audio context`
        )
        self.customNodes.forEach((customNode, nodeId) => {
          if (
            'updateAudioContext' in customNode &&
            typeof customNode.updateAudioContext === 'function'
          ) {
            ;(customNode as any).updateAudioContext(self.audioContext)
            console.log(`✅ Updated audio context for custom node ${nodeId}`)
          }
        })

        // Recreate all nodes using metadata-driven approach
        self.visualNodes.forEach(node => {
          try {
            // Check if it's a custom node type
            if (self.customNodeFactory?.isCustomNodeType(node.data.nodeType)) {
              // Only create custom node if it doesn't already exist
              if (!self.customNodes.has(node.id)) {
                actions.createAudioNode(node.id, node.data.nodeType)
              }
            } else {
              // Always recreate regular audio nodes
              actions.createAudioNode(node.id, node.data.nodeType)
            }
          } catch (error) {
            console.error('Error recreating audio node:', error)
          }
        })

        // Small delay to ensure nodes are fully updated
        yield new Promise(resolve => setTimeout(resolve, 50))

        // Recreate audio connections
        self.visualEdges.forEach(edge => {
          try {
            actions.connectAudioNodes(
              edge.source,
              edge.target,
              edge.sourceHandle || 'output',
              edge.targetHandle || 'input'
            )
          } catch (error) {
            console.error('Error recreating audio connection:', error)
          }
        })
      }),

      initializeAudioContext() {
        if (!self.audioContext) {
          self.audioContext = new AudioContext()
          self.audioNodeFactory = new AudioNodeFactory(self.audioContext)
          self.customNodeFactory = new CustomNodeFactory(self.audioContext)

          // Create global analyzer for frequency analysis
          self.globalAnalyzer = self.audioContext.createAnalyser()
          self.globalAnalyzer.fftSize = 1024
          self.globalAnalyzer.smoothingTimeConstant = 0.8
          console.log('Global analyzer created for frequency analysis')
        }
      },

      addNode(nodeType: string, position: { x: number; y: number }) {
        const metadata = self.webAudioMetadata[nodeType]

        if (!metadata) {
          console.error('STORE: Unknown node type:', nodeType)
          throw new Error(`Unknown node type: ${nodeType}`)
        }

        // Increment counter and use it with timestamp to ensure uniqueness
        self.nodeIdCounter += 1
        const nodeId = `${nodeType}-${Date.now()}-${self.nodeIdCounter}`

        // Create properties from metadata
        const propertiesObj: Record<string, unknown> = {}
        metadata.properties.forEach(prop => {
          propertiesObj[prop.name] = prop.defaultValue
        })

        // Create the visual node with MST-compatible structure
        const visualNode = {
          id: nodeId,
          type: 'audioNode',
          position: {
            x: position.x,
            y: position.y,
          },
          data: {
            nodeType,
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
          },
        }

        // Create the actual audio node FIRST (before adding visual node)
        // This ensures CustomNodeStore has the MobX node before React renders
        try {
          actions.createAudioNode(nodeId, nodeType)
        } catch (error) {
          console.error('STORE: Error creating audio node:', error)
        }

        // Now add the visual node to the store, so React components can find the MobX node
        try {
          self.visualNodes.push(visualNode)
        } catch (error) {
          console.error('STORE: Error adding node to visualNodes:', error)
          throw error
        }

        // Increment graph change counter to force React re-render
        self.graphChangeCounter += 1

        return nodeId
      },

      createAudioNode(nodeId: string, nodeType: string) {
        if (!self.audioContext) {
          actions.initializeAudioContext()
        }

        if (!self.audioContext || !self.audioNodeFactory || !self.customNodeFactory) {
          console.error('Failed to initialize audio context or factories')
          return
        }

        // Get the visual node to extract properties and metadata
        const visualNode = self.visualNodes.find(node => node.id === nodeId)

        // Use metadata from the visual node if available (for loaded projects),
        // otherwise fall back to global metadata (for new nodes)
        let metadata: NodeMetadata
        if (visualNode && visualNode.data.metadata) {
          metadata = visualNode.data.metadata as NodeMetadata
          console.log(`Using metadata from visual node for ${nodeType}:`, metadata.category)
        } else {
          metadata = self.webAudioMetadata[nodeType]
          console.log(`Using global metadata for ${nodeType}:`, metadata?.category)
        }

        if (!metadata) {
          console.error(`No metadata found for node type: ${nodeType}`)
          return
        }

        const properties = visualNode
          ? Object.fromEntries(visualNode.data.properties.entries())
          : {}

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
                  actions.updateCustomNodeBridges(nodeId, outputName, value)
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
                  const visualNode = self.visualNodes.find(node => node.id === nodeId)
                  if (visualNode) {
                    visualNode.data.properties.set(propertyName, value)
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

            console.log(`Successfully created custom node: ${nodeType}`)
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
              console.log(`Successfully recreated MediaStreamAudioSourceNode: ${nodeId}`)
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
          console.log(`Successfully created audio node: ${nodeType}`)
        } catch (error) {
          console.error('STORE: Error creating audio node:', error)
        }
      },

      removeNode(nodeId: string) {
        console.log(`=== REMOVING NODE: ${nodeId} ===`)

        // Find the node first
        const visualNode = self.visualNodes.find(node => node.id === nodeId)
        if (!visualNode) {
          console.log('Visual node not found')
          return
        }

        const nodeType = visualNode.data.nodeType
        console.log(`Node type: ${nodeType}`)

        // Check if it's a custom node
        const customNode = self.customNodes.get(nodeId)
        if (customNode) {
          console.log('Found custom node, performing cleanup...')
          try {
            customNode.cleanup()
            self.customNodes.delete(nodeId)

            // Also remove from the CustomNodeStore
            customNodeStore.removeNode(nodeId)
            console.log('Custom node cleanup completed')
          } catch (error) {
            console.error('Error during custom node cleanup:', error)
          }
        }

        // Check if it's an audio node
        const audioNode = self.audioNodes.get(nodeId)
        if (audioNode) {
          console.log('Found audio node, performing thorough cleanup...')

          try {
            // First, disconnect all outputs
            audioNode.disconnect()
            console.log('Audio node outputs disconnected')

            // Stop source nodes properly
            if ('stop' in audioNode && typeof audioNode.stop === 'function') {
              try {
                ;(audioNode as OscillatorNode | AudioBufferSourceNode).stop()
                console.log('Source node stopped')
              } catch (stopError) {
                // Node might already be stopped, which is fine
                console.log('Source node already stopped or stopping failed:', stopError)
              }
            }

            // Handle MediaStreamAudioSourceNode specifically
            if (audioNode.constructor.name === 'MediaStreamAudioSourceNode') {
              const mediaNode = audioNode as MediaStreamAudioSourceNode
              if (mediaNode.mediaStream) {
                mediaNode.mediaStream.getTracks().forEach(track => {
                  track.stop()
                  console.log('Stopped media track')
                })
              }
            }

            // Additional cleanup using factory if available
            if (self.audioNodeFactory) {
              try {
                self.audioNodeFactory.stopSourceNode(audioNode, nodeType)
                console.log('Factory cleanup completed')
              } catch (error) {
                console.log('Factory cleanup error (non-critical):', error)
              }
            }
          } catch (error) {
            console.error('Error during audio node cleanup:', error)
          }

          // Remove from audio nodes map
          self.audioNodes.delete(nodeId)
          console.log('Audio node removed from map')
        }

        if (!customNode && !audioNode) {
          console.log('No audio or custom node found')
        }

        // Remove all edges connected to this node BEFORE removing the visual node
        const edgesToRemove = self.visualEdges.filter(
          edge => edge.source === nodeId || edge.target === nodeId
        )

        console.log(`Removing ${edgesToRemove.length} connected edges`)
        edgesToRemove.forEach(edge => {
          actions.removeEdge(edge.id)
        })

        // Remove any remaining audio connections
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
        const nodeIndex = self.visualNodes.findIndex(node => node.id === nodeId)
        if (nodeIndex !== -1) {
          self.visualNodes.splice(nodeIndex, 1)
          console.log('Visual node removed')
        }

        // Clean up stored media stream if this is a microphone node
        if (nodeType === 'MediaStreamAudioSourceNode') {
          const mediaStream = self.mediaStreams.get(nodeId)
          if (mediaStream) {
            mediaStream.getTracks().forEach(track => {
              track.stop()
              console.log('Stopped media track from stored stream')
            })
            self.mediaStreams.delete(nodeId)
            console.log('Removed stored media stream')
          }
        }

        // If this was the last node connected to destination, update play state
        const hasDestinationConnections = self.audioConnections.some(conn => {
          const targetNode = self.visualNodes.find(node => node.id === conn.targetNodeId)
          return targetNode?.data.nodeType === 'AudioDestinationNode'
        })

        if (!hasDestinationConnections && self.isPlaying) {
          console.log('No more destination connections, stopping playback')
          actions.setUpdatingPlayState(true)
          self.isPlaying = false
          actions.setUpdatingPlayState(false)
        }

        console.log('=== NODE REMOVAL COMPLETE ===')
      },

      clearAllNodes() {
        console.log('=== CLEARING ALL NODES ===')

        // Set flag to prevent recording this operation in undo history
        actions.setClearingAllNodes(true)

        // Get all node IDs first to avoid modifying array while iterating
        const nodeIds = self.visualNodes.map(node => node.id)
        console.log('Clearing', nodeIds.length, 'nodes:', nodeIds)

        // Remove each node properly
        nodeIds.forEach(nodeId => {
          actions.removeNode(nodeId)
        })

        // Perform comprehensive audio cleanup
        actions.performComprehensiveAudioCleanup()

        // Double-check that everything is cleared
        if (self.visualNodes.length > 0) {
          console.warn('Some visual nodes were not removed, force clearing...')
          self.visualNodes.clear()
        }

        if (self.visualEdges.length > 0) {
          console.warn('Some edges were not removed, force clearing...')
          self.visualEdges.clear()
        }

        if (self.audioConnections.length > 0) {
          console.warn('Some audio connections were not removed, force clearing...')
          self.audioConnections.clear()
        }

        console.log('=== ALL NODES CLEARED ===')

        // Clear undo/redo history since there's nothing left to undo to
        self.undoStack.clear()
        self.redoStack.clear()
        console.log('Undo/redo history cleared')

        // Reset play state since no audio is playing
        actions.setUpdatingPlayState(true)
        self.isPlaying = false
        actions.setUpdatingPlayState(false)

        // Increment graph change counter to force React re-render
        // (do this before resetting flag to avoid recording in undo history)
        self.graphChangeCounter += 1

        // Reset flag to allow recording future operations
        actions.setClearingAllNodes(false)

        // Reset project modification state since we've cleared everything
        self.isProjectModified = false
      },

      performComprehensiveAudioCleanup() {
        console.log('=== PERFORMING COMPREHENSIVE AUDIO CLEANUP ===')

        // Stop and disconnect all remaining audio nodes
        if (self.audioNodes.size > 0) {
          console.log(`Cleaning up ${self.audioNodes.size} remaining audio nodes...`)

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
                  console.log(`Node ${nodeId} already stopped or stopping failed:`, stopError)
                }
              }

              // Close MediaStreamAudioSourceNode streams
              if (audioNode.constructor.name === 'MediaStreamAudioSourceNode') {
                const mediaNode = audioNode as MediaStreamAudioSourceNode
                if (mediaNode.mediaStream) {
                  mediaNode.mediaStream.getTracks().forEach(track => {
                    track.stop()
                    console.log(`Stopped media track for node ${nodeId}`)
                  })
                }
              }
            } catch (error) {
              console.log(`Error cleaning up audio node ${nodeId}:`, error)
            }
          })

          self.audioNodes.clear()
        }

        // Clean up global analyzer
        if (self.globalAnalyzer) {
          try {
            self.globalAnalyzer.disconnect()
            console.log('Global analyzer disconnected')
          } catch (error) {
            console.log('Error disconnecting global analyzer:', error)
          }
          self.globalAnalyzer = null
        }

        // Clean up all stored media streams
        if (self.mediaStreams.size > 0) {
          console.log(`Cleaning up ${self.mediaStreams.size} stored media streams...`)
          self.mediaStreams.forEach((stream, nodeId) => {
            try {
              stream.getTracks().forEach(track => {
                track.stop()
                console.log(`Stopped media track for node ${nodeId}`)
              })
            } catch (error) {
              console.log(`Error stopping media stream for node ${nodeId}:`, error)
            }
          })
          self.mediaStreams.clear()
          console.log('All media streams cleaned up')
        }

        // Reinitialize audio context for a fresh start
        if (self.audioContext) {
          console.log('Reinitializing audio context for clean state...')

          try {
            // Close the current audio context
            if (self.audioContext.state !== 'closed') {
              self.audioContext.close()
            }
          } catch (error) {
            console.log('Error closing audio context:', error)
          }

          // Reset audio context and factory
          self.audioContext = null
          self.audioNodeFactory = null
          self.customNodeFactory = null

          // Create new audio context
          actions.initializeAudioContext()

          console.log('Audio context reinitialized')
        }

        console.log('=== COMPREHENSIVE AUDIO CLEANUP COMPLETE ===')
      },

      forceAudioCleanup() {
        console.log('=== FORCING AUDIO CLEANUP ===')

        // Suspend audio context first to stop all processing
        if (self.audioContext && self.audioContext.state === 'running') {
          self.audioContext.suspend()
        }

        // Perform comprehensive cleanup
        actions.performComprehensiveAudioCleanup()

        console.log('=== FORCED AUDIO CLEANUP COMPLETE ===')
      },

      addEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string) {
        console.log('=== STORE: addEdge called ===')

        // Validate connection before creating
        if (!actions.isValidConnection(source, target, sourceHandle, targetHandle)) {
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
          console.log('Successfully added edge to visualEdges')
        } catch (error) {
          console.error('Error adding edge to visualEdges:', error)
          return
        }

        // Create audio connection
        try {
          actions.connectAudioNodes(
            source,
            target,
            sourceHandle || 'output',
            targetHandle || 'input'
          )
          console.log('Audio connection created successfully')
        } catch (error) {
          console.error('Error creating audio connection:', error)
        }

        // Increment graph change counter to force React re-render
        self.graphChangeCounter += 1
      },

      isValidConnection(
        sourceId: string,
        targetId: string,
        sourceHandle?: string,
        targetHandle?: string
      ): boolean {
        const sourceNode = self.visualNodes.find(node => node.id === sourceId)
        const targetNode = self.visualNodes.find(node => node.id === targetId)

        if (!sourceNode || !targetNode) {
          console.warn('Source or target node not found for connection validation')
          return false
        }

        // Find the specific output and input
        const outputName = sourceHandle || 'output'
        const inputName = targetHandle || 'input'

        const sourceOutput = sourceNode.data.metadata.outputs.find(
          output => output.name === outputName
        )
        const targetInput = targetNode.data.metadata.inputs.find(input => input.name === inputName)

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
          actions.disconnectAudioNodes(edge.source, edge.target)

          self.visualEdges.splice(edgeIndex, 1)
        }
      },

      connectAudioNodes(
        sourceId: string,
        targetId: string,
        sourceOutput: string,
        targetInput: string
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

            self.audioConnections.push({
              sourceNodeId: sourceId,
              targetNodeId: targetId,
              sourceOutput,
              targetInput,
            })

            console.log(`Connected custom node ${sourceId} to custom node ${targetId}`)
          } catch (error) {
            console.error('Failed to connect custom node to custom node:', error)
          }
          return
        }

        // Handle custom node to audio node connections
        if (sourceCustomNode && targetNode) {
          try {
            // Check if we're connecting to the destination node
            const targetVisualNode = self.visualNodes.find(node => node.id === targetId)
            const isDestinationConnection =
              targetVisualNode?.data.nodeType === 'AudioDestinationNode'

            // Check if this is a control connection (to an AudioParam)
            const targetMetadata = targetVisualNode?.data.metadata
            const targetInputDef = targetMetadata?.inputs.find(input => input.name === targetInput)
            const isControlConnection = targetInputDef?.type === 'control'

            // Check if this is an audio connection from custom node
            const sourceVisualNode = self.visualNodes.find(node => node.id === sourceId)
            const sourceMetadata = sourceVisualNode?.data.metadata
            const sourceOutputDef = sourceMetadata?.outputs.find(
              output => output.name === sourceOutput
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
                  console.log('Connected custom node audio through global analyzer to destination')
                } else {
                  // Direct audio connection
                  audioOutput.connect(targetNode)
                  console.log(
                    `Connected custom node audio output to ${targetVisualNode?.data.nodeType}`
                  )
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
                const sourceVisualNode = self.visualNodes.find(node => node.id === sourceId)
                const sourceNodeType = sourceVisualNode?.data.nodeType

                // Smart base value handling based on parameter and source type
                if (targetInput === 'frequency') {
                  // For frequency parameters, check the source type
                  if (sourceNodeType === 'SliderNode' || sourceNodeType === 'MidiToFreqNode') {
                    // Direct frequency control - these nodes output frequency values
                    audioParam.value = 0
                    console.log(
                      `Connected custom node ${sourceNodeType} to frequency AudioParam: direct control, set base to 0`
                    )
                  } else {
                    // Default: keep base value for modulation
                    console.log(
                      `Connected custom node ${sourceNodeType} to frequency AudioParam: keeping base value`
                    )
                  }
                } else {
                  // For other AudioParams (gain, detune, etc.), set base to 0 for direct control
                  audioParam.value = 0
                  console.log(
                    `Connected custom node to AudioParam: ${targetInput}, set base value to 0`
                  )
                }

                // Store the bridge source for updates and cleanup
                if (!self.customNodeBridges) {
                  self.customNodeBridges = new Map()
                }
                self.customNodeBridges.set(`${sourceId}-${targetId}`, constantSource)

                console.log(
                  `Bridge created for custom node ${sourceNodeType} → ${targetInput} with initial value: ${currentValue}`
                )

                // Force an immediate update to ensure the bridge has the latest value
                // This handles the case where the custom node already has a valid output value
                setTimeout(() => {
                  const latestValue = sourceCustomNode.outputs.get(sourceOutput)
                  if (latestValue !== undefined && latestValue !== currentValue) {
                    constantSource.offset.value = latestValue
                    console.log(`🔄 Updated bridge immediately after connection: ${latestValue}`)
                  }
                }, 10)
              } else {
                console.error(`AudioParam ${targetInput} not found on target node`)
                return
              }
            } else {
              console.error('Custom nodes can only connect to control inputs (AudioParams)')
              return
            }

            self.audioConnections.push({
              sourceNodeId: sourceId,
              targetNodeId: targetId,
              sourceOutput,
              targetInput,
            })

            if (isDestinationConnection) {
              // Audio is now playing through the destination, update play state
              console.log('Audio connected to destination - setting play state to true')
              actions.setUpdatingPlayState(true)
              self.isPlaying = true
              actions.setUpdatingPlayState(false)
            }

            console.log(`Connected custom node ${sourceId} to audio node ${targetId}`)
          } catch (error) {
            console.error('Failed to connect custom node to audio node:', error)
          }
          return
        }

        // Handle audio node to audio node connections (existing logic)
        if (sourceNode && targetNode) {
          try {
            // Check if we're connecting to the destination node
            const targetVisualNode = self.visualNodes.find(node => node.id === targetId)
            const isDestinationConnection =
              targetVisualNode?.data.nodeType === 'AudioDestinationNode'

            // Check if this is a control connection (to an AudioParam)
            const targetMetadata = targetVisualNode?.data.metadata
            const targetInputDef = targetMetadata?.inputs.find(input => input.name === targetInput)
            const isControlConnection = targetInputDef?.type === 'control'

            if (isControlConnection) {
              // Connect to AudioParam
              const targetNodeWithParams = targetNode as unknown as Record<string, AudioParam>
              const audioParam = targetNodeWithParams[targetInput]

              if (audioParam && typeof audioParam.value !== 'undefined') {
                sourceNode.connect(audioParam)

                // Get the source node info to determine connection type
                const sourceVisualNode = self.visualNodes.find(node => node.id === sourceId)
                const sourceNodeType = sourceVisualNode?.data.nodeType

                // Smart base value handling based on parameter and source type
                if (targetInput === 'frequency') {
                  // For frequency parameters, check the source type
                  if (sourceNodeType === 'SliderNode' || sourceNodeType === 'MidiToFreqNode') {
                    // Direct frequency control - these nodes output frequency values
                    audioParam.value = 0
                    console.log(
                      `Connected to frequency AudioParam from ${sourceNodeType}: direct control, set base to 0`
                    )
                  } else if (sourceNodeType === 'OscillatorNode') {
                    // LFO modulation - oscillator output adds to base frequency
                    console.log(
                      `Connected to frequency AudioParam from ${sourceNodeType}: modulation, keeping base value`
                    )
                  } else {
                    // Default: keep base value for modulation
                    console.log(
                      `Connected to frequency AudioParam from ${sourceNodeType}: keeping base value`
                    )
                  }
                } else {
                  // For other AudioParams (gain, detune, etc.), set base to 0 for direct control
                  audioParam.value = 0
                  console.log(`Connected to AudioParam: ${targetInput}, set base value to 0`)
                }
              } else {
                console.error(`AudioParam ${targetInput} not found on target node`)
                return
              }
            } else if (isDestinationConnection && self.globalAnalyzer) {
              // Connect through the analyzer: source -> analyzer -> destination
              sourceNode.connect(self.globalAnalyzer)
              self.globalAnalyzer.connect(targetNode)
              console.log('Connected audio through global analyzer for frequency analysis')
            } else {
              // Normal audio connection
              sourceNode.connect(targetNode)
            }

            self.audioConnections.push({
              sourceNodeId: sourceId,
              targetNodeId: targetId,
              sourceOutput,
              targetInput,
            })

            if (isDestinationConnection) {
              // Audio is now playing through the destination, update play state
              console.log('Audio connected to destination - setting play state to true')
              actions.setUpdatingPlayState(true)
              self.isPlaying = true
              actions.setUpdatingPlayState(false)
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

            console.log(`Disconnected custom node ${sourceId} from custom node ${targetId}`)
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
                console.log(`Cleaned up bridge for custom node ${sourceId}`)
              }
            }

            // Find the connection to determine the target input
            const connection = self.audioConnections.find(
              conn => conn.sourceNodeId === sourceId && conn.targetNodeId === targetId
            )

            if (connection) {
              // Restore the default value for this AudioParam
              const targetVisualNode = self.visualNodes.find(node => node.id === targetId)
              const targetMetadata = targetVisualNode?.data.metadata
              const paramMetadata = targetMetadata?.properties.find(
                prop => prop.name === connection.targetInput && prop.type === 'AudioParam'
              )

              if (paramMetadata && paramMetadata.defaultValue !== null) {
                const targetNodeWithParams = targetNode as unknown as Record<string, AudioParam>
                const audioParam = targetNodeWithParams[connection.targetInput]
                if (audioParam && typeof audioParam.value !== 'undefined') {
                  audioParam.value = paramMetadata.defaultValue
                  console.log(
                    `Disconnected custom node: restored ${connection.targetInput} to default value: ${paramMetadata.defaultValue}`
                  )
                }
              }
            }

            const connectionIndex = self.audioConnections.findIndex(
              conn => conn.sourceNodeId === sourceId && conn.targetNodeId === targetId
            )
            if (connectionIndex !== -1) {
              self.audioConnections.splice(connectionIndex, 1)
            }

            console.log(`Disconnected custom node ${sourceId} from audio node ${targetId}`)
          } catch (error) {
            console.error('Failed to disconnect custom node from audio node:', error)
          }
          return
        }

        // Handle audio node to audio node disconnections (existing logic)
        if (sourceNode && targetNode) {
          try {
            // Check if we're disconnecting from the destination node
            const targetVisualNode = self.visualNodes.find(node => node.id === targetId)
            const isDestinationConnection =
              targetVisualNode?.data.nodeType === 'AudioDestinationNode'

            // Find the connection to determine the target input
            const connection = self.audioConnections.find(
              conn => conn.sourceNodeId === sourceId && conn.targetNodeId === targetId
            )

            if (connection) {
              // Check if this is a control connection
              const targetMetadata = targetVisualNode?.data.metadata
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
                    console.log(
                      `Disconnected from AudioParam: ${connection.targetInput}, restored default value: ${paramMetadata.defaultValue}`
                    )
                  } else {
                    console.log(`Disconnected from AudioParam: ${connection.targetInput}`)
                  }
                } else {
                  console.error(`AudioParam ${connection.targetInput} not found on target node`)
                }
              } else if (isDestinationConnection && self.globalAnalyzer) {
                // Disconnect from analyzer: source -> analyzer -> destination
                sourceNode.disconnect(self.globalAnalyzer)
                // Note: We don't disconnect analyzer from destination as other sources might still be connected
                console.log('Disconnected audio from global analyzer')
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
                const connTargetNode = self.visualNodes.find(node => node.id === conn.targetNodeId)
                return connTargetNode?.data.nodeType === 'AudioDestinationNode'
              })

              if (remainingDestinationConnections.length === 0) {
                console.log('No audio connected to destination - setting play state to false')
                actions.setUpdatingPlayState(true)
                self.isPlaying = false
                actions.setUpdatingPlayState(false)

                // Disconnect analyzer from destination when no more sources
                if (self.globalAnalyzer) {
                  try {
                    self.globalAnalyzer.disconnect(targetNode)
                    console.log('Disconnected global analyzer from destination')
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
              console.log(`🌉 Updated bridge for ${nodeId} output ${outputName}: ${value}`)
            }
          }
        })
      },

      updateNodeProperty(nodeId: string, propertyName: string, value: unknown) {
        console.log('=== UPDATING NODE PROPERTY ===', nodeId, propertyName, value)

        const visualNode = self.visualNodes.find(node => node.id === nodeId)
        const audioNode = self.audioNodes.get(nodeId)
        // Use the MST-based custom node store instead of legacy map
        const customNode = customNodeStore.getNode(nodeId)

        if (visualNode) {
          // Update the property using MST map API
          visualNode.data.properties.set(propertyName, value)
          console.log('Updated visual node property')

          // Increment the property change counter to trigger React re-renders
          self.propertyChangeCounter += 1
        }

        // Handle custom node property updates using MST store
        if (customNode && visualNode) {
          // Update the custom node's property using MST action
          customNode.setProperty(propertyName, value)

          // Check if this property corresponds to an output and update bridges
          const nodeMetadata = visualNode.data.metadata
          const hasCorrespondingOutput = nodeMetadata.outputs.some(
            output => output.name === propertyName
          )

          if (hasCorrespondingOutput) {
            // Update the custom node's output using MST action
            customNode.setOutput(propertyName, value)

            // Update any bridges connected to this custom node output
            actions.updateCustomNodeBridges(nodeId, propertyName, value as number)
          }

          // Handle special case for 'value' property (most common output)
          if (propertyName === 'value') {
            customNode.setOutput('value', value)
            actions.updateCustomNodeBridges(nodeId, 'value', value as number)
          }

          console.log('Updated custom node property')
          console.log('=== PROPERTY UPDATE COMPLETE ===')
          return
        }

        if (audioNode && visualNode && self.audioNodeFactory) {
          const nodeType = visualNode.data.nodeType
          const metadata = self.webAudioMetadata[nodeType]

          if (metadata) {
            // Check if this is an AudioParam with an active control connection
            const propertyDef = metadata.properties.find(p => p.name === propertyName)
            if (propertyDef?.type === 'AudioParam') {
              // Check if there's an active control connection to this AudioParam
              const hasControlConnection = self.audioConnections.some(
                conn => conn.targetNodeId === nodeId && conn.targetInput === propertyName
              )

              if (hasControlConnection) {
                console.log(
                  `⚠️ Skipping direct AudioParam update for ${propertyName} - control connection active`
                )
                console.log('=== PROPERTY UPDATE COMPLETE (SKIPPED) ===')
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
              console.log('Property update failed, recreating node...')

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
              actions.createAudioNode(nodeId, nodeType)

              // Restore connections
              setTimeout(() => {
                incomingConnections.forEach(conn => {
                  actions.connectAudioNodes(
                    conn.sourceNodeId,
                    conn.targetNodeId,
                    conn.sourceOutput,
                    conn.targetInput
                  )
                })
                outgoingConnections.forEach(conn => {
                  actions.connectAudioNodes(
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

        console.log('=== PROPERTY UPDATE COMPLETE ===')
      },

      selectNode(nodeId: string | undefined) {
        self.selectedNodeId = nodeId
      },

      updateNodePosition(nodeId: string, position: { x: number; y: number }) {
        const node = self.visualNodes.find(n => n.id === nodeId)
        if (node) {
          node.position.x = position.x
          node.position.y = position.y
        }
      },

      togglePlayback: flow(function* (): Generator<Promise<unknown>, void, unknown> {
        if (self.isPlaying) {
          // STOP: Close the audio context
          console.log('=== STOPPING PLAYBACK ===')

          if (self.audioContext) {
            try {
              yield self.audioContext.close()
              console.log('Audio context closed')
            } catch (error) {
              console.log('Error closing audio context:', error)
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
          console.log('Playback stopped')
        } else {
          // START: Create fresh audio context and rebuild everything
          console.log('=== STARTING PLAYBACK ===')

          // Create brand new audio context
          actions.initializeAudioContext()

          if (!self.audioContext) {
            console.error('Failed to create audio context')
            return
          }

          // Use the existing recreateAudioGraph method
          yield actions.recreateAudioGraph()

          self.isPlaying = true
          console.log('Playback started')
        }
      }),

      addMicrophoneInput: flow(function* (position: { x: number; y: number }) {
        console.log('=== ADDING MICROPHONE INPUT ===')

        try {
          // Request microphone access
          const stream = yield navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              autoGainControl: false,
              noiseSuppression: false,
            },
          })

          if (!self.audioContext) {
            actions.initializeAudioContext()
          }

          if (!self.audioContext) {
            throw new Error('Failed to initialize audio context')
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

          // Create the visual node with MST-compatible structure
          const visualNode = {
            id: nodeId,
            type: 'audioNode',
            position: {
              x: position.x,
              y: position.y,
            },
            data: {
              nodeType: 'MediaStreamAudioSourceNode',
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
              properties: {},
            },
          }

          // Add to store using MST action
          self.visualNodes.push(visualNode)

          // Store the actual audio node
          self.audioNodes.set(nodeId, micSource)

          // Store the media stream
          self.mediaStreams.set(nodeId, stream)

          console.log('Microphone input added successfully with ID:', nodeId)
          return nodeId
        } catch (error) {
          console.error('Error adding microphone input:', error)
          throw error
        }
      }),
    }

    return actions
  })
  .views(self => ({
    get selectedNode() {
      return self.selectedNodeId
        ? self.visualNodes.find(node => node.id === self.selectedNodeId)
        : undefined
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
  }))

export type AudioGraphStoreType = Instance<typeof AudioGraphStore>

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

      // Use setTimeout to batch patches that happen in the same tick
      setTimeout(() => {
        if (patchRecorder.length > 0) {
          // Add to undo stack using store action
          store.addToUndoStack({
            forward: patchRecorder.map(p => p.forward),
            inverse: patchRecorder.map(p => p.inverse).reverse(),
          })
        }

        isRecording = false
        patchRecorder = []
      }, 0)
    }

    // Record the patch
    patchRecorder.push({ forward: patch, inverse: reversePatch })
  })

  // Undo/redo actions are now properly implemented in the MST model

  return store
}

// React Context for the store
export const AudioGraphStoreContext = createContext<AudioGraphStoreType | null>(null)

export const useAudioGraphStore = () => {
  const store = useContext(AudioGraphStoreContext)
  if (!store) {
    throw new Error('useAudioGraphStore must be used within an AudioGraphStoreProvider')
  }
  return store
}
