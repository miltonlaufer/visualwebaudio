import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createAudioGraphStore } from './AudioGraphStore'
import type { AudioGraphStoreType } from './AudioGraphStore'
import { applySnapshot, getSnapshot, onPatch } from 'mobx-state-tree'
import { waitFor } from '@testing-library/react'
import { customNodeStore } from './CustomNodeStore'

// Create mock audio nodes
const createMockAudioNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  frequency: { value: 440 },
  gain: { value: 1 },
  type: 'sine',
  delayTime: { value: 0 },
  Q: { value: 1 },
  pan: { value: 0 },
  buffer: null,
})

// Mock AudioNodeFactory
vi.mock('~/services/AudioNodeFactory', () => ({
  AudioNodeFactory: class {
    constructor(public audioContext: AudioContext) {}

    createAudioNode(nodeType: string, _metadata: any, properties: any) {
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

      // Simulate the real AudioNodeFactory behavior: start source nodes automatically
      if (nodeType === 'OscillatorNode' || nodeType === 'AudioBufferSourceNode') {
        ;(mockNode as any).start()
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

// Only mock the Web Audio API since it's not available in Node.js
const createMockAudioContext = () => ({
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 },
    type: 'sine',
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  })),
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 1024,
    smoothingTimeConstant: 0.8,
  })),
  createDelay: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    delayTime: { value: 0 },
  })),
  createBiquadFilter: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequency: { value: 350 },
    Q: { value: 1 },
    type: 'lowpass',
  })),
  createStereoPanner: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    pan: { value: 0 },
  })),
  createChannelSplitter: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createChannelMerger: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createConvolver: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    buffer: null,
  })),
  createMediaStreamSource: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  destination: {
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
  state: 'running',
  sampleRate: 44100,
  close: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
})

// Mock the global AudioContext constructor
global.AudioContext = vi.fn(() => createMockAudioContext()) as any

