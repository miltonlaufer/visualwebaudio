/**
 * Graph Store
 *
 * Manages the graph topology (nodes and edges) without audio concerns.
 * This is a facade that provides a clean API for graph operations.
 *
 * Note: For backward compatibility, this store delegates to AudioGraphStore
 * which still contains the core implementation. Future refactoring will
 * gradually move logic here.
 */

import { types, Instance, getRoot } from 'mobx-state-tree'
import type { IRootStore } from './RootStore'
import type { INodeAdapter } from './NodeAdapter'

/******************* TYPES ***********************/

export interface Position {
  x: number
  y: number
}

export interface NodeCreateOptions {
  nodeType: string
  position: Position
  properties?: Record<string, unknown>
}

export interface ConnectionOptions {
  sourceId: string
  targetId: string
  sourceOutput: string
  targetInput: string
}

/******************* MODEL ***********************/

export const GraphStore = types
  .model('GraphStore', {
    // Graph state is stored in AudioGraphStore for backward compatibility
    // This store provides a clean facade API
  })
  .views(self => ({
    get root(): IRootStore {
      return getRoot(self) as IRootStore
    },

    get audioGraph() {
      return this.root.audioGraph
    },

    /******************* NODE VIEWS ***********************/

    get nodes(): INodeAdapter[] {
      return this.audioGraph.adaptedNodes.slice()
    },

    get nodeCount(): number {
      return this.audioGraph.adaptedNodes.length
    },

    getNode(nodeId: string): INodeAdapter | undefined {
      return this.audioGraph.adaptedNodes.find(n => n.id === nodeId)
    },

    getNodesByType(nodeType: string): INodeAdapter[] {
      return this.audioGraph.adaptedNodes.filter(n => n.nodeType === nodeType)
    },

    /******************* EDGE VIEWS ***********************/

    get edges() {
      return this.audioGraph.visualEdges.slice()
    },

    get edgeCount(): number {
      return this.audioGraph.visualEdges.length
    },

    getEdgesForNode(nodeId: string) {
      return this.audioGraph.visualEdges.filter(e => e.source === nodeId || e.target === nodeId)
    },

    /******************* CONNECTION VIEWS ***********************/

    get connections() {
      return this.audioGraph.audioConnections.slice()
    },

    isConnected(sourceId: string, targetId: string): boolean {
      return this.audioGraph.audioConnections.some(
        c => c.sourceNodeId === sourceId && c.targetNodeId === targetId
      )
    },
  }))
  .actions(self => ({
    /******************* NODE ACTIONS ***********************/

    addNode(options: NodeCreateOptions): INodeAdapter | undefined {
      // addAdaptedNode returns the node ID, not the node itself
      const nodeId = self.audioGraph.addAdaptedNode(options.nodeType, options.position)

      // Find the created node
      const node = self.audioGraph.adaptedNodes.find(n => n.id === nodeId)

      // Apply initial properties if provided
      if (node && options.properties) {
        Object.entries(options.properties).forEach(([key, value]) => {
          self.audioGraph.updateNodeProperty(nodeId, key, value)
        })
      }

      return node
    },

    removeNode(nodeId: string): void {
      self.audioGraph.removeNode(nodeId)
    },

    updateNodePosition(nodeId: string, position: Position): void {
      self.audioGraph.updateNodePosition(nodeId, position)
    },

    updateNodeProperty(nodeId: string, propertyName: string, value: unknown): void {
      self.audioGraph.updateNodeProperty(nodeId, propertyName, value)
    },

    /******************* CONNECTION ACTIONS ***********************/

    connect(options: ConnectionOptions): void {
      self.audioGraph.addEdge(
        options.sourceId,
        options.targetId,
        options.sourceOutput,
        options.targetInput
      )
    },

    disconnect(sourceId: string, targetId: string): void {
      // Find and remove the connection
      const edge = self.audioGraph.visualEdges.find(
        e => e.source === sourceId && e.target === targetId
      )
      if (edge) {
        self.audioGraph.removeEdge(edge.id)
      }
    },

    /******************* BULK ACTIONS ***********************/

    clear(): void {
      self.audioGraph.clearAllNodes()
    },
  }))

export interface IGraphStore extends Instance<typeof GraphStore> {}
