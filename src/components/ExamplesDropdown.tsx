import React, { useState, useRef } from 'react'
import { useOnClickOutside } from 'usehooks-ts'
import { useExamples, type Example } from './Examples'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

interface ExamplesDropdownProps {
  variant: 'desktop' | 'mobile'
  onExampleSelect?: (example: Example) => void
  onClose?: () => void
  className?: string
}

const ExamplesDropdown: React.FC<ExamplesDropdownProps> = ({
  variant,
  onExampleSelect,
  onClose,
  className = '',
}) => {
  const { examples } = useExamples()
  const store = useAudioGraphStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Handle click outside for desktop variant
  useOnClickOutside(dropdownRef as React.RefObject<HTMLElement>, () => {
    if (isOpen && variant === 'desktop') {
      setIsOpen(false)
      onClose?.()
    }
  })

  const handleExampleSelect = async (example: Example) => {
    // Check if there are unsaved changes
    if (store.visualNodes.length > 0 && store.isProjectModified) {
      if (!confirm('You will lose your changes. Are you sure you want to load this example?')) {
        return
      }
    }

    await example.create()
    // Mark project as unmodified after loading example (examples are a fresh starting point)
    store.setProjectModified(false)
    setIsOpen(false)
    onExampleSelect?.(example)
    onClose?.()
  }

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
  }

  if (variant === 'desktop') {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          ref={buttonRef}
          onClick={toggleDropdown}
          className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Quick Examples
          <svg
            className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
            <div className="p-2">
              <div className="text-xs text-gray-500 px-3 py-2 font-medium uppercase tracking-wide">
                Audio Examples
              </div>
              {examples.map(example => (
                <button
                  key={example.id}
                  onClick={() => handleExampleSelect(example)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-md transition-colors group"
                >
                  <div className="font-medium text-gray-900 group-hover:text-green-600">
                    {example.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{example.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Mobile variant (for use within mobile menu)
  return (
    <div className={className}>
      <button
        onClick={toggleDropdown}
        className="w-full flex items-center justify-between px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
      >
        <div className="flex items-center">
          <svg
            className="w-4 h-4 mr-3 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Quick Examples
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-1 ml-7 space-y-1 max-h-48 overflow-y-auto">
          {examples.map(example => (
            <button
              key={example.id}
              onClick={() => handleExampleSelect(example)}
              className="w-full text-left px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors"
            >
              {example.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ExamplesDropdown
