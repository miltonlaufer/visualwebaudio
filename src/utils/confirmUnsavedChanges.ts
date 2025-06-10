import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'

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
  // If there are no nodes or no modifications, allow the action
  if (store.adaptedNodes.length === 0 || !store.isProjectModified) {
    return true
  }

  // Show confirmation dialog
  return confirm(message)
}
