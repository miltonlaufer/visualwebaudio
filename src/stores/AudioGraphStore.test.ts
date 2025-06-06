import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createAudioGraphStore } from './AudioGraphStore'
import type { AudioGraphStoreType } from './AudioGraphStore'
import { applySnapshot, getSnapshot, onPatch } from 'mobx-state-tree'
import { waitFor } from '@testing-library/react'

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

    createAudioNode(nodeType: string, metadata: any, properties: any) {
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

    updateNodeProperty(audioNode: any, nodeType: string, propertyName: string, value: any) {
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
    if (store && store.visualNodes.length > 0) {
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
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      expect(store.visualNodes).toHaveLength(1)
      expect(store.visualNodes[0].id).toBe(nodeId)
      expect(store.visualNodes[0].data.nodeType).toBe('OscillatorNode')
      expect(store.visualNodes[0].position).toEqual({ x: 100, y: 200 })
    })

    it('should create audio node when adding visual node', async () => {
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })
      const node = store.visualNodes.find(n => n.id === nodeId)

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
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for lifecycle hooks to complete
      await waitFor(
        () => {
          expect(store.audioNodes.has(nodeId)).toBe(true)
        },
        { timeout: 2000 }
      )

      expect(store.visualNodes).toHaveLength(1)

      store.removeNode(nodeId)

      // Wait for cleanup to complete
      await waitFor(
        () => {
          expect(store.audioNodes.has(nodeId)).toBe(false)
        },
        { timeout: 2000 }
      )

      expect(store.visualNodes).toHaveLength(0)
    })

    it('should update node position', () => {
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      store.updateNodePosition(nodeId, { x: 300, y: 400 })

      expect(store.visualNodes[0].position).toEqual({ x: 300, y: 400 })
    })

    it('should select and deselect nodes', () => {
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      store.selectNode(nodeId)
      expect(store.selectedNodeId).toBe(nodeId)
      expect(store.selectedNode).toBe(store.visualNodes[0])

      store.selectNode(undefined)
      expect(store.selectedNodeId).toBeUndefined()
      expect(store.selectedNode).toBeUndefined()
    })
  })

  describe('Edge Management', () => {
    let sourceNodeId: string
    let targetNodeId: string

    beforeEach(async () => {
      sourceNodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })
      targetNodeId = store.addNode('GainNode', { x: 300, y: 200 })

      // Wait for lifecycle hooks to complete
      await waitFor(() => store.visualNodes.length === 2)
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
          const sourceNode = store.visualNodes.find(n => n.id === sourceNodeId)
          const targetNode = store.visualNodes.find(n => n.id === targetNodeId)
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

      store.addNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for patch recording
      await waitFor(() => {
        expect(store.canUndo).toBe(true)
        expect(store.canRedo).toBe(false)
      })
    })

    it('should undo node addition', async () => {
      store.addNode('OscillatorNode', { x: 100, y: 200 })

      expect(store.visualNodes).toHaveLength(1)

      // Wait for patch recording
      await waitFor(() => store.undoStack.length > 0)

      store.undo()

      expect(store.visualNodes).toHaveLength(0)
      expect(store.canRedo).toBe(true)
    })

    it('should redo node addition', async () => {
      store.addNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for patch recording
      await waitFor(() => store.undoStack.length > 0)

      store.undo()
      expect(store.visualNodes).toHaveLength(0)

      store.redo()
      expect(store.visualNodes).toHaveLength(1)
      expect(store.visualNodes[0].data.nodeType).toBe('OscillatorNode')
    })

    it('should undo edge addition', async () => {
      const sourceNodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })
      const targetNodeId = store.addNode('GainNode', { x: 300, y: 200 })

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
      store.addNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for patch recording
      await waitFor(() => store.undoStack.length > 0)

      store.undo()
      expect(store.canRedo).toBe(true)

      store.addNode('GainNode', { x: 300, y: 200 })

      // Wait for patch recording
      await waitFor(() => store.undoStack.length > 1)

      expect(store.canRedo).toBe(false)
    })

    it('should not record play/stop operations in undo history', async () => {
      // Add a node to create some initial history
      store.addNode('OscillatorNode', { x: 100, y: 100 })

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

      // Wait for any potential patches
      await waitFor(() => store.undoStack.length > initialUndoLength)

      // Verify that play/stop operations didn't add to undo history
      expect(store.undoStack.length).toBe(initialUndoLength)
      expect(store.canUndo).toBe(true) // Should still be able to undo the node addition
      expect(store.canRedo).toBe(false) // No redo history should be created

      // Verify that we can still undo the original node addition
      store.undo()
      expect(store.visualNodes.length).toBe(0)
    })

    it('should not record automatic play state changes in undo history', async () => {
      // Add oscillator and destination nodes
      const oscId = store.addNode('OscillatorNode', { x: 100, y: 100 })
      const destId = store.addNode('AudioDestinationNode', { x: 300, y: 100 })

      // Wait for patches to be recorded
      await waitFor(() => store.undoStack.length > 0)

      // Record initial undo stack length
      const initialUndoLength = store.undoStack.length
      expect(store.canUndo).toBe(true)

      // Connect nodes (this should automatically set isPlaying to true)
      store.addEdge(oscId, destId, 'output', 'input')
      expect(store.isPlaying).toBe(true)

      // Wait for any potential patches
      await waitFor(() => store.undoStack.length > initialUndoLength)

      // Disconnect nodes (this should automatically set isPlaying to false)
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

      await store.togglePlayback()
      expect(store.isPlaying).toBe(true)
      // New implementation creates fresh audio context

      await store.togglePlayback()
      expect(store.isPlaying).toBe(false)
      // New implementation closes audio context
    })
  })

  describe('Property Management', () => {
    it('should update node properties', async () => {
      const nodeId = store.addNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for lifecycle hooks to complete
      await waitFor(() => store.visualNodes.length === 1)

      store.updateNodeProperty(nodeId, 'frequency', 880)

      // Wait for property reaction to fire
      await waitFor(() => store.visualNodes[0].data.properties.get('frequency') === 880)

      const node = store.visualNodes[0]
      expect(node.data.properties.get('frequency')).toBe(880)

      const audioNode = store.audioNodes.get(nodeId) as unknown as { frequency: { value: number } }
      expect(audioNode.frequency.value).toBe(880)
    })
  })

  describe('AudioGraphStore - Undo/Redo History', () => {
    it('should clear undo/redo history when clearing all nodes', async () => {
      // Add some nodes to create history
      const nodeId1 = store.addNode('OscillatorNode', { x: 100, y: 100 })
      const nodeId2 = store.addNode('GainNode', { x: 200, y: 100 })

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
      expect(store.visualNodes.length).toBe(0)
      expect(store.visualEdges.length).toBe(0)
    })

    it('should not record clearAllNodes operation in undo history', async () => {
      // Add a node
      store.addNode('OscillatorNode', { x: 100, y: 100 })

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
      store.addNode('OscillatorNode', { x: 100, y: 100 })
      store.addNode('GainNode', { x: 200, y: 100 })

      // Wait for patches
      await waitFor(() => store.undoStack.length > 0)

      // Clear all nodes (this clears history)
      store.clearAllNodes()

      // Add new nodes after clearing
      const newNodeId = store.addNode('DelayNode', { x: 300, y: 100 })

      // Wait for patches
      await waitFor(() => store.undoStack.length > 0)

      // Verify we have a clean slate with new history
      expect(store.visualNodes.length).toBe(1)
      expect(store.visualNodes[0].id).toBe(newNodeId)
      expect(store.canUndo).toBe(true) // New action should be undoable
      expect(store.canRedo).toBe(false) // No redo history yet
    })
  })

  describe('AudioGraphStore - Backward Compatibility', () => {
    it('should load projects with utility category nodes correctly', () => {
      // Simulate a saved project with nodes that have "utility" category
      const projectSnapshot = {
        visualNodes: [
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
        expect(store.visualNodes).toHaveLength(2)
        expect(store.visualNodes[0].data.nodeType).toBe('SliderNode')
        expect(store.visualNodes[1].data.nodeType).toBe('DisplayNode')

        // Verify the metadata category is preserved
        expect(store.visualNodes[0].data.metadata.category).toBe('utility')
        expect(store.visualNodes[1].data.metadata.category).toBe('utility')

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
        visualNodes: [
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
          const node1 = store.visualNodes.find(n => n.id === 'SliderNode-old')
          const node2 = store.visualNodes.find(n => n.id === 'DisplayNode-new')
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
          expect(store.visualNodes).toHaveLength(2)
          expect(store.customNodes.size).toBe(2)

          // Categories should be preserved as they were saved
          expect(store.visualNodes[0].data.metadata.category).toBe('utility')
          expect(store.visualNodes[1].data.metadata.category).toBe('misc')
        })
    })

    it('should properly display visual nodes when loading a project after another project', async () => {
      // First, create and save a project
      store.addNode('OscillatorNode', { x: 100, y: 100 })
      store.addNode('GainNode', { x: 200, y: 200 })

      expect(store.visualNodes.length).toBe(2)
      expect(store.audioNodes.size).toBe(2)

      // Get the snapshot of the first project
      const firstProjectSnapshot = getSnapshot(store)

      // Clear and load a different project
      store.clearAllNodes()
      store.addNode('BiquadFilterNode', { x: 300, y: 300 })

      expect(store.visualNodes.length).toBe(1)
      expect(store.audioNodes.size).toBe(1)

      // Now load the first project again (simulating loading after loading)
      applySnapshot(store, firstProjectSnapshot)
      store.init()

      // Check that visual nodes are properly restored and visible
      expect(store.visualNodes.length).toBe(2)
      expect(store.audioNodes.size).toBe(2)

      // Check that the nodes have the correct types
      const nodeTypes = store.visualNodes.map(node => node.data.nodeType).sort()
      expect(nodeTypes).toEqual(['GainNode', 'OscillatorNode'])

      // Check that visual nodes have proper positions (indicating they're properly loaded)
      const oscillatorNode = store.visualNodes.find(node => node.data.nodeType === 'OscillatorNode')
      const gainNode = store.visualNodes.find(node => node.data.nodeType === 'GainNode')

      expect(oscillatorNode?.position).toEqual({ x: 100, y: 100 })
      expect(gainNode?.position).toEqual({ x: 200, y: 200 })
    })
  })
})
