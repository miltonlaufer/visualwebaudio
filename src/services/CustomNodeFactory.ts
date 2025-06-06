import type { NodeMetadata } from '~/types'
import { customNodeStore, type ICustomNodeState } from '~/stores/CustomNodeStore'
import { autorun } from 'mobx'

// Base interface for custom nodes - keeping for compatibility
export interface CustomNode {
  id: string
  type: string
  properties: Map<string, any>
  outputs: Map<string, any>
  disconnect(): void
  setValue?(value: any): void
  setProperty?(name: string, value: any): void
  trigger?(): void
  receiveInput?(inputName: string, value: any): void
  createUIElement?(container: HTMLElement): void
  cleanup(): void
  getAudioOutput?(): AudioNode | null
  setOutputChangeCallback?(
    callback: (nodeId: string, outputName: string, value: number) => void
  ): void
  loadAudioFile?(file: File): Promise<void>
}

// Adapter class to bridge MobX store with existing CustomNode interface
class MobXCustomNodeAdapter implements CustomNode {
  private mobxNode: ICustomNodeState
  private uiElement?: HTMLElement
  private fileInputElement?: HTMLInputElement
  private disposer?: () => void
  private themeObserver?: MutationObserver

  constructor(mobxNode: ICustomNodeState) {
    this.mobxNode = mobxNode
  }

  get id(): string {
    return this.mobxNode.id
  }

  get type(): string {
    return this.mobxNode.nodeType
  }

  get properties(): Map<string, any> {
    return this.mobxNode.properties as any
  }

  get outputs(): Map<string, any> {
    return this.mobxNode.outputs as any
  }

  disconnect(): void {
    this.mobxNode.clearInputConnections()
  }

  setValue(value: any): void {
    this.mobxNode.setValue(value)
  }

  setProperty(name: string, value: any): void {
    this.mobxNode.setProperty(name, value)
  }

  trigger(): void {
    this.mobxNode.trigger()
  }

  receiveInput(inputName: string, value: any): void {
    // Instead of calling the removed receiveInput method,
    // simulate what the reactive connection would do
    if (this.mobxNode.nodeType === 'MidiToFreqNode' && inputName === 'midiNote') {
      const midiNote = Number(value) || 0
      const baseFreq = this.mobxNode.properties.get('baseFreq') || 440
      const baseMidi = this.mobxNode.properties.get('baseMidi') || 69
      const frequency = baseFreq * Math.pow(2, (midiNote - baseMidi) / 12)
      this.mobxNode.setOutput('frequency', frequency)
    } else if (this.mobxNode.nodeType === 'DisplayNode' && inputName === 'input') {
      const numValue = Number(value) || 0
      this.mobxNode.setProperty('currentValue', numValue)
    } else if (this.mobxNode.nodeType === 'ScaleToMidiNode' && inputName === 'scaleDegree') {
      const scaleDegree = Number(value) || 0
      this.mobxNode.setProperty('scaleDegree', scaleDegree)
      this.mobxNode.updateScaleToMidiOutput()
    }
    // Add more node type handling as needed for testing
  }

  createUIElement(container: HTMLElement): void {
    // Delegate to node-type specific UI creation
    this.createUIForNodeType(container)
  }

  cleanup(): void {
    this.mobxNode.clearInputConnections()
    if (this.uiElement) {
      this.uiElement.remove()
    }
    if (this.disposer) {
      this.disposer()
    }
    if (this.themeObserver) {
      this.themeObserver.disconnect()
    }
  }

  getAudioOutput(): AudioNode | null {
    // For SoundFileNode, return the gain node if available
    if (this.mobxNode.nodeType === 'SoundFileNode') {
      return (this.mobxNode as any).gainNode || null
    }
    return null
  }

  setOutputChangeCallback(
    callback: (nodeId: string, outputName: string, value: number) => void
  ): void {
    // The MobX store handles this via reactions
    customNodeStore.setBridgeUpdateCallback(callback)
  }

  // Expose audio functionality for SoundFileNode
  loadAudioFile(file: File): Promise<void> {
    if (this.mobxNode.loadAudioFile) {
      return this.mobxNode.loadAudioFile(file)
    }
    return Promise.resolve()
  }

  updateAudioContext(audioContext: AudioContext): void {
    if (this.mobxNode.updateAudioContext) {
      this.mobxNode.updateAudioContext(audioContext)
    }
  }

  private createUIForNodeType(container: HTMLElement): void {
    const nodeType = this.mobxNode.nodeType

    if (nodeType === 'SliderNode') {
      this.createSliderUI(container)
    } else if (nodeType === 'DisplayNode') {
      this.createDisplayUI(container)
    } else if (nodeType === 'ButtonNode') {
      this.createButtonUI(container)
    } else if (nodeType === 'SoundFileNode') {
      this.createSoundFileUI(container)
    }
    // Add more node types as needed
  }

