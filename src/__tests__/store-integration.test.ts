/**
 * Store Integration Tests
 *
 * Tests for the interactions between stores:
 * - CompositeNodeDefinitionStore + CompositeEditorStore
 * - CompositeGraphContext + CompositeNodeDefinitionStore
 * - GraphOperationsStore + contexts
 *
 * These tests verify end-to-end workflows without mocking stores.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type {
  CompositeNodePort,
  CompositeNodeInternalGraph,
  CompositeNodeDefinition,
} from '~/types'

// Mock only the database operations
vi.mock('~/utils/database', () => ({
  compositeNodeOperations: {
    getAllCompositeNodes: vi.fn().mockResolvedValue([]),
    saveCompositeNode: vi.fn().mockResolvedValue(Date.now()),
    updateCompositeNode: vi.fn().mockResolvedValue(undefined),
    deleteCompositeNode: vi.fn().mockResolvedValue(undefined),
  },
}))

// Import stores AFTER mocking
import { compositeNodeDefinitionStore } from '~/stores/CompositeNodeDefinitionStore'
import { compositeEditorStore } from '~/stores/CompositeEditorStore'
import { CompositeGraphContext } from '~/stores/CompositeGraphContext'
import { graphOperationsStore } from '~/stores/GraphOperationsStore'
import prebuiltCompositeNodes from '~/types/composite-nodes-prebuilt.json'

/******************* HELPERS ***********************/

