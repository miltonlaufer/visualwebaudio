import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Header from './Header'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

// Mock the store
vi.mock('~/stores/AudioGraphStore', () => ({
  useAudioGraphStore: vi.fn(),
}))

// Mock the ProjectModal component
vi.mock('./ProjectModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="project-modal">Project Modal</div> : null,
}))

describe('Header', () => {
  const mockStore = {
    togglePlayback: vi.fn(),
    isPlaying: false,
    clearAllNodes: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: true,
    addNode: vi.fn(),
    addEdge: vi.fn(),
    updateNodeProperty: vi.fn(),
  }

  const defaultProps = {
    isNodePaletteOpen: false,
    isPropertyPanelOpen: false,
    onToggleNodePalette: vi.fn(),
    onTogglePropertyPanel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAudioGraphStore as any).mockReturnValue(mockStore)
  })

  describe('Mobile Menu Functionality', () => {
    it('should open mobile menu when menu button is clicked', () => {
      render(<Header {...defaultProps} />)

      // Find the mobile menu button (three dots)
      const menuButton = screen.getByTitle('More options')
      fireEvent.click(menuButton)

      // Check if mobile menu is visible by looking for mobile-specific elements
      expect(screen.getByText('View on GitHub')).toBeInTheDocument()
      expect(screen.getAllByText('Clear All')).toHaveLength(2) // Desktop + Mobile
      expect(screen.getAllByText('Project')).toHaveLength(2) // Desktop + Mobile
      expect(screen.getByText('Undo')).toBeInTheDocument()
      expect(screen.getByText('Redo')).toBeInTheDocument()
    })

    it('should close mobile menu when clicking outside', async () => {
      render(<Header {...defaultProps} />)
      // Open the mobile menu first
      const menuButton = screen.getByTitle('More options')
      fireEvent.click(menuButton)
      expect(screen.getByText('View on GitHub')).toBeInTheDocument()
      // Simulate clicking outside
      fireEvent.mouseDown(document.body)
      await waitFor(() => {
        expect(screen.queryByText('View on GitHub')).not.toBeInTheDocument()
      })
    })

    it('should open examples dropdown within mobile menu', () => {
      render(<Header {...defaultProps} />)

      // Open mobile menu
      const menuButton = screen.getByTitle('More options')
      fireEvent.click(menuButton)

      // Click on Quick Examples in mobile menu (get all and select the one in mobile menu)
      const examplesButtons = screen.getAllByText('Quick Examples')
      const mobileExamplesButton =
        examplesButtons.find(button => button.closest('.lg\\:hidden')) || examplesButtons[1] // fallback to second one which should be mobile
      fireEvent.click(mobileExamplesButton!)

      // Check if examples are visible in mobile menu
      const mobileExamplesList = screen.getByText('Basic Oscillator').closest('.mt-1.ml-7')
      expect(mobileExamplesList).toBeInTheDocument()
      expect(mobileExamplesList).toHaveClass('mt-1', 'ml-7')
      expect(screen.getByText('Delay Effect')).toBeInTheDocument()
    })

    it('should execute example and close mobile menu when example is selected', async () => {
      render(<Header {...defaultProps} />)

      // Open mobile menu
      const menuButton = screen.getByTitle('More options')
      fireEvent.click(menuButton)

      // Open examples dropdown in mobile menu
      const examplesButtons = screen.getAllByText('Quick Examples')
      const mobileExamplesButton =
        examplesButtons.find(button => button.closest('.lg\\:hidden')) || examplesButtons[1]
      fireEvent.click(mobileExamplesButton!)

      // Click on an example
      const basicOscillator = screen.getByText('Basic Oscillator')
      fireEvent.click(basicOscillator)

      // Verify store methods were called
      expect(mockStore.clearAllNodes).toHaveBeenCalled()
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', { x: 100, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', { x: 250, y: 150 })
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', { x: 400, y: 150 })

      // Wait for setTimeout to complete
      await waitFor(() => {
        expect(mockStore.updateNodeProperty).toHaveBeenCalledWith(undefined, 'gain', 0.5)
      })

      // Menu should be closed after selecting example (check mobile menu is gone)
      expect(screen.queryByTitle('More options')).toBeInTheDocument()
      expect(screen.queryByText('View on GitHub')).not.toBeInTheDocument()
    })

    it('should close examples dropdown when clicking examples button again', () => {
      render(<Header {...defaultProps} />)

      // Open mobile menu
      const menuButton = screen.getByTitle('More options')
      fireEvent.click(menuButton)

      // Open examples dropdown in mobile menu
      const examplesButtons = screen.getAllByText('Quick Examples')
      const mobileExamplesButton =
        examplesButtons.find(button => button.closest('.lg\\:hidden')) || examplesButtons[1]
      fireEvent.click(mobileExamplesButton!)

      // Verify examples are visible
      const mobileExamplesList = screen.getByText('Basic Oscillator').closest('.mt-1.ml-7')
      expect(mobileExamplesList).toBeInTheDocument()

      // Click examples button again to close
      fireEvent.click(mobileExamplesButton!)

      // Examples should be hidden
      expect(screen.queryByText('Basic Oscillator')).not.toBeInTheDocument()

      // But mobile menu should still be open
      expect(screen.getByText('View on GitHub')).toBeInTheDocument()
    })

    it('should execute other menu actions and close menu', () => {
      render(<Header {...defaultProps} />)

      // Open mobile menu
      const menuButton = screen.getByTitle('More options')
      fireEvent.click(menuButton)

      // Test Clear All - get all Clear All buttons and select the mobile one
      const clearAllButtons = screen.getAllByText('Clear All')
      const mobileClearAllButton =
        clearAllButtons.find(button => button.closest('.lg\\:hidden')) || clearAllButtons[1]
      fireEvent.click(mobileClearAllButton!)

      expect(mockStore.clearAllNodes).toHaveBeenCalled()
      expect(screen.queryByText('View on GitHub')).not.toBeInTheDocument() // Mobile menu should be closed

      // Open menu again for next test
      fireEvent.click(menuButton)

      // Test Undo
      const undoButton = screen.getByText('Undo')
      fireEvent.click(undoButton)

      expect(mockStore.undo).toHaveBeenCalled()
      expect(screen.queryByText('View on GitHub')).not.toBeInTheDocument() // Mobile menu should be closed
    })
  })

  describe('Desktop Examples Dropdown', () => {
    it('should open desktop examples dropdown', () => {
      render(<Header {...defaultProps} />)

      // Find the desktop examples button
      const desktopExamplesButton = screen.getByRole('button', { name: /Quick Examples/i })
      fireEvent.click(desktopExamplesButton)

      // Check if examples dropdown is visible in desktop view
      const desktopExamplesList = screen
        .getByText('Choose an example to add to your canvas:')
        .closest('.absolute.right-0')
      expect(desktopExamplesList).toBeInTheDocument()
      expect(desktopExamplesList).toHaveClass('absolute', 'right-0')
      expect(screen.getByText('Basic Oscillator')).toBeInTheDocument()
    })

    it('should close desktop examples dropdown when clicking outside', async () => {
      render(<Header {...defaultProps} />)
      // Open desktop examples dropdown
      const desktopExamplesButton = screen.getByRole('button', { name: /Quick Examples/i })
      fireEvent.click(desktopExamplesButton)
      expect(screen.getByText('Choose an example to add to your canvas:')).toBeInTheDocument()
      // Simulate clicking outside
      fireEvent.mouseDown(document.body)
      await waitFor(() => {
        expect(
          screen.queryByText('Choose an example to add to your canvas:')
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('should show mobile menu button on small screens and hide desktop buttons', () => {
      render(<Header {...defaultProps} />)

      // Mobile menu button should be present
      expect(screen.getByTitle('More options')).toBeInTheDocument()

      // Desktop section should have hidden lg:flex classes
      const desktopSection = screen
        .getByRole('button', { name: /Quick Examples/i })
        .closest('.hidden')
      expect(desktopSection).toHaveClass('hidden', 'lg:flex')
    })

    it('should show node palette and property panel toggle buttons on mobile', () => {
      render(<Header {...defaultProps} />)

      expect(screen.getByTitle('Toggle Node Palette')).toBeInTheDocument()
      expect(screen.getByTitle('Toggle Properties')).toBeInTheDocument()
    })
  })

  describe('Play/Stop Button', () => {
    it('should show play button when not playing', () => {
      render(<Header {...defaultProps} />)

      const playButton = screen.getByRole('button', { name: /Play/i })
      expect(playButton).toBeInTheDocument()
      expect(playButton).toHaveTextContent('Play')
    })

    it('should show stop button when playing', () => {
      const playingStore = { ...mockStore, isPlaying: true }
      ;(useAudioGraphStore as any).mockReturnValue(playingStore)

      render(<Header {...defaultProps} />)

      const stopButton = screen.getByRole('button', { name: /Stop/i })
      expect(stopButton).toBeInTheDocument()
      expect(stopButton).toHaveTextContent('Stop')
    })

    it('should toggle playback when clicked', () => {
      render(<Header {...defaultProps} />)

      const playButton = screen.getByRole('button', { name: /Play/i })
      fireEvent.click(playButton)

      expect(mockStore.togglePlayback).toHaveBeenCalled()
    })
  })
})
