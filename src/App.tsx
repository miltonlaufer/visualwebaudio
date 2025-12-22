import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import '@xyflow/react/dist/style.css'
import { observer } from 'mobx-react-lite'

import { rootStore } from '~/stores/RootStore'
import { AudioGraphStoreContext, useAudioGraphStore } from '~/stores/AudioGraphStore'
import { createThemeStore, ThemeStoreContext } from '~/stores/ThemeStore'
import { compositeNodeDefinitionStore } from '~/stores/CompositeNodeDefinitionStore'
import NodePalette from '~/components/NodePalette'
import PropertyPanel from '~/components/PropertyPanel'
import Header from '~/components/Header'
import GraphCanvas from '~/components/GraphCanvas'
import UpdateNotification from '~/components/UpdateNotification'
import OfflineIndicator from '~/components/OfflineIndicator'
import prebuiltCompositeNodes from '~/types/composite-nodes-prebuilt.json'
import type { CompositeNodeDefinition } from '~/types'

// Lazy load AI Chat to reduce initial bundle size (loads LangChain libs)
const AIChat = lazy(() => import('~/components/AIChat'))

// Initialize composite node definitions at app startup
const initializeCompositeNodes = () => {
  if (!compositeNodeDefinitionStore.isLoaded && !compositeNodeDefinitionStore.isLoading) {
    const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
    compositeNodeDefinitionStore.initialize(prebuiltDefs)
  }
}

// Initialize immediately when module loads
initializeCompositeNodes()

const App: React.FC = observer(() => {
  const themeStore = useMemo(() => createThemeStore(), [])

  return (
    <ThemeStoreContext.Provider value={themeStore}>
      <AudioGraphStoreContext.Provider value={rootStore.audioGraph}>
        <AppContent />
      </AudioGraphStoreContext.Provider>
    </ThemeStoreContext.Provider>
  )
})

const AppContent: React.FC = observer(() => {
  const store = useAudioGraphStore()

  // Mobile responsive state
  const [isNodePaletteOpen, setIsNodePaletteOpen] = useState(false)
  const [isPropertyPanelOpen, setIsPropertyPanelOpen] = useState(false)

  // Keyboard shortcuts for undo/redo
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
        // If there's selected text anywhere, allow normal text operations
        return
      }

      // Undo: Cmd/Ctrl + Z (without Shift)
      if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        store.undo()
        return
      }

      // Redo: Cmd/Ctrl + Y (primary and most reliable redo shortcut)
      if ((event.metaKey || event.ctrlKey) && event.key === 'y' && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        store.redo()
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
  }, [store])

  // Load metadata on mount
  useEffect(() => {
    store.loadMetadata()
  }, [store])

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
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 select-none">
      {/* Update Notification */}
      <UpdateNotification />

      {/* Offline Indicator */}
      <OfflineIndicator />

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
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full
        `}
        >
          <div className="flex-1 overflow-y-auto">
            <NodePalette onClose={handleCloseNodePalette} />
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 flex flex-col h-full">
          <GraphCanvas onNodeClick={handleNodeClick} />
        </div>

        {/* Property Panel - Desktop: sidebar, Tablet/Mobile: overlay */}
        <div
          className={`
          w-80 relative
          lg:w-80 lg:relative lg:translate-x-0
          max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:w-80 max-lg:transform max-lg:transition-transform max-lg:duration-300 max-lg:ease-in-out
          ${!isPropertyPanelOpen ? 'max-lg:translate-x-full' : 'max-lg:translate-x-0'}
          bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full
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

      {/* AI Chat Component - Lazy loaded */}
      <Suspense fallback={null}>
        <AIChat />
      </Suspense>
    </div>
  )
})

export default App
