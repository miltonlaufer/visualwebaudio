/**
 * Composite Editor Panel
 *
 * A slide-in panel for editing composite node internal graphs.
 *
 * Features:
 * - Edge-based connection points (inputs on left edge, outputs on right edge)
 * - Prominent description field
 * - Export/Import functionality for user nodes
 * - Drag & drop support from NodePalette
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { reaction } from 'mobx'
import {
  useNodesState,
  useEdgesState,
  Connection,
  ConnectionLineType,
  Edge,
  Node,
  NodeTypes,
  NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  compositeNodeDefinitionStore,
  type ICompositeNodeDefinition,
} from '~/stores/CompositeNodeDefinitionStore'
import { compositeEditorStore } from '~/stores/CompositeEditorStore'
import { useThemeStore } from '~/stores/ThemeStore'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import BaseFlowCanvas from './BaseFlowCanvas'
import { AutoLayoutPanelWithContext } from './AutoLayoutPanel'
import EdgeConnectorNode from './customNodes/EdgeConnectorNode'
import InternalNodeComponent from './customNodes/InternalNodeComponent'
import { useGraphUndoRedo } from '~/hooks/useGraphUndoRedo'
import { useCompositeEditorOperations } from '~/hooks/useCompositeEditorOperations'
import type {
  CompositeNodePort,
  CompositeNodeInternalGraph,
  SerializedNode,
  SerializedEdge,
  SerializedConnection,
} from '~/types'
import { autoLayoutNodes, type LayoutDirection } from '~/utils/autoLayout'

/******************* CONSTANTS ***********************/

const MAX_UNDO_HISTORY = 50
const PASTE_OFFSET = 50

/******************* TYPES ***********************/

interface CompositeEditorPanelProps {
  onSave?: (definitionId: string) => void
}

interface AddPortDialogState {
  isOpen: boolean
  direction: 'input' | 'output'
  name: string
  type: 'audio' | 'control'
}

/******************* NODE TYPES ***********************/

const editorNodeTypes: NodeTypes = {
  edgeConnector: EdgeConnectorNode,
  internalNode: InternalNodeComponent,
}

/******************* CONSTANTS ***********************/

// Position edge connectors at the canvas edges
const LEFT_EDGE_X = 5 // Just inside left edge
const RIGHT_EDGE_X = 850 // Near right edge (will need to adjust with canvas size)
const PORT_SPACING = 40
const PORT_START_Y = 30

/******************* COMPONENT ***********************/

