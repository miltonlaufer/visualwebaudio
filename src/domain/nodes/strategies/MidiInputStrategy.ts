/**
 * MIDI Input Node Strategy
 *
 * Handles MIDI device access and message processing.
 * Outputs note, velocity, CC, and pitch bend values from MIDI input.
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'

// Store MIDI state outside strategy instance
const midiState = new Map<
  string,
  {
    midiAccess?: MIDIAccess
    selectedDevice?: string
  }
>()

export class MidiInputStrategy extends BaseNodeStrategy {
  readonly nodeType = 'MidiInputNode'

  initialize(context: INodeStrategyContext): void {
    midiState.set(context.state.id, {})
    // MIDI access is requested by the UI component, not automatically
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  handleInput(
    _context: INodeStrategyContext,
    _inputName: string,
    _value: unknown
  ): IInputProcessingResult | void {
    // MidiInputNode is a source node, doesn't process inputs from other nodes
    return undefined
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  cleanup(context: INodeStrategyContext): void {
    this.clearMidiListeners(context)
    midiState.delete(context.state.id)
  }

  /**
   * Called by the UI component when MIDI access is granted
   */
  setMidiAccess(context: INodeStrategyContext, midiAccess: MIDIAccess): void {
    const state = midiState.get(context.state.id)
    if (state) {
      state.midiAccess = midiAccess
      this.setupMidiListeners(context)
    }
  }

  /**
   * Called by the UI component when user selects a MIDI device
   */
  setSelectedDevice(context: INodeStrategyContext, deviceId: string): void {
    const state = midiState.get(context.state.id)
    if (state) {
      state.selectedDevice = deviceId
      context.state.setProperty('selectedDeviceId', deviceId)

      // Re-setup listeners with new device selection
      if (state.midiAccess) {
        this.setupMidiListeners(context)
      }
    }
  }

  private setupMidiListeners(context: INodeStrategyContext): void {
    const state = midiState.get(context.state.id)
    if (!state?.midiAccess) return

    const channel = context.state.properties.get('channel') || 1

    state.midiAccess.inputs.forEach((input: MIDIInput) => {
      // Only listen to selected device if one is specified
      if (state.selectedDevice && input.id !== state.selectedDevice) {
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
          try {
            this.processMidiMessage(context, status, data1, data2)
          } catch {
            // Node may be detached, ignore
          }
        }
      }
    })
  }

  private processMidiMessage(
    context: INodeStrategyContext,
    status: number,
    data1: number,
    data2: number
  ): void {
    const messageType = status & 0xf0

    switch (messageType) {
      case 0x90: // Note on
        context.state.setOutput('note', data1)
        context.state.setOutput('velocity', data2)
        break

      case 0x80: // Note off
        context.state.setOutput('note', data1)
        context.state.setOutput('velocity', 0)
        break

      case 0xb0: // Control change
        context.state.setOutput('cc', data2)
        break

      case 0xe0: {
        // Pitch bend
        const pitchValue = (data2 << 7) | data1
        context.state.setOutput('pitch', pitchValue)
        break
      }
    }
  }

  private clearMidiListeners(context: INodeStrategyContext): void {
    const state = midiState.get(context.state.id)
    if (!state?.midiAccess) return

    state.midiAccess.inputs.forEach((input: MIDIInput) => {
      input.onmidimessage = null
    })
  }
}
