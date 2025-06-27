import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RootStore, type IRootStore } from '~/stores/RootStore'
import { AudioGraphStoreContext } from '~/stores/AudioGraphStore'
import { RootStoreContext } from '~/stores/RootStore'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import ProjectModal from './ProjectModal'

describe('ProjectModal', () => {
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

  it('should render when isOpen is true', () => {
    renderWithStore(<ProjectModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Project Manager')).toBeInTheDocument()
  })

  it('should not render when isOpen is false', () => {
    renderWithStore(<ProjectModal isOpen={false} onClose={vi.fn()} />)

    expect(screen.queryByText('Project Manager')).not.toBeInTheDocument()
  })

  it('should render all four tabs', () => {
    renderWithStore(<ProjectModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Recordings')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
    expect(screen.getByText('Import')).toBeInTheDocument()
  })

  it('should show projects tab content by default', () => {
    renderWithStore(<ProjectModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Current Project')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Save As...')).toBeInTheDocument()
  })

  it('should switch to export tab when clicked', () => {
    renderWithStore(<ProjectModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Export'))

    expect(screen.getByText('Download Project File')).toBeInTheDocument()
  })

  it('should switch to recordings tab when clicked', () => {
    renderWithStore(<ProjectModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Recordings'))

    expect(screen.getByText('Audio Recordings')).toBeInTheDocument()
  })

  it('should switch to import tab when clicked', () => {
    renderWithStore(<ProjectModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Import'))

    expect(screen.getByText('Select Project File')).toBeInTheDocument()
  })

  it('should disable save buttons when no nodes exist', () => {
    renderWithStore(<ProjectModal isOpen={true} onClose={vi.fn()} />)

    const saveButton = screen.getByText('Save')
    const saveAsButton = screen.getByText('Save As...')

    expect(saveButton).toBeDisabled()
    expect(saveAsButton).toBeDisabled()
  })
})
