/**
 * Composite Node Definition Store
 *
 * Manages both prebuilt and user-defined composite node definitions.
 * Prebuilt definitions are loaded from JSON, user definitions from IndexedDB.
 */

import { types, Instance, flow, getSnapshot } from 'mobx-state-tree'
import { compositeNodeOperations, type SavedCompositeNode } from '~/utils/database'
import { generateCompositeNodeId } from '~/utils/idGenerator'
import type {
  CompositeNodePort,
  CompositeNodeInternalGraph,
  CompositeNodeDefinition,
} from '~/types'

/******************* MST MODELS ***********************/

const CompositeNodePortModel = types.model('CompositeNodePort', {
  id: types.string,
  name: types.string,
  type: types.string, // 'audio' | 'control' - using string for flexibility
  description: types.optional(types.string, ''),
})

const SerializedNodePropertyModel = types.model('SerializedNodeProperty', {
  name: types.string,
  value: types.frozen(),
})

const SerializedNodeModel = types.model('SerializedNode', {
  id: types.string,
  nodeType: types.string,
  position: types.model({
    x: types.number,
    y: types.number,
  }),
  properties: types.array(SerializedNodePropertyModel),
})

const SerializedEdgeModel = types.model('SerializedEdge', {
  id: types.string,
  source: types.string,
  target: types.string,
  sourceHandle: types.optional(types.string, ''),
  targetHandle: types.optional(types.string, ''),
})

const SerializedConnectionModel = types.model('SerializedConnection', {
  sourceNodeId: types.string,
  targetNodeId: types.string,
  sourceOutput: types.string,
  targetInput: types.string,
})

const CompositeNodeInternalGraphModel = types.model('CompositeNodeInternalGraph', {
  nodes: types.array(SerializedNodeModel),
  edges: types.array(SerializedEdgeModel),
  connections: types.array(SerializedConnectionModel),
})

const CompositeNodeDefinitionModel = types
  .model('CompositeNodeDefinition', {
    id: types.identifier,
    name: types.string,
    description: types.string,
    category: types.enumeration(['composite', 'user-composite']),
    isPrebuilt: types.boolean,
    inputs: types.array(CompositeNodePortModel),
    outputs: types.array(CompositeNodePortModel),
    internalGraph: CompositeNodeInternalGraphModel,
    dbId: types.maybe(types.number), // Database ID for user-created nodes
  })
  .views(self => ({
    get inputNames(): string[] {
      return self.inputs.map(input => input.name)
    },
    get outputNames(): string[] {
      return self.outputs.map(output => output.name)
    },
    get audioInputs() {
      return self.inputs.filter(input => input.type === 'audio')
    },
    get controlInputs() {
      return self.inputs.filter(input => input.type === 'control')
    },
    get audioOutputs() {
      return self.outputs.filter(output => output.type === 'audio')
    },
    get controlOutputs() {
      return self.outputs.filter(output => output.type === 'control')
    },
  }))

/******************* STORE ***********************/

