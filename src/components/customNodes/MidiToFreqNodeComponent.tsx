import React from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'
import { midiToNoteName } from '~/domain/music'

interface MidiToFreqNodeComponentProps {
  nodeId: string
}

const MidiToFreqNodeComponent: React.FC<MidiToFreqNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)

  /******************* COMPUTED ***********************/
  const isValidNode = node && node.nodeType === 'MidiToFreqNode'
  const midiNote = isValidNode ? (node.properties.get('midiNote') ?? 60) : 60
  const frequency = isValidNode ? (node.properties.get('frequency') ?? 261.63) : 261.63

  // Get note name from MIDI number
  const noteName = midiToNoteName(Number(midiNote))

  // Format frequency
  const formattedFreq = Number(frequency).toFixed(2)

  /******************* RENDER ***********************/
  return (
    <div className="p-2 space-y-1 text-center min-w-[100px]">
      {!isValidNode ? (
        <div className="text-red-500 text-xs">MidiToFreqNode not found</div>
      ) : (
        <>
          <div className="text-xs text-gray-500 dark:text-gray-400">MIDI to Freq</div>
          <div className="flex justify-center items-center gap-2">
            <div className="bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Note</div>
              <div className="text-sm font-mono font-semibold text-blue-700 dark:text-blue-300">
                {noteName}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">#{midiNote}</div>
            </div>
            <div className="text-gray-400 dark:text-gray-500">→</div>
            <div className="bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Freq</div>
              <div className="text-sm font-mono font-semibold text-green-700 dark:text-green-300">
                {formattedFreq}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">Hz</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
})

export default MidiToFreqNodeComponent
