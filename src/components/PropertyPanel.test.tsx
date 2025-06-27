import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RootStore, type IRootStore } from '~/stores/RootStore'
import { AudioGraphStoreContext } from '~/stores/AudioGraphStore'
import { RootStoreContext } from '~/stores/RootStore'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import PropertyPanel from './PropertyPanel'

// Mock FrequencyAnalyzer component
vi.mock('./FrequencyAnalyzer', () => ({
  default: () => <div data-testid="frequency-analyzer">Frequency Analyzer</div>,
}))

describe('PropertyPanel', () => {
  let store: AudioGraphStoreType
  let rootStore: IRootStore

  beforeEach(() => {
    rootStore = RootStore.create({ audioGraph: { history: {} } })
    store = rootStore.audioGraph
    store.loadMetadata()
  })

  const renderWithStore = (component: React.ReactElement) => {
    return render(
      <RootStoreContext.Provider value={rootStore}>
        <AudioGraphStoreContext.Provider value={store}>{component}</AudioGraphStoreContext.Provider>
      </RootStoreContext.Provider>
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

  it('renders node properties when a node is selected', async () => {
    // Add a node and select it
    const nodeId = store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
    rootStore.selectNode(nodeId)

    renderWithStore(<PropertyPanel />)

    // Should show the node type
    await waitFor(() => {
      expect(screen.getByText('OscillatorNode')).toBeInTheDocument()
    })
  })

  it('displays node metadata information', async () => {
    // Add a gain node and select it
    const nodeId = store.addAdaptedNode('GainNode', { x: 100, y: 100 })
    rootStore.selectNode(nodeId)

    renderWithStore(<PropertyPanel />)

    // Should show the node type
    await waitFor(() => {
      expect(screen.getByText('GainNode')).toBeInTheDocument()
    })
  })

  it('handles nodes with no properties gracefully', async () => {
    // Add an AudioDestinationNode (which has no editable properties)
    const nodeId = store.addAdaptedNode('AudioDestinationNode', { x: 100, y: 100 })
    rootStore.selectNode(nodeId)

    renderWithStore(<PropertyPanel />)

    // Should still render the node type
    await waitFor(() => {
      expect(screen.getByText('AudioDestinationNode')).toBeInTheDocument()
    })
  })
})
