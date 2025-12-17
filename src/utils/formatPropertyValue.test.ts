import { describe, it, expect } from 'vitest'
import { formatPropertyValue, shouldShowDecimals } from './formatPropertyValue'

describe('formatPropertyValue', () => {
  describe('frequency values', () => {
    it('should format frequency to 2 decimal places', () => {
      expect(formatPropertyValue(440, 'frequency')).toBe('440.00')
      expect(formatPropertyValue(440.123456, 'frequency')).toBe('440.12')
      expect(formatPropertyValue(110.5, 'frequency')).toBe('110.50')
    })

    it('should format properties containing "frequency" in name', () => {
      expect(formatPropertyValue(440, 'baseFrequency')).toBe('440.00')
      expect(formatPropertyValue(1000, 'cutoffFrequency')).toBe('1000.00')
    })
  })

  describe('gain values', () => {
    it('should format gain to 2 decimal places', () => {
      expect(formatPropertyValue(0.5, 'gain')).toBe('0.50')
      expect(formatPropertyValue(1, 'gain')).toBe('1.00')
      expect(formatPropertyValue(0.123456, 'gain')).toBe('0.12')
    })
  })

  describe('other decimal properties', () => {
    it('should format detune to 2 decimal places', () => {
      expect(formatPropertyValue(100, 'detune')).toBe('100.00')
      expect(formatPropertyValue(-50.5, 'detune')).toBe('-50.50')
    })

    it('should format Q to 2 decimal places', () => {
      expect(formatPropertyValue(1, 'Q')).toBe('1.00')
      expect(formatPropertyValue(10.123, 'Q')).toBe('10.12')
    })

    it('should format playbackRate to 2 decimal places', () => {
      expect(formatPropertyValue(1, 'playbackRate')).toBe('1.00')
      expect(formatPropertyValue(0.5, 'playbackRate')).toBe('0.50')
      expect(formatPropertyValue(2.25, 'playbackRate')).toBe('2.25')
    })
  })

  describe('integer values for non-decimal properties', () => {
    it('should show integers without decimals', () => {
      expect(formatPropertyValue(100, 'value')).toBe('100')
      expect(formatPropertyValue(0, 'count')).toBe('0')
      expect(formatPropertyValue(-5, 'offset')).toBe('-5')
    })

    it('should format non-integer numbers to 2 decimals', () => {
      expect(formatPropertyValue(100.5, 'value')).toBe('100.50')
      expect(formatPropertyValue(3.14159, 'someProperty')).toBe('3.14')
    })
  })

  describe('string values', () => {
    it('should return string values as-is', () => {
      expect(formatPropertyValue('sine', 'type')).toBe('sine')
      expect(formatPropertyValue('lowpass', 'type')).toBe('lowpass')
      expect(formatPropertyValue('custom text', 'label')).toBe('custom text')
    })
  })

  describe('null and undefined values', () => {
    it('should return empty string for null', () => {
      expect(formatPropertyValue(null, 'frequency')).toBe('')
    })

    it('should return empty string for undefined', () => {
      expect(formatPropertyValue(undefined, 'frequency')).toBe('')
    })
  })

  describe('boolean values', () => {
    it('should convert booleans to strings', () => {
      expect(formatPropertyValue(true, 'enabled')).toBe('true')
      expect(formatPropertyValue(false, 'loop')).toBe('false')
    })
  })

  describe('edge cases', () => {
    it('should handle zero correctly', () => {
      expect(formatPropertyValue(0, 'frequency')).toBe('0.00')
      expect(formatPropertyValue(0, 'value')).toBe('0')
    })

    it('should handle negative numbers', () => {
      expect(formatPropertyValue(-440, 'frequency')).toBe('-440.00')
      expect(formatPropertyValue(-100, 'value')).toBe('-100')
    })

    it('should handle very large numbers', () => {
      expect(formatPropertyValue(22050, 'frequency')).toBe('22050.00')
      expect(formatPropertyValue(1000000, 'value')).toBe('1000000')
    })

    it('should handle very small decimal numbers', () => {
      expect(formatPropertyValue(0.001, 'gain')).toBe('0.00')
      expect(formatPropertyValue(0.005, 'gain')).toBe('0.01') // rounds up
    })
  })
})

describe('shouldShowDecimals', () => {
  it('should return true for known decimal properties', () => {
    expect(shouldShowDecimals('frequency')).toBe(true)
    expect(shouldShowDecimals('gain')).toBe(true)
    expect(shouldShowDecimals('detune')).toBe(true)
    expect(shouldShowDecimals('Q')).toBe(true)
    expect(shouldShowDecimals('playbackRate')).toBe(true)
  })

  it('should return true for properties containing frequency', () => {
    expect(shouldShowDecimals('baseFrequency')).toBe(true)
    expect(shouldShowDecimals('cutoffFrequency')).toBe(true)
    expect(shouldShowDecimals('Frequency')).toBe(true) // case insensitive
  })

  it('should return false for other properties', () => {
    expect(shouldShowDecimals('value')).toBe(false)
    expect(shouldShowDecimals('type')).toBe(false)
    expect(shouldShowDecimals('count')).toBe(false)
  })
})
