import React, { useRef, useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'

interface RandomNodeComponentProps {
  nodeId: string
}

const RandomNodeComponent: React.FC<RandomNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)
  const [currentValue] = useState<number>(0)
  const sliderRef = useRef<HTMLInputElement>(null)

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

  // All hooks called first, now prepare data for rendering
  const isValidNode = node && node.nodeType === 'RandomNode'
  const rate = isValidNode ? (node.properties.get('rate') ?? 1) : 1
  const min = isValidNode ? (node.properties.get('min') ?? 0) : 0
  const max = isValidNode ? (node.properties.get('max') ?? 100) : 100
  const label = isValidNode ? (node.properties.get('label') ?? 'Random') : 'Random'

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isValidNode) {
      const newRate = parseFloat(e.target.value)
      node.setProperty('rate', newRate)
    }
  }

  // Single return with conditional rendering - NO early returns
  return (
    <div className="p-2 space-y-2">
      {!isValidNode ? (
        <div className="text-red-500 text-xs">RandomNode not found</div>
      ) : (
        <>
          <div className="text-xs font-medium text-gray-700">{label}</div>
          <div className="text-xs text-gray-500">Value: {currentValue.toFixed(2)}</div>
          <div className="space-y-1">
            <label className="text-xs text-gray-600">Rate (Hz)</label>
            <input
              ref={sliderRef}
              type="range"
              min={0.1}
              max={10}
              step={0.1}
              value={rate}
              onChange={handleRateChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="text-xs text-gray-500 text-center">{rate}</div>
          </div>
          <div className="text-xs text-gray-600">
            Range: {min} - {max}
          </div>
        </>
      )}
    </div>
  )
})

export default RandomNodeComponent
