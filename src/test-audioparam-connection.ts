// Simple integration test for AudioParam connections
// Run this in the browser console to test the functionality

// Test function that creates a real audio setup to verify connections work
function testAudioParamConnections() {
  console.log('🎵 Testing AudioParam Connections...')
  
  // Create real Web Audio API context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  
  console.log('✅ AudioContext created:', audioContext.state)
  
  // Test 1: Create oscillator and manually test frequency control
  console.log('\n📊 Test 1: Manual Frequency Control')
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  
  // Connect oscillator -> gain -> destination
  osc.connect(gain)
  gain.connect(audioContext.destination)
  
  // Set gain low so it's not too loud
  gain.gain.value = 0.1
  
  console.log('Initial frequency:', osc.frequency.value) // Should be 440
  
  // Start the oscillator
  osc.start()
  console.log('🔊 Started oscillator at 440 Hz (default)')
  
  // Test changing frequency directly
  setTimeout(() => {
    osc.frequency.value = 220
    console.log('🔄 Changed frequency to 220 Hz directly')
  }, 1000)
  
  setTimeout(() => {
    osc.frequency.value = 880
    console.log('🔄 Changed frequency to 880 Hz directly')
  }, 2000)
  
  setTimeout(() => {
    osc.stop()
    console.log('⏹️ Stopped oscillator')
  }, 3000)
  
  // Test 2: Create controlled oscillator (simulating SliderNode connection)
  console.log('\n📊 Test 2: Simulated SliderNode -> OscillatorNode connection')
  
  setTimeout(() => {
    // Create second oscillator for controlled test
    const controlledOsc = audioContext.createOscillator()
    const controlledGain = audioContext.createGain()
    
    controlledOsc.connect(controlledGain)
    controlledGain.connect(audioContext.destination)
    controlledGain.gain.value = 0.1
    
    // Simulate the "slider connection" logic
    console.log('🔌 Simulating SliderNode connection to frequency...')
    console.log('Original frequency:', controlledOsc.frequency.value)
    
    // This is what SHOULD happen when connecting a SliderNode to frequency
    controlledOsc.frequency.value = 0  // Set base to 0 for direct control
    console.log('Set base frequency to 0 for direct control')
    
    // Create a "control source" (simulating SliderNode output)
    const controlSource = audioContext.createConstantSource()
    controlSource.offset.value = 330  // Simulating slider at 330 Hz
    
    // Connect control source to frequency AudioParam
    controlSource.connect(controlledOsc.frequency)
    console.log('🔌 Connected control source (330 Hz) to frequency AudioParam')
    
    // Start both
    controlSource.start()
    controlledOsc.start()
    console.log('🔊 Started controlled oscillator - should be 330 Hz (0 + 330)')
    
    // Test changing the control value
    setTimeout(() => {
      controlSource.offset.value = 660
      console.log('🔄 Changed control to 660 Hz - should hear frequency change')
    }, 1000)
    
    setTimeout(() => {
      controlSource.offset.value = 110
      console.log('🔄 Changed control to 110 Hz - should hear frequency change')
    }, 2000)
    
    setTimeout(() => {
      controlledOsc.stop()
      controlSource.stop()
      console.log('⏹️ Stopped controlled oscillator test')
    }, 3000)
    
  }, 4000)
  
  // Test 3: Test the problem case (base frequency not set to 0)
  console.log('\n📊 Test 3: Problem case - base frequency NOT set to 0')
  
  setTimeout(() => {
    const problemOsc = audioContext.createOscillator()
    const problemGain = audioContext.createGain()
    
    problemOsc.connect(problemGain)
    problemGain.connect(audioContext.destination)
    problemGain.gain.value = 0.1
    
    console.log('🚫 NOT setting base frequency to 0 (this is the bug)')
    console.log('Base frequency remains:', problemOsc.frequency.value) // 440
    
    const problemControl = audioContext.createConstantSource()
    problemControl.offset.value = 100  // Small control signal
    
    problemControl.connect(problemOsc.frequency)
    console.log('🔌 Connected small control (100 Hz) to frequency')
    console.log('Expected result: 440 + 100 = 540 Hz (not what user wants!)')
    
    problemControl.start()
    problemOsc.start()
    console.log('🔊 Started problem oscillator - will be 540 Hz instead of 100 Hz')
    
    setTimeout(() => {
      problemControl.offset.value = 200
      console.log('🔄 Changed control to 200 Hz - will be 640 Hz (440+200) instead of 200 Hz')
    }, 1000)
    
    setTimeout(() => {
      problemOsc.stop()
      problemControl.stop()
      console.log('⏹️ Stopped problem oscillator test')
      
      console.log('\n🎯 TEST COMPLETE!')
      console.log('✅ Test 2 shows correct behavior (base=0, direct control)')
      console.log('❌ Test 3 shows incorrect behavior (base=440, additive)')
      console.log('💡 Our fix should make all connections behave like Test 2')
      
    }, 2000)
    
  }, 8000)
}

// Export for browser console use
if (typeof window !== 'undefined') {
  (window as any).testAudioParamConnections = testAudioParamConnections
  console.log('🎵 AudioParam connection test loaded!')
  console.log('Run: testAudioParamConnections() to start the test')
}

export { testAudioParamConnections } 