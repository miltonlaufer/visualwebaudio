/* eslint-disable no-console */
/**
 * Composite Nodes Integration Tests
 *
 * Tests that actually USE the stores to verify composite nodes work end-to-end.
 * Console statements are intentionally used for debugging composite node instantiation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { compositeNodeDefinitionStore } from '~/stores/CompositeNodeDefinitionStore'
import { NodeAdapter } from '~/stores/NodeAdapter'
import prebuiltCompositeNodes from '~/types/composite-nodes-prebuilt.json'
import type { CompositeNodeDefinition } from '~/types'

// Mock IndexedDB for tests
vi.mock('~/utils/database', () => ({
  compositeNodeOperations: {
    getAllCompositeNodes: vi.fn().mockResolvedValue([]),
    saveCompositeNode: vi.fn().mockResolvedValue(1),
    updateCompositeNode: vi.fn().mockResolvedValue(undefined),
    deleteCompositeNode: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('Composite Nodes Integration', () => {
  beforeEach(() => {
    // Reset the store before each test
    compositeNodeDefinitionStore.clear()
  })

  describe('Store initialization with prebuilt definitions', () => {
    it('should load prebuilt definitions successfully', async () => {
      const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]

      console.log('Prebuilt definitions count:', prebuiltDefs.length)
      console.log(
        'Definition IDs:',
        prebuiltDefs.map(d => d.id)
      )

      await compositeNodeDefinitionStore.initialize(prebuiltDefs)

      expect(compositeNodeDefinitionStore.isLoaded).toBe(true)
      expect(compositeNodeDefinitionStore.definitionCount).toBe(prebuiltDefs.length)
    })

    it('should have valid category values for all prebuilt nodes', () => {
      const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]

      prebuiltDefs.forEach(def => {
        console.log(
          `Definition ${def.id}: category = "${def.category}", type = ${typeof def.category}`
        )
        expect(['composite', 'user-composite']).toContain(def.category)
      })
    })

    it('should retrieve DelayEffect definition correctly', async () => {
      const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
      await compositeNodeDefinitionStore.initialize(prebuiltDefs)

      const delay = compositeNodeDefinitionStore.getDefinition('DelayEffect')

      console.log('DelayEffect definition:', JSON.stringify(delay, null, 2))

      expect(delay).toBeDefined()
      expect(delay?.name).toBe('Delay Effect')
      expect(delay?.category).toBe('composite')
      expect(delay?.inputs.length).toBeGreaterThan(0)
      expect(delay?.outputs.length).toBeGreaterThan(0)
    })

    it('should retrieve EnvelopeADSR definition correctly', async () => {
      const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
      await compositeNodeDefinitionStore.initialize(prebuiltDefs)

      const envelope = compositeNodeDefinitionStore.getDefinition('EnvelopeADSR')

      console.log('EnvelopeADSR definition:', JSON.stringify(envelope, null, 2))

      expect(envelope).toBeDefined()
      expect(envelope?.name).toBe('ADSR Envelope')
      expect(envelope?.category).toBe('composite')
    })
  })

  describe('Metadata generation for AudioGraphStore', () => {
    it('should generate valid metadata structure for composite nodes', async () => {
      const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
      await compositeNodeDefinitionStore.initialize(prebuiltDefs)

      const definition = compositeNodeDefinitionStore.getDefinition('DelayEffect')
      expect(definition).toBeDefined()

      // Simulate what AudioGraphStore.getCompositeNodeMetadata does
      const metadata = {
        name: definition!.name,
        description: definition!.description,
        category: definition!.category,
        inputs: definition!.inputs.map(input => ({
          name: input.name,
          type: input.type,
        })),
        outputs: definition!.outputs.map(output => ({
          name: output.name,
          type: output.type,
        })),
        properties: [
          {
            name: 'definitionId',
            type: 'string',
            defaultValue: 'DelayEffect',
            description: 'ID of the composite node definition',
          },
        ],
        methods: [],
        events: [],
      }

      console.log('Generated metadata:', JSON.stringify(metadata, null, 2))

      // Validate the structure matches what NodeMetadataModel expects
      expect(metadata.name).toBe('Delay Effect')
      expect(metadata.description).toBeTruthy()
      expect(metadata.category).toBe('composite')
      expect(Array.isArray(metadata.inputs)).toBe(true)
      expect(Array.isArray(metadata.outputs)).toBe(true)
      expect(Array.isArray(metadata.properties)).toBe(true)
      expect(Array.isArray(metadata.methods)).toBe(true)
      expect(Array.isArray(metadata.events)).toBe(true)

      // Check inputs have correct structure
      metadata.inputs.forEach(input => {
        expect(typeof input.name).toBe('string')
        expect(['audio', 'control']).toContain(input.type)
      })

      // Check outputs have correct structure
      metadata.outputs.forEach(output => {
        expect(typeof output.name).toBe('string')
        expect(['audio', 'control']).toContain(output.type)
      })
    })
  })

  describe('Debug: Print actual values from store', () => {
    it('should print definition category type', async () => {
      const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
      await compositeNodeDefinitionStore.initialize(prebuiltDefs)

      const definition = compositeNodeDefinitionStore.getDefinition('DelayEffect')

      console.log('=== DEBUG INFO ===')
      console.log('definition:', definition)
      console.log('definition.category:', definition?.category)
      console.log('typeof definition.category:', typeof definition?.category)
      console.log('category === "composite":', definition?.category === 'composite')
      console.log('JSON.stringify(category):', JSON.stringify(definition?.category))

      // Check the actual MST model type
      if (definition) {
        console.log('Definition keys:', Object.keys(definition))
        console.log('Inputs:', definition.inputs)
        console.log('Outputs:', definition.outputs)
      }
    })
  })

  describe('NodeAdapter creation with composite nodes', () => {
    it('should create NodeAdapter for DelayEffect composite node', async () => {
      const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
      await compositeNodeDefinitionStore.initialize(prebuiltDefs)

      const definition = compositeNodeDefinitionStore.getDefinition('DelayEffect')
      expect(definition).toBeDefined()

      const nodeType = 'Composite_DelayEffect'
      const nodeId = `${nodeType}-test-123`

      // Build metadata like AudioGraphStore does
      const metadata = {
        name: definition!.name,
        description: definition!.description,
        category: definition!.category,
        inputs: definition!.inputs.map(input => ({
          name: input.name,
          type: input.type,
        })),
        outputs: definition!.outputs.map(output => ({
          name: output.name,
          type: output.type,
        })),
        properties: [
          {
            name: 'definitionId',
            type: 'string',
            defaultValue: 'DelayEffect',
          },
        ],
        methods: [],
        events: [],
      }

      console.log('=== ATTEMPTING TO CREATE NODE ADAPTER ===')
      console.log('nodeId:', nodeId)
      console.log('nodeType:', nodeType)
      console.log('metadata:', JSON.stringify(metadata, null, 2))

      // This is the actual call that fails in the browser
      let adaptedNode
      try {
        adaptedNode = NodeAdapter.create({
          id: nodeId,
          nodeType,
          position: { x: 100, y: 100 },
          metadata,
          properties: { definitionId: 'DelayEffect' },
          inputConnections: [],
          outputConnections: [],
        })
        console.log('SUCCESS: NodeAdapter created:', adaptedNode.id)
      } catch (error) {
        console.error('FAILED to create NodeAdapter:', error)
        throw error
      }

      expect(adaptedNode).toBeDefined()
      expect(adaptedNode.id).toBe(nodeId)
      expect(adaptedNode.nodeType).toBe(nodeType)
    })

    it('should create NodeAdapter for EnvelopeADSR composite node', async () => {
      const prebuiltDefs = Object.values(prebuiltCompositeNodes) as CompositeNodeDefinition[]
      await compositeNodeDefinitionStore.initialize(prebuiltDefs)

      const definition = compositeNodeDefinitionStore.getDefinition('EnvelopeADSR')
      expect(definition).toBeDefined()

      const nodeType = 'Composite_EnvelopeADSR'
      const nodeId = `${nodeType}-test-456`

      const metadata = {
        name: definition!.name,
        description: definition!.description,
        category: definition!.category,
        inputs: definition!.inputs.map(input => ({
          name: input.name,
          type: input.type,
        })),
        outputs: definition!.outputs.map(output => ({
          name: output.name,
          type: output.type,
        })),
        properties: [
          {
            name: 'definitionId',
            type: 'string',
            defaultValue: 'EnvelopeADSR',
          },
        ],
        methods: [],
        events: [],
      }

      console.log('=== ATTEMPTING TO CREATE ENVELOPE NODE ADAPTER ===')
      console.log('metadata.category:', metadata.category)

      let adaptedNode
      try {
        adaptedNode = NodeAdapter.create({
          id: nodeId,
          nodeType,
          position: { x: 100, y: 100 },
          metadata,
          properties: { definitionId: 'EnvelopeADSR' },
          inputConnections: [],
          outputConnections: [],
        })
        console.log('SUCCESS: NodeAdapter created:', adaptedNode.id)
      } catch (error) {
        console.error('FAILED to create NodeAdapter:', error)
        throw error
      }

      expect(adaptedNode).toBeDefined()
    })
  })
})
