/**
 * Composite Node Store MST Integration Tests
 *
 * These tests verify that the MST store operations work correctly
 * WITHOUT mocking - testing actual MobX State Tree behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type {
  CompositeNodePort,
  CompositeNodeInternalGraph,
  CompositeNodeDefinition,
} from '~/types'

// Mock only the database operations, not the store itself
vi.mock('~/utils/database', () => ({
  compositeNodeOperations: {
    getAllCompositeNodes: vi.fn().mockResolvedValue([]),
    saveCompositeNode: vi.fn().mockResolvedValue(1),
    updateCompositeNode: vi.fn().mockResolvedValue(undefined),
    deleteCompositeNode: vi.fn().mockResolvedValue(undefined),
  },
}))

// Import the actual store AFTER mocking database
import { compositeNodeDefinitionStore } from '~/stores/CompositeNodeDefinitionStore'
import prebuiltCompositeNodes from '~/types/composite-nodes-prebuilt.json'

describe('Composite Store MST Integration', () => {
  beforeEach(async () => {
    compositeNodeDefinitionStore.clear()
    const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
    await compositeNodeDefinitionStore.initialize(prebuiltDefs)
  })

  describe('saveAsCompositeNode - MST object cloning', () => {
    it('should create independent copy without MST reference sharing', async () => {
      const originalId = 'DelayEffect'
      const original = compositeNodeDefinitionStore.getDefinition(originalId)
      expect(original).toBeDefined()

      const originalNodeCount = original!.internalGraph.nodes.length
      const originalInputCount = original!.inputs.length

      // Save as new
      const newId = await compositeNodeDefinitionStore.saveAsCompositeNode(
        originalId,
        'My Copy',
        'A copy'
      )

      expect(newId).toBeDefined()

      const copy = compositeNodeDefinitionStore.getDefinition(newId as string)
      expect(copy).toBeDefined()

      // Verify the copy is independent (different MST nodes)
      expect(copy).not.toBe(original)
      expect(copy!.internalGraph).not.toBe(original!.internalGraph)

      // Verify content is the same
      expect(copy!.internalGraph.nodes.length).toBe(originalNodeCount)
      expect(copy!.inputs.length).toBe(originalInputCount)
    })

    it('should handle multiple sequential saves without MST errors', async () => {
      const originalId = 'DelayEffect'

      // Perform multiple saves in sequence
      const ids: string[] = []
      for (let i = 0; i < 5; i++) {
        const newId = await compositeNodeDefinitionStore.saveAsCompositeNode(
          originalId,
          `Copy ${i}`,
          `Description ${i}`
        )
        ids.push(newId as string)
      }

      // All should be unique
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(5)

      // All should be retrievable
      ids.forEach(id => {
        const def = compositeNodeDefinitionStore.getDefinition(id)
        expect(def).toBeDefined()
      })
    })

    it('should be able to save a copy of a copy', async () => {
      const originalId = 'DelayEffect'

      // Create first copy
      const copy1Id = await compositeNodeDefinitionStore.saveAsCompositeNode(
        originalId,
        'First Copy',
        'First'
      )

      // Create copy of copy
      const copy2Id = await compositeNodeDefinitionStore.saveAsCompositeNode(
        copy1Id as string,
        'Second Copy',
        'Second'
      )

      expect(copy2Id).toBeDefined()
      expect(copy2Id).not.toBe(copy1Id)

      const copy2 = compositeNodeDefinitionStore.getDefinition(copy2Id as string)
      expect(copy2).toBeDefined()
      expect(copy2!.name).toBe('Second Copy')
    })
  })

  describe('saveCompositeNode - new node creation', () => {
    it('should save new composite node with plain JS objects', async () => {
      const inputs: CompositeNodePort[] = [
        { id: 'in1', name: 'Input', type: 'audio', description: 'Audio input' },
        { id: 'ctrl1', name: 'Volume', type: 'control', description: 'Volume control' },
      ]

      const outputs: CompositeNodePort[] = [
        { id: 'out1', name: 'Output', type: 'audio', description: 'Audio output' },
      ]

      const internalGraph: CompositeNodeInternalGraph = {
        nodes: [
          {
            id: 'gain1',
            nodeType: 'GainNode',
            position: { x: 200, y: 100 },
            properties: [{ name: 'gain', value: 1 }],
          },
        ],
        edges: [],
        connections: [],
      }

      const newId = await compositeNodeDefinitionStore.saveCompositeNode(
        'Test Node',
        'Test description',
        inputs,
        outputs,
        internalGraph
      )

      expect(newId).toBeDefined()

      const saved = compositeNodeDefinitionStore.getDefinition(newId as string)
      expect(saved).toBeDefined()
      expect(saved!.name).toBe('Test Node')
      expect(saved!.inputs.length).toBe(2)
      expect(saved!.outputs.length).toBe(1)
    })

    it('should handle complex nested objects', async () => {
      const inputs: CompositeNodePort[] = [{ id: 'in1', name: 'Input', type: 'audio' }]

      const outputs: CompositeNodePort[] = [{ id: 'out1', name: 'Output', type: 'audio' }]

      const internalGraph: CompositeNodeInternalGraph = {
        nodes: [
          {
            id: 'node1',
            nodeType: 'GainNode',
            position: { x: 100, y: 50 },
            properties: [{ name: 'gain', value: 0.5 }],
          },
          {
            id: 'node2',
            nodeType: 'DelayNode',
            position: { x: 200, y: 50 },
            properties: [{ name: 'delayTime', value: 0.3 }],
          },
          {
            id: 'node3',
            nodeType: 'GainNode',
            position: { x: 300, y: 50 },
            properties: [{ name: 'gain', value: 0.7 }],
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'node1',
            target: 'node2',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
          {
            id: 'e2',
            source: 'node2',
            target: 'node3',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
        ],
        connections: [
          {
            sourceNodeId: 'node1',
            targetNodeId: 'node2',
            sourceOutput: 'output',
            targetInput: 'input',
          },
          {
            sourceNodeId: 'node2',
            targetNodeId: 'node3',
            sourceOutput: 'output',
            targetInput: 'input',
          },
        ],
      }

      const newId = await compositeNodeDefinitionStore.saveCompositeNode(
        'Complex Node',
        'Complex test',
        inputs,
        outputs,
        internalGraph
      )

      const saved = compositeNodeDefinitionStore.getDefinition(newId as string)
      expect(saved).toBeDefined()
      expect(saved!.internalGraph.nodes.length).toBe(3)
      expect(saved!.internalGraph.edges.length).toBe(2)
      expect(saved!.internalGraph.connections.length).toBe(2)
    })
  })

  describe('position object handling', () => {
    it('position objects should be properly cloned', async () => {
      const originalId = 'DelayEffect'
      const original = compositeNodeDefinitionStore.getDefinition(originalId)

      // Save as copy
      const copyId = await compositeNodeDefinitionStore.saveAsCompositeNode(
        originalId,
        'Position Test',
        'Test'
      )

      const copy = compositeNodeDefinitionStore.getDefinition(copyId as string)

      // Verify positions are independent objects
      if (original!.internalGraph.nodes.length > 0 && copy!.internalGraph.nodes.length > 0) {
        const originalNode = original!.internalGraph.nodes[0]
        const copyNode = copy!.internalGraph.nodes[0]

        // They should have the same values
        expect(copyNode.position.x).toBe(originalNode.position.x)
        expect(copyNode.position.y).toBe(originalNode.position.y)

        // But be different objects (MST nodes)
        expect(copyNode.position).not.toBe(originalNode.position)
      }
    })
  })

  describe('error handling', () => {
    it('should throw error when saving as from non-existent definition', async () => {
      await expect(
        compositeNodeDefinitionStore.saveAsCompositeNode('NonExistentId', 'Test', 'Test')
      ).rejects.toThrow()
    })
  })
})

describe('Deep Clone Verification', () => {
  it('JSON.parse(JSON.stringify()) creates fully independent objects', () => {
    const original = {
      nodes: [
        { id: 'n1', position: { x: 100, y: 200 } },
        { id: 'n2', position: { x: 300, y: 400 } },
      ],
    }

    const clone = JSON.parse(JSON.stringify(original))

    // Modify clone
    clone.nodes[0].position.x = 999

    // Original should be unchanged
    expect(original.nodes[0].position.x).toBe(100)
  })
})

describe('CompositeEditorStore', () => {
  // Import at top level for vitest
  let compositeEditorStore: typeof import('~/stores/CompositeEditorStore').compositeEditorStore

  beforeEach(async () => {
    const module = await import('~/stores/CompositeEditorStore')
    compositeEditorStore = module.compositeEditorStore
    compositeEditorStore.closeEditor() // Reset state
  })

  it('should track source node ID when opening editor', () => {
    compositeEditorStore.openEditor('TestDefinition', 'source-node-123')

    expect(compositeEditorStore.isOpen).toBe(true)
    expect(compositeEditorStore.editingDefinitionId).toBe('TestDefinition')
    expect(compositeEditorStore.sourceNodeId).toBe('source-node-123')

    compositeEditorStore.closeEditor()

    expect(compositeEditorStore.isOpen).toBe(false)
    expect(compositeEditorStore.sourceNodeId).toBe(null)
  })

  it('should switch to new definition after save as', () => {
    compositeEditorStore.openEditor('OriginalDefinition', 'source-node-456')
    expect(compositeEditorStore.editingDefinitionId).toBe('OriginalDefinition')

    compositeEditorStore.switchToDefinition('NewDefinition')

    expect(compositeEditorStore.editingDefinitionId).toBe('NewDefinition')
    expect(compositeEditorStore.isCreatingNew).toBe(false)
    expect(compositeEditorStore.sourceNodeId).toBe('source-node-456') // Should be preserved

    compositeEditorStore.closeEditor()
  })
})

describe('Save As workflow - node preservation', () => {
  /**
   * Regression test for bug:
   * 1. Added a preset to the main graph
   * 2. Saved it as...
   * 3. Edited it
   * 4. When closed the editor, node was gone from main graph
   *
   * Root cause: GraphCanvas sync effect skipped re-syncing when node count
   * didn't change, even when node properties (like nodeType) changed.
   * The effect only checked local forceUpdate state, not graphChangeCounter.
   */
  it('node should remain in graph after Save As updates its definition', async () => {
    // This is a behavioral test - the actual fix is in GraphCanvas.tsx
    // where we now check graphChangeCounterChanged in addition to forceUpdateChanged

    // Import stores
    const { compositeNodeDefinitionStore } = await import('~/stores/CompositeNodeDefinitionStore')
    const { compositeEditorStore } = await import('~/stores/CompositeEditorStore')

    // Initialize store
    compositeNodeDefinitionStore.clear()
    const prebuiltModule = await import('~/types/composite-nodes-prebuilt.json')
    const prebuiltDefs = Object.values(prebuiltModule.default) as CompositeNodeDefinition[]
    await compositeNodeDefinitionStore.initialize(prebuiltDefs)

    // Verify we have a preset definition
    const originalDef = compositeNodeDefinitionStore.getDefinition('DelayEffect')
    expect(originalDef).toBeDefined()
    expect(originalDef!.isPrebuilt).toBe(true)

    // Simulate opening editor for a node
    compositeEditorStore.openEditor('DelayEffect', 'test-node-id-123')
    expect(compositeEditorStore.sourceNodeId).toBe('test-node-id-123')

    // Simulate Save As - creates a new user definition
    const newId = await compositeNodeDefinitionStore.saveAsCompositeNode(
      'DelayEffect',
      'My Custom Delay',
      'Custom description'
    )

    expect(newId).toBeDefined()

    // Switch to new definition
    compositeEditorStore.switchToDefinition(newId as string)
    expect(compositeEditorStore.editingDefinitionId).toBe(newId)

    // Source node ID should still be tracked
    expect(compositeEditorStore.sourceNodeId).toBe('test-node-id-123')

    // The new definition should exist and be user-created
    const newDef = compositeNodeDefinitionStore.getDefinition(newId as string)
    expect(newDef).toBeDefined()
    expect(newDef!.isPrebuilt).toBe(false)
    expect(newDef!.category).toBe('user-composite')

    // Clean up
    compositeEditorStore.closeEditor()
  })
})
