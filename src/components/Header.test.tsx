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
    setCreatingExample: vi.fn(),
    visualNodes: [],
    visualEdges: [],
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

      // Find the mobile menu button (three dots) - it's in the md:hidden section
      const mobileMenuButtons = screen.getAllByRole('button')
      const menuButton = mobileMenuButtons.find(
        button => button.closest('.md\\:hidden.relative') && button.querySelector('svg')
      )
      fireEvent.click(menuButton!)

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
      const mobileMenuButtons = screen.getAllByRole('button')
      const menuButton = mobileMenuButtons.find(
        button => button.closest('.md\\:hidden.relative') && button.querySelector('svg')
      )
      fireEvent.click(menuButton!)
      expect(screen.getByText('View on GitHub')).toBeInTheDocument()
      // Simulate clicking outside
      fireEvent.mouseDown(document.body)
      await waitFor(() => {
        expect(screen.queryByText('View on GitHub')).not.toBeInTheDocument()
      })
    })

    it('should open examples dropdown within mobile menu', () => {
      render(<Header {...defaultProps} />)

      // Open mobile menu - find the mobile menu button in the md:hidden section
      const mobileMenuButtons = screen.getAllByRole('button')
      const menuButton = mobileMenuButtons.find(
        button => button.closest('.md\\:hidden') && button.querySelector('svg')
      )
      fireEvent.click(menuButton!)

      // Click on Quick Examples in mobile menu (should be visible now)
      const mobileExamplesButton = screen.getByText('Quick Examples')
      fireEvent.click(mobileExamplesButton)

      // Check if examples are visible in mobile menu
      expect(screen.getByText('Basic Oscillator')).toBeInTheDocument()
      expect(screen.getByText('Delay Effect')).toBeInTheDocument()
    })

    it('should execute example and close mobile menu when example is selected', async () => {
      render(<Header {...defaultProps} />)

      // Open mobile menu
      const mobileMenuButtons = screen.getAllByRole('button')
      const menuButton = mobileMenuButtons.find(
        button => button.closest('.md\\:hidden') && button.querySelector('svg')
      )
      fireEvent.click(menuButton!)

      // Open examples dropdown in mobile menu
      const mobileExamplesButton = screen.getByText('Quick Examples')
      fireEvent.click(mobileExamplesButton)

      // Click on an example
      const basicOscillator = screen.getByText('Basic Oscillator')
      fireEvent.click(basicOscillator)

      // Verify store methods were called
      expect(mockStore.clearAllNodes).toHaveBeenCalled()
      expect(mockStore.addNode).toHaveBeenCalledWith('OscillatorNode', expect.any(Object))
      expect(mockStore.addNode).toHaveBeenCalledWith('GainNode', expect.any(Object))
      expect(mockStore.addNode).toHaveBeenCalledWith('AudioDestinationNode', expect.any(Object))
      // Wait for setTimeout to complete
      await waitFor(() => {
        expect(mockStore.updateNodeProperty).toHaveBeenCalledWith(undefined, 'gain', 0.5)
      })

      // Menu should be closed after selecting example (check mobile menu is gone)
      const mobileMenuButtonAfter = mobileMenuButtons.find(
        button => button.closest('.md\\:hidden') && button.querySelector('svg')
      )
      expect(mobileMenuButtonAfter).toBeInTheDocument()
      expect(screen.queryByText('View on GitHub')).not.toBeInTheDocument()
    })

    it('should close examples dropdown when clicking examples button again', () => {
      render(<Header {...defaultProps} />)

      // Open mobile menu
      const mobileMenuButtons = screen.getAllByRole('button')
      const menuButton = mobileMenuButtons.find(
        button => button.closest('.md\\:hidden') && button.querySelector('svg')
      )
      fireEvent.click(menuButton!)

      // Open examples dropdown in mobile menu
      const mobileExamplesButton = screen.getByText('Quick Examples')
      fireEvent.click(mobileExamplesButton)

      // Verify examples are visible
      expect(screen.getByText('Basic Oscillator')).toBeInTheDocument()

      // Click examples button again to close
      fireEvent.click(mobileExamplesButton)

      // Examples should be hidden
      expect(screen.queryByText('Basic Oscillator')).not.toBeInTheDocument()
    })

    it('should execute other menu actions and close menu', () => {
      render(<Header {...defaultProps} />)

      // Open mobile menu
      const mobileMenuButtons = screen.getAllByRole('button')
      const menuButton = mobileMenuButtons.find(
        button => button.closest('.md\\:hidden') && button.querySelector('svg')
      )
      fireEvent.click(menuButton!)

      // Test Clear All - should be visible in mobile menu
      const mobileClearAllButton = screen.getByText('Clear All')
      fireEvent.click(mobileClearAllButton)

      expect(mockStore.clearAllNodes).toHaveBeenCalled()
      expect(screen.queryByText('View on GitHub')).not.toBeInTheDocument() // Mobile menu should be closed

      // Open menu again for next test
      fireEvent.click(menuButton!)

      // Test Undo - find by title since the text is small
      const undoButton = screen.getByTitle('Undo (⌘Z)')
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
      const desktopExamplesList = screen.getByText('Audio Examples')
      expect(desktopExamplesList).toBeInTheDocument()
      expect(screen.getByText('Basic Oscillator')).toBeInTheDocument()
    })

    it('should close desktop examples dropdown when clicking outside', async () => {
      render(<Header {...defaultProps} />)
      // Open desktop examples dropdown
      const desktopExamplesButton = screen.getByRole('button', { name: /Quick Examples/i })
      fireEvent.click(desktopExamplesButton)
      expect(screen.getByText('Audio Examples')).toBeInTheDocument()
      // Simulate clicking outside
      fireEvent.mouseDown(document.body)
      await waitFor(() => {
        expect(screen.queryByText('Audio Examples')).not.toBeInTheDocument()
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('should show mobile menu button on small screens and hide desktop buttons', () => {
      render(<Header {...defaultProps} />)

      // Mobile menu button should be present
      const mobileMenuButtons = screen.getAllByRole('button')
      const menuButton = mobileMenuButtons.find(
        button => button.closest('.md\\:hidden') && button.querySelector('svg')
      )
      expect(menuButton).toBeInTheDocument()

      // Desktop section should have hidden md:flex classes
      const desktopSection = screen
        .getByRole('button', { name: /Quick Examples/i })
        .closest('.hidden')
      expect(desktopSection).toHaveClass('hidden', 'md:flex')
    })

    it('should show node palette and property panel toggle buttons on mobile', () => {
      render(<Header {...defaultProps} />)

      expect(screen.getByTitle('Toggle Node Palette')).toBeInTheDocument()
      expect(screen.getByTitle('Toggle Property Panel')).toBeInTheDocument()
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
