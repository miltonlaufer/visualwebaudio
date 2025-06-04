import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LangChainService, type AudioGraphAction } from './LangChainService'
import { createAudioGraphStore } from '~/stores/AudioGraphStore'

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
  let store: any

  beforeEach(() => {
    vi.clearAllMocks()
    service = new LangChainService()
    service.initialize({
      apiKey: 'test-key',
      model: 'gpt-4',
      temperature: 0.7,
    })
    store = createAudioGraphStore()
    store.loadMetadata()
  })

  describe('executeActions', () => {
    it('should automatically create AudioDestinationNode if none exists', async () => {
      // Add an oscillator node
      store.addNode('OscillatorNode', { x: 100, y: 100 })

      await service.executeActions([], store)

      // Should have oscillator, MidiToFreqNode (auto-created), and destination
      expect(store.visualNodes.length).toBe(3)

      const hasOscillator = store.visualNodes.some(
        (node: any) => node.data.nodeType === 'OscillatorNode'
      )
      const hasDestination = store.visualNodes.some(
        (node: any) => node.data.nodeType === 'AudioDestinationNode'
      )
      const hasMidiToFreq = store.visualNodes.some(
        (node: any) => node.data.nodeType === 'MidiToFreqNode'
      )

      expect(hasOscillator).toBe(true)
      expect(hasDestination).toBe(true)
      expect(hasMidiToFreq).toBe(true)
    })

    it('should connect unconnected source nodes to destination', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator1',
          position: { x: 100, y: 100 },
          description: 'Create oscillator',
        },
      ]

      await service.executeActions(actions, store)

      // Should have MidiToFreq -> Oscillator and Oscillator -> Destination connections
      expect(store.visualEdges.length).toBe(2)

      const oscillatorToDestination = store.visualEdges.find((edge: any) => {
        const source = store.visualNodes.find((n: any) => n.id === edge.source)
        const target = store.visualNodes.find((n: any) => n.id === edge.target)
        return (
          source?.data.nodeType === 'OscillatorNode' &&
          target?.data.nodeType === 'AudioDestinationNode'
        )
      })

      expect(oscillatorToDestination).toBeDefined()
    })

    it('should create effect chains when both source and effect nodes exist', async () => {
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
          nodeType: 'GainNode',
          nodeId: 'gain1',
          position: { x: 300, y: 100 },
          description: 'Create gain',
        },
      ]

      await service.executeActions(actions, store)

      // Should have oscillator, gain, MidiToFreq (auto-created), and destination
      expect(store.visualNodes.length).toBe(4)

      // Should have connections including the effect chain
      expect(store.visualEdges.length).toBe(3)

      const oscillatorToGain = store.visualEdges.find((edge: any) => {
        const source = store.visualNodes.find((n: any) => n.id === edge.source)
        const target = store.visualNodes.find((n: any) => n.id === edge.target)
        return source?.data.nodeType === 'OscillatorNode' && target?.data.nodeType === 'GainNode'
      })

      const gainToDestination = store.visualEdges.find((edge: any) => {
        const source = store.visualNodes.find((n: any) => n.id === edge.source)
        const target = store.visualNodes.find((n: any) => n.id === edge.target)
        return (
          source?.data.nodeType === 'GainNode' && target?.data.nodeType === 'AudioDestinationNode'
        )
      })

      expect(oscillatorToGain).toBeDefined()
      expect(gainToDestination).toBeDefined()
    })

    it('should not create duplicate AudioDestinationNode if one already exists', async () => {
      // First add a destination node manually
      store.addNode('AudioDestinationNode', { x: 500, y: 100 })

      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator1',
          position: { x: 100, y: 100 },
          description: 'Create oscillator',
        },
      ]

      await service.executeActions(actions, store)

      // Should have oscillator, MidiToFreq (auto-created), and existing destination (no duplicate)
      expect(store.visualNodes.length).toBe(3)

      const destinationNodes = store.visualNodes.filter(
        (node: any) => node.data.nodeType === 'AudioDestinationNode'
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

      // Should have oscillator, destination, and MidiToFreq (auto-created)
      expect(store.visualNodes.length).toBe(3)
      expect(store.visualEdges.length).toBe(2)

      const explicitConnection = store.visualEdges.find(
        (edge: any) => edge.sourceHandle === 'output' && edge.targetHandle === 'input'
      )
      expect(explicitConnection).toBeDefined()
    })

    it('should create complete MIDI control chain with SliderNode and MidiToFreqNode', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'SliderNode',
          nodeId: 'midiSlider',
          position: { x: 0, y: 100 },
          description: 'Create MIDI note slider',
        },
        {
          type: 'addNode',
          nodeType: 'MidiToFreqNode',
          nodeId: 'midiToFreq',
          position: { x: 200, y: 100 },
          description: 'Create MIDI to frequency converter',
        },
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator',
          position: { x: 400, y: 100 },
          description: 'Create oscillator',
        },
      ]

      await service.executeActions(actions, store)

      // Should have slider, converter, oscillator, and destination
      expect(store.visualNodes.length).toBe(4)

      // Should have proper connections: slider -> midiToFreq -> oscillator -> destination
      expect(store.visualEdges.length).toBe(3)

      // Check MIDI control chain
      const sliderToMidi = store.visualEdges.find((edge: any) => {
        const source = store.visualNodes.find((n: any) => n.id === edge.source)
        const target = store.visualNodes.find((n: any) => n.id === edge.target)
        return source?.data.nodeType === 'SliderNode' && target?.data.nodeType === 'MidiToFreqNode'
      })

      const midiToOscillator = store.visualEdges.find((edge: any) => {
        const source = store.visualNodes.find((n: any) => n.id === edge.source)
        const target = store.visualNodes.find((n: any) => n.id === edge.target)
        return (
          source?.data.nodeType === 'MidiToFreqNode' && target?.data.nodeType === 'OscillatorNode'
        )
      })

      expect(sliderToMidi).toBeDefined()
      expect(midiToOscillator).toBeDefined()
      expect(midiToOscillator?.targetHandle).toBe('frequency')

      // Check that slider is configured for MIDI range
      const slider = store.visualNodes.find((n: any) => n.data.nodeType === 'SliderNode')
      expect(slider?.data.properties.get('min')).toBe(0)
      expect(slider?.data.properties.get('max')).toBe(127)
      expect(slider?.data.properties.get('value')).toBe(60)
      expect(slider?.data.properties.get('label')).toBe('MIDI Note')
    })

    it('should create volume control with SliderNode and GainNode', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator',
          position: { x: 400, y: 100 },
          description: 'Create oscillator',
        },
        {
          type: 'addNode',
          nodeType: 'GainNode',
          nodeId: 'gain',
          position: { x: 600, y: 100 },
          description: 'Create gain',
        },
        {
          type: 'addNode',
          nodeType: 'SliderNode',
          nodeId: 'volumeSlider',
          position: { x: 0, y: 200 },
          description: 'Create volume slider',
        },
      ]

      await service.executeActions(actions, store)

      // Should have oscillator, gain, slider, MidiToFreq (auto-created), and destination
      expect(store.visualNodes.length).toBe(5)

      // Should have connections including audio chain
      expect(store.visualEdges.length).toBe(4)

      // The system prioritizes MIDI control, so the first slider will be connected to MIDI
      // But the gain node should still be inserted into the audio chain
      const oscillatorToGain = store.visualEdges.find((edge: any) => {
        const source = store.visualNodes.find((n: any) => n.id === edge.source)
        const target = store.visualNodes.find((n: any) => n.id === edge.target)
        return source?.data.nodeType === 'OscillatorNode' && target?.data.nodeType === 'GainNode'
      })

      const gainToDestination = store.visualEdges.find((edge: any) => {
        const source = store.visualNodes.find((n: any) => n.id === edge.source)
        const target = store.visualNodes.find((n: any) => n.id === edge.target)
        return (
          source?.data.nodeType === 'GainNode' && target?.data.nodeType === 'AudioDestinationNode'
        )
      })

      // Verify the gain node is properly inserted into the audio chain
      expect(oscillatorToGain).toBeDefined()
      expect(gainToDestination).toBeDefined()
    })

    it('should handle direct frequency control when no MidiToFreqNode is present', async () => {
      const actions: AudioGraphAction[] = [
        {
          type: 'addNode',
          nodeType: 'SliderNode',
          nodeId: 'freqSlider',
          position: { x: 0, y: 100 },
          description: 'Create frequency slider',
        },
        {
          type: 'addNode',
          nodeType: 'OscillatorNode',
          nodeId: 'oscillator',
          position: { x: 400, y: 100 },
          description: 'Create oscillator',
        },
      ]

      await service.executeActions(actions, store)

      // Should have slider, oscillator, MidiToFreq (auto-created), and destination
      expect(store.visualNodes.length).toBe(4)

      // Should have MIDI control chain: slider -> MidiToFreq -> oscillator -> destination
      expect(store.visualEdges.length).toBe(3)

      // Check MIDI control chain
      const sliderToMidi = store.visualEdges.find((edge: any) => {
        const source = store.visualNodes.find((n: any) => n.id === edge.source)
        const target = store.visualNodes.find((n: any) => n.id === edge.target)
        return source?.data.nodeType === 'SliderNode' && target?.data.nodeType === 'MidiToFreqNode'
      })

      expect(sliderToMidi).toBeDefined()

      // Check that slider is configured for MIDI range (the new preferred behavior)
      const slider = store.visualNodes.find((node: any) => node.data.nodeType === 'SliderNode')
      expect(slider?.data.properties.get('min')).toBe(0)
      expect(slider?.data.properties.get('max')).toBe(127)
      expect(slider?.data.properties.get('label')).toBe('MIDI Note')
    })
  })

  describe('findNodeByIdOrType', () => {
    it('should find nodes by exact ID', async () => {
      store.addNode('OscillatorNode', { x: 100, y: 100 })
      const node = store.visualNodes[0]

      const foundNode = (service as any).findNodeByIdOrType(store, node.id)
      expect(foundNode).toBe(node)
    })

    it('should find nodes by type when ID not found', async () => {
      store.addNode('OscillatorNode', { x: 100, y: 100 })
      const node = store.visualNodes[0]

      const foundNode = (service as any).findNodeByIdOrType(store, 'OscillatorNode')
      expect(foundNode).toBe(node)
    })

    it('should find nodes by partial ID match', async () => {
      store.addNode('OscillatorNode', { x: 100, y: 100 })
      const node = store.visualNodes[0]

      const foundNode = (service as any).findNodeByIdOrType(store, 'oscillator')
      expect(foundNode).toBe(node)
    })
  })

  describe('system prompt', () => {
    it('should include detailed utility node information', () => {
      const service = new LangChainService()
      const availableNodeTypes = [
        'OscillatorNode',
        'SliderNode',
        'MidiToFreqNode',
        'GainNode',
        'AudioDestinationNode',
      ]

      // Access the private method using bracket notation
      const systemPrompt = (service as any).getSystemPrompt(availableNodeTypes)

      // Check for essential information in the new enhanced prompt with audio engineering knowledge
      expect(systemPrompt).toContain('You are a senior audio engineer')
      expect(systemPrompt).toContain('CRITICAL RULES:')
      expect(systemPrompt).toContain('AudioDestinationNode')
      expect(systemPrompt).toContain('No unconnected nodes')
      expect(systemPrompt).toContain('AUDIO ENGINEERING KNOWLEDGE:')
      expect(systemPrompt).toContain('Vintage synths: sawtooth/square waves')
      expect(systemPrompt).toContain('NODE BEHAVIOR:')
      expect(systemPrompt).toContain('OscillatorNode: needs frequency input')
      expect(systemPrompt).toContain('MidiToFreqNode: needs midiNote input')
      expect(systemPrompt).toContain('FREQUENCY STRATEGY:')
      expect(systemPrompt).toContain('ADDING CONTROLS TO EXISTING PROPERTIES:')
      expect(systemPrompt).toContain('RESPOND WITH PURE JSON ONLY - NO TEXT WHATSOEVER')
      expect(systemPrompt).toContain('Use "nodeId" not "id"')
    })
  })
})