  private createSliderUI(container: HTMLElement): void {
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `

    const labelElement = document.createElement('span')
    labelElement.style.cssText = `
      font-size: 12px;
      color: #666;
    `

    const sliderElement = document.createElement('input')
    sliderElement.type = 'range'
    sliderElement.min = String(this.mobxNode.properties.get('min') ?? 0)
    sliderElement.max = String(this.mobxNode.properties.get('max') ?? 100)
    sliderElement.step = String(this.mobxNode.properties.get('step') ?? 1)
    sliderElement.value = String(this.mobxNode.properties.get('value') ?? 50)
    sliderElement.style.cssText = `width: 120px; margin: 0;`

    const updateLabel = (): void => {
      const label = this.mobxNode.properties.get('label') ?? 'Slider'
      const value = this.mobxNode.properties.get('value') ?? 0
      labelElement.textContent = `${label}: ${value}`
    }

    updateLabel()

    sliderElement.addEventListener('input', () => {
      const value = parseFloat(sliderElement.value)
      this.mobxNode.setProperty('value', value)
      this.mobxNode.setOutput('value', value)
      updateLabel()
      // Note: Reactive system handles propagation automatically via MobX reactions
    })

    // Prevent drag events from bubbling
    sliderElement.addEventListener('mousedown', e => e.stopPropagation())
    sliderElement.addEventListener('mousemove', e => e.stopPropagation())
    sliderElement.addEventListener('mouseup', e => e.stopPropagation())

    wrapper.appendChild(labelElement)
    wrapper.appendChild(sliderElement)
    container.appendChild(wrapper)
    this.uiElement = wrapper
  }

  private createDisplayUI(container: HTMLElement): void {
    const displayElement = document.createElement('div')
    displayElement.style.cssText = `
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 80px;
      text-align: center;
    `

    const labelElement = document.createElement('span')
    const updateLabelStyle = () => {
      const isDark = document.documentElement.classList.contains('dark')
      labelElement.style.cssText = `
        font-size: 10px;
        color: ${isDark ? '#d1d5db' : '#666'};
        font-weight: bold;
      `
    }
    updateLabelStyle()
    labelElement.textContent = this.mobxNode.properties.get('label') || 'Display'

    const valueElement = document.createElement('span')
    const updateValueStyle = () => {
      const isDark = document.documentElement.classList.contains('dark')
      valueElement.style.cssText = `
        font-size: 14px;
        color: ${isDark ? '#f3f4f6' : '#1f2937'};
        font-weight: bold;
        background: ${isDark ? '#374151' : '#f1f5f9'};
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid ${isDark ? '#4b5563' : '#cbd5e1'};
        font-family: 'Courier New', monospace;
      `
    }
    updateValueStyle()

    // Listen for theme changes
    this.themeObserver = new MutationObserver(() => {
      updateLabelStyle()
      updateValueStyle()
    })
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    const updateDisplay = (): void => {
      const value = this.mobxNode.properties.get('currentValue') || 0
      const precision = this.mobxNode.properties.get('precision') || 2

      let displayValue: string
      if (Number.isInteger(value) || precision === 0) {
        displayValue = Math.round(value).toString()
      } else {
        displayValue = Number(value).toFixed(precision)
      }

      valueElement.textContent = displayValue
    }

    displayElement.appendChild(labelElement)
    displayElement.appendChild(valueElement)
    container.appendChild(displayElement)
    this.uiElement = displayElement

    // Initial display update (after DOM is set up)
    updateDisplay()

    // Use MobX autorun for reactive updates when properties change
    this.disposer = autorun(() => {
      // Access the currentValue property to make this reactive
      this.mobxNode.properties.get('currentValue')
      // Update the display whenever the currentValue changes
      updateDisplay()
    })
  }

  private createButtonUI(container: HTMLElement): void {
    const buttonElement = document.createElement('button')
    const label = this.mobxNode.properties.get('label') || 'Button'
    buttonElement.textContent = label
    buttonElement.style.cssText = `
      padding: 8px 16px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin: 4px;
    `

    buttonElement.addEventListener('click', () => {
      this.mobxNode.trigger()
    })

    // Prevent click events from bubbling
    buttonElement.addEventListener('mousedown', e => e.stopPropagation())
    buttonElement.addEventListener('mouseup', e => e.stopPropagation())

    container.appendChild(buttonElement)
    this.uiElement = buttonElement
  }

  private createSoundFileUI(container: HTMLElement): void {
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `

    const label = document.createElement('span')
    label.textContent = this.mobxNode.properties.get('fileName') || 'No file loaded'
    label.style.cssText = `
      font-size: 12px;
      color: #666;
    `

    this.fileInputElement = document.createElement('input')
    this.fileInputElement.type = 'file'
    this.fileInputElement.accept = 'audio/*'
    this.fileInputElement.style.cssText = `
      font-size: 12px;
      margin: 2px 0;
    `

    this.fileInputElement.addEventListener('change', event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        this.loadAudioFile(file)
        label.textContent = file.name
        this.properties.set('fileName', file.name)
      }
    })

    wrapper.appendChild(label)
    wrapper.appendChild(this.fileInputElement)
    container.appendChild(wrapper)
  }
}

// Base class for custom nodes
export class BaseCustomNode implements CustomNode {
  id: string
  type: string
  properties: Map<string, any> = new Map()
  outputs: Map<string, any> = new Map()
  private connections: Array<{ target: CustomNode; outputName: string; inputName: string }> = []
  protected audioContext: AudioContext
  private onOutputChangeCallback?: (nodeId: string, outputName: string, value: number) => void

  constructor(id: string, type: string, audioContext: AudioContext, metadata: NodeMetadata) {
    this.id = id
    this.type = type
    this.audioContext = audioContext

    // Initialize properties from metadata
    metadata.properties.forEach(prop => {
      this.properties.set(prop.name, prop.defaultValue)
    })

    // Initialize outputs
    metadata.outputs.forEach(output => {
      this.outputs.set(output.name, null)
    })
  }

  // Method to set the callback for output changes
  setOutputChangeCallback(
    callback: (nodeId: string, outputName: string, value: number) => void
  ): void {
    this.onOutputChangeCallback = callback
  }

  // Method to update the audio context reference
  updateAudioContext(newAudioContext: AudioContext): void {
    this.audioContext = newAudioContext
  }

  disconnect(): void {
    this.connections = []
  }

  protected notifyConnections(outputName: string, value: any): void {
    // Update the output value in the custom node
    this.outputs.set(outputName, value)

    // Notify connected custom nodes
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value)
        }
      })

    // Notify the bridge callback for Web Audio connections
    if (this.onOutputChangeCallback && typeof value === 'number') {
      this.onOutputChangeCallback(this.id, outputName, value)
    }
  }

  receiveInput(inputName: string, value: any): void {
    // ButtonNode doesn't process inputs, it only triggers outputs
    void inputName
    void value
  }

  setProperty(name: string, value: any): void {
    this.properties.set(name, value)
  }

  cleanup(): void {
    this.disconnect()
  }
}

// Button Node Implementation
export class ButtonNode extends BaseCustomNode {
  private buttonElement?: HTMLButtonElement

  trigger(): void {
    const outputValue = this.properties.get('outputValue') || 1
    this.outputs.set('trigger', outputValue)
    this.notifyConnections('trigger', outputValue)
  }

