import React, { useCallback, useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'

interface TimerNodeComponentProps {
  nodeId: string
}

const TimerNodeComponent: React.FC<TimerNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)
  const [isRunning, setIsRunning] = useState(false)
  const [triggerCount, setTriggerCount] = useState(0)
  const [timeoutId, setTimeoutId] = useState<number | undefined>()
  const [intervalId, setIntervalId] = useState<number | undefined>()

  // Early return check BEFORE any other hooks
  if (!node || node.nodeType !== 'TimerNode') {
    return <div className="text-red-500 text-xs">TimerNode not found</div>
  }

  const mode = node.properties.get('mode') || 'loop'
  const delay = node.properties.get('delay') || 1000
  const interval = node.properties.get('interval') || 1000
  const startMode = node.properties.get('startMode') || 'auto'
  const enabled = node.properties.get('enabled') !== false

  const fireTrigger = useCallback(() => {
    const newCount = triggerCount + 1
    setTriggerCount(newCount)

    // Update node outputs
    node.setOutput('trigger', 1)
    node.setOutput('count', newCount)
    node.setProperty('count', newCount)

    console.log(`TimerNode ${nodeId}: Trigger fired (count: ${newCount})`)

    // Reset trigger output after a brief moment
    setTimeout(() => {
      node.setOutput('trigger', 0)
    }, 10)
  }, [node, nodeId, triggerCount])

  const stopTimer = useCallback(() => {
    if (!isRunning) {
      return
    }

    console.log(`TimerNode ${nodeId}: Stopping timer`)

    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(undefined)
    }

    if (intervalId) {
      clearInterval(intervalId)
      setIntervalId(undefined)
    }

    setIsRunning(false)
  }, [isRunning, timeoutId, intervalId, nodeId])

  const startTimer = useCallback(() => {
    if (isRunning || !enabled) {
      return
    }

    setIsRunning(true)
    console.log(`TimerNode ${nodeId}: Starting timer with ${delay}ms delay, mode: ${mode}`)

    // Start with initial delay
    const timeout = window.setTimeout(() => {
      fireTrigger()

      // If loop mode, start interval
      if (mode === 'loop') {
        const intervalTimer = window.setInterval(() => {
          fireTrigger()
        }, interval)
        setIntervalId(intervalTimer)
      } else {
        // One-shot mode, stop after first trigger
        setIsRunning(false)
      }
    }, delay)

    setTimeoutId(timeout)
  }, [isRunning, enabled, delay, mode, interval, fireTrigger, nodeId])

  const resetTimer = useCallback(() => {
    stopTimer()
    setTriggerCount(0)
    node.setOutput('count', 0)
    node.setProperty('count', 0)
    console.log(`TimerNode ${nodeId}: Timer reset`)
  }, [stopTimer, node, nodeId])

  // Auto-start effect - only run once on mount if conditions are met
  useEffect(() => {
    if (startMode === 'auto' && enabled && !isRunning) {
      startTimer()
    }
    // Cleanup on unmount
    return () => {
      stopTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array - only run on mount/unmount

  // Handle property changes that should restart the timer
  useEffect(() => {
    if (isRunning && (mode || delay || interval)) {
      // If timer is running and timing properties change, restart
      stopTimer()
      // Use a small delay to ensure state is updated before restarting
      setTimeout(() => {
        if (enabled) {
          startTimer()
        }
      }, 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, delay, interval]) // Only watch timing properties

  // Handle enabled state changes
  useEffect(() => {
    if (!enabled && isRunning) {
      stopTimer()
    } else if (enabled && !isRunning && startMode === 'auto') {
      startTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]) // Only watch enabled property

  return (
    <div className="p-2 space-y-2 min-w-[200px]">
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
          onClick={startTimer}
          disabled={isRunning}
          className="px-2 py-1 text-xs bg-green-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Start
        </button>
        <button
          onClick={stopTimer}
          disabled={!isRunning}
          className="px-2 py-1 text-xs bg-red-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Stop
        </button>
        <button onClick={resetTimer} className="px-2 py-1 text-xs bg-gray-500 text-white rounded">
          Reset
        </button>
      </div>
    </div>
  )
})

export default TimerNodeComponent
