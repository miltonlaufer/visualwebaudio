/**
 * Strategy Registry
 *
 * Repository pattern implementation for node strategies.
 * Provides a centralized way to look up and instantiate strategies by node type.
 */

import type { INodeStrategy } from './INodeStrategy'
import { ButtonStrategy } from './ButtonStrategy'
import { SliderStrategy } from './SliderStrategy'
import { DisplayStrategy } from './DisplayStrategy'
import { MidiToFreqStrategy } from './MidiToFreqStrategy'
import { ScaleToMidiStrategy } from './ScaleToMidiStrategy'
import { RandomStrategy } from './RandomStrategy'
import { TimerStrategy } from './TimerStrategy'
import { SoundFileStrategy } from './SoundFileStrategy'
import { MidiInputStrategy } from './MidiInputStrategy'
import { GreaterThanStrategy, EqualsStrategy, SelectStrategy } from './LogicStrategies'

/**
 * Registry of all available node strategies.
 * Uses singleton pattern - strategies are instantiated once and reused.
 */
class StrategyRegistryImpl {
  private strategies: Map<string, INodeStrategy> = new Map()

  constructor() {
    this.registerDefaultStrategies()
  }

  /**
   * Register the default set of strategies
   */
  private registerDefaultStrategies(): void {
    // Control nodes
    this.register(new ButtonStrategy())
    this.register(new SliderStrategy())

    // Display nodes
    this.register(new DisplayStrategy())

    // Music/MIDI nodes
    this.register(new MidiToFreqStrategy())
    this.register(new ScaleToMidiStrategy())
    this.register(new MidiInputStrategy())

    // Utility nodes
    this.register(new RandomStrategy())
    this.register(new TimerStrategy())
    this.register(new SoundFileStrategy())

    // Logic nodes
    this.register(new GreaterThanStrategy())
    this.register(new EqualsStrategy())
    this.register(new SelectStrategy())
  }

  /**
   * Register a strategy for a node type
   */
  register(strategy: INodeStrategy): void {
    this.strategies.set(strategy.nodeType, strategy)
  }

  /**
   * Get a strategy by node type
   */
  get(nodeType: string): INodeStrategy | undefined {
    return this.strategies.get(nodeType)
  }

  /**
   * Check if a strategy exists for a node type
   */
  has(nodeType: string): boolean {
    return this.strategies.has(nodeType)
  }

  /**
   * Get all registered node types
   */
  getNodeTypes(): string[] {
    return Array.from(this.strategies.keys())
  }

  /**
   * Check if a node type is a custom node (has a strategy)
   */
  isCustomNodeType(nodeType: string): boolean {
    return this.strategies.has(nodeType)
  }
}

/**
 * Singleton instance of the strategy registry
 */
export const StrategyRegistry = new StrategyRegistryImpl()

/**
 * List of all custom node types (for backward compatibility)
 */
export const CUSTOM_NODE_TYPES = [
  'ButtonNode',
  'SliderNode',
  'DisplayNode',
  'MidiToFreqNode',
  'ScaleToMidiNode',
  'MidiInputNode',
  'RandomNode',
  'TimerNode',
  'SoundFileNode',
  'GreaterThanNode',
  'EqualsNode',
  'SelectNode',
] as const

export type CustomNodeType = (typeof CUSTOM_NODE_TYPES)[number]

/**
 * Type guard to check if a string is a valid custom node type
 */
export function isCustomNodeType(nodeType: string): nodeType is CustomNodeType {
  return CUSTOM_NODE_TYPES.includes(nodeType as CustomNodeType)
}
