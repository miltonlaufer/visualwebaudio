import React from 'react'
import { customNodeStore } from '~/stores/CustomNodeStore'
import SliderNodeComponent from './SliderNodeComponent'
import ButtonNodeComponent from './ButtonNodeComponent'
import DisplayNodeComponent from './DisplayNodeComponent'
import SoundFileNodeComponent from './SoundFileNodeComponent'
import RandomNodeComponent from './RandomNodeComponent'
import TimerNodeComponent from './TimerNodeComponent'
import MidiInputNodeComponent from './MidiInputNodeComponent'

interface CustomNodeRendererProps {
  nodeId: string
  nodeType: string
}

const CustomNodeRenderer: React.FC<CustomNodeRendererProps> = ({ nodeId, nodeType }) => {
  // Check if node exists in store
  const node = customNodeStore.getNode(nodeId)

  if (!node) {
    return <div className="text-red-500 text-xs p-2">Node not found: {nodeId}</div>
  }

  switch (nodeType) {
    case 'SliderNode':
      return <SliderNodeComponent nodeId={nodeId} />
    case 'ButtonNode':
      return <ButtonNodeComponent nodeId={nodeId} />
    case 'DisplayNode':
      return <DisplayNodeComponent nodeId={nodeId} />
    case 'SoundFileNode':
      return <SoundFileNodeComponent nodeId={nodeId} />
    case 'RandomNode':
      return <RandomNodeComponent nodeId={nodeId} />
    case 'TimerNode':
      return <TimerNodeComponent nodeId={nodeId} />
    case 'MidiInputNode':
      return <MidiInputNodeComponent nodeId={nodeId} />
    case 'MidiToFreqNode':
      // MidiToFreqNode doesn't need a UI component - it's a pure computation node
      return <div className="text-gray-600 text-xs p-2 text-center">MIDI → Freq</div>
    case 'ScaleToMidiNode':
      return <div className="text-gray-600 text-xs p-2 text-center">Scale → MIDI</div>
    case 'GreaterThanNode':
    case 'EqualsNode':
    case 'SelectNode':
      // These nodes don't have UI components yet - just show their type
      return (
        <div className="text-gray-600 text-xs p-2 text-center">{nodeType.replace('Node', '')}</div>
      )
    default:
      return <div className="text-red-500 text-xs p-2">Unknown custom node: {nodeType}</div>
  }
}

export default CustomNodeRenderer

// Export individual components
export {
  SliderNodeComponent,
  ButtonNodeComponent,
  DisplayNodeComponent,
  SoundFileNodeComponent,
  RandomNodeComponent,
  MidiInputNodeComponent,
}
