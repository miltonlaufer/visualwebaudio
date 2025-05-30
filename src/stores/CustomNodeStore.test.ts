import { describe, it, expect, beforeEach } from 'vitest'
import { customNodeStore } from './CustomNodeStore'

describe('CustomNodeStore Reactive Connections', () => {
  beforeEach(() => {
    // Clear the store before each test
    customNodeStore.clear()
  })

  it('should reactively update target node when source node output changes', async () => {
    // Create SliderNode metadata
    const sliderMetadata = {
      properties: [
        { name: 'value', defaultValue: 50 },
        { name: 'min', defaultValue: 0 },
        { name: 'max', defaultValue: 100 },
        { name: 'step', defaultValue: 1 },
      ],
      outputs: [{ name: 'value' }],
    }

    // Create DisplayNode metadata
    const displayMetadata = {
      properties: [
        { name: 'currentValue', defaultValue: 0 },
        { name: 'label', defaultValue: 'Display' },
      ],
      inputs: [{ name: 'input' }],
      outputs: [{ name: 'output' }],
    }

    // Add nodes to the store
    const sliderNode = customNodeStore.addNode('test-slider', 'SliderNode', sliderMetadata)
    const displayNode = customNodeStore.addNode('test-display', 'DisplayNode', displayMetadata)

    // Verify initial state
    expect(sliderNode.properties.get('value')).toBe(50)
    expect(sliderNode.outputs.get('value')).toBe(50)
    expect(displayNode.properties.get('currentValue')).toBe(0)

    // Create reactive connection
    customNodeStore.connectNodes('test-slider', 'test-display', 'value', 'input')

    // Display should now show the slider value reactively
    expect(displayNode.properties.get('currentValue')).toBe(50)

    // Change slider value and verify reactive update
    sliderNode.setProperty('value', 75)
    expect(sliderNode.outputs.get('value')).toBe(75)
    expect(displayNode.properties.get('currentValue')).toBe(75)

    // Change again to confirm reactivity
    sliderNode.setProperty('value', 25)
    expect(displayNode.properties.get('currentValue')).toBe(25)
  })

  it('should handle multiple connections to the same target', () => {
    // Create two slider nodes and one display node
    const slider1Metadata = {
      properties: [{ name: 'value', defaultValue: 10 }],
      outputs: [{ name: 'value' }],
    }

    const slider2Metadata = {
      properties: [{ name: 'value', defaultValue: 20 }],
      outputs: [{ name: 'value' }],
    }

    const displayMetadata = {
      properties: [{ name: 'currentValue', defaultValue: 0 }],
      inputs: [{ name: 'input' }],
    }

    const slider1 = customNodeStore.addNode('slider1', 'SliderNode', slider1Metadata)
    const slider2 = customNodeStore.addNode('slider2', 'SliderNode', slider2Metadata)
    const display = customNodeStore.addNode('display', 'DisplayNode', displayMetadata)

    // Connect first slider (should update display to 10)
    customNodeStore.connectNodes('slider1', 'display', 'value', 'input')
    expect(display.properties.get('currentValue')).toBe(10)

    // Connect second slider to same input (should update display to 20)
    customNodeStore.connectNodes('slider2', 'display', 'value', 'input')
    expect(display.properties.get('currentValue')).toBe(20) // Last connection wins

    // Verify both connections exist
    expect(display.inputConnections).toHaveLength(2)

    // Changing slider1 should still update display
    slider1.setProperty('value', 100)
    expect(display.properties.get('currentValue')).toBe(100)

    // Changing slider2 should also update display
    slider2.setProperty('value', 200)
    expect(display.properties.get('currentValue')).toBe(200)
  })

  it('should properly dispose connections when removing nodes', () => {
    const sliderMetadata = {
      properties: [{ name: 'value', defaultValue: 50 }],
      outputs: [{ name: 'value' }],
    }

    const displayMetadata = {
      properties: [{ name: 'currentValue', defaultValue: 0 }],
      inputs: [{ name: 'input' }],
    }

    customNodeStore.addNode('slider', 'SliderNode', sliderMetadata)
    const display = customNodeStore.addNode('display', 'DisplayNode', displayMetadata)

    // Connect nodes
    customNodeStore.connectNodes('slider', 'display', 'value', 'input')
    expect(display.inputConnections).toHaveLength(1)

    // Remove slider node
    customNodeStore.removeNode('slider')

    // Display should have its input connection removed
    expect(display.inputConnections).toHaveLength(0)

    // Verify slider is gone
    expect(customNodeStore.getNode('slider')).toBeUndefined()
    expect(customNodeStore.getNode('display')).toBeDefined()
  })

  it('should disconnect specific connections', () => {
    const sliderMetadata = {
      properties: [{ name: 'value', defaultValue: 50 }],
      outputs: [{ name: 'value' }],
    }

    const displayMetadata = {
      properties: [{ name: 'currentValue', defaultValue: 0 }],
      inputs: [{ name: 'input' }],
    }

    const slider = customNodeStore.addNode('slider', 'SliderNode', sliderMetadata)
    const display = customNodeStore.addNode('display', 'DisplayNode', displayMetadata)

    // Connect nodes
    customNodeStore.connectNodes('slider', 'display', 'value', 'input')
    expect(display.inputConnections).toHaveLength(1)
    expect(display.properties.get('currentValue')).toBe(50)

    // Disconnect
    customNodeStore.disconnectNodes('slider', 'display', 'value', 'input')
    expect(display.inputConnections).toHaveLength(0)

    // Changes to slider should no longer affect display
    slider.setProperty('value', 999)
    expect(display.properties.get('currentValue')).toBe(50) // Should remain unchanged
  })

  it('should handle MidiToFreqNode conversion reactively', () => {
    const midiMetadata = {
      properties: [
        { name: 'baseFreq', defaultValue: 440 },
        { name: 'baseMidi', defaultValue: 69 },
      ],
      inputs: [{ name: 'midiNote' }],
      outputs: [{ name: 'frequency' }],
    }

    const sliderMetadata = {
      properties: [{ name: 'value', defaultValue: 60 }], // MIDI note 60 (middle C)
      outputs: [{ name: 'value' }],
    }

    const slider = customNodeStore.addNode('slider', 'SliderNode', sliderMetadata)
    const midiToFreq = customNodeStore.addNode('midi', 'MidiToFreqNode', midiMetadata)

    // Connect slider to MIDI converter
    customNodeStore.connectNodes('slider', 'midi', 'value', 'midiNote')

    // Should calculate frequency for MIDI note 60
    // Formula: 440 * 2^((60-69)/12) = 440 * 2^(-0.75) ≈ 261.63 Hz (middle C)
    const expectedFreq = 440 * Math.pow(2, (60 - 69) / 12)
    expect(midiToFreq.outputs.get('frequency')).toBeCloseTo(expectedFreq, 2)

    // Change MIDI note and verify reactive update
    slider.setProperty('value', 69) // A4 = 440 Hz
    expect(midiToFreq.outputs.get('frequency')).toBeCloseTo(440, 2)
  })

  it('should handle complete MIDI to frequency chain with Display nodes', () => {
    // Create SliderNode for MIDI input (range 0-127)
    const midiSliderMetadata = {
      properties: [
        { name: 'value', defaultValue: 60 }, // Middle C
        { name: 'min', defaultValue: 0 },
        { name: 'max', defaultValue: 127 },
        { name: 'step', defaultValue: 1 },
      ],
      outputs: [{ name: 'value' }],
    }

    // Create MidiToFreqNode for conversion
    const midiToFreqMetadata = {
      properties: [
        { name: 'baseFreq', defaultValue: 440 }, // A4 frequency
        { name: 'baseMidi', defaultValue: 69 }, // A4 MIDI note
      ],
      inputs: [{ name: 'midiNote' }],
      outputs: [{ name: 'frequency' }],
    }

    // Create DisplayNode for MIDI note
    const midiDisplayMetadata = {
      properties: [
        { name: 'currentValue', defaultValue: 0 },
        { name: 'label', defaultValue: 'MIDI Note' },
      ],
      inputs: [{ name: 'input' }],
      outputs: [{ name: 'output' }],
    }

    // Create DisplayNode for frequency
    const freqDisplayMetadata = {
      properties: [
        { name: 'currentValue', defaultValue: 0 },
        { name: 'label', defaultValue: 'Frequency' },
      ],
      inputs: [{ name: 'input' }],
      outputs: [{ name: 'output' }],
    }

    // Add all nodes to the store
    const midiSlider = customNodeStore.addNode('midi-slider', 'SliderNode', midiSliderMetadata)
    const midiToFreq = customNodeStore.addNode('midi-to-freq', 'MidiToFreqNode', midiToFreqMetadata)
    const midiDisplay = customNodeStore.addNode('midi-display', 'DisplayNode', midiDisplayMetadata)
    const freqDisplay = customNodeStore.addNode('freq-display', 'DisplayNode', freqDisplayMetadata)

    // Verify initial states
    expect(midiSlider.properties.get('value')).toBe(60)
    expect(midiSlider.outputs.get('value')).toBe(60)
    expect(midiDisplay.properties.get('currentValue')).toBe(0)
    expect(freqDisplay.properties.get('currentValue')).toBe(0)

    // Create the reactive chain:
    // MidiSlider -> MidiDisplay (to show MIDI note)
    // MidiSlider -> MidiToFreq (to convert MIDI to frequency)
    // MidiToFreq -> FreqDisplay (to show frequency)
    customNodeStore.connectNodes('midi-slider', 'midi-display', 'value', 'input')
    customNodeStore.connectNodes('midi-slider', 'midi-to-freq', 'value', 'midiNote')
    customNodeStore.connectNodes('midi-to-freq', 'freq-display', 'frequency', 'input')

    // Verify connections were created
    expect(midiDisplay.inputConnections).toHaveLength(1)
    expect(midiToFreq.inputConnections).toHaveLength(1)
    expect(freqDisplay.inputConnections).toHaveLength(1)

    // Check initial reactive state (should fire immediately)
    expect(midiDisplay.properties.get('currentValue')).toBe(60) // Shows MIDI note

    // Calculate expected frequency for MIDI 60 (middle C)
    const expectedFreqC = 440 * Math.pow(2, (60 - 69) / 12) // ≈ 261.63 Hz
    expect(midiToFreq.outputs.get('frequency')).toBeCloseTo(expectedFreqC, 2)
    expect(freqDisplay.properties.get('currentValue')).toBeCloseTo(expectedFreqC, 2)

    // Test reactive updates: Change to MIDI note 69 (A4 = 440 Hz)
    midiSlider.setProperty('value', 69)

    // Verify the entire chain updated reactively
    expect(midiSlider.properties.get('value')).toBe(69)
    expect(midiSlider.outputs.get('value')).toBe(69)
    expect(midiDisplay.properties.get('currentValue')).toBe(69) // Shows MIDI note 69
    expect(midiToFreq.outputs.get('frequency')).toBeCloseTo(440, 2) // A4 frequency
    expect(freqDisplay.properties.get('currentValue')).toBeCloseTo(440, 2) // Shows 440 Hz

    // Test another note: MIDI 72 (C5)
    midiSlider.setProperty('value', 72)

    const expectedFreqC5 = 440 * Math.pow(2, (72 - 69) / 12) // ≈ 523.25 Hz
    expect(midiDisplay.properties.get('currentValue')).toBe(72)
    expect(midiToFreq.outputs.get('frequency')).toBeCloseTo(expectedFreqC5, 2)
    expect(freqDisplay.properties.get('currentValue')).toBeCloseTo(expectedFreqC5, 2)

    // Test edge case: MIDI 0 (very low frequency)
    midiSlider.setProperty('value', 0)

    const expectedFreqLow = 440 * Math.pow(2, (0 - 69) / 12) // ≈ 8.18 Hz
    expect(midiDisplay.properties.get('currentValue')).toBe(0)
    expect(midiToFreq.outputs.get('frequency')).toBeCloseTo(expectedFreqLow, 2)
    expect(freqDisplay.properties.get('currentValue')).toBeCloseTo(expectedFreqLow, 2)

    // Test high note: MIDI 127 (very high frequency)
    midiSlider.setProperty('value', 127)

    const expectedFreqHigh = 440 * Math.pow(2, (127 - 69) / 12) // ≈ 12543.85 Hz
    expect(midiDisplay.properties.get('currentValue')).toBe(127)
    expect(midiToFreq.outputs.get('frequency')).toBeCloseTo(expectedFreqHigh, 1)
    expect(freqDisplay.properties.get('currentValue')).toBeCloseTo(expectedFreqHigh, 1)
  })
})
