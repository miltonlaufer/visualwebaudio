import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createAudioGraphStore } from '~/stores/AudioGraphStore'
import ProjectModal from './ProjectModal'

// Mock URL.createObjectURL and URL.revokeObjectURL
;(globalThis as any).URL.createObjectURL = vi.fn(() => 'mock-url')
;(globalThis as any).URL.revokeObjectURL = vi.fn()

// Mock Blob
;(globalThis as any).Blob = vi.fn().mockImplementation((content, options) => ({
  content,
  options,
}))

describe('ProjectModal', () => {
  let store: ReturnType<typeof createAudioGraphStore>
  let mockOnClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = createAudioGraphStore()
    store.loadMetadata()
    mockOnClose = vi.fn()

    // Reset mocks
    vi.clearAllMocks()
  })

  it('renders nothing when not open', () => {
    const { container } = render(
      <ProjectModal store={store} isOpen={false} onClose={mockOnClose} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders modal when open', () => {
    render(<ProjectModal store={store} isOpen={true} onClose={mockOnClose} />)

    expect(screen.getByText('Project Manager')).toBeInTheDocument()
    expect(screen.getByText('Export Project')).toBeInTheDocument()
    expect(screen.getByText('Import Project')).toBeInTheDocument()
  })

  it('closes modal when close button is clicked', () => {
    render(<ProjectModal store={store} isOpen={true} onClose={mockOnClose} />)

    // The close button is the one with the X icon, we can find it by its position
    const closeButton = screen.getByRole('button', { name: '' })
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it('switches between export and import tabs', () => {
    render(<ProjectModal store={store} isOpen={true} onClose={mockOnClose} />)

    // Should start on export tab
    expect(
      screen.getByText('Export your current project as a JSON file that can be imported later.')
    ).toBeInTheDocument()

    // Switch to import tab
    fireEvent.click(screen.getByText('Import Project'))
    expect(
      screen.getByText(
        'Import a previously exported project file. This will replace your current project.'
      )
    ).toBeInTheDocument()

    // Switch back to export tab
    fireEvent.click(screen.getByText('Export Project'))
    expect(
      screen.getByText('Export your current project as a JSON file that can be imported later.')
    ).toBeInTheDocument()
  })

  it('displays current project stats in export tab', () => {
    // Add some nodes to the store
    store.addNode('OscillatorNode', { x: 100, y: 100 })
    store.addNode('GainNode', { x: 200, y: 200 })

    render(<ProjectModal store={store} isOpen={true} onClose={mockOnClose} />)

    expect(screen.getByText('Nodes: 2')).toBeInTheDocument()
    expect(screen.getByText('Connections: 0')).toBeInTheDocument()
  })

  it('exports project when download button is clicked', () => {
    // Add some test data
    store.addNode('OscillatorNode', { x: 100, y: 100 })

    render(<ProjectModal store={store} isOpen={true} onClose={mockOnClose} />)

    // Mock document.createElement and appendChild/removeChild
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation(() => mockLink as any)
    const removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation(() => mockLink as any)

    fireEvent.click(screen.getByText('Download Project File'))

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(appendChildSpy).toHaveBeenCalledWith(mockLink)
    expect(mockLink.click).toHaveBeenCalled()
    expect(removeChildSpy).toHaveBeenCalledWith(mockLink)
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled()
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled()

    // Cleanup
    createElementSpy.mockRestore()
    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
  })

  it('handles file import', async () => {
    render(<ProjectModal store={store} isOpen={true} onClose={mockOnClose} />)

    // Switch to import tab
    fireEvent.click(screen.getByText('Import Project'))

    // Mock FileReader
    const mockFileReader = {
      readAsText: vi.fn(),
      onload: null as any,
      result: JSON.stringify({
        version: '1.0.0',
        visualNodes: [],
        visualEdges: [],
        audioConnections: [],
      }),
    }

    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any)

    // Create a mock file
    const mockFile = new File(['test content'], 'test.json', { type: 'application/json' })

    // Get the hidden file input
    const fileInput = screen
      .getByRole('button', { name: /select project file/i })
      .parentElement?.querySelector('input[type="file"]') as HTMLInputElement

    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false,
    })

    fireEvent.change(fileInput)

    // Simulate FileReader onload
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockFileReader.result } } as any)
    }

    await waitFor(() => {
      expect(screen.getByText('Project imported successfully!')).toBeInTheDocument()
    })

    // Should auto-close after success
    await waitFor(
      () => {
        expect(mockOnClose).toHaveBeenCalled()
      },
      { timeout: 3000 }
    )
  })

  it('handles invalid file import', async () => {
    render(<ProjectModal store={store} isOpen={true} onClose={mockOnClose} />)

    // Switch to import tab
    fireEvent.click(screen.getByText('Import Project'))

    // Mock FileReader with invalid JSON
    const mockFileReader = {
      readAsText: vi.fn(),
      onload: null as any,
      result: 'invalid json',
    }

    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any)

    const mockFile = new File(['invalid content'], 'test.json', { type: 'application/json' })
    const fileInput = screen
      .getByRole('button', { name: /select project file/i })
      .parentElement?.querySelector('input[type="file"]') as HTMLInputElement

    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false,
    })

    fireEvent.change(fileInput)

    // Simulate FileReader onload with invalid JSON
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockFileReader.result } } as any)
    }

    await waitFor(() => {
      expect(screen.getByText(/Import failed:/)).toBeInTheDocument()
    })
  })

  it('handles missing required fields in import', async () => {
    render(<ProjectModal store={store} isOpen={true} onClose={mockOnClose} />)

    fireEvent.click(screen.getByText('Import Project'))

    const mockFileReader = {
      readAsText: vi.fn(),
      onload: null as any,
      result: JSON.stringify({ version: '1.0.0' }), // Missing required fields
    }

    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any)

    const mockFile = new File(['test'], 'test.json', { type: 'application/json' })
    const fileInput = screen
      .getByRole('button', { name: /select project file/i })
      .parentElement?.querySelector('input[type="file"]') as HTMLInputElement

    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false,
    })

    fireEvent.change(fileInput)

    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockFileReader.result } } as any)
    }

    await waitFor(() => {
      expect(screen.getByText(/Invalid project file format/)).toBeInTheDocument()
    })
  })
})
