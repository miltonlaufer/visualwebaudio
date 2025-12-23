/**
 * Impulse Response Loader Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  IMPULSE_RESPONSE_PRESETS,
  getImpulseResponsePreset,
  getAvailableImpulseResponseIds,
  clearIRCache,
  generateFallbackImpulseResponse,
  isImpulseResponseCached,
} from '~/utils/impulseResponseLoader'

/******************* MOCK AUDIO CONTEXT ***********************/

const createMockAudioContext = () => ({
  sampleRate: 44100,
  createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: vi.fn((_channel: number) => new Float32Array(length)),
  })),
  decodeAudioData: vi.fn(async (_arrayBuffer: ArrayBuffer) => ({
    numberOfChannels: 2,
    length: 44100 * 2,
    sampleRate: 44100,
    duration: 2,
    getChannelData: vi.fn(() => new Float32Array(44100 * 2)),
  })),
})

describe('Impulse Response Loader', () => {
  let mockAudioContext: ReturnType<typeof createMockAudioContext>

  beforeEach(() => {
    mockAudioContext = createMockAudioContext()
    clearIRCache()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /******************* PRESET CONFIGURATION TESTS ***********************/

  describe('Preset Configuration', () => {
    it('should have multiple impulse response presets', () => {
      expect(IMPULSE_RESPONSE_PRESETS.length).toBeGreaterThan(0)
    })

    it('should have required fields for each preset', () => {
      for (const preset of IMPULSE_RESPONSE_PRESETS) {
        expect(preset.id).toBeDefined()
        expect(preset.name).toBeDefined()
        expect(preset.description).toBeDefined()
        expect(preset.url).toBeDefined()
        expect(preset.duration).toBeGreaterThan(0)
        expect(preset.category).toBeDefined()
      }
    })

    it('should have expected preset IDs from auralizr', () => {
      const ids = getAvailableImpulseResponseIds()

      // These are from the auralizr repository (OpenAir library)
      expect(ids).toContain('mausoleum')
      expect(ids).toContain('chapel')
      expect(ids).toContain('stairwell')
      expect(ids).toContain('basement')
    })

    it('should have valid URLs pointing to local audio files', () => {
      for (const preset of IMPULSE_RESPONSE_PRESETS) {
        expect(preset.url).toMatch(/^\/audio\/impulse-responses\//)
        expect(preset.url).toMatch(/\.wav$/)
      }
    })
  })

  /******************* PRESET LOOKUP TESTS ***********************/

  describe('Preset Lookup', () => {
    it('should get preset by ID', () => {
      const chapel = getImpulseResponsePreset('chapel')

      expect(chapel).toBeDefined()
      expect(chapel?.id).toBe('chapel')
      expect(chapel?.name).toBe('Spokane Chapel')
    })

    it('should return undefined for unknown preset', () => {
      const unknown = getImpulseResponsePreset('nonexistent')

      expect(unknown).toBeUndefined()
    })

    it('should return all available preset IDs', () => {
      const ids = getAvailableImpulseResponseIds()

      expect(Array.isArray(ids)).toBe(true)
      expect(ids.length).toBe(IMPULSE_RESPONSE_PRESETS.length)
    })
  })

  /******************* FALLBACK GENERATOR TESTS ***********************/

  describe('Fallback Generator', () => {
    it('should generate a stereo buffer', () => {
      const buffer = generateFallbackImpulseResponse(
        mockAudioContext as unknown as AudioContext,
        2.0
      )

      expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(
        2, // stereo
        expect.any(Number),
        44100
      )
      expect(buffer.numberOfChannels).toBe(2)
    })

    it('should generate buffer with correct duration', () => {
      const duration = 3.0
      generateFallbackImpulseResponse(mockAudioContext as unknown as AudioContext, duration)

      const expectedLength = Math.floor(44100 * duration)
      expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(2, expectedLength, 44100)
    })

    it('should default to 2 second duration', () => {
      generateFallbackImpulseResponse(mockAudioContext as unknown as AudioContext)

      const expectedLength = Math.floor(44100 * 2.0)
      expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(2, expectedLength, 44100)
    })
  })

  /******************* CACHE TESTS ***********************/

  describe('Cache Management', () => {
    it('should report uncached presets correctly', () => {
      const isCached = isImpulseResponseCached(
        mockAudioContext as unknown as AudioContext,
        'chapel'
      )

      expect(isCached).toBe(false)
    })

    it('should clear cache properly', () => {
      // Clear cache should not throw
      expect(() => clearIRCache()).not.toThrow()
    })
  })

  /******************* PRESET CATEGORIES ***********************/

  describe('Preset Categories', () => {
    it('should have valid categories', () => {
      const validCategories = ['hall', 'room', 'plate', 'chamber', 'outdoor']

      for (const preset of IMPULSE_RESPONSE_PRESETS) {
        expect(validCategories).toContain(preset.category)
      }
    })

    it('mausoleum should be categorized as hall', () => {
      const mausoleum = getImpulseResponsePreset('mausoleum')
      expect(mausoleum?.category).toBe('hall')
    })

    it('basement should be categorized as room', () => {
      const basement = getImpulseResponsePreset('basement')
      expect(basement?.category).toBe('room')
    })
  })

  /******************* PRESET DESCRIPTIONS ***********************/

  describe('Preset Descriptions', () => {
    it('mausoleum should describe long reverb', () => {
      const mausoleum = getImpulseResponsePreset('mausoleum')
      // Mausoleum is famous for extremely long reverb
      expect(mausoleum?.description).toMatch(/long/i)
      expect(mausoleum?.description).toMatch(/reverb/i)
    })

    it('chapel should have meaningful description', () => {
      const chapel = getImpulseResponsePreset('chapel')
      expect(chapel?.description.length).toBeGreaterThan(20)
      expect(chapel?.description).toMatch(/reverb|chapel|vocal|acoustic/i)
    })

    it('presets should have descriptive text', () => {
      for (const preset of IMPULSE_RESPONSE_PRESETS) {
        expect(preset.description.length).toBeGreaterThan(20)
      }
    })
  })
})
