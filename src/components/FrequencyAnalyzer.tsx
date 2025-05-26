import React, { useEffect, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'

const FrequencyAnalyzer: React.FC = observer(() => {
  const store = useAudioGraphStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    // Check if audio is playing and there are connections to destination
    const destinationConnections = store.audioConnections.filter(conn => {
      const targetNode = store.visualNodes.find(node => node.id === conn.targetNodeId)
      return targetNode?.data.nodeType === 'AudioDestinationNode'
    })

    const hasActiveAudio =
      store.isPlaying && destinationConnections.length > 0 && store.frequencyAnalyzer

    if (hasActiveAudio) {
      console.log('Frequency analyzer is active - audio flowing through destination')
      setIsActive(true)
    } else {
      console.log('Frequency analyzer inactive - no audio to destination')
      setIsActive(false)
    }
  }, [store.audioConnections, store.visualNodes, store.isPlaying, store.frequencyAnalyzer])

  // Animation loop for drawing the frequency bars
  useEffect(() => {
    const canvas = canvasRef.current
    const analyzer = store.frequencyAnalyzer

    if (!canvas || !analyzer) return

    const canvasCtx = canvas.getContext('2d')
    if (!canvasCtx) return

    const bufferLength = analyzer.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    // Calculate frequency resolution
    const sampleRate = store.audioContext?.sampleRate || 44100
    const nyquistFreq = sampleRate / 2
    const freqPerBin = nyquistFreq / bufferLength

    const draw = () => {
      // Get frequency data
      analyzer.getByteFrequencyData(dataArray)

      // Clear canvas
      canvasCtx.fillStyle = 'rgb(0, 0, 0)'
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height)

      // Check if we have any meaningful audio data
      const maxValue = Math.max(...dataArray)
      const avgValue = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length
      const hasAudio = maxValue > 5 || avgValue > 1 // More sensitive detection

      if (hasAudio && isActive) {
        // Calculate bar width to fit all frequency bins
        const barWidth = canvas.width / bufferLength
        let x = 0

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * (canvas.height - 20) // Leave space for labels

          if (barHeight > 1) {
            // Only draw bars with meaningful height
            // Create gradient for bars with frequency-based colors
            const gradient = canvasCtx.createLinearGradient(
              0,
              canvas.height - 20 - barHeight,
              0,
              canvas.height - 20
            )

            // Color based on frequency: low = red, mid = green, high = blue
            const freqRatio = i / bufferLength
            let hue
            if (freqRatio < 0.33) {
              hue = 0 // Red for low frequencies
            } else if (freqRatio < 0.66) {
              hue = 120 // Green for mid frequencies
            } else {
              hue = 240 // Blue for high frequencies
            }

            gradient.addColorStop(0, `hsl(${hue}, 100%, 60%)`)
            gradient.addColorStop(1, `hsl(${hue}, 100%, 40%)`)

            canvasCtx.fillStyle = gradient
            canvasCtx.fillRect(x, canvas.height - 20 - barHeight, barWidth, barHeight)
          }

          x += barWidth
        }

        // Draw frequency labels
        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        canvasCtx.font = '9px monospace'
        canvasCtx.textAlign = 'center'

        // Draw labels at key frequencies
        const labelFreqs = [100, 500, 1000, 2000, 5000, 10000, 15000, 20000]
        labelFreqs.forEach(freq => {
          if (freq <= nyquistFreq) {
            const binIndex = Math.round(freq / freqPerBin)
            const xPos = (binIndex / bufferLength) * canvas.width

            if (xPos >= 0 && xPos <= canvas.width) {
              canvasCtx.fillText(
                freq >= 1000 ? `${freq / 1000}k` : `${freq}`,
                xPos,
                canvas.height - 5
              )
            }
          }
        })
      } else if (isActive) {
        // Show a subtle indication that we're monitoring but no audio
        canvasCtx.fillStyle = 'rgba(100, 100, 100, 0.3)'
        canvasCtx.fillRect(0, canvas.height - 22, canvas.width, 2)

        // Show some debug info
        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        canvasCtx.font = '10px monospace'
        canvasCtx.textAlign = 'left'
        canvasCtx.fillText(`Max: ${maxValue}, Avg: ${avgValue.toFixed(1)}`, 5, 15)
        canvasCtx.fillText(
          `Bins: ${bufferLength}, Nyquist: ${(nyquistFreq / 1000).toFixed(1)}kHz`,
          5,
          30
        )
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    // Start animation loop
    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isActive, store.frequencyAnalyzer, store.audioContext])

  return (
    <div className="p-4 bg-gray-50">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Frequency Analyzer</h3>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={280}
          height={120}
          className="w-full h-24 bg-black rounded border"
          style={{ imageRendering: 'pixelated' }}
        />
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded text-white text-xs text-center">
            {store.isPlaying ? 'No audio to destination' : 'Connect audio to destination and play'}
          </div>
        )}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Real-time frequency spectrum (20Hz - 22kHz) • {isActive ? 'Monitoring' : 'Inactive'} •{' '}
        {store.frequencyAnalyzer ? 'Analyzer ready' : 'No analyzer'}
      </div>
    </div>
  )
})

export default FrequencyAnalyzer
