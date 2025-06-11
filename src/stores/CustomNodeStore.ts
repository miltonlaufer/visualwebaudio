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
        try {
          self.properties.set(name, value)

          // For certain node types, also update outputs when properties change
          if (self.nodeType === 'SliderNode' && name === 'value') {
            this.setOutput('value', value)
          } else if (self.nodeType === 'DisplayNode' && name === 'currentValue') {
            this.setOutput('output', value)
          }
        } catch (error) {
          // Node was detached from MST tree, ignore
          console.error(`[${self.nodeType}] Node ${self.id} detached, cannot set property:`, error)
        }
      },

      setOutput(name: string, value: any): void {
        try {
          self.outputs.set(name, value)
        } catch (error) {
          // Node was detached from MST tree, ignore
          console.error(`[${self.nodeType}] Node ${self.id} detached, cannot set output:`, error)
        }
      },

      setValue(value: any): void {
        if (self.nodeType === 'SliderNode') {
          this.setProperty('value', value)
          this.setOutput('value', value)
        }
      },

      trigger(): void {
        this.setOutput('trigger', Date.now())
      },

      addInputConnection(sourceNodeId: string, sourceOutput: string, targetInput: string): void {
        const store = getRoot<ICustomNodeStore>(self)
        const sourceNode = store.getNode(sourceNodeId)
        if (!sourceNode) {
          console.error(`❌ Cannot connect: source node ${sourceNodeId} not found`)
          return
        }

        // Check if connection already exists to prevent duplicates
        const existingConnection = self.inputConnections.find(
          conn =>
            conn.sourceNodeId === sourceNodeId &&
            conn.sourceOutput === sourceOutput &&
            conn.targetInput === targetInput
        )

        if (existingConnection) {
          /* console.log(
            `🔗 Connection already exists: ${sourceNode.nodeType}(${sourceNodeId}).${sourceOutput} → ${self.nodeType}(${self.id}).${targetInput}`
          ) */
          return
        }

        /* console.log(
          `🔗 Creating reactive connection: ${sourceNode.nodeType}(${sourceNodeId}).${sourceOutput} → ${self.nodeType}(${self.id}).${targetInput}`
        ) */

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
              /* console.log(
                `⚡ Reactive update: ${sourceNode.nodeType}(${sourceNodeId}).${sourceOutput} = ${value} → ${self.nodeType}(${self.id}).${targetInput}`
              ) */
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
          /* console.log(
            `🔌 Removing reactive connection: ${sourceNodeId}.${sourceOutput} → ${self.nodeType}(${self.id}).${targetInput}`
          ) */

          // Dispose the MobX reaction
          connection.dispose()

          // Remove from connections array
          self.inputConnections.splice(connectionIndex, 1)
        }
      },

      clearInputConnections(): void {
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
        } else if (self.nodeType === 'ScaleToMidiNode' && targetInput === 'scaleDegree') {
          const scaleDegree = Number(value) || 0
          this.setProperty('scaleDegree', scaleDegree)
          this.updateScaleToMidiOutput()
        } else if (self.nodeType === 'SoundFileNode' && targetInput === 'trigger' && value > 0) {
          this.performSoundFileTrigger()
        }
      },

      // Initialize ScaleToMidiNode outputs
      initializeScaleToMidiNode(): void {
        if (self.nodeType !== 'ScaleToMidiNode') return

        // Set default properties if not already set
        if (!self.properties.has('scaleDegree')) this.setProperty('scaleDegree', 0)
        if (!self.properties.has('key')) this.setProperty('key', 'C')
        if (!self.properties.has('mode')) this.setProperty('mode', 'major')

        // Calculate initial output
        this.updateScaleToMidiOutput()
      },

      // MIDI to frequency conversion
      midiToFrequency(midiNote: number): number {
        // MIDI note 69 (A4) = 440 Hz
        // Formula: f = 440 * 2^((n-69)/12)
        return 440 * Math.pow(2, (midiNote - 69) / 12)
      },

      // Scale to MIDI conversion and output update
      updateScaleToMidiOutput(): void {
        if (self.nodeType !== 'ScaleToMidiNode') return

        const scaleDegree = self.properties.get('scaleDegree') || 0
        const key = self.properties.get('key') || 'C'
        const mode = self.properties.get('mode') || 'major'

        const midiNote = this.scaleToMidi(scaleDegree, key, mode)
        const frequency = this.midiToFrequency(midiNote)

        this.setProperty('midiNote', midiNote)
        this.setProperty('frequency', frequency)
        this.setOutput('midiNote', midiNote)
        this.setOutput('frequency', frequency)
      },

      scaleToMidi(scaleDegree: number, key: string, mode: string): number {
        // Scale intervals for different modes
        const SCALE_INTERVALS: Record<string, number[]> = {
          major: [0, 2, 4, 5, 7, 9, 11],
          minor: [0, 2, 3, 5, 7, 8, 10],
          dorian: [0, 2, 3, 5, 7, 9, 10],
          phrygian: [0, 1, 3, 5, 7, 8, 10],
          lydian: [0, 2, 4, 6, 7, 9, 11],
          mixolydian: [0, 2, 4, 5, 7, 9, 10],
          locrian: [0, 1, 3, 5, 6, 8, 10],
          pentatonic_major: [0, 2, 4, 7, 9],
          pentatonic_minor: [0, 3, 5, 7, 10],
          blues: [0, 3, 5, 6, 7, 10],
          harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
          melodic_minor: [0, 2, 3, 5, 7, 9, 11],
        }

        // MIDI note numbers for each key at octave 4
        const KEY_TO_MIDI: Record<string, number> = {
          C: 60,
          'C#': 61,
          D: 62,
          'D#': 63,
          E: 64,
          F: 65,
          'F#': 66,
          G: 67,
          'G#': 68,
          A: 69,
          'A#': 70,
          B: 71,
        }

        const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.major
        const rootMidi = KEY_TO_MIDI[key] || 60

        // Handle negative scale degrees
        const octaveOffset = Math.floor(scaleDegree / intervals.length)
        const normalizedDegree =
          ((scaleDegree % intervals.length) + intervals.length) % intervals.length

        // Get the interval for this scale degree
        const interval = intervals[normalizedDegree]

        // Calculate final MIDI note
        const midiNote = rootMidi + interval + octaveOffset * 12

        // Clamp to valid MIDI range (0-127)
        return Math.max(0, Math.min(127, midiNote))
      },

      updateAudioContext(audioContext: AudioContext): void {
        if (self.nodeType === 'SoundFileNode') {
          /* console.log(
            `🔄 MST SoundFileNode: Updating audio context from ${self.audioContext?.state} to ${audioContext.state}`
          ) */
          self.audioContext = audioContext
          this.setupAudioNodes()
          this.restoreAudioBufferFromProperties()
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
      },

      async restoreAudioBufferFromProperties(): Promise<void> {
        if (self.nodeType !== 'SoundFileNode' || !self.audioContext) return

        const audioBufferData = self.properties.get('audioData')
        const fileName = self.properties.get('fileName')

        if (audioBufferData && fileName) {
          try {
            if (typeof audioBufferData !== 'string') {
              console.error('🚨 audioBufferData is not a string:', typeof audioBufferData)
              throw new Error('Invalid audioBufferData format - expected base64 string')
            }

            const arrayBuffer = this.base64ToArrayBuffer(audioBufferData)
            const audioBuffer = await self.audioContext.decodeAudioData(arrayBuffer)

            // Update state in a synchronous action
            this.restoreAudioBufferState(audioBuffer)
          } catch (error) {
            console.error('🚨 MST SoundFileNode: Error restoring audio buffer:', error)
            this.setOutput('loaded', 0)
          }
        } else {
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
            console.error('MST SoundFileNode: Error stopping previous buffer source')
          }
        }

        self.bufferSource = self.audioContext.createBufferSource()
        self.bufferSource.buffer = self.audioBuffer
        self.bufferSource.loop = self.properties.get('loop') || false
        self.bufferSource.playbackRate.value = self.properties.get('playbackRate') || 1

        self.gainNode.gain.value = self.properties.get('gain') || 1
        self.bufferSource.connect(self.gainNode)
        self.bufferSource.start()
      },

      // Timer-specific actions
      fireTimerTrigger(count: number): void {
        if (self.nodeType !== 'TimerNode') return

        try {
          // Use timestamp like ButtonNode to ensure unique trigger values
          this.setOutput('trigger', Date.now())
          this.setOutput('count', count)
          this.setProperty('count', count)
        } catch (error) {
          // Node was detached from MST tree, ignore
          console.error(`[TimerNode] Node ${self.id} detached, cannot fire trigger:`, error)
        }
      },

      resetTimerCount(): void {
        if (self.nodeType !== 'TimerNode') return

        try {
          this.setOutput('count', 0)
          this.setProperty('count', 0)
          this.setProperty('isRunning', 'false')
        } catch (error) {
          // Node was detached from MST tree, ignore
          console.error(`[TimerNode] Node ${self.id} detached, cannot reset timer count:`, error)
        }
      },

      startTimer(): void {
        if (self.nodeType !== 'TimerNode') return

        const isRunning = (self.properties.get('isRunning') || 'false') === 'true'
        const enabled = (self.properties.get('enabled') || 'true') === 'true'

        if (isRunning || !enabled) {
          return
        }

        const delay = self.properties.get('delay') || 1000
        const mode = self.properties.get('mode') || 'loop'

        this.setProperty('isRunning', 'true')

        // Start with initial delay
        const timeoutId = window.setTimeout(() => {
          // CRITICAL: Check if node is still attached to MST tree before accessing properties
          try {
            // Check if timer is still running (might have been stopped)
            if ((self.properties.get('isRunning') || 'false') === 'true') {
              const currentCount = (self.properties.get('count') || 0) + 1
              this.fireTimerTrigger(currentCount)

              // If loop mode, start interval
              if (mode === 'loop' && (self.properties.get('isRunning') || 'false') === 'true') {
                const interval = self.properties.get('interval') || 1000
                const intervalId = window.setInterval(() => {
                  // CRITICAL: Check if node is still attached to MST tree
                  try {
                    // Check if timer is still running
                    if ((self.properties.get('isRunning') || 'false') === 'true') {
                      const currentCount = (self.properties.get('count') || 0) + 1
                      this.fireTimerTrigger(currentCount)
                    } else {
                      // Timer was stopped, clear interval
                      clearInterval(intervalId)
                    }
                  } catch (error) {
                    // Node was detached from MST tree, clear interval
                    console.error(`[TimerNode] Node ${self.id} detached, clearing interval:`, error)
                    clearInterval(intervalId)
                  }
                }, interval)

                // Store interval ID for cleanup
                this.setProperty('_intervalId', intervalId)
              } else {
                // One-shot mode, stop after first trigger
                this.setProperty('isRunning', 'false')
              }
            }
          } catch (error) {
            // Node was detached from MST tree, ignore
            console.error(`[TimerNode] Node ${self.id} detached, ignoring timeout:`, error)
          }
        }, delay)

        // Store timeout ID for cleanup
        this.setProperty('_timeoutId', timeoutId)
      },

      stopTimer(): void {
        if (self.nodeType !== 'TimerNode') return

        try {
          // Clear any running timers
          const timeoutId = self.properties.get('_timeoutId')
          const intervalId = self.properties.get('_intervalId')

          if (timeoutId) {
            clearTimeout(timeoutId)
            this.setProperty('_timeoutId', undefined)
          }

          if (intervalId) {
            clearInterval(intervalId)
            this.setProperty('_intervalId', undefined)
          }

          this.setProperty('isRunning', 'false')
        } catch (error) {
          // Node was detached from MST tree, ignore
          console.error(`[TimerNode] Node ${self.id} detached, cannot stop timer:`, error)
        }
      },

      resetTimer(): void {
        if (self.nodeType !== 'TimerNode') return

        try {
          this.stopTimer()
          this.setOutput('count', 0)
          this.setProperty('count', 0)
        } catch (error) {
          // Node was detached from MST tree, ignore
          console.error(`[TimerNode] Node ${self.id} detached, cannot reset timer:`, error)
        }
      },

      // MIDI Input Node functionality
      setMidiAccess(midiAccess: MIDIAccess): void {
        if (self.nodeType !== 'MidiInputNode') return

        self.midiAccess = midiAccess
        this.setupMidiListeners()
      },

      setSelectedMidiDevice(deviceId: string): void {
        if (self.nodeType !== 'MidiInputNode') return

        try {
          self.selectedMidiDevice = deviceId
          this.setProperty('selectedDeviceId', deviceId)

          // Re-setup listeners with new device selection
          if (self.midiAccess) {
            this.setupMidiListeners()
          }
        } catch (error) {
          // Node was detached from MST tree, ignore
          console.error(`[MidiInputNode] Node ${self.id} detached, cannot set MIDI device:`, error)
        }
      },

      setupMidiListeners(): void {
        if (self.nodeType !== 'MidiInputNode' || !self.midiAccess) return

        const channel = self.properties.get('channel') || 1

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

              try {
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
              } catch (error) {
                // Node was detached from MST tree, ignore MIDI message
                console.error(
                  `[MidiInputNode] Node ${self.id} detached, ignoring MIDI message:`,
                  error
                )
              }
            }
          }
        })
      },

      clearMidiListeners(): void {
        if (self.nodeType !== 'MidiInputNode' || !self.midiAccess) return

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
          outputsObj['loaded'] = 0
        } else if (nodeType === 'TimerNode') {
          // Initialize timer-specific properties
          propertiesObj['isRunning'] = 'false'
          propertiesObj['_timeoutId'] = undefined
          propertiesObj['_intervalId'] = undefined
        } else if (nodeType === 'ScaleToMidiNode') {
          // Initialize with default values if not set
          if (!propertiesObj['scaleDegree']) propertiesObj['scaleDegree'] = 0
          if (!propertiesObj['key']) propertiesObj['key'] = 'C'
          if (!propertiesObj['mode']) propertiesObj['mode'] = 'major'

          // Calculate initial MIDI note and frequency
          const scaleDegree = propertiesObj['scaleDegree'] || 0
          const key = propertiesObj['key'] || 'C'
          const mode = propertiesObj['mode'] || 'major'

          // Use the same scale conversion logic
          const SCALE_INTERVALS: Record<string, number[]> = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            dorian: [0, 2, 3, 5, 7, 9, 10],
            phrygian: [0, 1, 3, 5, 7, 8, 10],
            lydian: [0, 2, 4, 6, 7, 9, 11],
            mixolydian: [0, 2, 4, 5, 7, 9, 10],
            locrian: [0, 1, 3, 5, 6, 8, 10],
            pentatonic_major: [0, 2, 4, 7, 9],
            pentatonic_minor: [0, 3, 5, 7, 10],
            blues: [0, 3, 5, 6, 7, 10],
            harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
            melodic_minor: [0, 2, 3, 5, 7, 9, 11],
          }

          const KEY_TO_MIDI: Record<string, number> = {
            C: 60,
            'C#': 61,
            D: 62,
            'D#': 63,
            E: 64,
            F: 65,
            'F#': 66,
            G: 67,
            'G#': 68,
            A: 69,
            'A#': 70,
            B: 71,
          }

          const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.major
          const rootMidi = KEY_TO_MIDI[key] || 60
          const octaveOffset = Math.floor(scaleDegree / intervals.length)
          const normalizedDegree =
            ((scaleDegree % intervals.length) + intervals.length) % intervals.length
          const interval = intervals[normalizedDegree]
          const midiNote = Math.max(0, Math.min(127, rootMidi + interval + octaveOffset * 12))
          const frequency = 440 * Math.pow(2, (midiNote - 69) / 12)

          propertiesObj['midiNote'] = midiNote
          propertiesObj['frequency'] = frequency
          outputsObj['midiNote'] = midiNote
          outputsObj['frequency'] = frequency
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
                self.bridgeUpdateCallback(id, outputName, value)
              }
            })
          },
          { fireImmediately: false }
        )

        // Set up auto-start reaction for TimerNode (reacts to property changes)
        if (nodeType === 'TimerNode') {
          // Set up a reaction to auto-start when properties change
          reaction(
            () => ({
              startMode: node.properties.get('startMode') || 'auto',
              enabled: (node.properties.get('enabled') || 'true') === 'true',
              isRunning: node.properties.get('isRunning') === 'true',
            }),
            ({ startMode, enabled, isRunning }) => {
              // Auto-start if: startMode is 'auto', enabled is true, and not already running
              if (startMode === 'auto' && enabled && !isRunning) {
                try {
                  if (self.nodes.has(id)) {
                    node.startTimer()
                  }
                } catch (error) {
                  console.error(`[TimerNode] Failed to auto-start timer ${id}:`, error)
                }
              }
            },
            { fireImmediately: true } // Check immediately and on changes
          )
        }

        return node
      },

      removeNode(id: string): void {
        const node = self.nodes.get(id)
        if (node) {
          // Special cleanup for TimerNode
          if (node.nodeType === 'TimerNode') {
            node.stopTimer()
          }

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