  createUIElement(container: HTMLElement): void {
    const label = this.properties.get('label') || 'Button'

    this.buttonElement = document.createElement('button')
    this.buttonElement.textContent = label
    this.buttonElement.style.cssText = `
      padding: 8px 16px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin: 4px;
    `

    this.buttonElement.addEventListener('click', () => {
      this.trigger()
    })

    // Prevent click events from bubbling up to React Flow
    this.buttonElement.addEventListener('mousedown', e => {
      e.stopPropagation()
    })

    this.buttonElement.addEventListener('mouseup', e => {
      e.stopPropagation()
    })

    container.appendChild(this.buttonElement)
  }

  setValue(value: any): void {
    if (typeof value === 'string') {
      this.properties.set('label', value)
      if (this.buttonElement) {
        this.buttonElement.textContent = value
      }
    }
  }
}

// Slider Node Implementation
export class SliderNode extends BaseCustomNode {
  private sliderElement?: HTMLInputElement
  private labelElement?: HTMLSpanElement

  constructor(id: string, type: string, audioContext: AudioContext, metadata: NodeMetadata) {
    super(id, type, audioContext, metadata)

    // Set initial output value
    const initialValue = this.properties.get('value') || 50
    this.outputs.set('value', initialValue)
  }

  createUIElement(container: HTMLElement): void {
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `

    this.labelElement = document.createElement('span')
    this.labelElement.style.cssText = `
      font-size: 12px;
      color: #666;
    `
    this.updateLabel()

    this.sliderElement = document.createElement('input')
    this.sliderElement.type = 'range'
    this.sliderElement.min = String(this.properties.get('min') ?? 0)
    this.sliderElement.max = String(this.properties.get('max') ?? 100)
    this.sliderElement.step = String(this.properties.get('step') ?? 1)
    this.sliderElement.value = String(this.properties.get('value') ?? 50)

    this.sliderElement.style.cssText = `
      width: 120px;
      margin: 0;
    `

    this.sliderElement.addEventListener('input', () => {
      const value = parseFloat(this.sliderElement!.value)
      this.properties.set('value', value)
      this.outputs.set('value', value)
      this.updateLabel()
      // Note: Reactive system handles propagation automatically via MobX reactions
    })

    // Prevent drag events from bubbling up to React Flow
    this.sliderElement.addEventListener('mousedown', e => {
      e.stopPropagation()
    })

    this.sliderElement.addEventListener('mousemove', e => {
      e.stopPropagation()
    })

    this.sliderElement.addEventListener('mouseup', e => {
      e.stopPropagation()
    })

    // Also prevent touch events for mobile
    this.sliderElement.addEventListener('touchstart', e => {
      e.stopPropagation()
    })

    this.sliderElement.addEventListener('touchmove', e => {
      e.stopPropagation()
    })

    this.sliderElement.addEventListener('touchend', e => {
      e.stopPropagation()
    })

    wrapper.appendChild(this.labelElement)
    wrapper.appendChild(this.sliderElement)
    container.appendChild(wrapper)
  }

  private updateLabel(): void {
    const label = this.properties.get('label') ?? 'Slider'
    const value = this.properties.get('value') ?? 0
    if (this.labelElement) {
      this.labelElement.textContent = `${label}: ${value}`
    }
  }

  setValue(value: any): void {
    if (typeof value === 'number') {
      this.properties.set('value', value)
      this.outputs.set('value', value)
      if (this.sliderElement) {
        this.sliderElement.value = String(value)
      }
      this.updateLabel()
      this.notifyConnections('value', value)
    }
  }
}

// Greater Than Node Implementation
export class GreaterThanNode extends BaseCustomNode {
  private input1Value = 0
  private input2Value = 0

  receiveInput(inputName: string, value: any): void {
    if (inputName === 'input1') {
      this.input1Value = Number(value) || 0
    } else if (inputName === 'input2') {
      this.input2Value = Number(value) || 0
    }

    this.calculateResult()
  }

  private calculateResult(): void {
    const result = this.input1Value > this.input2Value ? 1 : 0
    this.outputs.set('result', result)
    this.notifyConnections('result', result)
  }
}

// Equals Node Implementation
export class EqualsNode extends BaseCustomNode {
  private input1Value = 0
  private input2Value = 0

  receiveInput(inputName: string, value: any): void {
    if (inputName === 'input1') {
      this.input1Value = Number(value) || 0
    } else if (inputName === 'input2') {
      this.input2Value = Number(value) || 0
    }

    this.calculateResult()
  }

  private calculateResult(): void {
    const tolerance = this.properties.get('tolerance') || 0.001
    const result = Math.abs(this.input1Value - this.input2Value) <= tolerance ? 1 : 0
    this.outputs.set('result', result)
    this.notifyConnections('result', result)
  }
}

// Select Node Implementation
export class SelectNode extends BaseCustomNode {
  private selectorValue = 0
  private inputValue = 0

  receiveInput(inputName: string, value: any): void {
    if (inputName === 'selector') {
      this.selectorValue = Math.floor(Number(value) || 0)
    } else if (inputName === 'input') {
      this.inputValue = value
    }

    this.routeOutput()
  }

  private routeOutput(): void {
    const numOutputs = this.properties.get('numOutputs') || 2
    const outputIndex = Math.max(0, Math.min(this.selectorValue, numOutputs - 1))
    const outputName = `output${outputIndex}`

    this.outputs.set(outputName, this.inputValue)
    this.notifyConnections(outputName, this.inputValue)
  }
}

// MIDI Input Node Implementation
export class MidiInputNode extends BaseCustomNode {
  private midiAccess?: MIDIAccess

  constructor(id: string, type: string, audioContext: AudioContext, metadata: NodeMetadata) {
    super(id, type, audioContext, metadata)
    // Don't automatically request MIDI access - let the UI component handle this
  }

  // Method to be called by the UI component when MIDI access is granted
  setMidiAccess(midiAccess: MIDIAccess): void {
    this.midiAccess = midiAccess
    this.setupMidiListeners()
  }

  private setupMidiListeners(): void {
    if (!this.midiAccess) return

    const channel = this.properties.get('channel') || 1

    this.midiAccess.inputs.forEach((input: MIDIInput) => {
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
              this.outputs.set('note', data1)
              this.outputs.set('velocity', data2)
              this.notifyConnections('note', data1)
              this.notifyConnections('velocity', data2)
              break

            case 0x80: // Note off
              this.outputs.set('note', data1)
              this.outputs.set('velocity', 0)
              this.notifyConnections('note', data1)
              this.notifyConnections('velocity', 0)
              break

            case 0xb0: // Control change
              this.outputs.set('cc', data2)
              this.notifyConnections('cc', data2)
              break

            case 0xe0: {
              // Pitch bend
              const pitchValue = (data2 << 7) | data1
              this.outputs.set('pitch', pitchValue)
              this.notifyConnections('pitch', pitchValue)
              break
            }
          }
        }
      }
    })
  }

  cleanup(): void {
    super.cleanup()
    if (this.midiAccess) {
      this.midiAccess.inputs.forEach((input: MIDIInput) => {
        input.onmidimessage = null
      })
    }
  }
}

// MIDI to Frequency Node Implementation
export class MidiToFreqNode extends BaseCustomNode {
  receiveInput(inputName: string, value: any): void {
    if (inputName === 'midiNote') {
      const midiNote = Number(value) || 0
      const frequency = this.midiToFrequency(midiNote)
      this.outputs.set('frequency', frequency)
      this.notifyConnections('frequency', frequency)
    }
  }

  private midiToFrequency(midiNote: number): number {
    const baseFreq = this.properties.get('baseFreq') || 440
    const baseMidi = this.properties.get('baseMidi') || 69
    return baseFreq * Math.pow(2, (midiNote - baseMidi) / 12)
  }
}

// Scale to MIDI Node Implementation
export class ScaleToMidiNode extends BaseCustomNode {
  receiveInput(inputName: string, value: any): void {
    if (inputName === 'scaleDegree') {
      const scaleDegree = Number(value) || 0
      this.properties.set('scaleDegree', scaleDegree)
      this.updateOutput()
    }
  }

  setProperty(name: string, value: any): void {
    super.setProperty(name, value)
    if (name === 'scaleDegree' || name === 'key' || name === 'mode') {
      this.updateOutput()
    }
  }

  private updateOutput(): void {
    const scaleDegree = this.properties.get('scaleDegree') || 0
    const key = this.properties.get('key') || 'C'
    const mode = this.properties.get('mode') || 'major'

    const midiNote = this.scaleToMidi(scaleDegree, key, mode)
    const frequency = this.midiToFrequency(midiNote)

    this.properties.set('midiNote', midiNote)
    this.properties.set('frequency', frequency)
    this.outputs.set('midiNote', midiNote)
    this.outputs.set('frequency', frequency)

    this.notifyConnections('midiNote', midiNote)
    this.notifyConnections('frequency', frequency)
  }

  private scaleToMidi(scaleDegree: number, key: string, mode: string): number {
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
  }

  private midiToFrequency(midiNote: number): number {
    return 440 * Math.pow(2, (midiNote - 69) / 12)
  }
}

// Display Node Implementation
export class DisplayNode extends BaseCustomNode {
  private displayElement?: HTMLDivElement
  private valueElement?: HTMLSpanElement
  private labelElement?: HTMLSpanElement
  private onPropertyChangeCallback?: (nodeId: string, propertyName: string, value: any) => void
  private themeObserver?: MutationObserver

  constructor(id: string, type: string, audioContext: AudioContext, metadata: NodeMetadata) {
    super(id, type, audioContext, metadata)

    // Set initial output to match input (passthrough)
    const initialValue = this.properties.get('currentValue') || 0
    this.outputs.set('output', initialValue)
  }

  // Method to set the callback for property changes
  setPropertyChangeCallback(
    callback: (nodeId: string, propertyName: string, value: any) => void
  ): void {
    this.onPropertyChangeCallback = callback
  }

  createUIElement(container: HTMLElement): void {
    this.displayElement = document.createElement('div')
    this.displayElement.style.cssText = `
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 80px;
      text-align: center;
    `

    this.labelElement = document.createElement('span')
    const updateLabelStyle = () => {
      const isDark = document.documentElement.classList.contains('dark')
      this.labelElement!.style.cssText = `
        font-size: 10px;
        color: ${isDark ? '#d1d5db' : '#666'};
        font-weight: bold;
      `
    }
    updateLabelStyle()
    this.labelElement.textContent = this.properties.get('label') || 'Display'

    this.valueElement = document.createElement('span')
    const updateValueStyle = () => {
      const isDark = document.documentElement.classList.contains('dark')
      this.valueElement!.style.cssText = `
        font-size: 14px;
        color: ${isDark ? '#f3f4f6' : '#1f2937'};
        font-weight: bold;
        background: ${isDark ? '#374151' : '#f1f5f9'};
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid ${isDark ? '#4b5563' : '#cbd5e1'};
        font-family: 'Courier New', monospace;
      `
    }
    updateValueStyle()

    // Listen for theme changes
    this.themeObserver = new MutationObserver(() => {
      updateLabelStyle()
      updateValueStyle()
    })
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    this.updateDisplay()

    this.displayElement.appendChild(this.labelElement)
    this.displayElement.appendChild(this.valueElement)
    container.appendChild(this.displayElement)
  }

  receiveInput(inputName: string, value: any): void {
    //console.log(`DisplayNode ${this.id} receiveInput: ${inputName} = ${value}`)
    if (inputName === 'input') {
      const numValue = Number(value) || 0

      // Update the current value property
      this.properties.set('currentValue', numValue)

      // Notify the store to update the visual node property for the properties panel
      if (this.onPropertyChangeCallback) {
        this.onPropertyChangeCallback(this.id, 'currentValue', numValue)
      }

      // Pass through to output (for chaining)
      this.outputs.set('output', numValue)
      this.notifyConnections('output', numValue)

      // Update the display
      this.updateDisplay()
      //console.log(`DisplayNode ${this.id} updated display to: ${numValue}`)
    }
  }

  private updateDisplay(): void {
    if (this.valueElement) {
      const value = this.properties.get('currentValue') || 0
      const precision = this.properties.get('precision') || 2

      let displayValue: string
      if (Number.isInteger(value) || precision === 0) {
        displayValue = Math.round(value).toString()
      } else {
        displayValue = Number(value).toFixed(precision)
      }

      this.valueElement.textContent = displayValue
    }
  }

  setValue(value: any): void {
    if (typeof value === 'number') {
      this.properties.set('currentValue', value)
      this.outputs.set('output', value)
      this.updateDisplay()
      this.notifyConnections('output', value)
    } else if (typeof value === 'string' && this.labelElement) {
      this.properties.set('label', value)
      this.labelElement.textContent = value
    }
  }

  cleanup(): void {
    super.cleanup()
    if (this.themeObserver) {
      this.themeObserver.disconnect()
    }
  }
}

// Random Node Implementation
export class RandomNode extends BaseCustomNode {
  private intervalId?: number
  private displayElement?: HTMLDivElement
  private valueElement?: HTMLSpanElement
  private labelElement?: HTMLSpanElement
  private rateInputElement?: HTMLInputElement

  constructor(id: string, type: string, audioContext: AudioContext, metadata: NodeMetadata) {
    super(id, type, audioContext, metadata)

    // Set initial output value
    const initialValue = this.generateRandomValue()
    this.properties.set('currentValue', initialValue)
    this.outputs.set('value', initialValue)

    // Start generating random values
    this.startRandomGeneration()
  }

  createUIElement(container: HTMLElement): void {
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 140px;
    `

    this.labelElement = document.createElement('span')
    this.labelElement.style.cssText = `
      font-size: 12px;
      color: #666;
      font-weight: bold;
    `
    this.updateLabel()

    // Value display
    this.valueElement = document.createElement('span')
    this.valueElement.style.cssText = `
      font-size: 14px;
      color: #333;
      font-family: monospace;
      background: #f0f0f0;
      padding: 4px 8px;
      border-radius: 4px;
      text-align: center;
    `
    this.updateDisplay()

    // Rate control
    const rateWrapper = document.createElement('div')
    rateWrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2px;
    `

    const rateLabel = document.createElement('span')
    rateLabel.textContent = `Rate: ${this.properties.get('rate') || 1} Hz`
    rateLabel.style.cssText = `
      font-size: 11px;
      color: #666;
    `

    this.rateInputElement = document.createElement('input')
    this.rateInputElement.type = 'range'
    this.rateInputElement.min = '0.1'
    this.rateInputElement.max = '20'
    this.rateInputElement.step = '0.1'
    this.rateInputElement.value = String(this.properties.get('rate') || 1)
    this.rateInputElement.style.cssText = `
      width: 100%;
      margin: 0;
    `

    this.rateInputElement.addEventListener('input', () => {
      const rate = parseFloat(this.rateInputElement!.value)
      this.properties.set('rate', rate)
      rateLabel.textContent = `Rate: ${rate} Hz`
      this.restartRandomGeneration()
    })

    // Prevent drag events from bubbling up to React Flow
    this.rateInputElement.addEventListener('mousedown', e => {
      e.stopPropagation()
    })

    this.rateInputElement.addEventListener('mousemove', e => {
      e.stopPropagation()
    })

    this.rateInputElement.addEventListener('mouseup', e => {
      e.stopPropagation()
    })

    // Also prevent touch events for mobile
    this.rateInputElement.addEventListener('touchstart', e => {
      e.stopPropagation()
    })

    this.rateInputElement.addEventListener('touchmove', e => {
      e.stopPropagation()
    })

    this.rateInputElement.addEventListener('touchend', e => {
      e.stopPropagation()
    })

    rateWrapper.appendChild(rateLabel)
    rateWrapper.appendChild(this.rateInputElement)

    wrapper.appendChild(this.labelElement)
    wrapper.appendChild(this.valueElement)
    wrapper.appendChild(rateWrapper)
    container.appendChild(wrapper)
  }

  private updateLabel(): void {
    const label = this.properties.get('label') || 'Random'
    const min = this.properties.get('min') || 0
    const max = this.properties.get('max') || 100
    if (this.labelElement) {
      this.labelElement.textContent = `${label} (${min}-${max})`
    }
  }

  private updateDisplay(): void {
    const value = this.properties.get('currentValue') || 0
    if (this.valueElement) {
      this.valueElement.textContent = Number(value).toFixed(2)
    }
  }

  private generateRandomValue(): number {
    const min = this.properties.get('min') ?? 0
    const max = this.properties.get('max') ?? 100
    return Math.random() * (max - min) + min
  }

  private startRandomGeneration(): void {
    this.stopRandomGeneration()
    const rate = this.properties.get('rate') || 1
    const intervalMs = 1000 / rate // Convert Hz to milliseconds

    this.intervalId = window.setInterval(() => {
      const newValue = this.generateRandomValue()
      this.properties.set('currentValue', newValue)
      this.outputs.set('value', newValue)
      this.updateDisplay()
      //console.log(`RandomNode ${this.id} generated: ${newValue.toFixed(2)}`)
      this.notifyConnections('value', newValue)
    }, intervalMs)
  }

  private stopRandomGeneration(): void {
    if (this.intervalId !== undefined) {
      window.clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }

  private restartRandomGeneration(): void {
    this.startRandomGeneration()
  }

  setValue(value: any): void {
    if (typeof value === 'number') {
      // Allow manual override of current value
      this.properties.set('currentValue', value)
      this.outputs.set('value', value)
      this.updateDisplay()
      this.notifyConnections('value', value)
    } else if (typeof value === 'string' && this.labelElement) {
      this.properties.set('label', value)
      this.updateLabel()
    }
  }

  cleanup(): void {
    super.cleanup()
    this.stopRandomGeneration()
  }
}

// Sound File Node Implementation
export class SoundFileNode extends BaseCustomNode {
  private audioBuffer?: AudioBuffer
  private bufferSource?: AudioBufferSourceNode
  private gainNode?: GainNode
  private fileInputElement?: HTMLInputElement

  constructor(id: string, type: string, audioContext: AudioContext, metadata: NodeMetadata) {
    super(id, type, audioContext, metadata)
    this.setupAudioNodes()

    // Important: Restore audio buffer if data exists in properties during construction
    // This is crucial for when nodes are recreated after pause/resume
    this.restoreAudioBufferFromProperties()
  }

  private setupAudioNodes(): void {
    this.gainNode = this.audioContext.createGain()
    this.gainNode.gain.value = this.properties.get('gain') || 1
  }

  private async restoreAudioBufferFromProperties(): Promise<void> {
    const audioBufferData = this.properties.get('audioBufferData')
    const fileName = this.properties.get('fileName')

    //console.log(`SoundFileNode: Attempting to restore audio data...`)
    //console.log(`audioBufferData exists: ${!!audioBufferData}, type: ${typeof audioBufferData}`)
    //console.log(`fileName: ${fileName}`)
    //console.log(`Properties keys: [${Array.from(this.properties.keys()).join(', ')}]`)

    if (audioBufferData && fileName) {
      try {
        //console.log(`SoundFileNode: Successfully restored audio buffer for ${fileName}`)
        /* console.log(
          `Data length: ${typeof audioBufferData === 'string' ? audioBufferData.length : 'not string'}`
        ) */

        // Ensure audioBufferData is a string (base64)
        if (typeof audioBufferData !== 'string') {
          console.error('🚨 audioBufferData is not a string:', typeof audioBufferData)
          throw new Error('Invalid audioBufferData format - expected base64 string')
        }

        // Convert base64 to ArrayBuffer and decode
        const arrayBuffer = this.base64ToArrayBuffer(audioBufferData)
        //console.log(`🔄 Converting array buffer of length ${arrayBuffer.byteLength}`)

        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice())
        this.outputs.set('loaded', 1)
        this.notifyConnections('loaded', 1)

        //console.log(`SoundFileNode: Successfully restored audio buffer for ${fileName}`)
        //console.log(`   - Duration: ${this.audioBuffer.duration.toFixed(2)}s`)
        //console.log(`   - Sample rate: ${this.audioBuffer.sampleRate}Hz`)
        //console.log(`   - Channels: ${this.audioBuffer.numberOfChannels}`)
      } catch (error) {
        console.error('🚨 SoundFileNode: Error restoring audio buffer:', error)
        this.outputs.set('loaded', 0)
        this.notifyConnections('loaded', 0)

        // Don't clear the data here - it might be a temporary decoding issue
        // Let the user try to reload the file manually
        console.warn('🔄 SoundFileNode: Audio data preserved - user can try reloading')
      }
    } else {
      //console.log(`SoundFileNode: No stored audio data found`)
      //console.log(`   - audioBufferData missing: ${!audioBufferData}`)
      //console.log(`   - fileName missing: ${!fileName}`)
      this.outputs.set('loaded', 0)
      this.notifyConnections('loaded', 0)
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

  createUIElement(container: HTMLElement): void {
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `

    const label = document.createElement('span')
    label.textContent = this.properties.get('fileName') || 'No file loaded'
    label.style.cssText = `
      font-size: 12px;
      color: #666;
    `

    this.fileInputElement = document.createElement('input')
    this.fileInputElement.type = 'file'
    this.fileInputElement.accept = 'audio/*'
    this.fileInputElement.style.cssText = `
      font-size: 12px;
      margin: 2px 0;
    `

    this.fileInputElement.addEventListener('change', event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        this.loadFile(file)
        label.textContent = file.name
        this.properties.set('fileName', file.name)
      }
    })

    wrapper.appendChild(label)
    wrapper.appendChild(this.fileInputElement)
    container.appendChild(wrapper)
  }

  private async loadFile(file: File): Promise<void> {
    try {
      const arrayBuffer = await file.arrayBuffer()

      // Store the raw audio data for persistence across context recreations
      const base64Data = this.arrayBufferToBase64(arrayBuffer)
      this.properties.set('audioBufferData', base64Data)
      this.properties.set('fileName', file.name)

      // Decode audio buffer for immediate use
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice())
      this.outputs.set('loaded', 1)
      this.notifyConnections('loaded', 1)

      //console.log(`SoundFileNode: Loaded and stored audio file: ${file.name}`)
    } catch (error) {
      console.error('Error loading audio file:', error)
      this.outputs.set('loaded', 0)
      this.notifyConnections('loaded', 0)
      // Clear any partial data
      this.properties.delete('audioBufferData')
      this.properties.delete('fileName')
    }
  }

  receiveInput(inputName: string, value: any): void {
    if (inputName === 'trigger' && value > 0) {
      this.trigger()
    }
  }

  trigger(): void {
    //console.log(`SoundFileNode trigger called:`)
    //console.log(`   - audioBuffer exists: ${!!this.audioBuffer}`)
    //console.log(`   - gainNode exists: ${!!this.gainNode}`)
    //console.log(`   - audioContext state: ${this.audioContext.state}`)

    if (!this.audioBuffer) {
      console.warn('SoundFileNode: No audio buffer loaded')
      return
    }

    // If the audio context is closed, we need to get a fresh one
    // This can happen after pause/resume cycles
    if (this.audioContext.state === 'closed') {
      console.warn('SoundFileNode: Stored audio context is closed - node needs to be recreated')
      return
    }

    // Ensure we have a valid gain node for the current context
    if (!this.gainNode || this.gainNode.context !== this.audioContext) {
      //console.log('SoundFileNode: Recreating gain node for current context')
      this.setupAudioNodes()
    }

    if (!this.gainNode) {
      console.warn('SoundFileNode: No gain node available after setup')
      return
    }

    if (this.audioContext.state === 'suspended') {
      console.warn('SoundFileNode: Audio context is suspended. Attempting to resume...')
      this.audioContext
        .resume()
        .then(() => {
          //console.log('SoundFileNode: Audio context resumed, triggering playback')
          this.performTrigger()
        })
        .catch(error => {
          console.error('SoundFileNode: Failed to resume audio context:', error)
        })
      return
    }

    this.performTrigger()
  }

  private performTrigger(): void {
    // Stop previous playback
    if (this.bufferSource) {
      try {
        this.bufferSource.stop()
        this.bufferSource.disconnect()
      } catch {
        //console.log('SoundFileNode: Previous buffer source already stopped')
      }
    }

    // Create new buffer source
    this.bufferSource = this.audioContext.createBufferSource()
    this.bufferSource.buffer = this.audioBuffer!
    this.bufferSource.loop = this.properties.get('loop') || false
    this.bufferSource.playbackRate.value = this.properties.get('playbackRate') || 1

    // Update gain
    this.gainNode!.gain.value = this.properties.get('gain') || 1

    // Connect: bufferSource -> gainNode -> (external connections)
    this.bufferSource.connect(this.gainNode!)

    // Start playback
    this.bufferSource.start()
    //console.log('SoundFileNode: Audio playback started')
  }

  getAudioOutput(): AudioNode | null {
    return this.gainNode || null
  }

  cleanup(): void {
    super.cleanup()
    if (this.bufferSource) {
      this.bufferSource.stop()
      this.bufferSource.disconnect()
    }
    if (this.gainNode) {
      this.gainNode.disconnect()
    }
  }

  // Override to handle audio context updates
  updateAudioContext(newAudioContext: AudioContext): void {
    /* console.log(
      `🔄 SoundFileNode: Updating audio context from ${this.audioContext.state} to ${newAudioContext.state}`
    ) */
    super.updateAudioContext(newAudioContext)

    // Recreate audio nodes with the new context
    this.setupAudioNodes()

    //console.log(`SoundFileNode: Audio context updated and nodes recreated`)
  }
}

