/**
 * Impulse Response Generator
 *
 * Generates synthetic impulse responses for convolution reverb.
 * This approach avoids needing to bundle large audio files.
 */

export type ReverbPreset = 'hall' | 'room' | 'plate' | 'spring'

interface ReverbParams {
  duration: number // seconds
  decay: number // decay rate (higher = faster decay)
  highFreqDamping: number // 0-1, higher = more damping
  density: number // 0-1, higher = denser reverb
  predelay: number // milliseconds
}

const REVERB_PRESETS: Record<ReverbPreset, ReverbParams> = {
  hall: {
    duration: 3.0,
    decay: 2.5,
    highFreqDamping: 0.4,
    density: 0.8,
    predelay: 25,
  },
  room: {
    duration: 1.0,
    decay: 4.0,
    highFreqDamping: 0.6,
    density: 0.6,
    predelay: 10,
  },
  plate: {
    duration: 2.0,
    decay: 3.0,
    highFreqDamping: 0.3,
    density: 0.9,
    predelay: 5,
  },
  spring: {
    duration: 1.5,
    decay: 3.5,
    highFreqDamping: 0.5,
    density: 0.5,
    predelay: 15,
  },
}

/**
 * Generates a synthetic impulse response buffer
 */
export function generateImpulseResponse(
  audioContext: AudioContext,
  preset: ReverbPreset = 'hall'
): AudioBuffer {
  const params = REVERB_PRESETS[preset]
  const sampleRate = audioContext.sampleRate
  const length = Math.floor(sampleRate * params.duration)
  const predelaySamples = Math.floor((params.predelay / 1000) * sampleRate)

  // Create stereo buffer
  const buffer = audioContext.createBuffer(2, length, sampleRate)
  const leftChannel = buffer.getChannelData(0)
  const rightChannel = buffer.getChannelData(1)

  // Generate noise-based impulse response with exponential decay
  for (let i = 0; i < length; i++) {
    // Skip predelay samples
    if (i < predelaySamples) {
      leftChannel[i] = 0
      rightChannel[i] = 0
      continue
    }

    const sampleIndex = i - predelaySamples
    const normalizedTime = sampleIndex / (length - predelaySamples)

    // Exponential decay envelope
    const envelope = Math.exp(-params.decay * normalizedTime)

    // High frequency damping (simple lowpass approximation)
    const hfDamping = 1 - params.highFreqDamping * normalizedTime

    // Density affects how much random variation
    const densityFactor = params.density + (1 - params.density) * (1 - normalizedTime)

    // Generate noise with density variation
    const noiseL = (Math.random() * 2 - 1) * densityFactor
    const noiseR = (Math.random() * 2 - 1) * densityFactor

    // Apply envelope and damping
    leftChannel[i] = noiseL * envelope * hfDamping
    rightChannel[i] = noiseR * envelope * hfDamping
  }

  // Apply simple smoothing for high frequency damping
  smoothBuffer(leftChannel, Math.floor(params.highFreqDamping * 10) + 1)
  smoothBuffer(rightChannel, Math.floor(params.highFreqDamping * 10) + 1)

  // Normalize
  normalizeBuffer(leftChannel)
  normalizeBuffer(rightChannel)

  return buffer
}

/**
 * Simple moving average smoothing
 */
function smoothBuffer(buffer: Float32Array, windowSize: number): void {
  if (windowSize <= 1) return

  const temp = new Float32Array(buffer.length)

  for (let i = 0; i < buffer.length; i++) {
    let sum = 0
    let count = 0

    for (let j = -windowSize; j <= windowSize; j++) {
      const idx = i + j
      if (idx >= 0 && idx < buffer.length) {
        sum += buffer[idx]
        count++
      }
    }

    temp[i] = sum / count
  }

  buffer.set(temp)
}

/**
 * Normalize buffer to prevent clipping
 */
function normalizeBuffer(buffer: Float32Array): void {
  let max = 0

  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(buffer[i])
    if (abs > max) max = abs
  }

  if (max > 0) {
    const scale = 0.8 / max // Scale to 80% to leave headroom
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] *= scale
    }
  }
}

/**
 * Cache for generated impulse responses
 */
const irCache = new Map<string, AudioBuffer>()

/**
 * Get or generate an impulse response (cached)
 */
export function getImpulseResponse(
  audioContext: AudioContext,
  preset: ReverbPreset = 'hall'
): AudioBuffer {
  const cacheKey = `${audioContext.sampleRate}_${preset}`

  if (irCache.has(cacheKey)) {
    return irCache.get(cacheKey)!
  }

  const buffer = generateImpulseResponse(audioContext, preset)
  irCache.set(cacheKey, buffer)

  return buffer
}

/**
 * Clear the impulse response cache
 */
export function clearIRCache(): void {
  irCache.clear()
}

/**
 * Get available reverb presets
 */
export function getReverbPresets(): ReverbPreset[] {
  return Object.keys(REVERB_PRESETS) as ReverbPreset[]
}
