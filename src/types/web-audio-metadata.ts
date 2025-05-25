import type { NodeMetadata } from './index'

export const webAudioMetadata: Record<string, NodeMetadata> = {
  AudioContext: {
    name: 'AudioContext',
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
