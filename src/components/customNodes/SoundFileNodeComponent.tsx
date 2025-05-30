import React, { useRef, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'

interface SoundFileNodeComponentProps {
  nodeId: string
}

const SoundFileNodeComponent: React.FC<SoundFileNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)

  // Early return check BEFORE any other hooks
  if (!node || node.nodeType !== 'SoundFileNode') {
    return <div className="text-red-500 text-xs">SoundFileNode not found</div>
  }

  // Now we can safely call all hooks knowing the component will render normally
  const fileInputRef = useRef<HTMLInputElement>(null)
  const playButtonRef = useRef<HTMLButtonElement>(null)

  const fileName = node.properties.get('fileName') || ''
  const loaded = node.outputs.get('loaded') || 0

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && node.loadAudioFile) {
      console.log(`🎵 SoundFileNode ${nodeId}: Loading file ${file.name}`)
      await node.loadAudioFile(file)
    }
  }

  const handlePlay = () => {
    console.log(`▶️ SoundFileNode ${nodeId}: Play button clicked`)
    node.trigger()
  }

  // Prevent React Flow drag when interacting with controls
  useEffect(() => {
    const fileInput = fileInputRef.current
    const playButton = playButtonRef.current

    const preventDefault = (e: Event) => {
      e.stopPropagation()
    }

    const elements = [fileInput, playButton].filter(Boolean) as HTMLElement[]

    elements.forEach(element => {
      // Don't prevent click events - we need those for button and input functionality
      element.addEventListener('pointerdown', preventDefault, { capture: true })
      element.addEventListener('mousedown', preventDefault, { capture: true })
      element.addEventListener('touchstart', preventDefault, { capture: true })
    })

    return () => {
      elements.forEach(element => {
        element.removeEventListener('pointerdown', preventDefault, { capture: true })
        element.removeEventListener('mousedown', preventDefault, { capture: true })
        element.removeEventListener('touchstart', preventDefault, { capture: true })
      })
    }
  }, [])

  return (
    <div className="p-2 space-y-2 min-w-48">
      <div className="text-xs font-medium text-gray-700">Sound File</div>

      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          className="text-xs w-full"
        />

        {fileName && (
          <div className="text-xs text-gray-600 truncate" title={fileName}>
            📁 {fileName}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            ref={playButtonRef}
            onClick={handlePlay}
            disabled={!loaded}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            ▶️ Play
          </button>

          <div
            className={`text-xs px-2 py-1 rounded ${loaded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
          >
            {loaded ? 'Loaded' : 'No file'}
          </div>
        </div>
      </div>
    </div>
  )
})

export default SoundFileNodeComponent
