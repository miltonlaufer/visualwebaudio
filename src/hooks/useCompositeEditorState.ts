/**
 * useCompositeEditorState Hook
 *
 * Manages the core state and computed values for the composite editor.
 * This hook centralizes the connection to stores and provides common state.
 *
 * Note: The full editor logic remains in CompositeEditorPanel for now,
 * as it's tightly coupled to the UI. This hook extracts the reusable parts.
 */

import { useMemo } from 'react'
import { compositeEditorStore } from '~/stores/CompositeEditorStore'
import {
  compositeNodeDefinitionStore,
  type ICompositeNodeDefinition,
} from '~/stores/CompositeNodeDefinitionStore'
import { useThemeStore } from '~/stores/ThemeStore'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

/******************* TYPES ***********************/

export interface UseCompositeEditorStateReturn {
  /** Whether the editor panel is open */
  isOpen: boolean
  /** ID of the definition being edited */
  definitionId: string | null
  /** Whether we're creating a new composite */
  isCreatingNew: boolean
  /** ID of the source node in main graph (if opened from a node) */
  sourceNodeId: string | null
  /** The composite node definition being edited */
  definition: ICompositeNodeDefinition | undefined
  /** Whether this is a prebuilt (read-only) composite */
  isPrebuilt: boolean
  /** Whether dark mode is enabled */
  isDark: boolean
  /** Access to audio graph store for main graph operations */
  audioGraphStore: ReturnType<typeof useAudioGraphStore>
  /** Close the editor */
  closeEditor: () => void
  /** Switch to editing a different definition (used after Save As) */
  switchToDefinition: (newDefinitionId: string) => void
  /** Set editor ready state */
  setEditorReady: (ready: boolean) => void
  /** Store error message */
  storeError: string | null
  /** Set store error message */
  setStoreError: (message: string | null) => void
  /** Clear store error */
  clearStoreError: () => void
}

/******************* HOOK ***********************/

export function useCompositeEditorState(): UseCompositeEditorStateReturn {
  const themeStore = useThemeStore()
  const audioGraphStore = useAudioGraphStore()

  // Store values
  const isOpen = compositeEditorStore.isOpen
  const definitionId = compositeEditorStore.editingDefinitionId
  const isCreatingNew = compositeEditorStore.isCreatingNew
  const sourceNodeId = compositeEditorStore.sourceNodeId
  const storeError = compositeEditorStore.error

  // Computed values
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

  // Store actions
  const closeEditor = () => compositeEditorStore.closeEditor()
  const switchToDefinition = (newId: string) => compositeEditorStore.switchToDefinition(newId)
  const setEditorReady = (ready: boolean) => compositeEditorStore.setEditorReady(ready)
  const setStoreError = (message: string | null) => compositeEditorStore.setError(message)
  const clearStoreError = () => compositeEditorStore.clearError()

  return {
    isOpen,
    definitionId,
    isCreatingNew,
    sourceNodeId,
    definition,
    isPrebuilt,
    isDark,
    audioGraphStore,
    closeEditor,
    switchToDefinition,
    setEditorReady,
    storeError,
    setStoreError,
    clearStoreError,
  }
}

export default useCompositeEditorState
