import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Web Audio API node types we want to extract
const WEB_AUDIO_NODES = [
  'AudioContext',
  'AudioBufferSourceNode',
  'OscillatorNode',
  'GainNode',
  'BiquadFilterNode',
  'DelayNode',
  'ConvolverNode',
  'DynamicsCompressorNode',
  'WaveShaperNode',
  'StereoPannerNode',
  'ChannelSplitterNode',
  'ChannelMergerNode',
  'AnalyserNode',
  'AudioDestinationNode',
  'MediaElementAudioSourceNode',
  'MediaStreamAudioSourceNode',
  'ScriptProcessorNode',
  'AudioWorkletNode',
]

// Extract type information from TypeScript lib files
function extractWebAudioTypes() {
  console.log('🔍 Extracting Web Audio API types from TypeScript definitions...')

  // Create a TypeScript program to analyze the lib files
  const program = ts.createProgram(['node_modules/typescript/lib/lib.dom.d.ts'], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    lib: ['dom', 'es2020'],
  })

  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile('node_modules/typescript/lib/lib.dom.d.ts')

  if (!sourceFile) {
    console.warn(
      '⚠️  Could not find TypeScript DOM definitions, falling back to manual definitions'
    )
    return createFallbackMetadata()
  }

  const nodeMetadata = {}

  // Visit all nodes in the source file
  function visit(node) {
    if (ts.isInterfaceDeclaration(node) && WEB_AUDIO_NODES.includes(node.name.text)) {
      const nodeType = node.name.text
      console.log(`📝 Extracting ${nodeType}...`)

      nodeMetadata[nodeType] = {
        name: nodeType,
        description: extractDescription(node),
        category: getNodeCategory(nodeType),
        inputs: getNodeInputs(nodeType),
        outputs: getNodeOutputs(nodeType),
        properties: extractPropertiesFromInterface(node, checker),
        methods: extractMethodsFromInterface(node, checker),
        events: extractEventsFromInterface(node, checker),
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  // Fill in any missing nodes with fallback data
  WEB_AUDIO_NODES.forEach(nodeType => {
    if (!nodeMetadata[nodeType]) {
      console.log(`⚠️  ${nodeType} not found in TS definitions, using fallback`)
      nodeMetadata[nodeType] = createFallbackNodeMetadata(nodeType)
    }
  })

  return nodeMetadata
}

function extractPropertiesFromInterface(node, checker) {
  const properties = []

  node.members.forEach(member => {
    if (ts.isPropertySignature(member) && member.name) {
      const propertyName = member.name.text

      // Skip common inherited properties we don't need
      if (
        ['addEventListener', 'removeEventListener', 'dispatchEvent', 'constructor'].includes(
          propertyName
        )
      ) {
        return
      }

      const type = checker.getTypeAtLocation(member)
      const typeString = checker.typeToString(type)

      // Determine if this is an AudioParam
      const isAudioParam = typeString.includes('AudioParam')
      const isReadonly = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ReadonlyKeyword)

      // Include AudioParams even if they're readonly (they have writable .value property)
      // Also include other configurable properties
      if (isAudioParam || (!isReadonly && isConfigurableProperty(propertyName, typeString))) {
        properties.push({
          name: propertyName,
          type: isAudioParam ? 'AudioParam' : mapTypeScriptType(typeString),
          defaultValue: getDefaultValue(propertyName, typeString),
          ...(isAudioParam && {
            min: getAudioParamRange(propertyName).min,
            max: getAudioParamRange(propertyName).max,
          }),
        })
      }
    }
  })

  return properties
}

function extractMethodsFromInterface(node, checker) {
  const methods = []

  node.members.forEach(member => {
    if (ts.isMethodSignature(member) && member.name) {
      const methodName = member.name.text

      // Include important methods
      if (
        [
          'start',
          'stop',
          'connect',
          'disconnect',
          'createOscillator',
          'createGain',
          'createBiquadFilter',
          'createDelay',
          'createAnalyser',
        ].includes(methodName)
      ) {
        methods.push(methodName)
      }
    }
  })

  return methods
}

function extractEventsFromInterface(node, checker) {
  const events = []

  node.members.forEach(member => {
    if (ts.isPropertySignature(member) && member.name) {
      const propertyName = member.name.text

      // Look for event handler properties
      if (propertyName.startsWith('on') && propertyName !== 'onended') {
        const eventName = propertyName.substring(2) // Remove 'on' prefix
        events.push(eventName)
      } else if (propertyName === 'onended') {
        events.push('ended')
      }
    }
  })

  return events
}

function isConfigurableProperty(propertyName, typeString) {
  // Properties that are typically configurable
  const configurableProps = ['type', 'loop', 'loopStart', 'loopEnd', 'playbackRate']
  return (
    configurableProps.includes(propertyName) ||
    typeString.includes('OscillatorType') ||
    typeString.includes('BiquadFilterType')
  )
}

function mapTypeScriptType(typeString) {
  if (typeString.includes('OscillatorType')) return 'OscillatorType'
  if (typeString.includes('BiquadFilterType')) return 'BiquadFilterType'
  if (typeString.includes('number')) return 'number'
  if (typeString.includes('string')) return 'string'
  if (typeString.includes('boolean')) return 'boolean'
  return 'unknown'
}

function getDefaultValue(propertyName, typeString) {
  // Common default values
  const defaults = {
    frequency: 440,
    detune: 0,
    gain: 1,
    Q: 1,
    type: typeString.includes('OscillatorType') ? 'sine' : 'lowpass',
    delayTime: 0,
    threshold: -24,
    knee: 30,
    ratio: 12,
    attack: 0.003,
    release: 0.25,
    pan: 0,
  }

  return defaults[propertyName] || (typeString.includes('number') ? 0 : null)
}

function getAudioParamRange(propertyName) {
  // Common AudioParam ranges based on Web Audio API spec
  const ranges = {
    frequency: { min: 0, max: 20000 },
    detune: { min: -1200, max: 1200 },
    gain: { min: 0, max: 1 },
    Q: { min: 0.0001, max: 1000 },
    delayTime: { min: 0, max: 1 },
    threshold: { min: -100, max: 0 },
    knee: { min: 0, max: 40 },
    ratio: { min: 1, max: 20 },
    attack: { min: 0, max: 1 },
    release: { min: 0, max: 1 },
    pan: { min: -1, max: 1 },
  }

  return ranges[propertyName] || { min: undefined, max: undefined }
}

function createFallbackMetadata() {
  console.log('📋 Creating fallback metadata...')
  const nodeMetadata = {}

  WEB_AUDIO_NODES.forEach(nodeType => {
    nodeMetadata[nodeType] = createFallbackNodeMetadata(nodeType)
  })

  return nodeMetadata
}

function createFallbackNodeMetadata(nodeType) {
  return {
    name: nodeType,
    description: getManualDescription(nodeType),
    category: getNodeCategory(nodeType),
    inputs: getNodeInputs(nodeType),
    outputs: getNodeOutputs(nodeType),
    properties: getNodeProperties(nodeType),
    methods: getNodeMethods(nodeType),
    events: getNodeEvents(nodeType),
  }
}

function getNodeCategory(nodeType) {
  if (nodeType.includes('Source') || nodeType === 'OscillatorNode') return 'source'
  if (nodeType.includes('Destination')) return 'destination'
  if (nodeType.includes('Filter') || nodeType.includes('Gain') || nodeType.includes('Delay'))
    return 'effect'
  if (nodeType.includes('Analyser')) return 'analysis'
  if (nodeType === 'AudioContext') return 'context'
  return 'processing'
}

function getNodeInputs(nodeType) {
  // Most audio nodes have one audio input, except sources and context
  if (nodeType.includes('Source') || nodeType === 'AudioContext' || nodeType === 'OscillatorNode') {
    return []
  }
  if (nodeType === 'ChannelMergerNode') {
    return [
      { name: 'input0', type: 'audio' },
      { name: 'input1', type: 'audio' },
      { name: 'input2', type: 'audio' },
      { name: 'input3', type: 'audio' },
      { name: 'input4', type: 'audio' },
      { name: 'input5', type: 'audio' },
    ]
  }
  return [{ name: 'input', type: 'audio' }]
}

function getNodeOutputs(nodeType) {
  if (nodeType === 'AudioDestinationNode') {
    return []
  }
  if (nodeType === 'ChannelSplitterNode') {
    return [
      { name: 'output0', type: 'audio' },
      { name: 'output1', type: 'audio' },
      { name: 'output2', type: 'audio' },
      { name: 'output3', type: 'audio' },
      { name: 'output4', type: 'audio' },
      { name: 'output5', type: 'audio' },
    ]
  }
  return [{ name: 'output', type: 'audio' }]
}

function getNodeProperties(nodeType) {
  const commonProperties = []

  switch (nodeType) {
    case 'OscillatorNode':
      return [
        { name: 'frequency', type: 'AudioParam', defaultValue: 440 },
        { name: 'detune', type: 'AudioParam', defaultValue: 0 },
        { name: 'type', type: 'OscillatorType', defaultValue: 'sine' },
      ]
    case 'GainNode':
      return [{ name: 'gain', type: 'AudioParam', defaultValue: 1 }]
    case 'BiquadFilterNode':
      return [
        { name: 'frequency', type: 'AudioParam', defaultValue: 350 },
        { name: 'Q', type: 'AudioParam', defaultValue: 1 },
        { name: 'gain', type: 'AudioParam', defaultValue: 0 },
        { name: 'type', type: 'BiquadFilterType', defaultValue: 'lowpass' },
      ]
    case 'DelayNode':
      return [{ name: 'delayTime', type: 'AudioParam', defaultValue: 0 }]
    case 'DynamicsCompressorNode':
      return [
        { name: 'threshold', type: 'AudioParam', defaultValue: -24 },
        { name: 'knee', type: 'AudioParam', defaultValue: 30 },
        { name: 'ratio', type: 'AudioParam', defaultValue: 12 },
        { name: 'attack', type: 'AudioParam', defaultValue: 0.003 },
        { name: 'release', type: 'AudioParam', defaultValue: 0.25 },
      ]
    case 'StereoPannerNode':
      return [{ name: 'pan', type: 'AudioParam', defaultValue: 0 }]
    default:
      return commonProperties
  }
}

function getNodeMethods(nodeType) {
  const commonMethods = ['connect', 'disconnect']

  switch (nodeType) {
    case 'OscillatorNode':
    case 'AudioBufferSourceNode':
      return [...commonMethods, 'start', 'stop']
    case 'AudioContext':
      return [
        'createOscillator',
        'createGain',
        'createBiquadFilter',
        'createDelay',
        'createAnalyser',
        'resume',
        'suspend',
        'close',
      ]
    default:
      return commonMethods
  }
}

function getNodeEvents(nodeType) {
  switch (nodeType) {
    case 'OscillatorNode':
    case 'AudioBufferSourceNode':
      return ['ended']
    case 'AudioContext':
      return ['statechange']
    default:
      return []
  }
}

function extractDescription(node) {
  // Try to get JSDoc comment
  const jsDoc = ts.getJSDocCommentsAndTags(node)
  if (jsDoc && jsDoc.length > 0) {
    const firstComment = jsDoc[0]
    if (ts.isJSDoc(firstComment) && firstComment.comment) {
      return typeof firstComment.comment === 'string'
        ? firstComment.comment
        : firstComment.comment.map(part => part.text || part.kind).join('')
    }
  }

  // Fallback to manual descriptions
  return getManualDescription(node.name.text)
}

function getManualDescription(nodeType) {
  const descriptions = {
    AudioContext: 'The main interface for creating and managing audio processing graphs.',
    OscillatorNode:
      'Generates periodic waveforms (sine, square, sawtooth, triangle) at specified frequencies.',
    GainNode: 'Controls the volume/amplitude of audio signals passing through it.',
    BiquadFilterNode:
      'Implements various types of audio filters (lowpass, highpass, bandpass, etc.).',
    DelayNode: 'Delays audio signals by a specified amount of time.',
    AnalyserNode: 'Provides real-time frequency and time-domain analysis of audio.',
    AudioDestinationNode: 'Represents the final destination for audio in the audio graph.',
    DynamicsCompressorNode: 'Reduces the dynamic range of audio signals.',
    ConvolverNode: 'Performs convolution-based audio processing for reverb and spatial effects.',
    WaveShaperNode: 'Applies non-linear distortion to audio signals using a curve.',
    StereoPannerNode: 'Controls the stereo positioning of audio signals.',
    ChannelSplitterNode: 'Splits multi-channel audio into separate mono channels.',
    ChannelMergerNode: 'Combines multiple mono channels into multi-channel audio.',
    AudioBufferSourceNode: 'Plays back audio data stored in an AudioBuffer.',
    MediaElementAudioSourceNode: 'Creates an audio source from HTML media elements.',
    MediaStreamAudioSourceNode: 'Creates an audio source from MediaStream (microphone, etc.).',
    ScriptProcessorNode: 'Allows custom audio processing using JavaScript (deprecated).',
    AudioWorkletNode: 'Modern replacement for ScriptProcessorNode for custom audio processing.',
  }

  return descriptions[nodeType] || 'Web Audio API node for audio processing.'
}

// Generate the metadata file
try {
  const metadata = extractWebAudioTypes()
  const outputPath = path.join(__dirname, '../src/types/web-audio-metadata.json')

  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2))
  console.log(`✅ Web Audio API metadata extracted to ${outputPath}`)
  console.log(`📊 Extracted ${Object.keys(metadata).length} node types`)
} catch (error) {
  console.error('❌ Error extracting types:', error.message)
  console.log('📋 Falling back to manual definitions...')

  const fallbackMetadata = createFallbackMetadata()
  const outputPath = path.join(__dirname, '../src/types/web-audio-metadata.json')

  fs.writeFileSync(outputPath, JSON.stringify(fallbackMetadata, null, 2))
  console.log(`✅ Fallback metadata created at ${outputPath}`)
  console.log(`📊 Created ${Object.keys(fallbackMetadata).length} node types`)
}