const CompositeNodeDefinitionStore = types
  .model('CompositeNodeDefinitionStore', {
    definitions: types.map(CompositeNodeDefinitionModel),
    isLoaded: types.optional(types.boolean, false),
    isLoading: types.optional(types.boolean, false),
    error: types.maybe(types.string),
  })
  .views(self => ({
    /******************* COMPUTED ***********************/

    get allDefinitions(): CompositeNodeDefinition[] {
      return Array.from(self.definitions.values()) as unknown as CompositeNodeDefinition[]
    },

    get prebuiltDefinitions(): CompositeNodeDefinition[] {
      return this.allDefinitions.filter(def => def.isPrebuilt)
    },

    get userDefinitions(): CompositeNodeDefinition[] {
      return this.allDefinitions.filter(def => !def.isPrebuilt)
    },

    get definitionCount(): number {
      return self.definitions.size
    },

    getDefinition(id: string): CompositeNodeDefinition | undefined {
      return self.definitions.get(id) as unknown as CompositeNodeDefinition | undefined
    },

    getDefinitionByName(name: string): CompositeNodeDefinition | undefined {
      return this.allDefinitions.find(def => def.name === name)
    },

    hasDefinition(id: string): boolean {
      return self.definitions.has(id)
    },

    /**
     * Get node types for registration with NodeRegistry
     */
    get compositeNodeTypes(): string[] {
      return this.allDefinitions.map(def => `Composite_${def.id}`)
    },
  }))
  .actions(self => {
    /******************* INTERNAL ACTIONS ***********************/

    const setLoading = (loading: boolean) => {
      self.isLoading = loading
    }

    const setLoaded = (loaded: boolean) => {
      self.isLoaded = loaded
    }

    const setError = (error: string | undefined) => {
      self.error = error
    }

    const addDefinitionInternal = (definition: CompositeNodeDefinition, dbId?: number) => {
      const modelData = {
        ...definition,
        dbId,
        inputs: definition.inputs.map(input => ({
          ...input,
          description: input.description || '',
        })),
        outputs: definition.outputs.map(output => ({
          ...output,
          description: output.description || '',
        })),
        internalGraph: {
          nodes: definition.internalGraph.nodes.map(node => ({
            ...node,
            properties: node.properties.map(prop => ({
              name: prop.name,
              value: prop.value,
            })),
          })),
          edges: definition.internalGraph.edges.map(edge => ({
            ...edge,
            sourceHandle: edge.sourceHandle || '',
            targetHandle: edge.targetHandle || '',
          })),
          connections: definition.internalGraph.connections,
        },
      }
      self.definitions.set(definition.id, modelData)
    }

    /******************* PUBLIC ACTIONS ***********************/

    return {
      /**
       * Load prebuilt definitions from JSON
       */
      loadPrebuiltDefinitions(prebuiltDefs: CompositeNodeDefinition[]): void {
        prebuiltDefs.forEach(def => {
          addDefinitionInternal({
            ...def,
            isPrebuilt: true,
            category: 'composite',
          })
        })
      },

      /**
       * Load user definitions from IndexedDB
       */
      loadUserDefinitions: flow(function* () {
        setLoading(true)
        setError(undefined)

        try {
          const savedNodes: SavedCompositeNode[] =
            yield compositeNodeOperations.getAllCompositeNodes()

          savedNodes.forEach((saved: SavedCompositeNode) => {
            const internalGraph: CompositeNodeInternalGraph = JSON.parse(saved.internalGraph)

            const definition: CompositeNodeDefinition = {
              id: saved.definitionId,
              name: saved.name,
              description: saved.description,
              category: 'user-composite',
              isPrebuilt: false,
              inputs: saved.inputs,
              outputs: saved.outputs,
              internalGraph,
              createdAt: saved.createdAt,
              updatedAt: saved.updatedAt,
            }

            addDefinitionInternal(definition, saved.id)
          })

          setLoaded(true)
        } catch (error) {
          console.error('Failed to load user composite nodes:', error)
          setError((error as Error).message)
        } finally {
          setLoading(false)
        }
      }),

      /**
       * Initialize store - load both prebuilt and user definitions
       */
      initialize: flow(function* (prebuiltDefs: CompositeNodeDefinition[]) {
        // Load prebuilt first (synchronous)
        prebuiltDefs.forEach(def => {
          addDefinitionInternal({
            ...def,
            isPrebuilt: true,
            category: 'composite',
          })
        })

        // Then load user definitions from IndexedDB
        setLoading(true)
        setError(undefined)

        try {
          const savedNodes: SavedCompositeNode[] =
            yield compositeNodeOperations.getAllCompositeNodes()

          savedNodes.forEach((saved: SavedCompositeNode) => {
            const internalGraph: CompositeNodeInternalGraph = JSON.parse(saved.internalGraph)

            const definition: CompositeNodeDefinition = {
              id: saved.definitionId,
              name: saved.name,
              description: saved.description,
              category: 'user-composite',
              isPrebuilt: false,
              inputs: saved.inputs,
              outputs: saved.outputs,
              internalGraph,
              createdAt: saved.createdAt,
              updatedAt: saved.updatedAt,
            }

            addDefinitionInternal(definition, saved.id)
          })

          setLoaded(true)
        } catch (error) {
          console.error('Failed to load user composite nodes:', error)
          setError((error as Error).message)
        } finally {
          setLoading(false)
        }
      }),

      /**
       * Save a new user-defined composite node
       */
      saveCompositeNode: flow(function* (
        name: string,
        description: string,
        inputs: CompositeNodePort[],
        outputs: CompositeNodePort[],
        internalGraph: CompositeNodeInternalGraph
      ) {
        setError(undefined)

        try {
          // Generate unique ID
          const definitionId = generateCompositeNodeId()

          // Save to IndexedDB
          const dbId: number = yield compositeNodeOperations.saveCompositeNode(
            definitionId,
            name,
            description,
            inputs,
            outputs,
            JSON.stringify(internalGraph)
          )

          // Add to store
          const definition: CompositeNodeDefinition = {
            id: definitionId,
            name,
            description,
            category: 'user-composite',
            isPrebuilt: false,
            inputs,
            outputs,
            internalGraph,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          addDefinitionInternal(definition, dbId)

          return definitionId
        } catch (error) {
          console.error('Failed to save composite node:', error)
          setError((error as Error).message)
          throw error
        }
      }),

      /**
       * Save as new (create copy with new name)
       */
      saveAsCompositeNode: flow(function* (
        originalId: string,
        newName: string,
        newDescription?: string
      ) {
        const original = self.definitions.get(originalId)
        if (!original) {
          throw new Error(`Composite node ${originalId} not found`)
        }

        // Use getSnapshot to get plain JS objects from MST models
        // This avoids the "Cannot add an object to a state tree if it is already part of another state tree" error
        const originalSnapshot = getSnapshot(original)

        // Deep clone the internal graph
        const internalGraph: CompositeNodeInternalGraph = JSON.parse(
          JSON.stringify(originalSnapshot.internalGraph)
        )

        // Deep clone inputs and outputs
        const inputs: CompositeNodePort[] = JSON.parse(JSON.stringify(originalSnapshot.inputs))

        const outputs: CompositeNodePort[] = JSON.parse(JSON.stringify(originalSnapshot.outputs))

        setError(undefined)

        try {
          const definitionId = generateCompositeNodeId()

          const dbId: number = yield compositeNodeOperations.saveCompositeNode(
            definitionId,
            newName,
            newDescription || original.description,
            inputs,
            outputs,
            JSON.stringify(internalGraph)
          )

          const definition: CompositeNodeDefinition = {
            id: definitionId,
            name: newName,
            description: newDescription || original.description,
            category: 'user-composite',
            isPrebuilt: false,
            inputs,
            outputs,
            internalGraph,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          addDefinitionInternal(definition, dbId)

          return definitionId
        } catch (error) {
          console.error('Failed to save composite node as new:', error)
          setError((error as Error).message)
          throw error
        }
      }),

      /**
       * Update an existing user-defined composite node
       */
      updateCompositeNode: flow(function* (
        id: string,
        name: string,
        description: string,
        inputs: CompositeNodePort[],
        outputs: CompositeNodePort[],
        internalGraph: CompositeNodeInternalGraph
      ) {
        const existing = self.definitions.get(id)
        if (!existing) {
          throw new Error(`Composite node ${id} not found`)
        }

        if (existing.isPrebuilt) {
          throw new Error('Cannot modify prebuilt composite nodes')
        }

        const dbId = existing.dbId
        if (dbId === undefined) {
          throw new Error(`Composite node ${id} has no database ID`)
        }

        setError(undefined)

        try {
          // Update in IndexedDB
          yield compositeNodeOperations.updateCompositeNode(
            dbId,
            name,
            description,
            inputs,
            outputs,
            JSON.stringify(internalGraph)
          )

          // Update in store
          const definition: CompositeNodeDefinition = {
            id,
            name,
            description,
            category: 'user-composite',
            isPrebuilt: false,
            inputs,
            outputs,
            internalGraph,
            updatedAt: new Date(),
          }

          addDefinitionInternal(definition, dbId)
        } catch (error) {
          console.error('Failed to update composite node:', error)
          setError((error as Error).message)
          throw error
        }
      }),

      /**
       * Delete a user-defined composite node
       */
      deleteCompositeNode: flow(function* (id: string) {
        const existing = self.definitions.get(id)
        if (!existing) {
          throw new Error(`Composite node ${id} not found`)
        }

        if (existing.isPrebuilt) {
          throw new Error('Cannot delete prebuilt composite nodes')
        }

        const dbId = existing.dbId
        if (dbId === undefined) {
          throw new Error(`Composite node ${id} has no database ID`)
        }

        setError(undefined)

        try {
          // Delete from IndexedDB
          yield compositeNodeOperations.deleteCompositeNode(dbId)

          // Remove from store
          self.definitions.delete(id)
        } catch (error) {
          console.error('Failed to delete composite node:', error)
          setError((error as Error).message)
          throw error
        }
      }),

      /**
       * Clear all definitions (used for testing)
       */
      clear(): void {
        self.definitions.clear()
        setLoaded(false)
      },
    }
  })

/******************* INTERFACES ***********************/

export interface ICompositeNodeDefinition extends Instance<typeof CompositeNodeDefinitionModel> {}
export interface ICompositeNodeDefinitionStore
  extends Instance<typeof CompositeNodeDefinitionStore> {}

/******************* SINGLETON ***********************/

export const compositeNodeDefinitionStore = CompositeNodeDefinitionStore.create({
  definitions: {},
  isLoaded: false,
  isLoading: false,
})

export { CompositeNodeDefinitionStore, CompositeNodeDefinitionModel }
