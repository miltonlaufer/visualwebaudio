/**
 * Strategy Pattern Interface for Custom Node Behaviors
 *
 * Each custom node type implements this interface to define its behavior.
 * The strategy handles:
 * - Input processing (receiveInput)
 * - Property changes (onPropertyChange)
 * - Output computation
 * - Lifecycle events (initialize, cleanup)
 *
 * UI concerns are handled separately by React components.
 */

import type { ICustomNodeState } from '~/stores/CustomNodeStore'

/**
 * Context passed to strategy methods for accessing node state and utilities
 */
export interface INodeStrategyContext {
  /** The MST node state instance */
  state: ICustomNodeState
  /** Audio context for nodes that need audio processing */
  audioContext?: AudioContext
}

/**
 * Result from input processing that can update outputs and properties
 */
export interface IInputProcessingResult {
  /** Outputs to set on the node */
  outputs?: Record<string, unknown>
  /** Properties to update on the node */
  properties?: Record<string, unknown>
}

/**
 * Strategy interface for custom node behavior
 */
export interface INodeStrategy {
  /**
   * Unique identifier for this strategy (matches the node type)
   */
  readonly nodeType: string

  /**
   * Called when the node is initialized.
   * Use this to set up initial state, start timers, etc.
   */
  initialize(context: INodeStrategyContext): void

  /**
   * Called when the node receives input from a connected source node.
   *
   * @param context - Strategy context with node state
   * @param inputName - Name of the input that received the value
   * @param value - The value received
   * @returns Optional result with outputs/properties to update
   */
  handleInput(
    context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void

  /**
   * Called when a property changes on the node.
   * This can trigger output recalculation.
   *
   * @param context - Strategy context with node state
   * @param propertyName - Name of the property that changed
   * @param value - New value of the property
   * @returns Optional result with outputs/properties to update
   */
  onPropertyChange(
    context: INodeStrategyContext,
    propertyName: string,
    value: unknown
  ): IInputProcessingResult | void

  /**
   * Called when the node is being cleaned up/destroyed.
   * Use this to stop timers, release resources, etc.
   */
  cleanup(context: INodeStrategyContext): void

  /**
   * Called when a trigger action occurs (e.g., button click).
   * Not all nodes support this - optional implementation.
   */
  trigger?(context: INodeStrategyContext): IInputProcessingResult | void

  /**
   * Called when the audio context changes (e.g., after pause/resume).
   * Only needed for nodes that use audio features.
   */
  onAudioContextChange?(context: INodeStrategyContext, audioContext: AudioContext): void
}

/**
 * Base class providing default implementations for optional methods.
 * Strategies can extend this to avoid boilerplate.
 */
export abstract class BaseNodeStrategy implements INodeStrategy {
  abstract readonly nodeType: string

  /* eslint-disable @typescript-eslint/no-unused-vars */
  initialize(_context: INodeStrategyContext): void {
    // Default: no initialization needed
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  abstract handleInput(
    context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void

  /* eslint-disable @typescript-eslint/no-unused-vars */
  onPropertyChange(
    _context: INodeStrategyContext,
    _propertyName: string,
    _value: unknown
  ): IInputProcessingResult | void {
    // Default: no action on property change
    return undefined
  }

  cleanup(_context: INodeStrategyContext): void {
    // Default: no cleanup needed
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
