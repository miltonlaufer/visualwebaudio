/**
 * Graph Context Interface
 *
 * Provides a unified interface for graph operations that can be used
 * by both the main graph (AudioGraphStore) and composite editor (CompositeEditorStore).
 * This allows shared components like BaseFlowCanvas to work with either context.
 */

import type { Node, Edge } from '@xyflow/react'

/******************* TYPES ***********************/

export interface Position {
  x: number
  y: number
}

export interface ClipboardData {
  nodes: ClipboardNode[]
  edges: ClipboardEdge[]
}

export interface ClipboardNode {
  id: string
  nodeType: string
  position: Position
  properties: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface ClipboardEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

/******************* UNDO MANAGER INTERFACE ***********************/

export interface IUndoManager {
  canUndo: boolean
  canRedo: boolean
  undo(): void
  redo(): void
}

/******************* GRAPH CONTEXT INTERFACE ***********************/

/**
 * Interface for graph operations that both main graph and composite editor implement.
 * This allows shared components to work with either context without knowing the specifics.
 */
export interface IGraphContext {
  /******************* GETTERS ***********************/

  /** Get all nodes in the graph */
  readonly nodes: Node[]

  /** Get all edges in the graph */
  readonly edges: Edge[]

  /** Get selected node IDs */
  readonly selectedNodeIds: string[]

  /** Get selected edge IDs */
  readonly selectedEdgeIds: string[]

  /** Check if the context is read-only */
  readonly isReadOnly: boolean

  /** Get the undo manager for this context */
  readonly undoManager: IUndoManager | null

  /** Check if clipboard has data to paste */
  readonly canPaste: boolean

  /** Get clipboard data */
  readonly clipboardData: ClipboardData | null

  /******************* NODE OPERATIONS ***********************/

  /** Add a node to the graph */
  addNode(nodeType: string, position: Position): string

  /** Remove a node from the graph */
  removeNode(nodeId: string): void

  /** Remove multiple nodes from the graph */
  removeNodes(nodeIds: string[]): void

  /** Update a node's position */
  updateNodePosition(nodeId: string, position: Position): void

  /** Select a node */
  selectNode(nodeId: string): void

  /** Deselect all nodes */
  deselectAll(): void

  /******************* EDGE OPERATIONS ***********************/

  /** Add an edge between two nodes */
  addEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string): string

  /** Remove an edge */
  removeEdge(edgeId: string): void

  /** Remove multiple edges */
  removeEdges(edgeIds: string[]): void

  /******************* CLIPBOARD OPERATIONS ***********************/

  /** Copy selected nodes to clipboard */
  copyNodes(nodeIds: string[]): void

  /** Cut selected nodes (copy + delete) */
  cutNodes(nodeIds: string[]): void

  /** Paste nodes from clipboard */
  pasteNodes(): string[]

  /******************* UNDO/REDO OPERATIONS ***********************/

  /** Undo last action */
  undo(): void

  /** Redo last undone action */
  redo(): void

  /******************* LAYOUT OPERATIONS ***********************/

  /** Auto-layout all nodes */
  autoLayout(direction?: 'LR' | 'TB' | 'RL' | 'BT'): void
}

/******************* CONTEXT TYPE ***********************/

export type GraphContextType = 'main' | 'composite'

/******************* NULL UNDO MANAGER ***********************/

/**
 * Null object pattern for undo manager when undo/redo is not available
 */
export const NullUndoManager: IUndoManager = {
  canUndo: false,
  canRedo: false,
  undo: () => {},
  redo: () => {},
}
