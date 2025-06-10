import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioGraphStore } from './AudioGraphStore'
import type { AudioGraphStoreType } from './AudioGraphStore'
import { onPatch } from 'mobx-state-tree'
import { waitFor } from '@testing-library/react'

// Mock the customNodeStore module to prevent singleton initialization
vi.mock('~/stores/CustomNodeStore', () => ({
  customNodeStore: {
    getNode: vi.fn(),
    addNode: vi.fn(),
    removeNode: vi.fn(),
    clear: vi.fn(),
  },
}))

// Mock Web Audio API helper function (still needed for mocks)
const createMockAudioNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  frequency: { value: 440 },
  gain: { value: 1 },
  start: vi.fn(),
  stop: vi.fn(),
})

// Mock AudioNodeFactory
vi.mock('~/services/AudioNodeFactory', () => ({
  AudioNodeFactory: class {
    constructor(public audioContext: AudioContext) {}

    createAudioNode(_nodeType: string, _metadata: any, properties: any) {
      const mockNode = createMockAudioNode()
      // Apply initial properties
      if (properties) {
        Object.entries(properties).forEach(([key, value]) => {
          if (key === 'frequency' && mockNode.frequency) {
            mockNode.frequency.value = value as number
          } else if (key === 'gain' && mockNode.gain) {
            mockNode.gain.value = value as number
          }
        })
      }
      return mockNode
    }

    updateNodeProperty(audioNode: any, _nodeType: string, propertyName: string, value: any) {
      // Actually update the property on the mock
      if (propertyName === 'frequency' && audioNode.frequency) {
        audioNode.frequency.value = value
        return true
      } else if (propertyName === 'gain' && audioNode.gain) {
        audioNode.gain.value = value
        return true
      }
      return false
    }

    stopSourceNode(audioNode: any) {
      if ('stop' in audioNode) {
        audioNode.stop()
      }
    }
  },
}))

// Mock CustomNodeFactory
vi.mock('~/services/CustomNodeFactory', () => ({
  CustomNodeFactory: class {
    constructor(public audioContext: AudioContext) {}

    isCustomNodeType(nodeType: string) {
      return ['SliderNode', 'DisplayNode', 'ButtonNode', 'MidiToFreqNode'].includes(nodeType)
    }

    createNode(id: string, nodeType: string, metadata: any) {
      // Get default value from metadata if available
      const defaultValue =
        metadata?.properties?.[0]?.defaultValue ?? (nodeType === 'DisplayNode' ? 0 : 50)

      return {
        id,
        type: nodeType,
        outputs: new Map([['value', defaultValue]]),
        properties: new Map([['value', defaultValue]]),
        cleanup: vi.fn(),
        getAudioOutput: vi.fn(() => null),
      }
    }

    createCustomNode(nodeType: string) {
      const id = `${nodeType}-${Date.now()}`
      return this.createNode(id, nodeType, {})
    }
  },
}))

// Create a mock customNodeStore outside of beforeEach
const createMockCustomNodeStore = () => ({
  getNode: vi.fn(() => {
    // Return a mock node with the expected interface
    return {
      setProperty: vi.fn(),
      setOutput: vi.fn(),
    }
  }),
  addNode: vi.fn(),
  removeNode: vi.fn(),
  connectNodes: vi.fn(),
  disconnectNodes: vi.fn(),
  clear: vi.fn(),
  setBridgeUpdateCallback: vi.fn(),
  setAudioContext: vi.fn(),
})

