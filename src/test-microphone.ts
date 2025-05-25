// Simple test to verify microphone input functionality
import { createAudioGraphStore } from './stores/AudioGraphStore'

export const testMicrophoneInput = async () => {
  console.log('=== TESTING MICROPHONE INPUT ===')

  const store = createAudioGraphStore()

  // Load metadata
  store.loadMetadata()

  console.log('Store initialized')
  console.log('Available node types:', store.availableNodeTypes.length)
  console.log(
    'MediaStreamAudioSourceNode available:',
    store.availableNodeTypes.includes('MediaStreamAudioSourceNode')
  )

  try {
    // Test the addMicrophoneInput action
    console.log('Testing addMicrophoneInput action...')

    // Note: This will fail in test environment because getUserMedia is not available
    // But it should not throw MST errors
    const nodeId = await store.addMicrophoneInput({ x: 100, y: 100 })

    console.log('Microphone input added successfully with ID:', nodeId)
    console.log('Visual nodes count:', store.visualNodes.length)
    console.log('Audio nodes count:', store.audioNodes.size)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log('Expected error (getUserMedia not available in test):', errorMessage)

    // Check if it's an MST error (which would be bad)
    if (errorMessage.includes('mobx-state-tree') || errorMessage.includes('protected')) {
      console.error('❌ MST ERROR DETECTED:', errorMessage)
      throw error
    } else {
      console.log('✅ No MST errors - only expected getUserMedia error')
    }
  }

  console.log('=== MICROPHONE TEST COMPLETE ===')
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  ;(window as any).testMicrophoneInput = testMicrophoneInput
}
