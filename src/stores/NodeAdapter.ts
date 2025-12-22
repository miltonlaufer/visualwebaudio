import { types, getParent, Instance, getRoot } from 'mobx-state-tree'
import { reaction } from 'mobx'
import { IAudioGraphStore } from './AudioGraphStore'
import { INodeMetadata } from './NodeModels'
// Import the JSON metadata directly to check WebAudio nodes
import webAudioMetadataJson from '~/types/web-audio-metadata.json'

// Get WebAudio metadata directly
const getWebAudioMetadata = (): Record<string, INodeMetadata> => {
  return webAudioMetadataJson as unknown as Record<string, INodeMetadata>
}

// Base interface for all node implementations
export interface INodeImplementation {
  id: string
  nodeType: string

  // Lifecycle methods
  initialize(): void
  cleanup(): void

  // Property management
  updateProperty(name: string, value: any): void
  getProperty(name: string): any

  // Connection management
  connect(targetId: string, sourceOutput: string, targetInput: string): void
  disconnect(targetId: string, sourceOutput: string, targetInput: string): void

  // Audio-specific methods (optional)
  start?(): void
  stop?(): void
}

// Adapter model that abstracts common node functionality
export const NodeAdapter = types
  .model('NodeAdapter', {
    id: types.identifier,
    nodeType: types.string,
    position: types.model({
      x: types.number,
      y: types.number,
    }),
    metadata: types.model('NodeMetadata', {
      name: types.string,
      description: types.string,
      category: types.enumeration([
        'source',
        'effect',
        'destination',
        'analysis',
        'processing',
        'context',
        'control',
        'logic',
        'input',
        'utility',
        'misc',
        'composite',
        'user-composite',
      ]),
      inputs: types.array(
        types.model('NodeInput', {
          name: types.string,
          type: types.enumeration(['audio', 'control']),
        })
      ),
      outputs: types.array(
        types.model('NodeOutput', {
          name: types.string,
          type: types.enumeration(['audio', 'control']),
        })
      ),
      properties: types.array(
        types.model('NodeProperty', {
          name: types.string,
          type: types.string,
          defaultValue: types.frozen(),
          min: types.maybe(types.number),
          max: types.maybe(types.number),
          step: types.maybe(types.number),
          options: types.maybe(types.array(types.frozen())),
          description: types.maybe(types.string),
        })
      ),
      methods: types.array(types.string),
      events: types.array(types.string),
    }),
    properties: types.map(types.frozen()),
    // React Flow specific properties
    type: types.optional(types.string, 'audioNode'),
    selected: types.optional(types.boolean, false),
    dragging: types.optional(types.boolean, false),
    // Connection state
    inputConnections: types.array(
      types.model('Connection', {
        sourceNodeId: types.string,
        sourceOutput: types.string,
        targetInput: types.string,
      })
    ),
    outputConnections: types.array(
      types.model('Connection', {
        targetNodeId: types.string,
        sourceOutput: types.string,
        targetInput: types.string,
      })
    ),
    // Audio node creation state (for test compatibility)
    audioNodeCreated: types.optional(types.boolean, false),
  })
  .volatile(() => ({
    // Node implementation instance (WebAudio or Custom)
    implementation: null as INodeImplementation | null,
    // Property reaction disposer
    propertyReactionDisposer: null as (() => void) | null,
    // Initialization state
    isInitialized: false,
  }))
  .views(self => ({
    get root(): IAudioGraphStore {
      try {
        // Try to get parent first (AudioGraphStore), fall back to root if needed
        const parent = getParent(self, 1)
        return parent as IAudioGraphStore
      } catch {
        // If getParent fails, fall back to getRoot and try to access audioGraph
        const root = getRoot(self) as any
        if (root && root.audioGraph) {
          return root.audioGraph as IAudioGraphStore
        }
        // Last resort - return root itself (this might not work but at least won't crash)
        return root as IAudioGraphStore
      }
    },

    get isWebAudioNode(): boolean {
      // Check if this node type exists in the WebAudio metadata (not the combined metadata)
      // This uses the dynamically generated metadata from TypeScript definitions
      try {
        const webAudioMetadata = getWebAudioMetadata()
        return self.nodeType in webAudioMetadata
      } catch (error) {
        // Fallback for cases where metadata is not available
        console.warn(`[NodeAdapter] Could not access webAudioMetadata for ${self.nodeType}:`, error)
        return false
      }
    },

    get isCustomNode(): boolean {
      // Custom nodes are all nodes that are NOT WebAudio nodes
      // This ensures we don't need to maintain a separate hardcoded list
      return !this.isWebAudioNode
    },

    get isAttached(): boolean {
      // Check if the node is properly attached/initialized
      return self.isInitialized && self.implementation !== null
    },

    get reactFlowData() {
      return {
        nodeType: self.nodeType,
        metadata: {
          name: self.metadata.name,
          description: self.metadata.description,
          category: self.metadata.category,
          inputs: self.metadata.inputs.map(input => ({
            name: input.name,
            type: input.type,
          })),
          outputs: self.metadata.outputs.map(output => ({
            name: output.name,
            type: output.type,
          })),
          properties: self.metadata.properties.map(prop => ({
            name: prop.name,
            type: prop.type,
            defaultValue: prop.defaultValue,
            min: prop.min,
            max: prop.max,
            step: prop.step,
            options: prop.options,
            description: prop.description,
          })),
          methods: self.metadata.methods.slice(),
          events: self.metadata.events.slice(),
        },
        properties: self.properties,
      }
    },
  }))
  .actions(self => {
    // Helper function to safely get the root store
    const getRootStore = (): IAudioGraphStore => {
      try {
        // Try to get parent first (AudioGraphStore), fall back to root if needed
        const parent = getParent(self, 1)
        return parent as IAudioGraphStore
      } catch {
        // If getParent fails, fall back to getRoot and try to access audioGraph
        const root = getRoot(self) as any
        if (root && root.audioGraph) {
          return root.audioGraph as IAudioGraphStore
        }
        // Last resort - return root itself (this might not work but at least won't crash)
        return root as IAudioGraphStore
      }
    }

    return {
      // Action to set the implementation
      setImplementation(implementation: INodeImplementation | null) {
        self.implementation = implementation
      },

      // Action to set initialization state
      setInitialized(value: boolean) {
        self.isInitialized = value
      },

      // Action to set audio node creation state
      setAudioNodeCreated(value: boolean) {
        self.audioNodeCreated = value
      },

      // Initialize the node with its implementation
      initialize() {
        if (self.isInitialized) return

        try {
          const root = getRootStore()

          // Ensure properties is properly initialized as a Map
          if (!self.properties || typeof self.properties.get !== 'function') {
            console.warn(
              `[NodeAdapter] Properties not properly initialized as Map for node ${self.id}, reinitializing...`
            )
            // If properties is not a Map, we need to handle this case
            // This shouldn't happen in normal operation, but let's be defensive
          }

          // Check if root has the required methods (defensive programming)
          // The store might not be fully initialized yet, so we'll handle missing methods gracefully
          const hasCreateAudioNode =
            root && root.createAudioNode && typeof root.createAudioNode === 'function'
          if (!hasCreateAudioNode) {
            console.warn(
              `[NodeAdapter] Root store missing createAudioNode method for node ${self.id} - store may not be fully initialized yet`
            )
            // Don't return early - still set up the implementation
            // The reaction will handle audio node creation when store is ready
          }

          if (self.isWebAudioNode) {
            // Don't create audio nodes here - let the AudioGraphStore reaction system handle it
            // This prevents duplicate audio node creation conflicts
            this.setImplementation({
              id: self.id,
              nodeType: self.nodeType,
              initialize: () => {},
              cleanup: () => {
                try {
                  const currentRoot = getRootStore()
                  if (
                    currentRoot &&
                    currentRoot.cleanupAudioNode &&
                    typeof currentRoot.cleanupAudioNode === 'function'
                  ) {
                    currentRoot.cleanupAudioNode(self.id)
                  }
                } catch (error) {
                  console.warn(
                    `[NodeAdapter] Error during cleanup for WebAudio node ${self.id}:`,
                    error
                  )
                }
              },
              updateProperty: (name: string, value: any) => {
                try {
                  // Don't call back to root.updateNodeProperty to avoid circular dependency
                  // The NodeAdapter.updateProperty already handles the property update
                  // Just handle the audio-specific property updates here

                  // Add null checking for properties
                  if (!self.properties) {
                    console.warn(
                      `[NodeAdapter] Properties not initialized for node ${self.id} during updateProperty`
                    )
                    return
                  }

                  const root = getRootStore()
                  if (!root || !root.audioNodes) {
                    console.warn(
                      `[NodeAdapter] Root store or audioNodes not available for node ${self.id}`
                    )
                    return
                  }

                  const audioNode = root.audioNodes.get(self.id)

                  if (audioNode && root.audioNodeFactory) {
                    const metadata = root.webAudioMetadata[self.nodeType] as INodeMetadata
                    if (metadata) {
                      root.audioNodeFactory.updateNodeProperty(
                        audioNode,
                        self.nodeType,
                        metadata,
                        name,
                        value
                      )
                    }
                  }
                } catch (error) {
                  console.error(
                    `[NodeAdapter] Error in WebAudio updateProperty for node ${self.id}:`,
                    error
                  )
                }
              },
              getProperty: (name: string) => {
                try {
                  if (!self.properties) {
                    console.warn(`[NodeAdapter] Properties not initialized for node ${self.id}`)
                    return undefined
                  }

                  // Handle both Map and plain object cases
                  if (typeof self.properties.get === 'function') {
                    return self.properties.get(name) || undefined
                  } else if (typeof self.properties === 'object') {
                    // Fallback for plain object (shouldn't happen but let's be safe)
                    return (self.properties as any)[name] || undefined
                  } else {
                    console.error(
                      `[NodeAdapter] Properties is not a Map or object for node ${self.id}:`,
                      self.properties
                    )
                    return undefined
                  }
                } catch (error) {
                  console.error(
                    `[NodeAdapter] Error getting property ${name} for node ${self.id}:`,
                    error
                  )
                  return undefined
                }
              },
              connect: (targetId: string, sourceOutput: string, targetInput: string) => {
                try {
                  const currentRoot = getParent(self) as IAudioGraphStore
                  if (
                    currentRoot &&
                    currentRoot.connectAudioNodes &&
                    typeof currentRoot.connectAudioNodes === 'function'
                  ) {
                    currentRoot.connectAudioNodes(self.id, targetId, sourceOutput, targetInput)
                  }
                } catch (error) {
                  console.warn(
                    `[NodeAdapter] Error connecting WebAudio node ${self.id} to ${targetId}:`,
                    error
                  )
                }
              },
              disconnect: (targetId: string) => {
                try {
                  const currentRoot = getParent(self) as IAudioGraphStore
                  if (
                    currentRoot &&
                    currentRoot.disconnectAudioNodes &&
                    typeof currentRoot.disconnectAudioNodes === 'function'
                  ) {
                    currentRoot.disconnectAudioNodes(self.id, targetId)
                  }
                } catch (error) {
                  console.warn(
                    `[NodeAdapter] Error disconnecting WebAudio node ${self.id} from ${targetId}:`,
                    error
                  )
                }
              },
              start: () => {
                try {
                  const currentRoot = getParent(self) as IAudioGraphStore
                  if (currentRoot && currentRoot.audioNodes && currentRoot.audioNodes.get) {
                    const audioNode = currentRoot.audioNodes.get(self.id)
                    if (
                      audioNode &&
                      'start' in audioNode &&
                      typeof audioNode.start === 'function'
                    ) {
                      ;(audioNode as any).start()
                    }
                  }
                } catch (error) {
                  console.warn(`[NodeAdapter] Error starting WebAudio node ${self.id}:`, error)
                  // Report to error queue for AI feedback
                  const root = getParent(self) as IAudioGraphStore
                  root?.reportError?.({
                    category: 'audio',
                    severity: 'error',
                    message: `Failed to start node: ${error instanceof Error ? error.message : String(error)}`,
                    nodeId: self.id,
                    nodeType: self.nodeType,
                    details: { action: 'start' },
                  })
                }
              },
              stop: () => {
                try {
                  const currentRoot = getParent(self) as IAudioGraphStore
                  if (currentRoot && currentRoot.audioNodes && currentRoot.audioNodes.get) {
                    const audioNode = currentRoot.audioNodes.get(self.id)
                    if (audioNode && 'stop' in audioNode && typeof audioNode.stop === 'function') {
                      ;(audioNode as any).stop()
                    }
                  }
                } catch (error) {
                  console.warn(`[NodeAdapter] Error stopping WebAudio node ${self.id}:`, error)
                  // Report to error queue for AI feedback
                  const root = getParent(self) as IAudioGraphStore
                  root?.reportError?.({
                    category: 'audio',
                    severity: 'error',
                    message: `Failed to stop node: ${error instanceof Error ? error.message : String(error)}`,
                    nodeId: self.id,
                    nodeType: self.nodeType,
                    details: { action: 'stop' },
                  })
                }
              },
            })
          } else if (self.isCustomNode) {
            // Don't create audio nodes here - let the AudioGraphStore reaction system handle it
            // This prevents duplicate audio node creation conflicts
            this.setImplementation({
              id: self.id,
              nodeType: self.nodeType,
              initialize: () => {},
              cleanup: () => {
                try {
                  const currentRoot = getParent(self) as IAudioGraphStore
                  if (
                    currentRoot &&
                    currentRoot.cleanupAudioNode &&
                    typeof currentRoot.cleanupAudioNode === 'function'
                  ) {
                    currentRoot.cleanupAudioNode(self.id)
                  }
                } catch (error) {
                  console.warn(
                    `[NodeAdapter] Error during cleanup for Custom node ${self.id}:`,
                    error
                  )
                }
              },
              updateProperty: () => {
                try {
                  // Custom nodes don't need audio-specific property updates
                  // The NodeAdapter.updateProperty already handles the property update
                  // Custom nodes handle their own property logic in their components

                  // Add null checking for properties
                  if (!self.properties) {
                    console.warn(
                      `[NodeAdapter] Properties not initialized for node ${self.id} during updateProperty`
                    )
                    return
                  }
                } catch (error) {
                  console.error(
                    `[NodeAdapter] Error in Custom updateProperty for node ${self.id}:`,
                    error
                  )
                }
              },
              getProperty: (name: string) => {
                try {
                  if (!self.properties) {
                    console.warn(`[NodeAdapter] Properties not initialized for node ${self.id}`)
                    return undefined
                  }

                  // Handle both Map and plain object cases
                  if (typeof self.properties.get === 'function') {
                    return self.properties.get(name) || undefined
                  } else if (typeof self.properties === 'object') {
                    // Fallback for plain object (shouldn't happen but let's be safe)
                    return (self.properties as any)[name] || undefined
                  } else {
                    console.error(
                      `[NodeAdapter] Properties is not a Map or object for node ${self.id}:`,
                      self.properties
                    )
                    return undefined
                  }
                } catch (error) {
                  console.error(
                    `[NodeAdapter] Error getting property ${name} for node ${self.id}:`,
                    error
                  )
                  return undefined
                }
              },
              connect: (targetId: string, sourceOutput: string, targetInput: string) => {
                try {
                  const currentRoot = getParent(self) as IAudioGraphStore
                  if (
                    currentRoot &&
                    currentRoot.connectAudioNodes &&
                    typeof currentRoot.connectAudioNodes === 'function'
                  ) {
                    currentRoot.connectAudioNodes(self.id, targetId, sourceOutput, targetInput)
                  }
                } catch (error) {
                  console.warn(
                    `[NodeAdapter] Error connecting Custom node ${self.id} to ${targetId}:`,
                    error
                  )
                }
              },
              disconnect: (targetId: string) => {
                try {
                  const currentRoot = getParent(self) as IAudioGraphStore
                  if (
                    currentRoot &&
                    currentRoot.disconnectAudioNodes &&
                    typeof currentRoot.disconnectAudioNodes === 'function'
                  ) {
                    currentRoot.disconnectAudioNodes(self.id, targetId)
                  }
                } catch (error) {
                  console.warn(
                    `[NodeAdapter] Error disconnecting Custom node ${self.id} from ${targetId}:`,
                    error
                  )
                }
              },
            })
          }

          this.setInitialized(true)
          this.setupPropertyReaction()
        } catch (error) {
          console.error(`[NodeAdapter] Failed to initialize node ${self.id}:`, error)
          this.setInitialized(false)
        }
      },

      // Clean up the node
      cleanup() {
        if (self.propertyReactionDisposer) {
          self.propertyReactionDisposer()
          self.propertyReactionDisposer = null
        }

        if (self.implementation) {
          self.implementation.cleanup()
          this.setImplementation(null)
        }

        this.setInitialized(false)
      },

      // Update a property
      updateProperty(name: string, value: any) {
        if (!self.properties) {
          console.warn(`[NodeAdapter] Properties not initialized for node ${self.id}`)
          // Report to error queue for AI feedback
          const root = getParent(self) as IAudioGraphStore
          root?.reportError?.({
            category: 'property',
            severity: 'warning',
            message: `Properties not initialized for node`,
            nodeId: self.id,
            nodeType: self.nodeType,
            details: { propertyName: name },
          })
          return
        }

        try {
          self.properties.set(name, value)
        } catch (error) {
          console.error(`[NodeAdapter] Error setting property ${name} for node ${self.id}:`, error)
          // Report to error queue for AI feedback
          const root = getParent(self) as IAudioGraphStore
          root?.reportError?.({
            category: 'property',
            severity: 'error',
            message: `Failed to set property ${name}: ${error instanceof Error ? error.message : String(error)}`,
            nodeId: self.id,
            nodeType: self.nodeType,
            details: { propertyName: name, value },
          })
          return
        }

        if (self.implementation) {
          try {
            self.implementation.updateProperty(name, value)
          } catch (error) {
            console.error(
              `[NodeAdapter] Error updating implementation property ${name} for node ${self.id}:`,
              error
            )
          }
        }
      },

      // Update position
      updatePosition(x: number, y: number) {
        self.position.x = x
        self.position.y = y
      },

      // Add input connection
      addInputConnection(sourceNodeId: string, sourceOutput: string, targetInput: string) {
        const existing = self.inputConnections.find(
          conn =>
            conn.sourceNodeId === sourceNodeId &&
            conn.sourceOutput === sourceOutput &&
            conn.targetInput === targetInput
        )

        if (!existing) {
          self.inputConnections.push({
            sourceNodeId,
            sourceOutput,
            targetInput,
          })
        }
      },

      // Remove input connection
      removeInputConnection(sourceNodeId: string, sourceOutput: string, targetInput: string) {
        const index = self.inputConnections.findIndex(
          conn =>
            conn.sourceNodeId === sourceNodeId &&
            conn.sourceOutput === sourceOutput &&
            conn.targetInput === targetInput
        )

        if (index !== -1) {
          self.inputConnections.splice(index, 1)
        }
      },

      // Add output connection
      addOutputConnection(targetNodeId: string, sourceOutput: string, targetInput: string) {
        const existing = self.outputConnections.find(
          conn =>
            conn.targetNodeId === targetNodeId &&
            conn.sourceOutput === sourceOutput &&
            conn.targetInput === targetInput
        )

        if (!existing) {
          self.outputConnections.push({
            targetNodeId,
            sourceOutput,
            targetInput,
          })
        }
      },

      // Remove output connection
      removeOutputConnection(targetNodeId: string, sourceOutput: string, targetInput: string) {
        const index = self.outputConnections.findIndex(
          conn =>
            conn.targetNodeId === targetNodeId &&
            conn.sourceOutput === sourceOutput &&
            conn.targetInput === targetInput
        )

        if (index !== -1) {
          self.outputConnections.splice(index, 1)
        }
      },

      // Connect to another node
      connectTo(targetNodeId: string, sourceOutput: string, targetInput: string) {
        if (self.implementation) {
          self.implementation.connect(targetNodeId, sourceOutput, targetInput)
        }

        this.addOutputConnection(targetNodeId, sourceOutput, targetInput)

        // Also update the target node's input connections
        const root = getParent(self) as IAudioGraphStore
        const targetNode = root.adaptedNodes.find(node => node.id === targetNodeId)
        if (targetNode && 'addInputConnection' in targetNode) {
          ;(targetNode as any).addInputConnection(self.id, sourceOutput, targetInput)
        }
      },

      // Disconnect from another node
      disconnectFrom(targetNodeId: string, sourceOutput: string, targetInput: string) {
        if (self.implementation) {
          self.implementation.disconnect(targetNodeId, sourceOutput, targetInput)
        }

        this.removeOutputConnection(targetNodeId, sourceOutput, targetInput)

        // Also update the target node's input connections
        const root = getParent(self) as IAudioGraphStore
        const targetNode = root.adaptedNodes.find(node => node.id === targetNodeId)
        if (targetNode && 'removeInputConnection' in targetNode) {
          ;(targetNode as any).removeInputConnection(self.id, sourceOutput, targetInput)
        }
      },

      // Set up property synchronization reaction
      setupPropertyReaction() {
        if (self.propertyReactionDisposer) {
          self.propertyReactionDisposer()
        }

        const disposer = reaction(
          () => {
            try {
              if (!self.properties) return null

              // Make a safe copy to avoid race conditions
              const properties = self.properties
              if (!properties || !properties.size) return null

              const props: Record<string, any> = {}
              properties.forEach((value, key) => {
                props[key] = value
              })
              return props
            } catch (error) {
              console.error(`[NodeAdapter] Error accessing properties for ${self.id}:`, error)
              return null
            }
          },
          (props: Record<string, any> | null) => {
            if (!props || !self.implementation) return

            try {
              // Double-check that properties still exist before syncing
              if (!self.properties) {
                console.warn(
                  `[NodeAdapter] Properties became undefined during sync for node ${self.id}`
                )
                return
              }

              Object.entries(props).forEach(([name, value]) => {
                if (self.implementation) {
                  try {
                    self.implementation.updateProperty(name, value)
                  } catch (innerError) {
                    console.error(
                      `[NodeAdapter] Error updating property ${name} for node ${self.id}:`,
                      innerError
                    )
                  }
                }
              })
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              if (!errorMessage.includes('no longer part of a state tree')) {
                console.error(`[NodeAdapter] Error syncing properties for ${self.id}:`, error)
              }
            }
          },
          {
            fireImmediately: false,
            equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
          }
        )

        self.propertyReactionDisposer = disposer
      },

      // Lifecycle hooks
      afterCreate() {
        // Initialize after creation
        this.initialize()
      },

      beforeDestroy() {
        // Cleanup before destruction
        this.cleanup()

        // Also cleanup the audio node from the root store
        try {
          const root = getParent(self) as IAudioGraphStore
          if (root && root.cleanupAudioNode) {
            root.cleanupAudioNode(self.id)
          }
        } catch (error) {
          console.error(`[NodeAdapter] Error cleaning up audio node ${self.id}:`, error)
        }
      },
    }
  })

export interface INodeAdapter extends Instance<typeof NodeAdapter> {}
