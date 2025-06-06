// Scale to MIDI utility
// Converts scale degrees to MIDI notes based on key and mode

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

// Semitone intervals for each mode (relative to root)
const SCALE_INTERVALS: Record<Mode, number[]> = {
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
}

// MIDI note numbers for each key at octave 4 (middle octave)
const KEY_TO_MIDI: Record<Key, number> = {
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
}

/**
 * Converts a scale degree to a MIDI note number
 * @param scaleDegree - The scale degree (0-based, can be negative or positive)
 * @param key - The root key of the scale
 * @param mode - The mode/scale type
 * @returns MIDI note number (0-127)
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
  return Math.max(0, Math.min(127, midiNote))
}

/**
 * Gets the closest MIDI note to 60 (middle C) for a given key
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
 * Converts MIDI note to frequency using A4 = 440Hz
 * @param midiNote - MIDI note number (0-127)
 * @returns Frequency in Hz
 */
export function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12)
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
 * @param mode - The mode to get intervals for
 * @returns Array of semitone intervals
 */
export function getScaleIntervals(mode: Mode): number[] {
  return [...SCALE_INTERVALS[mode]]
}

/**
 * Gets a human-readable name for a mode
 * @param mode - The mode to get the name for
 * @returns Human-readable mode name
 */
export function getModeName(mode: Mode): string {
  const names: Record<Mode, string> = {
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
  }
  return names[mode]
}

/**
 * Example usage and testing function
 */
export function exampleUsage() {
  //console.log('=== Scale to MIDI Examples ===')

  // C Major scale
  //console.log('\nC Major scale (degrees 0-7):')
  for (let i = 0; i <= 7; i++) {
    scaleToMidi(i, 'C', 'major')
    //console.log(`Degree ${i}: MIDI ${midi}, ${freq.toFixed(2)} Hz`)
  }

  // B Major scale (closest to middle C)
  //console.log('\nB Major scale (degrees 0-7):')
  for (let i = 0; i <= 7; i++) {
    scaleToMidi(i, 'B', 'major')
    //console.log(`Degree ${i}: MIDI ${midi}, ${freq.toFixed(2)} Hz`)
  }

  // C Pentatonic Minor with negative degrees
  //console.log('\nC Pentatonic Minor (degrees -2 to 7):')
  for (let i = -2; i <= 7; i++) {
    scaleToMidi(i, 'C', 'pentatonic_minor')
    //console.log(`Degree ${i}: MIDI ${midi}, ${freq.toFixed(2)} Hz`)
  }

  // Show closest notes to middle C for different keys
  //console.log('\nClosest notes to middle C (60) for each key:')
  getAvailableKeys().forEach(key => {
    getClosestToMiddleC(key)
    //console.log(`${key}: MIDI ${closest}`)
  })
}
