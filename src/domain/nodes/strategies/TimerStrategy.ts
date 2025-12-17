/**
 * Timer Node Strategy
 *
 * A timer node that generates trigger events at configurable intervals.
 * Supports one-shot and loop modes with delay and interval settings.
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'

// Store timer IDs outside the strategy instance (volatile state)
const timerState = new Map<
  string,
  {
    timeoutId?: number
    intervalId?: number
  }
>()

export class TimerStrategy extends BaseNodeStrategy {
  readonly nodeType = 'TimerNode'

  initialize(context: INodeStrategyContext): void {
    // Initialize timer state
    timerState.set(context.state.id, {})

    // Check if auto-start is enabled
    const startMode = context.state.properties.get('startMode') || 'auto'
    const enabled = (context.state.properties.get('enabled') || 'true') === 'true'

    if (startMode === 'auto' && enabled) {
      this.startTimer(context)
    }
  }

  handleInput(
    context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void {
    if (inputName === 'trigger' && Number(value) > 0) {
      // External trigger to start the timer
      this.startTimer(context)
      return undefined
    }
    if (inputName === 'reset' && Number(value) > 0) {
      // Reset the timer
      return this.resetTimer(context)
    }
    return undefined
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  onPropertyChange(
    context: INodeStrategyContext,
    propertyName: string,
    _value: unknown
  ): IInputProcessingResult | void {
    if (propertyName === 'enabled') {
      const enabled = (context.state.properties.get('enabled') || 'true') === 'true'
      if (!enabled) {
        this.stopTimer(context)
      }
    }
    return undefined
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  cleanup(context: INodeStrategyContext): void {
    this.stopTimer(context)
    timerState.delete(context.state.id)
  }

  trigger(context: INodeStrategyContext): IInputProcessingResult | void {
    this.startTimer(context)
    return undefined
  }

  private startTimer(context: INodeStrategyContext): void {
    const isRunning = context.state.properties.get('isRunning') === 'true'
    const enabled = (context.state.properties.get('enabled') || 'true') === 'true'

    if (isRunning || !enabled) {
      return
    }

    const delay = context.state.properties.get('delay') || 1000
    const mode = context.state.properties.get('mode') || 'loop'

    context.state.setProperty('isRunning', 'true')

    const state = timerState.get(context.state.id) || {}

    // Start with initial delay
    state.timeoutId = window.setTimeout(() => {
      try {
        // Check if timer is still running
        if (context.state.properties.get('isRunning') !== 'true') return

        const currentCount = (context.state.properties.get('count') || 0) + 1
        this.fireTrigger(context, currentCount)

        // If loop mode, start interval
        if (mode === 'loop' && context.state.properties.get('isRunning') === 'true') {
          const interval = context.state.properties.get('interval') || 1000

          state.intervalId = window.setInterval(() => {
            try {
              if (context.state.properties.get('isRunning') !== 'true') {
                this.stopTimer(context)
                return
              }
              const count = (context.state.properties.get('count') || 0) + 1
              this.fireTrigger(context, count)
            } catch {
              this.stopTimer(context)
            }
          }, interval)

          timerState.set(context.state.id, state)
        } else {
          // One-shot mode, stop after first trigger
          context.state.setProperty('isRunning', 'false')
        }
      } catch {
        // Node was detached, ignore
      }
    }, delay)

    timerState.set(context.state.id, state)
  }

  private stopTimer(context: INodeStrategyContext): void {
    const state = timerState.get(context.state.id)
    if (!state) return

    if (state.timeoutId !== undefined) {
      window.clearTimeout(state.timeoutId)
      state.timeoutId = undefined
    }

    if (state.intervalId !== undefined) {
      window.clearInterval(state.intervalId)
      state.intervalId = undefined
    }

    try {
      context.state.setProperty('isRunning', 'false')
    } catch {
      // Node may be detached
    }
  }

  private resetTimer(context: INodeStrategyContext): IInputProcessingResult {
    this.stopTimer(context)
    return {
      properties: { count: 0 },
      outputs: { count: 0 },
    }
  }

  private fireTrigger(context: INodeStrategyContext, count: number): void {
    // Use timestamp like ButtonNode to ensure unique trigger values
    context.state.setOutput('trigger', Date.now())
    context.state.setOutput('count', count)
    context.state.setProperty('count', count)
  }
}
