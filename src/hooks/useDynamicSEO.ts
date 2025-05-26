import { useEffect } from 'react'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

export const useDynamicSEO = () => {
  const store = useAudioGraphStore()

  useEffect(() => {
    // Update page title based on project state
    const nodeCount = store.visualNodes.length
    const connectionCount = store.visualEdges.length

    let dynamicTitle = 'Visual Web Audio (alpha)'

    if (nodeCount > 0) {
      dynamicTitle += ` - ${nodeCount} node${nodeCount !== 1 ? 's' : ''}`

      if (connectionCount > 0) {
        dynamicTitle += `, ${connectionCount} connection${connectionCount !== 1 ? 's' : ''}`
      }
    }

    // Update document title directly for immediate feedback
    document.title = dynamicTitle

    // Generate dynamic description based on nodes (for future use)
    // This could be used for dynamic meta tag updates in the future
    if (nodeCount > 0) {
      const nodeTypes = [
        ...new Set(store.visualNodes.map(node => node.data.nodeType.replace('Node', ''))),
      ]

      if (nodeTypes.length > 0) {
        // Future: Could update meta description dynamically
        console.debug(
          `Project contains: ${nodeTypes.slice(0, 3).join(', ')}${nodeTypes.length > 3 ? ` and ${nodeTypes.length - 3} more` : ''}`
        )
      }
    }

    // Store dynamic values for potential use in components
    return () => {
      // Cleanup if needed
    }
  }, [store.visualNodes.length, store.visualEdges.length, store.visualNodes])

  return {
    nodeCount: store.visualNodes.length,
    connectionCount: store.visualEdges.length,
    isPlaying: store.isPlaying,
  }
}
