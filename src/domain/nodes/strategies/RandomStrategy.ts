/**
 * Random Node Strategy
 *
 * Generates random values at a configurable rate within a min/max range.
 * Uses interval-based generation that can be controlled via properties.
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'

// Store interval IDs outside the strategy instance (volatile state in MST)
const intervalIds = new Map<string, number>()

export class RandomStrategy extends BaseNodeStrategy {
  readonly nodeType = 'RandomNode'

  initialize(context: INodeStrategyContext): void {
    // Generate and set initial value
    const initialValue = this.generateRandomValue(context)
    context.state.setProperty('currentValue', initialValue)
    context.state.setOutput('value', initialValue)

    // Start random generation
    this.startRandomGeneration(context)
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  handleInput(
    _context: INodeStrategyContext,
    _inputName: string,
    _value: unknown
  ): IInputProcessingResult | void {
    // RandomNode is a source node, doesn't process inputs
    return undefined
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /* eslint-disable @typescript-eslint/no-unused-vars */
  onPropertyChange(
    context: INodeStrategyContext,
    propertyName: string,
    _value: unknown
  ): IInputProcessingResult | void {
    if (propertyName === 'rate') {
      // Restart generation with new rate
      this.restartRandomGeneration(context)
    }
    return undefined
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  cleanup(context: INodeStrategyContext): void {
    this.stopRandomGeneration(context.state.id)
  }

  private generateRandomValue(context: INodeStrategyContext): number {
    const min = context.state.properties.get('min') ?? 0
    const max = context.state.properties.get('max') ?? 100
    return Math.random() * (max - min) + min
  }

  private startRandomGeneration(context: INodeStrategyContext): void {
    this.stopRandomGeneration(context.state.id)

    const rate = context.state.properties.get('rate') || 1
    const intervalMs = 1000 / rate // Convert Hz to milliseconds

    const intervalId = window.setInterval(() => {
      try {
        const newValue = this.generateRandomValue(context)
        context.state.setProperty('currentValue', newValue)
        context.state.setOutput('value', newValue)
      } catch {
        // Node may have been destroyed, stop generation
        this.stopRandomGeneration(context.state.id)
      }
    }, intervalMs)

    intervalIds.set(context.state.id, intervalId)
  }

  private stopRandomGeneration(nodeId: string): void {
    const intervalId = intervalIds.get(nodeId)
    if (intervalId !== undefined) {
      window.clearInterval(intervalId)
      intervalIds.delete(nodeId)
    }
  }

  private restartRandomGeneration(context: INodeStrategyContext): void {
    this.startRandomGeneration(context)
  }
}
