/**
 * Composite Editor Tests
 *
 * Tests for composite node definition store, save/save-as functionality,
 * and editor behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { compositeNodeDefinitionStore } from '~/stores/CompositeNodeDefinitionStore'
import { compositeEditorStore } from '~/stores/CompositeEditorStore'
import prebuiltCompositeNodes from '~/types/composite-nodes-prebuilt.json'
import type {
  CompositeNodePort,
  CompositeNodeInternalGraph,
  CompositeNodeDefinition,
} from '~/types'

// Mock IndexedDB operations
vi.mock('~/utils/database', () => ({
  compositeNodeOperations: {
    saveCompositeNode: vi.fn().mockResolvedValue(1),
    updateCompositeNode: vi.fn().mockResolvedValue(undefined),
    deleteCompositeNode: vi.fn().mockResolvedValue(undefined),
    getAllCompositeNodes: vi.fn().mockResolvedValue([]),
  },
}))

// Helper to get prebuilt definitions
const getPrebuiltDefs = () => Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]

describe('CompositeNodeDefinitionStore', () => {
  beforeEach(async () => {
    // Clear and initialize the store fresh before each test
    compositeNodeDefinitionStore.clear()
    await compositeNodeDefinitionStore.initialize(getPrebuiltDefs())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should load prebuilt definitions on initialize', () => {
      expect(compositeNodeDefinitionStore.isLoaded).toBe(true)
      expect(compositeNodeDefinitionStore.prebuiltDefinitions.length).toBeGreaterThan(0)
    })

    it('should have DelayEffect prebuilt definition', () => {
      const delay = compositeNodeDefinitionStore.getDefinition('DelayEffect')
      expect(delay).toBeDefined()
      expect(delay?.name).toBe('Delay Effect')
      expect(delay?.isPrebuilt).toBe(true)
      expect(delay?.category).toBe('composite')
    })

    it('should have reverb prebuilt definitions (multiple spaces)', () => {
      // Now we have multiple reverb presets with real impulse responses
      const chapel = compositeNodeDefinitionStore.getDefinition('ReverbChapel')
      expect(chapel).toBeDefined()
      expect(chapel?.name).toBe('Chapel Reverb')
      expect(chapel?.isPrebuilt).toBe(true)

      const mausoleum = compositeNodeDefinitionStore.getDefinition('ReverbMausoleum')
      expect(mausoleum).toBeDefined()
      expect(mausoleum?.isPrebuilt).toBe(true)

      const stairwell = compositeNodeDefinitionStore.getDefinition('ReverbStairwell')
      expect(stairwell).toBeDefined()
      expect(stairwell?.isPrebuilt).toBe(true)

      const basement = compositeNodeDefinitionStore.getDefinition('ReverbBasement')
      expect(basement).toBeDefined()
      expect(basement?.isPrebuilt).toBe(true)
    })

    it('should have EnvelopeADSR prebuilt definition', () => {
      const envelope = compositeNodeDefinitionStore.getDefinition('EnvelopeADSR')
      expect(envelope).toBeDefined()
      expect(envelope?.name).toBe('ADSR Envelope')
      expect(envelope?.isPrebuilt).toBe(true)
    })

    it('should have ChorusEffect prebuilt definition', () => {
      const chorus = compositeNodeDefinitionStore.getDefinition('ChorusEffect')
      expect(chorus).toBeDefined()
      expect(chorus?.name).toBe('Chorus Effect')
      expect(chorus?.isPrebuilt).toBe(true)
    })
  })

  describe('prebuilt definition structure', () => {
    it('DelayEffect should have correct inputs and outputs', () => {
      const delay = compositeNodeDefinitionStore.getDefinition('DelayEffect')
      expect(delay).toBeDefined()

      // Check inputs
      expect(delay!.inputs.length).toBeGreaterThan(0)
      const audioInput = delay!.inputs.find(i => i.type === 'audio')
      expect(audioInput).toBeDefined()

      // Check outputs
      expect(delay!.outputs.length).toBeGreaterThan(0)
      const audioOutput = delay!.outputs.find(o => o.type === 'audio')
      expect(audioOutput).toBeDefined()

      // Check internal graph
      expect(delay!.internalGraph).toBeDefined()
      expect(delay!.internalGraph.nodes.length).toBeGreaterThan(0)
    })

    it('EnvelopeADSR should have ADSR control inputs', () => {
      const envelope = compositeNodeDefinitionStore.getDefinition('EnvelopeADSR')
      expect(envelope).toBeDefined()

      // Check for ADSR control inputs
      const inputNames = envelope!.inputs.map(i => i.name.toLowerCase())
      expect(inputNames).toContain('attack')
      expect(inputNames).toContain('decay')
      expect(inputNames).toContain('sustain')
      expect(inputNames).toContain('release')
    })
  })

  describe('saveCompositeNode', () => {
    it('should save a new composite node', async () => {
      const inputs: CompositeNodePort[] = [
        { id: 'input1', name: 'Input', type: 'audio', description: 'Audio input' },
      ]
      const outputs: CompositeNodePort[] = [
        { id: 'output1', name: 'Output', type: 'audio', description: 'Audio output' },
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
        'Test Composite',
        'A test composite node',
        inputs,
        outputs,
        internalGraph
      )

      expect(newId).toBeDefined()
      expect(typeof newId).toBe('string')

      // Verify it was added to the store
      const saved = compositeNodeDefinitionStore.getDefinition(newId as string)
      expect(saved).toBeDefined()
      expect(saved?.name).toBe('Test Composite')
      expect(saved?.description).toBe('A test composite node')
      expect(saved?.isPrebuilt).toBe(false)
      expect(saved?.category).toBe('user-composite')
    })

    it('should save composite node with complex internal graph', async () => {
      const inputs: CompositeNodePort[] = [
        { id: 'in1', name: 'Signal In', type: 'audio' },
        { id: 'in2', name: 'Mix', type: 'control' },
      ]
      const outputs: CompositeNodePort[] = [{ id: 'out1', name: 'Signal Out', type: 'audio' }]
      const internalGraph: CompositeNodeInternalGraph = {
        nodes: [
          {
            id: 'ext_input_in1',
            nodeType: 'ExternalInputNode',
            position: { x: 50, y: 100 },
            properties: [{ name: 'portId', value: 'in1' }],
          },
          {
            id: 'gain1',
            nodeType: 'GainNode',
            position: { x: 200, y: 100 },
            properties: [{ name: 'gain', value: 0.5 }],
          },
          {
            id: 'delay1',
            nodeType: 'DelayNode',
            position: { x: 350, y: 100 },
            properties: [{ name: 'delayTime', value: 0.3 }],
          },
          {
            id: 'ext_output_out1',
            nodeType: 'ExternalOutputNode',
            position: { x: 500, y: 100 },
            properties: [{ name: 'portId', value: 'out1' }],
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'ext_input_in1',
            target: 'gain1',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
          {
            id: 'e2',
            source: 'gain1',
            target: 'delay1',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
          {
            id: 'e3',
            source: 'delay1',
            target: 'ext_output_out1',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
        ],
        connections: [],
      }

      const newId = await compositeNodeDefinitionStore.saveCompositeNode(
        'Complex Test',
        'A complex test node',
        inputs,
        outputs,
        internalGraph
      )

      const saved = compositeNodeDefinitionStore.getDefinition(newId as string)
      expect(saved).toBeDefined()
      expect(saved?.internalGraph.nodes.length).toBe(4)
      expect(saved?.internalGraph.edges.length).toBe(3)
    })
  })

  describe('saveAsCompositeNode', () => {
    it('should create a copy of an existing composite node', async () => {
      // First, get a prebuilt definition
      const originalId = 'DelayEffect'
      const original = compositeNodeDefinitionStore.getDefinition(originalId)
      expect(original).toBeDefined()

      // Save as new
      const newId = await compositeNodeDefinitionStore.saveAsCompositeNode(
        originalId,
        'My Custom Delay',
        'A customized delay effect'
      )

      expect(newId).toBeDefined()
      expect(newId).not.toBe(originalId)

      // Verify the copy
      const copy = compositeNodeDefinitionStore.getDefinition(newId as string)
      expect(copy).toBeDefined()
      expect(copy?.name).toBe('My Custom Delay')
      expect(copy?.description).toBe('A customized delay effect')
      expect(copy?.isPrebuilt).toBe(false)
      expect(copy?.category).toBe('user-composite')

      // Verify the internal graph was copied correctly
      expect(copy?.internalGraph.nodes.length).toBe(original?.internalGraph.nodes.length)
      expect(copy?.inputs.length).toBe(original?.inputs.length)
      expect(copy?.outputs.length).toBe(original?.outputs.length)
    })

    it('should not modify the original when saving as', async () => {
      const originalId = 'ReverbChapel'
      const originalBefore = compositeNodeDefinitionStore.getDefinition(originalId)
      const originalNodeCount = originalBefore?.internalGraph.nodes.length

      await compositeNodeDefinitionStore.saveAsCompositeNode(
        originalId,
        'My Reverb Copy',
        'Custom reverb'
      )

      const originalAfter = compositeNodeDefinitionStore.getDefinition(originalId)
      expect(originalAfter?.name).toBe('Chapel Reverb')
      expect(originalAfter?.isPrebuilt).toBe(true)
      expect(originalAfter?.internalGraph.nodes.length).toBe(originalNodeCount)
    })

    it('should throw error for non-existent original', async () => {
      await expect(
        compositeNodeDefinitionStore.saveAsCompositeNode(
          'NonExistent_Node',
          'Test',
          'Test description'
        )
      ).rejects.toThrow('not found')
    })

    it('should create independent copy (no shared MST references)', async () => {
      const originalId = 'DelayEffect'

      // Create first copy
      const copyId1 = await compositeNodeDefinitionStore.saveAsCompositeNode(
        originalId,
        'Copy 1',
        'First copy'
      )

      // Create second copy
      const copyId2 = await compositeNodeDefinitionStore.saveAsCompositeNode(
        originalId,
        'Copy 2',
        'Second copy'
      )

      expect(copyId1).not.toBe(copyId2)

      const copy1 = compositeNodeDefinitionStore.getDefinition(copyId1 as string)
      const copy2 = compositeNodeDefinitionStore.getDefinition(copyId2 as string)

      expect(copy1?.name).toBe('Copy 1')
      expect(copy2?.name).toBe('Copy 2')

      // Verify they have independent internal graphs
      expect(copy1?.internalGraph).not.toBe(copy2?.internalGraph)
    })
  })

  describe('views', () => {
    it('should return all prebuilt definitions', () => {
      const prebuilt = compositeNodeDefinitionStore.prebuiltDefinitions
      // DelayEffect, 4x Reverb (Chapel, Mausoleum, Stairwell, Basement), EnvelopeADSR, ChorusEffect
      expect(prebuilt.length).toBeGreaterThanOrEqual(7)
      expect(prebuilt.every(d => d.isPrebuilt)).toBe(true)
    })

    it('should return only user definitions', async () => {
      // Add a user node
      await compositeNodeDefinitionStore.saveCompositeNode(
        'User Node',
        'Test',
        [{ id: 'in', name: 'In', type: 'audio' }],
        [{ id: 'out', name: 'Out', type: 'audio' }],
        { nodes: [], edges: [], connections: [] }
      )

      const userDefs = compositeNodeDefinitionStore.userDefinitions
      expect(userDefs.length).toBeGreaterThan(0)
      expect(userDefs.every(d => !d.isPrebuilt)).toBe(true)
    })

    it('should return all definitions', () => {
      const allDefs = compositeNodeDefinitionStore.allDefinitions
      expect(allDefs.length).toBeGreaterThanOrEqual(7)

      // Check that we have the prebuilt definitions
      const ids = allDefs.map(d => d.id)
      expect(ids).toContain('DelayEffect')
      expect(ids).toContain('ReverbChapel')
      expect(ids).toContain('ReverbMausoleum')
    })
  })
})

describe('Composite Node Metadata Generation', () => {
  beforeEach(async () => {
    compositeNodeDefinitionStore.clear()
    await compositeNodeDefinitionStore.initialize(getPrebuiltDefs())
  })

  it('control inputs should be available as editable properties', () => {
    const delay = compositeNodeDefinitionStore.getDefinition('DelayEffect')
    expect(delay).toBeDefined()

    // DelayEffect should have control inputs
    const controlInputs = delay!.inputs.filter(i => i.type === 'control')
    expect(controlInputs.length).toBeGreaterThan(0)

    // Each control input should have a name
    controlInputs.forEach(input => {
      expect(input.name).toBeDefined()
      expect(input.name.length).toBeGreaterThan(0)
    })
  })

  it('EnvelopeADSR control inputs should include ADSR parameters', () => {
    const envelope = compositeNodeDefinitionStore.getDefinition('EnvelopeADSR')
    expect(envelope).toBeDefined()

    const controlInputNames = envelope!.inputs
      .filter(i => i.type === 'control')
      .map(i => i.name.toLowerCase())

    // ADSR envelope should have attack, decay, sustain, release
    expect(controlInputNames).toContain('attack')
    expect(controlInputNames).toContain('decay')
    expect(controlInputNames).toContain('sustain')
    expect(controlInputNames).toContain('release')
  })

  it('DelayEffect control inputs should include delay parameters', () => {
    const delay = compositeNodeDefinitionStore.getDefinition('DelayEffect')
    expect(delay).toBeDefined()

    const controlInputNames = delay!.inputs
      .filter(i => i.type === 'control')
      .map(i => i.name.toLowerCase())

    // Delay effect should have delay-related controls
    expect(controlInputNames.some(n => n.includes('delay') || n.includes('time'))).toBe(true)
  })
})

describe('Composite Definition Data Integrity', () => {
  beforeEach(async () => {
    compositeNodeDefinitionStore.clear()
    await compositeNodeDefinitionStore.initialize(getPrebuiltDefs())
  })

  it('all prebuilt definitions should have valid internal graphs', () => {
    const prebuilt = compositeNodeDefinitionStore.prebuiltDefinitions

    for (const def of prebuilt) {
      expect(def.internalGraph).toBeDefined()
      expect(Array.isArray(def.internalGraph.nodes)).toBe(true)
      expect(Array.isArray(def.internalGraph.edges)).toBe(true)
      expect(Array.isArray(def.internalGraph.connections)).toBe(true)

      // Each node should have required properties
      for (const node of def.internalGraph.nodes) {
        expect(node.id).toBeDefined()
        expect(node.nodeType).toBeDefined()
        expect(node.position).toBeDefined()
        expect(typeof node.position.x).toBe('number')
        expect(typeof node.position.y).toBe('number')
      }
    }
  })

  it('all prebuilt definitions should have at least one input and one output', () => {
    const prebuilt = compositeNodeDefinitionStore.prebuiltDefinitions

    for (const def of prebuilt) {
      expect(def.inputs.length).toBeGreaterThan(0)
      expect(def.outputs.length).toBeGreaterThan(0)
    }
  })

  it('port types should be valid', () => {
    const prebuilt = compositeNodeDefinitionStore.prebuiltDefinitions
    const validTypes = ['audio', 'control']

    for (const def of prebuilt) {
      for (const input of def.inputs) {
        expect(validTypes).toContain(input.type)
      }
      for (const output of def.outputs) {
        expect(validTypes).toContain(output.type)
      }
    }
  })

  it('all input ports should have corresponding connections in the internal graph', () => {
    const prebuilt = compositeNodeDefinitionStore.prebuiltDefinitions

    for (const def of prebuilt) {
      // Skip ADSR envelope - its control inputs are handled specially via properties
      if (def.id === 'EnvelopeADSR') continue

      const edges = def.internalGraph.edges

      for (const input of def.inputs) {
        // Find the external input node ID for this port
        // The JSON uses "ext_{portId}" format for external nodes
        const extNodeId = `ext_${input.id}`

        // Check if there's at least one edge originating from this external input
        const hasConnection = edges.some(edge => edge.source === extNodeId)

        expect(hasConnection).toBe(true)
      }
    }
  })

  it('all output ports should have corresponding connections in the internal graph', () => {
    const prebuilt = compositeNodeDefinitionStore.prebuiltDefinitions

    for (const def of prebuilt) {
      // Skip ADSR envelope - its outputs are handled specially
      if (def.id === 'EnvelopeADSR') continue

      const edges = def.internalGraph.edges

      for (const output of def.outputs) {
        // Find the external output node ID for this port
        const extNodeId = `ext_${output.id}`

        // Check if there's at least one edge targeting this external output
        const hasConnection = edges.some(edge => edge.target === extNodeId)

        expect(hasConnection).toBe(true)
      }
    }
  })
})

describe('Prebuilt Composite Read-Only Protection', () => {
  beforeEach(() => {
    const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
    compositeNodeDefinitionStore.initialize(prebuiltDefs)
  })

  afterEach(() => {
    compositeEditorStore.closeEditor()
  })

  it('should not set editorReady for prebuilt composites', () => {
    // Open editor for a prebuilt
    compositeEditorStore.openEditor('DelayEffect')
    expect(compositeEditorStore.isOpen).toBe(true)

    // Simulate what CompositeEditorPanel does - editorReady is NOT set for prebuilt
    // (In real code, useEffect checks isPrebuilt and doesn't set editorReady)
    // The editorReady should remain false for prebuilt composites
    expect(compositeEditorStore.isReadOnly).toBe(true)
  })

  it('should report isReadOnly as true when editorReady is false', () => {
    compositeEditorStore.openEditor('DelayEffect')
    // Without setting editorReady (which happens for prebuilts), isReadOnly should be true
    expect(compositeEditorStore.isReadOnly).toBe(true)
    expect(compositeEditorStore.canAddNodes).toBe(false)
  })

  it('should report canAddNodes as true when editorReady is set', () => {
    compositeEditorStore.openEditor('DelayEffect')

    // Simulate what happens for non-prebuilt: editorReady is set
    compositeEditorStore.setEditorReady(true)

    expect(compositeEditorStore.isReadOnly).toBe(false)
    expect(compositeEditorStore.canAddNodes).toBe(true)
  })

  it('requestAddNode should do nothing when editorReady is false (prebuilt)', () => {
    compositeEditorStore.openEditor('DelayEffect')
    // Don't set editorReady - simulates prebuilt

    // This should not throw and should do nothing
    compositeEditorStore.requestAddNode('OscillatorNode')

    // Nothing should happen - no pending request should be created
    expect(compositeEditorStore.pendingNodeRequest).toBeNull()
  })

  it('requestAddNode should create pending request when editorReady is true (non-prebuilt)', () => {
    compositeEditorStore.openEditor('DelayEffect')
    compositeEditorStore.setEditorReady(true)

    compositeEditorStore.requestAddNode('OscillatorNode')

    // Check that a pending request was created
    expect(compositeEditorStore.pendingNodeRequest).not.toBeNull()
    expect(compositeEditorStore.pendingNodeRequest?.nodeType).toBe('OscillatorNode')
    expect(compositeEditorStore.pendingNodeRequest?.position).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    })
  })

  it('clearPendingNodeRequest should clear the pending request', () => {
    compositeEditorStore.openEditor('DelayEffect')
    compositeEditorStore.setEditorReady(true)
    compositeEditorStore.requestAddNode('OscillatorNode')

    expect(compositeEditorStore.pendingNodeRequest).not.toBeNull()

    compositeEditorStore.clearPendingNodeRequest()

    expect(compositeEditorStore.pendingNodeRequest).toBeNull()
  })

  // Legacy compatibility tests
  it('setAddNodeCallback should set editorReady (legacy compatibility)', () => {
    compositeEditorStore.openEditor('DelayEffect')

    // Using legacy method
    compositeEditorStore.setAddNodeCallback(() => {})

    expect(compositeEditorStore.isReadOnly).toBe(false)
    expect(compositeEditorStore.canAddNodes).toBe(true)
  })

  it('addNodeToEditor should work as alias for requestAddNode (legacy compatibility)', () => {
    compositeEditorStore.openEditor('DelayEffect')
    compositeEditorStore.setEditorReady(true)

    // Using legacy method
    compositeEditorStore.addNodeToEditor('OscillatorNode')

    // Should create pending request same as requestAddNode
    expect(compositeEditorStore.pendingNodeRequest).not.toBeNull()
    expect(compositeEditorStore.pendingNodeRequest?.nodeType).toBe('OscillatorNode')
  })
})

describe('CompositeEditorStore Error Handling', () => {
  beforeEach(() => {
    compositeEditorStore.closeEditor()
    compositeEditorStore.clearError()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should set and display error message', () => {
    expect(compositeEditorStore.error).toBeNull()

    compositeEditorStore.setError('Test error message')

    expect(compositeEditorStore.error).toBe('Test error message')
  })

  it('should auto-clear error after 5 seconds', () => {
    compositeEditorStore.setError('Test error message')
    expect(compositeEditorStore.error).toBe('Test error message')

    // Advance time by 4 seconds - error should still be there
    vi.advanceTimersByTime(4000)
    expect(compositeEditorStore.error).toBe('Test error message')

    // Advance time by 1 more second - error should be cleared
    vi.advanceTimersByTime(1000)
    expect(compositeEditorStore.error).toBeNull()
  })

  it('should clear error manually', () => {
    compositeEditorStore.setError('Test error message')
    expect(compositeEditorStore.error).toBe('Test error message')

    compositeEditorStore.clearError()
    expect(compositeEditorStore.error).toBeNull()
  })

  it('should replace previous error when setting a new one', () => {
    compositeEditorStore.setError('First error')
    expect(compositeEditorStore.error).toBe('First error')

    compositeEditorStore.setError('Second error')
    expect(compositeEditorStore.error).toBe('Second error')
  })

  it('should be read-only when editorReady is false', () => {
    compositeEditorStore.openEditor('DelayEffect')
    compositeEditorStore.setEditorReady(false)

    expect(compositeEditorStore.isReadOnly).toBe(true)
    expect(compositeEditorStore.canAddNodes).toBe(false)
  })

  it('should not be read-only when editorReady is true', () => {
    compositeEditorStore.openEditor('test-id')
    compositeEditorStore.setEditorReady(true)

    expect(compositeEditorStore.isReadOnly).toBe(false)
    expect(compositeEditorStore.canAddNodes).toBe(true)
  })
})
