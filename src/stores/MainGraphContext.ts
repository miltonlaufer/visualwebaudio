/**
 * Main Graph Context
 *
 * Adapter that wraps AudioGraphStore to implement IGraphContext interface.
 * This allows the main graph to be used with shared graph components.
 */

import type { Node, Edge } from '@xyflow/react'
import type { IGraphContext, IUndoManager, Position, ClipboardData } from './GraphContext'
import { audioGraphStore } from './RootStore'
import { rootStore } from './RootStore'
import { autoLayoutNodes } from '~/utils/autoLayout'

/******************* MAIN GRAPH CONTEXT ***********************/

class MainGraphContext implements IGraphContext {
  /******************* GETTERS ***********************/

  get nodes(): Node[] {
    return audioGraphStore.adaptedNodes.map(node => ({
      id: node.id,
      type: 'adaptedNode',
      position: { x: node.position.x, y: node.position.y },
      data: { nodeAdapter: node } as Record<string, unknown>,
    }))
  }

  get edges(): Edge[] {
    return audioGraphStore.visualEdges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined,
    }))
  }

  get selectedNodeIds(): string[] {
    return rootStore.selectedNodeId ? [rootStore.selectedNodeId] : []
  }

  get selectedEdgeIds(): string[] {
    // Main graph doesn't track selected edges in the store
    return []
  }

  get isReadOnly(): boolean {
    return false
  }

  get undoManager(): IUndoManager {
    return {
      canUndo: audioGraphStore.canUndo,
      canRedo: audioGraphStore.canRedo,
      undo: () => rootStore.undo(),
      redo: () => rootStore.redo(),
    }
  }

  get canPaste(): boolean {
    return audioGraphStore.canPaste
  }

  get clipboardData(): ClipboardData | null {
    const nodes = audioGraphStore.clipboardNodes
    const edges = audioGraphStore.clipboardEdges

    if (!nodes || nodes.length === 0) return null

    return {
      nodes: nodes.map((n: any) => ({
        id: n.id,
        nodeType: n.nodeType,
        position: n.position,
        properties: n.properties || {},
        metadata: n.metadata,
      })),
      edges: edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    }
  }

  /******************* NODE OPERATIONS ***********************/

  addNode(nodeType: string, position: Position): string {
    return audioGraphStore.addAdaptedNode(nodeType, position)
  }

  removeNode(nodeId: string): void {
    audioGraphStore.removeNode(nodeId)
  }

  removeNodes(nodeIds: string[]): void {
    for (const nodeId of nodeIds) {
      audioGraphStore.removeNode(nodeId)
    }
  }

  updateNodePosition(nodeId: string, position: Position): void {
    audioGraphStore.updateNodePosition(nodeId, position)
  }

  selectNode(nodeId: string): void {
    rootStore.selectNode(nodeId)
  }

  deselectAll(): void {
    rootStore.selectNode(undefined)
  }

  /******************* EDGE OPERATIONS ***********************/

  addEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string): string {
    audioGraphStore.addEdge(source, target, sourceHandle || 'output', targetHandle || 'input')
    // Return a generated edge ID since addEdge doesn't return one
    return `e_${source}_${target}_${Date.now()}`
  }

  removeEdge(edgeId: string): void {
    audioGraphStore.removeEdge(edgeId)
  }

  removeEdges(edgeIds: string[]): void {
    for (const edgeId of edgeIds) {
      audioGraphStore.removeEdge(edgeId)
    }
  }

  /******************* CLIPBOARD OPERATIONS ***********************/

  copyNodes(nodeIds: string[]): void {
    audioGraphStore.copySelectedNodes(nodeIds)
  }

  cutNodes(nodeIds: string[]): void {
    audioGraphStore.cutSelectedNodes(nodeIds)
  }

  pasteNodes(): string[] {
    // pasteNodes is async, but we need sync behavior here
    // The actual paste happens asynchronously
    audioGraphStore.pasteNodes()
    return [] // Return empty array, actual node IDs are managed by the store
  }

  /******************* UNDO/REDO OPERATIONS ***********************/

  undo(): void {
    rootStore.undo()
  }

  redo(): void {
    rootStore.redo()
  }

  /******************* LAYOUT OPERATIONS ***********************/

  autoLayout(direction: 'LR' | 'TB' | 'RL' | 'BT' = 'LR'): void {
    const layoutNodes = audioGraphStore.adaptedNodes.map(node => ({
      id: node.id,
      width: 280,
      height: 200,
    }))

    const layoutEdges = audioGraphStore.visualEdges.map(edge => ({
      source: edge.source,
      target: edge.target,
    }))

    const newPositions = autoLayoutNodes(layoutNodes, layoutEdges, { direction })

    for (const pos of newPositions) {
      audioGraphStore.updateNodePosition(pos.id, { x: pos.x, y: pos.y })
    }
  }
}

/******************* SINGLETON INSTANCE ***********************/

export const mainGraphContext = new MainGraphContext()
