import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import AudioNode from './AudioNode'
import type { VisualNodeData } from '../types'
import { createAudioGraphStore, AudioGraphStoreContext } from '../stores/AudioGraphStore'

// Mock the useNodeId hook from React Flow
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    useNodeId: () => 'test-node-id', // Mock node ID
  }
})

const mockNodeData: VisualNodeData = {
  nodeType: 'OscillatorNode',
  metadata: {
    name: 'OscillatorNode',
    description: 'Test oscillator node',
    category: 'source',
    inputs: [],
    outputs: [{ name: 'output', type: 'audio' }],
    properties: [
      { name: 'frequency', type: 'AudioParam', defaultValue: 440 },
      { name: 'type', type: 'OscillatorType', defaultValue: 'sine' },
    ],
    methods: ['start', 'stop'],
    events: ['ended'],
  },
  properties: new Map<string, unknown>([
    ['frequency', 440],
    ['type', 'sine'],
  ]),
}

const mockNodeDataWithInputs: VisualNodeData = {
  nodeType: 'GainNode',
  metadata: {
    name: 'GainNode',
    description: 'Test gain node with inputs',
    category: 'effect',
    inputs: [{ name: 'input', type: 'audio' }],
    outputs: [{ name: 'output', type: 'audio' }],
    properties: [{ name: 'gain', type: 'AudioParam', defaultValue: 1 }],
    methods: ['connect', 'disconnect'],
    events: [],
  },
  properties: new Map<string, unknown>([['gain', 0.5]]),
}

// Helper function to render with ReactFlow provider
const renderWithProvider = (component: React.ReactElement) => {
  const store = createAudioGraphStore()
  return render(
    <AudioGraphStoreContext.Provider value={store}>
      <ReactFlowProvider>{component}</ReactFlowProvider>
    </AudioGraphStoreContext.Provider>
  )
}

describe('AudioNode', () => {
  afterEach(() => {
    cleanup()
  })

  it('should render node with correct title', () => {
    renderWithProvider(<AudioNode data={mockNodeData} />)

    expect(screen.getByText('Oscillator')).toBeInTheDocument()
  })

  it('should display category badge', () => {
    const { container } = renderWithProvider(<AudioNode data={mockNodeData} />)

    // Use container.querySelector to be more specific
    const badge = container.querySelector('.inline-block.px-2.py-1')
    expect(badge).toHaveTextContent('source')
  })

  it('should display node properties', () => {
    const { container } = renderWithProvider(<AudioNode data={mockNodeData} />)

    // Check for property names and values in the container
    expect(container).toHaveTextContent('frequency:')
    expect(container).toHaveTextContent('440')
    expect(container).toHaveTextContent('type:')
    expect(container).toHaveTextContent('sine')
  })

  it('should apply correct category colors', () => {
    const { container } = renderWithProvider(<AudioNode data={mockNodeData} />)
    const nodeElement = container.firstChild as HTMLElement

    expect(nodeElement).toHaveClass('bg-green-100', 'border-green-300')
  })

  it('should apply effect category colors', () => {
    const { container } = renderWithProvider(<AudioNode data={mockNodeDataWithInputs} />)
    const nodeElement = container.firstChild as HTMLElement

    expect(nodeElement).toHaveClass('bg-blue-100', 'border-blue-300')
  })

  it('should show selection ring when selected', () => {
    const { container } = renderWithProvider(<AudioNode data={mockNodeData} selected={true} />)
    const nodeElement = container.firstChild as HTMLElement

    expect(nodeElement).toHaveClass('ring-2', 'ring-blue-500')
  })

  it('should limit displayed properties to 3', () => {
    const dataWithManyProps = {
      ...mockNodeData,
      metadata: {
        ...mockNodeData.metadata,
        properties: [
          { name: 'prop1', type: 'number', defaultValue: 1 },
          { name: 'prop2', type: 'number', defaultValue: 2 },
          { name: 'prop3', type: 'number', defaultValue: 3 },
          { name: 'prop4', type: 'number', defaultValue: 4 },
          { name: 'prop5', type: 'number', defaultValue: 5 },
        ],
        inputs: [], // No inputs so properties will be shown
        outputs: [{ name: 'output', type: 'audio' as const }],
      },
    } as VisualNodeData

    renderWithProvider(<AudioNode data={dataWithManyProps} />)

    expect(screen.getByText('+3 more...')).toBeInTheDocument()
  })

  it('should handle missing metadata gracefully', () => {
    const invalidData = {
      nodeType: 'InvalidNode',
      metadata: undefined as any,
      properties: new Map<string, any>(),
    }

    renderWithProvider(<AudioNode data={invalidData} />)

    expect(screen.getByText('Error: No metadata')).toBeInTheDocument()
    expect(screen.getByText('InvalidNode')).toBeInTheDocument()
  })

  // Test to prevent custom UI regression
  it('should render custom UI elements for custom nodes', () => {
    const store = createAudioGraphStore()
    
    // Mock custom node with createUIElement method
    const mockCustomNode = {
      createUIElement: vi.fn((container: HTMLElement) => {
        const button = document.createElement('button')
        button.textContent = 'Custom Button'
        button.className = 'custom-ui-element'
        container.appendChild(button)
      }),
    }

    // Add mock custom node to store
    store.customNodes.set('test-node-id', mockCustomNode as any)

    const sliderNodeData: VisualNodeData = {
      nodeType: 'SliderNode',
      metadata: {
        name: 'SliderNode',
        description: 'Custom slider node',
        category: 'source',
        inputs: [],
        outputs: [{ name: 'value', type: 'control' }],
        properties: [],
        methods: [],
        events: [],
      },
      properties: new Map(),
    }

    const { container } = render(
      <AudioGraphStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <AudioNode data={sliderNodeData} />
        </ReactFlowProvider>
      </AudioGraphStoreContext.Provider>
    )

    // Check that createUIElement was called
    expect(mockCustomNode.createUIElement).toHaveBeenCalled()

    // Check that the custom UI element was added
    const customElement = container.querySelector('.custom-ui-element')
    expect(customElement).toBeInTheDocument()
    expect(customElement).toHaveTextContent('Custom Button')
  })

  it('should include RandomNode in custom node types', () => {
    const store = createAudioGraphStore()
    
    const mockRandomNode = {
      createUIElement: vi.fn((container: HTMLElement) => {
        const span = document.createElement('span')
        span.textContent = 'Random Value: 42'
        span.className = 'random-ui-element'
        container.appendChild(span)
      }),
    }

    store.customNodes.set('test-node-id', mockRandomNode as any)

    const randomNodeData: VisualNodeData = {
      nodeType: 'RandomNode',
      metadata: {
        name: 'RandomNode',
        description: 'Random value generator',
        category: 'source',
        inputs: [],
        outputs: [{ name: 'value', type: 'control' }],
        properties: [],
        methods: [],
        events: [],
      },
      properties: new Map(),
    }

    const { container } = render(
      <AudioGraphStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <AudioNode data={randomNodeData} />
        </ReactFlowProvider>
      </AudioGraphStoreContext.Provider>
    )

    // Check that createUIElement was called for RandomNode
    expect(mockRandomNode.createUIElement).toHaveBeenCalled()

    // Check that the custom UI element was added
    const customElement = container.querySelector('.random-ui-element')
    expect(customElement).toBeInTheDocument()
  })
})