function createTestDefinition(): {
  inputs: CompositeNodePort[]
  outputs: CompositeNodePort[]
  internalGraph: CompositeNodeInternalGraph
} {
  return {
    inputs: [
      { id: 'in1', name: 'Input', type: 'audio', description: 'Audio input' },
      { id: 'ctrl1', name: 'Volume', type: 'control', description: 'Volume control' },
    ],
    outputs: [{ id: 'out1', name: 'Output', type: 'audio', description: 'Audio output' }],
    internalGraph: {
      nodes: [
        {
          id: 'gain1',
          nodeType: 'GainNode',
          position: { x: 200, y: 100 },
          properties: [{ name: 'gain', value: 1 }],
        },
        {
          id: 'delay1',
          nodeType: 'DelayNode',
          position: { x: 400, y: 100 },
          properties: [{ name: 'delayTime', value: 0.5 }],
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'gain1',
          target: 'delay1',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ],
      connections: [
        {
          sourceNodeId: 'gain1',
          targetNodeId: 'delay1',
          sourceOutput: 'output',
          targetInput: 'input',
        },
      ],
    },
  }
}

/******************* WORKFLOW TESTS ***********************/

describe('Store Integration - Composite Node Creation Workflow', () => {
  beforeEach(async () => {
    compositeNodeDefinitionStore.clear()
    compositeEditorStore.closeEditor()
    const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
    await compositeNodeDefinitionStore.initialize(prebuiltDefs)
  })

  afterEach(() => {
    compositeEditorStore.closeEditor()
    vi.clearAllMocks()
  })

  it('should complete full workflow: open editor -> create -> save', async () => {
    // 1. Open editor for new composite
    compositeEditorStore.createNew()
    expect(compositeEditorStore.isOpen).toBe(true)
    expect(compositeEditorStore.isCreatingNew).toBe(true)

    // 2. Create definition data
    const { inputs, outputs, internalGraph } = createTestDefinition()

    // 3. Save the new composite
    const newId = await compositeNodeDefinitionStore.saveCompositeNode(
      'My Custom Effect',
      'A custom audio effect',
      inputs,
      outputs,
      internalGraph
    )

    expect(newId).toBeDefined()

    // 4. Verify it exists in the store
    const saved = compositeNodeDefinitionStore.getDefinition(newId as string)
    expect(saved).toBeDefined()
    expect(saved!.name).toBe('My Custom Effect')
    expect(saved!.isPrebuilt).toBe(false)
    expect(saved!.category).toBe('user-composite')

    // 5. Close editor
    compositeEditorStore.closeEditor()
    expect(compositeEditorStore.isOpen).toBe(false)

    // 6. Verify definition is still accessible
    const stillExists = compositeNodeDefinitionStore.getDefinition(newId as string)
    expect(stillExists).toBeDefined()
  })

  it('should complete workflow: open preset -> save as -> edit', async () => {
    const sourceNodeId = 'main-graph-node-123'

    // 1. Open preset in editor (simulating double-click on node in main graph)
    compositeEditorStore.openEditor('DelayEffect', sourceNodeId)
    expect(compositeEditorStore.editingDefinitionId).toBe('DelayEffect')
    expect(compositeEditorStore.sourceNodeId).toBe(sourceNodeId)

    // 2. Verify preset is read-only indicator (via the definition)
    const presetDef = compositeNodeDefinitionStore.getDefinition('DelayEffect')
    expect(presetDef!.isPrebuilt).toBe(true)

    // 3. Save as new user composite
    const userCopyId = await compositeNodeDefinitionStore.saveAsCompositeNode(
      'DelayEffect',
      'My Delay Effect',
      'Customized delay'
    )
    expect(userCopyId).toBeDefined()

    // 4. Switch editor to the new definition
    compositeEditorStore.switchToDefinition(userCopyId as string)
    expect(compositeEditorStore.editingDefinitionId).toBe(userCopyId)
    expect(compositeEditorStore.sourceNodeId).toBe(sourceNodeId) // Preserved

    // 5. Verify new definition is editable
    const userDef = compositeNodeDefinitionStore.getDefinition(userCopyId as string)
    expect(userDef!.isPrebuilt).toBe(false)

    // 6. Update the user definition (must clone data to avoid MST reference issues)
    const updatedInputs = userDef!.inputs.map(i => ({
      id: i.id,
      name: i.name,
      type: i.type as 'audio' | 'control',
      description: i.description,
    }))
    const updatedOutputs = userDef!.outputs.map(o => ({
      id: o.id,
      name: o.name,
      type: o.type as 'audio' | 'control',
      description: o.description,
    }))
    const updatedGraph: CompositeNodeInternalGraph = JSON.parse(
      JSON.stringify({
        nodes: userDef!.internalGraph.nodes,
        edges: userDef!.internalGraph.edges,
        connections: userDef!.internalGraph.connections,
      })
    )

    await compositeNodeDefinitionStore.updateCompositeNode(
      userCopyId as string,
      'My Custom Delay Effect',
      'Updated description',
      updatedInputs,
      updatedOutputs,
      updatedGraph
    )

    // 7. Verify update
    const updated = compositeNodeDefinitionStore.getDefinition(userCopyId as string)
    expect(updated!.name).toBe('My Custom Delay Effect')
    expect(updated!.description).toBe('Updated description')

    // 8. Close editor
    compositeEditorStore.closeEditor()
  })

  it('should handle multiple Save As from same preset', async () => {
    // Create multiple copies from same preset
    const copyIds: string[] = []

    for (let i = 0; i < 3; i++) {
      const copyId = await compositeNodeDefinitionStore.saveAsCompositeNode(
        'DelayEffect',
        `Delay Copy ${i}`,
        `Copy number ${i}`
      )
      copyIds.push(copyId as string)
    }

    // All should exist and be unique
    expect(new Set(copyIds).size).toBe(3)

    for (const id of copyIds) {
      const def = compositeNodeDefinitionStore.getDefinition(id)
      expect(def).toBeDefined()
      expect(def!.isPrebuilt).toBe(false)
    }

    // Original should be unchanged
    const original = compositeNodeDefinitionStore.getDefinition('DelayEffect')
    expect(original!.isPrebuilt).toBe(true)
    expect(original!.name).toBe('Delay Effect')
  })

  it('should delete user composite but not prebuilt', async () => {
    // Create a user composite
    const { inputs, outputs, internalGraph } = createTestDefinition()
    const userId = await compositeNodeDefinitionStore.saveCompositeNode(
      'Deletable Effect',
      'Will be deleted',
      inputs,
      outputs,
      internalGraph
    )

    expect(compositeNodeDefinitionStore.getDefinition(userId as string)).toBeDefined()

    // Delete user composite
    await compositeNodeDefinitionStore.deleteCompositeNode(userId as string)

    // Should be gone
    expect(compositeNodeDefinitionStore.getDefinition(userId as string)).toBeUndefined()

    // Prebuilt should not be deletable
    const prebuiltCount = compositeNodeDefinitionStore.prebuiltDefinitions.length
    await expect(compositeNodeDefinitionStore.deleteCompositeNode('DelayEffect')).rejects.toThrow()

    // Prebuilt count unchanged
    expect(compositeNodeDefinitionStore.prebuiltDefinitions.length).toBe(prebuiltCount)
  })
})

describe('Store Integration - CompositeGraphContext Workflow', () => {
  let context: CompositeGraphContext
  let setNodes: ReturnType<typeof vi.fn>
  let setEdges: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    compositeNodeDefinitionStore.clear()
    const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
    await compositeNodeDefinitionStore.initialize(prebuiltDefs)

    context = new CompositeGraphContext()
    setNodes = vi.fn()
    setEdges = vi.fn()
  })

  it('should manage graph state independently from definition store', () => {
    // Initialize context with empty state
    context.initialize([], [], setNodes, setEdges, false)

    // Add nodes via context
    const node1Id = context.addNode('GainNode', { x: 100, y: 100 })
    const node2Id = context.addNode('DelayNode', { x: 200, y: 100 })

    expect(context.nodes).toHaveLength(2)
    expect(setNodes).toHaveBeenCalled()

    // Add edge
    context.addEdge(node1Id, node2Id, 'output', 'input')
    expect(context.edges).toHaveLength(1)
    expect(setEdges).toHaveBeenCalled()

    // Context state is independent - definition store not affected
    const userDefs = compositeNodeDefinitionStore.userDefinitions
    expect(userDefs.length).toBe(0) // No definitions created yet
  })

  it('should support undo/redo for graph editing', () => {
    context.initialize([], [], setNodes, setEdges, false)

    // Add node
    context.addNode('GainNode', { x: 100, y: 100 })
    expect(context.nodes).toHaveLength(1)
    expect(context.undoManager.canUndo).toBe(true)

    // Undo
    context.undo()
    expect(context.nodes).toHaveLength(0)
    expect(context.undoManager.canRedo).toBe(true)

    // Redo
    context.redo()
    expect(context.nodes).toHaveLength(1)
  })

  it('should convert graph state to definition format', async () => {
    context.initialize([], [], setNodes, setEdges, false)

    // Build a graph
    const node1Id = context.addNode('GainNode', { x: 100, y: 100 })
    const node2Id = context.addNode('DelayNode', { x: 300, y: 100 })
    context.addEdge(node1Id, node2Id, 'output', 'input')

    // Convert context state to definition format
    const internalGraph: CompositeNodeInternalGraph = {
      nodes: context.nodes
        .filter(n => n.type === 'internalNode')
        .map(n => ({
          id: n.id,
          nodeType: (n.data as { nodeType: string }).nodeType,
          position: { x: n.position.x, y: n.position.y },
          properties: [],
        })),
      edges: context.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || 'output',
        targetHandle: e.targetHandle || 'input',
      })),
      connections: context.edges.map(e => ({
        sourceNodeId: e.source,
        targetNodeId: e.target,
        sourceOutput: e.sourceHandle || 'output',
        targetInput: e.targetHandle || 'input',
      })),
    }

    // Save to definition store
    const newId = await compositeNodeDefinitionStore.saveCompositeNode(
      'Graph to Definition',
      'Created from graph context',
      [{ id: 'in', name: 'Input', type: 'audio' }],
      [{ id: 'out', name: 'Output', type: 'audio' }],
      internalGraph
    )

    const saved = compositeNodeDefinitionStore.getDefinition(newId as string)
    expect(saved).toBeDefined()
    expect(saved!.internalGraph.nodes.length).toBe(2)
    expect(saved!.internalGraph.edges.length).toBe(1)
  })
})