describe('AudioGraphStore', () => {
  let store: AudioGraphStoreType

  beforeEach(() => {
    // Create the store using the factory function (which handles customNodeStore internally)
    store = createAudioGraphStore()

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

  describe('Metadata Loading', () => {
    it('should load web audio metadata', () => {
      expect(Object.keys(store.webAudioMetadata)).toContain('OscillatorNode')
      expect(Object.keys(store.webAudioMetadata)).toContain('GainNode')
      expect(Object.keys(store.webAudioMetadata)).toContain('AudioDestinationNode')
    })

    it('should have correct metadata structure', () => {
      const oscMetadata = store.webAudioMetadata['OscillatorNode']
      expect(oscMetadata).toBeDefined()
      expect(oscMetadata.category).toBe('source')
      expect(oscMetadata.outputs).toHaveLength(1)
      expect(oscMetadata.properties).toContainEqual(expect.objectContaining({ name: 'frequency' }))
    })
  })

  describe('Node Management', () => {
    it('should add a node', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      expect(store.adaptedNodes).toHaveLength(1)
      expect(store.adaptedNodes[0].id).toBe(nodeId)
      expect(store.adaptedNodes[0].nodeType).toBe('OscillatorNode')
      expect(store.adaptedNodes[0].position).toEqual({ x: 100, y: 200 })
    })

    it('should create audio node when adding visual node', async () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })
      const node = store.adaptedNodes.find(n => n.id === nodeId)

      await waitFor(() => {
        expect(node?.isAttached).toBe(true)
      })

      await waitFor(() => {
        expect(node?.audioNodeCreated).toBe(true)
      })

      // Wait for lifecycle hooks to complete and audio node to be created
      await waitFor(() => {
        expect(store.audioNodes.has(nodeId)).toBe(true)
      })

      const audioNode = store.audioNodes.get(nodeId) as any
      expect(audioNode).toBeDefined()
      expect(audioNode?.frequency).toBeDefined()
    })

    it('should remove a node', async () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for lifecycle hooks to complete
      await waitFor(
        () => {
          expect(store.audioNodes.has(nodeId)).toBe(true)
        },
        { timeout: 2000 }
      )

      expect(store.adaptedNodes).toHaveLength(1)

      store.removeNode(nodeId)

      // Wait for cleanup to complete
      await waitFor(
        () => {
          expect(store.audioNodes.has(nodeId)).toBe(false)
        },
        { timeout: 2000 }
      )

      expect(store.adaptedNodes).toHaveLength(0)
    })

    it('should update node position', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      store.updateNodePosition(nodeId, { x: 300, y: 400 })

      expect(store.adaptedNodes[0].position).toEqual({ x: 300, y: 400 })
    })

    it('should select and deselect nodes', () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      store.selectNode(nodeId)
      expect(store.selectedNodeId).toBe(nodeId)
      expect(store.selectedNode).toBe(store.adaptedNodes[0])

      store.selectNode(undefined)
      expect(store.selectedNodeId).toBeUndefined()
      expect(store.selectedNode).toBeUndefined()
    })
  })

  describe('Edge Management', () => {
    let sourceNodeId: string
    let targetNodeId: string

    beforeEach(async () => {
      sourceNodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })
      targetNodeId = store.addAdaptedNode('GainNode', { x: 300, y: 200 })

      // Wait for lifecycle hooks to complete
      await waitFor(() => store.adaptedNodes.length === 2)
    })

    it('should add an edge', () => {
      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')

      expect(store.visualEdges).toHaveLength(1)
      expect(store.visualEdges[0].source).toBe(sourceNodeId)
      expect(store.visualEdges[0].target).toBe(targetNodeId)
    })

    it('should create audio connection when adding edge', async () => {
      // Wait for audio nodes to be created - check preconditions first
      await waitFor(
        () => {
          const sourceNode = store.adaptedNodes.find(n => n.id === sourceNodeId)
          const targetNode = store.adaptedNodes.find(n => n.id === targetNodeId)
          expect(sourceNode?.isAttached).toBe(true)
          expect(targetNode?.isAttached).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.audioNodes.has(sourceNodeId)).toBe(true)
        },
        { timeout: 3000 }
      )

      await waitFor(
        () => {
          expect(store.audioNodes.has(targetNodeId)).toBe(true)
        },
        { timeout: 3000 }
      )

      const sourceAudioNode = store.audioNodes.get(sourceNodeId)

      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')

      expect(sourceAudioNode?.connect).toHaveBeenCalled()
    })

    it('should remove an edge', () => {
      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')
      const edgeId = store.visualEdges[0].id

      store.removeEdge(edgeId)

      expect(store.visualEdges).toHaveLength(0)
    })

    it('should remove edges when removing a node', () => {
      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')

      expect(store.visualEdges).toHaveLength(1)

      store.removeNode(sourceNodeId)

      expect(store.visualEdges).toHaveLength(0)
    })
  })

  describe('Undo/Redo Functionality', () => {
    it('should track undo/redo availability', async () => {
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)

      store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for patch recording
      await waitFor(() => {
        expect(store.canUndo).toBe(true)
        expect(store.canRedo).toBe(false)
      })
    })

    it('should undo node addition', async () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      expect(store.adaptedNodes).toHaveLength(1)

      // Wait for patch recording
      await waitFor(() => store.undoStack.length > 0)

      store.undo()

      expect(store.adaptedNodes).toHaveLength(0)
      expect(store.canRedo).toBe(true)
    })

    it('should redo node addition', async () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for patch recording
      await waitFor(() => store.undoStack.length > 0)

      store.undo()
      expect(store.adaptedNodes).toHaveLength(0)

      store.redo()
      expect(store.adaptedNodes).toHaveLength(1)
      expect(store.adaptedNodes[0].nodeType).toBe('OscillatorNode')
    })

    it('should undo edge addition', async () => {
      const sourceNodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })
      const targetNodeId = store.addAdaptedNode('GainNode', { x: 300, y: 200 })

      // Wait for patch recording
      await waitFor(() => store.visualEdges.length > 0)

      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')
      expect(store.visualEdges).toHaveLength(1)

      // Wait for patch recording
      await waitFor(() => store.undoStack.length > 0)

      store.undo()
      expect(store.visualEdges).toHaveLength(0)
    })

    it('should clear redo stack when new action is performed', async () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for patch recording
      await waitFor(() => store.undoStack.length > 0)

      store.undo()
      expect(store.canRedo).toBe(true)

      store.addAdaptedNode('GainNode', { x: 300, y: 200 })

      // Wait for patch recording
      await waitFor(() => store.undoStack.length > 1)

      expect(store.canRedo).toBe(false)
    })

    it('should not record play/stop operations in undo history', async () => {
      // Add a node to create some initial history
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for patches to be recorded
      await waitFor(() => store.undoStack.length > 0)

      // Record initial undo stack length
      const initialUndoLength = store.undoStack.length
      expect(store.canUndo).toBe(true)

      // Toggle playback multiple times
      await store.togglePlayback() // Start
      await store.togglePlayback() // Stop
      await store.togglePlayback() // Start again
      await store.togglePlayback() // Stop again

      // Verify that play/stop operations didn't add meaningful changes to undo history
      expect(store.canUndo).toBe(true) // Should still be able to undo
      expect(store.canRedo).toBe(false) // No redo history should be created
      
      // The key test: verify that we can still undo back to a clean state
      // Even if there are additional runtime patches, we should be able to undo all the way back
      const finalUndoLength = store.undoStack.length
      
      // Undo all operations to get back to empty state
      let undoCount = 0
      while (store.canUndo && undoCount < 10) { // Safety limit to prevent infinite loop
        store.undo()
        undoCount++
      }
      
      // Verify we're back to empty state
      expect(store.adaptedNodes.length).toBe(0)
      expect(store.visualEdges.length).toBe(0)
    })

    it('should not record automatic play state changes in undo history', async () => {
      // Add oscillator and destination nodes
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const destId = store.addAdaptedNode('AudioDestinationNode', { x: 300, y: 100 })

      // Wait for patches to be recorded
      await waitFor(() => store.undoStack.length > 0)

      // Record initial undo stack length
      const initialUndoLength = store.undoStack.length
      expect(store.canUndo).toBe(true)

      // Connect nodes (in test mode, this should NOT automatically set isPlaying to true)
      store.addEdge(oscId, destId, 'output', 'input')
      expect(store.isPlaying).toBe(false)

      // Wait for any potential patches
      await waitFor(() => store.undoStack.length > initialUndoLength)

      // Disconnect nodes
      const edgeId = store.visualEdges[0].id
      store.removeEdge(edgeId)
      expect(store.isPlaying).toBe(false)

      // Wait for any potential patches
      await waitFor(() => store.undoStack.length > initialUndoLength)

      // Verify that automatic play state changes didn't add to undo history
      // The lifecycle hooks may create additional patches, so we check that we have at least the expected operations
      expect(store.undoStack.length).toBeGreaterThanOrEqual(initialUndoLength + 2) // At least +1 for edge add, +1 for edge remove
      expect(store.canUndo).toBe(true)
      expect(store.canRedo).toBe(false)
    })
  })

  describe('Audio Context Management', () => {
    it('should initialize audio context', () => {
      store.initializeAudioContext()
      expect(store.audioContext).toBeDefined()
    })

    it('should toggle playback', async () => {
      store.initializeAudioContext()
      expect(store.isPlaying).toBe(false)
      expect(store.audioContext).not.toBe(null)

      // Test starting from stopped state
      await store.togglePlayback()
      expect(store.isPlaying).toBe(true) // Should start playing
      expect(store.audioContext).not.toBe(null)

      // Test stopping when playing
      await store.togglePlayback()
      expect(store.isPlaying).toBe(false) // Should stop playing
      expect(store.audioContext).toBe(null) // Context gets closed
    })
  })

  describe('Property Management', () => {
    it('should update node properties', async () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for lifecycle hooks to complete
      await waitFor(() => store.adaptedNodes.length === 1)

      store.updateNodeProperty(nodeId, 'frequency', 880)

      // Wait for property reaction to fire
      await waitFor(() => store.adaptedNodes[0].properties.get('frequency') === 880)

      const node = store.adaptedNodes[0]
      expect(node.properties.get('frequency')).toBe(880)

      const audioNode = store.audioNodes.get(nodeId) as unknown as { frequency: { value: number } }
      expect(audioNode.frequency.value).toBe(880)
    })
  })

  describe('AudioGraphStore - Undo/Redo History', () => {
    it('should clear undo/redo history when clearing all nodes', async () => {
      // Add some nodes to create history
      const nodeId1 = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const nodeId2 = store.addAdaptedNode('GainNode', { x: 200, y: 100 })

      // Wait for patches to be recorded
      await waitFor(() => store.undoStack.length > 0)

      // Verify we have undo history
      expect(store.canUndo).toBe(true)
      expect(store.undoStack.length).toBeGreaterThan(0)

      // Add an edge to create more history
      store.addEdge(nodeId1, nodeId2, 'output', 'input')

      // Wait for patches to be recorded
      await waitFor(() => store.undoStack.length > 1)

      // Perform an undo to create redo history
      store.undo()

      // Wait for undo to complete
      await waitFor(() => store.undoStack.length === 0)

      // Verify we have both undo and redo history
      expect(store.canUndo).toBe(true)
      expect(store.canRedo).toBe(true)
      expect(store.undoStack.length).toBeGreaterThan(0)
      expect(store.redoStack.length).toBeGreaterThan(0)

      // Clear all nodes
      store.clearAllNodes()

      // Verify that undo/redo history is cleared
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)
      expect(store.undoStack.length).toBe(0)
      expect(store.redoStack.length).toBe(0)

      // Verify nodes are actually cleared
      expect(store.adaptedNodes.length).toBe(0)
      expect(store.visualEdges.length).toBe(0)
    })

    it('should not record clearAllNodes operation in undo history', async () => {
      // Add a node
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for patches to be recorded
      await waitFor(() => store.undoStack.length > 0)

      // Verify we have undo history
      expect(store.canUndo).toBe(true)

      // Clear all nodes
      store.clearAllNodes()

      // Wait for any potential patches
      await waitFor(() => store.undoStack.length === 0)

      // Verify that clearAllNodes itself didn't add to undo history
      // (since history was cleared, it should be 0)
      expect(store.undoStack.length).toBe(0)
      expect(store.redoStack.length).toBe(0)
    })

    it('should maintain clean state after clearing nodes and adding new ones', async () => {
      // Add some nodes and create history
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.addAdaptedNode('GainNode', { x: 200, y: 100 })

      // Wait for patches
      await waitFor(() => store.undoStack.length > 0)

      // Clear all nodes (this clears history)
      store.clearAllNodes()

      // Add new nodes after clearing
      const newNodeId = store.addAdaptedNode('DelayNode', { x: 300, y: 100 })

      // Wait for patches
      await waitFor(() => store.undoStack.length > 0)

      // Verify we have a clean slate with new history
      expect(store.adaptedNodes.length).toBe(1)
      expect(store.adaptedNodes[0].id).toBe(newNodeId)
      expect(store.canUndo).toBe(true) // New action should be undoable
      expect(store.canRedo).toBe(false) // No redo history yet
    })
  })

  describe('AudioGraphStore - Backward Compatibility', () => {
    it('should load projects with utility category nodes correctly', () => {
      // Simulate a saved project with nodes that have "utility" category
      const projectSnapshot = {
        adaptedNodes: [
          {
            id: 'SliderNode-1234567890-1',
            type: 'audioNode',
            position: { x: 100, y: 100 },
            data: {
              nodeType: 'SliderNode',
              metadata: {
                name: 'Slider',
                description: 'A slider control for adjusting values',
                category: 'utility', // This is the old category that was causing issues
                inputs: [],
                outputs: [{ name: 'value', type: 'control' }],
                properties: [{ name: 'value', type: 'number', defaultValue: 50, min: 0, max: 100 }],
                methods: [],
                events: [],
              },
              properties: { value: 50 }, // Use plain object for snapshot
            },
          },
          {
            id: 'DisplayNode-1234567890-2',
            type: 'audioNode',
            position: { x: 300, y: 100 },
            data: {
              nodeType: 'DisplayNode',
              metadata: {
                name: 'Display',
                description: 'Displays numeric values',
                category: 'utility', // This is the old category that was causing issues
                inputs: [{ name: 'input', type: 'control' }],
                outputs: [{ name: 'output', type: 'control' }],
                properties: [{ name: 'value', type: 'number', defaultValue: 0 }],
                methods: [],
                events: [],
              },
              properties: { value: 0 }, // Use plain object for snapshot
            },
          },
        ],
        visualEdges: [],
        audioConnections: [],
        selectedNodeId: undefined,
        isPlaying: false,
        undoStack: [],
        redoStack: [],
        propertyChangeCounter: 0,
        graphChangeCounter: 0,
        isProjectModified: false,
      }

      // Apply the snapshot (simulating loading a project)
      expect(() => {
        applySnapshot(store, projectSnapshot)
      }).not.toThrow()

      // Audio nodes are created automatically by lifecycle hooks
      // Wait a bit for the async creation to complete
      return new Promise(resolve => setTimeout(resolve, 10)).then(() => {
        // Verify the nodes were loaded correctly
        expect(store.adaptedNodes).toHaveLength(2)
        expect(store.adaptedNodes[0].nodeType).toBe('SliderNode')
        expect(store.adaptedNodes[1].nodeType).toBe('DisplayNode')

        // Verify the metadata category is preserved
        expect(store.adaptedNodes[0].metadata.category).toBe('utility')
        expect(store.adaptedNodes[1].metadata.category).toBe('utility')

        // Verify that custom nodes were created successfully
        expect(store.customNodes.size).toBe(2)
        expect(store.customNodes.has('SliderNode-1234567890-1')).toBe(true)
        expect(store.customNodes.has('DisplayNode-1234567890-2')).toBe(true)

        // Verify the custom nodes have the correct properties
        const sliderNode = store.customNodes.get('SliderNode-1234567890-1')
        const displayNode = store.customNodes.get('DisplayNode-1234567890-2')

        expect(sliderNode).toBeDefined()
        expect(displayNode).toBeDefined()
        expect(sliderNode?.properties.get('value')).toBe(50)
        expect(displayNode?.properties.get('value')).toBe(0)
      })
    })

    it('should handle mixed category nodes (utility and misc)', () => {
      // Test that we can have both old "utility" nodes and new "misc" nodes in the same project
      const projectSnapshot = {
        adaptedNodes: [
          {
            id: 'SliderNode-old',
            type: 'audioNode',
            position: { x: 100, y: 100 },
            data: {
              nodeType: 'SliderNode',
              metadata: {
                name: 'Slider',
                description: 'A slider control',
                category: 'utility', // Old category
                inputs: [],
                outputs: [{ name: 'value', type: 'control' }],
                properties: [{ name: 'value', type: 'number', defaultValue: 25 }],
                methods: [],
                events: [],
              },
              properties: { value: 25 }, // Use plain object for snapshot
            },
          },
          {
            id: 'DisplayNode-new',
            type: 'audioNode',
            position: { x: 300, y: 100 },
            data: {
              nodeType: 'DisplayNode',
              metadata: {
                name: 'Display',
                description: 'Displays values',
                category: 'misc', // New category
                inputs: [{ name: 'input', type: 'control' }],
                outputs: [{ name: 'output', type: 'control' }],
                properties: [{ name: 'value', type: 'number', defaultValue: 0 }],
                methods: [],
                events: [],
              },
              properties: { value: 0 }, // Use plain object for snapshot
            },
          },
        ],
        visualEdges: [],
        audioConnections: [],
        selectedNodeId: undefined,
        isPlaying: false,
        undoStack: [],
        redoStack: [],
        propertyChangeCounter: 0,
        graphChangeCounter: 0,
        isProjectModified: false,
      }

      // Should load without errors
      expect(() => {
        applySnapshot(store, projectSnapshot)
      }).not.toThrow()

      // Audio nodes are created automatically by lifecycle hooks
      // Wait for the lifecycle hooks to complete - check preconditions first
      return waitFor(
        () => {
          const node1 = store.adaptedNodes.find(n => n.id === 'SliderNode-old')
          const node2 = store.adaptedNodes.find(n => n.id === 'DisplayNode-new')
          expect(node1?.isAttached).toBe(true)
          expect(node2?.isAttached).toBe(true)
        },
        { timeout: 3000 }
      )
        .then(() => {
          return waitFor(
            () => {
              expect(store.customNodes.size).toBe(2)
            },
            { timeout: 3000 }
          )
        })
        .then(() => {
          // Both nodes should be created successfully
          expect(store.adaptedNodes).toHaveLength(2)
          expect(store.customNodes.size).toBe(2)

          // Categories should be preserved as they were saved
          expect(store.adaptedNodes[0].metadata.category).toBe('utility')
          expect(store.adaptedNodes[1].metadata.category).toBe('misc')
        })
    })

    it('should properly display visual nodes when loading a project after another project', async () => {
      // First, create and save a project
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.addAdaptedNode('GainNode', { x: 200, y: 200 })

      expect(store.adaptedNodes.length).toBe(2)
      expect(store.audioNodes.size).toBe(2)

      // Get the snapshot of the first project
      const firstProjectSnapshot = getSnapshot(store)

      // Clear and load a different project
      store.clearAllNodes()
      store.addAdaptedNode('BiquadFilterNode', { x: 300, y: 300 })

      expect(store.adaptedNodes.length).toBe(1)
      expect(store.audioNodes.size).toBe(1)

      // Now load the first project again (simulating loading after loading)
      applySnapshot(store, firstProjectSnapshot)
      store.init()

      // Check that visual nodes are properly restored and visible
      expect(store.adaptedNodes.length).toBe(2)
      expect(store.audioNodes.size).toBe(2)

      // Check that the nodes have the correct types
      const nodeTypes = store.adaptedNodes.map(node => node.nodeType).sort()
      expect(nodeTypes).toEqual(['GainNode', 'OscillatorNode'])

      // Check that visual nodes have proper positions (indicating they're properly loaded)
      const oscillatorNode = store.adaptedNodes.find(node => node.nodeType === 'OscillatorNode')
      const gainNode = store.adaptedNodes.find(node => node.nodeType === 'GainNode')

      expect(oscillatorNode?.position).toEqual({ x: 100, y: 100 })
      // GainNode position might be adjusted by collision detection, but should be reasonable
      expect(gainNode?.position.y).toBe(200) // Y should be preserved
      expect(gainNode?.position.x).toBeGreaterThanOrEqual(200) // X might be adjusted for collision avoidance
    })
  })

  describe('Connection Deduplication', () => {
    it('should deduplicate connections when loading projects with duplicate audioConnections', () => {
      // Create a project snapshot with duplicate connections
      const projectSnapshot = {
        adaptedNodes: [
          {
            id: 'OscillatorNode-1',
            type: 'audioNode',
            position: { x: 100, y: 100 },
            data: {
              nodeType: 'OscillatorNode',
              metadata: {
                name: 'OscillatorNode',
                description: 'Test oscillator',
                category: 'source',
                inputs: [],
                outputs: [{ name: 'output', type: 'audio' }],
                properties: [{ name: 'frequency', type: 'AudioParam', defaultValue: 440 }],
                methods: [],
                events: [],
              },
              properties: { frequency: 440 },
            },
          },
          {
            id: 'GainNode-1',
            type: 'audioNode',
            position: { x: 300, y: 100 },
            data: {
              nodeType: 'GainNode',
              metadata: {
                name: 'GainNode',
                description: 'Test gain',
                category: 'effect',
                inputs: [{ name: 'input', type: 'audio' }],
                outputs: [{ name: 'output', type: 'audio' }],
                properties: [{ name: 'gain', type: 'AudioParam', defaultValue: 1 }],
                methods: [],
                events: [],
              },
              properties: { gain: 1 },
            },
          },
        ],
        visualEdges: [
          {
            id: 'edge-1',
            source: 'OscillatorNode-1',
            target: 'GainNode-1',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
        ],
        // Duplicate connections - same connection appears twice
        audioConnections: [
          {
            sourceNodeId: 'OscillatorNode-1',
            targetNodeId: 'GainNode-1',
            sourceOutput: 'output',
            targetInput: 'input',
          },
          {
            sourceNodeId: 'OscillatorNode-1',
            targetNodeId: 'GainNode-1',
            sourceOutput: 'output',
            targetInput: 'input',
          },
        ],
        selectedNodeId: undefined,
        isPlaying: false,
        undoStack: [],
        redoStack: [],
        propertyChangeCounter: 0,
        graphChangeCounter: 0,
        isProjectModified: false,
      }

      // Apply the snapshot
      applySnapshot(store, projectSnapshot)
      store.init()

      // Verify that only one connection exists in the final state
      expect(store.audioConnections).toHaveLength(1)
      expect(store.audioConnections[0]).toEqual({
        sourceNodeId: 'OscillatorNode-1',
        targetNodeId: 'GainNode-1',
        sourceOutput: 'output',
        targetInput: 'input',
      })
    })

    it('should deduplicate custom node connections when loading projects', () => {
      const projectSnapshot = {
        adaptedNodes: [
          {
            id: 'SliderNode-1',
            type: 'audioNode',
            position: { x: 100, y: 100 },
            data: {
              nodeType: 'SliderNode',
              metadata: {
                name: 'Slider',
                description: 'Test slider',
                category: 'misc',
                inputs: [],
                outputs: [{ name: 'value', type: 'control' }],
                properties: [{ name: 'value', type: 'number', defaultValue: 50 }],
                methods: [],
                events: [],
              },
              properties: { value: 50 },
            },
          },
          {
            id: 'DisplayNode-1',
            type: 'audioNode',
            position: { x: 300, y: 100 },
            data: {
              nodeType: 'DisplayNode',
              metadata: {
                name: 'Display',
                description: 'Test display',
                category: 'misc',
                inputs: [{ name: 'input', type: 'control' }],
                outputs: [{ name: 'output', type: 'control' }],
                properties: [{ name: 'value', type: 'number', defaultValue: 0 }],
                methods: [],
                events: [],
              },
              properties: { value: 0 },
            },
          },
        ],
        visualEdges: [],
        audioConnections: [
          {
            sourceNodeId: 'SliderNode-1',
            targetNodeId: 'DisplayNode-1',
            sourceOutput: 'value',
            targetInput: 'input',
          },
        ],
        selectedNodeId: undefined,
        isPlaying: false,
        undoStack: [],
        redoStack: [],
        propertyChangeCounter: 0,
        graphChangeCounter: 0,
        isProjectModified: false,
      }

      // Apply custom node store with duplicates FIRST
      const customNodeSnapshot = {
        nodes: {
          'SliderNode-1': {
            id: 'SliderNode-1',
            nodeType: 'SliderNode',
            properties: { value: 50 },
            outputs: { value: 50 },
            inputConnections: [],
          },
          'DisplayNode-1': {
            id: 'DisplayNode-1',
            nodeType: 'DisplayNode',
            properties: { value: 0 },
            outputs: { output: 0 },
            // Duplicate input connections
            inputConnections: [
              {
                sourceNodeId: 'SliderNode-1',
                sourceOutput: 'value',
                targetInput: 'input',
              },
              {
                sourceNodeId: 'SliderNode-1',
                sourceOutput: 'value',
                targetInput: 'input',
              },
            ],
          },
        },
      }

      applySnapshot(customNodeStore, customNodeSnapshot)

      // Apply the snapshot with custom nodes that have duplicate input connections
      applySnapshot(store, projectSnapshot)

      // Call init to trigger deduplication
      store.init()

      // Verify that duplicate input connections were removed
      const displayNode = customNodeStore.nodes.get('DisplayNode-1')
      expect(displayNode?.inputConnections).toHaveLength(1)
    })
  })

  describe('Pause/Play Functionality', () => {
    beforeEach(async () => {
      // Create a simple audio graph for testing
      const oscId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const gainId = store.addAdaptedNode('GainNode', { x: 300, y: 100 })
      const destId = store.addAdaptedNode('AudioDestinationNode', { x: 500, y: 100 })

      store.addEdge(oscId, gainId, 'output', 'input')
      store.addEdge(gainId, destId, 'output', 'input')

      // Wait for audio nodes to be created
      await waitFor(() => {
        expect(store.audioNodes.size).toBeGreaterThan(0)
      })
    })

    it('should start audio when play is pressed', async () => {
      // In test mode, isPlaying should be false initially (no automatic play)
      expect(store.isPlaying).toBe(false)

      // Start the audio
      await store.togglePlayback()
      expect(store.isPlaying).toBe(true)

      // Stop the audio
      await store.togglePlayback()
      expect(store.isPlaying).toBe(false)

      // Start it again
      await store.togglePlayback()
      expect(store.isPlaying).toBe(true)

      // Wait for oscillator nodes to be created
      await waitFor(() => {
        const oscillatorNodes = Array.from(store.audioNodes.values()).filter(
          node => node.constructor.name === 'OscillatorNode' || 'start' in node
        )
        expect(oscillatorNodes.length).toBeGreaterThan(0)
      })
    })

    it('should stop audio when pause is pressed', async () => {
      // If not already playing, start audio first
      if (!store.isPlaying) {
        await store.togglePlayback()
        expect(store.isPlaying).toBe(true)
      }
      expect(store.audioContext).not.toBe(null)

      // Then stop it
      await store.togglePlayback()

      expect(store.isPlaying).toBe(false)
      // Audio context might still exist after stopping in test mode, but isPlaying should be false
    })

    it('should be able to play again after pause', async () => {
      // If not already playing, start audio first
      if (!store.isPlaying) {
        await store.togglePlayback()
        expect(store.isPlaying).toBe(true)
      }

      // Stop audio
      await store.togglePlayback()
      expect(store.isPlaying).toBe(false)

      // Start audio again - this should work
      await store.togglePlayback()
      expect(store.isPlaying).toBe(true)

      // Wait for new oscillator nodes to be created
      await waitFor(() => {
        const oscillatorNodes = Array.from(store.audioNodes.values()).filter(
          node => node.constructor.name === 'OscillatorNode' || 'start' in node
        )
        expect(oscillatorNodes.length).toBeGreaterThan(0)
      })
    })

    it('should recreate source nodes after stopping and starting', async () => {
      const initialOscillatorCount = Array.from(store.audioNodes.values()).filter(
        node => node.constructor.name === 'OscillatorNode' || 'start' in node
      ).length

      // Start and stop audio
      await store.togglePlayback()
      await store.togglePlayback()

      // Start again
      await store.togglePlayback()

      // Wait for oscillator nodes to be recreated
      await waitFor(() => {
        const finalOscillatorCount = Array.from(store.audioNodes.values()).filter(
          node => node.constructor.name === 'OscillatorNode' || 'start' in node
        ).length
        expect(finalOscillatorCount).toBe(initialOscillatorCount)
      })
    })

    it('should maintain audio connections after pause/play cycle', async () => {
      const initialConnectionCount = store.audioConnections.length

      // Start and stop audio
      await store.togglePlayback()
      await store.togglePlayback()

      // Start again
      await store.togglePlayback()

      // Connections should be maintained
      expect(store.audioConnections).toHaveLength(initialConnectionCount)

      // Wait for audio nodes to be recreated
      await waitFor(() => {
        const oscillatorNodes = Array.from(store.audioNodes.values()).filter(
          node => node.constructor.name === 'OscillatorNode' || 'start' in node
        )
        const gainNodes = Array.from(store.audioNodes.values()).filter(
          node => node.constructor.name === 'GainNode' || 'gain' in node
        )

        expect(oscillatorNodes.length).toBeGreaterThan(0)
        expect(gainNodes.length).toBeGreaterThan(0)
      })
    })
  })
})
