/**
 * @deprecated Import from '~/domain/music' instead
 *
 * This file re-exports from the new domain layer for backward compatibility.
 * All new code should import directly from '~/domain/music'.
 */

// Import everything from domain/music for local use
import {
  // Scale utilities
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
  // MIDI utilities
  midiToFrequency,
  frequencyToMidi,
  midiToNoteName,
  clampMidiNote,
  velocityToGain,
  gainToVelocity,
  MIDI_CONSTANTS,
  // Types
  type Key,
  type Mode,
} from '~/domain/music'

// Re-export everything for backward compatibility
export {
  // Scale utilities
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
  // MIDI utilities
  midiToFrequency,
  frequencyToMidi,
  midiToNoteName,
  clampMidiNote,
  velocityToGain,
  gainToVelocity,
  MIDI_CONSTANTS,
  // Types
  type Key,
  type Mode,
}

// Legacy export for backward compatibility with existing tests
export function exampleUsage(): void {
  // C Major scale
  for (let i = 0; i <= 7; i++) {
    scaleToMidi(i, 'C', 'major')
  }

  // B Major scale (closest to middle C)
  for (let i = 0; i <= 7; i++) {
    scaleToMidi(i, 'B', 'major')
  }

  // C Pentatonic Minor with negative degrees
  for (let i = -2; i <= 7; i++) {
    scaleToMidi(i, 'C', 'pentatonic_minor')
  }

  // Show closest notes to middle C for different keys
  getAvailableKeys().forEach(key => {
    getClosestToMiddleC(key)
  })
}
