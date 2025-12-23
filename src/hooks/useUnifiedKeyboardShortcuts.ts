/**
 * Unified Keyboard Shortcuts Hook
 *
 * Centralized keyboard handling for graph operations.
 * Routes keyboard shortcuts to the active context (main graph or composite editor).
 *
 * This hook should be used at the App level to provide global keyboard handling.
 * Individual graph components should NOT register their own keyboard handlers.
 */

import { useEffect, useCallback } from 'react'
import { graphFocusStore } from '~/stores/GraphFocusStore'

/******************* TYPES ***********************/

export interface UseUnifiedKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean
  /** Callback after successful copy */
  onCopy?: () => void
  /** Callback after successful cut */
  onCut?: () => void
  /** Callback after successful paste */
  onPaste?: () => void
  /** Callback after successful delete */
  onDelete?: () => void
  /** Callback after successful undo */
  onUndo?: () => void
  /** Callback after successful redo */
  onRedo?: () => void
}

/******************* HOOK ***********************/

export function useUnifiedKeyboardShortcuts(
  options: UseUnifiedKeyboardShortcutsOptions = {}
): void {
  const { enabled = true, onCopy, onCut, onPaste, onDelete, onUndo, onRedo } = options

  /******************* KEYBOARD HANDLER ***********************/

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Don't handle if user is typing in an input/textarea
      const target = event.target as HTMLElement
      const isInputElement =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (isInputElement) {
        // Allow Escape to work even in inputs
        if (event.key !== 'Escape') {
          return
        }
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? event.metaKey : event.ctrlKey

      // Copy: Ctrl/Cmd + C
      if (modKey && event.key === 'c' && !event.shiftKey) {
        const success = graphFocusStore.copy()
        if (success) {
          event.preventDefault()
          event.stopPropagation()
          onCopy?.()
        }
        return
      }

      // Cut: Ctrl/Cmd + X
      if (modKey && event.key === 'x' && !event.shiftKey) {
        const success = graphFocusStore.cut()
        if (success) {
          event.preventDefault()
          event.stopPropagation()
          onCut?.()
        }
        return
      }

      // Paste: Ctrl/Cmd + V
      if (modKey && event.key === 'v' && !event.shiftKey) {
        const success = graphFocusStore.paste()
        if (success) {
          event.preventDefault()
          event.stopPropagation()
          onPaste?.()
        }
        return
      }

      // Undo: Ctrl/Cmd + Z (without Shift)
      if (modKey && event.key === 'z' && !event.shiftKey) {
        const success = graphFocusStore.undo()
        if (success) {
          event.preventDefault()
          event.stopPropagation()
          onUndo?.()
        }
        return
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if ((modKey && event.shiftKey && event.key === 'z') || (modKey && event.key === 'y')) {
        const success = graphFocusStore.redo()
        if (success) {
          event.preventDefault()
          event.stopPropagation()
          onRedo?.()
        }
        return
      }

      // Delete: Delete or Backspace key
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Don't delete if in an input
        if (isInputElement) return

        const success = graphFocusStore.deleteSelected()
        if (success) {
          event.preventDefault()
          event.stopPropagation()
          onDelete?.()
        }
        return
      }
    },
    [enabled, onCopy, onCut, onPaste, onDelete, onUndo, onRedo]
  )

  /******************* EFFECT ***********************/

  useEffect(() => {
    if (!enabled) return

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [enabled, handleKeyDown])
}

export default useUnifiedKeyboardShortcuts
