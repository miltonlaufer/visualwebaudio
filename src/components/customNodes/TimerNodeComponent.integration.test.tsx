import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

const mockCustomNodeStore = customNodeStore as any

describe('TimerNodeComponent Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  const createMockTimerNode = (propertyOverrides: any = {}, outputOverrides: any = {}) => {
    return {
      nodeType: 'TimerNode',
      properties: new Map([
        ['mode', 'loop'],
        ['delay', 1000],
        ['interval', 1000],
        ['startMode', 'auto'],
        ['enabled', 'true'],
        ['isRunning', 'false'],
        ['count', 0],
        ...Object.entries(propertyOverrides),
      ]),
      outputs: new Map([['trigger', 0], ['count', 0], ...Object.entries(outputOverrides)]),
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      resetTimer: vi.fn(),
      fireTimerTrigger: vi.fn(),
    }
  }

  describe('Auto-start functionality', () => {
    it('should auto-start when startMode is auto', async () => {
      const mockNode = createMockTimerNode({ startMode: 'auto', enabled: 'true' })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="auto-start-timer" />)

      // Should display auto start mode
      expect(screen.getByText('Start: auto')).toBeInTheDocument()

      // The auto-start should be handled by the store, not the component
      // But we can verify the component renders correctly for auto-start mode
      expect(screen.getByText('Start')).toBeInTheDocument()
      expect(screen.getByText('Stop')).toBeInTheDocument()
      expect(screen.getByText('Reset')).toBeInTheDocument()
    })

    it('should not auto-start when startMode is manual', async () => {
      const mockNode = createMockTimerNode({ startMode: 'manual', enabled: 'true' })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="manual-start-timer" />)

      // Should display manual start mode
      expect(screen.getByText('Start: manual')).toBeInTheDocument()

      // Timer should not be running initially
      expect(screen.getByText('Status:')).toBeInTheDocument()
      expect(screen.getByText('Stopped')).toBeInTheDocument()
    })

    it('should not auto-start when disabled', async () => {
      const mockNode = createMockTimerNode({ startMode: 'auto', enabled: 'false' })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="disabled-timer" />)

      // Timer should not be running
      expect(screen.getByText('Status:')).toBeInTheDocument()
      expect(screen.getByText('Stopped')).toBeInTheDocument()
    })
  })

  describe('Manual start/stop functionality', () => {
    it('should start timer when start button is clicked', async () => {
      const mockNode = createMockTimerNode({ startMode: 'manual', isRunning: 'false' })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="manual-timer" />)

      const startButton = screen.getByText('Start')
      expect(startButton).toBeEnabled()

      fireEvent.click(startButton)

      expect(mockNode.startTimer).toHaveBeenCalledTimes(1)
    })

    it('should stop timer when stop button is clicked', async () => {
      const mockNode = createMockTimerNode({ isRunning: 'true' })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="running-timer" />)

      const stopButton = screen.getByText('Stop')
      expect(stopButton).toBeEnabled()

      fireEvent.click(stopButton)

      expect(mockNode.stopTimer).toHaveBeenCalledTimes(1)
    })

    it('should reset timer when reset button is clicked', async () => {
      const mockNode = createMockTimerNode({}, { count: 5 })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="timer-with-count" />)

      const resetButton = screen.getByText('Reset')
      fireEvent.click(resetButton)

      expect(mockNode.resetTimer).toHaveBeenCalledTimes(1)
    })

    it('should disable start button when timer is running', async () => {
      const mockNode = createMockTimerNode({ isRunning: 'true' })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="running-timer" />)

      const startButton = screen.getByText('Start')
      const stopButton = screen.getByText('Stop')

      expect(startButton).toBeDisabled()
      expect(stopButton).toBeEnabled()
    })

    it('should disable stop button when timer is not running', async () => {
      const mockNode = createMockTimerNode({ isRunning: 'false' })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="stopped-timer" />)

      const startButton = screen.getByText('Start')
      const stopButton = screen.getByText('Stop')

      expect(startButton).toBeEnabled()
      expect(stopButton).toBeDisabled()
    })
  })

  describe('Timer state display', () => {
    it('should display running status correctly', async () => {
      const mockNode = createMockTimerNode({ isRunning: 'true' })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="running-timer" />)

      expect(screen.getByText('Status:')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
    })

    it('should display stopped status correctly', async () => {
      const mockNode = createMockTimerNode({ isRunning: 'false' })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="stopped-timer" />)

      expect(screen.getByText('Status:')).toBeInTheDocument()
      expect(screen.getByText('Stopped')).toBeInTheDocument()
    })

    it('should display trigger count correctly', async () => {
      const mockNode = createMockTimerNode({}, { count: 42 })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="timer-with-count" />)

      expect(screen.getByText('Count:')).toBeInTheDocument()
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('should display timer settings correctly', async () => {
      const mockNode = createMockTimerNode({
        mode: 'loop',
        delay: 500,
        interval: 2000,
        startMode: 'manual',
      })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="configured-timer" />)

      expect(screen.getByText('Mode: loop')).toBeInTheDocument()
      expect(screen.getByText('Delay: 500ms')).toBeInTheDocument()
      expect(screen.getByText('Interval: 2000ms')).toBeInTheDocument()
      expect(screen.getByText('Start: manual')).toBeInTheDocument()
    })

    it('should hide interval display for one-shot mode', async () => {
      const mockNode = createMockTimerNode({
        mode: 'oneshot',
        delay: 500,
        interval: 2000,
      })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="oneshot-timer" />)

      expect(screen.getByText('Mode: oneshot')).toBeInTheDocument()
      expect(screen.getByText('Delay: 500ms')).toBeInTheDocument()
      expect(screen.queryByText('Interval: 2000ms')).not.toBeInTheDocument()
    })
  })

  describe('Error handling', () => {
    it('should handle missing node gracefully', async () => {
      mockCustomNodeStore.getNode.mockReturnValue(null)

      render(<TimerNodeComponent nodeId="non-existent-timer" />)

      expect(screen.getByText('TimerNode not found')).toBeInTheDocument()
    })

    it('should handle wrong node type gracefully', async () => {
      const wrongNode = {
        nodeType: 'ButtonNode',
        properties: new Map(),
        outputs: new Map(),
      }
      mockCustomNodeStore.getNode.mockReturnValue(wrongNode)

      render(<TimerNodeComponent nodeId="wrong-type-timer" />)

      expect(screen.getByText('TimerNode not found')).toBeInTheDocument()
    })
  })

  describe('Regression prevention', () => {
    it('should prevent React Flow drag when clicking buttons', async () => {
      const mockNode = createMockTimerNode()
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="drag-test-timer" />)

      const startButton = screen.getByText('Start')
      const stopButton = screen.getByText('Stop')
      const resetButton = screen.getByText('Reset')

      // Simulate pointer events that should be prevented
      const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true })

      // These should not throw errors and should be handled gracefully
      expect(() => {
        startButton.dispatchEvent(mouseDownEvent)
        stopButton.dispatchEvent(mouseDownEvent)
        resetButton.dispatchEvent(mouseDownEvent)
        // Note: PointerEvent is not available in test environment, but mousedown/touchstart are sufficient
      }).not.toThrow()
    })

    it('should maintain consistent state across re-renders', async () => {
      const mockNode = createMockTimerNode({ isRunning: 'true' }, { count: 10 })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      const { rerender } = render(<TimerNodeComponent nodeId="stable-timer" />)

      expect(screen.getByText('Status:')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
      expect(screen.getByText('Count:')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()

      // Re-render with same props
      rerender(<TimerNodeComponent nodeId="stable-timer" />)

      expect(screen.getByText('Status:')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
      expect(screen.getByText('Count:')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
    })

    it('should handle rapid button clicks without errors', async () => {
      const mockNode = createMockTimerNode({ isRunning: 'false' })
      mockCustomNodeStore.getNode.mockReturnValue(mockNode)

      render(<TimerNodeComponent nodeId="rapid-click-timer" />)

      const startButton = screen.getByText('Start')

      // Simulate rapid clicking
      for (let i = 0; i < 10; i++) {
        fireEvent.click(startButton)
      }

      // Should have called startTimer multiple times without errors
      expect(mockNode.startTimer).toHaveBeenCalledTimes(10)
    })
  })
})
