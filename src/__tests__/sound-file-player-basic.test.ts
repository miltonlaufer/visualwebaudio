import { describe, it, expect, beforeEach } from 'vitest'
import { createAudioGraphStore } from '~/stores/AudioGraphStore'
import customNodesMetadataJson from '~/types/custom-nodes-metadata.json'

describe('Sound File Player - Basic Functionality Test', () => {
  let store: any

  beforeEach(() => {
    store = createAudioGraphStore()
  })

  it('should create Sound File Player example nodes correctly', () => {
    // Create the nodes like the example does
    const soundFileId = store.addAdaptedNode('SoundFileNode', { x: 629, y: 117 })
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 350, y: 100 })
    const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1015, y: 162 })

    // Verify nodes were created
    expect(store.adaptedNodes.length).toBe(3)

    const soundFileNode = store.adaptedNodes.find((n: any) => n.nodeType === 'SoundFileNode')
    const buttonNode = store.adaptedNodes.find((n: any) => n.nodeType === 'ButtonNode')
    const destNode = store.adaptedNodes.find((n: any) => n.nodeType === 'AudioDestinationNode')

    expect(soundFileNode).toBeDefined()
    expect(buttonNode).toBeDefined()
    expect(destNode).toBeDefined()
    expect(soundFileNode.id).toBe(soundFileId)
    expect(buttonNode.id).toBe(buttonId)
    expect(destNode.id).toBe(destId)
  })

  it('should set properties correctly', () => {
    const soundFileId = store.addAdaptedNode('SoundFileNode', { x: 629, y: 117 })
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 350, y: 100 })

    // Set properties like the example does
    store.updateNodeProperty(buttonId, 'label', 'Play Sound')
    store.updateNodeProperty(buttonId, 'outputValue', 1)
    store.updateNodeProperty(soundFileId, 'gain', 1)
    store.updateNodeProperty(soundFileId, 'loop', false)
    store.updateNodeProperty(soundFileId, 'playbackRate', 1)
    store.updateNodeProperty(soundFileId, 'fileName', 'test-sound.wav')

    const soundFileNode = store.adaptedNodes.find((n: any) => n.nodeType === 'SoundFileNode')
    const buttonNode = store.adaptedNodes.find((n: any) => n.nodeType === 'ButtonNode')

    // Verify properties were set
    expect(buttonNode.properties.get('label')).toBe('Play Sound')
    expect(buttonNode.properties.get('outputValue')).toBe(1)
    expect(soundFileNode.properties.get('gain')).toBe(1)
    expect(soundFileNode.properties.get('loop')).toBe(false)
    expect(soundFileNode.properties.get('playbackRate')).toBe(1)
    expect(soundFileNode.properties.get('fileName')).toBe('test-sound.wav')
  })

  it('should create connections correctly', () => {
    const soundFileId = store.addAdaptedNode('SoundFileNode', { x: 629, y: 117 })
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 350, y: 100 })
    const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1015, y: 162 })

    // Create connections like the example does
    store.addEdge(buttonId, soundFileId, 'trigger', 'trigger')
    store.addEdge(soundFileId, destId, 'output', 'input')

    // Verify connections were created
    expect(store.visualEdges.length).toBe(2)

    const buttonToSoundFile = store.visualEdges.find(
      (e: any) => e.source === buttonId && e.target === soundFileId
    )
    const soundFileToDestination = store.visualEdges.find(
      (e: any) => e.source === soundFileId && e.target === destId
    )

    expect(buttonToSoundFile).toBeDefined()
    expect(buttonToSoundFile.sourceHandle).toBe('trigger')
    expect(buttonToSoundFile.targetHandle).toBe('trigger')

    expect(soundFileToDestination).toBeDefined()
    expect(soundFileToDestination.sourceHandle).toBe('output')
    expect(soundFileToDestination.targetHandle).toBe('input')
  })

  it('should validate trigger connection from button to sound file', () => {
    const soundFileId = store.addAdaptedNode('SoundFileNode', { x: 629, y: 117 })
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 350, y: 100 })

    // This should be a valid connection
    const isValid = store.isValidConnection(buttonId, soundFileId, 'trigger', 'trigger')
    expect(isValid).toBe(true)
  })

  it('should have trigger input in SoundFileNode metadata', () => {
    const soundFileMetadata = customNodesMetadataJson.SoundFileNode
    expect(soundFileMetadata).toBeDefined()

    const triggerInput = soundFileMetadata.inputs.find((input: any) => input.name === 'trigger')
    expect(triggerInput).toBeDefined()
    expect(triggerInput?.type).toBe('control')
    expect(triggerInput?.description).toBe('Triggers playback of the loaded audio file')
  })

  it('should create audio connections for both edges', () => {
    const soundFileId = store.addAdaptedNode('SoundFileNode', { x: 629, y: 117 })
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 350, y: 100 })
    const destId = store.addAdaptedNode('AudioDestinationNode', { x: 1015, y: 162 })

    store.addEdge(buttonId, soundFileId, 'trigger', 'trigger')
    store.addEdge(soundFileId, destId, 'output', 'input')

    // Verify audio connections were created
    expect(store.audioConnections.length).toBe(2)

    const triggerConnection = store.audioConnections.find(
      (conn: any) =>
        conn.sourceNodeId === buttonId &&
        conn.targetNodeId === soundFileId &&
        conn.targetInput === 'trigger'
    )
    expect(triggerConnection).toBeDefined()

    const audioConnection = store.audioConnections.find(
      (conn: any) =>
        conn.sourceNodeId === soundFileId &&
        conn.targetNodeId === destId &&
        conn.targetInput === 'input'
    )
    expect(audioConnection).toBeDefined()
  })

  it('should prevent invalid connections', () => {
    const soundFileId = store.addAdaptedNode('SoundFileNode', { x: 629, y: 117 })
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 350, y: 100 })

    // These should be invalid connections
    expect(store.isValidConnection(buttonId, soundFileId, 'trigger', 'nonexistent')).toBe(false)
    expect(store.isValidConnection(buttonId, soundFileId, 'nonexistent', 'trigger')).toBe(false)
  })

  it('should clean up properly when removing nodes', () => {
    const soundFileId = store.addAdaptedNode('SoundFileNode', { x: 629, y: 117 })
    const buttonId = store.addAdaptedNode('ButtonNode', { x: 350, y: 100 })

    store.addEdge(buttonId, soundFileId, 'trigger', 'trigger')

    expect(store.adaptedNodes.length).toBe(2)
    expect(store.visualEdges.length).toBe(1)
    expect(store.audioConnections.length).toBe(1)

    // Remove the sound file node
    store.removeNode(soundFileId)

    expect(store.adaptedNodes.length).toBe(1)
    expect(store.visualEdges.length).toBe(0) // Edge should be removed
    expect(store.audioConnections.length).toBe(0) // Audio connection should be removed
  })
})
