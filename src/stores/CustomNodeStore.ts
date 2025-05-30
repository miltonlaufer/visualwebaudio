import { observable, action, computed, reaction } from 'mobx'
import { makeObservable } from 'mobx'

// Interface for custom node connection
interface ICustomNodeConnection {
  targetNodeId: string
  outputName: string
  inputName: string
}

// Interface for custom node state
interface ICustomNodeState {
  id: string
  nodeType: string
  properties: Map<string, any>
  outputs: Map<string, any>
  connections: ICustomNodeConnection[]
  setProperty(name: string, value: any): void
  setOutput(name: string, value: any): void
  addConnection(targetNodeId: string, outputName: string, inputName: string): void
  clearConnections(): void
  propagateOutput(outputName: string, value: any): void
  receiveInput(inputName: string, value: any): void
  setValue(value: any): void
  trigger(): void
  // Audio functionality for SoundFileNode
  getAudioOutput?(): AudioNode | null
  updateAudioContext?(audioContext: AudioContext): void
  loadAudioFile?(file: File): Promise<void>
}

// Interface for custom node store
interface ICustomNodeStore {
  nodes: Map<string, CustomNodeState>
  bridgeUpdateCallback?: (nodeId: string, outputName: string, value: number) => void
  addNode(id: string, nodeType: string, metadata: any): CustomNodeState
  removeNode(id: string): void
  getNode(id: string): CustomNodeState | undefined
  setBridgeUpdateCallback(
    callback: (nodeId: string, outputName: string, value: number) => void
  ): void
  connectNodes(sourceId: string, targetId: string, outputName: string, inputName: string): void
  clear(): void
}

// Observable custom node state
export class CustomNodeState implements ICustomNodeState {
  id: string
  nodeType: string
  properties = new Map<string, any>()
  outputs = new Map<string, any>()
  connections: ICustomNodeConnection[] = []

  // Audio functionality for SoundFileNode
  private audioContext?: AudioContext
  private gainNode?: GainNode
  private audioBuffer?: AudioBuffer
  private bufferSource?: AudioBufferSourceNode

  constructor(id: string, nodeType: string) {
    this.id = id
    this.nodeType = nodeType

    makeObservable(this, {
      properties: observable,
      outputs: observable,
      connections: observable,
      setProperty: action,
      setOutput: action,
      addConnection: action,
      clearConnections: action,
      propagateOutput: action,
    })
  }

  setProperty(name: string, value: any): void {
    this.properties.set(name, value)
  }

  setOutput(name: string, value: any): void {
    this.outputs.set(name, value)
  }

  addConnection(targetNodeId: string, outputName: string, inputName: string): void {
    this.connections.push({ targetNodeId, outputName, inputName })
  }

  clearConnections(): void {
    this.connections.length = 0
  }

  propagateOutput(outputName: string, value: any): void {
    console.log(`🔄 MobX ${this.nodeType} ${this.id} propagating ${outputName}: ${value}`)

    // Update our own output
    this.setOutput(outputName, value)

    // Find connected nodes and propagate to them
    this.connections
      .filter((conn: ICustomNodeConnection) => conn.outputName === outputName)
      .forEach((conn: ICustomNodeConnection) => {
        const targetNode = customNodeStore.getNode(conn.targetNodeId)
        if (targetNode) {
          console.log(
            `  → Propagating to ${targetNode.nodeType} ${targetNode.id}.${conn.inputName}`
          )
          // Call the appropriate receive method based on node type
          if (targetNode.nodeType === 'DisplayNode') {
            targetNode.receiveInput(conn.inputName, value)
          } else if (targetNode.nodeType === 'MidiToFreqNode') {
            targetNode.receiveInput(conn.inputName, value)
          } else if (targetNode.nodeType === 'SoundFileNode') {
            targetNode.receiveInput(conn.inputName, value)
          }
          // Add more node types as needed
        }
      })
  }

  // Node-specific methods
  receiveInput(inputName: string, value: any): void {
    console.log(`📥 MobX ${this.nodeType} ${this.id} received ${inputName}: ${value}`)

    if (this.nodeType === 'DisplayNode' && inputName === 'input') {
      const numValue = Number(value) || 0
      this.setProperty('currentValue', numValue)
      this.propagateOutput('output', numValue)
    } else if (this.nodeType === 'MidiToFreqNode' && inputName === 'midiNote') {
      const midiNote = Number(value) || 0
      const frequency = this.midiToFrequency(midiNote)
      this.propagateOutput('frequency', frequency)
    } else if (this.nodeType === 'SoundFileNode' && inputName === 'trigger' && value > 0) {
      console.log(`🎯 MobX SoundFileNode ${this.id}: Trigger received with value ${value}`)
      console.log(`   - audioContext exists: ${!!this.audioContext}`)
      console.log(`   - audioBuffer exists: ${!!this.audioBuffer}`)
      console.log(`   - gainNode exists: ${!!this.gainNode}`)
      this.performSoundFileTrigger()
    }
  }

