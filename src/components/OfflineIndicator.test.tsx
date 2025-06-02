import React from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OfflineIndicator from './OfflineIndicator'

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
})

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to online state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })
  })

  afterEach(() => {
    // Clean up event listeners
    vi.clearAllMocks()
  })

  it('should not render when online', () => {
    render(<OfflineIndicator />)
    expect(screen.queryByText('Offline Mode')).not.toBeInTheDocument()
  })

  it('should render when offline', () => {
    // Set navigator to offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    })

    render(<OfflineIndicator />)
    expect(screen.getByText('Offline Mode')).toBeInTheDocument()
  })

  it('should show indicator when going offline', () => {
    render(<OfflineIndicator />)

    // Initially online, should not show
    expect(screen.queryByText('Offline Mode')).not.toBeInTheDocument()

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    })
    fireEvent(window, new Event('offline'))

    expect(screen.getByText('Offline Mode')).toBeInTheDocument()
  })

  it('should hide indicator when going online', () => {
    // Start offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    })

    render(<OfflineIndicator />)
    expect(screen.getByText('Offline Mode')).toBeInTheDocument()

    // Simulate going online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })
    fireEvent(window, new Event('online'))

    expect(screen.queryByText('Offline Mode')).not.toBeInTheDocument()
  })

  it('should have correct styling and icon', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    })

    render(<OfflineIndicator />)

    const indicator = screen.getByText('Offline Mode').closest('div')
    expect(indicator).toHaveClass('bg-orange-500', 'text-white', 'rounded-lg')

    // Check for the presence of the icon (SignalSlashIcon)
    const svg = indicator?.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
