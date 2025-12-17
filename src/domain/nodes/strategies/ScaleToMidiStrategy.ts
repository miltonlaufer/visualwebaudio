/**
 * Scale to MIDI Node Strategy
 *
 * Converts scale degrees to MIDI note numbers and frequencies.
 * Supports multiple musical keys and modes (scales).
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'
import {
  scaleToMidi,
  midiToFrequency,
  isValidKey,
  isValidMode,
  type Key,
  type Mode,
} from '~/domain/music'

export class ScaleToMidiStrategy extends BaseNodeStrategy {
  readonly nodeType = 'ScaleToMidiNode'

  initialize(context: INodeStrategyContext): void {
    // Calculate and set initial outputs
    this.updateOutputs(context)
  }

  handleInput(
    context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void {
    if (inputName === 'scaleDegree') {
      const scaleDegree = Number(value) || 0

      // Update property first, then recalculate
      context.state.setProperty('scaleDegree', scaleDegree)
      return this.updateOutputs(context)
    }
    return undefined
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  onPropertyChange(
    context: INodeStrategyContext,
    propertyName: string,
    _value: unknown
  ): IInputProcessingResult | void {
    if (propertyName === 'scaleDegree' || propertyName === 'key' || propertyName === 'mode') {
      return this.updateOutputs(context)
    }
    return undefined
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  private updateOutputs(context: INodeStrategyContext): IInputProcessingResult {
    const scaleDegree = context.state.properties.get('scaleDegree') || 0
    const key = context.state.properties.get('key') || 'C'
    const mode = context.state.properties.get('mode') || 'major'

    // Validate and get typed values
    const validKey: Key = isValidKey(key) ? key : 'C'
    const validMode: Mode = isValidMode(mode) ? mode : 'major'

    // Calculate using domain utilities
    const midiNote = scaleToMidi(scaleDegree, validKey, validMode)
    const frequency = midiToFrequency(midiNote)

    return {
      properties: { midiNote, frequency },
      outputs: { midiNote, frequency },
    }
  }
}
