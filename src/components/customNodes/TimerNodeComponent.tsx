import React, { useCallback, useEffect, useState, useRef } from 'react'
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
  const timeoutRef = useRef<number | undefined>(undefined)
  const intervalRef = useRef<number | undefined>(undefined)
  const isStoppedRef = useRef(false) // Flag to prevent any further triggers
  const countRef = useRef(0) // Keep track of count to avoid stale closure issues

  // Early return check BEFORE any other hooks
  if (!node || node.nodeType !== 'TimerNode') {
    return <div className="text-red-500 text-xs">TimerNode not found</div>
  }

  const mode = node.properties.get('mode') || 'loop'
  const delay = node.properties.get('delay') || 1000
  const interval = node.properties.get('interval') || 1000
  const startMode = node.properties.get('startMode') || 'auto'
  const enabled = (node.properties.get('enabled') || 'true') === 'true'

  // Function to check if audio context is active (called dynamically)
  const getIsAudioContextActive = useCallback(() => {
    return (
      audioStore.audioContext &&
      audioStore.audioContext.state !== 'closed' &&
      audioStore.audioContext.state !== 'suspended'
    )
  }, [audioStore.audioContext])

  const fireTrigger = useCallback(() => {
    // Check if timer has been stopped
    if (isStoppedRef.current) {
      console.log(`TimerNode ${nodeId}: Trigger blocked - timer is stopped`)
      return
    }

    // Increment count using ref to avoid stale closure
    countRef.current += 1
    const newCount = countRef.current

    // Update React state
    setTriggerCount(newCount)

    // Use MST action to update node outputs
    node.fireTimerTrigger(newCount)
    console.log(`TimerNode ${nodeId}: Trigger fired (count: ${newCount})`)
  }, [node, nodeId])

  const stopTimer = useCallback(() => {
    console.log(`TimerNode ${nodeId}: Stopping timer`)

    // Set the stopped flag immediately to prevent any further triggers
    isStoppedRef.current = true

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = undefined
    }

    setIsRunning(false)
  }, [nodeId])

  const startTimer = useCallback(() => {
    if (isRunning || !enabled) {
      return
    }

    // Check audio context state at start time
    if (!getIsAudioContextActive()) {
      console.log(`TimerNode ${nodeId}: Cannot start - audio context inactive`)
      return
    }

    // ALWAYS clear any existing timers first, even if we think there aren't any
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = undefined
    }

    // Clear the stopped flag when starting
    isStoppedRef.current = false
    // Sync countRef with current triggerCount state
    countRef.current = triggerCount
    setIsRunning(true)
    console.log(`TimerNode ${nodeId}: Starting timer with ${delay}ms delay, mode: ${mode}`)

    // Start with initial delay
    timeoutRef.current = window.setTimeout(() => {
      // Double-check if timer is still supposed to be running
      if (isStoppedRef.current) {
        console.log(`TimerNode ${nodeId}: Timeout cancelled - timer was stopped`)
        return
      }

      // Check if audio context is still active before firing
      if (getIsAudioContextActive()) {
        fireTrigger()

        // If loop mode, start interval
        if (mode === 'loop' && !isStoppedRef.current) {
          intervalRef.current = window.setInterval(() => {
            // Check if timer is still supposed to be running
            if (isStoppedRef.current) {
              console.log(`TimerNode ${nodeId}: Interval cancelled - timer was stopped`)
              if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = undefined
              }
              return
            }

            // Check if audio context is still active before each trigger
            if (getIsAudioContextActive()) {
              fireTrigger()
            } else {
              // Stop the timer if audio context becomes inactive
              console.log(`TimerNode ${nodeId}: Stopped due to inactive audio context`)
              stopTimer()
            }
          }, interval)
        } else {
          // One-shot mode, stop after first trigger
          setIsRunning(false)
          isStoppedRef.current = true
        }
      } else {
        // Audio context became inactive, stop the timer
        console.log(`TimerNode ${nodeId}: Stopped due to inactive audio context`)
        setIsRunning(false)
        isStoppedRef.current = true
      }
    }, delay)
  }, [
    isRunning,
    enabled,
    delay,
    mode,
    interval,
    fireTrigger,
    nodeId,
    getIsAudioContextActive,
    stopTimer,
    triggerCount,
  ])

  const resetTimer = useCallback(() => {
    stopTimer()
    countRef.current = 0
    setTriggerCount(0)
    // Use MST action to reset timer count
    node.resetTimerCount()
  }, [stopTimer, node])

  // Monitor audio context state and stop timer when audio is paused
  useEffect(() => {
    const audioContext = audioStore.audioContext
    const isActive =
      audioContext && audioContext.state !== 'closed' && audioContext.state !== 'suspended'

    if (!isActive && isRunning) {
      console.log(`TimerNode ${nodeId}: Audio context inactive, stopping timer`)
      stopTimer()
    }
  }, [audioStore.audioContext?.state, isRunning, stopTimer, nodeId])

  // Auto-start effect - only run once on mount if conditions are met
  useEffect(() => {
    if (startMode === 'auto' && enabled && !isRunning && getIsAudioContextActive()) {
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
      const wasRunning = isRunning
      stopTimer()
      if (wasRunning && enabled && getIsAudioContextActive()) {
        // Restart immediately since we were running before
        startTimer()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, delay, interval]) // Only watch timing properties

  // Handle enabled state changes
  useEffect(() => {
    if (!enabled && isRunning) {
      stopTimer()
    } else if (enabled && !isRunning && startMode === 'auto' && getIsAudioContextActive()) {
      startTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, audioStore.audioContext]) // Watch enabled property and audio context

  // Handle audio context state changes for auto-restart
  useEffect(() => {
    const audioContext = audioStore.audioContext
    const isActive =
      audioContext && audioContext.state !== 'closed' && audioContext.state !== 'suspended'

    if (isActive && enabled && !isRunning && startMode === 'auto') {
      // Audio context became active, auto-start if configured
      startTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioStore.audioContext, audioStore.audioContext?.state]) // Watch audio context and its state changes

  const isAudioContextActive = getIsAudioContextActive()

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
