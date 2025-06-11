import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAudioGraphStore } from '../stores/AudioGraphStore'
import { observer } from 'mobx-react-lite'
import type { AudioGraphStoreType } from '../stores/AudioGraphStore'
import { AudioGraphStoreContext } from '../stores/AudioGraphStore'

// Mock Web Audio API
const createMockAudioContext = () => ({
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 },
    type: 'sine',
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  })),
  createConstantSource: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    offset: { value: 0 },
  })),
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 1024,
    smoothingTimeConstant: 0.8,
    frequencyBinCount: 512,
    getByteFrequencyData: vi.fn(),
    getFloatFrequencyData: vi.fn(),
  })),
  destination: {
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
  state: 'running',
  sampleRate: 44100,
  resume: vi.fn().mockResolvedValue(undefined),
})

// Mock button component that shows current value and can be clicked
const TestButtonComponent = observer(
  ({ store, nodeId }: { store: AudioGraphStoreType; nodeId: string }) => {
    const node = store.adaptedNodes.find(n => n.id === nodeId)
    const customNode = store.customNodes.get(nodeId)

    if (!node || !customNode) return <div>Button not found</div>

    const currentValue = (customNode as any).getCurrentValue?.() || 0

    const handleClick = () => {
      ;(customNode as any).trigger?.()
    }

    return (
      <div>
        <button onClick={handleClick} data-testid={`button-${nodeId}`}>
          Click Button
        </button>
        <div data-testid={`button-value-${nodeId}`}>Value: {currentValue}</div>
      </div>
    )
  }
)

// Mock oscillator component that shows running state
const TestOscillatorComponent = observer(
  ({ store, nodeId }: { store: AudioGraphStoreType; nodeId: string }) => {
    const nodeState = store.getNodeState(nodeId)
    const isRunning = nodeState?.isRunning || false

    return (
      <div data-testid={`oscillator-${nodeId}`}>Status: {isRunning ? 'Running' : 'Stopped'}</div>
    )
  }
)

