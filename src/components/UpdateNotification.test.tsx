import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UpdateNotification from './UpdateNotification'
import type { MockedFunction } from 'vitest'

// Mock service worker
const mockServiceWorker = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  getRegistration: vi.fn(),
}

const mockRegistration = {
  active: {
    postMessage: vi.fn(),
  },
  waiting: null, // Set to null initially to avoid automatic update notification
  addEventListener: vi.fn(),
  update: vi.fn(),
}

// Mock navigator.serviceWorker
Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true,
  configurable: true,
})

// Mock window.addEventListener for vite:pwa-update events
const originalAddEventListener = window.addEventListener
const originalRemoveEventListener = window.removeEventListener

describe('UpdateNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRegistration.waiting = null // Reset waiting state
    mockServiceWorker.getRegistration.mockResolvedValue(mockRegistration)

    // Mock window event listeners
    window.addEventListener = vi.fn()
    window.removeEventListener = vi.fn()
  })

  afterEach(() => {
    vi.clearAllTimers()
    // Restore original event listeners
    window.addEventListener = originalAddEventListener
    window.removeEventListener = originalRemoveEventListener
  })

  it('should not render initially', () => {
    render(<UpdateNotification />)
    expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
  })

  it('should render when vite:pwa-update event is received', async () => {
    render(<UpdateNotification />)

    // Get the event handler that was registered for 'vite:pwa-update'
    const vitePwaUpdateHandler = (
      window.addEventListener as MockedFunction<typeof window.addEventListener>
    ).mock.calls.find(
      (call: Parameters<typeof window.addEventListener>) => call[0] === 'vite:pwa-update'
    )?.[1] as EventListener

    expect(vitePwaUpdateHandler).toBeDefined()

    // Simulate the vite:pwa-update event
    if (vitePwaUpdateHandler && typeof vitePwaUpdateHandler === 'function') {
      vitePwaUpdateHandler({
        detail: {
          type: 'UPDATE_AVAILABLE',
          updateSW: vi.fn(),
        },
      } as CustomEvent)
    }

    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument()
      expect(
        screen.getByText('A new version of Visual Web Audio is available!')
      ).toBeInTheDocument()
    })
  })

  it('should close when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<UpdateNotification onClose={onClose} />)

    // Get the event handler and trigger update
    const vitePwaUpdateHandler = (
      window.addEventListener as MockedFunction<typeof window.addEventListener>
    ).mock.calls.find(
      (call: Parameters<typeof window.addEventListener>) => call[0] === 'vite:pwa-update'
    )?.[1] as EventListener

    if (vitePwaUpdateHandler && typeof vitePwaUpdateHandler === 'function') {
      vitePwaUpdateHandler({
        detail: {
          type: 'UPDATE_AVAILABLE',
          updateSW: vi.fn(),
        },
      } as CustomEvent)
    }

    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument()
    })

    // Click close button
    const closeButton = screen.getByLabelText('Close notification')
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })

    expect(onClose).toHaveBeenCalled()
  })

  it('should close when "Later" button is clicked', async () => {
    render(<UpdateNotification />)

    // Get the event handler and trigger update
    const vitePwaUpdateHandler = (
      window.addEventListener as MockedFunction<typeof window.addEventListener>
    ).mock.calls.find(
      (call: Parameters<typeof window.addEventListener>) => call[0] === 'vite:pwa-update'
    )?.[1] as EventListener

    if (vitePwaUpdateHandler && typeof vitePwaUpdateHandler === 'function') {
      vitePwaUpdateHandler({
        detail: {
          type: 'UPDATE_AVAILABLE',
          updateSW: vi.fn(),
        },
      } as CustomEvent)
    }

    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument()
    })

    // Click "Later" button
    const laterButton = screen.getByText('Later')
    fireEvent.click(laterButton)

    await waitFor(() => {
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })
  })

  it('should handle update when "Update Now" button is clicked', async () => {
    const mockUpdateSW = vi.fn().mockResolvedValue(undefined)
    render(<UpdateNotification />)

    // Get the event handler and trigger update
    const vitePwaUpdateHandler = (
      window.addEventListener as MockedFunction<typeof window.addEventListener>
    ).mock.calls.find(
      (call: Parameters<typeof window.addEventListener>) => call[0] === 'vite:pwa-update'
    )?.[1] as EventListener

    if (vitePwaUpdateHandler && typeof vitePwaUpdateHandler === 'function') {
      vitePwaUpdateHandler({
        detail: {
          type: 'UPDATE_AVAILABLE',
          updateSW: mockUpdateSW,
        },
      } as CustomEvent)
    }

    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument()
    })

    // Click "Update Now" button
    const updateButton = screen.getByText('Update Now')

    fireEvent.click(updateButton)

    // Wait for the updating state
    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument()
    })

    // Wait for the async update function to be called
    await waitFor(
      () => {
        expect(mockUpdateSW).toHaveBeenCalled()
      },
      { timeout: 2000 }
    )
  })

  it('should set up periodic update checks', async () => {
    render(<UpdateNotification />)

    // Wait for the component to mount and set up the service worker listener
    await waitFor(() => {
      expect(mockServiceWorker.getRegistration).toHaveBeenCalled()
    })

    // Verify that the component has set up the window event listener for PWA updates
    expect(window.addEventListener).toHaveBeenCalledWith('vite:pwa-update', expect.any(Function))
  })

  it('should handle service worker not supported', async () => {
    // Temporarily remove service worker support
    const originalServiceWorker = navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    render(<UpdateNotification />)

    // Component should handle missing service worker gracefully
    await waitFor(() => {
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })

    // Restore service worker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      writable: true,
      configurable: true,
    })
  })
})
