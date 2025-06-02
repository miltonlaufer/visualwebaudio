import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'

interface TimerNodeComponentProps {
  nodeId: string
}

const TimerNodeComponent: React.FC<TimerNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})

  // Prevent React Flow drag when interacting with buttons
  useEffect(() => {
    const buttons = Object.values(buttonRefs.current).filter(Boolean)

    const preventDefault = (e: Event) => {
      e.stopPropagation()
    }

    // Add capture-phase event listeners to intercept before React Flow
    buttons.forEach(button => {
      if (button) {
        button.addEventListener('pointerdown', preventDefault, { capture: true })
        button.addEventListener('mousedown', preventDefault, { capture: true })
        button.addEventListener('touchstart', preventDefault, { capture: true })
      }
    })

    return () => {
      buttons.forEach(button => {
        if (button) {
          button.removeEventListener('pointerdown', preventDefault, { capture: true })
          button.removeEventListener('mousedown', preventDefault, { capture: true })
          button.removeEventListener('touchstart', preventDefault, { capture: true })
        }
      })
    }
  }, [])

  // All hooks called first, now prepare data for rendering
  const isValidNode = node && node.nodeType === 'TimerNode'
  const mode = isValidNode ? node.properties.get('mode') || 'loop' : 'loop'
  const delay = isValidNode ? node.properties.get('delay') || 1000 : 1000
  const interval = isValidNode ? node.properties.get('interval') || 1000 : 1000
  const startMode = isValidNode ? node.properties.get('startMode') || 'auto' : 'auto'
  const triggerCount = isValidNode ? node.outputs.get('count') || 0 : 0
  const isRunning = isValidNode ? (node.properties.get('isRunning') || 'false') === 'true' : false

  const handleStart = () => {
    if (isValidNode) {
      node.startTimer()
    }
  }

  const handleStop = () => {
    if (isValidNode) {
      node.stopTimer()
    }
  }

  const handleReset = () => {
    if (isValidNode) {
      node.resetTimer()
    }
  }

  // Single return with conditional rendering - NO early returns
  return (
    <div className="p-2 space-y-2 min-w-[200px]">
      {!isValidNode ? (
        <div className="text-red-500 text-xs">TimerNode not found</div>
      ) : (
        <>
          {/* Status display */}
          <div className="text-xs">
            <span className="font-medium">Status: </span>
            <span className={`${isRunning ? 'text-green-600' : 'text-red-600'}`}>
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>

          {/* Count display */}
          <div className="text-xs">
            <span className="font-medium">Count: </span>
            <span className="text-blue-600 font-bold">{triggerCount}</span>
          </div>

          {/* Settings display */}
          <div className="text-xs text-gray-600 space-y-1">
            <div>Mode: {mode}</div>
            <div>Delay: {delay}ms</div>
            {mode === 'loop' && <div>Interval: {interval}ms</div>}
            <div>Start: {startMode}</div>
          </div>

          {/* Control buttons */}
          <div className="flex gap-1">
            <button
              ref={el => {
                buttonRefs.current.start = el
              }}
              onClick={handleStart}
              disabled={isRunning}
              className="px-2 py-1 text-xs bg-green-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Start
            </button>
            <button
              ref={el => {
                buttonRefs.current.stop = el
              }}
              onClick={handleStop}
              disabled={!isRunning}
              className="px-2 py-1 text-xs bg-red-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Stop
            </button>
            <button
              ref={el => {
                buttonRefs.current.reset = el
              }}
              onClick={handleReset}
              className="px-2 py-1 text-xs bg-gray-500 text-white rounded"
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  )
})

export default TimerNodeComponent