describe('Button-Trigger-Oscillator Integration', () => {
  let store: AudioGraphStoreType
  let mockAudioContext: any

  beforeEach(() => {
    // Mock Web Audio API
    mockAudioContext = createMockAudioContext()
    ;(global as any).AudioContext = vi.fn(() => mockAudioContext)
    ;(global as any).webkitAudioContext = vi.fn(() => mockAudioContext)

    // Create store and initialize
    store = createAudioGraphStore()
    store.initializeAudioContext()
  })

  const renderWithStore = (component: React.ReactElement) => {
    return render(
      <AudioGraphStoreContext.Provider value={store}>{component}</AudioGraphStoreContext.Provider>
    )
  }

  it('should create button and oscillator with correct initial states', async () => {
    // Create button node
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 100, y: 100 })

    // Create oscillator with autostart = false
    const oscId = store.addAdaptedNode('OscillatorNode', { x: 300, y: 100 })

    // Set oscillator autostart to false
    store.updateNodeProperty(oscId, 'autostart', false)

    // Render components
    renderWithStore(
      <div>
        <TestButtonComponent store={store} nodeId={buttonId} />
        <TestOscillatorComponent store={store} nodeId={oscId} />
      </div>
    )

    // Check initial states
    expect(screen.getByTestId(`button-${buttonId}`)).toBeInTheDocument()
    expect(screen.getByTestId(`oscillator-${oscId}`)).toHaveTextContent('Status: Stopped')

    // Button should have initial value (might be 0 or random)
    const buttonValue = screen.getByTestId(`button-value-${buttonId}`)
    expect(buttonValue).toBeInTheDocument()
  })

  it('should connect button to oscillator trigger without starting oscillator', async () => {
    // Create nodes
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 100, y: 100 })
    const oscId = store.addAdaptedNode('OscillatorNode', { x: 300, y: 100 })

    // Set oscillator autostart to false
    store.updateNodeProperty(oscId, 'autostart', false)

    // Connect button output to oscillator trigger
    store.addEdge(buttonId, oscId, 'trigger', 'trigger')

    // Render components
    renderWithStore(
      <div>
        <TestButtonComponent store={store} nodeId={buttonId} />
        <TestOscillatorComponent store={store} nodeId={oscId} />
      </div>
    )

    // Oscillator should still be stopped after connection
    expect(screen.getByTestId(`oscillator-${oscId}`)).toHaveTextContent('Status: Stopped')

    // Should have created the connection
    expect(store.audioConnections).toHaveLength(1)
    expect(store.audioConnections[0]).toMatchObject({
      sourceNodeId: buttonId,
      targetNodeId: oscId,
      targetInput: 'trigger',
    })
  })

  it('should start oscillator when button is clicked', async () => {
    // Create nodes
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 100, y: 100 })
    const oscId = store.addAdaptedNode('OscillatorNode', { x: 300, y: 100 })

    // Set oscillator autostart to false
    store.updateNodeProperty(oscId, 'autostart', false)

    // Connect button to oscillator trigger
    store.addEdge(buttonId, oscId, 'trigger', 'trigger')

    // Render components
    renderWithStore(
      <div>
        <TestButtonComponent store={store} nodeId={buttonId} />
        <TestOscillatorComponent store={store} nodeId={oscId} />
      </div>
    )

    // Initial state: oscillator stopped
    expect(screen.getByTestId(`oscillator-${oscId}`)).toHaveTextContent('Status: Stopped')

    // Click the button
    const button = screen.getByTestId(`button-${buttonId}`)
    fireEvent.click(button)

    // Wait for state update
    await waitFor(() => {
      expect(screen.getByTestId(`oscillator-${oscId}`)).toHaveTextContent('Status: Running')
    })
  })

  it('should handle multiple button clicks correctly', async () => {
    // Create nodes
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 100, y: 100 })
    const oscId = store.addAdaptedNode('OscillatorNode', { x: 300, y: 100 })

    // Set oscillator autostart to false
    store.updateNodeProperty(oscId, 'autostart', false)

    // Connect button to oscillator trigger
    store.addEdge(buttonId, oscId, 'trigger', 'trigger')

    // Render components
    renderWithStore(
      <div>
        <TestButtonComponent store={store} nodeId={buttonId} />
        <TestOscillatorComponent store={store} nodeId={oscId} />
      </div>
    )

    const button = screen.getByTestId(`button-${buttonId}`)
    const oscillator = screen.getByTestId(`oscillator-${oscId}`)

    // Initial state
    expect(oscillator).toHaveTextContent('Status: Stopped')

    // First click - should start
    fireEvent.click(button)
    await waitFor(() => {
      expect(oscillator).toHaveTextContent('Status: Running')
    })

    // Second click - should restart (stop and start again)
    fireEvent.click(button)
    await waitFor(() => {
      expect(oscillator).toHaveTextContent('Status: Running')
    })

    // Should have called start multiple times
    expect(mockAudioContext.createOscillator).toHaveBeenCalled()
  })

  it('should show reasonable button values (not random large numbers)', async () => {
    // Create button node
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 100, y: 100 })

    // Render component
    renderWithStore(<TestButtonComponent store={store} nodeId={buttonId} />)

    const buttonValue = screen.getByTestId(`button-value-${buttonId}`)
    const valueText = buttonValue.textContent || ''
    const value = parseFloat(valueText.replace('Value: ', ''))

    // Button value should be reasonable (0 or 1, not a huge random number)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(1)
  })

  it('should update button value when clicked', async () => {
    // Create button node
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 100, y: 100 })

    // Render component
    renderWithStore(<TestButtonComponent store={store} nodeId={buttonId} />)

    const button = screen.getByTestId(`button-${buttonId}`)
    const buttonValue = screen.getByTestId(`button-value-${buttonId}`)

    const initialValue = buttonValue.textContent

    // Click button
    fireEvent.click(button)

    // Value should change
    await waitFor(() => {
      const newValue = buttonValue.textContent
      expect(newValue).not.toBe(initialValue)
    })
  })
})
