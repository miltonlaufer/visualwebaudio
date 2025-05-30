import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'

interface ButtonNodeComponentProps {
  nodeId: string
}

const ButtonNodeComponent: React.FC<ButtonNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)

  // Early return check BEFORE any other hooks
  if (!node || node.nodeType !== 'ButtonNode') {
    return <div className="text-red-500 text-xs">ButtonNode not found</div>
  }

  // Now we can safely call all hooks knowing the component will render normally
  const buttonRef = useRef<HTMLButtonElement>(null)

  const label = node.properties.get('label') || 'Button'

  const handleClick = () => {
    console.log(`🔘 ButtonNode ${nodeId}: Triggered`)
    node.trigger()
  }

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

  return (
    <div className="p-2">
      <button
        ref={buttonRef}
        onClick={handleClick}
        className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
      >
        {label}
      </button>
    </div>
  )
})

export default ButtonNodeComponent
