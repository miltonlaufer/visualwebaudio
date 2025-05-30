// Test custom node UI creation
export function testCustomNodeUI() {
  console.log('🧪 Testing Custom Node UI Creation')
  console.log('=====================================')
  
  // Instructions for manual testing
  console.log('1. Add a SliderNode to the canvas')
  console.log('2. Add a ButtonNode to the canvas') 
  console.log('3. Check if the slider and button UI elements appear')
  console.log('4. Try moving the slider - it should update values')
  console.log('5. Try clicking the button - it should trigger events')
  
  console.log('')
  console.log('Expected behavior:')
  console.log('• SliderNode should show a horizontal slider control')
  console.log('• ButtonNode should show a clickable button')
  console.log('• Both should be interactive and update their output values')
  
  console.log('')
  console.log('If UI elements are missing, check browser console for:')
  console.log('• "Custom node found for [nodeId]" messages')
  console.log('• "Created UI for custom node" success messages')
  console.log('• Any error messages about createUIElement')
}

// Test DisplayNode connections specifically
export function testDisplayNodeConnections() {
  console.log('🔍 Testing DisplayNode Connections')
  console.log('===================================')
  
  console.log('1. 📋 Create test chain:')
  console.log('   • Add SliderNode')
  console.log('   • Add DisplayNode')
  console.log('   • Connect SliderNode "value" → DisplayNode "input"')
  console.log('')
  
  console.log('2. 🎚️ Test the connection:')
  console.log('   • Move the slider')
  console.log('   • DisplayNode should show the slider value in real-time')
  console.log('   • Value should update immediately as you drag')
  console.log('')
  
  console.log('3. 🎛️ Test DisplayNode → OscillatorNode:')
  console.log('   • Add OscillatorNode and AudioDestinationNode')
  console.log('   • Connect DisplayNode "output" → OscillatorNode "frequency"')
  console.log('   • Connect OscillatorNode → AudioDestinationNode')
  console.log('   • Click Play - you should hear a tone')
  console.log('   • Move slider → DisplayNode should update → frequency should change')
  console.log('   • Look for "🌉 Updated bridge" messages in console')
  console.log('')
  
  console.log('4. 🔧 If DisplayNode shows 0 or doesn\'t update:')
  console.log('   • Check console for "Connected custom node" messages')
  console.log('   • Look for receiveInput debug messages')
  console.log('   • Verify slider is outputting values')
  console.log('')
  
  console.log('5. 🧪 Test chain: SliderNode → DisplayNode → OscillatorNode → Output')
  console.log('   • DisplayNode shows MIDI note or frequency value')
  console.log('   • Sound frequency changes when you move the slider')
  console.log('')
  
  console.log('🎯 Expected console output for working system:')
  console.log('   • "🎚️ SliderNode X value changed to: Y"')
  console.log('   • "🔍 DisplayNode X receiveInput: input = Y"')
  console.log('   • "📊 DisplayNode X updated display to: Y"')
  console.log('   • "🌉 Updated bridge for X output output: Y"')
}

// Debug custom node connection states
export function debugCustomNodeConnections() {
  const store = (window as any).__STORE__
  if (!store) {
    console.log('❌ Store not available in window.__STORE__')
    return
  }
  
  console.log('🔍 Custom Node Connection Debug')
  console.log('================================')
  
  console.log('Custom nodes:', store.customNodes.size)
  store.customNodes.forEach((node: any, id: string) => {
    console.log(`• ${id}: ${node.type}`)
    console.log(`  Properties:`, Array.from(node.properties.entries()))
    console.log(`  Outputs:`, Array.from(node.outputs.entries()))
  })
  
  console.log('')
  console.log('Audio connections:')
  store.audioConnections.forEach((conn: any) => {
    console.log(`• ${conn.sourceNodeId} → ${conn.targetNodeId}`)
    console.log(`  ${conn.sourceOutput} → ${conn.targetInput}`)
  })
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).testCustomNodeUI = testCustomNodeUI
  ;(window as any).testDisplayNodeConnections = testDisplayNodeConnections
  ;(window as any).debugCustomNodeConnections = debugCustomNodeConnections
} 