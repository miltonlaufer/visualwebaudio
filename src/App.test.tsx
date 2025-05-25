import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the main title', () => {
    render(<App />)

    expect(screen.getByText('Visual Web Audio')).toBeInTheDocument()
  })

  it('renders the application layout', () => {
    const { container } = render(<App />)

    // Check for main layout elements
    expect(container.querySelector('.h-screen.flex')).toBeTruthy()
    expect(container.querySelector('.w-64.bg-white')).toBeTruthy() // Node palette
    expect(container.querySelector('.flex-1')).toBeTruthy() // Main content area
  })

  it('renders node palette with categories', () => {
    const { container } = render(<App />)

    // Check for node palette content
    expect(container).toHaveTextContent('Audio Nodes')
    expect(container).toHaveTextContent('source')
    expect(container).toHaveTextContent('effect')
    expect(container).toHaveTextContent('destination')
  })

  it('renders toolbar with controls', () => {
    const { container } = render(<App />)

    // Check for toolbar elements
    expect(container).toHaveTextContent('Play')
    expect(container.querySelector('button[title*="Undo"]')).toBeTruthy()
    expect(container.querySelector('button[title*="Redo"]')).toBeTruthy()
  })
})
