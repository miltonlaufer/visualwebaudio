/**
 * Composite Graph Context
 *
 * Adapter that wraps CompositeEditorStore to implement IGraphContext interface.
 * This allows the composite editor to be used with shared graph components.
 */

import type { Node, Edge } from '@xyflow/react'
import type {
  IGraphContext,
  IUndoManager,
  Position,
  ClipboardData,
  ClipboardNode,
  ClipboardEdge,
} from './GraphContext'
import { autoLayoutNodes } from '~/utils/autoLayout'

/******************* TYPES ***********************/

type SetNodesFunction = (updater: Node[] | ((prev: Node[]) => Node[])) => void
type SetEdgesFunction = (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void

/******************* COMPOSITE GRAPH CONTEXT ***********************/

/**
 * CompositeGraphContext manages the state of the composite node editor.
 * Unlike MainGraphContext which wraps an existing MST store, this context
 * manages its own local state for the editor session.
 */
export class CompositeGraphContext implements IGraphContext {
  private _nodes: Node[] = []
  private _edges: Edge[] = []
  private _selectedNodeIds: string[] = []
  private _selectedEdgeIds: string[] = []
  private _isReadOnly: boolean = false
  private _clipboardNodes: ClipboardNode[] = []
  private _clipboardEdges: ClipboardEdge[] = []
  private _undoStack: { nodes: Node[]; edges: Edge[] }[] = []
  private _redoStack: { nodes: Node[]; edges: Edge[] }[] = []
  private _setNodes: SetNodesFunction | null = null
  private _setEdges: SetEdgesFunction | null = null
  private _nodeIdCounter: number = 0

  /******************* INITIALIZATION ***********************/

  /**
   * Initialize the context with React state setters
   */
  initialize(
    nodes: Node[],
    edges: Edge[],
    setNodes: SetNodesFunction,
    setEdges: SetEdgesFunction,
    isReadOnly: boolean = false
  ): void {
    this._nodes = nodes
    this._edges = edges
    this._setNodes = setNodes
    this._setEdges = setEdges
    this._isReadOnly = isReadOnly
    this._undoStack = []
    this._redoStack = []
  }

  /**
   * Update the current state (called when React state changes)
   */
  updateState(nodes: Node[], edges: Edge[]): void {
    this._nodes = nodes
    this._edges = edges
  }

  /**
   * Set selection state
   */
  setSelection(nodeIds: string[], edgeIds: string[]): void {
    this._selectedNodeIds = nodeIds
    this._selectedEdgeIds = edgeIds
  }

  /******************* GETTERS ***********************/

  get nodes(): Node[] {
    return this._nodes
  }

  get edges(): Edge[] {
    return this._edges
  }

  get selectedNodeIds(): string[] {
    return this._selectedNodeIds
  }

  get selectedEdgeIds(): string[] {
    return this._selectedEdgeIds
  }

  get isReadOnly(): boolean {
    return this._isReadOnly
  }

  get undoManager(): IUndoManager {
    return {
      canUndo: this._undoStack.length > 0,
      canRedo: this._redoStack.length > 0,
      undo: () => this.undo(),
      redo: () => this.redo(),
    }
  }

  get canPaste(): boolean {
    return this._clipboardNodes.length > 0
  }

  get clipboardData(): ClipboardData | null {
    if (this._clipboardNodes.length === 0) return null
    return {
      nodes: this._clipboardNodes,
      edges: this._clipboardEdges,
    }
  }

  /******************* PRIVATE HELPERS ***********************/

  private saveUndoState(): void {
    if (this._isReadOnly) return

    this._undoStack.push({
      nodes: JSON.parse(JSON.stringify(this._nodes)),
      edges: JSON.parse(JSON.stringify(this._edges)),
    })
    this._redoStack = [] // Clear redo stack on new action

    // Limit undo stack size
    if (this._undoStack.length > 50) {
      this._undoStack.shift()
    }
  }

  private applyState(state: { nodes: Node[]; edges: Edge[] }): void {
    this._nodes = state.nodes
    this._edges = state.edges
    this._setNodes?.(state.nodes)
    this._setEdges?.(state.edges)
  }

  /******************* NODE OPERATIONS ***********************/

  addNode(nodeType: string, position: Position): string {
    if (this._isReadOnly) return ''

    this.saveUndoState()

    const nodeId = `internal_${nodeType}_${Date.now()}_${this._nodeIdCounter++}`

    const newNode: Node = {
      id: nodeId,
      type: 'internalNode',
      position,
      data: {
        nodeType,
        properties: new Map(),
      },
    }

    const newNodes = [...this._nodes, newNode]
    this._nodes = newNodes
    this._setNodes?.(newNodes)

    return nodeId
  }

  removeNode(nodeId: string): void {
    if (this._isReadOnly) return

    this.saveUndoState()

    // Remove node
    const newNodes = this._nodes.filter(n => n.id !== nodeId)
    this._nodes = newNodes
    this._setNodes?.(newNodes)

    // Remove connected edges
    const newEdges = this._edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    this._edges = newEdges
    this._setEdges?.(newEdges)
  }

  removeNodes(nodeIds: string[]): void {
    if (this._isReadOnly || nodeIds.length === 0) return

    this.saveUndoState()

    const nodeIdSet = new Set(nodeIds)

    // Remove nodes
    const newNodes = this._nodes.filter(n => !nodeIdSet.has(n.id))
    this._nodes = newNodes
    this._setNodes?.(newNodes)

    // Remove connected edges
    const newEdges = this._edges.filter(e => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target))
    this._edges = newEdges
    this._setEdges?.(newEdges)
  }

  updateNodePosition(nodeId: string, position: Position): void {
    // Don't save undo state for position changes (too frequent)
    const newNodes = this._nodes.map(n => (n.id === nodeId ? { ...n, position } : n))
    this._nodes = newNodes
    this._setNodes?.(newNodes)
  }

  selectNode(nodeId: string): void {
    this._selectedNodeIds = [nodeId]
  }

  deselectAll(): void {
    this._selectedNodeIds = []
    this._selectedEdgeIds = []
  }

  /******************* EDGE OPERATIONS ***********************/

  addEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string): string {
    if (this._isReadOnly) return ''

    this.saveUndoState()

    const edgeId = `e_${source}_${target}_${Date.now()}`

    const newEdge: Edge = {
      id: edgeId,
      source,
      target,
      sourceHandle: sourceHandle || 'output',
      targetHandle: targetHandle || 'input',
    }

    const newEdges = [...this._edges, newEdge]
    this._edges = newEdges
    this._setEdges?.(newEdges)

    return edgeId
  }

  removeEdge(edgeId: string): void {
    if (this._isReadOnly) return

    this.saveUndoState()

    const newEdges = this._edges.filter(e => e.id !== edgeId)
    this._edges = newEdges
    this._setEdges?.(newEdges)
  }

  removeEdges(edgeIds: string[]): void {
    if (this._isReadOnly || edgeIds.length === 0) return

    this.saveUndoState()

    const edgeIdSet = new Set(edgeIds)
    const newEdges = this._edges.filter(e => !edgeIdSet.has(e.id))
    this._edges = newEdges
    this._setEdges?.(newEdges)
  }

  /******************* CLIPBOARD OPERATIONS ***********************/

  copyNodes(nodeIds: string[]): void {
    const nodesToCopy = this._nodes.filter(n => nodeIds.includes(n.id))

    if (nodesToCopy.length === 0) return

    // Get edges between copied nodes
    const nodeIdSet = new Set(nodeIds)
    const edgesToCopy = this._edges.filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))

    this._clipboardNodes = nodesToCopy.map(n => ({
      id: n.id,
      nodeType: (n.data as any)?.nodeType || 'unknown',
      position: { ...n.position },
      properties: {},
    }))

    this._clipboardEdges = edgesToCopy.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
    }))
  }

  cutNodes(nodeIds: string[]): void {
    this.copyNodes(nodeIds)
    this.removeNodes(nodeIds)
  }

  pasteNodes(): string[] {
    if (this._isReadOnly || this._clipboardNodes.length === 0) return []

    this.saveUndoState()

    const PASTE_OFFSET = 50
    const idMap = new Map<string, string>()
    const newNodeIds: string[] = []

    // Create new nodes with offset positions
    const newNodes = this._clipboardNodes.map(clipNode => {
      const newId = `internal_${clipNode.nodeType}_${Date.now()}_${this._nodeIdCounter++}`
      idMap.set(clipNode.id, newId)
      newNodeIds.push(newId)

      return {
        id: newId,
        type: 'internalNode',
        position: {
          x: clipNode.position.x + PASTE_OFFSET,
          y: clipNode.position.y + PASTE_OFFSET,
        },
        data: {
          nodeType: clipNode.nodeType,
          properties: new Map(Object.entries(clipNode.properties)),
        },
      }
    })

    // Create new edges with updated IDs
    const newEdges = this._clipboardEdges.map(clipEdge => ({
      id: `e_${idMap.get(clipEdge.source)}_${idMap.get(clipEdge.target)}_${Date.now()}`,
      source: idMap.get(clipEdge.source)!,
      target: idMap.get(clipEdge.target)!,
      sourceHandle: clipEdge.sourceHandle,
      targetHandle: clipEdge.targetHandle,
    }))

    const updatedNodes = [...this._nodes, ...newNodes]
    const updatedEdges = [...this._edges, ...newEdges]

    this._nodes = updatedNodes
    this._edges = updatedEdges
    this._setNodes?.(updatedNodes)
    this._setEdges?.(updatedEdges)

    return newNodeIds
  }

  /******************* UNDO/REDO OPERATIONS ***********************/

  undo(): void {
    if (this._isReadOnly || this._undoStack.length === 0) return

    // Save current state to redo stack
    this._redoStack.push({
      nodes: JSON.parse(JSON.stringify(this._nodes)),
      edges: JSON.parse(JSON.stringify(this._edges)),
    })

    // Restore previous state
    const previousState = this._undoStack.pop()!
    this.applyState(previousState)
  }

  redo(): void {
    if (this._isReadOnly || this._redoStack.length === 0) return

    // Save current state to undo stack
    this._undoStack.push({
      nodes: JSON.parse(JSON.stringify(this._nodes)),
      edges: JSON.parse(JSON.stringify(this._edges)),
    })

    // Restore next state
    const nextState = this._redoStack.pop()!
    this.applyState(nextState)
  }

  /******************* LAYOUT OPERATIONS ***********************/

  autoLayout(direction: 'LR' | 'TB' | 'RL' | 'BT' = 'LR'): void {
    if (this._isReadOnly) return

    this.saveUndoState()

    // Filter out edge connector nodes for layout
    const internalNodes = this._nodes.filter(n => n.type === 'internalNode')

    const layoutNodes = internalNodes.map(node => ({
      id: node.id,
      width: 200,
      height: 140,
    }))

    // Only include edges between internal nodes
    const internalNodeIds = new Set(internalNodes.map(n => n.id))
    const layoutEdges = this._edges
      .filter(e => internalNodeIds.has(e.source) && internalNodeIds.has(e.target))
      .map(edge => ({
        source: edge.source,
        target: edge.target,
      }))

    const newPositions = autoLayoutNodes(layoutNodes, layoutEdges, { direction })

    // Create position map
    const positionMap = new Map(newPositions.map(p => [p.id, { x: p.x, y: p.y }]))

    // Update internal node positions, keep edge connectors in place
    const updatedNodes = this._nodes.map(node => {
      if (node.type === 'internalNode') {
        const newPos = positionMap.get(node.id)
        if (newPos) {
          return { ...node, position: { x: newPos.x + 180, y: newPos.y } }
        }
      }
      return node
    })

    this._nodes = updatedNodes
    this._setNodes?.(updatedNodes)
  }

  /******************* CLEANUP ***********************/

  /**
   * Reset the context state
   */
  reset(): void {
    this._nodes = []
    this._edges = []
    this._selectedNodeIds = []
    this._selectedEdgeIds = []
    this._clipboardNodes = []
    this._clipboardEdges = []
    this._undoStack = []
    this._redoStack = []
    this._setNodes = null
    this._setEdges = null
  }
}

/******************* SINGLETON INSTANCE ***********************/

export const compositeGraphContext = new CompositeGraphContext()
