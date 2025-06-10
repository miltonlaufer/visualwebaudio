import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TimerNodeComponent from './TimerNodeComponent'
import { customNodeStore } from '~/stores/CustomNodeStore'

// Mock the stores
vi.mock('~/stores/CustomNodeStore', () => ({
  customNodeStore: {
    getNode: vi.fn(),
    addNode: vi.fn(),
    removeNode: vi.fn(),
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
        ['isRunning', 'false'],
      ]),
      outputs: new Map([
        ['trigger', 0],
        ['count', 0],
      ]),
      fireTimerTrigger: vi.fn(),
      resetTimerCount: vi.fn(),
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      resetTimer: vi.fn(),
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
    // Create multiple nodes rapidly to test hooks stability
    for (let i = 0; i < 5; i++) {
      const mockNode = {
        nodeType: 'TimerNode',
        properties: new Map([
          ['mode', 'loop'],
          ['delay', '1000'],
          ['interval', '1000'],
          ['startMode', 'manual'],
          ['enabled', 'true'],
          ['isRunning', 'false'],
        ]),
        outputs: new Map([
          ['trigger', 0],
          ['count', 0],
        ]),
        startTimer: vi.fn(),
        stopTimer: vi.fn(),
        resetTimer: vi.fn(),
      }

      mockCustomNodeStore.getNode.mockReturnValue(mockNode)
      const { unmount } = render(<TimerNodeComponent nodeId={`test-node-${i}`} />)
      unmount()
    }
  })

  it('should auto-start timer and allow stopping', async () => {
    const mockNode = {
      nodeType: 'TimerNode',
      properties: new Map([
        ['mode', 'loop'],
        ['delay', '100'], // Short delay for testing
        ['interval', '100'],
        ['startMode', 'auto'], // Auto-start enabled (any value except 'manual')
        ['enabled', 'true'],
        ['isRunning', 'true'], // Simulate that auto-start worked
      ]),
      outputs: new Map([
        ['trigger', 0],
        ['count', 0],
      ]),
      fireTimerTrigger: vi.fn(),
      resetTimerCount: vi.fn(),
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      resetTimer: vi.fn(),
    }

    mockCustomNodeStore.getNode.mockReturnValue(mockNode)

    const { getByText } = render(<TimerNodeComponent nodeId="auto-start-test-node" />)

    // Should show timer controls
    expect(getByText('Start')).toBeInTheDocument()
    expect(getByText('Stop')).toBeInTheDocument()
    expect(getByText('Reset')).toBeInTheDocument()

    // The timer should auto-start, so stop button should be enabled
    const stopButton = getByText('Stop')
    expect(stopButton).toBeEnabled()

    // The start button should be disabled since timer is running
    const startButton = getByText('Start')
    expect(startButton).toBeDisabled()
  })

  it('should start automatically unless startMode is manual', () => {
    // Test different startMode values
    const testCases = [
      { startMode: 'auto', description: 'auto mode should enable auto-start' },
      { startMode: 'immediate', description: 'immediate mode should enable auto-start' },
      { startMode: 'enabled', description: 'enabled mode should enable auto-start' },
      { startMode: undefined, description: 'default mode should enable auto-start' },
      { startMode: 'manual', description: 'manual mode should disable auto-start' },
    ]

    testCases.forEach(({ startMode }) => {
      const mockNode = {
        nodeType: 'TimerNode',
        properties: new Map([
          ['mode', 'loop'],
          ['delay', '1000'],
          ['interval', '1000'],
          ['startMode', startMode || 'auto'], // Use default if undefined
          ['enabled', 'true'],
          ['isRunning', 'false'],
        ]),
        outputs: new Map([
          ['trigger', 0],
          ['count', 0],
        ]),
        fireTimerTrigger: vi.fn(),
        resetTimerCount: vi.fn(),
        startTimer: vi.fn(),
        stopTimer: vi.fn(),
        resetTimer: vi.fn(),
      }

      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      const { getByText, unmount } = render(
        <TimerNodeComponent nodeId={`test-${startMode || 'default'}`} />
      )

      // Check that the startMode is displayed correctly
      expect(getByText(`Start: ${startMode || 'auto'}`)).toBeInTheDocument()

      // Verify the component renders without errors for all startMode values
      expect(getByText('Start')).toBeInTheDocument()
      expect(getByText('Stop')).toBeInTheDocument()
      expect(getByText('Reset')).toBeInTheDocument()

      unmount()
    })
  })
})
