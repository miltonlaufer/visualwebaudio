import { describe, it, expect, beforeEach, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { rootStore } from './RootStore'
import type { AudioGraphStoreType } from './AudioGraphStore'

// Mock audio context
const createMockAudioContext = (): Partial<AudioContext> => ({
  state: 'running' as AudioContextState,
  sampleRate: 44100,
  currentTime: 0,
  destination: {} as AudioDestinationNode,
  createOscillator: vi.fn(() => ({
    frequency: { value: 440, setValueAtTime: vi.fn() },
    type: 'sine',
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })) as any,
  createGain: vi.fn(() => ({
    gain: { value: 1, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })) as any,
  createAnalyser: vi.fn(() => ({
    fftSize: 1024,
    smoothingTimeConstant: 0.8,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })) as any,
  suspend: vi.fn(),
  resume: vi.fn(),
  close: vi.fn(),
})

// Mock the global AudioContext constructor
global.AudioContext = vi.fn(() => createMockAudioContext()) as any

describe('UndoManager Integration Tests', () => {
  let store: AudioGraphStoreType
  let root: typeof rootStore

  beforeEach(() => {
    // Use the rootStore's audioGraph instead of creating directly
    store = rootStore.audioGraph
    root = rootStore
    store.loadMetadata()

    // Clean up any existing nodes from previous tests
    if (store.adaptedNodes.length > 0) {
      store.clearAllNodes()
    }

    // Reset project modification state and undo history
    root.setProjectModified(false)
    store.history.clear()
  })

  describe('Basic Undo/Redo Functionality', () => {
    it('should track undo/redo availability', async () => {
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)

      store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for action to be recorded
      await waitFor(() => {
        expect(store.canUndo).toBe(true)
        expect(store.canRedo).toBe(false)
      })
    })

    it('should undo node addition', async () => {
      // Ensure store is fully initialized
      expect(store.history).toBeDefined()
      expect(store.history.undoLevels).toBe(0)

      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      expect(store.adaptedNodes).toHaveLength(1)
      expect(store.adaptedNodes[0].id).toBe(nodeId)

      // Wait for action to be recorded with more robust checking
      await waitFor(
        () => {
          return store.history.undoLevels > 0 && store.canUndo
        },
        { timeout: 3000, interval: 50 }
      )

      // Verify we can undo
      expect(store.canUndo).toBe(true)
      expect(store.canRedo).toBe(false)

      store.undo()

      expect(store.adaptedNodes).toHaveLength(0)
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(true)
    })

    it('should redo node addition', async () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for action to be recorded
      await waitFor(
        () => {
          return store.history.undoLevels > 0 && store.canUndo
        },
        { timeout: 3000, interval: 50 }
      )

      expect(store.canUndo).toBe(true)
      store.undo()
      expect(store.adaptedNodes).toHaveLength(0)
      expect(store.canRedo).toBe(true)

      store.redo()
      expect(store.adaptedNodes).toHaveLength(1)
      expect(store.adaptedNodes[0].nodeType).toBe('OscillatorNode')
      expect(store.adaptedNodes[0].id).toBe(nodeId)
    })

    it('should undo edge addition', async () => {
      const sourceNodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })
      const targetNodeId = store.addAdaptedNode('GainNode', { x: 300, y: 200 })

      // Wait for nodes to be recorded
      await waitFor(() => store.canUndo, { timeout: 3000 })

      store.addEdge(sourceNodeId, targetNodeId, 'output', 'input')
      expect(store.visualEdges).toHaveLength(1)

      // Wait for edge addition to be recorded
      await waitFor(() => store.history.undoLevels > 1, { timeout: 3000 })

      store.undo()
      expect(store.visualEdges).toHaveLength(0)
    })

    it('should clear redo stack when new action is performed', async () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for action to be recorded
      await waitFor(
        () => {
          return store.history.undoLevels > 0 && store.canUndo
        },
        { timeout: 3000, interval: 50 }
      )

      store.undo()
      expect(store.canRedo).toBe(true)
      expect(store.adaptedNodes).toHaveLength(0)

      // Add a new node which should clear the redo stack
      const nodeId2 = store.addAdaptedNode('GainNode', { x: 300, y: 200 })

      // Wait for new action to be recorded and redo stack to be cleared
      await waitFor(
        () => {
          return store.history.undoLevels > 0 && !store.canRedo
        },
        { timeout: 3000, interval: 50 }
      )

      expect(store.canRedo).toBe(false)
      expect(store.adaptedNodes).toHaveLength(1)
      expect(store.adaptedNodes[0].id).toBe(nodeId2)
    })
  })

  describe('Property Changes', () => {
    it('should undo property changes', async () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for node creation to be recorded
      await waitFor(() => store.canUndo, { timeout: 3000 })

      store.updateNodeProperty(nodeId, 'frequency', 880)

      // Wait for property change to be recorded
      await waitFor(() => store.history.undoLevels > 1, { timeout: 3000 })

      const node = store.adaptedNodes.find(n => n.id === nodeId)
      expect(node?.properties.get('frequency')).toBe(880)

      store.undo()

      const updatedNode = store.adaptedNodes.find(n => n.id === nodeId)
      expect(updatedNode?.properties.get('frequency')).toBe(440) // default frequency
    })

    it('should undo position changes', async () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for node creation to be recorded
      await waitFor(() => store.canUndo, { timeout: 3000 })

      store.updateNodePosition(nodeId, { x: 300, y: 400 })

      // Wait for position change to be recorded
      await waitFor(() => store.history.undoLevels > 1, { timeout: 3000 })

      const node = store.adaptedNodes.find(n => n.id === nodeId)
      expect(node?.position.x).toBe(300)
      expect(node?.position.y).toBe(400)

      store.undo()

      const updatedNode = store.adaptedNodes.find(n => n.id === nodeId)
      expect(updatedNode?.position.x).toBe(100)
      expect(updatedNode?.position.y).toBe(200)
    })
  })

  describe('Exclusions', () => {
    it('should not record play/stop operations in undo history', async () => {
      // Add a node to create some initial history
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for action to be recorded
      await waitFor(() => store.canUndo, { timeout: 3000 })

      const initialUndoLevels = store.history.undoLevels

      // Since togglePlayback is async, we need to call the underlying play actions
      root.setIsPlaying(true)
      root.setIsPlaying(false)
      root.setIsPlaying(true)
      root.setIsPlaying(false)

      // Small delay to ensure any potential recording would have happened
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify that play/stop operations didn't add to undo history
      expect(store.history.undoLevels).toBe(initialUndoLevels)
      expect(store.canRedo).toBe(false)
    })

    it('should not record node selection changes in undo history', async () => {
      const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for action to be recorded
      await waitFor(() => store.canUndo, { timeout: 3000 })

      const initialUndoLevels = store.history.undoLevels

      // Select and deselect node multiple times
      root.selectNode(nodeId)
      root.selectNode(undefined)
      root.selectNode(nodeId)

      // Small delay to ensure any potential recording would have happened
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify that selection changes didn't add to undo history
      expect(store.history.undoLevels).toBe(initialUndoLevels)
    })

    it('should not record clearAllNodes operation in undo history', async () => {
      // Add some nodes
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.addAdaptedNode('GainNode', { x: 200, y: 100 })

      // Wait for actions to be recorded
      await waitFor(() => store.canUndo, { timeout: 3000 })

      // Clear all nodes
      store.clearAllNodes()

      // Verify that clearAllNodes cleared the history
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)
      expect(store.history.undoLevels).toBe(0)
      expect(store.history.redoLevels).toBe(0)
    })
  })

  describe('Complex Operations', () => {
    it('should handle multiple rapid operations', async () => {
      // Add multiple nodes with a small delay between them to ensure separate undo entries
      const nodeIds: string[] = []
      for (let i = 0; i < 5; i++) {
        const nodeId = store.addAdaptedNode('OscillatorNode', { x: i * 100, y: 100 })
        nodeIds.push(nodeId)
        // Small delay to ensure each action is recorded separately
        await new Promise(resolve => setTimeout(resolve, 20))
      }

      // Wait for all operations to be recorded - be more flexible about the exact count
      await waitFor(
        () => {
          return store.history.undoLevels >= 1 && store.canUndo
        },
        { timeout: 5000, interval: 50 }
      )

      // Verify all nodes exist
      expect(store.adaptedNodes).toHaveLength(5)

      // Undo all operations step by step
      let undoCount = 0
      while (store.canUndo && undoCount < 10) {
        // Safety limit
        const nodesBefore = store.adaptedNodes.length
        store.undo()
        undoCount++
        // Each undo should remove at least some nodes or this should be the last undo
        if (store.adaptedNodes.length === nodesBefore && store.canUndo) {
          // If no change and there's still more to undo, something is wrong
          throw new Error(`Undo ${undoCount} didn't change anything but canUndo is still true`)
        }
      }

      // Verify all nodes are gone
      expect(store.adaptedNodes).toHaveLength(0)

      // Redo all operations
      let redoCount = 0
      while (store.canRedo && redoCount < 10) {
        // Safety limit
        const nodesBefore = store.adaptedNodes.length
        store.redo()
        redoCount++
        // Each redo should add at least some nodes or this should be the last redo
        if (store.adaptedNodes.length === nodesBefore && store.canRedo) {
          throw new Error(`Redo ${redoCount} didn't change anything but canRedo is still true`)
        }
      }

      // Verify all nodes are back
      expect(store.adaptedNodes).toHaveLength(5)
    })

    it('should handle node creation and connection in sequence', async () => {
      // Create nodes and connect them
      const sourceId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for first node to be recorded
      await waitFor(
        () => {
          return store.history.undoLevels >= 1 && store.canUndo
        },
        { timeout: 3000, interval: 50 }
      )

      const targetId = store.addAdaptedNode('GainNode', { x: 300, y: 200 })

      // Wait for both nodes to be recorded
      await waitFor(
        () => {
          return store.history.undoLevels >= 2 && store.canUndo
        },
        { timeout: 3000, interval: 50 }
      )

      store.addEdge(sourceId, targetId, 'output', 'input')

      // Wait for edge creation to be recorded
      await waitFor(
        () => {
          return store.history.undoLevels >= 3 && store.canUndo && store.visualEdges.length === 1
        },
        { timeout: 3000, interval: 50 }
      )

      expect(store.adaptedNodes).toHaveLength(2)
      expect(store.visualEdges).toHaveLength(1)

      // Undo operations step by step
      store.undo() // Undo edge
      expect(store.visualEdges).toHaveLength(0)
      expect(store.adaptedNodes).toHaveLength(2)

      store.undo() // Undo second node
      expect(store.adaptedNodes).toHaveLength(1)

      store.undo() // Undo first node
      expect(store.adaptedNodes).toHaveLength(0)
    })
  })

  describe('Project Modification Tracking', () => {
    it('should mark project as modified when performing undoable actions', async () => {
      expect(root.isProjectModified).toBe(false)

      store.addAdaptedNode('OscillatorNode', { x: 100, y: 200 })

      // Wait for action to be recorded
      await waitFor(() => store.canUndo, { timeout: 3000 })

      expect(root.isProjectModified).toBe(true)
    })

    it('should not mark project as modified when undoing/redoing', async () => {
      // Add a node to create undo history
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })

      // Wait for action to be recorded
      await waitFor(
        () => {
          return store.history.undoLevels > 0 && store.canUndo
        },
        { timeout: 3000, interval: 50 }
      )

      root.setProjectModified(false) // Reset

      store.undo()

      expect(root.isProjectModified).toBe(false)

      store.redo()

      expect(root.isProjectModified).toBe(false)
    })
  })
})
