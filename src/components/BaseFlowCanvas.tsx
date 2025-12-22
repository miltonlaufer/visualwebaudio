/**
 * Base Flow Canvas
 *
 * A reusable ReactFlow canvas component that provides common functionality
 * shared between the main graph and the composite node editor.
 *
 * Features:
 * - Keyboard shortcuts (delete, multi-select)
 * - Selection handling
 * - Drag & drop from palette
 * - Connection handling
 * - Edge styling
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Connection,
  Edge,
  Node,
  NodeTypes,
  ConnectionMode,
  ConnectionLineType,
  OnSelectionChangeParams,
  NodeChange,
  EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useThemeStore } from '~/stores/ThemeStore'

/******************* TYPES ***********************/

export interface BaseFlowCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  nodeTypes: NodeTypes
  onNodeDelete?: (nodeIds: string[]) => void
  onEdgeDelete?: (edgeIds: string[]) => void
  onDrop?: (nodeType: string, position: { x: number; y: number }) => void
  onNodeDoubleClick?: (nodeId: string, node: Node) => void
  onNodeClick?: (nodeId: string) => void
  onPaneClick?: () => void
  isValidConnection?: (connection: Connection) => boolean
  readOnly?: boolean
  fitView?: boolean
  children?: React.ReactNode
  className?: string

  // Clipboard operations
  onCopy?: (nodeIds: string[]) => void
  onCut?: (nodeIds: string[]) => void
  onPaste?: () => void
  canPaste?: boolean

  // Undo/Redo operations
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean

  // Selection change callback (passes selected IDs)
  onSelectionChanged?: (nodeIds: string[], edgeIds: string[]) => void
}

/******************* DEFAULT EDGE OPTIONS ***********************/

const defaultEdgeOptions = {
  type: ConnectionLineType.Bezier,
  animated: true,
  style: {
    stroke: '#059669',
    strokeWidth: 3,
  },
}

/******************* COMPONENT ***********************/