export class TimerNode extends BaseCustomNode {
  private timeoutId?: number
  private intervalId?: number
  private isRunning = false
  private triggerCount = 0
  private displayElement?: HTMLDivElement
  private countElement?: HTMLSpanElement
  private statusElement?: HTMLSpanElement
  private startButton?: HTMLButtonElement
  private stopButton?: HTMLButtonElement
  private resetButton?: HTMLButtonElement

  constructor(id: string, type: string, audioContext: AudioContext, metadata: NodeMetadata) {
    super(id, type, audioContext, metadata)

    // Set default properties
    this.properties.set('mode', 'loop')
    this.properties.set('delay', 1000)
    this.properties.set('interval', 1000)
    this.properties.set('startMode', 'auto')
    this.properties.set('enabled', true)
    this.properties.set('count', 0)

    // Auto-start if enabled
    if (this.properties.get('startMode') === 'auto' && this.properties.get('enabled')) {
      this.startTimer()
    }
  }

  createUIElement(container: HTMLElement): void {
    this.displayElement = document.createElement('div')
    this.displayElement.className = 'timer-node-ui'
    this.displayElement.style.cssText = `
      padding: 8px;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      min-width: 200px;
    `

    // Status display
    const statusContainer = document.createElement('div')
    statusContainer.style.cssText = 'margin-bottom: 8px;'

    const statusLabel = document.createElement('span')
    statusLabel.textContent = 'Status: '
    statusLabel.style.fontWeight = 'bold'

    this.statusElement = document.createElement('span')
    this.statusElement.style.cssText = 'color: #666;'

    statusContainer.appendChild(statusLabel)
    statusContainer.appendChild(this.statusElement)

    // Count display
    const countContainer = document.createElement('div')
    countContainer.style.cssText = 'margin-bottom: 8px;'

    const countLabel = document.createElement('span')
    countLabel.textContent = 'Count: '
    countLabel.style.fontWeight = 'bold'

    this.countElement = document.createElement('span')
    this.countElement.style.cssText = 'color: #007bff; font-weight: bold;'

    countContainer.appendChild(countLabel)
    countContainer.appendChild(this.countElement)

    // Control buttons
    const buttonContainer = document.createElement('div')
    buttonContainer.style.cssText = 'display: flex; gap: 4px; margin-top: 8px;'

    this.startButton = document.createElement('button')
    this.startButton.textContent = 'Start'
    this.startButton.style.cssText = `
      padding: 4px 8px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `
    this.startButton.onclick = () => this.startTimer()

    this.stopButton = document.createElement('button')
    this.stopButton.textContent = 'Stop'
    this.stopButton.style.cssText = `
      padding: 4px 8px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `
    this.stopButton.onclick = () => this.stopTimer()

    this.resetButton = document.createElement('button')
    this.resetButton.textContent = 'Reset'
    this.resetButton.style.cssText = `
      padding: 4px 8px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `
    this.resetButton.onclick = () => this.resetTimer()

    buttonContainer.appendChild(this.startButton)
    buttonContainer.appendChild(this.stopButton)
    buttonContainer.appendChild(this.resetButton)

    // Settings display
    const settingsContainer = document.createElement('div')
    settingsContainer.style.cssText = 'margin-top: 8px; font-size: 10px; color: #666;'

    const mode = this.properties.get('mode')
    const delay = this.properties.get('delay')
    const interval = this.properties.get('interval')
    const startMode = this.properties.get('startMode')

    settingsContainer.innerHTML = `
      Mode: ${mode}<br>
      Delay: ${delay}ms<br>
      ${mode === 'loop' ? `Interval: ${interval}ms<br>` : ''}
      Start: ${startMode}
    `

    this.displayElement.appendChild(statusContainer)
    this.displayElement.appendChild(countContainer)
    this.displayElement.appendChild(settingsContainer)
    this.displayElement.appendChild(buttonContainer)

    container.appendChild(this.displayElement)
    this.updateDisplay()
  }

