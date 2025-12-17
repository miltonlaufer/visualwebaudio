/**
 * Logic Node Strategies
 *
 * Strategies for comparison and routing nodes.
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'

// Store input values outside strategy instance
const inputState = new Map<string, { input1: number; input2: number }>()

/**
 * Greater Than Node Strategy
 * Compares two inputs and outputs 1 if input1 > input2, otherwise 0.
 */
export class GreaterThanStrategy extends BaseNodeStrategy {
  readonly nodeType = 'GreaterThanNode'

  initialize(context: INodeStrategyContext): void {
    inputState.set(context.state.id, { input1: 0, input2: 0 })
    context.state.setOutput('result', 0)
  }

  handleInput(
    context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void {
    const state = inputState.get(context.state.id) || { input1: 0, input2: 0 }

    if (inputName === 'input1') {
      state.input1 = Number(value) || 0
    } else if (inputName === 'input2') {
      state.input2 = Number(value) || 0
    }

    inputState.set(context.state.id, state)
    return this.calculateResult(state)
  }

  cleanup(context: INodeStrategyContext): void {
    inputState.delete(context.state.id)
  }

  private calculateResult(state: { input1: number; input2: number }): IInputProcessingResult {
    const result = state.input1 > state.input2 ? 1 : 0
    return { outputs: { result } }
  }
}

/**
 * Equals Node Strategy
 * Compares two inputs and outputs 1 if they are equal (within tolerance), otherwise 0.
 */
export class EqualsStrategy extends BaseNodeStrategy {
  readonly nodeType = 'EqualsNode'

  initialize(context: INodeStrategyContext): void {
    inputState.set(context.state.id, { input1: 0, input2: 0 })
    context.state.setOutput('result', 0)
  }

  handleInput(
    context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void {
    const state = inputState.get(context.state.id) || { input1: 0, input2: 0 }

    if (inputName === 'input1') {
      state.input1 = Number(value) || 0
    } else if (inputName === 'input2') {
      state.input2 = Number(value) || 0
    }

    inputState.set(context.state.id, state)
    return this.calculateResult(context, state)
  }

  cleanup(context: INodeStrategyContext): void {
    inputState.delete(context.state.id)
  }

  private calculateResult(
    context: INodeStrategyContext,
    state: { input1: number; input2: number }
  ): IInputProcessingResult {
    const tolerance = context.state.properties.get('tolerance') || 0.001
    const result = Math.abs(state.input1 - state.input2) <= tolerance ? 1 : 0
    return { outputs: { result } }
  }
}

// Store select node state
const selectState = new Map<string, { selector: number; input: unknown }>()

/**
 * Select Node Strategy
 * Routes input to one of multiple outputs based on a selector value.
 */
export class SelectStrategy extends BaseNodeStrategy {
  readonly nodeType = 'SelectNode'

  initialize(context: INodeStrategyContext): void {
    selectState.set(context.state.id, { selector: 0, input: 0 })
  }

  handleInput(
    context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void {
    const state = selectState.get(context.state.id) || { selector: 0, input: 0 }

    if (inputName === 'selector') {
      state.selector = Math.floor(Number(value) || 0)
    } else if (inputName === 'input') {
      state.input = value
    }

    selectState.set(context.state.id, state)
    return this.routeOutput(context, state)
  }

  cleanup(context: INodeStrategyContext): void {
    selectState.delete(context.state.id)
  }

  private routeOutput(
    context: INodeStrategyContext,
    state: { selector: number; input: unknown }
  ): IInputProcessingResult {
    const numOutputs = context.state.properties.get('numOutputs') || 2
    const outputIndex = Math.max(0, Math.min(state.selector, numOutputs - 1))
    const outputName = `output${outputIndex}`

    return {
      outputs: { [outputName]: state.input },
    }
  }
}
