/**
 * Node Strategies Module
 *
 * Exports all node strategy interfaces, implementations, and the registry.
 */

// Core interface and base class
export type { INodeStrategy, INodeStrategyContext, IInputProcessingResult } from './INodeStrategy'
export { BaseNodeStrategy } from './INodeStrategy'

// Strategy implementations
export { ButtonStrategy } from './ButtonStrategy'
export { SliderStrategy } from './SliderStrategy'
export { DisplayStrategy } from './DisplayStrategy'
export { MidiToFreqStrategy } from './MidiToFreqStrategy'
export { ScaleToMidiStrategy } from './ScaleToMidiStrategy'
export { MidiInputStrategy } from './MidiInputStrategy'
export { RandomStrategy } from './RandomStrategy'
export { TimerStrategy } from './TimerStrategy'
export { SoundFileStrategy } from './SoundFileStrategy'
export { GreaterThanStrategy, EqualsStrategy, SelectStrategy } from './LogicStrategies'
export { CompositeNodeStrategy, compositeNodeStrategy } from './CompositeNodeStrategy'

// Registry
export {
  StrategyRegistry,
  CUSTOM_NODE_TYPES,
  isCustomNodeType,
  type CustomNodeType,
} from './StrategyRegistry'