  private updateDisplay(): void {
    if (this.statusElement) {
      this.statusElement.textContent = this.isRunning ? 'Running' : 'Stopped'
      this.statusElement.style.color = this.isRunning ? '#28a745' : '#dc3545'
    }

    if (this.countElement) {
      this.countElement.textContent = this.triggerCount.toString()
    }

    if (this.startButton) {
      this.startButton.disabled = this.isRunning
    }

    if (this.stopButton) {
      this.stopButton.disabled = !this.isRunning
    }
  }

  private startTimer(): void {
    if (this.isRunning || !this.properties.get('enabled')) {
      return
    }

    this.isRunning = true
    const delay = this.properties.get('delay') || 1000
    const mode = this.properties.get('mode')

    //console.log(`TimerNode ${this.id}: Starting timer with ${delay}ms delay, mode: ${mode}`)

    // Start with initial delay
    this.timeoutId = window.setTimeout(() => {
      this.fireTrigger()

      // If loop mode, start interval
      if (mode === 'loop') {
        const interval = this.properties.get('interval') || 1000
        this.intervalId = window.setInterval(() => {
          this.fireTrigger()
        }, interval)
      } else {
        // One-shot mode, stop after first trigger
        this.isRunning = false
        this.updateDisplay()
      }
    }, delay)

    this.updateDisplay()
  }

