import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

interface SliderNodeComponentProps {
  nodeId: string
}

const SliderNodeComponent: React.FC<SliderNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const store = useAudioGraphStore()
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

  // NOW we can safely do early returns - hooks are already called
  if (!node || node.nodeType !== 'SliderNode') {
    return <div className="text-red-500 text-xs">SliderNode not found</div>
  }

  const currentValue = node.properties.get('value') || 50
  const min = node.properties.get('min') || 0
  const max = node.properties.get('max') || 100
  const step = node.properties.get('step') || 1

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    console.log(`🎚️ SliderNode ${nodeId}: Value changed to ${newValue}`)

    // Update both stores to keep them in sync
    // 1. Update the CustomNodeStore (for reactive connections)
    node.setProperty('value', newValue)

    // 2. Update the AudioGraphStore (for the visual properties panel)
    store.updateNodeProperty(nodeId, 'value', newValue)
  }

  return (
    <div className="p-2 space-y-2">
      <div className="text-xs font-medium text-gray-700">Slider</div>
      <div className="space-y-1">
        <input
          ref={sliderRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="text-xs text-gray-500 text-center">{currentValue}</div>
      </div>
    </div>
  )
})

export default SliderNodeComponent
