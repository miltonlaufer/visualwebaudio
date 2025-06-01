import { types, Instance, getRoot, IDisposer } from 'mobx-state-tree'
import { reaction } from 'mobx'

// MobX State Tree model for custom node connection
const CustomNodeConnection = types
  .model('CustomNodeConnection', {
    sourceNodeId: types.string,
    sourceOutput: types.string,
    targetInput: types.string,
  })
  .volatile(() => ({
    disposer: null as IDisposer | null, // MobX reaction disposer stored in volatile state
  }))
  .actions(self => ({
    setDisposer(disposer: IDisposer | null) {
      self.disposer = disposer
    },
    dispose() {
      if (self.disposer) {
        self.disposer()
        self.disposer = null
      }
    },
  }))

// MobX State Tree model for custom node state
const CustomNodeState = types
  .model('CustomNodeState', {
    id: types.identifier,
    nodeType: types.string,
    properties: types.map(types.frozen()),
    outputs: types.map(types.frozen()),
    inputConnections: types.array(CustomNodeConnection),
  })
  .volatile(() => ({
    // Audio functionality for SoundFileNode (non-serializable, stored in volatile state)
    audioContext: undefined as AudioContext | undefined,
    gainNode: undefined as GainNode | undefined,
    audioBuffer: undefined as AudioBuffer | undefined,
    bufferSource: undefined as AudioBufferSourceNode | undefined,
    // MIDI functionality for MidiInputNode (non-serializable, stored in volatile state)
    midiAccess: undefined as MIDIAccess | undefined,
    selectedMidiDevice: undefined as string | undefined,
  }))
  .actions(self => {
    return {
      setProperty(name: string, value: any): void {
        console.log(`📝 CustomNode ${self.id}: Setting property ${name} = ${value}`)
        self.properties.set(name, value)

        // For certain node types, also update outputs when properties change
        if (self.nodeType === 'SliderNode' && name === 'value') {
          this.setOutput('value', value)
        } else if (self.nodeType === 'DisplayNode' && name === 'currentValue') {
          this.setOutput('output', value)
        }
      },

      setOutput(name: string, value: any): void {
        console.log(`📤 CustomNode ${self.id}: Setting output ${name} = ${value}`)
        self.outputs.set(name, value)
      },

      setValue(value: any): void {
        if (self.nodeType === 'SliderNode') {
          this.setProperty('value', value)
          this.setOutput('value', value)
        }
      },

      trigger(): void {
        console.log(`⚡ CustomNode ${self.id}: Triggered`)
        this.setOutput('trigger', Date.now())
      },

      addInputConnection(sourceNodeId: string, sourceOutput: string, targetInput: string): void {
        const store = getRoot<ICustomNodeStore>(self)
        const sourceNode = store.getNode(sourceNodeId)
        if (!sourceNode) {
          console.error(`❌ Cannot connect: source node ${sourceNodeId} not found`)
          return
        }

        console.log(
          `🔗 Creating reactive connection: ${sourceNode.nodeType}(${sourceNodeId}).${sourceOutput} → ${self.nodeType}(${self.id}).${targetInput}`
        )

        // Create connection first
        const connection = CustomNodeConnection.create({
          sourceNodeId,
          sourceOutput,
          targetInput,
        })

        // Create MobX reaction to automatically update target when source changes
        const disposer = reaction(
          // Observable: watch the source output
          () => {
            return sourceNode.outputs.has(sourceOutput)
              ? sourceNode.outputs.get(sourceOutput)
              : undefined
          },
          // Effect: update target when source changes
          value => {
            if (value !== undefined && value !== null) {
              console.log(
                `⚡ Reactive update: ${sourceNode.nodeType}(${sourceNodeId}).${sourceOutput} = ${value} → ${self.nodeType}(${self.id}).${targetInput}`
              )
              this.updateTargetInput(value, targetInput)
            }
          },
          {
            name: `${sourceNodeId}.${sourceOutput} → ${self.id}.${targetInput}`,
            fireImmediately: true,
          }
        )

        // Set disposer through action
        connection.setDisposer(disposer)
        self.inputConnections.push(connection)
      },

      removeInputConnection(sourceNodeId: string, sourceOutput: string, targetInput: string): void {
        const connectionIndex = self.inputConnections.findIndex(
          conn =>
            conn.sourceNodeId === sourceNodeId &&
            conn.sourceOutput === sourceOutput &&
            conn.targetInput === targetInput
        )

        if (connectionIndex >= 0) {
          const connection = self.inputConnections[connectionIndex]
          console.log(
            `🔌 Removing reactive connection: ${sourceNodeId}.${sourceOutput} → ${self.nodeType}(${self.id}).${targetInput}`
          )

          // Dispose the MobX reaction
          connection.dispose()

          // Remove from connections array
          self.inputConnections.splice(connectionIndex, 1)
        }
      },

      clearInputConnections(): void {
        console.log(`🧹 CustomNode ${self.id}: Clearing all input connections`)
        self.inputConnections.forEach(conn => {
          conn.dispose()
        })
        self.inputConnections.clear()
      },

      // Update target node input based on node type
      updateTargetInput(value: any, targetInput: string): void {
        if (self.nodeType === 'DisplayNode' && targetInput === 'input') {
          const numValue = Number(value) || 0
          this.setProperty('currentValue', numValue)
        } else if (self.nodeType === 'MidiToFreqNode' && targetInput === 'midiNote') {
          const midiNote = Number(value) || 0
          const frequency = this.midiToFrequency(midiNote)
          this.setOutput('frequency', frequency)
        } else if (self.nodeType === 'SoundFileNode' && targetInput === 'trigger' && value > 0) {
          console.log(`🎯 MST SoundFileNode ${self.id}: Trigger received with value ${value}`)
          this.performSoundFileTrigger()
        }
      },

      // MIDI to frequency conversion
      midiToFrequency(midiNote: number): number {
        // MIDI note 69 (A4) = 440 Hz
        // Formula: f = 440 * 2^((n-69)/12)
        return 440 * Math.pow(2, (midiNote - 69) / 12)
      },

      updateAudioContext(audioContext: AudioContext): void {
        if (self.nodeType === 'SoundFileNode') {
          console.log(
            `🔄 MST SoundFileNode: Updating audio context from ${self.audioContext?.state} to ${audioContext.state}`
          )
          self.audioContext = audioContext
          this.setupAudioNodes()
          this.restoreAudioBufferFromProperties()
          console.log(`✅ MST SoundFileNode: Audio context updated and nodes recreated`)
        }
      },

      async loadAudioFile(file: File): Promise<void> {
        if (self.nodeType !== 'SoundFileNode' || !self.audioContext) {
          return
        }

        try {
          const arrayBuffer = await file.arrayBuffer()
          const arrayBufferCopy = arrayBuffer.slice(0)

          const audioBuffer = await self.audioContext.decodeAudioData(arrayBufferCopy)

          // Update state in a synchronous action
          this.updateAudioFileState(audioBuffer, arrayBuffer, file.name, file.size)

          console.log(`🎵 MST SoundFileNode: Successfully loaded ${file.name}`)
          console.log(`   - Duration: ${audioBuffer.duration.toFixed(2)}s`)
          console.log(`   - Sample rate: ${audioBuffer.sampleRate}Hz`)
          console.log(`   - Channels: ${audioBuffer.numberOfChannels}`)
        } catch (error) {
          console.error('🚨 MST SoundFileNode: Error loading audio file:', error)
          this.setOutput('loaded', 0)
        }
      },

      updateAudioFileState(
        audioBuffer: AudioBuffer,
        arrayBuffer: ArrayBuffer,
        fileName: string,
        fileSize: number
      ): void {
        if (self.nodeType !== 'SoundFileNode') return

        self.audioBuffer = audioBuffer
        const audioBufferData = this.arrayBufferToBase64(arrayBuffer)
        this.setProperty('audioData', audioBufferData)
        this.setProperty('fileName', fileName)
        this.setProperty('fileSize', fileSize)
        this.setOutput('loaded', 1)
      },

      // SoundFileNode specific methods
      setupAudioNodes(): void {
        if (self.nodeType !== 'SoundFileNode' || !self.audioContext) return

        self.gainNode = self.audioContext.createGain()
        self.gainNode.gain.value = self.properties.get('gain') || 1

        console.log(`🔧 MST SoundFileNode: Audio nodes created`)
      },

      async restoreAudioBufferFromProperties(): Promise<void> {
        if (self.nodeType !== 'SoundFileNode' || !self.audioContext) return

        const audioBufferData = self.properties.get('audioData')
        const fileName = self.properties.get('fileName')

        if (audioBufferData && fileName) {
          try {
            console.log(`🎵 MST SoundFileNode: Restoring audio buffer for ${fileName}`)

            if (typeof audioBufferData !== 'string') {
              console.error('🚨 audioBufferData is not a string:', typeof audioBufferData)
              throw new Error('Invalid audioBufferData format - expected base64 string')
            }

            const arrayBuffer = this.base64ToArrayBuffer(audioBufferData)
            const audioBuffer = await self.audioContext.decodeAudioData(arrayBuffer)

            // Update state in a synchronous action
            this.restoreAudioBufferState(audioBuffer)

            console.log(`✅ MST SoundFileNode: Successfully restored audio buffer for ${fileName}`)
          } catch (error) {
            console.error('🚨 MST SoundFileNode: Error restoring audio buffer:', error)
            this.setOutput('loaded', 0)
          }
        } else {
          console.log(`⚠️ MST SoundFileNode: No stored audio data found`)
          this.setOutput('loaded', 0)
        }
      },

      restoreAudioBufferState(audioBuffer: AudioBuffer): void {
        if (self.nodeType !== 'SoundFileNode') return

        self.audioBuffer = audioBuffer
        this.setOutput('loaded', 1)
      },

      arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        return btoa(binary)
      },

      base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = atob(base64)
        const len = binaryString.length
        const bytes = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes.buffer
      },

      performSoundFileTrigger(): void {
        if (
          self.nodeType !== 'SoundFileNode' ||
          !self.audioContext ||
          !self.audioBuffer ||
          !self.gainNode
        ) {
          console.warn(
            'MST SoundFileNode: Cannot trigger - missing audio context, buffer, or gain node'
          )
          return
        }

        if (self.bufferSource) {
          try {
            self.bufferSource.stop()
            self.bufferSource.disconnect()
          } catch {
            console.log('MST SoundFileNode: Previous buffer source already stopped')
          }
        }

        self.bufferSource = self.audioContext.createBufferSource()
        self.bufferSource.buffer = self.audioBuffer
        self.bufferSource.loop = self.properties.get('loop') || false
        self.bufferSource.playbackRate.value = self.properties.get('playbackRate') || 1

        self.gainNode.gain.value = self.properties.get('gain') || 1
        self.bufferSource.connect(self.gainNode)
        self.bufferSource.start()
        console.log('MST SoundFileNode: Audio playback started')
      },

      // Timer-specific actions
      fireTimerTrigger(count: number): void {
        if (self.nodeType !== 'TimerNode') return

        this.setOutput('trigger', 1)
        this.setOutput('count', count)
        this.setProperty('count', count)

        console.log(`MST TimerNode ${self.id}: Trigger fired (count: ${count})`)

        // Reset trigger output after a brief moment
        setTimeout(() => {
          this.resetTimerTrigger()
        }, 10)
      },

      resetTimerTrigger(): void {
        if (self.nodeType !== 'TimerNode') return

        this.setOutput('trigger', 0)
      },

      resetTimerCount(): void {
        if (self.nodeType !== 'TimerNode') return

        this.setOutput('count', 0)
        this.setProperty('count', 0)
        console.log(`MST TimerNode ${self.id}: Timer reset`)
      },

      // MIDI Input Node functionality
      setMidiAccess(midiAccess: MIDIAccess): void {
        if (self.nodeType !== 'MidiInputNode') return

        console.log(`🎹 MidiInputNode ${self.id}: Setting MIDI access`)
        self.midiAccess = midiAccess
        this.setupMidiListeners()
      },

      setSelectedMidiDevice(deviceId: string): void {
        if (self.nodeType !== 'MidiInputNode') return

        console.log(`🎹 MidiInputNode ${self.id}: Setting selected device to ${deviceId}`)
        self.selectedMidiDevice = deviceId
        this.setProperty('selectedDeviceId', deviceId)

        // Re-setup listeners with new device selection
        if (self.midiAccess) {
          this.setupMidiListeners()
        }
      },

      setupMidiListeners(): void {
        if (self.nodeType !== 'MidiInputNode' || !self.midiAccess) return

        const channel = self.properties.get('channel') || 1
        console.log(`🎹 MidiInputNode ${self.id}: Setting up MIDI listeners for channel ${channel}`)

        self.midiAccess.inputs.forEach((input: MIDIInput) => {
          // Only listen to selected device if one is specified
          if (self.selectedMidiDevice && input.id !== self.selectedMidiDevice) {
            input.onmidimessage = null
            return
          }

          input.onmidimessage = (event: MIDIMessageEvent) => {
            if (!event.data || event.data.length < 2) return

            const status = event.data[0]
            const data1 = event.data[1]
            const data2 = event.data.length > 2 ? event.data[2] : 0
            const messageChannel = (status & 0x0f) + 1

            if (messageChannel === channel) {
              const messageType = status & 0xf0

              switch (messageType) {
                case 0x90: // Note on
                  this.setOutput('note', data1)
                  this.setOutput('velocity', data2)
                  break

                case 0x80: // Note off
                  this.setOutput('note', data1)
                  this.setOutput('velocity', 0)
                  break

                case 0xb0: // Control change
                  this.setOutput('cc', data2)
                  break

                case 0xe0: {
                  // Pitch bend
                  const pitchValue = (data2 << 7) | data1
                  this.setOutput('pitch', pitchValue)
                  break
                }
              }
            }
          }
        })
      },

      clearMidiListeners(): void {
        if (self.nodeType !== 'MidiInputNode' || !self.midiAccess) return

        console.log(`🎹 MidiInputNode ${self.id}: Clearing MIDI listeners`)
        self.midiAccess.inputs.forEach((input: MIDIInput) => {
          input.onmidimessage = null
        })
      },
    }
  })

