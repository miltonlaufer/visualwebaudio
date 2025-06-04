import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionMode,
  ConnectionLineType,
  OnSelectionChangeParams,
} from '@xyflow/react'
import type {
  Connection,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  NodeTypes,
  ReactFlowInstance,
} from '@xyflow/react'
import { observer } from 'mobx-react-lite'
import { getSnapshot } from 'mobx-state-tree'

import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import AudioNode from '~/components/AudioNode'

const nodeTypes: NodeTypes = {
  audioNode: AudioNode,
}

// Component to handle auto-fit functionality from within ReactFlow context
const AutoFitHandler: React.FC = observer(() => {
  const store = useAudioGraphStore()
  const { fitView } = useReactFlow()
  const [previousNodeCount, setPreviousNodeCount] = useState(0)

  // Auto-fit view when nodes are loaded (examples, projects, imports)
  useEffect(() => {
    const currentNodeCount = store.visualNodes.length

    // Only auto-fit if:
    // 1. We have nodes (not clearing)
    // 2. The node count increased significantly (likely from loading)
    // 3. We're not just adding one node (manual addition)
    if (currentNodeCount > 0 && currentNodeCount > previousNodeCount + 1) {
      console.log('Auto-fitting view after loading nodes:', currentNodeCount)
      // Small delay to ensure nodes are rendered
      setTimeout(() => {
        fitView({
          padding: 0.1, // 10% padding around nodes
          duration: 800, // Smooth animation
          maxZoom: 1.2, // Don't zoom in too much
        })
      }, 100)
    }

    setPreviousNodeCount(currentNodeCount)
  }, [store.visualNodes.length, fitView, previousNodeCount])

  // Auto-fit view when project loading finishes
  useEffect(() => {
    // When loading finishes and we have nodes, auto-fit the view
    if (!store.isLoadingProject && store.visualNodes.length > 0) {
      console.log('Auto-fitting view after project loading finished')
      // Small delay to ensure nodes are rendered
      setTimeout(() => {
        fitView({
          padding: 0.1, // 10% padding around nodes
          duration: 800, // Smooth animation
          maxZoom: 1.2, // Don't zoom in too much
        })
      }, 150) // Slightly longer delay for project loading
    }
  }, [store.isLoadingProject, store.visualNodes.length, fitView])

  return null // This component doesn't render anything
})

interface GraphCanvasProps {
  onNodeClick?: (nodeId: string) => void
  onForceUpdate?: () => void
}

