import { types, getRoot, Instance } from 'mobx-state-tree'
import { reaction } from 'mobx'
import { IAudioGraphStore } from '~/stores/AudioGraphStore'

export const NodeInput = types.model('NodeInput', {
  name: types.string,
  type: types.enumeration(['audio', 'control']),
})

export const NodeOutput = types.model('NodeOutput', {
  name: types.string,
  type: types.enumeration(['audio', 'control']),
})

export const NodeProperty = types.model('NodeProperty', {
  name: types.string,
  type: types.string,
  defaultValue: types.frozen(),
  min: types.maybe(types.number),
  max: types.maybe(types.number),
  step: types.maybe(types.number),
  options: types.maybe(types.array(types.frozen())),
  description: types.maybe(types.string),
})

export const NodeMetadataModel = types.model('NodeMetadata', {
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
  ]),
  inputs: types.array(NodeInput),
  outputs: types.array(NodeOutput),
  properties: types.array(NodeProperty),
  methods: types.array(types.string),
  events: types.array(types.string),
})

export interface INodeMetadata extends Instance<typeof NodeMetadataModel> {}

export const VisualNodeData = types.model('VisualNodeData', {
  nodeType: types.string,
  metadata: NodeMetadataModel,
  properties: types.map(types.frozen()),
})

export const VisualNodeModel = types
  .model('VisualNode', {
    id: types.identifier,
    type: types.string,
    position: types.model({
      x: types.number,
      y: types.number,
    }),
    data: VisualNodeData,
    isAttached: types.optional(types.boolean, false),
  })
  .volatile(() => ({
    // Track if audio node has been created to avoid duplicate creation
    audioNodeCreated: false,
    // Store property reaction disposer
    propertyReactionDisposer: null as (() => void) | null,
  }))
  .views(self => ({
    get root(): IAudioGraphStore {
      return getRoot(self)
    },
  }))
  .actions(self => ({
    // Called after the node is attached to the tree
    afterAttach() {
      console.log(`[VisualNode afterAttach] Node ${self.id} attached to tree`)

      // Create the audio node immediately when attached to tree
      this.ensureAudioNodeExists()

      // Set up property synchronization reaction
      this.setupPropertyReaction()
      self.isAttached = true
    },

    // Called before the node is removed from the tree
    beforeDetach() {
      console.log(`[VisualNode beforeDetach] Node ${self.id} being detached`)

      // Clean up property reaction first to prevent accessing detached nodes
      if (self.propertyReactionDisposer) {
        self.propertyReactionDisposer()
        self.propertyReactionDisposer = null
      }

      // Clean up audio node
      this.cleanupAudioNode()
    },

    // Called before the node is destroyed
    beforeDestroy() {
      console.log(`[VisualNode beforeDestroy] Node ${self.id} being destroyed`)

      // Final cleanup - ensure reaction is disposed
      if (self.propertyReactionDisposer) {
        self.propertyReactionDisposer()
        self.propertyReactionDisposer = null
      }

      // Also clean up audio node here as a fallback
      this.cleanupAudioNode()
    },

    // Ensure audio node exists (idempotent)
    ensureAudioNodeExists() {
      if (self.audioNodeCreated) {
        console.log(`[VisualNode] Audio node for ${self.id} already exists`)
        return
      }

      try {
        //console.log(`[VisualNode] Creating audio node for ${self.id}`)
        self.root.createAudioNode(self.id, self.data.nodeType)
        self.audioNodeCreated = true
      } catch (error) {
        console.error(`[VisualNode] Error creating audio node for ${self.id}:`, error)
      }
    },

    // Clean up audio node
    cleanupAudioNode() {
      if (!self.audioNodeCreated) {
        return
      }

      try {
        const root = getRoot(self) as any
        if (root && root.cleanupAudioNode) {
          //console.log(`[VisualNode] Cleaning up audio node for ${self.id}`)
          root.cleanupAudioNode(self.id)
          self.audioNodeCreated = false
        }
      } catch (error) {
        console.error(`[VisualNode] Error cleaning up audio node ${self.id}:`, error)
      }
    },

    // Set up property synchronization reaction
    setupPropertyReaction() {
      // Clean up any existing reaction
      if (self.propertyReactionDisposer) {
        self.propertyReactionDisposer()
      }

      // Create reaction to sync properties to audio node
      const disposer = reaction(
        () => {
          try {
            // Check if node is still attached before accessing properties
            if (!self.data || !self.data.properties) {
              return null
            }

            // Create a snapshot of current properties
            const props: Record<string, any> = {}
            self.data.properties.forEach((value, key) => {
              props[key] = value
            })
            return props
          } catch (error) {
            console.error(`[VisualNode reaction] Error accessing properties for ${self.id}:`, error)
            // Node might be detached, return null to stop reaction
            return null
          }
        },
        (props: Record<string, any> | null) => {
          // Skip if props is null (node detached)
          if (!props) return

          try {
            const root = getRoot(self) as any
            if (root && root.syncAudioNodeProperties && self.audioNodeCreated) {
              //console.log(`[VisualNode reaction] Syncing properties for ${self.id}:`, props)
              root.syncAudioNodeProperties(self.id, props)
            }
          } catch (error) {
            // Ignore errors if node is being detached
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (!errorMessage.includes('no longer part of a state tree')) {
              console.error(`[VisualNode reaction] Error syncing properties for ${self.id}:`, error)
            }
          }
        },
        {
          fireImmediately: false,
          equals: (a, b) => JSON.stringify(a) === JSON.stringify(b), // Deep equality check
        }
      )

      self.propertyReactionDisposer = disposer
    },

    updateProperty(name: string, value: any) {
      self.data.properties.set(name, value)
    },

    updatePosition(x: number, y: number) {
      self.position.x = x
      self.position.y = y
    },
  }))

export const VisualEdgeModel = types.model('VisualEdge', {
  id: types.identifier,
  source: types.string,
  target: types.string,
  sourceHandle: types.maybe(types.string),
  targetHandle: types.maybe(types.string),
})

export const AudioConnectionModel = types.model('AudioConnection', {
  sourceNodeId: types.string,
  targetNodeId: types.string,
  sourceOutput: types.string,
  targetInput: types.string,
})
