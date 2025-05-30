// Debug helpers for testing AudioParam connections in Visual Web Audio

// Helper function to create a test scenario directly in the app
export function createSliderOscillatorTest() {
  console.log('🎵 Creating SliderNode → OscillatorNode → Output test...')
  
  // Get the audio graph store from the app
  const storeContext = document.querySelector('[data-testid="audio-graph"]')
  if (!storeContext) {
    console.error('❌ Could not find audio graph context. Make sure the app is loaded.')
    return
  }
  
  // This would access the store through React context in a real app
  console.log('💡 To test manually in the Visual Web Audio app:')
  console.log('1. 🎚️ Add a SliderNode from the node palette')
  console.log('2. 🌊 Add an OscillatorNode from the node palette') 
  console.log('3. 🔊 Add an AudioDestinationNode from the node palette')
  console.log('4. 🔌 Connect SliderNode "value" output → OscillatorNode "frequency" input')
  console.log('5. 🔌 Connect OscillatorNode "output" → AudioDestinationNode "input"')
  console.log('6. ▶️ Click play to start audio')
  console.log('7. 🎚️ Move the slider - you should hear the frequency change!')
  console.log('')
  console.log('🐛 If the frequency does NOT change when you move the slider,')
  console.log('   then the AudioParam connection fix is not working properly.')
  console.log('')
  console.log('📋 Expected behavior:')
  console.log('   - Slider at 0 = very low frequency (near 0 Hz)')
  console.log('   - Slider at 50 = 50 Hz tone')
  console.log('   - Slider at 127 = 127 Hz tone')
  console.log('')
  console.log('🚫 Broken behavior (without the fix):')
  console.log('   - Slider position does not affect frequency at all')
  console.log('   - Frequency stays at 440 Hz regardless of slider')
}

// Helper to examine the current audio graph state
export function inspectAudioGraph() {
  console.log('🔍 Inspecting current audio graph...')
  
  // Try to access the global store or React context
  // This is a simplified version - in reality we'd need to access the React context properly
  console.log('💡 To inspect the current state:')
  console.log('1. Open React DevTools')
  console.log('2. Find the AudioGraphStoreProvider component')
  console.log('3. Look at the store.audioNodes and store.visualNodes')
  console.log('4. Check if AudioParam connections exist in store.audioConnections')
  console.log('')
  console.log('🔍 Key things to look for:')
  console.log('   - SliderNode should be in customNodes map')
  console.log('   - OscillatorNode should be in audioNodes map')
  console.log('   - Connection should exist with targetInput="frequency"')
  console.log('   - OscillatorNode.frequency.value should be 0 when connected to SliderNode')
}

// Helper to demonstrate the Web Audio API behavior directly
export function demonstrateWebAudioBehavior() {
  console.log('🎵 Demonstrating raw Web Audio API behavior...')
  
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    console.log('✅ Created AudioContext')
    
    // Test case 1: Normal oscillator
    console.log('\n📊 Test 1: Normal OscillatorNode behavior')
    const normalOsc = audioContext.createOscillator()
    console.log(`Normal oscillator frequency: ${normalOsc.frequency.value} Hz`)
    
    // Test case 2: Oscillator with base frequency set to 0
    console.log('\n📊 Test 2: OscillatorNode with base frequency = 0')
    const controlledOsc = audioContext.createOscillator()
    controlledOsc.frequency.value = 0
    console.log(`Controlled oscillator frequency: ${controlledOsc.frequency.value} Hz`)
    
    // Test case 3: Control source connected to frequency
    console.log('\n📊 Test 3: Adding control source')
    const controlSource = audioContext.createConstantSource()
    controlSource.offset.value = 200  // 200 Hz control signal
    
    // Connect control to frequency AudioParam
    controlSource.connect(controlledOsc.frequency)
    console.log(`Control source value: ${controlSource.offset.value} Hz`)
    console.log(`Expected final frequency: ${controlledOsc.frequency.value} + ${controlSource.offset.value} = ${controlledOsc.frequency.value + controlSource.offset.value} Hz`)
    
    console.log('\n💡 This demonstrates that:')
    console.log('   - AudioParam.value is the BASE value')
    console.log('   - Connected signals are ADDED to the base value')
    console.log('   - For direct control, base should be 0')
    console.log('   - For modulation, base should be the center frequency')
    
    // Clean up
    controlledOsc.disconnect()
    controlSource.disconnect()
    
  } catch (error) {
    console.error('❌ Error creating AudioContext:', error)
    console.log('💡 Make sure you\'re in a browser that supports Web Audio API')
  }
}

// Export all helpers to global scope if in browser
if (typeof window !== 'undefined') {
  ;(window as any).createSliderOscillatorTest = createSliderOscillatorTest
  ;(window as any).inspectAudioGraph = inspectAudioGraph  
  ;(window as any).demonstrateWebAudioBehavior = demonstrateWebAudioBehavior
  
  console.log('🛠️ Debug helpers loaded!')
  console.log('Available functions:')
  console.log('  - createSliderOscillatorTest()')
  console.log('  - inspectAudioGraph()')
  console.log('  - demonstrateWebAudioBehavior()')
  console.log('  - testAudioParamConnections() [from test file]')
} 