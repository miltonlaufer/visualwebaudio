import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from '~/components/ErrorBoundary'

// Import the AudioParam connection test for browser debugging
import { testAudioParamConnections } from './test-audioparam-connection.ts'

// Import debug helpers
import './debug-helpers.ts'

// Import DisplayNode test helpers for debugging MIDI to frequency conversion
import './test-display-node.ts'

// Import test helpers for browser console debugging
import './test-display-node'
import './test-custom-ui'

// Make the test available globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).testAudioParamConnections = testAudioParamConnections
  console.log('🎵 AudioParam connection test available in console!')
  console.log('Run: testAudioParamConnections() to test the audio connections')
  console.log('')
  console.log('🎛️ DisplayNode debugging helpers available:')
  console.log('• testMidiToFreq() - Test MIDI to frequency calculations')
  console.log('• displayNodeInstructions() - Show setup instructions')
  console.log('• createDisplayNodeTest() - Show available functions')
  console.log('')
  console.log('🔧 Custom Node debugging helpers available:')
  console.log('• testCustomNodeUI() - Test custom node UI creation')
  console.log('• testDisplayNodeConnections() - Test DisplayNode connections')
  console.log('• debugCustomNodeConnections() - Debug connection states')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
