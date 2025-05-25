// Simple test to verify frequency analyzer functionality
import { createAudioGraphStore } from './stores/AudioGraphStore'

export const testFrequencyAnalyzer = () => {
  console.log('=== TESTING FREQUENCY ANALYZER ===')

  const store = createAudioGraphStore()

  // Load metadata
  store.loadMetadata()

  // Initialize audio context
  store.initializeAudioContext()

  console.log('Audio context created:', !!store.audioContext)
  console.log('Global analyzer created:', !!store.frequencyAnalyzer)

  if (store.frequencyAnalyzer) {
    console.log('Analyzer FFT size:', store.frequencyAnalyzer.fftSize)
    console.log('Analyzer frequency bin count:', store.frequencyAnalyzer.frequencyBinCount)
    console.log('Analyzer smoothing time constant:', store.frequencyAnalyzer.smoothingTimeConstant)
  }

  // Create test nodes
  const oscId = store.addNode('OscillatorNode', { x: 100, y: 100 })
  const destId = store.addNode('AudioDestinationNode', { x: 300, y: 100 })

  console.log('Created oscillator:', oscId)
  console.log('Created destination:', destId)

  // Connect them
  store.addEdge(oscId, destId)

  console.log('Connected oscillator to destination')
  console.log('Is playing:', store.isPlaying)
  console.log('Audio connections:', store.audioConnections.length)

  // Test frequency data
  if (store.frequencyAnalyzer) {
    const dataArray = new Uint8Array(store.frequencyAnalyzer.frequencyBinCount)
    store.frequencyAnalyzer.getByteFrequencyData(dataArray)

    const maxValue = Math.max(...dataArray)
    const avgValue = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length

    console.log('Frequency data - Max:', maxValue, 'Avg:', avgValue.toFixed(2))
  }

  console.log('=== TEST COMPLETE ===')

  return store
}
