import { types, Instance, getSnapshot, applySnapshot } from 'mobx-state-tree'
import { AudioGraphStore, createAudioGraphStore } from './AudioGraphStore'
import { customNodeStore } from './CustomNodeStore'

// Version migration functions
const migrations = {
  '1.0.0': (data: any) => {
    // No migration needed for 1.0.0 (current version)
    return data
  },

  '1.1.0': (data: any) => {
    // Convert old VisualNodeModel structure to NodeAdapter format
    if (data.audioGraph && data.audioGraph.adaptedNodes) {
      data.audioGraph.adaptedNodes = data.audioGraph.adaptedNodes.map((node: any) => {
        // Convert old format: { id, type, position, data: { nodeType, metadata, properties } }
        // To new format: { id, nodeType, position, metadata, properties, type, selected, dragging, inputConnections, outputConnections }
        if (node.data && node.data.nodeType && !node.nodeType) {
          return {
            id: node.id,
            nodeType: node.data.nodeType,
            position: node.position || { x: 0, y: 0 },
            metadata: node.data.metadata || {
              name: node.data.nodeType,
              description: '',
              category: 'misc',
              inputs: [],
              outputs: [],
              properties: [],
              methods: [],
              events: [],
            },
            properties: node.data.properties || new Map(),
            type: node.type || 'audioNode',
            selected: node.selected || false,
            dragging: node.dragging || false,
            inputConnections: [],
            outputConnections: [],
          }
        }
        return node
      })
    }

    // Also handle direct adaptedNodes array (legacy format)
    if (data.adaptedNodes && !data.audioGraph) {
      data.audioGraph = {
        adaptedNodes: data.adaptedNodes.map((node: any) => {
          if (node.data && node.data.nodeType && !node.nodeType) {
            return {
              id: node.id,
              nodeType: node.data.nodeType,
              position: node.position || { x: 0, y: 0 },
              metadata: node.data.metadata || {
                name: node.data.nodeType,
                description: '',
                category: 'misc',
                inputs: [],
                outputs: [],
                properties: [],
                methods: [],
                events: [],
              },
              properties: node.data.properties || new Map(),
              type: node.type || 'audioNode',
              selected: node.selected || false,
              dragging: node.dragging || false,
              inputConnections: [],
              outputConnections: [],
            }
          }
          return node
        }),
        visualEdges: data.visualEdges || [],
        audioConnections: data.audioConnections || [],
        selectedNodeId: data.selectedNodeId,
        isPlaying: false,
        undoStack: [],
        redoStack: [],
        propertyChangeCounter: 0,
        graphChangeCounter: 0,
        isProjectModified: false,
      }
    }

    return data
  },
}

// Current version
export const CURRENT_VERSION = '1.1.0'

// Root store model
export const RootStore = types
  .model('RootStore', {
    version: types.optional(types.string, CURRENT_VERSION),
    audioGraph: AudioGraphStore,
    // Add other stores here as needed
    // ui: UIStore,
    // settings: SettingsStore,
  })
  .volatile(() => ({
    // Non-serializable state
    isInitialized: false,
  }))
  .views(self => ({
    get isLatestVersion(): boolean {
      return self.version === CURRENT_VERSION
    },

    get needsMigration(): boolean {
      return self.version !== CURRENT_VERSION
    },
  }))

  .actions(self => {
    const actions = {
      // Initialize the root store
      initialize() {
        if (self.isInitialized) return

        // Initialize audio graph
        self.audioGraph.init()

        self.isInitialized = true
      },

      // Set up the audio graph with patch middleware
      setupAudioGraphWithPatchMiddleware(audioGraphInstance: any) {
        ;(self as any).audioGraph = audioGraphInstance
      },

      // Update version
      updateVersion(version: string) {
        self.version = version
      },

      // Migrate data from older versions
      migrateData(data: any): any {
        let migratedData = { ...data }

        // Determine starting version
        const dataVersion = data.version || '1.0.0'

        // Apply migrations in sequence
        const versionKeys = Object.keys(migrations).sort()
        const startIndex = versionKeys.indexOf(dataVersion)

        if (startIndex === -1) {
          console.warn(`Unknown version ${dataVersion}, treating as latest`)
          return migratedData
        }

        // Apply each migration from the data version to current
        for (let i = startIndex + 1; i < versionKeys.length; i++) {
          const version = versionKeys[i]
          const migrationFn = migrations[version as keyof typeof migrations]

          if (migrationFn) {
            console.warn(`Migrating data from ${versionKeys[i - 1]} to ${version}`)
            migratedData = migrationFn(migratedData)
            migratedData.version = version
          }
        }

        return migratedData
      },

      // Load project data with migration support
      loadProject(projectData: any) {
        try {
          // Migrate data if needed
          const migratedData = actions.migrateData(projectData)

          // Extract audio graph data
          const audioGraphData = migratedData.audioGraph || {
            adaptedNodes: migratedData.adaptedNodes || [],
            visualEdges: migratedData.visualEdges || [],
            audioConnections: migratedData.audioConnections || [],
            selectedNodeId: undefined,
            isPlaying: false,
            undoStack: [],
            redoStack: [],
            propertyChangeCounter: 0,
            graphChangeCounter: 0,
            isProjectModified: false,
          }

          // Apply to audio graph store
          applySnapshot(self.audioGraph, audioGraphData)

          // Apply custom nodes if available
          if (migratedData.customNodes) {
            const customNodeSnapshot = {
              nodes: migratedData.customNodes,
            }
            applySnapshot(customNodeStore, customNodeSnapshot)
          }

          // Update version
          self.version = migratedData.version || CURRENT_VERSION

          // Initialize after loading
          self.audioGraph.init()

          console.warn(`Project loaded successfully (version: ${self.version})`)
        } catch (error) {
          console.error('Failed to load project:', error)
          throw error
        }
      },

      // Export project data with current version
      exportProject() {
        const audioGraphSnapshot = getSnapshot(self.audioGraph)
        const customNodeSnapshot = getSnapshot(customNodeStore)

        return {
          version: CURRENT_VERSION,
          timestamp: new Date().toISOString(),
          audioGraph: audioGraphSnapshot,
          customNodes: customNodeSnapshot.nodes,
          // Legacy format for backward compatibility
          adaptedNodes: audioGraphSnapshot.adaptedNodes,
          visualEdges: audioGraphSnapshot.visualEdges,
          audioConnections: audioGraphSnapshot.audioConnections,
        }
      },

      // Clear all data
      clearAll() {
        self.audioGraph.clearAllNodes()
        self.version = CURRENT_VERSION
      },

      // Reset to initial state
      reset() {
        actions.clearAll()
        self.isInitialized = false
      },

      // Lifecycle hooks
      afterCreate() {
        // Auto-initialize after creation
        actions.initialize()
      },
    }

    return actions
  })

export interface IRootStore extends Instance<typeof RootStore> {}

// Create the audio graph store with proper patch middleware for undo/redo
const audioGraphStoreInstance = createAudioGraphStore()

// Create and export the root store instance
export const rootStore = RootStore.create({
  audioGraph: getSnapshot(audioGraphStoreInstance),
})

// Use the action to replace the audioGraph with the factory-created instance that has patch middleware
rootStore.setupAudioGraphWithPatchMiddleware(audioGraphStoreInstance)

// Export the audio graph store for backward compatibility
export const audioGraphStore = rootStore.audioGraph
