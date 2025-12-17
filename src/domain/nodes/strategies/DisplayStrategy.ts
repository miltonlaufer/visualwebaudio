/**
 * Display Node Strategy
 *
 * A utility node that displays numeric values and passes them through.
 * Acts as both a display and a passthrough for value chaining.
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'

export class DisplayStrategy extends BaseNodeStrategy {
  readonly nodeType = 'DisplayNode'

  initialize(context: INodeStrategyContext): void {
    // Set initial output to match current value (passthrough)
    const initialValue = context.state.properties.get('currentValue') ?? 0
    context.state.setOutput('output', initialValue)
  }

  handleInput(
    _context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void {
    if (inputName === 'input') {
      const numValue = Number(value) || 0

      return {
        // Update the display value
        properties: { currentValue: numValue },
        // Pass through to output for chaining
        outputs: { output: numValue },
      }
    }
    return undefined
  }
}
