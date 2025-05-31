import React, { useRef, useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'

interface SoundFileNodeComponentProps {
  nodeId: string
}

const SoundFileNodeComponent: React.FC<SoundFileNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const fileInputRef = useRef<HTMLInputElement>(null)
  const playButtonRef = useRef<HTMLButtonElement>(null)

  // Prevent React Flow drag when clicking buttons
  useEffect(() => {
    const fileInput = fileInputRef.current
    const playButton = playButtonRef.current

    const preventDefault = (e: Event) => {
      e.stopPropagation()
    }

    // Add capture-phase event listeners to intercept before React Flow
    if (fileInput) {
      fileInput.addEventListener('pointerdown', preventDefault, { capture: true })
      fileInput.addEventListener('mousedown', preventDefault, { capture: true })
      fileInput.addEventListener('touchstart', preventDefault, { capture: true })
    }
    if (playButton) {
      playButton.addEventListener('pointerdown', preventDefault, { capture: true })
      playButton.addEventListener('mousedown', preventDefault, { capture: true })
      playButton.addEventListener('touchstart', preventDefault, { capture: true })
    }

    return () => {
      if (fileInput) {
        fileInput.removeEventListener('pointerdown', preventDefault, { capture: true })
        fileInput.removeEventListener('mousedown', preventDefault, { capture: true })
        fileInput.removeEventListener('touchstart', preventDefault, { capture: true })
      }
      if (playButton) {
        playButton.removeEventListener('pointerdown', preventDefault, { capture: true })
        playButton.removeEventListener('mousedown', preventDefault, { capture: true })
        playButton.removeEventListener('touchstart', preventDefault, { capture: true })
      }
    }
  }, [])

  // NOW we can safely do early returns - hooks are already called
  if (!node || node.nodeType !== 'SoundFileNode') {
    return <div className="text-red-500 text-xs">SoundFileNode not found</div>
  }

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
    console.log(`▶️ SoundFileNode ${nodeId}: Playing`)
    node.performSoundFileTrigger()
  }

  return (
    <div className="p-2 space-y-2">
      <div className="text-xs font-medium text-gray-700">Sound File</div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      {fileName && <div className="text-xs text-gray-600 truncate">{fileName}</div>}
      <div className="text-xs text-gray-500">Loaded: {loaded > 0 ? 'Yes' : 'No'}</div>
      <button
        ref={playButtonRef}
        onClick={handlePlay}
        disabled={loaded === 0}
        className="w-full px-2 py-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
      >
        Play
      </button>
    </div>
  )
})

export default SoundFileNodeComponent
