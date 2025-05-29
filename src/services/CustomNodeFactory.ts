import type { NodeMetadata } from '~/types'

// Base interface for custom nodes
export interface CustomNode {
  id: string
  type: string
  properties: Map<string, any>
  outputs: Map<string, any>
  connect(targetNode: CustomNode, outputName?: string, inputName?: string): void
  disconnect(): void
  setValue?(value: any): void
  trigger?(): void
  receiveInput?(inputName: string, value: any): void
  createUIElement?(container: HTMLElement): void
  cleanup(): void
  // Add callback for bridge updates
  onOutputChange?: (outputName: string, value: any) => void
}

// Base class for custom nodes
export class BaseCustomNode implements CustomNode {
  id: string
  type: string
  properties: Map<string, any> = new Map()
  outputs: Map<string, any> = new Map()
  private connections: Array<{ target: CustomNode; outputName: string; inputName: string }> = []
  protected audioContext: AudioContext
  onOutputChange?: (outputName: string, value: any) => void

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

  connect(targetNode: CustomNode, outputName = 'output', inputName = 'input'): void {
    this.connections.push({ target: targetNode, outputName, inputName })
  }

  disconnect(): void {
    this.connections = []
  }

  protected notifyConnections(outputName: string, value: any): void {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value)
        }
      })
    
    // Also notify store for bridge updates
    if (this.onOutputChange) {
      this.onOutputChange(outputName, value)
    }
  }

  receiveInput(inputName: string, value: any): void {
    // ButtonNode doesn't process inputs, it only triggers outputs
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void inputName
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void value
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
    this.sliderElement.min = String(this.properties.get('min') || 0)
    this.sliderElement.max = String(this.properties.get('max') || 100)
    this.sliderElement.step = String(this.properties.get('step') || 1)
    this.sliderElement.value = String(this.properties.get('value') || 50)
    
    this.sliderElement.style.cssText = `
      width: 120px;
      margin: 0;
    `

    this.sliderElement.addEventListener('input', () => {
      const value = parseFloat(this.sliderElement!.value)
      this.properties.set('value', value)
      this.outputs.set('value', value)
      this.updateLabel()
      console.log(`🎚️ SliderNode ${this.id} value changed to: ${value}, notifying connections`)
      this.notifyConnections('value', value)
    })

    wrapper.appendChild(this.labelElement)
    wrapper.appendChild(this.sliderElement)
    container.appendChild(wrapper)
  }

  private updateLabel(): void {
    const label = this.properties.get('label') || 'Slider'
    const value = this.properties.get('value') || 0
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
    this.initializeMidi()
  }

  private async initializeMidi(): Promise<void> {
    try {
      if (navigator.requestMIDIAccess) {
        this.midiAccess = await navigator.requestMIDIAccess()
        this.setupMidiListeners()
      }
    } catch (error) {
      console.warn('MIDI access not available:', error)
    }
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
            
            case 0xe0: { // Pitch bend
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

// Display Node Implementation
export class DisplayNode extends BaseCustomNode {
  private displayElement?: HTMLDivElement
  private valueElement?: HTMLSpanElement
  private labelElement?: HTMLSpanElement

  constructor(id: string, type: string, audioContext: AudioContext, metadata: NodeMetadata) {
    super(id, type, audioContext, metadata)
    
    // Set initial output to match input (passthrough)
    const initialValue = this.properties.get('currentValue') || 0
    this.outputs.set('output', initialValue)
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
    this.labelElement.style.cssText = `
      font-size: 10px;
      color: #666;
      font-weight: bold;
    `
    this.labelElement.textContent = this.properties.get('label') || 'Display'

    this.valueElement = document.createElement('span')
    this.valueElement.style.cssText = `
      font-size: 14px;
      color: #2563eb;
      font-weight: bold;
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      font-family: 'Courier New', monospace;
    `
    this.updateDisplay()

    this.displayElement.appendChild(this.labelElement)
    this.displayElement.appendChild(this.valueElement)
    container.appendChild(this.displayElement)
  }

  receiveInput(inputName: string, value: any): void {
    console.log(`🔍 DisplayNode ${this.id} receiveInput: ${inputName} = ${value}`)
    if (inputName === 'input') {
      const numValue = Number(value) || 0
      
      // Update the current value property
      this.properties.set('currentValue', numValue)
      
      // Pass through to output (for chaining)
      this.outputs.set('output', numValue)
      this.notifyConnections('output', numValue)
      
      // Update the display
      this.updateDisplay()
      console.log(`📊 DisplayNode ${this.id} updated display to: ${numValue}`)
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
    const min = this.properties.get('min') || 0
    const max = this.properties.get('max') || 100
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
      console.log(`🎲 RandomNode ${this.id} generated: ${newValue.toFixed(2)}`)
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
  }

  private setupAudioNodes(): void {
    this.gainNode = this.audioContext.createGain()
    this.gainNode.gain.value = this.properties.get('gain') || 1
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

    this.fileInputElement.addEventListener('change', (event) => {
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
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      this.outputs.set('loaded', 1)
      this.notifyConnections('loaded', 1)
    } catch (error) {
      console.error('Error loading audio file:', error)
      this.outputs.set('loaded', 0)
      this.notifyConnections('loaded', 0)
    }
  }

  receiveInput(inputName: string, value: any): void {
    if (inputName === 'trigger' && value > 0) {
      this.trigger()
    }
  }

  trigger(): void {
    if (!this.audioBuffer || !this.gainNode) return

    // Stop previous playback
    if (this.bufferSource) {
      this.bufferSource.stop()
      this.bufferSource.disconnect()
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
}

// Factory class for creating custom nodes
export class CustomNodeFactory {
  private audioContext: AudioContext

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  createCustomNode(nodeType: string, metadata: NodeMetadata, properties: Record<string, any> = {}): CustomNode {
    let node: CustomNode

    switch (nodeType) {
      case 'ButtonNode':
        node = new ButtonNode(`${nodeType}-${Date.now()}`, nodeType, this.audioContext, metadata)
        break
      case 'SliderNode':
        node = new SliderNode(`${nodeType}-${Date.now()}`, nodeType, this.audioContext, metadata)
        break
      case 'GreaterThanNode':
        node = new GreaterThanNode(`${nodeType}-${Date.now()}`, nodeType, this.audioContext, metadata)
        break
      case 'EqualsNode':
        node = new EqualsNode(`${nodeType}-${Date.now()}`, nodeType, this.audioContext, metadata)
        break
      case 'SelectNode':
        node = new SelectNode(`${nodeType}-${Date.now()}`, nodeType, this.audioContext, metadata)
        break
      case 'MidiInputNode':
        node = new MidiInputNode(`${nodeType}-${Date.now()}`, nodeType, this.audioContext, metadata)
        break
      case 'MidiToFreqNode':
        node = new MidiToFreqNode(`${nodeType}-${Date.now()}`, nodeType, this.audioContext, metadata)
        break
      case 'DisplayNode':
        node = new DisplayNode(`${nodeType}-${Date.now()}`, nodeType, this.audioContext, metadata)
        break
      case 'SoundFileNode':
        node = new SoundFileNode(`${nodeType}-${Date.now()}`, nodeType, this.audioContext, metadata)
        break
      case 'RandomNode':
        node = new RandomNode(`${nodeType}-${Date.now()}`, nodeType, this.audioContext, metadata)
        break
      default:
        throw new Error(`Unknown custom node type: ${nodeType}`)
    }

    // Apply any initial properties
    Object.entries(properties).forEach(([key, value]) => {
      if (node.setValue && key === 'value') {
        node.setValue(value)
      } else {
        node.properties.set(key, value)
      }
    })

    return node
  }

  isCustomNodeType(nodeType: string): boolean {
    const customNodeTypes = [
      'ButtonNode',
      'SliderNode', 
      'GreaterThanNode',
      'EqualsNode',
      'SelectNode',
      'MidiInputNode',
      'MidiToFreqNode',
      'DisplayNode',
      'SoundFileNode',
      'RandomNode'
    ]
    return customNodeTypes.includes(nodeType)
  }
} 