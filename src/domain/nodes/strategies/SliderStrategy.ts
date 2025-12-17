/**
 * Slider Node Strategy
 *
 * A control node that outputs a numeric value within a configurable range.
 * The value can be changed via UI interaction or programmatically.
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'

export class SliderStrategy extends BaseNodeStrategy {
  readonly nodeType = 'SliderNode'

  initialize(context: INodeStrategyContext): void {
    // Set initial output value from properties
    const initialValue = context.state.properties.get('value') ?? 50
    context.state.setOutput('value', initialValue)
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  handleInput(
    _context: INodeStrategyContext,
    _inputName: string,
    _value: unknown
  ): IInputProcessingResult | void {
    // SliderNode doesn't process inputs from other nodes
    // It's a source node controlled by UI
    return undefined
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  onPropertyChange(
    _context: INodeStrategyContext,
    propertyName: string,
    value: unknown
  ): IInputProcessingResult | void {
    if (propertyName === 'value') {
      // When value property changes, update the output
      return {
        outputs: { value: value },
      }
    }
    return undefined
  }
}
