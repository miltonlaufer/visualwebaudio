import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import MidiInputNodeComponent from './MidiInputNodeComponent'
import { customNodeStore } from '~/stores/CustomNodeStore'

// Mock navigator.requestMIDIAccess
const mockRequestMIDIAccess = vi.fn()
Object.defineProperty(navigator, 'requestMIDIAccess', {
  value: mockRequestMIDIAccess,
  writable: true,
})

describe('MidiInputNodeComponent', () => {
  beforeEach(() => {
    customNodeStore.clear()
    vi.clearAllMocks()
  })

  it('should render "Node not found" when node does not exist', () => {
    render(<MidiInputNodeComponent nodeId="non-existent-node" />)
    expect(screen.getByText('Node not found')).toBeInTheDocument()
  })

  it('should render MIDI Input interface when node exists', () => {
    // Create a MIDI Input node
    const metadata = {
      properties: [
        { name: 'channel', defaultValue: 1 },
        { name: 'deviceName', defaultValue: '' },
      ],
      outputs: [{ name: 'note' }, { name: 'velocity' }, { name: 'cc' }, { name: 'pitch' }],
    }

    customNodeStore.addNode('test-midi-node', 'MidiInputNode', metadata)

    render(<MidiInputNodeComponent nodeId="test-midi-node" />)

    expect(screen.getByText('MIDI Input')).toBeInTheDocument()
    expect(screen.getByText('Status: Unknown')).toBeInTheDocument()
  })

  it('should show "Request MIDI Access" button when MIDI is not available', () => {
    // Mock MIDI as not available
    mockRequestMIDIAccess.mockImplementation(() => {
      throw new Error('MIDI not available')
    })

    const metadata = {
      properties: [
        { name: 'channel', defaultValue: 1 },
        { name: 'deviceName', defaultValue: '' },
      ],
      outputs: [{ name: 'note' }, { name: 'velocity' }, { name: 'cc' }, { name: 'pitch' }],
    }

    customNodeStore.addNode('test-midi-node', 'MidiInputNode', metadata)

    render(<MidiInputNodeComponent nodeId="test-midi-node" />)

    expect(screen.getByText('Request MIDI Access')).toBeInTheDocument()
  })

  it('should handle MIDI access request', async () => {
    // Mock successful MIDI access
    const mockMIDIAccess = {
      inputs: new Map(),
    }
    mockRequestMIDIAccess.mockResolvedValue(mockMIDIAccess)

    const metadata = {
      properties: [
        { name: 'channel', defaultValue: 1 },
        { name: 'deviceName', defaultValue: '' },
      ],
      outputs: [{ name: 'note' }, { name: 'velocity' }, { name: 'cc' }, { name: 'pitch' }],
    }

    customNodeStore.addNode('test-midi-node', 'MidiInputNode', metadata)

    render(<MidiInputNodeComponent nodeId="test-midi-node" />)

    const requestButton = screen.getByText('Request MIDI Access')
    fireEvent.click(requestButton)

    await waitFor(() => {
      expect(screen.getByText(/Status:/)).toBeInTheDocument()
      expect(screen.getByText(/Ready|Connected/)).toBeInTheDocument()
    })
  })

  it('should display current MIDI values when MIDI access is granted', async () => {
    // Mock successful MIDI access
    const mockMIDIAccess = {
      inputs: new Map(),
    }
    mockRequestMIDIAccess.mockResolvedValue(mockMIDIAccess)

    const metadata = {
      properties: [
        { name: 'channel', defaultValue: 1 },
        { name: 'deviceName', defaultValue: '' },
      ],
      outputs: [{ name: 'note' }, { name: 'velocity' }, { name: 'cc' }, { name: 'pitch' }],
    }

    const node = customNodeStore.addNode('test-midi-node', 'MidiInputNode', metadata)

    render(<MidiInputNodeComponent nodeId="test-midi-node" />)

    // Request MIDI access first
    const requestButton = screen.getByText('Request MIDI Access')
    fireEvent.click(requestButton)

    await waitFor(() => {
      expect(screen.getByText(/Ready|Connected/)).toBeInTheDocument()
    })

    // Initially should show dashes for empty values
    expect(screen.getByText(/Note:/)).toBeInTheDocument()
    expect(screen.getByText(/Note: -/)).toBeInTheDocument()
    expect(screen.getByText(/Velocity: -/)).toBeInTheDocument()
    expect(screen.getByText(/CC: -/)).toBeInTheDocument()
    expect(screen.getByText(/Pitch: -/)).toBeInTheDocument()

    // Set some MIDI values
    node.setOutput('note', 60)
    node.setOutput('velocity', 127)
    node.setOutput('cc', 64)
    node.setOutput('pitch', 8192)

    // Check that values are displayed
    await waitFor(() => {
      expect(screen.getByText(/Note: 60/)).toBeInTheDocument()
      expect(screen.getByText(/Velocity: 127/)).toBeInTheDocument()
      expect(screen.getByText(/CC: 64/)).toBeInTheDocument()
      expect(screen.getByText(/Pitch: 8192/)).toBeInTheDocument()
    })
  })

  it('should show connection indicator when receiving MIDI data', async () => {
    // Mock successful MIDI access
    const mockMIDIAccess = {
      inputs: new Map(),
    }
    mockRequestMIDIAccess.mockResolvedValue(mockMIDIAccess)

    const metadata = {
      properties: [
        { name: 'channel', defaultValue: 1 },
        { name: 'deviceName', defaultValue: '' },
      ],
      outputs: [{ name: 'note' }, { name: 'velocity' }, { name: 'cc' }, { name: 'pitch' }],
    }

    const node = customNodeStore.addNode('test-midi-node', 'MidiInputNode', metadata)

    render(<MidiInputNodeComponent nodeId="test-midi-node" />)

    // Request MIDI access first
    const requestButton = screen.getByText('Request MIDI Access')
    fireEvent.click(requestButton)

    await waitFor(() => {
      expect(screen.getByText(/Ready|Connected/)).toBeInTheDocument()
    })

    // The component shows "Receiving MIDI" when MIDI access is granted
    expect(screen.getByText(/Receiving MIDI/)).toBeInTheDocument()

    // Set a MIDI value to simulate receiving data
    node.setOutput('note', 60)

    // Should still show "Receiving MIDI"
    await waitFor(() => {
      expect(screen.getByText(/Receiving MIDI/)).toBeInTheDocument()
    })
  })
})
