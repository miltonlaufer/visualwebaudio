import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'

interface ButtonNodeComponentProps {
  nodeId: string
}

const ButtonNodeComponent: React.FC<ButtonNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Prevent React Flow drag when clicking button
  useEffect(() => {
    const button = buttonRef.current
    if (!button) return

    const preventDefault = (e: Event) => {
      e.stopPropagation()
    }

    // Add capture-phase event listeners to intercept before React Flow
    // Don't prevent click events - we need those for the button functionality
    button.addEventListener('pointerdown', preventDefault, { capture: true })
    button.addEventListener('mousedown', preventDefault, { capture: true })
    button.addEventListener('touchstart', preventDefault, { capture: true })

    return () => {
      button.removeEventListener('pointerdown', preventDefault, { capture: true })
      button.removeEventListener('mousedown', preventDefault, { capture: true })
      button.removeEventListener('touchstart', preventDefault, { capture: true })
    }
  }, [])

  // All hooks called first, now prepare data for rendering
  const isValidNode = node && node.nodeType === 'ButtonNode'
  const label = isValidNode ? node.properties.get('label') || 'Button' : ''

  const handleClick = () => {
    if (isValidNode) {
      node.trigger()
    }
  }

  // Single return with conditional rendering - NO early returns
  return (
    <div className="p-2">
      {!isValidNode ? (
        <div className="text-red-500 text-xs">ButtonNode not found</div>
      ) : (
        <button
          ref={buttonRef}
          onClick={handleClick}
          className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
        >
          {label}
        </button>
      )}
    </div>
  )
})

export default ButtonNodeComponent
