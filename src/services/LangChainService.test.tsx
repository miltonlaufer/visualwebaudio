import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LangChainService, type AudioGraphAction } from './LangChainService'
import { RootStore, type IRootStore } from '~/stores/RootStore'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'

// Mock the ChatOpenAI
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        actions: [
          {
            type: 'addNode',
            nodeType: 'OscillatorNode',
            nodeId: 'oscillator1',
            position: { x: 100, y: 100 },
            description: 'Create oscillator',
          },
        ],
      }),
    }),
  })),
}))

describe('LangChainService', () => {
  let service: LangChainService
  let store: AudioGraphStoreType
  let rootStore: IRootStore

  beforeEach(() => {
    vi.clearAllMocks()
    service = new LangChainService()
    service.initialize({
      apiKey: 'test-key',
      model: 'gpt-4',
      temperature: 0.7,
    })
    rootStore = RootStore.create({ audioGraph: { history: {} } })
    store = rootStore.audioGraph
    store.loadMetadata()
  })

  describe('executeActions', () => {
    it('should create nodes as explicitly requested', async () => {
      // Add an oscillator node
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator1',
          position: { x: 100, y: 100 },
        },
      ]

      await service.executeActions(actions, store)

      // Should have only the explicitly requested oscillator node
      expect(store.adaptedNodes.length).toBe(1)

      const hasOscillator = store.adaptedNodes.some(
        (node: any) => node.nodeType === 'OscillatorNode'
      )

      expect(hasOscillator).toBe(true)
    })

    it('should create explicit connections when requested', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator1',
          position: { x: 100, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'AudioDestinationNode',
          nodeId: 'destination',
          position: { x: 400, y: 100 },
        },
        {
          type: 'addConnection',
          sourceId: 'oscillator1',
          targetId: 'destination',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ]

      await service.executeActions(actions, store)

      // Should have exactly the requested nodes and connections
      expect(store.adaptedNodes.length).toBe(2)
      expect(store.visualEdges.length).toBe(1)

      const oscillatorToDestination = store.visualEdges.find((edge: any) => {
        const source = store.adaptedNodes.find((n: any) => n.id === edge.source)
        const target = store.adaptedNodes.find((n: any) => n.id === edge.target)
        return source?.nodeType === 'OscillatorNode' && target?.nodeType === 'AudioDestinationNode'
      })

      expect(oscillatorToDestination).toBeDefined()
    })

    it('should create multiple nodes with smart positioning', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator1',
          position: { x: 100, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'GainNode',
          nodeId: 'gain1',
          position: { x: 300, y: 100 },
        },
      ]

      await service.executeActions(actions, store)

      // Should have exactly the requested nodes
      expect(store.adaptedNodes.length).toBe(2)

      const hasOscillator = store.adaptedNodes.some(
        (node: any) => node.nodeType === 'OscillatorNode'
      )
      const hasGain = store.adaptedNodes.some((node: any) => node.nodeType === 'GainNode')

      expect(hasOscillator).toBe(true)
      expect(hasGain).toBe(true)
    })

    it('should not create duplicate nodes when they already exist', async () => {
      // First add a destination node manually
      store.addAdaptedNode('AudioDestinationNode', { x: 500, y: 100 })

      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator1',
          position: { x: 100, y: 100 },
        },
      ]

      await service.executeActions(actions, store)

      // Should have oscillator and existing destination (no duplicate)
      expect(store.adaptedNodes.length).toBe(2)

      const destinationNodes = store.adaptedNodes.filter(
        (node: any) => node.nodeType === 'AudioDestinationNode'
      )
      expect(destinationNodes.length).toBe(1)
    })

    it('should handle explicit connections from actions', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator1',
          position: { x: 100, y: 100 },
          description: 'Create oscillator',
        },
        {
          type: 'addNode',
          nodeType: 'AudioDestinationNode',
          nodeId: 'destination',
          position: { x: 400, y: 100 },
          description: 'Create destination',
        },
        {
          type: 'addConnection',
          sourceId: 'oscillator1',
          targetId: 'destination',
          sourceHandle: 'output',
          targetHandle: 'input',
          description: 'Connect oscillator to destination',
        },
      ]

      await service.executeActions(actions, store)

      // Should have oscillator and destination
      expect(store.adaptedNodes.length).toBe(2)
      expect(store.visualEdges.length).toBe(1)

      const explicitConnection = store.visualEdges.find(
        (edge: any) => edge.sourceHandle === 'output' && edge.targetHandle === 'input'
      )
      expect(explicitConnection).toBeDefined()
    })

    it('should create complete MIDI control chain when explicitly requested', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'SliderNode',
          nodeId: 'midiSlider',
          position: { x: 0, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'MidiToFreqNode',
          nodeId: 'midiToFreq',
          position: { x: 200, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator',
          position: { x: 400, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'AudioDestinationNode',
          nodeId: 'destination',
          position: { x: 600, y: 100 },
        },
        {
          type: 'addConnection',
          sourceId: 'midiSlider',
          targetId: 'midiToFreq',
          sourceHandle: 'value',
          targetHandle: 'midiNote',
        },
        {
          type: 'addConnection',
          sourceId: 'midiToFreq',
          targetId: 'oscillator',
          sourceHandle: 'frequency',
          targetHandle: 'frequency',
        },
        {
          type: 'addConnection',
          sourceId: 'oscillator',
          targetId: 'destination',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ]

      await service.executeActions(actions, store)

      // Should have all requested nodes
      expect(store.adaptedNodes.length).toBe(4)
      expect(store.visualEdges.length).toBe(3)

      // Check MIDI control chain connections exist
      const sliderToMidi = store.visualEdges.find((edge: any) => {
        const source = store.adaptedNodes.find((n: any) => n.id === edge.source)
        const target = store.adaptedNodes.find((n: any) => n.id === edge.target)
        return source?.nodeType === 'SliderNode' && target?.nodeType === 'MidiToFreqNode'
      })

      const midiToOscillator = store.visualEdges.find((edge: any) => {
        const source = store.adaptedNodes.find((n: any) => n.id === edge.source)
        const target = store.adaptedNodes.find((n: any) => n.id === edge.target)
        return source?.nodeType === 'MidiToFreqNode' && target?.nodeType === 'OscillatorNode'
      })

      expect(sliderToMidi).toBeDefined()
      expect(midiToOscillator).toBeDefined()
      expect(midiToOscillator?.targetHandle).toBe('frequency')
    })

    it('should create audio effect chain when explicitly requested', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator',
          position: { x: 100, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'GainNode',
          nodeId: 'gain',
          position: { x: 300, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'AudioDestinationNode',
          nodeId: 'destination',
          position: { x: 500, y: 100 },
        },
        {
          type: 'addConnection',
          sourceId: 'oscillator',
          targetId: 'gain',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
        {
          type: 'addConnection',
          sourceId: 'gain',
          targetId: 'destination',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ]

      await service.executeActions(actions, store)

      // Should have all requested nodes and connections
      expect(store.adaptedNodes.length).toBe(3)
      expect(store.visualEdges.length).toBe(2)

      const oscillatorToGain = store.visualEdges.find((edge: any) => {
        const source = store.adaptedNodes.find((n: any) => n.id === edge.source)
        const target = store.adaptedNodes.find((n: any) => n.id === edge.target)
        return source?.nodeType === 'OscillatorNode' && target?.nodeType === 'GainNode'
      })

      const gainToDestination = store.visualEdges.find((edge: any) => {
        const source = store.adaptedNodes.find((n: any) => n.id === edge.source)
        const target = store.adaptedNodes.find((n: any) => n.id === edge.target)
        return source?.nodeType === 'GainNode' && target?.nodeType === 'AudioDestinationNode'
      })

      expect(oscillatorToGain).toBeDefined()
      expect(gainToDestination).toBeDefined()
    })

    it('should handle property updates', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'SliderNode',
          nodeId: 'freqSlider',
          position: { x: 0, y: 100 },
        },
        {
          type: 'updateProperty',
          nodeId: 'freqSlider',
          propertyName: 'min',
          propertyValue: 20,
        },
        {
          type: 'updateProperty',
          nodeId: 'freqSlider',
          propertyName: 'max',
          propertyValue: 20000,
        },
        {
          type: 'updateProperty',
          nodeId: 'freqSlider',
          propertyName: 'value',
          propertyValue: 440,
        },
        {
          type: 'updateProperty',
          nodeId: 'freqSlider',
          propertyName: 'label',
          propertyValue: 'Frequency (Hz)',
        },
      ]

      await service.executeActions(actions, store)

      // Should have the slider with updated properties
      expect(store.adaptedNodes.length).toBe(1)

      const slider = store.adaptedNodes.find((node: any) => node.nodeType === 'SliderNode')
      expect(slider?.properties.get('min')).toBe(20)
      expect(slider?.properties.get('max')).toBe(20000)
      expect(slider?.properties.get('value')).toBe(440)
      expect(slider?.properties.get('label')).toBe('Frequency (Hz)')
    })
  })

  describe('smart positioning', () => {
    it('should prevent nodes from overlapping when AI creates multiple nodes', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'osc1',
          position: { x: 100, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'GainNode',
          nodeId: 'gain1',
          position: { x: 100, y: 100 }, // Same position as first node
        },
        {
          type: 'addNode',
          nodeType: 'DelayNode',
          nodeId: 'delay1',
          position: { x: 100, y: 100 }, // Same position as first node
        },
      ]

      await service.executeActions(actions, store)

      // Should have 3 nodes
      expect(store.adaptedNodes.length).toBe(3)

      // Check that nodes are not overlapping (minimum distance should be 200px)
      const nodes = store.adaptedNodes
      const minDistance = 200

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const node1 = nodes[i]
          const node2 = nodes[j]
          const distance = Math.sqrt(
            Math.pow(node1.position.x - node2.position.x, 2) +
              Math.pow(node1.position.y - node2.position.y, 2)
          )

          expect(distance).toBeGreaterThanOrEqual(minDistance)
        }
      }
    })

    it('should use provided position when no overlap occurs', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'osc1',
          position: { x: 100, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'GainNode',
          nodeId: 'gain1',
          position: { x: 600, y: 100 }, // Far enough away to not overlap
        },
      ]

      await service.executeActions(actions, store)

      // Should have 2 nodes
      expect(store.adaptedNodes.length).toBe(2)

      // Find the gain node and check it's at the requested position
      const gainNode = store.adaptedNodes.find((n: any) => n.nodeType === 'GainNode')
      expect(gainNode).toBeDefined()
      expect(gainNode?.position.x).toBe(600)
      expect(gainNode?.position.y).toBe(100)
    })
  })

  describe('findNodeByIdOrType', () => {
    it('should find nodes by exact ID', async () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const node = store.adaptedNodes[0]

      const foundNode = (service as any).findNodeByIdOrType(store, node.id)
      expect(foundNode).toBe(node)
    })

    it('should find nodes by type when ID not found', async () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const node = store.adaptedNodes[0]

      const foundNode = (service as any).findNodeByIdOrType(store, 'OscillatorNode')
      expect(foundNode).toBe(node)
    })

    it('should find nodes by partial ID match', async () => {
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      const node = store.adaptedNodes[0]

      const foundNode = (service as any).findNodeByIdOrType(store, 'oscillator')
      expect(foundNode).toBe(node)
    })

    it('should find nodes by numbered identifiers (osc1, midiToFreq1)', () => {
      // Create nodes
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      store.addAdaptedNode('MidiToFreqNode', { x: 200, y: 100 })

      // Test numbered identifiers
      const oscNode = service['findNodeByIdOrType'](store, 'osc1')
      const midiNode = service['findNodeByIdOrType'](store, 'midiToFreq1')

      expect(oscNode).toBeDefined()
      expect(oscNode?.nodeType).toBe('OscillatorNode')
      expect(midiNode).toBeDefined()
      expect(midiNode?.nodeType).toBe('MidiToFreqNode')
    })
  })

  describe('system prompt', () => {
    it('should include detailed utility node information', () => {
      const service = new LangChainService()
      const availableNodeTypes = [
        'OscillatorNode',
        'DelayNode',
        'SliderNode',
        'MidiToFreqNode',
        'GainNode',
        'AudioDestinationNode',
      ]

      // Access the private method using bracket notation
      const systemPrompt = (service as any).getSystemPrompt(availableNodeTypes)

      // Check for essential information in the new enhanced prompt with audio engineering knowledge
      expect(systemPrompt).toContain('You are a senior audio engineer')
      expect(systemPrompt).toContain('AVAILABLE NODES:')
      expect(systemPrompt).toContain('KEY PARAMETERS:')
      expect(systemPrompt).toContain('DelayNode: delayTime(0-1s)')
      expect(systemPrompt).toContain(
        'OscillatorNode: frequency(Hz), type(sine/square/sawtooth/triangle)'
      )
      expect(systemPrompt).toContain('MANDATORY RULES:')
      expect(systemPrompt).toContain('AudioDestinationNode')
      expect(systemPrompt).toContain('NO UNCONNECTED NODES')
      expect(systemPrompt).toContain('COMPLETE SETUPS REQUIRED:')
      expect(systemPrompt).toContain('MUSICAL CONTROL PATTERN:')
      expect(systemPrompt).toContain('CONNECTIONS FORMAT:')
      expect(systemPrompt).toContain('SLIDER SETUP')
      expect(systemPrompt).toContain('RESPOND WITH PURE JSON ONLY')
      expect(systemPrompt).toContain('REMEMBER: Include ALL nodes AND ALL connections')
    })
  })

  describe('labelUtilityNodes', () => {
    it('should handle slider nodes without auto-labeling', async () => {
      // Create SliderNodes - they should keep their default labels
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'SliderNode',
          nodeId: 'slider1',
          position: { x: 100, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'SliderNode',
          nodeId: 'slider2',
          position: { x: 200, y: 100 },
        },
      ]

      await service.executeActions(actions, store)

      // Check that SliderNodes keep their default "Slider" labels
      const sliders = store.adaptedNodes.filter((n: any) => n.nodeType === 'SliderNode')
      expect(sliders.length).toBe(2)
      sliders.forEach((slider: any) => {
        expect(slider.properties.get('label')).toBe('Slider')
      })
    })

    it('should not override custom labels', async () => {
      // Create SliderNode and set a custom label
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'SliderNode',
          nodeId: 'customSlider',
          position: { x: 100, y: 100 },
        },
        {
          type: 'updateProperty',
          nodeId: 'customSlider',
          propertyName: 'label',
          propertyValue: 'Custom Filter Control',
        },
      ]

      await service.executeActions(actions, store)

      // Check that custom label is preserved
      const slider = store.adaptedNodes.find((n: any) => n.nodeType === 'SliderNode')
      expect(slider?.properties.get('label')).toBe('Custom Filter Control')
    })
  })

  describe('removeConnection', () => {
    it('should remove connections using intelligent node ID matching', async () => {
      // First create nodes and connections
      const createActions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'osc1',
          position: { x: 100, y: 100 },
        },
        {
          type: 'addNode',
          nodeType: 'GainNode',
          nodeId: 'gain1',
          position: { x: 300, y: 100 },
        },
        {
          type: 'addConnection',
          sourceId: 'osc1',
          targetId: 'gain1',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ]

      await service.executeActions(createActions, store)

      // Verify connection was created
      expect(store.visualEdges.length).toBe(1)

      // Now remove the connection using AI identifiers
      const removeActions: AudioGraphAction[] = [
        {
          type: 'removeConnection',
          sourceId: 'osc1',
          targetId: 'gain1',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ]

      await service.executeActions(removeActions, store)

      // Verify connection was removed
      expect(store.visualEdges.length).toBe(0)

      // Verify the specific connection between oscillator and gain is gone
      const oscToGainConnection = store.visualEdges.find((edge: any) => {
        const source = store.adaptedNodes.find((n: any) => n.id === edge.source)
        const target = store.adaptedNodes.find((n: any) => n.id === edge.target)
        return (
          source?.nodeType === 'OscillatorNode' &&
          target?.nodeType === 'GainNode' &&
          edge.sourceHandle === 'output' &&
          edge.targetHandle === 'input'
        )
      })

      expect(oscToGainConnection).toBeUndefined()
    })
  })
})
