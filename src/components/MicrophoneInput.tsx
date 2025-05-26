import React, { useState, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

const MicrophoneInput: React.FC = observer(() => {
  const store = useAudioGraphStore()
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [micNodeId, setMicNodeId] = useState<string | null>(null)

  const startMicrophone = useCallback(async () => {
    try {
      setError(null)

      // Use the store action to add microphone input
      const nodeId = await store.addMicrophoneInput({ x: 50, y: 100 })

      setMicNodeId(nodeId)
      setIsRecording(true)

      console.log('Microphone input started successfully')
    } catch (err) {
      console.error('Error accessing microphone:', err)
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone access and try again.')
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.')
        } else {
          setError(`Error accessing microphone: ${err.message}`)
        }
      } else {
        setError('Unknown error accessing microphone')
      }
    }
  }, [store])

  const stopMicrophone = useCallback(() => {
    if (micNodeId) {
      // Remove the microphone node
      store.removeNode(micNodeId)
      setMicNodeId(null)
    }

    setIsRecording(false)
    setError(null)

    console.log('Microphone input stopped')
  }, [store, micNodeId])

  return (
    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="text-sm font-medium text-blue-800 mb-3 flex items-center">
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        Microphone Input
      </h3>

      {error && (
        <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-xs">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-blue-600">
          {isRecording ? (
            <span className="flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
              Recording from microphone
            </span>
          ) : (
            'Click to start microphone input'
          )}
        </div>

        <button
          onClick={isRecording ? stopMicrophone : startMicrophone}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            isRecording
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isRecording ? 'Stop' : 'Start'} Mic
        </button>
      </div>

      {isRecording && (
        <div className="mt-2 text-xs text-blue-600">
          Connect the microphone output to other audio nodes to process the live audio.
        </div>
      )}
    </div>
  )
})

export default MicrophoneInput