const BaseFlowCanvas: React.FC<BaseFlowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  nodeTypes,
  onNodeDelete,
  onEdgeDelete,
  onDrop,
  onNodeDoubleClick,
  onNodeClick,
  onPaneClick,
  isValidConnection,
  readOnly = false,
  fitView = false,
  children,
  className,
  // Clipboard
  onCopy,
  onCut,
  onPaste,
  canPaste = false,
  // Undo/Redo
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  // Selection
  onSelectionChanged,
}) => {
  const themeStore = useThemeStore()
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])

  const isDark = themeStore.isDarkMode

  /******************* KEYBOARD SHORTCUTS ***********************/

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not in an input field
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Check if we're in a selectable text area
      const isInSelectableArea = target.closest('.select-text') !== null
      if (isInSelectableArea) {
        return
      }

      // Check if there's an active text selection
      const selection = window.getSelection()
      if (selection && selection.toString().length > 0) {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? event.metaKey : event.ctrlKey

      // Copy: Ctrl/Cmd + C
      if (modKey && event.key === 'c' && !event.shiftKey) {
        if (selectedNodeIds.length > 0 && onCopy) {
          event.preventDefault()
          event.stopPropagation()
          onCopy(selectedNodeIds)
        }
        return
      }

      // Cut: Ctrl/Cmd + X
      if (modKey && event.key === 'x' && !readOnly) {
        if (selectedNodeIds.length > 0 && onCut) {
          event.preventDefault()
          event.stopPropagation()
          onCut(selectedNodeIds)
        }
        return
      }

      // Paste: Ctrl/Cmd + V
      if (modKey && event.key === 'v' && !readOnly) {
        if (canPaste && onPaste) {
          event.preventDefault()
          event.stopPropagation()
          onPaste()
        }
        return
      }

      // Undo: Ctrl/Cmd + Z (without Shift)
      if (modKey && event.key === 'z' && !event.shiftKey) {
        if (canUndo && onUndo) {
          event.preventDefault()
          event.stopPropagation()
          onUndo()
        }
        return
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if ((modKey && event.shiftKey && event.key === 'z') || (modKey && event.key === 'y')) {
        if (canRedo && onRedo) {
          event.preventDefault()
          event.stopPropagation()
          onRedo()
        }
        return
      }

      // Delete: Delete or Backspace key (only when not read-only)
      if (!readOnly && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (selectedNodeIds.length > 0 && onNodeDelete) {
          event.preventDefault()
          event.stopPropagation()
          onNodeDelete(selectedNodeIds)
        }

        if (selectedEdgeIds.length > 0 && onEdgeDelete) {
          event.preventDefault()
          event.stopPropagation()
          onEdgeDelete(selectedEdgeIds)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [
    readOnly,
    selectedNodeIds,
    selectedEdgeIds,
    onNodeDelete,
    onEdgeDelete,
    onCopy,
    onCut,
    onPaste,
    canPaste,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
  ])

  /******************* HANDLERS ***********************/

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const nodeIds = params.nodes.map(n => n.id)
      const edgeIds = params.edges.map(e => e.id)
      setSelectedNodeIds(nodeIds)
      setSelectedEdgeIds(edgeIds)
      onSelectionChanged?.(nodeIds, edgeIds)
    },
    [onSelectionChanged]
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id)
    },
    [onNodeClick]
  )

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeDoubleClick?.(node.id, node)
    },
    [onNodeDoubleClick]
  )

  const handlePaneClick = useCallback(() => {
    onPaneClick?.()
  }, [onPaneClick])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const nodeType = event.dataTransfer.getData('application/reactflow')
      if (!nodeType || !onDrop) return

      const reactFlowBounds = (event.target as Element)
        .closest('.react-flow')
        ?.getBoundingClientRect()
      if (!reactFlowBounds) return

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      }

      onDrop(nodeType, position)
    },
    [onDrop]
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // In readOnly mode, only allow select changes (for viewing) but block everything else
      if (readOnly) {
        const filteredChanges = changes.filter(c => c.type === 'select')
        onNodesChange(filteredChanges)
      } else {
        onNodesChange(changes)
      }
    },
    [readOnly, onNodesChange]
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // In readOnly mode, only allow select changes but block everything else
      if (readOnly) {
        const filteredChanges = changes.filter(c => c.type === 'select')
        onEdgesChange(filteredChanges)
      } else {
        onEdgesChange(changes)
      }
    },
    [readOnly, onEdgesChange]
  )

  // In readOnly mode, block connections
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return
      onConnect(connection)
    },
    [readOnly, onConnect]
  )

  /******************* VALIDATION ***********************/

  const handleIsValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (isValidConnection) {
        return isValidConnection(connection as Connection)
      }
      return true
    },
    [isValidConnection]
  )

  /******************* RENDER ***********************/

  const containerClass = useMemo(() => {
    return `w-full h-full ${isDark ? 'bg-gray-900' : 'bg-gray-100'} ${className || ''}`
  }, [isDark, className])

  return (
    <div
      className="w-full h-full"
      onDragOver={onDrop ? handleDragOver : undefined}
      onDrop={onDrop ? handleDrop : undefined}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
        isValidConnection={handleIsValidConnection}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={defaultEdgeOptions}
        colorMode={isDark ? 'dark' : 'light'}
        className={containerClass}
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        fitView={fitView}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        panOnDrag={true}
        zoomOnScroll={true}
      >
        <Background />
        <Controls />
        <MiniMap />
        {children}
      </ReactFlow>

      {/* Selection indicator */}
      {(selectedNodeIds.length > 0 || selectedEdgeIds.length > 0 || canPaste) && (
        <div className="absolute bottom-4 left-4 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-xs text-gray-600 dark:text-gray-300">
          {selectedNodeIds.length > 0 && <span>{selectedNodeIds.length} node(s) selected</span>}
          {selectedNodeIds.length > 0 && selectedEdgeIds.length > 0 && <span> • </span>}
          {selectedEdgeIds.length > 0 && <span>{selectedEdgeIds.length} edge(s) selected</span>}
          {!readOnly && selectedNodeIds.length > 0 && (
            <span className="ml-2 text-gray-400">
              {onCopy && 'Ctrl+C: Copy'} {onCut && '• Ctrl+X: Cut'}{' '}
              {onNodeDelete && '• Del: Delete'}
            </span>
          )}
          {!readOnly && canPaste && <span className="ml-2 text-gray-400">Ctrl+V: Paste</span>}
          {!readOnly && (canUndo || canRedo) && (
            <span className="ml-2 text-gray-400">
              {canUndo && 'Ctrl+Z: Undo'} {canRedo && '• Ctrl+Shift+Z: Redo'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default BaseFlowCanvas
