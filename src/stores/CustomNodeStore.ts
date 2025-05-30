import { observable, action, computed, reaction, IReactionDisposer } from 'mobx'
import { makeObservable } from 'mobx'

// Interface for custom node connection with MobX reaction
interface ICustomNodeConnection {
  sourceNodeId: string
  sourceOutput: string
  targetInput: string
  disposer: IReactionDisposer // MobX reaction disposer
}

// Interface for custom node state
interface ICustomNodeState {
  id: string
  nodeType: string
  properties: Map<string, any>
  outputs: Map<string, any>
  inputConnections: ICustomNodeConnection[] // Connections TO this node (inputs)
  setProperty(name: string, value: any): void
  setOutput(name: string, value: any): void
  addInputConnection(sourceNodeId: string, sourceOutput: string, targetInput: string): void
  removeInputConnection(sourceNodeId: string, sourceOutput: string, targetInput: string): void
  clearInputConnections(): void
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
  disconnectNodes(sourceId: string, targetId: string, outputName: string, inputName: string): void
  clear(): void
}

// Observable custom node state
export class CustomNodeState implements ICustomNodeState {
  id: string
  nodeType: string
  properties = new Map<string, any>()
  outputs = new Map<string, any>()
  inputConnections: ICustomNodeConnection[] = []

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
      inputConnections: observable,
      setProperty: action,
      setOutput: action,
      addInputConnection: action,
      removeInputConnection: action,
      clearInputConnections: action,
    })
  }

  setProperty(name: string, value: any): void {
    this.properties.set(name, value)

    // For certain node types, also update outputs when properties change
    if (this.nodeType === 'SliderNode' && name === 'value') {
      this.setOutput('value', value)
    } else if (this.nodeType === 'DisplayNode' && name === 'currentValue') {
      this.setOutput('output', value)
    }
  }

  setOutput(name: string, value: any): void {
    this.outputs.set(name, value)
  }

  addInputConnection(sourceNodeId: string, sourceOutput: string, targetInput: string): void {
    const sourceNode = customNodeStore.getNode(sourceNodeId)
    if (!sourceNode) {
      console.error(`❌ Cannot connect: source node ${sourceNodeId} not found`)
      return
    }

    console.log(
      `🔗 Creating reactive connection: ${sourceNode.nodeType}(${sourceNodeId}).${sourceOutput} → ${this.nodeType}(${this.id}).${targetInput}`
    )

    // Create MobX reaction to automatically update target when source changes
    // Use computed approach to properly observe the Map entry
    const disposer = reaction(
      // Observable: watch the source output by accessing the Map reactively
      () => {
        // This creates a reactive dependency on the specific Map entry
        // by accessing the Map during the reaction tracking
        return sourceNode.outputs.has(sourceOutput)
          ? sourceNode.outputs.get(sourceOutput)
          : undefined
      },
      // Effect: update target when source changes
      value => {
        if (value !== undefined && value !== null) {
          console.log(
            `⚡ Reactive update: ${sourceNode.nodeType}(${sourceNodeId}).${sourceOutput} = ${value} → ${this.nodeType}(${this.id}).${targetInput}`
          )
          this.updateTargetInput(value, targetInput)
        }
      },
      {
        name: `${sourceNodeId}.${sourceOutput} → ${this.id}.${targetInput}`,
        fireImmediately: true, // Apply current value immediately
      }
    )

    // Store connection with disposer
    this.inputConnections.push({
      sourceNodeId,
      sourceOutput,
      targetInput,
      disposer,
    })
  }

  removeInputConnection(sourceNodeId: string, sourceOutput: string, targetInput: string): void {
    const connectionIndex = this.inputConnections.findIndex(
      conn =>
        conn.sourceNodeId === sourceNodeId &&
        conn.sourceOutput === sourceOutput &&
        conn.targetInput === targetInput
    )

    if (connectionIndex >= 0) {
      const connection = this.inputConnections[connectionIndex]
      console.log(
        `🔌 Removing reactive connection: ${sourceNodeId}.${sourceOutput} → ${this.nodeType}(${this.id}).${targetInput}`
      )

      // Dispose the MobX reaction
      connection.disposer()

      // Remove from connections array
      this.inputConnections.splice(connectionIndex, 1)
    }
  }

  clearInputConnections(): void {
    console.log(`🧹 Clearing all connections for ${this.nodeType}(${this.id})`)

    // Dispose all reactions
    this.inputConnections.forEach(conn => conn.disposer())

    // Clear connections array
    this.inputConnections.length = 0
  }

  // Update target node input based on node type
  private updateTargetInput(value: any, targetInput: string): void {
    if (this.nodeType === 'DisplayNode' && targetInput === 'input') {
      const numValue = Number(value) || 0
      this.setProperty('currentValue', numValue)
    } else if (this.nodeType === 'MidiToFreqNode' && targetInput === 'midiNote') {
      const midiNote = Number(value) || 0
      const frequency = this.midiToFrequency(midiNote)
      this.setOutput('frequency', frequency)
    } else if (this.nodeType === 'SoundFileNode' && targetInput === 'trigger' && value > 0) {
      console.log(`🎯 MobX SoundFileNode ${this.id}: Trigger received with value ${value}`)
      this.performSoundFileTrigger()
    }
    // Add more node type handling as needed
  }

  // Node-specific methods
  setValue(value: any): void {
    if (this.nodeType === 'SliderNode' && typeof value === 'number') {
      this.setProperty('value', value) // This will also update output via setProperty
    } else if (this.nodeType === 'DisplayNode') {
      if (typeof value === 'number') {
        this.setProperty('currentValue', value) // This will also update output via setProperty
      } else if (typeof value === 'string') {
        this.setProperty('label', value)
      }
    }
  }

  trigger(): void {
    if (this.nodeType === 'ButtonNode') {
      const outputValue = this.properties.get('outputValue') || 1
      this.setOutput('trigger', outputValue)
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

      // Create a copy of the ArrayBuffer before using it for decoding
      // This prevents the original from being detached by decodeAudioData
      const arrayBufferCopy = arrayBuffer.slice(0)

      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBufferCopy)

      // Now we can safely use the original arrayBuffer for base64 conversion
      const audioBufferData = this.arrayBufferToBase64(arrayBuffer)
      this.setProperty('audioData', audioBufferData)
      this.setProperty('fileName', file.name)
      this.setProperty('fileSize', file.size)

      // Update outputs
      this.setOutput('loaded', 1)

      console.log(`🎵 MobX SoundFileNode: Successfully loaded ${file.name}`)
      console.log(`   - Duration: ${this.audioBuffer.duration.toFixed(2)}s`)
      console.log(`   - Sample rate: ${this.audioBuffer.sampleRate}Hz`)
      console.log(`   - Channels: ${this.audioBuffer.numberOfChannels}`)
    } catch (error) {
      console.error('🚨 MobX SoundFileNode: Error loading audio file:', error)
      this.setOutput('loaded', 0)
    }
  }

  // SoundFileNode specific methods
  private setupAudioNodes(): void {
    if (this.nodeType !== 'SoundFileNode' || !this.audioContext) return

    // Create gain node for volume control and output
    this.gainNode = this.audioContext.createGain()
    this.gainNode.gain.value = this.properties.get('gain') || 1

    console.log(`🔧 MobX SoundFileNode: Audio nodes created`)
  }

  private async restoreAudioBufferFromProperties(): Promise<void> {
    if (this.nodeType !== 'SoundFileNode' || !this.audioContext) return

    const audioBufferData = this.properties.get('audioData')
    const fileName = this.properties.get('fileName')

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

        console.log(`✅ MobX SoundFileNode: Successfully restored audio buffer for ${fileName}`)
        console.log(`   - Duration: ${this.audioBuffer.duration.toFixed(2)}s`)
        console.log(`   - Sample rate: ${this.audioBuffer.sampleRate}Hz`)
        console.log(`   - Channels: ${this.audioBuffer.numberOfChannels}`)
      } catch (error) {
        console.error('🚨 MobX SoundFileNode: Error restoring audio buffer:', error)
        this.setOutput('loaded', 0)
        console.warn('🔄 MobX SoundFileNode: Audio data preserved - user can try reloading')
      }
    } else {
      console.log(`⚠️ MobX SoundFileNode: No stored audio data found`)
      this.setOutput('loaded', 0)
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    // Check if the ArrayBuffer is detached and create a copy if needed
    try {
      // First try to create the Uint8Array directly
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      return btoa(binary)
    } catch (error) {
      // If the ArrayBuffer is detached, we need to handle this gracefully
      if (error instanceof TypeError && error.message.includes('detached')) {
        console.error('🚨 MobX SoundFileNode: ArrayBuffer is detached, cannot convert to base64')
        throw new Error(
          'Cannot process audio file: ArrayBuffer is detached. Please try loading the file again.'
        )
      }
      // Re-throw other errors
      throw error
    }
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
      disconnectNodes: action,
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
    const node = this.nodes.get(id)
    if (node) {
      // Clear all connections (this will dispose all reactions)
      node.clearInputConnections()

      // Also remove any connections FROM this node to other nodes
      this.nodes.forEach(otherNode => {
        if (otherNode.id !== id) {
          const connectionsFromRemove = otherNode.inputConnections.filter(
            conn => conn.sourceNodeId === id
          )
          connectionsFromRemove.forEach(conn => {
            otherNode.removeInputConnection(conn.sourceNodeId, conn.sourceOutput, conn.targetInput)
          })
        }
      })
    }

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
    const targetNode = this.getNode(targetId)
    if (targetNode) {
      targetNode.addInputConnection(sourceId, outputName, inputName)
    }
  }

  disconnectNodes(sourceId: string, targetId: string, outputName: string, inputName: string): void {
    const targetNode = this.getNode(targetId)
    if (targetNode) {
      targetNode.removeInputConnection(sourceId, outputName, inputName)
    }
  }

  clear(): void {
    // Clear all connections (dispose all reactions) before clearing nodes
    this.nodes.forEach(node => node.clearInputConnections())
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
