import React from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'
import { midiToNoteName, getModeName } from '~/domain/music'
import type { Mode } from '~/domain/music'

interface ScaleToMidiNodeComponentProps {
  nodeId: string
}

const ScaleToMidiNodeComponent: React.FC<ScaleToMidiNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)

  /******************* COMPUTED ***********************/
  const isValidNode = node && node.nodeType === 'ScaleToMidiNode'
  const scaleDegree = isValidNode ? (node.properties.get('scaleDegree') ?? 0) : 0
  const key = isValidNode ? (node.properties.get('key') ?? 'C') : 'C'
  const mode = isValidNode ? (node.properties.get('mode') ?? 'major') : 'major'
  const midiNote = isValidNode ? (node.properties.get('midiNote') ?? 60) : 60
  const frequency = isValidNode ? (node.properties.get('frequency') ?? 261.63) : 261.63

  // Get note name from MIDI number
  const noteName = midiToNoteName(Number(midiNote))

  // Get readable mode name
  const modeName = getModeName(mode as Mode)

  // Format frequency
  const formattedFreq = Number(frequency).toFixed(2)

  /******************* RENDER ***********************/
  return (
    <div className="p-2 space-y-2 text-center min-w-[140px]">
      {!isValidNode ? (
        <div className="text-red-500 text-xs">ScaleToMidiNode not found</div>
      ) : (
        <>
          {/* Scale info header */}
          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            {key} {modeName}
          </div>

          {/* Degree → Note/Freq display */}
          <div className="flex justify-center items-center gap-2">
            <div className="bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Degree</div>
              <div className="text-lg font-mono font-semibold text-purple-700 dark:text-purple-300">
                {scaleDegree}
              </div>
            </div>
            <div className="text-gray-400 dark:text-gray-500">→</div>
            <div className="bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Note</div>
              <div className="text-sm font-mono font-semibold text-blue-700 dark:text-blue-300">
                {noteName}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">#{midiNote}</div>
            </div>
          </div>

          {/* Frequency display */}
          <div className="bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
            <div className="text-sm font-mono font-semibold text-green-700 dark:text-green-300">
              {formattedFreq} Hz
            </div>
          </div>
        </>
      )}
    </div>
  )
})

export default ScaleToMidiNodeComponent
