/**
 * Music Domain - Pure utility functions for musical calculations
 *
 * This module provides the single source of truth for:
 * - MIDI note to frequency conversions
 * - Scale degree to MIDI note conversions
 * - Musical key and mode definitions
 */

// MIDI utilities
export {
  midiToFrequency,
  frequencyToMidi,
  midiToNoteName,
  clampMidiNote,
  velocityToGain,
  gainToVelocity,
  MIDI_CONSTANTS,
} from './midiUtils'

// Scale utilities
export {
  scaleToMidi,
  scaleToFrequency,
  getClosestToMiddleC,
  getAvailableKeys,
  getAvailableModes,
  getScaleIntervals,
  getModeName,
  isValidKey,
  isValidMode,
  SCALE_INTERVALS,
  KEY_TO_MIDI,
} from './scaleUtils'

// Types
export type { Key, Mode } from './scaleUtils'
