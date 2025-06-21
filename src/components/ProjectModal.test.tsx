import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ProjectModal from './ProjectModal'

// Simple mock store
const mockStore = {
  adaptedNodes: [],
  visualEdges: [],
  setProjectModified: vi.fn(),
  clearAllNodes: vi.fn(),
  isProjectModified: false,
}

// Mock the store hook
vi.mock('~/stores/AudioGraphStore', () => ({
  useAudioGraphStore: () => mockStore,
}))

// Mock CustomNodeStore
vi.mock('~/stores/CustomNodeStore', () => ({
  customNodeStore: {
    getNode: vi.fn(),
    removeNode: vi.fn(),
  },
}))

// Mock database operations
vi.mock('~/utils/database', () => ({
  projectOperations: {
    getAllProjects: vi.fn(() => Promise.resolve([])),
    saveProject: vi.fn(() => Promise.resolve(1)),
    updateProject: vi.fn(() => Promise.resolve()),
    deleteProject: vi.fn(() => Promise.resolve()),
    projectNameExists: vi.fn(() => Promise.resolve(false)),
  },
  recordingOperations: {
    getAllRecordings: vi.fn(() => Promise.resolve([])),
    saveRecording: vi.fn(() => Promise.resolve(1)),
    updateRecordingName: vi.fn(() => Promise.resolve()),
    deleteRecording: vi.fn(() => Promise.resolve()),
    getRecordingsByProject: vi.fn(() => Promise.resolve([])),
  },
}))

// Mock MST functions
vi.mock('mobx-state-tree', () => ({
  getSnapshot: vi.fn(() => ({})),
  applySnapshot: vi.fn(),
  types: {
    model: vi.fn(() => ({
      props: vi.fn(() => ({
        actions: vi.fn(() => ({})),
      })),
      actions: vi.fn(() => ({})),
    })),
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    map: vi.fn(() => ({})),
    array: vi.fn(() => ({})),
    optional: vi.fn(() => ({})),
    frozen: vi.fn(() => ({})),
  },
}))

// Mock useOnClickOutside
vi.mock('usehooks-ts', () => ({
  useOnClickOutside: vi.fn(),
}))

describe('ProjectModal - Basic Rendering', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(<ProjectModal isOpen={false} onClose={vi.fn()} />)

    expect(screen.queryByText('Project Manager')).not.toBeInTheDocument()
  })

  it('should render when isOpen is true', () => {
    render(<ProjectModal {...defaultProps} />)

    expect(screen.getByText('Project Manager')).toBeInTheDocument()
  })

  it('should render all four tabs', () => {
    render(<ProjectModal {...defaultProps} />)

    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Recordings')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
    expect(screen.getByText('Import')).toBeInTheDocument()
  })

  it('should show projects tab content by default', () => {
    render(<ProjectModal {...defaultProps} />)

    expect(screen.getByText('Current Project')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Save As...')).toBeInTheDocument()
  })

  it('should switch to export tab when clicked', () => {
    render(<ProjectModal {...defaultProps} />)

    fireEvent.click(screen.getByText('Export'))

    expect(screen.getByText('Download Project File')).toBeInTheDocument()
  })

  it('should switch to recordings tab when clicked', () => {
    render(<ProjectModal {...defaultProps} />)

    fireEvent.click(screen.getByText('Recordings'))

    expect(screen.getByText('Audio Recordings')).toBeInTheDocument()
  })

  it('should switch to import tab when clicked', () => {
    render(<ProjectModal {...defaultProps} />)

    fireEvent.click(screen.getByText('Import'))

    expect(screen.getByText('Select Project File')).toBeInTheDocument()
  })

  it('should disable save buttons when no nodes exist', () => {
    render(<ProjectModal {...defaultProps} />)

    const saveButton = screen.getByText('Save')
    const saveAsButton = screen.getByText('Save As...')

    expect(saveButton).toBeDisabled()
    expect(saveAsButton).toBeDisabled()
  })
})
