import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import AudioNode from './AudioNode'
import type { VisualNodeData } from '../types'

const mockNodeData: VisualNodeData = {
  nodeType: 'OscillatorNode',
  metadata: {
    name: 'OscillatorNode',
    category: 'source',
    inputs: [],
    outputs: [{ name: 'output', type: 'audio' }],
    properties: [
      { name: 'frequency', type: 'AudioParam', defaultValue: 440 },
      { name: 'type', type: 'OscillatorType', defaultValue: 'sine' },
    ],
    methods: ['connect', 'disconnect', 'start', 'stop'],
    events: ['ended'],
  },
  properties: new Map<string, any>([
    ['frequency', 440],
    ['type', 'sine'],
  ]),
}

const mockNodeDataWithInputs: VisualNodeData = {
  nodeType: 'GainNode',
  metadata: {
    name: 'GainNode',
    category: 'effect',
    inputs: [{ name: 'input', type: 'audio' }],
    outputs: [{ name: 'output', type: 'audio' }],
    properties: [{ name: 'gain', type: 'AudioParam', defaultValue: 1 }],
    methods: ['connect', 'disconnect'],
    events: [],
  },
  properties: new Map<string, any>([['gain', 0.5]]),
}

// Helper function to render with ReactFlow provider
const renderWithProvider = (component: React.ReactElement) => {
  return render(<ReactFlowProvider>{component}</ReactFlowProvider>)
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
    const dataWithManyProps: VisualNodeData = {
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
      },
    }

    renderWithProvider(<AudioNode data={dataWithManyProps} />)

    expect(screen.getByText('+2 more...')).toBeInTheDocument()
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
})
