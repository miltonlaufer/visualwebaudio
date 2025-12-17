/**
 * Scale Utility Functions
 *
 * Pure functions for musical scale conversions.
 * Converts scale degrees to MIDI notes based on key and mode.
 */

import { midiToFrequency, clampMidiNote } from './midiUtils'

/******************* TYPES ***********************/

export type Key = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

export type Mode =
  | 'major'
  | 'minor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian'
  | 'pentatonic_major'
  | 'pentatonic_minor'
  | 'blues'
  | 'harmonic_minor'
  | 'melodic_minor'

/******************* CONSTANTS ***********************/

/**
 * Semitone intervals for each mode (relative to root)
 */
export const SCALE_INTERVALS: Readonly<Record<Mode, readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
} as const

/**
 * MIDI note numbers for each key at octave 4 (middle octave)
 */
export const KEY_TO_MIDI: Readonly<Record<Key, number>> = {
  C: 60, // C4
  'C#': 61, // C#4
  D: 62, // D4
  'D#': 63, // D#4
  E: 64, // E4
  F: 65, // F4
  'F#': 66, // F#4
  G: 67, // G4
  'G#': 68, // G#4
  A: 69, // A4
  'A#': 70, // A#4
  B: 71, // B4
} as const

/**
 * Human-readable names for modes
 */
const MODE_NAMES: Readonly<Record<Mode, string>> = {
  major: 'Major',
  minor: 'Natural Minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  locrian: 'Locrian',
  pentatonic_major: 'Pentatonic Major',
  pentatonic_minor: 'Pentatonic Minor',
  blues: 'Blues',
  harmonic_minor: 'Harmonic Minor',
  melodic_minor: 'Melodic Minor',
} as const

/******************* FUNCTIONS ***********************/

/**
 * Converts a scale degree to a MIDI note number
 *
 * @param scaleDegree - The scale degree (0-based, can be negative or positive)
 * @param key - The root key of the scale
 * @param mode - The mode/scale type
 * @returns MIDI note number (0-127)
 *
 * @example
 * scaleToMidi(0, 'C', 'major')  // 60 (C4)
 * scaleToMidi(4, 'C', 'major')  // 67 (G4)
 * scaleToMidi(-1, 'C', 'major') // 59 (B3)
 */
export function scaleToMidi(scaleDegree: number, key: Key, mode: Mode): number {
  const intervals = SCALE_INTERVALS[mode]
  const rootMidi = KEY_TO_MIDI[key]

  // Handle negative scale degrees
  const octaveOffset = Math.floor(scaleDegree / intervals.length)
  const normalizedDegree = ((scaleDegree % intervals.length) + intervals.length) % intervals.length

  // Get the interval for this scale degree
  const interval = intervals[normalizedDegree]

  // Calculate final MIDI note
  const midiNote = rootMidi + interval + octaveOffset * 12

  // Clamp to valid MIDI range (0-127)
  return clampMidiNote(midiNote)
}

/**
 * Converts a scale degree to frequency in Hz
 *
 * @param scaleDegree - The scale degree (0-based, can be negative or positive)
 * @param key - The root key of the scale
 * @param mode - The mode/scale type
 * @returns Frequency in Hz
 *
 * @example
 * scaleToFrequency(0, 'A', 'major')  // 440 Hz (A4)
 */
export function scaleToFrequency(scaleDegree: number, key: Key, mode: Mode): number {
  const midiNote = scaleToMidi(scaleDegree, key, mode)
  return midiToFrequency(midiNote)
}

/**
 * Gets the closest MIDI note to 60 (middle C) for a given key
 *
 * @param key - The key to find the closest note for
 * @returns MIDI note number closest to 60
 */
export function getClosestToMiddleC(key: Key): number {
  const keyMidi = KEY_TO_MIDI[key]

  // Find the closest octave by checking which octave puts us closest to 60
  let closestMidi = keyMidi
  let closestDistance = Math.abs(keyMidi - 60)

  // Check octave above and below
  const octaveAbove = keyMidi + 12
  const octaveBelow = keyMidi - 12

  if (Math.abs(octaveAbove - 60) < closestDistance) {
    closestMidi = octaveAbove
    closestDistance = Math.abs(octaveAbove - 60)
  }

  if (Math.abs(octaveBelow - 60) < closestDistance) {
    closestMidi = octaveBelow
  }

  return closestMidi
}

/**
 * Gets all available keys
 */
export function getAvailableKeys(): Key[] {
  return Object.keys(KEY_TO_MIDI) as Key[]
}

/**
 * Gets all available modes
 */
export function getAvailableModes(): Mode[] {
  return Object.keys(SCALE_INTERVALS) as Mode[]
}

/**
 * Gets the scale intervals for a given mode
 *
 * @param mode - The mode to get intervals for
 * @returns Array of semitone intervals
 */
export function getScaleIntervals(mode: Mode): number[] {
  return [...SCALE_INTERVALS[mode]]
}

/**
 * Gets a human-readable name for a mode
 *
 * @param mode - The mode to get the name for
 * @returns Human-readable mode name
 */
export function getModeName(mode: Mode): string {
  return MODE_NAMES[mode]
}

/**
 * Checks if a string is a valid Key
 */
export function isValidKey(key: string): key is Key {
  return key in KEY_TO_MIDI
}

/**
 * Checks if a string is a valid Mode
 */
export function isValidMode(mode: string): mode is Mode {
  return mode in SCALE_INTERVALS
}
