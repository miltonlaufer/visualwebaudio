import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Connection,
  Node,
  Edge,
  NodeChange,
} from '@xyflow/react'
import type { NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { observer } from 'mobx-react-lite'
import { getSnapshot } from 'mobx-state-tree'
import { createAudioGraphStore } from '~/stores/AudioGraphStore'
import AudioNode from '~/components/AudioNode'
import NodePalette from '~/components/NodePalette'
import PropertyPanel from '~/components/PropertyPanel'
import Header from '~/components/Header'

const nodeTypes: NodeTypes = {
  audioNode: AudioNode,
}

const App: React.FC = observer(() => {
  const store = useMemo(() => createAudioGraphStore(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [forceUpdate, setForceUpdate] = useState(0)

  const handleForceUpdate = useCallback(() => {
    setForceUpdate(prev => prev + 1)
  }, [])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        store.undo()
        handleForceUpdate()
      } else if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === 'y' || (event.key === 'z' && event.shiftKey))
      ) {
        event.preventDefault()
        store.redo()
        handleForceUpdate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined,
      }
    })

    console.log('Converted storeEdges:', storeEdges)
    console.log('About to call setEdges with:', storeEdges)
    setEdges(storeEdges)
    console.log('setEdges called')
  }, [store.visualEdges.length, store.visualEdges, forceUpdate, setEdges])

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
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
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

  // Create a proper useCallback for the ReactFlow onNodesChange prop
  const reactFlowOnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      console.log('React Flow onNodesChange called with:', changes)
      handleNodesChange(changes)
    },
    [handleNodesChange]
  )

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Full-width Header */}
      <Header store={store} />

      {/* Three-column layout below header */}
      <div className="flex flex-1 h-0">
        {/* Node Palette */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-4">
            <NodePalette store={store} />
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 flex flex-col h-full">
          {/* React Flow Canvas */}
          <div className="flex-1 relative h-full">
            <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-sm text-gray-600">
              Canvas Area - Click or drag nodes in the left panel to add them here
            </div>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={reactFlowOnNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              connectOnClick={false}
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#6b7280', strokeWidth: 2 },
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

        {/* Property Panel */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            <PropertyPanel store={store} />
          </div>
        </div>
      </div>
    </div>
  )
})

export default App
