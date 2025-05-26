import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  ConnectionLineType,
} from '@xyflow/react'
import type { Connection, Node, Edge, NodeChange, EdgeChange, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { observer } from 'mobx-react-lite'
import { getSnapshot } from 'mobx-state-tree'

import {
  createAudioGraphStore,
  AudioGraphStoreContext,
  useAudioGraphStore,
} from '~/stores/AudioGraphStore'
import AudioNode from '~/components/AudioNode'
import NodePalette from '~/components/NodePalette'
import PropertyPanel from '~/components/PropertyPanel'
import Header from '~/components/Header'

const nodeTypes: NodeTypes = {
  audioNode: AudioNode,
}

const App: React.FC = observer(() => {
  const store = useMemo(() => createAudioGraphStore(), [])

  return (
    <AudioGraphStoreContext.Provider value={store}>
      <AppContent />
    </AudioGraphStoreContext.Provider>
  )
})

const AppContent: React.FC = observer(() => {
  const store = useAudioGraphStore()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [forceUpdate, setForceUpdate] = useState(0)

  // Mobile responsive state
  const [isNodePaletteOpen, setIsNodePaletteOpen] = useState(false)
  const [isPropertyPanelOpen, setIsPropertyPanelOpen] = useState(false)

  const handleForceUpdate = useCallback(() => {
    setForceUpdate(prev => prev + 1)
  }, [])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not in an input field
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Undo: Cmd/Ctrl + Z (without Shift)
      if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        store.undo()
        handleForceUpdate()
        return
      }

      // Redo: Cmd/Ctrl + Y (primary and most reliable redo shortcut)
      if ((event.metaKey || event.ctrlKey) && event.key === 'y' && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        store.redo()
        handleForceUpdate()
        return
      }
    }

    // Use capture phase and multiple event listeners for maximum compatibility
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [store, handleForceUpdate])

  // Load metadata on mount
  useEffect(() => {
    console.log('=== LOADING METADATA ===')
    store.loadMetadata()
    console.log('Metadata loaded. Available node types:', Object.keys(store.webAudioMetadata))
  }, [store])

  // Debug store state
  useEffect(() => {
    console.log('Store state:', {
      visualNodes: store.visualNodes.length,
      visualEdges: store.visualEdges.length,
      metadataKeys: Object.keys(store.webAudioMetadata),
    })
  }, [store.visualNodes.length, store.visualEdges.length, store.webAudioMetadata])

  // Debug React Flow state
  useEffect(() => {
    console.log('React Flow nodes state changed:', nodes.length, nodes)
  }, [nodes])

  // Sync store with React Flow state
  useEffect(() => {
    console.log('=== SYNC EFFECT TRIGGERED ===')
    console.log('Store visualNodes length:', store.visualNodes.length)
    console.log('Current React Flow nodes length:', nodes.length)

    if (store.visualNodes.length === 0) {
      console.log('No nodes in store, clearing React Flow nodes')
      if (nodes.length > 0) {
        setNodes([])
      }
      return
    }

    try {
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
      console.log('setNodes called with', storeNodes.length, 'nodes')
    } catch (error) {
      console.error('Error in sync effect:', error)
      console.error('Error stack:', (error as Error).stack)
    }
  }, [
    store.visualNodes.length,
    store.selectedNodeId,
    store.propertyChangeCounter,
    forceUpdate,
    setNodes,
    store.visualNodes,
    nodes.length,
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
  }, [store.visualEdges.length, store.visualEdges, forceUpdate, setEdges, store.visualNodes])

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

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      store.selectNode(node.id)
      // Auto-open properties panel when a node is selected
      setIsPropertyPanelOpen(true)
    },
    [store]
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
      const nodeSpacing = 250 // Minimum distance between nodes
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

  // Create a proper useCallback for the ReactFlow onEdgesChange prop
  const reactFlowOnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      console.log('React Flow onEdgesChange called with:', changes)
      handleEdgesChange(changes)
    },
    [handleEdgesChange]
  )

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Full-width Header */}
      <Header
        isNodePaletteOpen={isNodePaletteOpen}
        isPropertyPanelOpen={isPropertyPanelOpen}
        onToggleNodePalette={() => setIsNodePaletteOpen(!isNodePaletteOpen)}
        onTogglePropertyPanel={() => setIsPropertyPanelOpen(!isPropertyPanelOpen)}
      />

      {/* Layout container */}
      <div className="flex flex-1 h-0 relative">
        {/* Node Palette - Desktop: sidebar, Mobile: overlay */}
        <div
          className={`
          w-64 relative
          md:w-64 md:relative md:translate-x-0
          max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-80 max-md:transform max-md:transition-transform max-md:duration-300 max-md:ease-in-out
          ${!isNodePaletteOpen ? 'max-md:-translate-x-full' : 'max-md:translate-x-0'}
          bg-white border-r border-gray-200 flex flex-col h-full
        `}
        >
          <div className="flex-1 overflow-y-auto">
            <NodePalette onClose={() => setIsNodePaletteOpen(false)} />
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 flex flex-col h-full">
          {/* React Flow Canvas */}
          <div className="flex-1 relative h-full">
            <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-sm text-gray-600">
              <span className="md:hidden">Canvas Area - Use menu buttons to access tools</span>
              <span className="hidden md:inline">
                Canvas Area - Click or drag nodes in the left panel to add them here
              </span>
            </div>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={reactFlowOnNodesChange}
              onEdgesChange={reactFlowOnEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              connectOnClick={false}
              defaultEdgeOptions={{
                type: 'default',
                animated: true,
              }}
              className="bg-gray-50 w-full h-full"
              onInit={reactFlowInstance => {
                console.log('React Flow initialized:', reactFlowInstance)
                console.log('React Flow viewport:', reactFlowInstance.getViewport())
              }}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
        </div>

        {/* Property Panel - Desktop: sidebar, Tablet/Mobile: overlay */}
        <div
          className={`
          w-80 relative
          lg:w-80 lg:relative lg:translate-x-0
          max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:w-80 max-lg:transform max-lg:transition-transform max-lg:duration-300 max-lg:ease-in-out
          ${!isPropertyPanelOpen ? 'max-lg:translate-x-full' : 'max-lg:translate-x-0'}
          bg-white border-l border-gray-200 flex flex-col h-full
        `}
        >
          <div className="flex-1 overflow-y-auto">
            <PropertyPanel onClose={() => setIsPropertyPanelOpen(false)} />
          </div>
        </div>

        {/* Mobile/Tablet overlay backdrop */}
        <div
          className={`
            fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300
            lg:hidden
            ${isNodePaletteOpen || isPropertyPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
          onClick={() => {
            setIsNodePaletteOpen(false)
            setIsPropertyPanelOpen(false)
          }}
        />
      </div>
    </div>
  )
})

export default App
