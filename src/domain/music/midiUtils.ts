/**
 * MIDI Utility Functions
 *
 * Pure functions for MIDI-related conversions.
 * This is the single source of truth for MIDI calculations in the application.
 */

/**
 * Converts a MIDI note number to frequency in Hz.
 * Uses A4 = 440Hz as the reference pitch (MIDI note 69).
 *
 * @param midiNote - MIDI note number (0-127)
 * @param referenceFrequency - Reference frequency for A4 (default: 440Hz)
 * @returns Frequency in Hz
 *
 * @example
 * midiToFrequency(69)  // 440 Hz (A4)
 * midiToFrequency(60)  // ~261.63 Hz (C4)
 * midiToFrequency(81)  // 880 Hz (A5)
 */
export function midiToFrequency(midiNote: number, referenceFrequency = 440): number {
  return referenceFrequency * Math.pow(2, (midiNote - 69) / 12)
}

/**
 * Converts a frequency in Hz to the nearest MIDI note number.
 *
 * @param frequency - Frequency in Hz
 * @param referenceFrequency - Reference frequency for A4 (default: 440Hz)
 * @returns MIDI note number (0-127, clamped)
 *
 * @example
 * frequencyToMidi(440)     // 69 (A4)
 * frequencyToMidi(261.63)  // 60 (C4)
 */
export function frequencyToMidi(frequency: number, referenceFrequency = 440): number {
  const midiNote = 69 + 12 * Math.log2(frequency / referenceFrequency)
  return Math.max(0, Math.min(127, Math.round(midiNote)))
}

/**
 * Gets the note name for a MIDI note number.
 *
 * @param midiNote - MIDI note number (0-127)
 * @returns Note name with octave (e.g., "C4", "F#5")
 *
 * @example
 * midiToNoteName(60)  // "C4"
 * midiToNoteName(69)  // "A4"
 * midiToNoteName(66)  // "F#4"
 */
export function midiToNoteName(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midiNote / 12) - 1
  const noteIndex = midiNote % 12
  return `${noteNames[noteIndex]}${octave}`
}

/**
 * Clamps a MIDI note to the valid range (0-127).
 *
 * @param midiNote - Any number representing a MIDI note
 * @returns Clamped MIDI note (0-127)
 */
export function clampMidiNote(midiNote: number): number {
  return Math.max(0, Math.min(127, Math.round(midiNote)))
}

/**
 * Converts a MIDI velocity (0-127) to a gain value (0-1).
 *
 * @param velocity - MIDI velocity (0-127)
 * @returns Gain value (0-1)
 */
export function velocityToGain(velocity: number): number {
  return Math.max(0, Math.min(1, velocity / 127))
}

/**
 * Converts a gain value (0-1) to MIDI velocity (0-127).
 *
 * @param gain - Gain value (0-1)
 * @returns MIDI velocity (0-127)
 */
export function gainToVelocity(gain: number): number {
  return Math.max(0, Math.min(127, Math.round(gain * 127)))
}

/**
 * MIDI Reference Constants
 */
export const MIDI_CONSTANTS = {
  /** MIDI note number for A4 (440Hz) */
  A4_NOTE: 69,
  /** Standard reference frequency for A4 */
  A4_FREQUENCY: 440,
  /** MIDI note number for Middle C (C4) */
  MIDDLE_C: 60,
  /** Minimum valid MIDI note */
  MIN_NOTE: 0,
  /** Maximum valid MIDI note */
  MAX_NOTE: 127,
  /** Minimum valid MIDI velocity */
  MIN_VELOCITY: 0,
  /** Maximum valid MIDI velocity */
  MAX_VELOCITY: 127,
} as const
