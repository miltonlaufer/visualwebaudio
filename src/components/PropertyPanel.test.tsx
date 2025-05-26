import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createAudioGraphStore, AudioGraphStoreContext } from '~/stores/AudioGraphStore'
import PropertyPanel from './PropertyPanel'

// Mock FrequencyAnalyzer component
vi.mock('./FrequencyAnalyzer', () => ({
  default: () => <div data-testid="frequency-analyzer">Frequency Analyzer</div>,
}))

describe('PropertyPanel', () => {
  let store: ReturnType<typeof createAudioGraphStore>

  beforeEach(() => {
    store = createAudioGraphStore()
    store.loadMetadata()
  })

  const renderWithStore = (component: React.ReactElement) => {
    return render(
      <AudioGraphStoreContext.Provider value={store}>{component}</AudioGraphStoreContext.Provider>
    )
  }

  it('renders frequency analyzer when no node is selected', () => {
    renderWithStore(<PropertyPanel />)

    expect(screen.getByTestId('frequency-analyzer')).toBeInTheDocument()
  })

  it('shows "No node selected" message when no node is selected', () => {
    renderWithStore(<PropertyPanel />)

    expect(screen.getByText('Select a node to edit its properties')).toBeInTheDocument()
  })

  it('renders node properties when a node is selected', () => {
    // Add a node and select it
    const nodeId = store.addNode('OscillatorNode', { x: 100, y: 100 })
    store.selectNode(nodeId)

    renderWithStore(<PropertyPanel />)

    // Should show the node type
    expect(screen.getByText('OscillatorNode')).toBeInTheDocument()
  })

  it('displays node metadata information', () => {
    const nodeId = store.addNode('GainNode', { x: 100, y: 100 })
    store.selectNode(nodeId)

    renderWithStore(<PropertyPanel />)

    // Should show the node type
    expect(screen.getByText('GainNode')).toBeInTheDocument()
  })

  it('handles nodes with no properties gracefully', () => {
    const nodeId = store.addNode('AudioDestinationNode', { x: 100, y: 100 })
    store.selectNode(nodeId)

    renderWithStore(<PropertyPanel />)

    // Should still render the node type
    expect(screen.getByText('AudioDestinationNode')).toBeInTheDocument()
  })
})
