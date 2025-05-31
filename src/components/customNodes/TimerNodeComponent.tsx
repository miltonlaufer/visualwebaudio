import React, { useCallback, useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

interface TimerNodeComponentProps {
  nodeId: string
}

const TimerNodeComponent: React.FC<TimerNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)
  const audioStore = useAudioGraphStore()
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
  const enabled = (node.properties.get('enabled') || 'true') === 'true'

  // Check if audio context is active (not closed or suspended)
  const isAudioContextActive =
    audioStore.audioContext &&
    audioStore.audioContext.state !== 'closed' &&
    audioStore.audioContext.state !== 'suspended'

  const fireTrigger = useCallback(() => {
    const newCount = triggerCount + 1
    setTriggerCount(newCount)

    // Use MST action to update node outputs
    node.fireTimerTrigger(newCount)
  }, [node, triggerCount])

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
    if (isRunning || !enabled || !isAudioContextActive) {
      return
    }

    setIsRunning(true)
    console.log(`TimerNode ${nodeId}: Starting timer with ${delay}ms delay, mode: ${mode}`)

    // Start with initial delay
    const timeout = window.setTimeout(() => {
      // Check if audio context is still active before firing
      if (isAudioContextActive) {
        fireTrigger()

        // If loop mode, start interval
        if (mode === 'loop') {
          const intervalTimer = window.setInterval(() => {
            // Check if audio context is still active before each trigger
            if (isAudioContextActive) {
              fireTrigger()
            } else {
              // Stop the timer if audio context becomes inactive
              clearInterval(intervalTimer)
              setIsRunning(false)
              console.log(`TimerNode ${nodeId}: Stopped due to inactive audio context`)
            }
          }, interval)
          setIntervalId(intervalTimer)
        } else {
          // One-shot mode, stop after first trigger
          setIsRunning(false)
        }
      } else {
        // Audio context became inactive, stop the timer
        setIsRunning(false)
        console.log(`TimerNode ${nodeId}: Stopped due to inactive audio context`)
      }
    }, delay)

    setTimeoutId(timeout)
  }, [isRunning, enabled, delay, mode, interval, fireTrigger, nodeId, isAudioContextActive])

  const resetTimer = useCallback(() => {
    stopTimer()
    setTriggerCount(0)
    // Use MST action to reset timer count
    node.resetTimerCount()
  }, [stopTimer, node])

  // Monitor audio context state and stop timer when audio is paused
  useEffect(() => {
    if (!isAudioContextActive && isRunning) {
      console.log(`TimerNode ${nodeId}: Audio context inactive, stopping timer`)
      stopTimer()
    }
  }, [isAudioContextActive, isRunning, stopTimer, nodeId])

  // Auto-start effect - only run once on mount if conditions are met
  useEffect(() => {
    if (startMode === 'auto' && enabled && !isRunning && isAudioContextActive) {
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
        if (enabled && isAudioContextActive) {
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
    } else if (enabled && !isRunning && startMode === 'auto' && isAudioContextActive) {
      startTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]) // Only watch enabled property

  // Handle audio context state changes
  useEffect(() => {
    if (isAudioContextActive && enabled && !isRunning && startMode === 'auto') {
      // Audio context became active, auto-start if configured
      startTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAudioContextActive]) // Only watch audio context state

  return (
    <div className="p-2 space-y-2 min-w-[200px]">
      {/* Status display */}
      <div className="text-xs">
        <span className="font-medium">Status: </span>
        <span className={`${isRunning ? 'text-green-600' : 'text-red-600'}`}>
          {isRunning ? 'Running' : 'Stopped'}
        </span>
        {!isAudioContextActive && <span className="text-orange-600 ml-2">(Audio Paused)</span>}
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
          disabled={isRunning || !isAudioContextActive}
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
