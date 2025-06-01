import React, { useState, useRef, useEffect, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import type { Node, Edge } from '@xyflow/react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useOnClickOutside } from 'usehooks-ts'

interface AudioNode extends Node {
  id: string
  type: string
  data: {
    nodeType: string
    properties: Map<string, unknown>
  }
}

const ExportJSButton: React.FC = observer(() => {
  const store = useAudioGraphStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  const nodes = store.visualNodes as AudioNode[]
  const hasNodes = nodes.length > 0

  // Handle click outside to close modal
  const handleClickOutside = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  useOnClickOutside(modalRef as React.RefObject<HTMLElement>, handleClickOutside)

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isModalOpen])

  // Remove useCallback from simple HTML element handlers
  const handleExport = () => {
    if (!hasNodes) return

    const nodes = store.visualNodes as AudioNode[]
    const edges = store.visualEdges

    // Check if there are any custom nodes
    const hasCustomNodes = nodes.some(node => {
      const customNodeTypes = [
        'SliderNode',
        'ButtonNode',
        'GreaterThanNode',
        'EqualsNode',
        'SelectNode',
        'MidiInputNode',
        'MidiToFreqNode',
        'DisplayNode',
        'SoundFileNode',
        'RandomNode',
      ]
      return customNodeTypes.includes(node.data.nodeType)
    })

    if (hasCustomNodes) {
      alert(
        'Support for exporting utility nodes coming soon. This feature is only available for pure Web Audio API projects.'
      )
      return
    }

    const generatedCode = generateJavaScriptCode(nodes, edges)
    setCode(generatedCode)
    setIsModalOpen(true)
  }

  const handleCopy = async () => {
    if (!code) return

    // Create a temporary textarea element to copy the code
    const textarea = document.createElement('textarea')
    textarea.value = code
    document.body.appendChild(textarea)
    textarea.select()

    try {
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore copy errors
    }
    document.body.removeChild(textarea)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const sanitizeId = (id: string) => {
    // Remove any non-alphanumeric characters except underscore
    return id.replace(/[^a-zA-Z0-9_]/g, '_')
  }

  const generateJavaScriptCode = (nodes: AudioNode[], edges: Edge[]) => {
    // Create a mapping of original IDs to sanitized IDs
    const idMap = new Map(nodes.map(node => [node.id, sanitizeId(node.id)]))

    // Check if there are any MediaStreamAudioSourceNode nodes
    const hasMicrophoneInput = nodes.some(
      node => node.data.nodeType === 'MediaStreamAudioSourceNode'
    )

    const code = `// Generated Audio Graph Code
${
  hasMicrophoneInput
    ? `// Note: This code includes microphone input. To use it:
// 1. Wrap the code in an async function
// 2. Request microphone permission using getUserMedia
// 3. Create MediaStreamAudioSourceNode with the stream

async function createAudioGraph() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Request microphone access
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
`
    : 'const audioContext = new (window.AudioContext || window.webkitAudioContext)();'
}

// Create nodes
${nodes
  .map(node => {
    const nodeId = idMap.get(node.id)
    const nodeType = node.data.nodeType.replace('Node', '') // Remove 'Node' suffix for cleaner code

    // Special case for destination node
    if (node.data.nodeType === 'AudioDestinationNode') {
      return `const ${nodeId} = audioContext.destination;`
    }

    // Special case for MediaStreamAudioSourceNode - requires getUserMedia
    if (node.data.nodeType === 'MediaStreamAudioSourceNode') {
      return `const ${nodeId} = audioContext.createMediaStreamSource(stream);`
    }

    // Special cases for nodes that require parameters in constructor
    if (node.data.nodeType === 'DelayNode') {
      // DelayNode requires maxDelayTime parameter, use a reasonable default
      return `const ${nodeId} = audioContext.create${nodeType}(1.0);`
    }

    // For all other nodes, create with no parameters
    return `const ${nodeId} = audioContext.create${nodeType}();`
  })
  .join('\n')}

// Set node properties
${nodes
  .map(node => {
    const properties = node.data.properties
    const audioProperties = Array.from(properties.entries())
      .filter(([key]) => !key.startsWith('_')) // Filter out internal MST properties
      .filter(([, value]) => value !== null) // Filter out null values

    const nodeId = idMap.get(node.id)

    // Set all properties after creation
    const paramSetters = audioProperties
      .map(([key, value]) => {
        // Handle different property types
        if (
          key === 'type' &&
          (node.data.nodeType === 'OscillatorNode' || node.data.nodeType === 'BiquadFilterNode')
        ) {
          return `${nodeId}.${key} = '${value}';`
        }
        // AudioParam properties (frequency, gain, delayTime, etc.)
        if (['frequency', 'detune', 'gain', 'delayTime', 'Q'].includes(key)) {
          return `${nodeId}.${key}.value = ${value};`
        }
        // Other properties
        return `${nodeId}.${key} = ${JSON.stringify(value)};`
      })
      .join('\n')

    return paramSetters
  })
  .filter(Boolean)
  .join('\n')}

// Connect nodes
${edges
  .map(edge => {
    const sourceId = idMap.get(edge.source)
    const targetId = idMap.get(edge.target)

    return `${sourceId}.connect(${targetId});`
  })
  .join('\n')}

// Start oscillators
${nodes
  .filter(node => node.data.nodeType === 'OscillatorNode')
  .map(node => {
    const nodeId = idMap.get(node.id)
    return `${nodeId}.start();`
  })
  .join('\n')}

// Start audio context
audioContext.resume();
${
  hasMicrophoneInput
    ? `}

// Call the function to create the audio graph
createAudioGraph().catch(console.error);`
    : ''
}
`
    return code
  }

  return (
    <>
      <button
        onClick={handleExport}
        disabled={!hasNodes}
        className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
          hasNodes
            ? 'hover:bg-[#999] dark:hover:bg-[#999] cursor-pointer'
            : 'cursor-not-allowed opacity-50'
        }`}
        title={hasNodes ? 'Export as JavaScript' : 'Please add nodes to export JS'}
        type="button"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-yellow-500" fill="currentColor">
          <path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z" />
        </svg>
      </button>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div
            ref={modalRef}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full p-6 relative"
          >
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              onClick={handleCloseModal}
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
              Exported JavaScript Code
            </h2>
            <div className="flex items-center mb-2">
              <button
                onClick={handleCopy}
                className="flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors mr-2"
                type="button"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] select-text">
              <SyntaxHighlighter language="javascript" style={oneDark} wrapLongLines>
                {code}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

export default ExportJSButton
