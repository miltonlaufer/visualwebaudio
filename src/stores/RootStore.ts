import { types, Instance, getSnapshot, applySnapshot } from 'mobx-state-tree'
import { AudioGraphStore } from './AudioGraphStore'
import { customNodeStore } from './CustomNodeStore'
import { createContext, useContext } from 'react'

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
        history: {},
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
    // UI and project state properties moved from AudioGraphStore
    selectedNodeId: types.maybe(types.string),
    isPlaying: types.optional(types.boolean, false),
    // Add a counter to track property changes for React re-renders
    propertyChangeCounter: types.optional(types.number, 0),
    // Add a counter to track graph structure changes for React re-renders
    graphChangeCounter: types.optional(types.number, 0),
    // Track if the current project has been modified (default false for new projects)
    isProjectModified: types.optional(types.boolean, false),
    // Counter to force reactivity when node states change
    nodeStateChangeCounter: types.optional(types.number, 0),
    // Track if undo/redo is currently in progress to avoid marking project as modified
    isUndoRedoInProgress: types.optional(types.boolean, false),

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

    get selectedNode() {
      if (!self.selectedNodeId) return undefined
      return self.audioGraph.adaptedNodes.find(node => node.id === self.selectedNodeId)
    },

    get canUndo() {
      return self.audioGraph.canUndo
    },

    get canRedo() {
      return self.audioGraph.canRedo
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

      // Undo/Redo actions
      undo() {
        self.isUndoRedoInProgress = true
        try {
          self.audioGraph.undo()
        } finally {
          self.isUndoRedoInProgress = false
        }
      },

      redo() {
        self.isUndoRedoInProgress = true
        try {
          self.audioGraph.redo()
        } finally {
          self.isUndoRedoInProgress = false
        }
      },

      // UI state actions
      selectNode(nodeId: string | undefined) {
        self.selectedNodeId = nodeId
      },

      setIsPlaying(value: boolean) {
        self.isPlaying = value
      },

      setProjectModified(value: boolean) {
        self.isProjectModified = value
      },

      markProjectModified() {
        // Only mark as modified if we're not in the middle of undo/redo
        if (!self.isUndoRedoInProgress) {
          self.isProjectModified = true
        }
      },

      setUndoRedoInProgress(value: boolean) {
        self.isUndoRedoInProgress = value
      },

      forceRerender() {
        self.graphChangeCounter += 1
      },

      incrementPropertyChangeCounter() {
        self.propertyChangeCounter += 1
      },

      incrementNodeStateChangeCounter() {
        self.nodeStateChangeCounter += 1
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

          // Extract audio graph data (only core audio data)
          const audioGraphData = migratedData.audioGraph || {
            adaptedNodes: migratedData.adaptedNodes || [],
            visualEdges: migratedData.visualEdges || [],
            audioConnections: migratedData.audioConnections || [],
            history: {},
          }

          // Extract UI state (moved to RootStore)
          const uiState = {
            selectedNodeId: migratedData.audioGraph?.selectedNodeId || migratedData.selectedNodeId,
            isPlaying: migratedData.audioGraph?.isPlaying || migratedData.isPlaying || false,
            propertyChangeCounter:
              migratedData.audioGraph?.propertyChangeCounter ||
              migratedData.propertyChangeCounter ||
              0,
            graphChangeCounter:
              migratedData.audioGraph?.graphChangeCounter || migratedData.graphChangeCounter || 0,
            isProjectModified:
              migratedData.audioGraph?.isProjectModified || migratedData.isProjectModified || false,
            nodeStateChangeCounter:
              migratedData.audioGraph?.nodeStateChangeCounter ||
              migratedData.nodeStateChangeCounter ||
              0,
          }

          // Apply to audio graph store
          applySnapshot(self.audioGraph, audioGraphData)

          // Apply UI state to root store
          self.selectedNodeId = uiState.selectedNodeId
          self.isPlaying = uiState.isPlaying
          self.propertyChangeCounter = uiState.propertyChangeCounter
          self.graphChangeCounter = uiState.graphChangeCounter
          self.isProjectModified = uiState.isProjectModified
          self.nodeStateChangeCounter = uiState.nodeStateChangeCounter

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

        // Combine audio graph data with UI state for export
        const combinedAudioGraph = {
          ...audioGraphSnapshot,
          selectedNodeId: self.selectedNodeId,
          isPlaying: self.isPlaying,
          propertyChangeCounter: self.propertyChangeCounter,
          graphChangeCounter: self.graphChangeCounter,
          isProjectModified: self.isProjectModified,
          nodeStateChangeCounter: self.nodeStateChangeCounter,
        }

        return {
          version: CURRENT_VERSION,
          timestamp: new Date().toISOString(),
          audioGraph: combinedAudioGraph,
          customNodes: customNodeSnapshot.nodes,
          // Legacy format for backward compatibility
          adaptedNodes: audioGraphSnapshot.adaptedNodes,
          visualEdges: audioGraphSnapshot.visualEdges,
          audioConnections: audioGraphSnapshot.audioConnections,
          // UI state at root level for backward compatibility
          selectedNodeId: self.selectedNodeId,
          isPlaying: self.isPlaying,
          isProjectModified: self.isProjectModified,
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

// Create and export the root store instance
export const rootStore = RootStore.create({
  audioGraph: {
    history: {},
  },
})

// Export the audio graph store for backward compatibility
export const audioGraphStore = rootStore.audioGraph

// React Context for RootStore
export const RootStoreContext = createContext<IRootStore | null>(null)

export const useRootStore = () => {
  const store = useContext(RootStoreContext)
  if (!store) {
    // Fallback to global rootStore for backward compatibility
    return rootStore
  }
  return store
}
