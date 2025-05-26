import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import ExportJSButton from './ExportJSButton'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

// Mock the audio graph store
vi.mock('~/stores/AudioGraphStore')

// Mock react-syntax-highlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => (
    <pre data-testid="syntax-highlighter">{children}</pre>
  ),
}))

// Mock react-syntax-highlighter styles
vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: {},
}))

// Mock usehooks-ts
vi.mock('usehooks-ts', () => ({
  useOnClickOutside: vi.fn(),
}))

// Mock clipboard API
const mockWriteText = vi.fn(() => Promise.resolve())
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
})

// Mock document.execCommand for fallback
document.execCommand = vi.fn(() => true)

describe('ExportJSButton', () => {
  const mockStore = {
    visualNodes: [],
    visualEdges: [],
    audioConnections: [],
    selectedNodeId: undefined,
    isPlaying: false,
    undoStack: [],
    redoStack: [],
    propertyChangeCounter: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAudioGraphStore).mockReturnValue(mockStore as any)

    // Reset clipboard mock
    mockWriteText.mockResolvedValue(undefined)
  })

  it('renders the export button with JS logo', () => {
    render(<ExportJSButton />)

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('title', 'Please add nodes to export JS')
    expect(button).toBeDisabled()

    // Check for JS logo SVG
    const svg = button.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass('text-yellow-500')
  })

  it('enables button when nodes are present', () => {
    const mockStoreWithNodes = {
      ...mockStore,
      visualNodes: [
        {
          id: 'osc-1',
          type: 'OscillatorNode',
          data: {
            nodeType: 'OscillatorNode',
            properties: new Map([
              ['frequency', 440],
              ['type', 'sine'],
            ] as [string, any][]),
          },
        },
      ],
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStoreWithNodes as any)

    render(<ExportJSButton />)

    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('title', 'Export as JavaScript')
  })

  it('opens modal with generated code when clicked', async () => {
    const user = userEvent.setup()
    const mockStoreWithNodes = {
      ...mockStore,
      visualNodes: [
        {
          id: 'osc-1',
          type: 'OscillatorNode',
          data: {
            nodeType: 'OscillatorNode',
            properties: new Map([
              ['frequency', 440],
              ['type', 'sine'],
            ] as [string, any][]),
          },
        },
        {
          id: 'dest-1',
          type: 'AudioDestinationNode',
          data: {
            nodeType: 'AudioDestinationNode',
            properties: new Map(),
          },
        },
      ],
      visualEdges: [
        {
          id: 'edge-1',
          source: 'osc-1',
          target: 'dest-1',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ],
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStoreWithNodes as any)

    render(<ExportJSButton />)

    const button = screen.getByRole('button')
    await user.click(button)

    // Check modal is open
    expect(screen.getByText('Exported JavaScript Code')).toBeInTheDocument()
    expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()

    // Check for copy button
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })

  it('generates correct JavaScript code for oscillator and destination', async () => {
    const user = userEvent.setup()
    const mockStoreWithNodes = {
      ...mockStore,
      visualNodes: [
        {
          id: 'osc-1',
          type: 'OscillatorNode',
          data: {
            nodeType: 'OscillatorNode',
            properties: new Map([
              ['frequency', 440],
              ['type', 'sine'],
            ] as [string, any][]),
          },
        },
        {
          id: 'dest-1',
          type: 'AudioDestinationNode',
          data: {
            nodeType: 'AudioDestinationNode',
            properties: new Map(),
          },
        },
      ],
      visualEdges: [
        {
          id: 'edge-1',
          source: 'osc-1',
          target: 'dest-1',
        },
      ],
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStoreWithNodes as any)

    render(<ExportJSButton />)

    const button = screen.getByRole('button')
    await user.click(button)

    const codeElement = screen.getByTestId('syntax-highlighter')
    const generatedCode = codeElement.textContent

    // Check for essential parts of the generated code
    expect(generatedCode).toContain(
      'const audioContext = new (window.AudioContext || window.webkitAudioContext)();'
    )
    expect(generatedCode).toContain('const osc_1 = audioContext.createOscillator();')
    expect(generatedCode).toContain('const dest_1 = audioContext.destination;')
    expect(generatedCode).toContain('osc_1.frequency.value = 440;')
    expect(generatedCode).toContain("osc_1.type = 'sine';")
    expect(generatedCode).toContain('osc_1.connect(dest_1);')
    expect(generatedCode).toContain('osc_1.start();')
    expect(generatedCode).toContain('audioContext.resume();')
  })

  it('generates correct code for gain node', async () => {
    const user = userEvent.setup()
    const mockStoreWithNodes = {
      ...mockStore,
      visualNodes: [
        {
          id: 'gain-1',
          type: 'GainNode',
          data: {
            nodeType: 'GainNode',
            properties: new Map([['gain', 0.5]] as [string, any][]),
          },
        },
      ],
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStoreWithNodes as any)

    render(<ExportJSButton />)

    const button = screen.getByRole('button')
    await user.click(button)

    const codeElement = screen.getByTestId('syntax-highlighter')
    const generatedCode = codeElement.textContent

    expect(generatedCode).toContain('const gain_1 = audioContext.createGain();')
    expect(generatedCode).toContain('gain_1.gain.value = 0.5;')
  })

  it('generates correct code for delay node', async () => {
    const user = userEvent.setup()
    const mockStoreWithNodes = {
      ...mockStore,
      visualNodes: [
        {
          id: 'delay-1',
          type: 'DelayNode',
          data: {
            nodeType: 'DelayNode',
            properties: new Map([['delayTime', 0.3]] as [string, any][]),
          },
        },
      ],
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStoreWithNodes as any)

    render(<ExportJSButton />)

    const button = screen.getByRole('button')
    await user.click(button)

    const codeElement = screen.getByTestId('syntax-highlighter')
    const generatedCode = codeElement.textContent

    expect(generatedCode).toContain('const delay_1 = audioContext.createDelay(1.0);')
    expect(generatedCode).toContain('delay_1.delayTime.value = 0.3;')
  })

  it('copies code to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup()
    const mockStoreWithNodes = {
      ...mockStore,
      visualNodes: [
        {
          id: 'osc-1',
          type: 'OscillatorNode',
          data: {
            nodeType: 'OscillatorNode',
            properties: new Map([['frequency', 440]] as [string, any][]),
          },
        },
      ],
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStoreWithNodes as any)

    render(<ExportJSButton />)

    // Open modal
    const exportButton = screen.getByRole('button')
    await user.click(exportButton)

    // Verify initial state shows "Copy"
    expect(screen.getByText('Copy')).toBeInTheDocument()

    // Click copy button
    const copyButton = screen.getByText('Copy')
    await user.click(copyButton)

    // Check feedback is shown (this indicates copy worked)
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })

    // Verify the button text changed back to "Copy" after timeout
    await waitFor(
      () => {
        expect(screen.getByText('Copy')).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup()
    const mockStoreWithNodes = {
      ...mockStore,
      visualNodes: [
        {
          id: 'osc-1',
          type: 'OscillatorNode',
          data: {
            nodeType: 'OscillatorNode',
            properties: new Map(),
          },
        },
      ],
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStoreWithNodes as any)

    render(<ExportJSButton />)

    // Open modal
    const exportButton = screen.getByRole('button')
    await user.click(exportButton)

    expect(screen.getByText('Exported JavaScript Code')).toBeInTheDocument()

    // Close modal
    const closeButton = screen.getByLabelText('Close')
    await user.click(closeButton)

    expect(screen.queryByText('Exported JavaScript Code')).not.toBeInTheDocument()
  })

  it('closes modal when ESC key is pressed', async () => {
    const user = userEvent.setup()
    const mockStoreWithNodes = {
      ...mockStore,
      visualNodes: [
        {
          id: 'osc-1',
          type: 'OscillatorNode',
          data: {
            nodeType: 'OscillatorNode',
            properties: new Map(),
          },
        },
      ],
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStoreWithNodes as any)

    render(<ExportJSButton />)

    // Open modal
    const exportButton = screen.getByRole('button')
    await user.click(exportButton)

    expect(screen.getByText('Exported JavaScript Code')).toBeInTheDocument()

    // Press ESC
    await user.keyboard('{Escape}')

    expect(screen.queryByText('Exported JavaScript Code')).not.toBeInTheDocument()
  })

  it('sanitizes node IDs with special characters', async () => {
    const user = userEvent.setup()
    const mockStoreWithNodes = {
      ...mockStore,
      visualNodes: [
        {
          id: 'osc-node-123!@#',
          type: 'OscillatorNode',
          data: {
            nodeType: 'OscillatorNode',
            properties: new Map(),
          },
        },
      ],
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStoreWithNodes as any)

    render(<ExportJSButton />)

    const button = screen.getByRole('button')
    await user.click(button)

    const codeElement = screen.getByTestId('syntax-highlighter')
    const generatedCode = codeElement.textContent

    // Should sanitize the ID
    expect(generatedCode).toContain('const osc_node_123___ = audioContext.createOscillator();')
  })

  it('filters out null values from properties', async () => {
    const user = userEvent.setup()
    const mockStoreWithNodes = {
      ...mockStore,
      visualNodes: [
        {
          id: 'osc-1',
          type: 'OscillatorNode',
          data: {
            nodeType: 'OscillatorNode',
            properties: new Map([
              ['frequency', 440],
              ['detune', null],
              ['type', 'sine'],
            ] as [string, any][]),
          },
        },
      ],
    }

    vi.mocked(useAudioGraphStore).mockReturnValue(mockStoreWithNodes as any)

    render(<ExportJSButton />)

    const button = screen.getByRole('button')
    await user.click(button)

    const codeElement = screen.getByTestId('syntax-highlighter')
    const generatedCode = codeElement.textContent

    // Should include frequency and type but not detune (null)
    expect(generatedCode).toContain('osc_1.frequency.value = 440;')
    expect(generatedCode).toContain("osc_1.type = 'sine';")
    expect(generatedCode).not.toContain('detune')
  })
})
