import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TimerNodeComponent from './TimerNodeComponent'
import { customNodeStore } from '~/stores/CustomNodeStore'

// Mock the stores
vi.mock('~/stores/CustomNodeStore', () => ({
  customNodeStore: {
    getNode: vi.fn(),
  },
}))

vi.mock('~/stores/AudioGraphStore', () => ({
  useAudioGraphStore: () => ({
    audioContext: null,
  }),
}))

const mockCustomNodeStore = customNodeStore as any

describe('TimerNodeComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle missing node without hooks violation', () => {
    // Simulate a missing node (which can happen during example transitions)
    mockCustomNodeStore.getNode.mockReturnValue(null)

    // This should not throw a hooks violation error
    expect(() => {
      render(<TimerNodeComponent nodeId="non-existent-node" />)
    }).not.toThrow()

    // Should render error message
    expect(screen.getByText('TimerNode not found')).toBeInTheDocument()
  })

  it('should handle wrong node type without hooks violation', () => {
    // Simulate a node with wrong type (which can happen during example transitions)
    const wrongTypeNode = {
      nodeType: 'OscillatorNode',
      properties: new Map(),
    }
    mockCustomNodeStore.getNode.mockReturnValue(wrongTypeNode)

    // This should not throw a hooks violation error
    expect(() => {
      render(<TimerNodeComponent nodeId="wrong-type-node" />)
    }).not.toThrow()

    // Should render error message
    expect(screen.getByText('TimerNode not found')).toBeInTheDocument()
  })

  it('should render normally with valid TimerNode', () => {
    // Mock a valid TimerNode
    const validTimerNode = {
      nodeType: 'TimerNode',
      properties: new Map([
        ['mode', 'loop'],
        ['delay', '1000'],
        ['interval', '1000'],
        ['startMode', 'auto'],
        ['enabled', 'true'],
      ]),
      fireTimerTrigger: vi.fn(),
      resetTimerCount: vi.fn(),
    }
    mockCustomNodeStore.getNode.mockReturnValue(validTimerNode)

    // This should render without errors
    expect(() => {
      render(<TimerNodeComponent nodeId="valid-timer-node" />)
    }).not.toThrow()

    // Should render timer controls
    expect(screen.getByText('Status:')).toBeInTheDocument()
    expect(screen.getByText('Count:')).toBeInTheDocument()
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.getByText('Stop')).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
  })

  it('should handle rapid node changes without hooks violation', () => {
    // Simulate rapid changes that might happen during example switching
    const scenarios = [
      null, // Missing node
      { nodeType: 'OscillatorNode', properties: new Map() }, // Wrong type
      { nodeType: 'TimerNode', properties: new Map() }, // Valid but minimal
      null, // Missing again
      {
        nodeType: 'TimerNode',
        properties: new Map([
          ['mode', 'loop'],
          ['delay', '500'],
          ['interval', '500'],
          ['startMode', 'manual'],
          ['enabled', 'false'],
        ]),
        fireTimerTrigger: vi.fn(),
        resetTimerCount: vi.fn(),
      }, // Valid and complete
    ]

    scenarios.forEach((nodeData, index) => {
      mockCustomNodeStore.getNode.mockReturnValue(nodeData)

      // Each render should work without hooks violations
      expect(() => {
        const { unmount } = render(<TimerNodeComponent nodeId={`test-node-${index}`} />)
        unmount() // Clean up between renders
      }).not.toThrow()
    })
  })
})
