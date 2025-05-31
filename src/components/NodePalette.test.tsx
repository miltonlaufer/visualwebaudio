import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NodePalette from './NodePalette'
import { createAudioGraphStore, AudioGraphStoreContext } from '../stores/AudioGraphStore'

// Mock MicrophoneInput component
vi.mock('./MicrophoneInput', () => ({
  default: () => <div data-testid="microphone-input">Microphone Input</div>,
}))

// Mock Web Audio API
const mockAudioContext = {
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 },
    type: 'sine',
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  }),
  destination: { connect: vi.fn(), disconnect: vi.fn() },
  sampleRate: 44100,
  currentTime: 0,
  close: vi.fn(),
  suspend: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
}

// Mock global AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudioContext),
})

// Mock AudioNodeFactory
vi.mock('~/services/AudioNodeFactory', () => ({
  AudioNodeFactory: vi.fn().mockImplementation(() => ({
    createAudioNode: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    updateNodeProperty: vi.fn().mockReturnValue(true),
  })),
}))

// Helper function to render with store provider
const renderWithStore = (component: React.ReactElement) => {
  const store = createAudioGraphStore()

  // Load metadata like the real store does
  store.loadMetadata()

  return {
    ...render(
      <AudioGraphStoreContext.Provider value={store}>{component}</AudioGraphStoreContext.Provider>
    ),
    store,
  }
}

describe('NodePalette - Filtering System', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Basic Rendering', () => {
    it('should render the component without crashing', () => {
      renderWithStore(<NodePalette />)

      // Check that the component renders
      expect(screen.getByText('Node Palette')).toBeInTheDocument()
    })

    it('should render search input with placeholder', () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveValue('')
    })

    it('should render microphone input component', () => {
      renderWithStore(<NodePalette />)

      expect(screen.getByTestId('microphone-input')).toBeInTheDocument()
    })

    it('should render connection type legend', () => {
      renderWithStore(<NodePalette />)

      expect(screen.getByText('Connection Types')).toBeInTheDocument()
      expect(screen.getByText('Audio')).toBeInTheDocument()
      expect(screen.getByText('Control')).toBeInTheDocument()
      expect(screen.getByText('Sound signals')).toBeInTheDocument()
      expect(screen.getByText('Parameter modulation')).toBeInTheDocument()
    })

    it('should render section headers', () => {
      renderWithStore(<NodePalette />)

      expect(screen.getByText('🔊 Web Audio API Nodes')).toBeInTheDocument()
      expect(screen.getByText('🎛️ Utility Nodes')).toBeInTheDocument()
    })
  })

  describe('Text Search Filter', () => {
    it('should filter nodes by name when typing in search input', async () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')

      // Initially all nodes should be visible (check for some common ones)
      expect(screen.getByText('Oscillator')).toBeInTheDocument()
      expect(screen.getByText('Gain')).toBeInTheDocument()

      // Type "gain" to filter
      await user.type(searchInput, 'gain')

      // Only GainNode should be visible
      expect(screen.getByText('Gain')).toBeInTheDocument()
      expect(screen.queryByText('Oscillator')).not.toBeInTheDocument()
    })

    it('should be case insensitive', async () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')

      // Type uppercase
      await user.type(searchInput, 'GAIN')

      expect(screen.getByText('Gain')).toBeInTheDocument()
      expect(screen.queryByText('Oscillator')).not.toBeInTheDocument()
    })

    it('should show clear button when search text is entered', async () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')

      // Type something
      await user.type(searchInput, 'gain')

      // Clear button should appear (look for the X icon or clear functionality)
      const clearButton = searchInput.parentElement?.querySelector('button')
      expect(clearButton).toBeInTheDocument()
    })

    it('should clear search when clear button is clicked', async () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')

      // Type something
      await user.type(searchInput, 'gain')
      expect(searchInput).toHaveValue('gain')

      // Find and click clear button
      const clearButton = searchInput.parentElement?.querySelector('button')
      if (clearButton) {
        await user.click(clearButton)
      }

      expect(searchInput).toHaveValue('')
      // All nodes should be visible again
      expect(screen.getByText('Oscillator')).toBeInTheDocument()
      expect(screen.getByText('Gain')).toBeInTheDocument()
    })

    it('should show partial matches', async () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')

      // Search for "osc" which should match "OscillatorNode"
      await user.type(searchInput, 'osc')

      expect(screen.getByText('Oscillator')).toBeInTheDocument()
      expect(screen.queryByText('Gain')).not.toBeInTheDocument()
    })

    it('should show no results when filters match nothing', async () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')

      // Search for something that doesn't exist
      await user.type(searchInput, 'nonexistent')

      // Should show no results message
      expect(screen.getByText('No nodes match your filters')).toBeInTheDocument()
      expect(screen.getByText('Clear filters to see all nodes')).toBeInTheDocument()
    })
  })

  describe('Clear Filters', () => {
    it('should show clear filters button when filters are active', async () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')

      // Initially no clear filters button
      expect(screen.queryByText(/Clear filters/)).not.toBeInTheDocument()

      // Type something
      await user.type(searchInput, 'gain')

      // Clear filters button should appear
      expect(screen.getByText(/Clear filters/)).toBeInTheDocument()
      expect(screen.getByText(/\d+ of \d+ nodes shown/)).toBeInTheDocument()
    })

    it('should clear all filters when clear button is clicked', async () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')

      // Apply text filter
      await user.type(searchInput, 'gain')
      expect(searchInput).toHaveValue('gain')

      // Click clear filters button
      const clearFiltersButton = screen.getByText(/Clear filters/)
      await user.click(clearFiltersButton)

      // All filters should be cleared
      expect(searchInput).toHaveValue('')
      expect(screen.queryByText(/Clear filters/)).not.toBeInTheDocument()

      // All nodes should be visible again
      expect(screen.getByText('Oscillator')).toBeInTheDocument()
      expect(screen.getByText('Gain')).toBeInTheDocument()
    })
  })

  describe('Node Display', () => {
    it('should show node counts in node cards', () => {
      renderWithStore(<NodePalette />)

      // Check that input/output counts are displayed
      const nodeCards = screen.getAllByText(/\d+ (in|out)/)
      expect(nodeCards.length).toBeGreaterThan(0)
    })

    it('should render draggable node elements', () => {
      renderWithStore(<NodePalette />)

      const oscillatorNode = screen.getByText('Oscillator')
      const draggableElement = oscillatorNode.closest('[draggable="true"]')

      expect(draggableElement).toBeInTheDocument()
      expect(draggableElement).toHaveAttribute('draggable', 'true')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty search gracefully', async () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')

      // Type and then clear
      await user.type(searchInput, 'test')
      await user.clear(searchInput)

      // Should show all nodes again
      expect(screen.getByText('Oscillator')).toBeInTheDocument()
      expect(screen.getByText('Gain')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper input attributes', () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')
      expect(searchInput).toHaveAttribute('type', 'text')
    })

    it('should support keyboard navigation', async () => {
      renderWithStore(<NodePalette />)

      const searchInput = screen.getByPlaceholderText('Search nodes to add...')

      // Should be able to focus and type
      await user.click(searchInput)
      await user.type(searchInput, 'test')

      expect(searchInput).toHaveValue('test')
      expect(searchInput).toHaveFocus()
    })
  })
})
