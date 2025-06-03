import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { observer } from 'mobx-react-lite'
import AIChat from './AIChat'
import { createAudioGraphStore, AudioGraphStoreContext } from '~/stores/AudioGraphStore'

// Mock the services
vi.mock('~/services/LangChainService', () => ({
  LangChainService: vi.fn().mockImplementation(() => ({
    isInitialized: vi.fn().mockReturnValue(false),
    initialize: vi.fn(),
    processMessage: vi.fn(),
    executeActions: vi.fn(),
  })),
}))

vi.mock('~/services/KeyStorageService', () => ({
  KeyStorageService: {
    hasKey: vi.fn().mockResolvedValue(false),
    storeKey: vi.fn().mockResolvedValue(undefined),
    retrieveKey: vi.fn().mockResolvedValue(null),
  },
}))

const TestWrapper: React.FC<{ children: React.ReactNode }> = observer(({ children }) => {
  const store = createAudioGraphStore()
  return <AudioGraphStoreContext.Provider value={store}>{children}</AudioGraphStoreContext.Provider>
})

describe('AIChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the chat button when closed', () => {
    render(
      <TestWrapper>
        <AIChat />
      </TestWrapper>
    )

    expect(screen.getByTitle('Open AI Assistant')).toBeInTheDocument()
  })

  it('opens the chat interface when button is clicked', async () => {
    render(
      <TestWrapper>
        <AIChat />
      </TestWrapper>
    )

    const chatButton = screen.getByTitle('Open AI Assistant')
    fireEvent.click(chatButton)

    await waitFor(() => {
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })
  })

  it('shows configuration prompt when not initialized', async () => {
    render(
      <TestWrapper>
        <AIChat />
      </TestWrapper>
    )

    const chatButton = screen.getByTitle('Open AI Assistant')
    fireEvent.click(chatButton)

    await waitFor(() => {
      expect(screen.getByText('Configure your AI assistant to get started')).toBeInTheDocument()
    })
  })

  it('opens settings modal when settings button is clicked', async () => {
    render(
      <TestWrapper>
        <AIChat />
      </TestWrapper>
    )

    const chatButton = screen.getByTitle('Open AI Assistant')
    fireEvent.click(chatButton)

    await waitFor(() => {
      const settingsButton = screen.getByTitle('Settings')
      fireEvent.click(settingsButton)
      expect(screen.getByText('AI Configuration')).toBeInTheDocument()
    })
  })

  it('shows storage type options in configuration', async () => {
    render(
      <TestWrapper>
        <AIChat />
      </TestWrapper>
    )

    const chatButton = screen.getByTitle('Open AI Assistant')
    fireEvent.click(chatButton)

    await waitFor(() => {
      const settingsButton = screen.getByTitle('Settings')
      fireEvent.click(settingsButton)
      expect(screen.getByText('Session only (cleared when browser closes)')).toBeInTheDocument()
      expect(screen.getByText('Encrypted permanent storage')).toBeInTheDocument()
    })
  })

  it('shows password field when encrypted storage is selected', async () => {
    render(
      <TestWrapper>
        <AIChat />
      </TestWrapper>
    )

    const chatButton = screen.getByTitle('Open AI Assistant')
    fireEvent.click(chatButton)

    await waitFor(() => {
      const settingsButton = screen.getByTitle('Settings')
      fireEvent.click(settingsButton)

      const encryptedRadio = screen.getByDisplayValue('encrypted')
      fireEvent.click(encryptedRadio)

      expect(
        screen.getByPlaceholderText('Enter a password to encrypt your API key')
      ).toBeInTheDocument()
    })
  })
})
