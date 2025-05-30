import React from 'react'
import { customNodeStore } from '~/stores/CustomNodeStore'
import SliderNodeComponent from './SliderNodeComponent'
import ButtonNodeComponent from './ButtonNodeComponent'
import DisplayNodeComponent from './DisplayNodeComponent'
import SoundFileNodeComponent from './SoundFileNodeComponent'
import RandomNodeComponent from './RandomNodeComponent'

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
    default:
      return <div className="text-gray-500 text-xs p-2">Unknown custom node: {nodeType}</div>
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
}
