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
      expect(screen.getByText('AI Assistant (mega alpha)')).toBeInTheDocument()
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

  it('should auto-focus input when chat opens and AI is initialized', async () => {
    // Mock the service as initialized
    const mockLangChainService = {
      isInitialized: vi.fn().mockReturnValue(true),
      initialize: vi.fn(),
      processMessage: vi.fn(),
      executeActions: vi.fn(),
    }

    // Mock the LangChainService constructor to return our mock
    const { LangChainService } = await import('~/services/LangChainService')
    vi.mocked(LangChainService).mockImplementation(() => mockLangChainService as any)

    const { getByTitle, getByPlaceholderText } = render(
      <TestWrapper>
        <AIChat />
      </TestWrapper>
    )

    // Initially chat is closed
    const openButton = getByTitle('Open AI Assistant')
    expect(openButton).toBeInTheDocument()

    // Mock the focus method
    const mockFocus = vi.fn()
    HTMLInputElement.prototype.focus = mockFocus

    // Open the chat
    fireEvent.click(openButton)

    // Wait for the input to be rendered and focused
    await waitFor(() => {
      const input = getByPlaceholderText('Ask me to create audio nodes...')
      expect(input).toBeInTheDocument()
      expect(input).not.toBeDisabled()
    })

    // Check that focus was called (with a small delay for the setTimeout)
    await waitFor(
      () => {
        expect(mockFocus).toHaveBeenCalled()
      },
      { timeout: 300 }
    )
  })
})