  private stopTimer(): void {
    if (!this.isRunning) {
      return
    }

    //console.log(`TimerNode ${this.id}: Stopping timer`)

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    this.isRunning = false
    this.updateDisplay()
  }

  private resetTimer(): void {
    this.stopTimer()
    this.triggerCount = 0
    this.properties.set('count', 0)
    this.outputs.set('count', 0)

    //console.log(`TimerNode ${this.id}: Timer reset`)

    this.updateDisplay()

    // Notify connections of count reset
    this.notifyConnections('count', 0)
  }

  private fireTrigger(): void {
    this.triggerCount++
    this.properties.set('count', this.triggerCount)
    this.outputs.set('trigger', 1)
    this.outputs.set('count', this.triggerCount)

    //console.log(`TimerNode ${this.id}: Trigger fired (count: ${this.triggerCount})`)

    // Notify connections
    this.notifyConnections('trigger', 1)
    this.notifyConnections('count', this.triggerCount)

    this.updateDisplay()

    // Reset trigger output immediately
    this.outputs.set('trigger', 0)
    this.notifyConnections('trigger', 0)
  }

  receiveInput(inputName: string, value: any): void {
    //console.log(`TimerNode ${this.id}: Received input ${inputName} = ${value}`)

    if (inputName === 'trigger' && value > 0) {
      if (this.properties.get('startMode') === 'manual') {
        this.startTimer()
      }
    } else if (inputName === 'reset' && value > 0) {
      this.resetTimer()
    }
  }

