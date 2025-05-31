import React, { useCallback, useEffect, useMemo, useState } from 'react'
import '@xyflow/react/dist/style.css'
import { observer } from 'mobx-react-lite'

import {
  createAudioGraphStore,
  AudioGraphStoreContext,
  useAudioGraphStore,
} from '~/stores/AudioGraphStore'
import NodePalette from '~/components/NodePalette'
import PropertyPanel from '~/components/PropertyPanel'
import Header from '~/components/Header'
import GraphCanvas from '~/components/GraphCanvas'

const App: React.FC = observer(() => {
  const store = useMemo(() => createAudioGraphStore(), [])

  // Make store available for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).__STORE__ = store
    }
  }, [store])

  return (
    <AudioGraphStoreContext.Provider value={store}>
      <AppContent />
    </AudioGraphStoreContext.Provider>
  )
})

const AppContent: React.FC = observer(() => {
  const store = useAudioGraphStore()

  // Mobile responsive state
  const [isNodePaletteOpen, setIsNodePaletteOpen] = useState(false)
  const [isPropertyPanelOpen, setIsPropertyPanelOpen] = useState(false)

  const handleForceUpdate = useCallback(() => {
    // This function is passed to GraphCanvas to trigger force updates when needed
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

  const handleNodeClick = useCallback(() => {
    // Auto-open properties panel when a node is selected
    setIsPropertyPanelOpen(true)
  }, [])

  const handleToggleNodePalette = useCallback(() => {
    setIsNodePaletteOpen(!isNodePaletteOpen)
  }, [isNodePaletteOpen])

  const handleTogglePropertyPanel = useCallback(() => {
    setIsPropertyPanelOpen(!isPropertyPanelOpen)
  }, [isPropertyPanelOpen])

  const handleCloseNodePalette = useCallback(() => {
    setIsNodePaletteOpen(false)
  }, [])

  const handleClosePropertyPanel = useCallback(() => {
    setIsPropertyPanelOpen(false)
  }, [])

  const handleClosePanels = useCallback(() => {
    setIsNodePaletteOpen(false)
    setIsPropertyPanelOpen(false)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Full-width Header */}
      <Header
        isNodePaletteOpen={isNodePaletteOpen}
        isPropertyPanelOpen={isPropertyPanelOpen}
        onToggleNodePalette={handleToggleNodePalette}
        onTogglePropertyPanel={handleTogglePropertyPanel}
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
            <NodePalette onClose={handleCloseNodePalette} />
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 flex flex-col h-full">
          <GraphCanvas onNodeClick={handleNodeClick} onForceUpdate={handleForceUpdate} />
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
            <PropertyPanel onClose={handleClosePropertyPanel} />
          </div>
        </div>

        {/* Mobile/Tablet overlay backdrop */}
        <div
          className={`
            fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300
            lg:hidden
            ${isNodePaletteOpen || isPropertyPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
          onClick={handleClosePanels}
        />
      </div>
    </div>
  )
})

export default App