describe('AudioParam Connection Tests', () => {
  let store: AudioGraphStoreType
  let mockCustomNodeStore: ReturnType<typeof createMockCustomNodeStore>

  beforeEach(async () => {
    vi.clearAllMocks()

    // Create a fresh mock for each test
    mockCustomNodeStore = createMockCustomNodeStore()

    // Create the store with customNodeStore in the environment
    store = AudioGraphStore.create(
      {
        undoStack: [],
        redoStack: [],
      },
      {
        customNodeStore: mockCustomNodeStore,
      }
    )

    // Set up patch middleware for automatic undo/redo tracking
    let patchRecorder: { forward: any; inverse: any }[] = []
    let isRecording = false

    onPatch(store, (patch, reversePatch) => {
      // Don't record patches when we're applying undo/redo
      if (store.isApplyingPatch) return
      if (store.isCreatingExample) return
      if (store.isClearingAllNodes) return
      if (store.isUpdatingPlayState) return
      if (store.isLoadingProject) return

      // Don't record patches to the history stacks themselves
      if (patch.path.startsWith('/undoStack') || patch.path.startsWith('/redoStack')) {
        return
      }

      // Don't record play/pause state changes in undo history
      if (patch.path === '/isPlaying') return
      if (patch.path === '/selectedNodeId') return
      if (patch.path === '/propertyChangeCounter') return
      if (patch.path === '/graphChangeCounter') return
      if (patch.path === '/isProjectModified') return

      // Mark project as modified for meaningful changes
      if (!store.isProjectModified) {
        store.markProjectModified()
      }

      // Start recording if not already
      if (!isRecording) {
        isRecording = true
        patchRecorder = []

        // Use microtask to batch patches that happen in the same tick
        queueMicrotask(() => {
          if (patchRecorder.length > 0) {
            // Add to undo stack using store action
            store.addToUndoStack({
              forward: patchRecorder.map(p => p.forward),
              inverse: patchRecorder.map(p => p.inverse).reverse(),
            })
          }

          isRecording = false
          patchRecorder = []
        })
      }

      // Record the patch
      patchRecorder.push({ forward: patch, inverse: reversePatch })
    })

    store.loadMetadata()
  })

  afterEach(() => {
    // Clean up any nodes that might have been created
    if (store && store.adaptedNodes.length > 0) {
      store.clearAllNodes()
    }
    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('Direct frequency control connections', () => {
    it('should set frequency base to 0 when connecting SliderNode', async () => {
      // Create nodes
      const sliderId = store.addAdaptedNode('SliderNode', { x: 100, y: 100 })
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 200, y: 100 })

      // Check if visual nodes were added
      expect(store.adaptedNodes).toHaveLength(2)
      expect(store.adaptedNodes.find(n => n.id === sliderId)).toBeDefined()
      expect(store.adaptedNodes.find(n => n.id === oscId)).toBeDefined()

      // Wait for lifecycle hooks to complete - check preconditions first
      await waitFor(
        () => {
          const sliderNode = store.adaptedNodes.find(n => n.id === sliderId)
          const oscNode = store.adaptedNodes.find(n => n.id === oscId)
          expect(sliderNode?.isAttached).toBe(true)
          expect(oscNode?.isAttached).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.customNodes.has(sliderId)).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.audioNodes.has(oscId)).toBe(true)
        },
        { timeout: 3000 }
      )

      // Connect and verify base is set to 0
      store.addEdge(sliderId, oscId, 'value', 'frequency')
      const oscAudioNode = store.audioNodes.get(oscId) as any
      expect(oscAudioNode.frequency.value).toBe(0)
    })

    it('should set frequency base to 0 when connecting MidiToFreqNode', async () => {
      // Create nodes
      const midiId = store.addAdaptedNode('MidiToFreqNode', { x: 100, y: 100 })
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 200, y: 100 })

      // Wait for lifecycle hooks to complete - check preconditions first
      await waitFor(
        () => {
          const midiNode = store.adaptedNodes.find(n => n.id === midiId)
          const oscNode = store.adaptedNodes.find(n => n.id === oscId)
          expect(midiNode?.isAttached).toBe(true)
          expect(oscNode?.isAttached).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.customNodes.has(midiId)).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.audioNodes.has(oscId)).toBe(true)
        },
        { timeout: 3000 }
      )

      // Connect and verify base is set to 0
      store.addEdge(midiId, oscId, 'frequency', 'frequency')
      const oscAudioNode = store.audioNodes.get(oscId) as any
      expect(oscAudioNode.frequency.value).toBe(0)
    })
  })

  describe('LFO modulation connections', () => {
    it('should keep frequency base when connecting OscillatorNode for modulation', async () => {
      // Create nodes
      const lfoId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 200, y: 100 })

      // Wait for lifecycle hooks to complete
      await waitFor(
        () => {
          const lfoNode = store.adaptedNodes.find(n => n.id === lfoId)
          const oscNode = store.adaptedNodes.find(n => n.id === oscId)
          expect(lfoNode?.isAttached).toBe(true)
          expect(oscNode?.isAttached).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.audioNodes.has(lfoId)).toBe(true)
          expect(store.audioNodes.has(oscId)).toBe(true)
        },
        { timeout: 3000 }
      )

      // Connect for modulation and verify base stays at 440
      store.addEdge(lfoId, oscId, 'output', 'frequency')
      const oscAudioNode = store.audioNodes.get(oscId) as any
      expect(oscAudioNode.frequency.value).toBe(440)
    })
  })

  describe('Other AudioParam connections', () => {
    it('should set gain base to 0 when connecting control signal', async () => {
      // Create nodes
      const sliderId = store.addAdaptedNode('SliderNode', { x: 100, y: 100 })
      const gainId = store.addAdaptedNode('GainNode', { x: 200, y: 100 })

      // Wait for lifecycle hooks to complete - check preconditions first
      await waitFor(
        () => {
          const sliderNode = store.adaptedNodes.find(n => n.id === sliderId)
          const gainNode = store.adaptedNodes.find(n => n.id === gainId)
          expect(sliderNode?.isAttached).toBe(true)
          expect(gainNode?.isAttached).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.customNodes.has(sliderId)).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.audioNodes.has(gainId)).toBe(true)
        },
        { timeout: 3000 }
      )

      // Connect and verify base is set to 0
      store.addEdge(sliderId, gainId, 'value', 'gain')
      const gainAudioNode = store.audioNodes.get(gainId) as any
      expect(gainAudioNode.gain.value).toBe(0)
    })
  })

  describe('Disconnection behavior', () => {
    it('should restore default values when disconnecting', async () => {
      // Create nodes
      const sliderId = store.addAdaptedNode('SliderNode', { x: 100, y: 100 })
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 200, y: 100 })

      // Wait for lifecycle hooks to complete - check preconditions first
      await waitFor(
        () => {
          const sliderNode = store.adaptedNodes.find(n => n.id === sliderId)
          const oscNode = store.adaptedNodes.find(n => n.id === oscId)
          expect(sliderNode?.isAttached).toBe(true)
          expect(oscNode?.isAttached).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.customNodes.has(sliderId)).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.audioNodes.has(oscId)).toBe(true)
        },
        { timeout: 3000 }
      )

      // Connect and verify base is set to 0
      store.addEdge(sliderId, oscId, 'value', 'frequency')
      const oscAudioNode = store.audioNodes.get(oscId) as any
      expect(oscAudioNode.frequency.value).toBe(0)

      // Find and remove the edge
      const edge = store.visualEdges.find(e => e.source === sliderId && e.target === oscId)
      expect(edge).toBeDefined()

      store.removeEdge(edge!.id)

      // After disconnection, frequency should be restored to default
      expect(oscAudioNode.frequency.value).toBe(440)
    })
  })

  describe('Visual verification test', () => {
    it('should create a complete working example for manual testing', async () => {
      // Create nodes
      const sliderId = store.addAdaptedNode('SliderNode', { x: 100, y: 100 })
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 300, y: 100 })
      const destId = store.addAdaptedNode('AudioDestinationNode', { x: 500, y: 100 })

      // Wait for lifecycle hooks to complete - check preconditions first
      await waitFor(
        () => {
          const sliderNode = store.adaptedNodes.find(n => n.id === sliderId)
          const oscNode = store.adaptedNodes.find(n => n.id === oscId)
          const destNode = store.adaptedNodes.find(n => n.id === destId)
          expect(sliderNode?.isAttached).toBe(true)
          expect(oscNode?.isAttached).toBe(true)
          expect(destNode?.isAttached).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.customNodes.has(sliderId)).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.audioNodes.has(oscId)).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.audioNodes.has(destId)).toBe(true)
        },
        { timeout: 3000 }
      )

      // Connect slider to oscillator frequency
      store.addEdge(sliderId, oscId, 'value', 'frequency')

      // Connect oscillator to destination
      store.addEdge(oscId, destId, 'output', 'input')

      // Verify the connections
      const oscAudioNode = store.audioNodes.get(oscId) as any

      // Simulate slider changes
      store.updateNodeProperty(sliderId, 'value', 220)

      store.updateNodeProperty(sliderId, 'value', 440)

      store.updateNodeProperty(sliderId, 'value', 880)

      //  '💡 In the browser: Create SliderNode → connect to OscillatorNode frequency → connect to output'
      //)

      // Verify all nodes exist
      expect(store.adaptedNodes.length).toBe(3)
      expect(store.visualEdges.length).toBe(2)
      expect(oscAudioNode.frequency.value).toBe(0) // Should be 0 for direct control
    })
  })
})