describe('Store Integration - GraphOperationsStore Workflow', () => {
  let context: CompositeGraphContext
  let setNodes: ReturnType<typeof vi.fn>
  let setEdges: ReturnType<typeof vi.fn>

  beforeEach(() => {
    context = new CompositeGraphContext()
    setNodes = vi.fn()
    setEdges = vi.fn()
    context.initialize([], [], setNodes, setEdges, false)
    graphOperationsStore.clearActiveContext()
  })

  afterEach(() => {
    graphOperationsStore.clearActiveContext()
  })

  it('should execute operations through GraphOperationsStore', () => {
    // Set active context
    graphOperationsStore.setActiveContext(context, 'composite')

    expect(graphOperationsStore.activeContextType).toBe('composite')
    expect(graphOperationsStore.isReadOnly).toBe(false)

    // Add node through GraphOperationsStore
    const nodeId = graphOperationsStore.addNode('GainNode', { x: 100, y: 100 })
    expect(nodeId).toBeDefined()
    expect(context.nodes).toHaveLength(1)
  })

  it('should track selection state through GraphOperationsStore', () => {
    // Add some nodes
    context.addNode('GainNode', { x: 100, y: 100 })
    context.setSelection(['some-id'], [])

    graphOperationsStore.setActiveContext(context, 'composite')

    expect(graphOperationsStore.selectedNodeIds).toContain('some-id')
  })

  it('should respect read-only mode', () => {
    context.initialize([], [], setNodes, setEdges, true) // read-only
    graphOperationsStore.setActiveContext(context, 'composite')

    expect(graphOperationsStore.isReadOnly).toBe(true)

    // Operations should not work in read-only mode
    const nodeId = graphOperationsStore.addNode('GainNode', { x: 100, y: 100 })
    expect(nodeId).toBeNull()
    expect(context.nodes).toHaveLength(0)
  })

  it('should delegate undo/redo to context', () => {
    graphOperationsStore.setActiveContext(context, 'composite')

    // Add a node
    graphOperationsStore.addNode('GainNode', { x: 100, y: 100 })
    expect(context.nodes).toHaveLength(1)
    expect(graphOperationsStore.canUndo).toBe(true)

    // Undo through GraphOperationsStore
    graphOperationsStore.undo()
    expect(context.nodes).toHaveLength(0)
    expect(graphOperationsStore.canRedo).toBe(true)

    // Redo
    graphOperationsStore.redo()
    expect(context.nodes).toHaveLength(1)
  })

  it('should clear context properly', () => {
    graphOperationsStore.setActiveContext(context, 'composite')
    expect(graphOperationsStore.activeContextType).toBe('composite')

    graphOperationsStore.clearActiveContext()
    expect(graphOperationsStore.activeContextType).toBe('none')
    expect(graphOperationsStore.isReadOnly).toBe(true) // Default when no context
  })
})