  // Slider-specific methods
  setValue(value: any): void {
    if (this.nodeType === 'SliderNode' && typeof value === 'number') {
      this.setProperty('value', value)
      this.propagateOutput('value', value)
    } else if (this.nodeType === 'DisplayNode') {
      if (typeof value === 'number') {
        this.setProperty('currentValue', value)
        this.propagateOutput('output', value)
      } else if (typeof value === 'string') {
        this.setProperty('label', value)
      }
    }
  }

  // Button-specific methods
  trigger(): void {
    if (this.nodeType === 'ButtonNode') {
      const outputValue = this.properties.get('outputValue') || 1
      this.propagateOutput('trigger', outputValue)
    } else if (this.nodeType === 'SoundFileNode') {
      this.performSoundFileTrigger()
    }
  }

  // MIDI to frequency conversion
  private midiToFrequency(midiNote: number): number {
    const baseFreq = this.properties.get('baseFreq') || 440
    const baseMidi = this.properties.get('baseMidi') || 69
    return baseFreq * Math.pow(2, (midiNote - baseMidi) / 12)
  }

  // Audio functionality for SoundFileNode
  getAudioOutput(): AudioNode | null {
    if (this.nodeType === 'SoundFileNode') {
      return this.gainNode || null
    }
    return null
  }

  updateAudioContext(audioContext: AudioContext): void {
    if (this.nodeType === 'SoundFileNode') {
      console.log(
        `🔄 MobX SoundFileNode: Updating audio context from ${this.audioContext?.state} to ${audioContext.state}`
      )
      this.audioContext = audioContext
      this.setupAudioNodes()
      this.restoreAudioBufferFromProperties()
      console.log(`✅ MobX SoundFileNode: Audio context updated and nodes recreated`)
    }
  }

