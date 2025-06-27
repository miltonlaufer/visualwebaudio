import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RootStore, type IRootStore } from '~/stores/RootStore'
import type { AudioGraphStoreType } from '~/stores/AudioGraphStore'
import { AudioGraphStoreContext } from '~/stores/AudioGraphStore'
import ExamplesDropdown from './ExamplesDropdown'

// Mock the Examples hook
const mockExample = {
  id: 'test-example',
  name: 'Test Example',
  description: 'A test example',
  create: vi.fn(() => Promise.resolve()),
}

vi.mock('./Examples', () => ({
  useExamples: () => ({
    examples: [mockExample],
  }),
}))

// Mock Web Audio API
const createMockAudioNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  frequency: { value: 440 },
  gain: { value: 1 },
})

const mockAudioContext = {
  createOscillator: vi.fn(() => ({
    ...createMockAudioNode(),
    frequency: { value: 440 },
    detune: { value: 0 },
    type: 'sine',
  })),
  createGain: vi.fn(() => ({
    ...createMockAudioNode(),
    gain: { value: 1 },
  })),
  destination: createMockAudioNode(),
  resume: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  state: 'running' as AudioContextState,
}

const MockAudioContext = vi.fn(() => mockAudioContext)
;(globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext

// Mock window.confirm
const mockConfirm = vi.fn(() => true)
Object.defineProperty(window, 'confirm', { value: mockConfirm })

const TestWrapper: React.FC<{ store: AudioGraphStoreType; children: React.ReactNode }> = ({
  store,
  children,
}) => <AudioGraphStoreContext.Provider value={store}>{children}</AudioGraphStoreContext.Provider>

describe('ExamplesDropdown - Project Modification Tracking', () => {
  let store: AudioGraphStoreType
  let rootStore: IRootStore

  beforeEach(() => {
    rootStore = RootStore.create({ audioGraph: { history: {} } })
    store = rootStore.audioGraph
    store.loadMetadata()
    vi.clearAllMocks()
    mockConfirm.mockReturnValue(true)
  })

  describe('Desktop variant', () => {
    it('should not show confirmation dialog when project is not modified', async () => {
      expect(rootStore.isProjectModified).toBe(false)

      render(
        <TestWrapper store={store}>
          <ExamplesDropdown variant="desktop" />
        </TestWrapper>
      )

      // Open the dropdown
      const dropdownButton = screen.getByText('Quick Examples')
      fireEvent.click(dropdownButton)

      // Click on the example
      const exampleButton = screen.getByText('Test Example')
      fireEvent.click(exampleButton)

      // Should not show confirmation dialog
      expect(mockConfirm).not.toHaveBeenCalled()

      // Should call the example create function
      expect(mockExample.create).toHaveBeenCalled()
    })

    it('should show confirmation dialog when project is modified and user confirms', async () => {
      // Add a node to modify the project
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      expect(rootStore.isProjectModified).toBe(true)

      mockConfirm.mockReturnValue(true)

      render(
        <TestWrapper store={store}>
          <ExamplesDropdown variant="desktop" />
        </TestWrapper>
      )

      // Open the dropdown
      const dropdownButton = screen.getByText('Quick Examples')
      fireEvent.click(dropdownButton)

      // Click on the example
      const exampleButton = screen.getByText('Test Example')
      fireEvent.click(exampleButton)

      // Should show confirmation dialog
      expect(mockConfirm).toHaveBeenCalledWith(
        'You will lose your changes. Are you sure you want to load this example?'
      )

      // Should call the example create function since user confirmed
      expect(mockExample.create).toHaveBeenCalled()
    })

    it('should not load example when project is modified and user cancels', async () => {
      // Add a node to modify the project
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      expect(rootStore.isProjectModified).toBe(true)

      mockConfirm.mockReturnValue(false) // User cancels

      render(
        <TestWrapper store={store}>
          <ExamplesDropdown variant="desktop" />
        </TestWrapper>
      )

      // Open the dropdown
      const dropdownButton = screen.getByText('Quick Examples')
      fireEvent.click(dropdownButton)

      // Click on the example
      const exampleButton = screen.getByText('Test Example')
      fireEvent.click(exampleButton)

      // Should show confirmation dialog
      expect(mockConfirm).toHaveBeenCalledWith(
        'You will lose your changes. Are you sure you want to load this example?'
      )

      // Should NOT call the example create function since user cancelled
      expect(mockExample.create).not.toHaveBeenCalled()
    })
  })

  describe('Mobile variant', () => {
    it('should not show confirmation dialog when project is not modified', async () => {
      expect(rootStore.isProjectModified).toBe(false)

      render(
        <TestWrapper store={store}>
          <ExamplesDropdown variant="mobile" />
        </TestWrapper>
      )

      // Open the dropdown
      const dropdownButton = screen.getByText('Quick Examples')
      fireEvent.click(dropdownButton)

      // Click on the example
      const exampleButton = screen.getByText('Test Example')
      fireEvent.click(exampleButton)

      // Should not show confirmation dialog
      expect(mockConfirm).not.toHaveBeenCalled()

      // Should call the example create function
      expect(mockExample.create).toHaveBeenCalled()
    })

    it('should show confirmation dialog when project is modified and user confirms', async () => {
      // Add a node to modify the project
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      expect(rootStore.isProjectModified).toBe(true)

      mockConfirm.mockReturnValue(true)

      render(
        <TestWrapper store={store}>
          <ExamplesDropdown variant="mobile" />
        </TestWrapper>
      )

      // Open the dropdown
      const dropdownButton = screen.getByText('Quick Examples')
      fireEvent.click(dropdownButton)

      // Click on the example
      const exampleButton = screen.getByText('Test Example')
      fireEvent.click(exampleButton)

      // Should show confirmation dialog
      expect(mockConfirm).toHaveBeenCalledWith(
        'You will lose your changes. Are you sure you want to load this example?'
      )

      // Should call the example create function since user confirmed
      expect(mockExample.create).toHaveBeenCalled()
    })

    it('should not load example when project is modified and user cancels', async () => {
      // Add a node to modify the project
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      expect(rootStore.isProjectModified).toBe(true)

      mockConfirm.mockReturnValue(false) // User cancels

      render(
        <TestWrapper store={store}>
          <ExamplesDropdown variant="mobile" />
        </TestWrapper>
      )

      // Open the dropdown
      const dropdownButton = screen.getByText('Quick Examples')
      fireEvent.click(dropdownButton)

      // Click on the example
      const exampleButton = screen.getByText('Test Example')
      fireEvent.click(exampleButton)

      // Should show confirmation dialog
      expect(mockConfirm).toHaveBeenCalledWith(
        'You will lose your changes. Are you sure you want to load this example?'
      )

      // Should NOT call the example create function since user cancelled
      expect(mockExample.create).not.toHaveBeenCalled()
    })
  })

  describe('Callback functions', () => {
    it('should call onExampleSelect callback after successful example selection', async () => {
      const onExampleSelectMock = vi.fn()

      render(
        <TestWrapper store={store}>
          <ExamplesDropdown variant="desktop" onExampleSelect={onExampleSelectMock} />
        </TestWrapper>
      )

      // Open the dropdown
      const dropdownButton = screen.getByText('Quick Examples')
      fireEvent.click(dropdownButton)

      // Click on the example
      const exampleButton = screen.getByText('Test Example')
      fireEvent.click(exampleButton)

      // Wait for the async example.create() to complete
      await waitFor(() => {
        expect(mockExample.create).toHaveBeenCalled()
      })

      // Should call the callback with the example after creation completes
      await waitFor(() => {
        expect(onExampleSelectMock).toHaveBeenCalledWith(mockExample)
      })
    })

    it('should call onClose callback when closing dropdown', async () => {
      const onCloseMock = vi.fn()

      render(
        <TestWrapper store={store}>
          <ExamplesDropdown variant="desktop" onClose={onCloseMock} />
        </TestWrapper>
      )

      // Open the dropdown
      const dropdownButton = screen.getByText('Quick Examples')
      fireEvent.click(dropdownButton)

      // Click on the example (which should close the dropdown)
      const exampleButton = screen.getByText('Test Example')
      fireEvent.click(exampleButton)

      // Should call the onClose callback
      await waitFor(() => {
        expect(onCloseMock).toHaveBeenCalled()
      })
    })

    it('should not call callbacks when user cancels confirmation', async () => {
      const onExampleSelectMock = vi.fn()
      const onCloseMock = vi.fn()

      // Add a node to modify the project
      store.addAdaptedNode('OscillatorNode', { x: 100, y: 100 })
      mockConfirm.mockReturnValue(false) // User cancels

      render(
        <TestWrapper store={store}>
          <ExamplesDropdown
            variant="desktop"
            onExampleSelect={onExampleSelectMock}
            onClose={onCloseMock}
          />
        </TestWrapper>
      )

      // Open the dropdown
      const dropdownButton = screen.getByText('Quick Examples')
      fireEvent.click(dropdownButton)

      // Click on the example
      const exampleButton = screen.getByText('Test Example')
      fireEvent.click(exampleButton)

      // Should show confirmation dialog
      expect(mockConfirm).toHaveBeenCalled()

      // Should NOT call any callbacks since user cancelled
      expect(onExampleSelectMock).not.toHaveBeenCalled()
      expect(onCloseMock).not.toHaveBeenCalled()
      expect(mockExample.create).not.toHaveBeenCalled()
    })
  })
})
