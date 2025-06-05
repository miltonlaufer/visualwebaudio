import React from 'react'
import { observer } from 'mobx-react-lite'
import { customNodeStore } from '~/stores/CustomNodeStore'

interface DisplayNodeComponentProps {
  nodeId: string
}

const DisplayNodeComponent: React.FC<DisplayNodeComponentProps> = observer(({ nodeId }) => {
  const node = customNodeStore.getNode(nodeId)

  // All hooks called first, now prepare data for rendering
  const isValidNode = node && node.nodeType === 'DisplayNode'
  const currentValue = isValidNode ? node.properties.get('currentValue') : 0
  const label = isValidNode ? node.properties.get('label') || 'Display' : ''
  const precision = isValidNode ? node.properties.get('precision') || 2 : 2

  // Ensure we show a meaningful value - use 0 if currentValue is undefined, null, or NaN
  const rawValue =
    currentValue !== undefined && currentValue !== null && !isNaN(currentValue) ? currentValue : 0

  // Format the display value with precision
  let formattedValue: string
  if (Number.isInteger(rawValue) || precision === 0) {
    formattedValue = Math.round(rawValue).toString()
  } else {
    formattedValue = Number(rawValue).toFixed(precision)
  }

  if (isValidNode) {
    console.log(
      `📊 DisplayNode ${nodeId} rendering: currentValue=${currentValue}, formattedValue=${formattedValue}, precision=${precision}`
    )
  }

  // Single return with conditional rendering - NO early returns
  return (
    <div className="p-2 space-y-1">
      {!isValidNode ? (
        <div className="text-red-500 text-xs">DisplayNode not found</div>
      ) : (
        <>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</div>
          <div className="text-lg font-mono bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded border text-center">
            {formattedValue}
          </div>
        </>
      )}
    </div>
  )
})

export default DisplayNodeComponent
