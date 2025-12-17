/**
 * MIDI to Frequency Node Strategy
 *
 * Converts MIDI note numbers to frequency values.
 * Supports configurable base frequency and base MIDI note for alternative tunings.
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'

export class MidiToFreqStrategy extends BaseNodeStrategy {
  readonly nodeType = 'MidiToFreqNode'

  handleInput(
    context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void {
    if (inputName === 'midiNote') {
      const midiNote = Number(value) || 0
      const frequency = this.calculateFrequency(context, midiNote)

      return {
        outputs: { frequency },
      }
    }
    return undefined
  }

  private calculateFrequency(context: INodeStrategyContext, midiNote: number): number {
    // Support configurable base frequency and MIDI note for alternative tunings
    const baseFreq = context.state.properties.get('baseFreq') || 440
    const baseMidi = context.state.properties.get('baseMidi') || 69
    return baseFreq * Math.pow(2, (midiNote - baseMidi) / 12)
  }
}
