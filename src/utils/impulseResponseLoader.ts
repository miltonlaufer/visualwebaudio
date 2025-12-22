/**
 * Impulse Response Loader
 *
 * Loads real impulse response audio files for high-quality convolution reverb.
 * Uses impulse responses from OpenAir library via the auralizr project.
 *
 * Source: https://github.com/notthetup/auralizr
 * OpenAir: https://www.openairlib.net/
 */

/******************* TYPES ***********************/

export interface ImpulseResponsePreset {
  id: string
  name: string
  description: string
  url: string
  duration: number // approximate duration in seconds
  category: 'hall' | 'room' | 'plate' | 'chamber' | 'outdoor'
}

/******************* PRESETS ***********************/

/**
 * Available impulse response presets from OpenAir/auralizr
 * These are real acoustic measurements from actual spaces
 * Source: https://github.com/notthetup/auralizr (OpenAir library)
 * Files stored locally in public/audio/impulse-responses/
 */
export const IMPULSE_RESPONSE_PRESETS: ImpulseResponsePreset[] = [
  {
    id: 'mausoleum',
    name: 'Hamilton Mausoleum',
    description:
      'Large stone mausoleum with extremely long reverb tail (~15s). One of the longest natural reverbs in the world.',
    url: '/audio/impulse-responses/mausoleum.wav',
    duration: 15,
    category: 'hall',
  },
  {
    id: 'chapel',
    name: 'Spokane Chapel',
    description:
      'Medium-sized chapel with warm, musical reverb. Great for vocals and acoustic instruments.',
    url: '/audio/impulse-responses/chapel.wav',
    duration: 3,
    category: 'hall',
  },
  {
    id: 'stairwell',
    name: 'Stairwell',
    description: 'Concrete stairwell with bright, reflective reverb. Great for adding presence.',
    url: '/audio/impulse-responses/stairwell.wav',
    duration: 2,
    category: 'room',
  },
  {
    id: 'basement',
    name: 'Basement',
    description: 'Small basement room with tight, intimate reverb. Good for subtle ambience.',
    url: '/audio/impulse-responses/basement.wav',
    duration: 1.5,
    category: 'room',
  },
]

/******************* CACHE ***********************/

/**
 * Cache for loaded impulse responses
 * Key: `${sampleRate}_${presetId}`
 */
const irCache = new Map<string, AudioBuffer>()

/**
 * Track loading promises to prevent duplicate fetches
 */
const loadingPromises = new Map<string, Promise<AudioBuffer>>()

/******************* LOADER ***********************/

/**
 * Load an impulse response from URL
 */
async function fetchImpulseResponse(audioContext: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch impulse response: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

  return audioBuffer
}

/**
 * Get an impulse response by preset ID
 * Returns cached version if available, otherwise loads from URL
 */
export async function getImpulseResponseAsync(
  audioContext: AudioContext,
  presetId: string
): Promise<AudioBuffer> {
  const preset = IMPULSE_RESPONSE_PRESETS.find(p => p.id === presetId)

  if (!preset) {
    throw new Error(`Unknown impulse response preset: ${presetId}`)
  }

  const cacheKey = `${audioContext.sampleRate}_${presetId}`

  // Return cached version if available
  if (irCache.has(cacheKey)) {
    return irCache.get(cacheKey)!
  }

  // Check if already loading
  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey)!
  }

  // Start loading
  const loadPromise = fetchImpulseResponse(audioContext, preset.url)
    .then(buffer => {
      irCache.set(cacheKey, buffer)
      loadingPromises.delete(cacheKey)
      return buffer
    })
    .catch(error => {
      loadingPromises.delete(cacheKey)
      throw error
    })

  loadingPromises.set(cacheKey, loadPromise)

  return loadPromise
}

/**
 * Preload all impulse responses
 * Useful for ensuring fast switching between presets
 */
export async function preloadAllImpulseResponses(audioContext: AudioContext): Promise<void> {
  const promises = IMPULSE_RESPONSE_PRESETS.map(preset =>
    getImpulseResponseAsync(audioContext, preset.id).catch(error => {
      console.warn(`Failed to preload impulse response ${preset.id}:`, error)
    })
  )

  await Promise.all(promises)
}

/**
 * Get preset info by ID
 */
export function getImpulseResponsePreset(presetId: string): ImpulseResponsePreset | undefined {
  return IMPULSE_RESPONSE_PRESETS.find(p => p.id === presetId)
}

/**
 * Get all available preset IDs
 */
export function getAvailableImpulseResponseIds(): string[] {
  return IMPULSE_RESPONSE_PRESETS.map(p => p.id)
}

/**
 * Clear the impulse response cache
 */
export function clearIRCache(): void {
  irCache.clear()
}

/**
 * Check if a preset is cached
 */
export function isImpulseResponseCached(audioContext: AudioContext, presetId: string): boolean {
  const cacheKey = `${audioContext.sampleRate}_${presetId}`
  return irCache.has(cacheKey)
}

/******************* FALLBACK GENERATOR ***********************/

/**
 * Generate a simple synthetic impulse response as fallback
 * Used when network loading fails
 */
export function generateFallbackImpulseResponse(
  audioContext: AudioContext,
  duration: number = 2.0
): AudioBuffer {
  const sampleRate = audioContext.sampleRate
  const length = Math.floor(sampleRate * duration)

  // Create stereo buffer
  const buffer = audioContext.createBuffer(2, length, sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  // Generate noise-based impulse response with exponential decay
  const decay = 3.0

  for (let i = 0; i < length; i++) {
    const normalizedTime = i / length
    const envelope = Math.exp(-decay * normalizedTime)

    // Generate noise with envelope
    leftChannel[i] = (Math.random() * 2 - 1) * envelope * 0.5
    rightChannel[i] = (Math.random() * 2 - 1) * envelope * 0.5
  }

  return buffer
}

/**
 * Get impulse response with fallback to synthetic generation
 * This ensures the convolver always has a buffer, even if network fails
 */
export async function getImpulseResponseWithFallback(
  audioContext: AudioContext,
  presetId: string
): Promise<AudioBuffer> {
  try {
    return await getImpulseResponseAsync(audioContext, presetId)
  } catch (error) {
    console.warn(`Failed to load impulse response ${presetId}, using fallback:`, error)

    const preset = IMPULSE_RESPONSE_PRESETS.find(p => p.id === presetId)
    const duration = preset?.duration ?? 2.0

    return generateFallbackImpulseResponse(audioContext, duration)
  }
}
