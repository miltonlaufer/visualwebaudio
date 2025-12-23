/**
 * Composite Nodes Feature Tests
 *
 * Tests for:
 * - CompositeNodeDefinitionStore
 * - CompositeNodeStrategy
 * - NodeRegistry composite node support
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CompositeNodeDefinitionStore } from '~/stores/CompositeNodeDefinitionStore'
import { NodeRegistry } from '~/domain/nodes/NodeRegistry'
import type { CompositeNodeDefinition, CompositeNodeInternalGraph } from '~/types'

/******************* FIXTURES ***********************/

const createMockInternalGraph = (): CompositeNodeInternalGraph => ({
  nodes: [
    {
      id: 'ext_input',
      nodeType: 'ExternalInputNode',
      position: { x: 50, y: 150 },
      properties: [{ name: 'portId', value: 'input' }],
    },
    {
      id: 'gain',
      nodeType: 'GainNode',
      position: { x: 300, y: 150 },
      properties: [{ name: 'gain', value: 0.5 }],
    },
    {
      id: 'ext_output',
      nodeType: 'ExternalOutputNode',
      position: { x: 550, y: 150 },
      properties: [{ name: 'portId', value: 'output' }],
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'ext_input',
      target: 'gain',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
    {
      id: 'e2',
      source: 'gain',
      target: 'ext_output',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
  ],
  connections: [
    {
      sourceNodeId: 'ext_input',
      targetNodeId: 'gain',
      sourceOutput: 'output',
      targetInput: 'input',
    },
    {
      sourceNodeId: 'gain',
      targetNodeId: 'ext_output',
      sourceOutput: 'output',
      targetInput: 'input',
    },
  ],
})

const createMockDefinition = (
  overrides: Partial<CompositeNodeDefinition> = {}
): CompositeNodeDefinition => ({
  id: 'test-composite',
  name: 'Test Composite',
  description: 'A test composite node',
  category: 'composite',
  isPrebuilt: true,
  inputs: [
    { id: 'input', name: 'input', type: 'audio' },
    { id: 'gain', name: 'gain', type: 'control' },
  ],
  outputs: [{ id: 'output', name: 'output', type: 'audio' }],
  internalGraph: createMockInternalGraph(),
  ...overrides,
})

/******************* COMPOSITE NODE DEFINITION STORE TESTS ***********************/

describe('CompositeNodeDefinitionStore', () => {
  let store: ReturnType<typeof CompositeNodeDefinitionStore.create>

  beforeEach(() => {
    store = CompositeNodeDefinitionStore.create({
      definitions: {},
      isLoaded: false,
      isLoading: false,
    })
  })

  describe('loadPrebuiltDefinitions', () => {
    it('should load prebuilt definitions', () => {
      const prebuiltDefs = [
        createMockDefinition({ id: 'delay', name: 'Delay Effect' }),
        createMockDefinition({ id: 'reverb', name: 'Reverb Effect' }),
      ]

      store.loadPrebuiltDefinitions(prebuiltDefs)

      expect(store.definitionCount).toBe(2)
      expect(store.getDefinition('delay')).toBeDefined()
      expect(store.getDefinition('reverb')).toBeDefined()
    })

    it('should mark definitions as prebuilt', () => {
      const prebuiltDefs = [createMockDefinition({ id: 'delay', isPrebuilt: false })]

      store.loadPrebuiltDefinitions(prebuiltDefs)

      const def = store.getDefinition('delay')
      expect(def?.isPrebuilt).toBe(true)
      expect(def?.category).toBe('composite')
    })
  })

  describe('views', () => {
    beforeEach(() => {
      store.loadPrebuiltDefinitions([
        createMockDefinition({ id: 'prebuilt1', isPrebuilt: true }),
        createMockDefinition({ id: 'prebuilt2', isPrebuilt: true }),
      ])
    })

    it('should return all definitions', () => {
      expect(store.allDefinitions.length).toBe(2)
    })

    it('should return prebuilt definitions', () => {
      const prebuilt = store.prebuiltDefinitions
      expect(prebuilt.length).toBe(2)
      expect(prebuilt.every(d => d.isPrebuilt)).toBe(true)
    })

    it('should return user definitions (empty initially)', () => {
      const user = store.userDefinitions
      expect(user.length).toBe(0)
    })

    it('should get definition by name', () => {
      const def = store.getDefinitionByName('Test Composite')
      expect(def).toBeDefined()
      expect(def?.name).toBe('Test Composite')
    })

    it('should check if definition exists', () => {
      expect(store.hasDefinition('prebuilt1')).toBe(true)
      expect(store.hasDefinition('nonexistent')).toBe(false)
    })

    it('should return composite node types', () => {
      const types = store.compositeNodeTypes
      expect(types).toContain('Composite_prebuilt1')
      expect(types).toContain('Composite_prebuilt2')
    })
  })

  describe('clear', () => {
    it('should clear all definitions', () => {
      store.loadPrebuiltDefinitions([createMockDefinition()])
      expect(store.definitionCount).toBe(1)

      store.clear()

      expect(store.definitionCount).toBe(0)
      expect(store.isLoaded).toBe(false)
    })
  })
})

/******************* NODE REGISTRY COMPOSITE SUPPORT TESTS ***********************/

describe('NodeRegistry composite node support', () => {
  beforeEach(() => {
    NodeRegistry.clearCompositeNodes()
  })

  describe('registerCompositeNode', () => {
    it('should register a composite node', () => {
      const def = createMockDefinition({ id: 'test-reg' })

      NodeRegistry.registerCompositeNode(def)

      expect(NodeRegistry.getCompositeNodeTypes()).toContain('Composite_test-reg')
    })

    it('should return metadata for registered composite nodes', () => {
      const def = createMockDefinition({
        id: 'test-meta',
        name: 'Test Meta',
        description: 'Test description',
      })

      NodeRegistry.registerCompositeNode(def)

      const metadata = NodeRegistry.getMetadata('Composite_test-meta')
      expect(metadata).toBeDefined()
      expect(metadata?.name).toBe('Test Meta')
      expect(metadata?.description).toBe('Test description')
      expect(metadata?.inputs.length).toBe(2)
      expect(metadata?.outputs.length).toBe(1)
    })
  })

  describe('isCompositeNode', () => {
    it('should identify composite nodes by type prefix', () => {
      expect(NodeRegistry.isCompositeNode('Composite_DelayEffect')).toBe(true)
      expect(NodeRegistry.isCompositeNode('Composite_MyCustom')).toBe(true)
      expect(NodeRegistry.isCompositeNode('GainNode')).toBe(false)
      expect(NodeRegistry.isCompositeNode('SliderNode')).toBe(false)
    })
  })

  describe('getCompositeNodeDefinition', () => {
    it('should return the original definition', () => {
      const def = createMockDefinition({ id: 'test-get-def' })
      NodeRegistry.registerCompositeNode(def)

      const retrieved = NodeRegistry.getCompositeNodeDefinition('test-get-def')
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('test-get-def')
      expect(retrieved?.inputs.length).toBe(def.inputs.length)
    })

    it('should return undefined for non-existent definition', () => {
      const retrieved = NodeRegistry.getCompositeNodeDefinition('nonexistent')
      expect(retrieved).toBeUndefined()
    })
  })

  describe('registerCompositeNodes (batch)', () => {
    it('should register multiple composite nodes', () => {
      const defs = [
        createMockDefinition({ id: 'batch1' }),
        createMockDefinition({ id: 'batch2' }),
        createMockDefinition({ id: 'batch3' }),
      ]

      NodeRegistry.registerCompositeNodes(defs)

      const types = NodeRegistry.getCompositeNodeTypes()
      expect(types).toContain('Composite_batch1')
      expect(types).toContain('Composite_batch2')
      expect(types).toContain('Composite_batch3')
    })
  })

  describe('unregisterCompositeNode', () => {
    it('should unregister a composite node', () => {
      const def = createMockDefinition({ id: 'test-unreg' })
      NodeRegistry.registerCompositeNode(def)
      expect(NodeRegistry.getCompositeNodeTypes()).toContain('Composite_test-unreg')

      NodeRegistry.unregisterCompositeNode('test-unreg')

      expect(NodeRegistry.getCompositeNodeTypes()).not.toContain('Composite_test-unreg')
    })
  })

  describe('getNodeInfo for composite nodes', () => {
    it('should return correct node info for composite nodes', () => {
      const def = createMockDefinition({ id: 'test-info', category: 'composite' })
      NodeRegistry.registerCompositeNode(def)

      const info = NodeRegistry.getNodeInfo('Composite_test-info')
      expect(info).toBeDefined()
      expect(info?.isComposite).toBe(true)
      expect(info?.isCustom).toBe(false)
      expect(info?.isWebAudio).toBe(false)
      expect(info?.category).toBe('composite')
    })
  })
})

/******************* PREBUILT DEFINITIONS STRUCTURE TESTS ***********************/

describe('Prebuilt composite node definitions', () => {
  // Import the actual prebuilt definitions
  const prebuiltCompositeNodes = vi.importActual('~/types/composite-nodes-prebuilt.json')

  it('should have all required prebuilt nodes', async () => {
    const defs = (await prebuiltCompositeNodes) as Record<string, CompositeNodeDefinition>

    expect(defs.DelayEffect).toBeDefined()
    // Multiple reverb presets with real impulse responses
    expect(defs.ReverbChapel).toBeDefined()
    expect(defs.ReverbMausoleum).toBeDefined()
    expect(defs.ReverbStairwell).toBeDefined()
    expect(defs.ReverbBasement).toBeDefined()
    expect(defs.EnvelopeADSR).toBeDefined()
    expect(defs.ChorusEffect).toBeDefined()
  })

  it('DelayEffect should have correct structure', async () => {
    const defs = (await prebuiltCompositeNodes) as Record<string, CompositeNodeDefinition>
    const delay = defs.DelayEffect

    expect(delay.id).toBe('DelayEffect')
    expect(delay.name).toBe('Delay Effect')
    expect(delay.isPrebuilt).toBe(true)
    expect(delay.category).toBe('composite')

    // Check inputs
    expect(delay.inputs.find(i => i.id === 'input')?.type).toBe('audio')
    expect(delay.inputs.find(i => i.id === 'delayTime')?.type).toBe('control')
    expect(delay.inputs.find(i => i.id === 'feedback')?.type).toBe('control')
    expect(delay.inputs.find(i => i.id === 'wetDry')?.type).toBe('control')

    // Check outputs
    expect(delay.outputs.find(o => o.id === 'output')?.type).toBe('audio')

    // Check internal graph has nodes
    expect(delay.internalGraph.nodes.length).toBeGreaterThan(0)
    expect(delay.internalGraph.edges.length).toBeGreaterThan(0)
  })

  it('EnvelopeADSR should have trigger input', async () => {
    const defs = (await prebuiltCompositeNodes) as Record<string, CompositeNodeDefinition>
    const envelope = defs.EnvelopeADSR

    const triggerInput = envelope.inputs.find(i => i.id === 'trigger')
    expect(triggerInput).toBeDefined()
    expect(triggerInput?.type).toBe('control')

    // Should have ADSR controls
    expect(envelope.inputs.find(i => i.id === 'attack')).toBeDefined()
    expect(envelope.inputs.find(i => i.id === 'decay')).toBeDefined()
    expect(envelope.inputs.find(i => i.id === 'sustain')).toBeDefined()
    expect(envelope.inputs.find(i => i.id === 'release')).toBeDefined()
  })

  it('ChorusEffect should have LFO-related inputs', async () => {
    const defs = (await prebuiltCompositeNodes) as Record<string, CompositeNodeDefinition>
    const chorus = defs.ChorusEffect

    expect(chorus.inputs.find(i => i.id === 'rate')).toBeDefined()
    expect(chorus.inputs.find(i => i.id === 'depth')).toBeDefined()
    expect(chorus.inputs.find(i => i.id === 'wetDry')).toBeDefined()
  })

  it('Reverb presets should have wet/dry control', async () => {
    const defs = (await prebuiltCompositeNodes) as Record<string, CompositeNodeDefinition>

    // Test all reverb presets have the same interface
    const reverbPresets = [
      defs.ReverbChapel,
      defs.ReverbMausoleum,
      defs.ReverbStairwell,
      defs.ReverbBasement,
    ]

    for (const reverb of reverbPresets) {
      expect(reverb.inputs.find(i => i.id === 'wetDry')).toBeDefined()
      expect(reverb.outputs.find(o => o.id === 'output')?.type).toBe('audio')
      expect(reverb.inputs.find(i => i.id === 'input')?.type).toBe('audio')
      expect(reverb.isPrebuilt).toBe(true)
    }
  })
})