const CompositeEditorPanel: React.FC<CompositeEditorPanelProps> = observer(({ onSave }) => {
  /******************* STORE ***********************/

  const themeStore = useThemeStore()
  const audioGraphStore = useAudioGraphStore()
  const isOpen = compositeEditorStore.isOpen
  const definitionId = compositeEditorStore.editingDefinitionId
  const isCreatingNew = compositeEditorStore.isCreatingNew
  const sourceNodeId = compositeEditorStore.sourceNodeId

  /******************* STATE ***********************/

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])

  const [nodeName, setNodeName] = useState('')
  const [nodeDescription, setNodeDescription] = useState('')
  const [inputs, setInputs] = useState<CompositeNodePort[]>([])
  const [outputs, setOutputs] = useState<CompositeNodePort[]>([])

  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [addPortDialog, setAddPortDialog] = useState<AddPortDialogState>({
    isOpen: false,
    direction: 'input',
    name: '',
    type: 'audio',
  })

  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nodeIdCounter = useRef(0)

  /******************* COMPUTED ***********************/

  const definition = useMemo((): ICompositeNodeDefinition | undefined => {
    if (!definitionId) return undefined
    return compositeNodeDefinitionStore.getDefinition(definitionId) as
      | ICompositeNodeDefinition
      | undefined
  }, [definitionId])

  const isPrebuilt = useMemo(() => {
    return definition?.isPrebuilt ?? false
  }, [definition?.isPrebuilt])

  const isDark = themeStore.isDarkMode

  // Use the undo/redo hook with external state management (integrates with useNodesState/useEdgesState)
  const {
    canUndo,
    canRedo,
    canPaste,
    saveUndoState,
    undo: hookUndo,
    redo: hookRedo,
    copy: hookCopy,
    cut: hookCut,
    paste: hookPaste,
  } = useGraphUndoRedo({
    maxHistory: MAX_UNDO_HISTORY,
    pasteOffset: PASTE_OFFSET,
    externalNodes: nodes,
    externalEdges: edges,
    externalSetNodes: setNodes,
    externalSetEdges: setEdges,
    generateNodeId: (_originalId, nodeType) =>
      `internal_${nodeType}_${Date.now()}_${nodeIdCounter.current++}`,
    generateEdgeId: (_originalId, source, target) => `e_${source}_${target}_${Date.now()}`,
  })

  // Register with unified keyboard handler (handles copy/paste/undo/redo/delete)
  useCompositeEditorOperations({
    isOpen,
    isReadOnly: isPrebuilt,
    nodes,
    edges,
    selectedNodeIds,
    selectedEdgeIds,
    setNodes,
    setEdges,
    saveUndoState,
    undo: hookUndo,
    redo: hookRedo,
    canUndo,
    canRedo,
    nodeIdCounter,
  })

  /******************* ADD NODE HANDLER ***********************/

  const addNodeToEditor = useCallback(
    (nodeType: string, position: { x: number; y: number }) => {
      // Save undo state before modifying
      saveUndoState()

      const newNodeId = `internal_${nodeType}_${Date.now()}_${nodeIdCounter.current++}`

      const newNode: Node = {
        id: newNodeId,
        type: 'internalNode',
        position,
        data: {
          nodeType,
          properties: new Map(),
        },
      }

      setNodes(prev => [...prev, newNode])
    },
    [setNodes, saveUndoState]
  )

  // Mark editor as ready/not ready based on prebuilt status
  useEffect(() => {
    if (isOpen && !isPrebuilt) {
      compositeEditorStore.setEditorReady(true)
    } else {
      compositeEditorStore.setEditorReady(false)
    }
    return () => {
      compositeEditorStore.setEditorReady(false)
    }
  }, [isOpen, isPrebuilt])

  // Use ref to avoid stale closure in reaction
  const addNodeRef = useRef(addNodeToEditor)
  useEffect(() => {
    addNodeRef.current = addNodeToEditor
  }, [addNodeToEditor])

  // Observe pending node requests via MobX reaction (event-based pattern)
  useEffect(() => {
    const dispose = reaction(
      () => compositeEditorStore.pendingNodeRequest,
      request => {
        if (request && !isPrebuilt) {
          // Handle the node request
          addNodeRef.current(request.nodeType, request.position)
          // Clear the request after processing
          compositeEditorStore.clearPendingNodeRequest()
        }
      }
    )
    return () => dispose()
  }, [isPrebuilt])

  /******************* SYNC EDGE CONNECTORS ***********************/

  const syncEdgeConnectors = useCallback(
    (currentInputs: CompositeNodePort[], currentOutputs: CompositeNodePort[]) => {
      setNodes(prev => {
        // Remove old edge connectors
        const internalNodes = prev.filter(n => n.type === 'internalNode')

        // Create new edge connectors for inputs
        const inputConnectors: Node[] = currentInputs.map((input, index) => ({
          id: `edge_input_${input.id}`,
          type: 'edgeConnector',
          position: { x: LEFT_EDGE_X, y: PORT_START_Y + index * PORT_SPACING },
          draggable: false,
          data: {
            portId: input.id,
            portName: input.name,
            portType: input.type,
            direction: 'input',
          },
        }))

        // Create new edge connectors for outputs
        const outputConnectors: Node[] = currentOutputs.map((output, index) => ({
          id: `edge_output_${output.id}`,
          type: 'edgeConnector',
          position: { x: RIGHT_EDGE_X, y: PORT_START_Y + index * PORT_SPACING },
          draggable: false,
          data: {
            portId: output.id,
            portName: output.name,
            portType: output.type,
            direction: 'output',
          },
        }))

        return [...inputConnectors, ...internalNodes, ...outputConnectors]
      })
    },
    [setNodes]
  )

  /******************* EFFECTS ***********************/

  // Initialize for new composite
  useEffect(() => {
    if (!isOpen) return

    if (isCreatingNew) {
      // Reset for new composite
      setNodeName('New Composite')
      setNodeDescription('')
      const defaultInputs = [{ id: 'input_default', name: 'input', type: 'audio' as const }]
      const defaultOutputs = [{ id: 'output_default', name: 'output', type: 'audio' as const }]
      setInputs(defaultInputs)
      setOutputs(defaultOutputs)
      setEdges([])

      // Create initial edge connectors
      syncEdgeConnectors(defaultInputs, defaultOutputs)
      return
    }

    if (!definition) return

    setNodeName(definition.name)
    setNodeDescription(definition.description)
    const defInputs = definition.inputs.map(i => ({
      id: i.id,
      name: i.name,
      type: i.type as 'audio' | 'control',
      description: i.description,
    }))
    const defOutputs = definition.outputs.map(o => ({
      id: o.id,
      name: o.name,
      type: o.type as 'audio' | 'control',
      description: o.description,
    }))
    setInputs(defInputs)
    setOutputs(defOutputs)

    // Build nodes from internal graph (with placeholder positions - will be auto-layouted)
    const internalNodesRaw = definition.internalGraph.nodes
      .filter(
        node => node.nodeType !== 'ExternalInputNode' && node.nodeType !== 'ExternalOutputNode'
      )
      .map(node => ({
        id: node.id,
        nodeType: node.nodeType,
        properties: new Map(node.properties.map(p => [p.name, p.value])),
      }))

    // Build edges for layout calculation
    const inputPortIds = new Set(defInputs.map(i => i.id))
    const outputPortIds = new Set(defOutputs.map(o => o.id))

    // For layout, we only consider edges between internal nodes
    // External inputs/outputs are handled separately
    const layoutEdges: { source: string; target: string }[] = []
    const internalNodeIds = new Set(internalNodesRaw.map(n => n.id))

    definition.internalGraph.edges.forEach(edge => {
      const source = edge.source
      const target = edge.target

      // Check if source is an external input
      const isSourceExternal = source.startsWith('ext_') || source.startsWith('ext_input_')
      // Check if target is an external output
      const isTargetExternal =
        (target.startsWith('ext_') && outputPortIds.has(target.replace('ext_', ''))) ||
        target.startsWith('ext_output_')

      // Only include edges between internal nodes for layout
      if (
        !isSourceExternal &&
        !isTargetExternal &&
        internalNodeIds.has(source) &&
        internalNodeIds.has(target)
      ) {
        layoutEdges.push({ source, target })
      }
    })

    // Prepare ONLY internal nodes for auto-layout (not edge connectors)
    const layoutNodes = internalNodesRaw.map(node => ({
      id: node.id,
      width: 200,
      height: 140,
    }))

    // Calculate auto-layout positions for internal nodes only
    const layoutResult = autoLayoutNodes(layoutNodes, layoutEdges, {
      direction: 'LR',
      nodeSpacingX: 120,
      nodeSpacingY: 60,
    })

    // Create position map from layout result
    const positionMap = new Map(layoutResult.map(r => [r.id, { x: r.x, y: r.y }]))

    // Calculate the bounding box of internal nodes to center everything
    let minY = Infinity,
      maxY = -Infinity
    for (const pos of layoutResult) {
      minY = Math.min(minY, pos.y)
      maxY = Math.max(maxY, pos.y + 140) // Add node height
    }
    const internalCenterY = (minY + maxY) / 2

    // Offset to shift internal nodes to the right (leave space for input connectors)
    const INTERNAL_OFFSET_X = 180

    // Create edge connectors - vertically centered and stacked
    const totalInputHeight = defInputs.length * PORT_SPACING
    const inputStartY = internalCenterY - totalInputHeight / 2

    const inputConnectors: Node[] = defInputs.map((input, index) => ({
      id: `edge_input_${input.id}`,
      type: 'edgeConnector',
      position: { x: LEFT_EDGE_X, y: inputStartY + index * PORT_SPACING },
      draggable: false,
      data: {
        portId: input.id,
        portName: input.name,
        portType: input.type,
        direction: 'input',
      },
    }))

    const totalOutputHeight = defOutputs.length * PORT_SPACING
    const outputStartY = internalCenterY - totalOutputHeight / 2

    // Find the rightmost internal node X position
    let maxInternalX = 0
    for (const pos of layoutResult) {
      maxInternalX = Math.max(maxInternalX, pos.x + 200) // Add node width
    }
    const outputX = Math.max(RIGHT_EDGE_X, maxInternalX + INTERNAL_OFFSET_X + 100)

    const outputConnectors: Node[] = defOutputs.map((output, index) => ({
      id: `edge_output_${output.id}`,
      type: 'edgeConnector',
      position: { x: outputX, y: outputStartY + index * PORT_SPACING },
      draggable: false,
      data: {
        portId: output.id,
        portName: output.name,
        portType: output.type,
        direction: 'output',
      },
    }))

    // Create internal nodes with auto-layouted positions (shifted right)
    const internalNodes: Node[] = internalNodesRaw.map(node => {
      const layoutPos = positionMap.get(node.id)
      return {
        id: node.id,
        type: 'internalNode',
        position: layoutPos
          ? { x: layoutPos.x + INTERNAL_OFFSET_X, y: layoutPos.y }
          : { x: 300, y: 200 },
        data: {
          nodeType: node.nodeType,
          properties: node.properties,
        },
      }
    })

    setNodes([...inputConnectors, ...internalNodes, ...outputConnectors])

    // Build edges - translate old format to new edge connector format
    // (inputPortIds and outputPortIds already defined above for layout)
    const flowEdges: Edge[] = definition.internalGraph.edges.map(edge => {
      let source = edge.source
      let target = edge.target
      let sourceHandle = edge.sourceHandle || 'output'
      let targetHandle = edge.targetHandle || 'input'

      // Translate external port references
      // Handle format: "ext_{portId}" (e.g., "ext_input", "ext_delayTime")
      if (source.startsWith('ext_')) {
        const portId = source.replace('ext_', '')
        if (inputPortIds.has(portId)) {
          source = `edge_input_${portId}`
          sourceHandle = 'output'
        }
      }
      // Also handle format: "ext_input_{portId}" for backward compatibility
      if (source.startsWith('ext_input_')) {
        source = `edge_input_${source.replace('ext_input_', '')}`
        sourceHandle = 'output'
      }

      if (target.startsWith('ext_')) {
        const portId = target.replace('ext_', '')
        if (outputPortIds.has(portId)) {
          target = `edge_output_${portId}`
          targetHandle = 'input'
        }
      }
      // Also handle format: "ext_output_{portId}" for backward compatibility
      if (target.startsWith('ext_output_')) {
        target = `edge_output_${target.replace('ext_output_', '')}`
        targetHandle = 'input'
      }

      return {
        id: edge.id,
        source,
        target,
        sourceHandle,
        targetHandle,
        type: ConnectionLineType.Bezier,
        animated: true,
        style: { stroke: '#059669', strokeWidth: 3 },
      }
    })

    setEdges(flowEdges)
  }, [isOpen, isCreatingNew, definition, setNodes, setEdges, syncEdgeConnectors])

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        compositeEditorStore.closeEditor()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen])

  /******************* HANDLERS ***********************/

  const handleClose = useCallback(() => {
    compositeEditorStore.closeEditor()
  }, [])

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isPrebuilt) {
        setError(
          'This is a prebuilt composite node. Use "Save As" to create an editable copy first.'
        )
        setTimeout(() => setError(null), 4000)
        return
      }

      if (!connection.source || !connection.target) return

      // Save undo state before modifying
      saveUndoState()

      const newEdge: Edge = {
        id: `e_${connection.source}_${connection.target}_${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        type: ConnectionLineType.Bezier,
        animated: true,
        style: { stroke: '#059669', strokeWidth: 3 },
      }

      setEdges(eds => [...eds, newEdge])
    },
    [setEdges, isPrebuilt, saveUndoState]
  )

  const handleSave = useCallback(async () => {
    if (!definitionId || isPrebuilt) return

    setError(null)

    try {
      const internalGraph = buildInternalGraph(nodes, edges, inputs, outputs)

      // Deep clone inputs and outputs to avoid MST reference issues
      const clonedInputs = JSON.parse(JSON.stringify(inputs))
      const clonedOutputs = JSON.parse(JSON.stringify(outputs))

      await compositeNodeDefinitionStore.updateCompositeNode(
        definitionId,
        nodeName,
        nodeDescription,
        clonedInputs,
        clonedOutputs,
        internalGraph
      )

      setSuccess('Saved successfully!')
      setTimeout(() => setSuccess(null), 3000)

      if (onSave) {
        onSave(definitionId)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }, [definitionId, isPrebuilt, nodes, edges, inputs, outputs, nodeName, nodeDescription, onSave])

  const handleSaveAs = useCallback(async () => {
    if (!saveAsName.trim()) {
      setError('Please enter a name')
      return
    }

    setError(null)

    try {
      const internalGraph = buildInternalGraph(nodes, edges, inputs, outputs)

      // Deep clone inputs and outputs to avoid MST reference issues
      const clonedInputs = JSON.parse(JSON.stringify(inputs))
      const clonedOutputs = JSON.parse(JSON.stringify(outputs))

      const newId = await compositeNodeDefinitionStore.saveCompositeNode(
        saveAsName.trim(),
        nodeDescription,
        clonedInputs,
        clonedOutputs,
        internalGraph
      )

      setSuccess(`Saved as "${saveAsName.trim()}"!`)
      setShowSaveAsDialog(false)
      setSaveAsName('')
      setTimeout(() => setSuccess(null), 3000)

      // Switch the editor to the newly created definition
      compositeEditorStore.switchToDefinition(newId as string)

      // Update the node name in UI
      setNodeName(saveAsName.trim())

      // If there was a source node in the main graph, update it to use the new definition
      if (sourceNodeId) {
        audioGraphStore.updateCompositeNodeDefinition(sourceNodeId, newId as string)
      }

      if (onSave) {
        onSave(newId as string)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }, [
    saveAsName,
    nodes,
    edges,
    inputs,
    outputs,
    nodeDescription,
    onSave,
    sourceNodeId,
    audioGraphStore,
  ])

  const handleDelete = useCallback(async () => {
    if (!definitionId || isPrebuilt) return

    // Count nodes in main graph that use this definition
    const nodeType = `Composite_${definitionId}`
    const nodesUsingDefinition = audioGraphStore.adaptedNodes.filter(
      node => node.nodeType === nodeType
    )
    const nodeCount = nodesUsingDefinition.length

    const confirmMessage =
      nodeCount > 0
        ? `Are you sure you want to delete "${nodeName}"? This will also remove ${nodeCount} node(s) from the main graph. This action cannot be undone.`
        : `Are you sure you want to delete "${nodeName}"? This action cannot be undone.`

    if (!confirm(confirmMessage)) {
      return
    }

    setError(null)

    try {
      // First remove all nodes from the main graph that use this definition
      for (const node of nodesUsingDefinition) {
        audioGraphStore.removeNode(node.id)
      }

      // Then delete the definition itself
      await compositeNodeDefinitionStore.deleteCompositeNode(definitionId)
      setSuccess('Deleted successfully!')
      setTimeout(() => {
        setSuccess(null)
        handleClose()
      }, 1000)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [definitionId, isPrebuilt, nodeName, handleClose, audioGraphStore])

  /******************* PORT HANDLERS ***********************/

  const handleAddPort = useCallback(() => {
    const { direction, name, type } = addPortDialog

    if (!name.trim()) {
      setError('Please enter a port name')
      return
    }

    const newPort: CompositeNodePort = {
      id: `${direction}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      type,
    }

    if (direction === 'input') {
      const newInputs = [...inputs, newPort]
      setInputs(newInputs)
      syncEdgeConnectors(newInputs, outputs)
    } else {
      const newOutputs = [...outputs, newPort]
      setOutputs(newOutputs)
      syncEdgeConnectors(inputs, newOutputs)
    }

    setAddPortDialog({ isOpen: false, direction: 'input', name: '', type: 'audio' })
  }, [addPortDialog, inputs, outputs, syncEdgeConnectors])

  // Handle node changes - including edge connector deletions
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Check for edge connector removals and update port state
      changes.forEach(change => {
        if (change.type === 'remove') {
          const nodeId = change.id
          if (nodeId.startsWith('edge_input_')) {
            const portId = nodeId.replace('edge_input_', '')
            setInputs(prev => prev.filter(p => p.id !== portId))
            // Remove connected edges
            setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId))
          } else if (nodeId.startsWith('edge_output_')) {
            const portId = nodeId.replace('edge_output_', '')
            setOutputs(prev => prev.filter(p => p.id !== portId))
            // Remove connected edges
            setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId))
          }
        }
      })
      // Apply the changes to nodes
      onNodesChange(changes)
    },
    [onNodesChange, setEdges]
  )

  // Handle node deletion callback for BaseFlowCanvas
  const handleNodeDelete = useCallback(
    (nodeIds: string[]) => {
      // Save undo state before modifying
      saveUndoState()
      // Create remove changes for each node
      const removeChanges: NodeChange[] = nodeIds.map(id => ({
        type: 'remove' as const,
        id,
      }))
      handleNodesChange(removeChanges)
    },
    [handleNodesChange, saveUndoState]
  )

  // Handle edge deletion callback for BaseFlowCanvas
  const handleEdgeDelete = useCallback(
    (edgeIds: string[]) => {
      // Save undo state before modifying
      saveUndoState()
      setEdges(prev => prev.filter(e => !edgeIds.includes(e.id)))
    },
    [setEdges, saveUndoState]
  )

  /******************* EXPORT/IMPORT ***********************/

  const handleExport = useCallback(() => {
    if (!definitionId && !isCreatingNew) return

    const exportData = {
      name: nodeName,
      description: nodeDescription,
      inputs,
      outputs,
      internalGraph: buildInternalGraph(nodes, edges, inputs, outputs),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nodeName.replace(/\s+/g, '_')}_composite.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setSuccess('Exported successfully!')
    setTimeout(() => setSuccess(null), 3000)
  }, [definitionId, isCreatingNew, nodeName, nodeDescription, inputs, outputs, nodes, edges])

  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate the imported data
      if (!data.name || !data.inputs || !data.outputs || !data.internalGraph) {
        throw new Error('Invalid composite node file format')
      }

      // Save as new composite node
      await compositeNodeDefinitionStore.saveCompositeNode(
        data.name,
        data.description || '',
        data.inputs,
        data.outputs,
        data.internalGraph
      )

      setSuccess(`Imported "${data.name}" successfully!`)
      setTimeout(() => setSuccess(null), 3000)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(`Import failed: ${(err as Error).message}`)
    }
  }, [])

  /******************* CLIPBOARD OPERATIONS (using useGraphUndoRedo hook) ***********************/

  const handleCopy = useCallback(
    (nodeIds: string[]) => {
      hookCopy(nodeIds)
      setSuccess('Copied to clipboard')
      setTimeout(() => setSuccess(null), 2000)
    },
    [hookCopy]
  )

  const handleCut = useCallback(
    (nodeIds: string[]) => {
      if (isPrebuilt) return
      hookCut(nodeIds)
    },
    [isPrebuilt, hookCut]
  )

  const handlePaste = useCallback(() => {
    if (isPrebuilt || !canPaste) return
    hookPaste()
  }, [isPrebuilt, canPaste, hookPaste])

  /******************* UNDO/REDO OPERATIONS (using useGraphUndoRedo hook) ***********************/

  const handleUndo = useCallback(() => {
    if (isPrebuilt || !canUndo) return
    hookUndo()
  }, [isPrebuilt, canUndo, hookUndo])

  const handleRedo = useCallback(() => {
    if (isPrebuilt || !canRedo) return
    hookRedo()
  }, [isPrebuilt, canRedo, hookRedo])

  /******************* AUTO-LAYOUT ***********************/

  const handleAutoLayout = useCallback(
    (direction: LayoutDirection) => {
      if (isPrebuilt) return

      saveUndoState()

      // Get only internal nodes for layout (not edge connectors)
      const internalNodes = nodes.filter(n => n.type === 'internalNode')
      const internalNodeIds = new Set(internalNodes.map(n => n.id))

      const layoutNodes = internalNodes.map(node => ({
        id: node.id,
        width: 200,
        height: 140,
      }))

      const layoutEdges = edges
        .filter(e => internalNodeIds.has(e.source) && internalNodeIds.has(e.target))
        .map(edge => ({
          source: edge.source,
          target: edge.target,
        }))

      const newPositions = autoLayoutNodes(layoutNodes, layoutEdges, { direction })
      const positionMap = new Map(newPositions.map(p => [p.id, { x: p.x + 180, y: p.y }]))

      setNodes(prevNodes =>
        prevNodes.map(node => {
          if (node.type === 'internalNode') {
            const newPos = positionMap.get(node.id)
            if (newPos) {
              return { ...node, position: newPos }
            }
          }
          return node
        })
      )
    },
    [isPrebuilt, nodes, edges, saveUndoState, setNodes]
  )

  /******************* DRAG & DROP ***********************/

  const handleDrop = useCallback(
    (nodeType: string, position: { x: number; y: number }) => {
      if (isPrebuilt) {
        setError(
          'This is a prebuilt composite node. Use "Save As" to create an editable copy first.'
        )
        setTimeout(() => setError(null), 4000)
        return
      }

      if (nodeType.startsWith('Composite_')) {
        setError('Cannot add composite nodes inside a composite')
        setTimeout(() => setError(null), 3000)
        return
      }

      addNodeToEditor(nodeType, position)
    },
    [addNodeToEditor, isPrebuilt]
  )

  /******************* RENDER ***********************/

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      data-testid="composite-editor-panel"
      className={`
        fixed top-0 right-0 h-full z-40 flex flex-col
        shadow-2xl transition-all duration-300 ease-in-out
        ${isDark ? 'bg-gray-900 border-l border-gray-700' : 'bg-white border-l border-gray-200'}
      `}
      style={{ width: 'calc(100vw - 320px)' }}
    >
      {/* Header */}
      <div
        className={`
          flex items-center justify-between px-4 py-3 border-b shrink-0
          ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}
        `}
      >
        <div className="flex items-center space-x-3">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {isCreatingNew ? 'Create Composite' : 'Edit Composite'}
          </h2>

          {/* Node name input */}
          <input
            type="text"
            value={nodeName}
            onChange={e => setNodeName(e.target.value)}
            placeholder="Node name..."
            disabled={isPrebuilt}
            data-testid="composite-name-input"
            className={`
              px-3 py-1.5 rounded border text-sm font-medium
              ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}
              ${isPrebuilt ? 'opacity-60 cursor-not-allowed' : ''}
            `}
          />

          {/* Badges */}
          {isPrebuilt && (
            <span className="px-2 py-1 text-xs font-medium bg-cyan-500 text-white rounded">
              Prebuilt (Read-only)
            </span>
          )}
          {isCreatingNew && (
            <span className="px-2 py-1 text-xs font-medium bg-violet-500 text-white rounded">
              New
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {/* Export/Import buttons - only for user composites, not presets */}
          {!isPrebuilt && (
            <>
              {/* Export button */}
              <button
                onClick={handleExport}
                data-testid="composite-export-button"
                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors flex items-center gap-1"
                title="Export as JSON"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Export
              </button>

              {/* Import button */}
              <label
                data-testid="composite-import-button"
                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Import
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>

              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
            </>
          )}

          {/* Save button */}
          {!isPrebuilt && !isCreatingNew && (
            <button
              onClick={handleSave}
              data-testid="composite-save-button"
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          )}

          {/* Save As button */}
          <button
            onClick={() => {
              setShowSaveAsDialog(true)
              setSaveAsName(isCreatingNew ? nodeName : `${nodeName} (copy)`)
            }}
            data-testid="composite-save-as-button"
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
          >
            {isCreatingNew ? 'Save' : 'Save As'}
          </button>

          {/* Delete button */}
          {!isPrebuilt && !isCreatingNew && (
            <button
              onClick={handleDelete}
              data-testid="composite-delete-button"
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          )}

          {/* Close button */}
          <button
            onClick={handleClose}
            data-testid="composite-close-button"
            className={`
              p-2 rounded transition-colors
              ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}
            `}
            title="Close (ESC)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Description field - Prominent */}
      <div
        className={`px-4 py-3 border-b shrink-0 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}
      >
        <label
          className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Description
        </label>
        <textarea
          value={nodeDescription}
          onChange={e => setNodeDescription(e.target.value)}
          placeholder="Describe what this composite node does..."
          disabled={isPrebuilt}
          rows={2}
          data-testid="composite-description"
          className={`
            w-full px-3 py-2 rounded border text-sm resize-none
            ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}
            ${isPrebuilt ? 'opacity-60 cursor-not-allowed' : ''}
          `}
        />
      </div>

      {/* Error/Success messages */}
      {(error || compositeEditorStore.error) && (
        <div className="px-4 py-2 bg-red-100 dark:bg-red-900/50 border-b border-red-200 dark:border-red-800 shrink-0">
          <p className="text-sm text-red-600 dark:text-red-300">
            {error || compositeEditorStore.error}
          </p>
        </div>
      )}
      {success && (
        <div className="px-4 py-2 bg-green-100 dark:bg-green-900/50 border-b border-green-200 dark:border-green-800 shrink-0">
          <p className="text-sm text-green-600 dark:text-green-300">{success}</p>
        </div>
      )}

      {/* Main content - Full canvas with floating toolbar */}
      <div className="flex-1 min-h-0 relative" data-testid="composite-editor-canvas">
        <BaseFlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          nodeTypes={editorNodeTypes}
          onNodeDelete={isPrebuilt ? undefined : handleNodeDelete}
          onEdgeDelete={isPrebuilt ? undefined : handleEdgeDelete}
          onDrop={isPrebuilt ? undefined : handleDrop}
          readOnly={isPrebuilt}
          fitView
          // Selection tracking for unified keyboard handler
          onSelectionChanged={(nodeIds, edgeIds) => {
            setSelectedNodeIds(nodeIds)
            setSelectedEdgeIds(edgeIds)
          }}
          // Clipboard operations (for any UI buttons - keyboard handled by unified handler)
          onCopy={handleCopy}
          onCut={isPrebuilt ? undefined : handleCut}
          onPaste={isPrebuilt ? undefined : handlePaste}
          canPaste={!isPrebuilt && canPaste}
          // Undo/Redo operations (for any UI buttons)
          onUndo={isPrebuilt ? undefined : handleUndo}
          onRedo={isPrebuilt ? undefined : handleRedo}
          canUndo={!isPrebuilt && canUndo}
          canRedo={!isPrebuilt && canRedo}
        >
          {/* Floating toolbar for adding inputs/outputs - inside ReactFlow context */}
          {!isPrebuilt && (
            <div
              className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            >
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Add:</span>
              <button
                onClick={() =>
                  setAddPortDialog({ isOpen: true, direction: 'input', name: '', type: 'audio' })
                }
                data-testid="add-input-button"
                className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${isDark ? 'bg-emerald-900 text-emerald-300 hover:bg-emerald-800' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Input
              </button>
              <button
                onClick={() =>
                  setAddPortDialog({ isOpen: true, direction: 'output', name: '', type: 'audio' })
                }
                data-testid="add-output-button"
                className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${isDark ? 'bg-purple-900 text-purple-300 hover:bg-purple-800' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Output
              </button>
              <div className={`w-px h-4 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
              <AutoLayoutPanelWithContext
                isDark={isDark}
                nodeCount={nodes.filter(n => n.type === 'internalNode').length}
                isReadOnly={isPrebuilt}
                onAutoLayout={handleAutoLayout}
              />
              <div className={`w-px h-4 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
              <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Drag from palette to add nodes
              </span>
            </div>
          )}

          {/* Read-only indicator for prebuilt */}
          {isPrebuilt && (
            <div
              className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-2 rounded-lg shadow-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            >
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                View only - Use "Save As" to create an editable copy
              </span>
            </div>
          )}
        </BaseFlowCanvas>
      </div>

      {/* Add Port Dialog */}
      {addPortDialog.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            data-testid="add-port-dialog"
            className={`p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
              Add {addPortDialog.direction === 'input' ? 'Input' : 'Output'}
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={addPortDialog.name}
                  onChange={e => setAddPortDialog(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., input, frequency, wetDry"
                  className={`w-full px-3 py-2 rounded border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                  autoFocus
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Type
                </label>
                <select
                  value={addPortDialog.type}
                  onChange={e =>
                    setAddPortDialog(prev => ({
                      ...prev,
                      type: e.target.value as 'audio' | 'control',
                    }))
                  }
                  className={`w-full px-3 py-2 rounded border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                >
                  <option value="audio">Audio (signal)</option>
                  <option value="control">Control (parameter)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() =>
                  setAddPortDialog({ isOpen: false, direction: 'input', name: '', type: 'audio' })
                }
                className={`px-4 py-2 text-sm rounded transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddPort}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save As Dialog */}
      {showSaveAsDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            data-testid="save-as-dialog"
            className={`p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {isCreatingNew ? 'Save Composite Node' : 'Save As'}
            </h3>

            <div>
              <label
                className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Name
              </label>
              <input
                type="text"
                value={saveAsName}
                onChange={e => setSaveAsName(e.target.value)}
                placeholder="Enter name..."
                className={`w-full px-3 py-2 rounded border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                autoFocus
              />
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowSaveAsDialog(false)
                  setSaveAsName('')
                }}
                className={`px-4 py-2 text-sm rounded transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAs}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

/******************* HELPER FUNCTIONS ***********************/

function buildInternalGraph(
  nodes: Node[],
  edges: Edge[],
  inputs: CompositeNodePort[],
  outputs: CompositeNodePort[]
): CompositeNodeInternalGraph {
  const serializedNodes: SerializedNode[] = []
  const serializedEdges: SerializedEdge[] = []
  const serializedConnections: SerializedConnection[] = []

  // Add external input nodes (for compatibility with runtime)
  inputs.forEach(input => {
    serializedNodes.push({
      id: `ext_input_${input.id}`,
      nodeType: 'ExternalInputNode',
      position: { x: 50, y: 0 },
      properties: [{ name: 'portId', value: input.id }],
    })
  })

  // Add external output nodes
  outputs.forEach(output => {
    serializedNodes.push({
      id: `ext_output_${output.id}`,
      nodeType: 'ExternalOutputNode',
      position: { x: 600, y: 0 },
      properties: [{ name: 'portId', value: output.id }],
    })
  })

  // Add internal nodes
  nodes.forEach(node => {
    if (node.type === 'edgeConnector') return

    const properties: { name: string; value: unknown }[] = []

    if (node.data && typeof node.data === 'object') {
      const nodeData = node.data as { properties?: Map<string, unknown> }
      if (nodeData.properties instanceof Map) {
        nodeData.properties.forEach((value, name) => {
          properties.push({ name, value })
        })
      }
    }

    serializedNodes.push({
      id: node.id,
      nodeType: (node.data as { nodeType?: string })?.nodeType || 'unknown',
      // Deep clone position to avoid MST reference issues
      position: { x: node.position.x, y: node.position.y },
      properties,
    })
  })

  // Translate edges from edge connector format to ext_input/ext_output format
  edges.forEach(edge => {
    let source = edge.source
    let target = edge.target
    let sourceHandle = edge.sourceHandle || 'output'
    let targetHandle = edge.targetHandle || 'input'

    // Translate edge connector references back to ext_ format for storage
    if (source.startsWith('edge_input_')) {
      source = `ext_input_${source.replace('edge_input_', '')}`
      sourceHandle = 'output'
    }
    if (target.startsWith('edge_output_')) {
      target = `ext_output_${target.replace('edge_output_', '')}`
      targetHandle = 'input'
    }

    serializedEdges.push({
      id: edge.id,
      source,
      target,
      sourceHandle,
      targetHandle,
    })

    serializedConnections.push({
      sourceNodeId: source,
      targetNodeId: target,
      sourceOutput: sourceHandle,
      targetInput: targetHandle,
    })
  })

  return {
    nodes: serializedNodes,
    edges: serializedEdges,
    connections: serializedConnections,
  }
}

export default CompositeEditorPanel