describe('Store Integration - Error Handling', () => {
  beforeEach(async () => {
    compositeNodeDefinitionStore.clear()
    compositeEditorStore.closeEditor()
    const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
    await compositeNodeDefinitionStore.initialize(prebuiltDefs)
  })

  it('should handle editor error state', () => {
    compositeEditorStore.openEditor('DelayEffect')

    compositeEditorStore.setError('Test error message')
    expect(compositeEditorStore.error).toBe('Test error message')

    compositeEditorStore.clearError()
    expect(compositeEditorStore.error).toBeNull()
  })

  it('should handle non-existent definition gracefully', () => {
    const nonExistent = compositeNodeDefinitionStore.getDefinition('non-existent-id')
    expect(nonExistent).toBeUndefined()
  })

  it('should allow saving and retrieve definitions by ID', async () => {
    const { inputs, outputs, internalGraph } = createTestDefinition()

    const id = await compositeNodeDefinitionStore.saveCompositeNode(
      'Test Effect',
      'Description',
      inputs,
      outputs,
      internalGraph
    )

    expect(id).toBeDefined()

    // Should be retrievable
    const retrieved = compositeNodeDefinitionStore.getDefinition(id as string)
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('Test Effect')
  })
})

describe('Store Integration - Concurrent Operations', () => {
  beforeEach(async () => {
    compositeNodeDefinitionStore.clear()
    const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
    await compositeNodeDefinitionStore.initialize(prebuiltDefs)
  })

  it('should handle rapid sequential saves', async () => {
    const { inputs, outputs, internalGraph } = createTestDefinition()
    const saveCount = 10
    const ids: string[] = []

    for (let i = 0; i < saveCount; i++) {
      const id = await compositeNodeDefinitionStore.saveCompositeNode(
        `Effect ${i}`,
        `Description ${i}`,
        inputs,
        outputs,
        internalGraph
      )
      ids.push(id as string)
    }

    // All should be unique
    expect(new Set(ids).size).toBe(saveCount)

    // All should exist
    for (const id of ids) {
      expect(compositeNodeDefinitionStore.getDefinition(id)).toBeDefined()
    }

    expect(compositeNodeDefinitionStore.userDefinitions.length).toBe(saveCount)
  })

  it('should maintain consistency with multiple editor sessions', () => {
    // Simulate opening different presets in sequence
    const presets = ['DelayEffect', 'ReverbChapel', 'EnvelopeADSR']

    for (const presetId of presets) {
      compositeEditorStore.openEditor(presetId, `node-${presetId}`)

      expect(compositeEditorStore.editingDefinitionId).toBe(presetId)
      expect(compositeEditorStore.isOpen).toBe(true)

      const def = compositeNodeDefinitionStore.getDefinition(presetId)
      expect(def).toBeDefined()

      compositeEditorStore.closeEditor()
      expect(compositeEditorStore.isOpen).toBe(false)
    }
  })
})
