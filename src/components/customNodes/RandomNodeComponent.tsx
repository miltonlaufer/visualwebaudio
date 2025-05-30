import React, { useRef, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'

interface RandomNodeComponentProps {
  nodeId: string
}

const RandomNodeComponent: React.FC<RandomNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)

  // Early return check BEFORE any other hooks
  if (!node || node.nodeType !== 'RandomNode') {
    return <div className="text-red-500 text-xs">RandomNode not found</div>
  }

  // Now we can safely call all hooks knowing the component will render normally
  const sliderRef = useRef<HTMLInputElement>(null)

  const currentValue = node.outputs.get('value') || 0
  const rate = node.properties.get('rate') || 1
  const min = node.properties.get('min') || 0
  const max = node.properties.get('max') || 100

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value)
    console.log(`🎲 RandomNode ${nodeId}: Rate changed to ${newRate}`)
    node.setProperty('rate', newRate)
  }

  // Prevent React Flow drag when interacting with slider
  useEffect(() => {
    const slider = sliderRef.current
    if (!slider) return

    const preventDefault = (e: Event) => {
      e.stopPropagation()
    }

    // Add capture-phase event listeners to intercept before React Flow
    slider.addEventListener('pointerdown', preventDefault, { capture: true })
    slider.addEventListener('mousedown', preventDefault, { capture: true })
    slider.addEventListener('touchstart', preventDefault, { capture: true })

    return () => {
      slider.removeEventListener('pointerdown', preventDefault, { capture: true })
      slider.removeEventListener('mousedown', preventDefault, { capture: true })
      slider.removeEventListener('touchstart', preventDefault, { capture: true })
    }
  }, [])

  return (
    <div className="p-2 space-y-2 min-w-32">
      <div className="text-xs font-medium text-gray-700">Random</div>

      <div className="text-center">
        <div className="text-lg font-mono bg-yellow-50 px-2 py-1 rounded border">
          {currentValue.toFixed(2)}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-xs text-gray-600">Rate: {rate}s</div>
        <input
          ref={sliderRef}
          type="range"
          min={0.1}
          max={5}
          step={0.1}
          value={rate}
          onChange={handleRateChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      <div className="text-xs text-gray-500 text-center">
        Range: {min} - {max}
      </div>
    </div>
  )
})

export default RandomNodeComponent
