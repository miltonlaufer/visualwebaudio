import { describe, it, expect, beforeEach } from 'vitest'
import { RootStore, type IRootStore } from '~/stores/RootStore'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'

/**
 * Tests for the control connection UI update fix.
 *
 * When a custom node (like MidiToFreq or Slider) outputs a value that
 * connects to an audio node's parameter (like Oscillator's frequency),
 * the target node's property in the store should be updated so the UI
 * reflects the new value.
 */
describe('Control Connection UI Update', () => {
  let store: AudioGraphStoreType
  let rootStore: IRootStore

  beforeEach(() => {
    rootStore = RootStore.create({ audioGraph: { history: {} } })
    store = rootStore.audioGraph
    store.loadMetadata()

    // Initialize audio context and store
    store.initializeAudioContext()
    store.init()
  })

  describe('updateCustomNodeBridges', () => {
    it('should update target node property when control connection receives new value', () => {
      // Create a SliderNode (custom node) and an OscillatorNode
      const sliderId = store.addAdaptedNode('SliderNode', { x: 0, y: 0 })
      const oscillatorId = store.addAdaptedNode('OscillatorNode', { x: 200, y: 0 })

      // Get the nodes
      const sliderNode = store.adaptedNodes.find(n => n.id === sliderId)
      const oscillatorNode = store.adaptedNodes.find(n => n.id === oscillatorId)

      expect(sliderNode).toBeDefined()
      expect(oscillatorNode).toBeDefined()

      // Connect slider output to oscillator frequency
      store.addEdge(sliderId, oscillatorId, 'value', 'frequency')

      // Verify the connection was created
      const connection = store.audioConnections.find(
        c => c.sourceNodeId === sliderId && c.targetNodeId === oscillatorId
      )
      expect(connection).toBeDefined()
      expect(connection?.targetInput).toBe('frequency')

      // Simulate updating the control connection with a new value
      // This is what happens when the slider value changes
      store.updateCustomNodeBridges(sliderId, 'value', 440)

      // The target node's property should be updated for UI display
      const updatedOscillatorNode = store.adaptedNodes.find(n => n.id === oscillatorId)
      expect(updatedOscillatorNode?.properties.get('frequency')).toBe(440)
    })

    it('should trigger property change counter when updating target node property', () => {
      // Create nodes
      const sliderId = store.addAdaptedNode('SliderNode', { x: 0, y: 0 })
      const oscillatorId = store.addAdaptedNode('OscillatorNode', { x: 200, y: 0 })

      // Connect them
      store.addEdge(sliderId, oscillatorId, 'value', 'frequency')

      // Get initial counter
      const initialCounter = rootStore.propertyChangeCounter

      // Update the connection value
      store.updateCustomNodeBridges(sliderId, 'value', 880)

      // Property change counter should have incremented
      expect(rootStore.propertyChangeCounter).toBeGreaterThan(initialCounter)
    })

    it('should update frequency property with MidiToFreq node output', () => {
      // Create MidiToFreqNode and OscillatorNode
      const midiToFreqId = store.addAdaptedNode('MidiToFreqNode', { x: 0, y: 0 })
      const oscillatorId = store.addAdaptedNode('OscillatorNode', { x: 200, y: 0 })

      // Connect MidiToFreq output to oscillator frequency
      store.addEdge(midiToFreqId, oscillatorId, 'frequency', 'frequency')

      // Simulate MidiToFreq outputting A4 (440 Hz)
      store.updateCustomNodeBridges(midiToFreqId, 'frequency', 440)

      // Oscillator's frequency property should reflect the new value
      const oscillatorNode = store.adaptedNodes.find(n => n.id === oscillatorId)
      expect(oscillatorNode?.properties.get('frequency')).toBe(440)
    })

    it('should update gain property when connected to GainNode', () => {
      // Create SliderNode and GainNode
      const sliderId = store.addAdaptedNode('SliderNode', { x: 0, y: 0 })
      const gainId = store.addAdaptedNode('GainNode', { x: 200, y: 0 })

      // Connect slider to gain
      store.addEdge(sliderId, gainId, 'value', 'gain')

      // Update with new gain value
      store.updateCustomNodeBridges(sliderId, 'value', 0.5)

      // GainNode's gain property should be updated
      const gainNode = store.adaptedNodes.find(n => n.id === gainId)
      expect(gainNode?.properties.get('gain')).toBe(0.5)
    })

    it('should not update properties for non-matching output names', () => {
      // Create nodes and connect
      const sliderId = store.addAdaptedNode('SliderNode', { x: 0, y: 0 })
      const oscillatorId = store.addAdaptedNode('OscillatorNode', { x: 200, y: 0 })
      store.addEdge(sliderId, oscillatorId, 'value', 'frequency')

      // Get initial frequency
      const oscillatorNode = store.adaptedNodes.find(n => n.id === oscillatorId)
      const initialFrequency = oscillatorNode?.properties.get('frequency')

      // Try to update with wrong output name (should not match)
      store.updateCustomNodeBridges(sliderId, 'wrongOutput', 999)

      // Frequency should not have changed
      expect(oscillatorNode?.properties.get('frequency')).toBe(initialFrequency)
    })

    it('should handle multiple connections from same source', () => {
      // Create one slider and two oscillators
      const sliderId = store.addAdaptedNode('SliderNode', { x: 0, y: 0 })
      const oscillator1Id = store.addAdaptedNode('OscillatorNode', { x: 200, y: 0 })
      const oscillator2Id = store.addAdaptedNode('OscillatorNode', { x: 200, y: 100 })

      // Connect slider to both oscillators
      store.addEdge(sliderId, oscillator1Id, 'value', 'frequency')
      store.addEdge(sliderId, oscillator2Id, 'value', 'frequency')

      // Update slider value
      store.updateCustomNodeBridges(sliderId, 'value', 660)

      // Both oscillators should have updated frequency
      const osc1 = store.adaptedNodes.find(n => n.id === oscillator1Id)
      const osc2 = store.adaptedNodes.find(n => n.id === oscillator2Id)

      expect(osc1?.properties.get('frequency')).toBe(660)
      expect(osc2?.properties.get('frequency')).toBe(660)
    })
  })
})