  setProperty(name: string, value: any): void {
    super.setProperty(name, value)

    // If timer is running and timing properties change, restart
    if ((name === 'delay' || name === 'interval' || name === 'mode') && this.isRunning) {
      this.stopTimer()
      this.startTimer()
    }

    // If enabled state changes
    if (name === 'enabled') {
      if (!value && this.isRunning) {
        this.stopTimer()
      } else if (value && !this.isRunning && this.properties.get('startMode') === 'auto') {
        this.startTimer()
      }
    }

    this.updateDisplay()
  }

  cleanup(): void {
    //console.log(`TimerNode ${this.id}: Starting cleanup...`)

    // Only stop timer if we're actually being destroyed, not just recreated
    if (this.timeoutId || this.intervalId) {
      //console.log(`TimerNode ${this.id}: Stopping active timers during cleanup`)
      this.stopTimer()
    }

    super.cleanup()
    //console.log(`TimerNode ${this.id}: Cleanup completed`)
  }

  // Override to handle audio context updates
  updateAudioContext(newAudioContext: AudioContext): void {
    /* console.log(
      `🔄 TimerNode: Updating audio context from ${this.audioContext.state} to ${newAudioContext.state}`
    ) */
    super.updateAudioContext(newAudioContext)
    //console.log(`TimerNode: Audio context updated`)
  }
}