const GraphCanvas: React.FC<GraphCanvasProps> = observer(({ onNodeClick, onForceUpdate }) => {
  const store = useAudioGraphStore()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [forceUpdate, setForceUpdate] = useState(0)
  const syncingRef = useRef(false)
  const lastSyncedNodesLength = useRef(0)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])

  const handleForceUpdate = useCallback(() => {
    setForceUpdate(prev => prev + 1)
    onForceUpdate?.()
  }, [onForceUpdate])

  // Keyboard shortcuts for copy/cut/paste
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not in an input field
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Check if we're in the AI chat area (has select-text class or is a descendant of it)
      const isInSelectableArea = target.closest('.select-text') !== null
      if (isInSelectableArea) {
        // Always allow normal text operations in chat area
        return
      }

      // Check if there's an active text selection anywhere
      const selection = window.getSelection()
      if (selection && selection.toString().length > 0) {
        // If there's selected text anywhere, allow normal copy/paste behavior
        return
      }

      // Delete: Delete key
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNodeIds.length > 0) {
          event.preventDefault()
          event.stopPropagation()
          selectedNodeIds.forEach(nodeId => {
            store.removeNode(nodeId)
          })
          console.log(`Deleted ${selectedNodeIds.length} nodes`)
          handleForceUpdate()
        }
        return
      }

      // Copy: Ctrl/Cmd + C
      if ((event.metaKey || event.ctrlKey) && event.key === 'c' && !event.shiftKey) {
        if (selectedNodeIds.length > 0) {
          event.preventDefault()
          event.stopPropagation()
          store.copySelectedNodes(selectedNodeIds)
          console.log(`Copied ${selectedNodeIds.length} nodes`)

          // Check clipboard permission after copy attempt
          setTimeout(() => {
            store.checkClipboardPermission()
          }, 100)
        }
        return
      }

      // Cut: Ctrl/Cmd + X
      if ((event.metaKey || event.ctrlKey) && event.key === 'x' && !event.shiftKey) {
        if (selectedNodeIds.length > 0) {
          event.preventDefault()
          event.stopPropagation()
          store.cutSelectedNodes(selectedNodeIds)
          console.log(`Cut ${selectedNodeIds.length} nodes`)
          handleForceUpdate()
        }
        return
      }

      // Paste: Ctrl/Cmd + V
      if ((event.metaKey || event.ctrlKey) && event.key === 'v' && !event.shiftKey) {
        if (store.canPaste) {
          event.preventDefault()
          event.stopPropagation()
          store
            .pasteNodes()
            .then(newNodeIds => {
              console.log(`Pasted ${newNodeIds.length} nodes`)
              handleForceUpdate()
            })
            .catch(error => {
              console.error('Error pasting nodes:', error)
            })
        }
        return
      }
    }

    // Use capture phase for keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [selectedNodeIds, store, handleForceUpdate])

  // Debug React Flow state
  useEffect(() => {
    console.log('React Flow nodes state changed:', nodes.length, nodes)
  }, [nodes])

  // Sync store with React Flow state
  useEffect(() => {
    // Prevent concurrent syncing
    if (syncingRef.current) {
      console.log('Sync already in progress, skipping...')
      return
    }

    console.log('=== SYNC EFFECT TRIGGERED ===')
    console.log('Store visualNodes length:', store.visualNodes.length)
    console.log('Current React Flow nodes length:', nodes.length)
    console.log('Last synced nodes length:', lastSyncedNodesLength.current)

    // Skip if we've already synced this exact state
    if (
      store.visualNodes.length === lastSyncedNodesLength.current &&
      nodes.length === store.visualNodes.length
    ) {
      console.log('No changes detected, skipping sync')
      return
    }

    syncingRef.current = true

    try {
      if (store.visualNodes.length === 0) {
        console.log('No nodes in store, clearing React Flow nodes')
        if (nodes.length > 0) {
          setNodes([])
        }
        lastSyncedNodesLength.current = 0
        return
      }

      const storeNodes: Node[] = store.visualNodes.map((node, index) => {
        console.log(`=== Processing store node ${index} ===`)
        console.log('Node ID:', node.id)
        console.log('Node type:', node.type)
        console.log('Node position:', node.position)
        console.log('Node data nodeType:', node.data.nodeType)

        // Create a simple, clean React Flow node
        const reactFlowNode: Node = {
          id: node.id,
          type: 'audioNode',
          position: {
            x: node.position.x,
            y: node.position.y,
          },
          data: {
            nodeType: node.data.nodeType,
            metadata: {
              name: node.data.metadata.name,
              category: node.data.metadata.category,
              inputs: [...node.data.metadata.inputs],
              outputs: [...node.data.metadata.outputs],
              properties: [...node.data.metadata.properties],
              methods: [...node.data.metadata.methods],
              events: [...node.data.metadata.events],
            },
            properties: getSnapshot(node.data.properties),
          },
          selected: store.selectedNodeId === node.id,
        }

        console.log('Created React Flow node:', JSON.stringify(reactFlowNode, null, 2))
        return reactFlowNode
      })

      console.log('=== FINAL NODES TO SET ===')
      console.log('Number of nodes:', storeNodes.length)
      console.log('Nodes array:', storeNodes)

      // Force React Flow to update by always setting new array
      setNodes([...storeNodes])
      lastSyncedNodesLength.current = storeNodes.length
      console.log('setNodes called with', storeNodes.length, 'nodes')
    } catch (error) {
      console.error('Error in sync effect:', error)
      console.error('Error stack:', (error as Error).stack)
    } finally {
      // Use setTimeout to reset the syncing flag to prevent race conditions
      setTimeout(() => {
        syncingRef.current = false
      }, 0)
    }
  }, [
    store.visualNodes.length,
    store.selectedNodeId,
    store.propertyChangeCounter,
    store.graphChangeCounter,
    forceUpdate,
    setNodes,
    store.visualNodes,
  ])

  useEffect(() => {
    console.log('=== EDGE SYNC EFFECT TRIGGERED ===')
    console.log('Store visualEdges length:', store.visualEdges.length)
    console.log('Store visualEdges:', store.visualEdges)

    const storeEdges: Edge[] = store.visualEdges.map((edge, index) => {
      console.log(`Processing edge ${index}:`, edge)

      // Determine connection type by looking at the source and target handles
      const sourceNode = store.visualNodes.find(node => node.id === edge.source)
      const targetNode = store.visualNodes.find(node => node.id === edge.target)

      let connectionType = 'audio' // default
      let edgeColor = '#059669' // emerald-600 for audio
      let edgeWidth = 3

      if (sourceNode && targetNode) {
        const sourceHandle = edge.sourceHandle || 'output'
        const targetHandle = edge.targetHandle || 'input'

        const sourceOutput = sourceNode.data.metadata.outputs.find(
          output => output.name === sourceHandle
        )
        const targetInput = targetNode.data.metadata.inputs.find(
          input => input.name === targetHandle
        )

        if (sourceOutput && targetInput) {
          // Determine connection type based on target input type
          connectionType = targetInput.type

          if (connectionType === 'control') {
            edgeColor = '#dc2626' // red-600 for control
            edgeWidth = 2 // Slightly thinner for control signals
          }
        }
      }

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined,
        type: ConnectionLineType.Bezier,
        animated: true,
        style: {
          stroke: edgeColor,
          strokeWidth: edgeWidth,
        },
        data: {
          connectionType,
        },
      }
    })

    console.log('Converted storeEdges:', storeEdges)
    console.log('About to call setEdges with:', storeEdges)
    setEdges(storeEdges)
    console.log('setEdges called')
  }, [
    store.visualEdges.length,
    store.visualEdges,
    forceUpdate,
    setEdges,
    store.visualNodes,
    store.graphChangeCounter,
  ])

  const onConnect = useCallback(
    (params: Connection) => {
      console.log('=== CONNECTION ATTEMPT ===')
      console.log('Connection params:', params)

      if (params.source && params.target) {
        // Check if connection is valid before adding
        const isValid = store.isValidConnection(
          params.source,
          params.target,
          params.sourceHandle || undefined,
          params.targetHandle || undefined
        )

        if (!isValid) {
          console.log('Connection rejected - incompatible types')
          // You could show a toast notification here
          return
        }

        console.log('Valid connection - calling store.addEdge')

        try {
          store.addEdge(
            params.source,
            params.target,
            params.sourceHandle || undefined,
            params.targetHandle || undefined
          )
          console.log('Store.addEdge completed')

          handleForceUpdate() // Force update after connection
          console.log('Force update triggered')
        } catch (error) {
          console.error('Error in store.addEdge:', error)
        }
      } else {
        console.log('Invalid connection - missing source or target')
      }

      console.log('=== CONNECTION ATTEMPT END ===')
    },
    [store, handleForceUpdate]
  )

  const onNodeClickHandler = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      store.selectNode(node.id)
      onNodeClick?.(node.id)
    },
    [store, onNodeClick]
  )

  const onPaneClick = useCallback(() => {
    store.selectNode(undefined)
  }, [store])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const nodeType = event.dataTransfer.getData('application/reactflow')
      if (!nodeType) return

      const reactFlowBounds = (event.target as Element).getBoundingClientRect()
      let position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      }

      // Add automatic spacing to prevent overlapping
      const nodeSpacing = 400 // Increased from 250 to 400 for better spacing
      const existingNodes = store.visualNodes

      // Check if position is too close to existing nodes
      let attempts = 0
      const maxAttempts = 20

      while (attempts < maxAttempts) {
        let tooClose = false

        for (const existingNode of existingNodes) {
          const distance = Math.sqrt(
            Math.pow(position.x - existingNode.position.x, 2) +
              Math.pow(position.y - existingNode.position.y, 2)
          )

          if (distance < nodeSpacing) {
            tooClose = true
            break
          }
        }

        if (!tooClose) break

        // Adjust position in a spiral pattern
        const angle = attempts * 0.5 * Math.PI
        const radius = nodeSpacing + attempts * 50
        position = {
          x: event.clientX - reactFlowBounds.left + Math.cos(angle) * radius,
          y: event.clientY - reactFlowBounds.top + Math.sin(angle) * radius,
        }

        attempts++
      }

      store.addNode(nodeType, position)
      handleForceUpdate() // Force update after adding node
    },
    [store, handleForceUpdate]
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      console.log('Nodes changed:', changes)

      // Update React Flow state
      onNodesChange(changes)

      // Handle different types of changes
      changes.forEach(change => {
        if (change.type === 'position' && change.position) {
          console.log('Updating store position for node:', change.id, change.position)
          store.updateNodePosition(change.id, change.position)
        } else if (change.type === 'remove') {
          console.log('Removing node from store:', change.id)
          store.removeNode(change.id)
          handleForceUpdate() // Force update after removal
        }
      })
    },
    [store, onNodesChange, handleForceUpdate]
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      console.log('Edges changed:', changes)

      // Update React Flow state
      onEdgesChange(changes)

      // Handle different types of changes
      changes.forEach(change => {
        if (change.type === 'remove') {
          console.log('Removing edge from store:', change.id)
          store.removeEdge(change.id)
          handleForceUpdate() // Force update after removal
        }
      })
    },
    [store, onEdgesChange, handleForceUpdate]
  )

  // Create a proper useCallback for the ReactFlow onNodesChange prop
  const reactFlowOnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      console.log('React Flow onNodesChange called with:', changes)
      handleNodesChange(changes)
    },
    [handleNodesChange]
  )

  const reactFlowOnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      console.log('React Flow onEdgesChange called with:', changes)
      handleEdgesChange(changes)
    },
    [handleEdgesChange]
  )

  const canvasDefaultEdgeOptions = useMemo(() => {
    return {
      type: 'default',
      animated: true,
    }
  }, [])

  const canvasOnInit = useCallback((reactFlowInstance: ReactFlowInstance) => {
    console.log('React Flow initialized:', reactFlowInstance)
    console.log('React Flow viewport:', reactFlowInstance.getViewport())
  }, [])

  // Handle selection changes for multinode selection
  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const nodeIds = params.nodes.map(node => node.id)
      setSelectedNodeIds(nodeIds)

      // Update store selection for single node (for property panel)
      if (nodeIds.length === 1) {
        store.selectNode(nodeIds[0])
      } else {
        store.selectNode(undefined)
      }
    },
    [store]
  )

  return (
    <div className="flex-1 relative h-full">
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-sm text-gray-600">
        <span className="md:hidden">Canvas Area - Use menu buttons to access tools</span>
        <span className="hidden md:inline">
          Canvas Area - Click or drag nodes in the left panel to add them here. Hold Shift to select
          multiple nodes.
        </span>
      </div>

      {/* Clipboard status indicator */}
      {(selectedNodeIds.length > 0 || store.canPaste || store.clipboardErrorMessage) && (
        <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-xs text-gray-600 max-w-xs">
          <div className="space-y-1">
            {selectedNodeIds.length > 0 && (
              <div>
                <span className="font-medium">{selectedNodeIds.length} selected</span>
                <div className="text-gray-500">Ctrl+C: Copy • Ctrl+X: Cut • Del: Delete</div>
              </div>
            )}
            {store.canPaste && (
              <div className="text-blue-600">
                <span className="font-medium">Clipboard ready</span>
                <div className="text-gray-500">Ctrl+V: Paste</div>
                {store.clipboardPermission === 'denied' && (
                  <div className="text-xs text-amber-700 mt-1">
                    Enable clipboard access to allow copy/paste to another tab.
                  </div>
                )}
              </div>
            )}
            {store.clipboardErrorMessage && !store.canPaste && (
              <div className="text-amber-600 border-t border-amber-200 pt-1 mt-1">
                <div className="font-medium flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Clipboard Access</span>
                </div>
                <div className="text-xs text-amber-700 mt-1">{store.clipboardErrorMessage}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={reactFlowOnNodesChange}
        onEdgesChange={reactFlowOnEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClickHandler}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        connectOnClick={false}
        defaultEdgeOptions={canvasDefaultEdgeOptions}
        className="bg-gray-50 w-full h-full"
        onInit={canvasOnInit}
        multiSelectionKeyCode="Shift"
        deleteKeyCode="Delete"
        onSelectionChange={onSelectionChange}
      >
        <AutoFitHandler />
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
})

export default GraphCanvas
