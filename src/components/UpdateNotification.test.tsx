import React from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import UpdateNotification from './UpdateNotification'

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
  waiting: {
    postMessage: vi.fn(),
  },
}

// Mock navigator.serviceWorker
Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true,
  configurable: true,
})

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    reload: vi.fn(),
  },
  writable: true,
})

describe('UpdateNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServiceWorker.getRegistration.mockResolvedValue(mockRegistration)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should not render initially', () => {
    render(<UpdateNotification />)
    expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
  })

  it('should render when update message is received', async () => {
    render(<UpdateNotification />)

    // Simulate receiving an update message
    const messageHandler = mockServiceWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]

    expect(messageHandler).toBeDefined()

    // Trigger the message handler with act
    await act(async () => {
      messageHandler({
        data: {
          type: 'UPDATE_AVAILABLE',
          message: 'A new version is available!',
        },
      })
    })

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

    // Simulate receiving an update message
    const messageHandler = mockServiceWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]

    await act(async () => {
      messageHandler({
        data: {
          type: 'UPDATE_AVAILABLE',
          message: 'A new version is available!',
        },
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument()
    })

    // Click close button
    const closeButton = screen.getByLabelText('Close notification')
    await act(async () => {
      fireEvent.click(closeButton)
    })

    await waitFor(() => {
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })

    expect(onClose).toHaveBeenCalled()
  })

  it('should close when "Later" button is clicked', async () => {
    render(<UpdateNotification />)

    // Simulate receiving an update message
    const messageHandler = mockServiceWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]

    await act(async () => {
      messageHandler({
        data: {
          type: 'UPDATE_AVAILABLE',
          message: 'A new version is available!',
        },
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument()
    })

    // Click "Later" button
    const laterButton = screen.getByText('Later')
    await act(async () => {
      fireEvent.click(laterButton)
    })

    await waitFor(() => {
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })
  })

  it('should handle update when "Update Now" button is clicked', async () => {
    render(<UpdateNotification />)

    // Simulate receiving an update message
    const messageHandler = mockServiceWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1]

    await act(async () => {
      messageHandler({
        data: {
          type: 'UPDATE_AVAILABLE',
          message: 'A new version is available!',
        },
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Update Available')).toBeInTheDocument()
    })

    // Click "Update Now" button
    const updateButton = screen.getByText('Update Now')
    await act(async () => {
      fireEvent.click(updateButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument()
    })

    // Should call postMessage on waiting service worker
    expect(mockRegistration.waiting.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    })
  })

  it('should send check for updates message on mount', async () => {
    render(<UpdateNotification />)

    // Wait for the async effect to complete
    await waitFor(() => {
      expect(mockServiceWorker.getRegistration).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockRegistration.active.postMessage).toHaveBeenCalledWith({
        type: 'CHECK_FOR_UPDATES',
      })
    })
  })

  it('should handle service worker not supported', () => {
    // Temporarily remove service worker support
    const originalServiceWorker = navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    expect(() => {
      render(<UpdateNotification />)
    }).not.toThrow()

    // Restore service worker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      writable: true,
      configurable: true,
    })
  })
})