// MobX State Tree model for the store
const CustomNodeStore = types
  .model('CustomNodeStore', {
    nodes: types.map(CustomNodeState),
  })
  .volatile(() => ({
    bridgeUpdateCallback: undefined as
      | ((nodeId: string, outputName: string, value: number) => void)
      | undefined,
  }))
  .actions(self => {
    return {
      addNode(id: string, nodeType: string, metadata: any): ICustomNodeState {
        // Create properties object (plain object for MST Map)
        const propertiesObj: Record<string, any> = {}
        if (metadata && metadata.properties) {
          metadata.properties.forEach((prop: any) => {
            propertiesObj[prop.name] = prop.defaultValue
          })
        }

        // Create outputs object (plain object for MST Map)
        const outputsObj: Record<string, any> = {}
        if (metadata && metadata.outputs) {
          metadata.outputs.forEach((output: any) => {
            outputsObj[output.name] = null
          })
        }

        // Set initial values for specific node types
        if (nodeType === 'SliderNode') {
          const initialValue = propertiesObj['value'] || 50
          outputsObj['value'] = initialValue
        } else if (nodeType === 'DisplayNode') {
          const initialValue = propertiesObj['currentValue'] || 0
          outputsObj['output'] = initialValue
        } else if (nodeType === 'SoundFileNode') {
          console.log(`🎵 Creating MST SoundFileNode ${id}`)
          outputsObj['loaded'] = 0
        }

        const node = CustomNodeState.create({
          id,
          nodeType,
          properties: propertiesObj,
          outputs: outputsObj,
          inputConnections: [],
        })

        self.nodes.set(id, node)

        // Set up reaction to trigger bridge updates when outputs change
        reaction(
          (): Array<[string, any]> => Array.from(node.outputs.entries()),
          (outputs: Array<[string, any]>) => {
            outputs.forEach(([outputName, value]) => {
              if (self.bridgeUpdateCallback && typeof value === 'number') {
                console.log(`🌉 MST reaction: Bridge update for ${id} ${outputName}: ${value}`)
                self.bridgeUpdateCallback(id, outputName, value)
              }
            })
          },
          { fireImmediately: false }
        )

        return node
      },

      removeNode(id: string): void {
        const node = self.nodes.get(id)
        if (node) {
          // Clear all connections (this will dispose all reactions)
          node.clearInputConnections()

          // Also remove any connections FROM this node to other nodes
          self.nodes.forEach(otherNode => {
            if (otherNode.id !== id) {
              const connectionsFromRemoved = otherNode.inputConnections.filter(
                conn => conn.sourceNodeId === id
              )
              connectionsFromRemoved.forEach(conn => {
                otherNode.removeInputConnection(
                  conn.sourceNodeId,
                  conn.sourceOutput,
                  conn.targetInput
                )
              })
            }
          })

          self.nodes.delete(id)
          console.log(`🗑️ CustomNode ${id}: Removed from store`)
        }
      },

      getNode(id: string): ICustomNodeState | undefined {
        return self.nodes.get(id)
      },

      setBridgeUpdateCallback(
        callback: (nodeId: string, outputName: string, value: number) => void
      ): void {
        self.bridgeUpdateCallback = callback
      },

      connectNodes(
        sourceId: string,
        sourceOutput: string,
        targetId: string,
        targetInput: string
      ): void {
        const targetNode = this.getNode(targetId)
        if (targetNode) {
          targetNode.addInputConnection(sourceId, sourceOutput, targetInput)
        }
      },

      disconnectNodes(
        sourceId: string,
        sourceOutput: string,
        targetId: string,
        targetInput: string
      ): void {
        const targetNode = this.getNode(targetId)
        if (targetNode) {
          targetNode.removeInputConnection(sourceId, sourceOutput, targetInput)
        }
      },

      setAudioContext(audioContext: AudioContext): void {
        self.nodes.forEach(node => {
          node.updateAudioContext(audioContext)
        })
      },

      clear(): void {
        self.nodes.forEach(node => {
          node.clearInputConnections()
        })
        self.nodes.clear()
        console.log('🧹 CustomNodeStore: All nodes cleared')
      },
    }
  })

// MST Interfaces
export interface ICustomNodeConnection extends Instance<typeof CustomNodeConnection> {}
export interface ICustomNodeState extends Instance<typeof CustomNodeState> {}
export interface ICustomNodeStore extends Instance<typeof CustomNodeStore> {}

// Create and export the singleton store instance
export const customNodeStore = CustomNodeStore.create({
  nodes: {},
})

// Export the MST models for testing
export { CustomNodeStore, CustomNodeState }