// Updated CustomNodeFactory to use MobX store
export class CustomNodeFactory {
  private audioContext: AudioContext

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  // Update audio context for all existing nodes
  updateAudioContext(newAudioContext: AudioContext): void {
    this.audioContext = newAudioContext
    // The MobX store doesn't need audio context updates since it's state-only
  }

  // Create a custom node using MobX store
  createNode(id: string, type: string, metadata: NodeMetadata): CustomNode {
    //console.log(`🏭 MobX CustomNodeFactory: Creating ${type} with id ${id}`)

    // Set audio context on the store for SoundFileNode functionality
    customNodeStore.setAudioContext(this.audioContext)

    // Create the MobX observable node in the store
    const mobxNode = customNodeStore.addNode(id, type, metadata)

    // Return an adapter that implements the CustomNode interface
    return new MobXCustomNodeAdapter(mobxNode)
  }

  // Check if a node type is a custom node
  isCustomNodeType(nodeType: string): boolean {
    const customNodeTypes = [
      'ButtonNode',
      'SliderNode',
      'GreaterThanNode',
      'EqualsNode',
      'SelectNode',
      'MidiInputNode',
      'MidiToFreqNode',
      'ScaleToMidiNode',
      'DisplayNode',
      'RandomNode',
      'SoundFileNode',
      'TimerNode',
    ]
    return customNodeTypes.includes(nodeType)
  }

  // Get all custom node types
  getCustomNodeTypes(): string[] {
    return [
      'ButtonNode',
      'SliderNode',
      'GreaterThanNode',
      'EqualsNode',
      'SelectNode',
      'MidiInputNode',
      'MidiToFreqNode',
      'ScaleToMidiNode',
      'DisplayNode',
      'RandomNode',
      'SoundFileNode',
      'TimerNode',
    ]
  }

  // Clean up all custom nodes
  cleanup(): void {
    customNodeStore.clear()
  }

  // Set bridge update callback
  setBridgeUpdateCallback(
    callback: (nodeId: string, outputName: string, value: number) => void
  ): void {
    customNodeStore.setBridgeUpdateCallback(callback)
  }

  // Connect two custom nodes
  connectCustomNodes(
    sourceId: string,
    targetId: string,
    outputName: string,
    inputName: string
  ): void {
    customNodeStore.connectNodes(sourceId, targetId, outputName, inputName)
  }

  // Get a custom node from the store
  getCustomNode(id: string): CustomNode | undefined {
    const mobxNode = customNodeStore.getNode(id)
    return mobxNode ? new MobXCustomNodeAdapter(mobxNode) : undefined
  }

  // Backward compatibility method for existing tests
  createCustomNode(
    nodeType: string,
    metadata: NodeMetadata,
    properties: Record<string, any> = {}
  ): CustomNode {
    const id = `${nodeType}-${Date.now()}`
    const node = this.createNode(id, nodeType, metadata)

    // Apply any initial properties using MST actions
    Object.entries(properties).forEach(([key, value]) => {
      if (node.setValue && key === 'value') {
        node.setValue(value)
      } else if (node.setProperty) {
        node.setProperty(key, value)
      }
    })

    return node
  }
}
