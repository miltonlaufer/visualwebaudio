import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock ResizeObserver
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver
;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
  class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  }

// Mock Web Audio API
const createMockAudioNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  frequency: { value: 440 },
  gain: { value: 1 },
  start: vi.fn(),
  stop: vi.fn(),
})

// Mock global AudioContext
Object.defineProperty(global, 'AudioContext', {
  writable: true,
  value: vi.fn(() => ({
    createOscillator: vi.fn(() => createMockAudioNode()),
    createGain: vi.fn(() => createMockAudioNode()),
    createAnalyser: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      fftSize: 1024,
      smoothingTimeConstant: 0.8,
    })),
    createConstantSource: vi.fn(() => ({
      ...createMockAudioNode(),
      offset: { value: 0 },
      start: vi.fn(),
    })),
    destination: createMockAudioNode(),
    state: 'running',
    close: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
    resume: vi.fn(() => Promise.resolve()),
  })),
})
