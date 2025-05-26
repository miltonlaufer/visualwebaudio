import type { NodeMetadata } from './index'

export const webAudioMetadata: Record<string, NodeMetadata> = {
  AudioContext: {
    name: 'AudioContext',
    description: 'The main audio processing context that manages all audio nodes and connections',
    category: 'context',
    inputs: [],
    outputs: [
      {
        name: 'output',
        type: 'audio',
      },
    ],
    properties: [],
    methods: [
      'createOscillator',
      'createGain',
      'createBiquadFilter',
      'createDelay',
      'createAnalyser',
      'resume',
      'suspend',
      'close',
    ],
    events: ['statechange'],
  },
  AudioBufferSourceNode: {
    name: 'AudioBufferSourceNode',
    description: 'A source node that plays back audio data from an AudioBuffer',
    category: 'source',
    inputs: [],
    outputs: [
      {
        name: 'output',
        type: 'audio',
      },
    ],
    properties: [],
    methods: ['connect', 'disconnect', 'start', 'stop'],
    events: ['ended'],
  },
  OscillatorNode: {
    name: 'OscillatorNode',
    description:
      'A source node that generates periodic waveforms (sine, square, sawtooth, triangle)',
    category: 'source',
    inputs: [],
    outputs: [
      {
        name: 'output',
        type: 'audio',
      },
    ],
    properties: [
      {
        name: 'frequency',
        type: 'AudioParam',
        defaultValue: 440,
      },
      {
        name: 'detune',
        type: 'AudioParam',
        defaultValue: 0,
      },
      {
        name: 'type',
        type: 'OscillatorType',
        defaultValue: 'sine',
      },
    ],
    methods: ['connect', 'disconnect', 'start', 'stop'],
    events: ['ended'],
  },
  GainNode: {
    name: 'GainNode',
    description: 'A node that controls the volume of audio signals',
    category: 'effect',
    inputs: [
      {
        name: 'input',
        type: 'audio',
      },
    ],
    outputs: [
      {
        name: 'output',
        type: 'audio',
      },
    ],
    properties: [
      {
        name: 'gain',
        type: 'AudioParam',
        defaultValue: 1,
      },
    ],
    methods: ['connect', 'disconnect'],
    events: [],
  },
  BiquadFilterNode: {
    name: 'BiquadFilterNode',
    description:
      'A node that implements various types of filters (lowpass, highpass, bandpass, etc.)',
    category: 'effect',
    inputs: [
      {
        name: 'input',
        type: 'audio',
      },
    ],
    outputs: [
      {
        name: 'output',
        type: 'audio',
      },
    ],
    properties: [
      {
        name: 'frequency',
        type: 'AudioParam',
        defaultValue: 350,
      },
      {
        name: 'Q',
        type: 'AudioParam',
        defaultValue: 1,
      },
      {
        name: 'gain',
        type: 'AudioParam',
        defaultValue: 0,
      },
      {
        name: 'type',
        type: 'BiquadFilterType',
        defaultValue: 'lowpass',
      },
    ],
    methods: ['connect', 'disconnect'],
    events: [],
  },
  DelayNode: {
    name: 'DelayNode',
    description: 'A node that delays the incoming audio signal by a specified amount of time',
    category: 'effect',
    inputs: [
      {
        name: 'input',
        type: 'audio',
      },
    ],
    outputs: [
      {
        name: 'output',
        type: 'audio',
      },
    ],
    properties: [
      {
        name: 'delayTime',
        type: 'AudioParam',
        defaultValue: 0,
      },
    ],
    methods: ['connect', 'disconnect'],
    events: [],
  },
  AnalyserNode: {
    name: 'AnalyserNode',
    description: 'A node that provides real-time frequency and time-domain analysis of audio data',
    category: 'analysis',
    inputs: [
      {
        name: 'input',
        type: 'audio',
      },
    ],
    outputs: [
      {
        name: 'output',
        type: 'audio',
      },
    ],
    properties: [],
    methods: ['connect', 'disconnect'],
    events: [],
  },
  AudioDestinationNode: {
    name: 'AudioDestinationNode',
    description: 'The final destination node that represents the audio output device',
    category: 'destination',
    inputs: [
      {
        name: 'input',
        type: 'audio',
      },
    ],
    outputs: [],
    properties: [],
    methods: ['connect', 'disconnect'],
    events: [],
  },
}