  async loadAudioFile(file: File): Promise<void> {
    if (this.nodeType !== 'SoundFileNode' || !this.audioContext) {
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()

      // Store the raw audio data for persistence across context recreations
      const base64Data = this.arrayBufferToBase64(arrayBuffer)
      this.setProperty('audioBufferData', base64Data)
      this.setProperty('fileName', file.name)

      // Decode audio buffer for immediate use
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice())
      this.setOutput('loaded', 1)
      this.propagateOutput('loaded', 1)

      console.log(`🎵 MobX SoundFileNode: Loaded and stored audio file: ${file.name}`)
    } catch (error) {
      console.error('Error loading audio file:', error)
      this.setOutput('loaded', 0)
      this.propagateOutput('loaded', 0)
      // Clear any partial data
      this.properties.delete('audioBufferData')
      this.properties.delete('fileName')
    }
  }

  private setupAudioNodes(): void {
    if (this.nodeType === 'SoundFileNode' && this.audioContext) {
      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = this.properties.get('gain') || 1
    }
  }

  private async restoreAudioBufferFromProperties(): Promise<void> {
    if (this.nodeType !== 'SoundFileNode' || !this.audioContext) {
      return
    }

    const audioBufferData = this.properties.get('audioBufferData')
    const fileName = this.properties.get('fileName')

    console.log(`🔍 MobX SoundFileNode: Attempting to restore audio data...`)
    console.log(`🔍 audioBufferData exists: ${!!audioBufferData}, type: ${typeof audioBufferData}`)
    console.log(`🔍 fileName: ${fileName}`)

    if (audioBufferData && fileName) {
      try {
        console.log(`🎵 MobX SoundFileNode: Restoring audio buffer for ${fileName}`)

        if (typeof audioBufferData !== 'string') {
          console.error('🚨 audioBufferData is not a string:', typeof audioBufferData)
          throw new Error('Invalid audioBufferData format - expected base64 string')
        }

        const arrayBuffer = this.base64ToArrayBuffer(audioBufferData)
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
        this.setOutput('loaded', 1)
        this.propagateOutput('loaded', 1)

        console.log(`✅ MobX SoundFileNode: Successfully restored audio buffer for ${fileName}`)
        console.log(`   - Duration: ${this.audioBuffer.duration.toFixed(2)}s`)
        console.log(`   - Sample rate: ${this.audioBuffer.sampleRate}Hz`)
        console.log(`   - Channels: ${this.audioBuffer.numberOfChannels}`)
      } catch (error) {
        console.error('🚨 MobX SoundFileNode: Error restoring audio buffer:', error)
        this.setOutput('loaded', 0)
        this.propagateOutput('loaded', 0)
        console.warn('🔄 MobX SoundFileNode: Audio data preserved - user can try reloading')
      }
    } else {
      console.log(`⚠️ MobX SoundFileNode: No stored audio data found`)
      this.setOutput('loaded', 0)
      this.propagateOutput('loaded', 0)
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  private performSoundFileTrigger(): void {
    if (
      this.nodeType !== 'SoundFileNode' ||
      !this.audioContext ||
      !this.audioBuffer ||
      !this.gainNode
    ) {
      console.warn(
        'MobX SoundFileNode: Cannot trigger - missing audio context, buffer, or gain node'
      )
      return
    }

    // Stop previous playback
    if (this.bufferSource) {
      try {
        this.bufferSource.stop()
        this.bufferSource.disconnect()
      } catch {
        console.log('MobX SoundFileNode: Previous buffer source already stopped')
      }
    }

    // Create new buffer source
    this.bufferSource = this.audioContext.createBufferSource()
    this.bufferSource.buffer = this.audioBuffer
    this.bufferSource.loop = this.properties.get('loop') || false
    this.bufferSource.playbackRate.value = this.properties.get('playbackRate') || 1

    // Update gain
    this.gainNode.gain.value = this.properties.get('gain') || 1

    // Connect: bufferSource -> gainNode -> (external connections)
    this.bufferSource.connect(this.gainNode)

    // Start playback
    this.bufferSource.start()
    console.log('MobX SoundFileNode: Audio playback started')
  }
}

// Observable store for all custom nodes
class CustomNodeStore implements ICustomNodeStore {
  nodes = new Map<string, CustomNodeState>()
  bridgeUpdateCallback?: (nodeId: string, outputName: string, value: number) => void

  constructor() {
    makeObservable(this, {
      nodes: observable,
      addNode: action,
      removeNode: action,
      getNode: computed,
      setBridgeUpdateCallback: action,
      connectNodes: action,
      clear: action,
    })
  }

  addNode(id: string, nodeType: string, metadata: any): CustomNodeState {
    const node = new CustomNodeState(id, nodeType)

    // Initialize properties from metadata
    if (metadata && metadata.properties) {
      metadata.properties.forEach((prop: any) => {
        node.setProperty(prop.name, prop.defaultValue)
      })
    }

    // Initialize outputs
    if (metadata && metadata.outputs) {
      metadata.outputs.forEach((output: any) => {
        node.setOutput(output.name, null)
      })
    }

    // Set initial values for specific node types
    if (nodeType === 'SliderNode') {
      const initialValue = node.properties.get('value') || 50
      node.setOutput('value', initialValue)
    } else if (nodeType === 'DisplayNode') {
      const initialValue = node.properties.get('currentValue') || 0
      node.setOutput('output', initialValue)
    } else if (nodeType === 'SoundFileNode') {
      // Initialize with no audio loaded
      console.log(`🎵 Creating MobX SoundFileNode ${id}`)
      node.setOutput('loaded', 0)
    }

    this.nodes.set(id, node)

    // Set up reaction to trigger bridge updates when outputs change
    reaction(
      (): Array<[string, any]> => Array.from(node.outputs.entries()),
      (outputs: Array<[string, any]>) => {
        outputs.forEach(([outputName, value]) => {
          if (this.bridgeUpdateCallback && typeof value === 'number') {
            console.log(`🌉 MobX reaction: Bridge update for ${id} ${outputName}: ${value}`)
            this.bridgeUpdateCallback(id, outputName, value)
          }
        })
      },
      { fireImmediately: false }
    )

    return node
  }

  removeNode(id: string): void {
    this.nodes.delete(id)
  }

  get getNode() {
    return (id: string): CustomNodeState | undefined => {
      return this.nodes.get(id)
    }
  }

  setBridgeUpdateCallback(
    callback: (nodeId: string, outputName: string, value: number) => void
  ): void {
    this.bridgeUpdateCallback = callback
  }

  connectNodes(sourceId: string, targetId: string, outputName: string, inputName: string): void {
    const sourceNode = this.getNode(sourceId)
    if (sourceNode) {
      sourceNode.addConnection(targetId, outputName, inputName)
    }
  }

  clear(): void {
    this.nodes.clear()
  }

  // Method to set audio context for SoundFileNode
  setAudioContext(audioContext: AudioContext): void {
    console.log(`🔧 CustomNodeStore: Setting audio context on ${this.nodes.size} nodes`)
    this.nodes.forEach((node, nodeId) => {
      if (node.nodeType === 'SoundFileNode' && node.updateAudioContext) {
        console.log(`🔧 Setting audio context on SoundFileNode ${nodeId}`)
        node.updateAudioContext(audioContext)
      }
    })
  }
}

// Create singleton instance
export const customNodeStore = new CustomNodeStore()

// Export types
export type { ICustomNodeState, ICustomNodeStore, ICustomNodeConnection }
