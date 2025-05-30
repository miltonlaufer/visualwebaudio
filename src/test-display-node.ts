/**
 * Test DisplayNode functionality for debugging MIDI to frequency conversion
 * 
 * This test demonstrates how to use DisplayNode to monitor values flowing through the audio graph.
 * Perfect for debugging the MIDI to frequency conversion issue.
 */

// Test MIDI to frequency conversion manually
export function testMidiToFreqConversion() {
  console.log('🧮 Testing MIDI to Frequency conversion manually...')
  
  const testCases = [
    { midi: 60, expectedFreq: 261.63 },
    { midi: 69, expectedFreq: 440.00 },
    { midi: 72, expectedFreq: 523.25 },
    { midi: 48, expectedFreq: 130.81 }, // C3
    { midi: 84, expectedFreq: 1046.50 } // C6
  ]
  
  testCases.forEach(({ midi, expectedFreq }) => {
    // Manual calculation: freq = 440 * 2^((midiNote - 69) / 12)
    const calculatedFreq = 440 * Math.pow(2, (midi - 69) / 12)
    const isCorrect = Math.abs(calculatedFreq - expectedFreq) < 0.1
    
    console.log(`MIDI ${midi}: Expected ${expectedFreq} Hz, Calculated ${calculatedFreq.toFixed(2)} Hz ${isCorrect ? '✅' : '❌'}`)
  })
}

// Instructions for manual testing
export function displayNodeInstructions() {
  console.log('🔍 DisplayNode Testing Instructions:')
  console.log('')
  console.log('1. 📋 Setup the test chain:')
  console.log('   • Add SliderNode (set range 0-127 for MIDI notes)')
  console.log('   • Add MidiToFreqNode')
  console.log('   • Add DisplayNode (this will show the frequency)')
  console.log('   • Add OscillatorNode')
  console.log('   • Add AudioDestinationNode')
  console.log('')
  console.log('2. 🔗 Connect the nodes:')
  console.log('   • SliderNode "value" → MidiToFreqNode "midiNote"')
  console.log('   • MidiToFreqNode "frequency" → DisplayNode "input"')
  console.log('   • DisplayNode "output" → OscillatorNode "frequency"')
  console.log('   • OscillatorNode "output" → AudioDestinationNode "input"')
  console.log('')
  console.log('3. 🎚️ Test with these MIDI values:')
  console.log('   • Slider = 60 → DisplayNode should show ~261.63 Hz (C4)')
  console.log('   • Slider = 69 → DisplayNode should show ~440.00 Hz (A4)')
  console.log('   • Slider = 72 → DisplayNode should show ~523.25 Hz (C5)')
  console.log('')
  console.log('4. 🔧 Debugging tips:')
  console.log('   • If DisplayNode shows 0: MidiToFreqNode not receiving input')
  console.log('   • If DisplayNode shows wrong value: Check MidiToFreqNode calculation')
  console.log('   • If sound doesn\'t change: Check OscillatorNode frequency connection')
  console.log('')
  console.log('5. 🎵 Expected behavior:')
  console.log('   • DisplayNode shows the exact frequency value')
  console.log('   • Sound pitch changes as you move the slider')
  console.log('   • Higher MIDI numbers = higher frequencies = higher pitch')
}

// Browser console helper functions
export function createDisplayNodeTest() {
  console.log('🎛️ DisplayNode Test Helper')
  console.log('')
  console.log('Available functions:')
  console.log('• testMidiToFreq() - Test MIDI to frequency calculations')
  console.log('• displayNodeInstructions() - Show setup instructions')
  console.log('')
  console.log('💡 The DisplayNode will show you exactly what frequency values')
  console.log('   are flowing through your audio graph - perfect for debugging!')
}

// Add to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).testMidiToFreq = testMidiToFreqConversion;
  (window as any).displayNodeInstructions = displayNodeInstructions;
  (window as any).createDisplayNodeTest = createDisplayNodeTest;
} 