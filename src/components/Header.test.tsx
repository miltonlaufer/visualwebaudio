import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Header from './Header'

// Mock the AudioGraphStore hook
const mockStore = {
  isProjectModified: false,
  visualNodes: [],
  visualEdges: [],
}

vi.mock('~/stores/AudioGraphStore', () => ({
  useAudioGraphStore: () => mockStore,
}))

// Mock the ProjectModal component
vi.mock('./ProjectModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="project-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}))

// Mock window.confirm
const mockConfirm = vi.fn(() => true)
Object.defineProperty(window, 'confirm', { value: mockConfirm, writable: true })

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the header with logo and title', () => {
    render(<Header />)

    expect(screen.getByText('Visual Web Audio')).toBeInTheDocument()
    expect(screen.getByText('alpha')).toBeInTheDocument()
  })

  it('should render project button', () => {
    render(<Header />)

    const projectButton = screen.getByText('Project')
    expect(projectButton).toBeInTheDocument()
  })

  it('should open project modal when project button is clicked', () => {
    render(<Header />)

    const projectButton = screen.getByText('Project')
    fireEvent.click(projectButton)

    expect(screen.getByTestId('project-modal')).toBeInTheDocument()
  })

  it('should close project modal when close button is clicked', () => {
    render(<Header />)

    // Open modal
    const projectButton = screen.getByText('Project')
    fireEvent.click(projectButton)
    expect(screen.getByTestId('project-modal')).toBeInTheDocument()

    // Close modal
    const closeButton = screen.getByText('Close Modal')
    fireEvent.click(closeButton)
    expect(screen.queryByTestId('project-modal')).not.toBeInTheDocument()
  })
})
