/**
 * Button Node Strategy
 *
 * A simple trigger node that outputs a timestamp value when triggered.
 * Used to initiate events in the audio graph.
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'

export class ButtonStrategy extends BaseNodeStrategy {
  readonly nodeType = 'ButtonNode'

  /* eslint-disable @typescript-eslint/no-unused-vars */
  handleInput(
    _context: INodeStrategyContext,
    _inputName: string,
    _value: unknown
  ): IInputProcessingResult | void {
    // ButtonNode doesn't process inputs, it only triggers outputs
    return undefined
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  trigger(context: INodeStrategyContext): IInputProcessingResult {
    // Generate a timestamp-based trigger value (always > 0)
    const triggerValue = Date.now()
    const outputValue = context.state.properties.get('outputValue') || 1

    return {
      outputs: { trigger: triggerValue },
      properties: { currentValue: outputValue },
    }
  }
}
