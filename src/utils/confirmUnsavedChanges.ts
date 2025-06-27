import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import { getParent } from 'mobx-state-tree'
import type { IRootStore } from '~/stores/RootStore'

/**
 * Checks if there are unsaved changes and shows a confirmation dialog if needed.
 * @param store - The audio graph store instance
 * @param message - Custom message to show in the confirmation dialog
 * @returns true if the user confirms or there are no unsaved changes, false if the user cancels
 */
export function confirmUnsavedChanges(
  store: AudioGraphStoreType,
  message: string = 'You will lose your changes. Are you sure you want to continue?'
): boolean {
  // If there are no nodes, allow the action
  if (store.adaptedNodes.length === 0) {
    return true
  }

  // Get the root store to check project modification state
  try {
    const rootStore = getParent(store) as IRootStore
    if (!rootStore.isProjectModified) {
      return true
    }
  } catch (error) {
    // If we can't get the parent store, assume modifications exist to be safe
    console.warn('Could not access root store for project modification check:', error)
  }

  // Show confirmation dialog
  return confirm(message)
}
