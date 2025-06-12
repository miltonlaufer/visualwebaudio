import React, { useState, useRef, useEffect, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { useAudioGraphStore } from '~/stores/AudioGraphStore'
import type { Edge } from '@xyflow/react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useOnClickOutside } from 'usehooks-ts'

interface AudioNode {
  id: string
  nodeType: string
  properties: Map<string, unknown>
}

const ExportJSButton: React.FC = observer(() => {
  const store = useAudioGraphStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  const nodes = store.adaptedNodes
  const hasNodes = nodes.length > 0

  // Helper function to get nodeType from both old and new node structures
  const getNodeType = (node: any): string => {
    return node.nodeType || node.data?.nodeType || 'Unknown'
  }

  // Helper function to get properties from both old and new node structures
  const getNodeProperties = (node: any): Map<string, unknown> => {
    // Handle NodeAdapter with MST map properties
    if (node.properties && typeof node.properties.get === 'function') {
      // MST map - convert to regular Map for iteration
      const regularMap = new Map()
      try {
        // MST maps have entries() method that returns an iterator
        if (typeof node.properties.entries === 'function') {
          for (const [key, value] of node.properties.entries()) {
            regularMap.set(key, value)
          }
        } else {
          // Fallback: try to access keys if available
          if (node.properties.keys && typeof node.properties.keys === 'function') {
            for (const key of node.properties.keys()) {
              regularMap.set(key, node.properties.get(key))
            }
          }
        }
      } catch (error) {
        console.warn('Error accessing MST map properties:', error)
      }
      return regularMap
    }

    // Handle regular Map
    if (node.properties && node.properties instanceof Map) {
      return node.properties
    }

    // Handle nested data.properties
    if (node.data?.properties && node.data.properties instanceof Map) {
      return node.data.properties
    }
    if (node.data?.properties && typeof node.data.properties === 'object') {
      return new Map(Object.entries(node.data.properties))
    }

    // Handle plain object properties
    if (node.properties && typeof node.properties === 'object') {
      return new Map(Object.entries(node.properties))
    }

    return new Map()
  }

  // Handle click outside to close modal
  const handleClickOutside = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  useOnClickOutside(modalRef as React.RefObject<HTMLElement>, handleClickOutside)

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isModalOpen])

  // Remove useCallback from simple HTML element handlers
  const handleExport = () => {
    if (!hasNodes) return

    const nodes = store.adaptedNodes
    const edges = store.visualEdges

    const generatedCode = generateJavaScriptCode(nodes as any, edges)
    setCode(generatedCode)
    setIsModalOpen(true)
  }

  const handleCopy = async () => {
    if (!code) return

    // Create a temporary textarea element to copy the code
    const textarea = document.createElement('textarea')
    textarea.value = code
    document.body.appendChild(textarea)
    textarea.select()

    try {
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore copy errors
    }
    document.body.removeChild(textarea)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const sanitizeId = (id: string) => {
    // Remove any non-alphanumeric characters except underscore
    return id.replace(/[^a-zA-Z0-9_]/g, '_')
  }

  const generateCustomNodeClasses = (customNodes: AudioNode[]) => {
    const nodeTypes = [...new Set(customNodes.map(node => node.nodeType))]

    return nodeTypes
      .map(nodeType => {
        switch (nodeType) {
          case 'SliderNode':
            return `// Slider Node Implementation
class SliderNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    this.bridges = new Map(); // Store ConstantSourceNode bridges
    
    // Initialize default properties
    this.setProperty('value', 50);
    this.setProperty('min', 0);
    this.setProperty('max', 100);
    this.setProperty('step', 1);
    this.setProperty('label', 'Slider');
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
    if (name === 'value') {
      this.outputs.set('value', value);
      this.notifyConnections('value', value);
    }
  }
  
  connect(targetNode, outputName = 'value', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
    
    // If connecting to a Web Audio node, create a ConstantSourceNode bridge
    if (targetNode && typeof targetNode.connect === 'function' && !targetNode.receiveInput) {
      const bridgeKey = \`\${targetNode.constructor.name}_\${inputName}\`;
      if (!this.bridges.has(bridgeKey)) {
        const constantSource = this.audioContext.createConstantSource();
        constantSource.start();
        
        // Connect to the target parameter
        if (inputName === 'frequency' && targetNode.frequency) {
          constantSource.connect(targetNode.frequency);
        } else if (inputName === 'gain' && targetNode.gain) {
          constantSource.connect(targetNode.gain);
        } else if (inputName === 'Q' && targetNode.Q) {
          constantSource.connect(targetNode.Q);
        } else if (inputName === 'delayTime' && targetNode.delayTime) {
          constantSource.connect(targetNode.delayTime);
        }
        
        this.bridges.set(bridgeKey, constantSource);
      }
    }
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          // Custom node connection
          conn.target.receiveInput(conn.inputName, value);
        } else if (conn.target && typeof conn.target.connect === 'function') {
          // Web Audio node connection - update the bridge
          const bridgeKey = \`\${conn.target.constructor.name}_\${conn.inputName}\`;
          const bridge = this.bridges.get(bridgeKey);
          if (bridge && bridge.offset) {
            bridge.offset.value = value;
          }
        }
      });
  }
}`

          case 'ButtonNode':
            return `// Button Node Implementation
class ButtonNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    
    this.setProperty('label', 'Click Me');
    this.setProperty('outputValue', 1);
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  
  trigger() {
    const outputValue = this.properties.get('outputValue') || 1;
    this.outputs.set('trigger', outputValue);
    this.notifyConnections('trigger', outputValue);
  }
  
  connect(targetNode, outputName = 'trigger', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value);
        }
      });
  }
}`

          case 'MidiToFreqNode':
            return `// MIDI to Frequency Node Implementation
class MidiToFreqNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    this.bridges = new Map(); // Store ConstantSourceNode bridges
    
    this.setProperty('baseFreq', 440);
    this.setProperty('baseMidi', 69);
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  
  receiveInput(inputName, value) {
    if (inputName === 'midiNote') {
      const midiNote = Number(value) || 0;
      const frequency = this.midiToFrequency(midiNote);
      this.outputs.set('frequency', frequency);
      this.notifyConnections('frequency', frequency);
    }
  }
  
  midiToFrequency(midiNote) {
    const baseFreq = this.properties.get('baseFreq') || 440;
    const baseMidi = this.properties.get('baseMidi') || 69;
    return baseFreq * Math.pow(2, (midiNote - baseMidi) / 12);
  }
  
  connect(targetNode, outputName = 'frequency', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
    
    // If connecting to a Web Audio node, create a ConstantSourceNode bridge
    if (targetNode && typeof targetNode.connect === 'function' && targetNode.constructor.name !== 'MidiToFreqNode') {
      const bridgeKey = \`\${targetNode.constructor.name}_\${inputName}\`;
      if (!this.bridges.has(bridgeKey)) {
        const constantSource = this.audioContext.createConstantSource();
        constantSource.start();
        
        // Connect to the target parameter
        if (inputName === 'frequency' && targetNode.frequency) {
          constantSource.connect(targetNode.frequency);
        } else if (inputName === 'gain' && targetNode.gain) {
          constantSource.connect(targetNode.gain);
        } else if (inputName === 'Q' && targetNode.Q) {
          constantSource.connect(targetNode.Q);
        } else if (inputName === 'delayTime' && targetNode.delayTime) {
          constantSource.connect(targetNode.delayTime);
        }
        
        this.bridges.set(bridgeKey, constantSource);
      }
    }
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          // Custom node connection
          conn.target.receiveInput(conn.inputName, value);
        } else if (conn.target && typeof conn.target.connect === 'function') {
          // Web Audio node connection - update the bridge
          const bridgeKey = \`\${conn.target.constructor.name}_\${conn.inputName}\`;
          const bridge = this.bridges.get(bridgeKey);
          if (bridge && bridge.offset) {
            bridge.offset.value = value;
          }
        }
      });
  }
}`

          case 'ScaleToMidiNode':
            return `// Scale to MIDI Node Implementation
class ScaleToMidiNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    this.bridges = new Map(); // Store ConstantSourceNode bridges
    
    this.setProperty('scaleDegree', 0);
    this.setProperty('key', 'C');
    this.setProperty('mode', 'major');
    this.updateOutput();
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
    if (name === 'scaleDegree' || name === 'key' || name === 'mode') {
      this.updateOutput();
    }
  }
  
  receiveInput(inputName, value) {
    if (inputName === 'scaleDegree') {
      const scaleDegree = Number(value) || 0;
      this.setProperty('scaleDegree', scaleDegree);
    }
  }
  
  updateOutput() {
    const scaleDegree = this.properties.get('scaleDegree') || 0;
    const key = this.properties.get('key') || 'C';
    const mode = this.properties.get('mode') || 'major';
    
    const midiNote = this.scaleToMidi(scaleDegree, key, mode);
    const frequency = this.midiToFrequency(midiNote);
    
    this.properties.set('midiNote', midiNote);
    this.properties.set('frequency', frequency);
    this.outputs.set('midiNote', midiNote);
    this.outputs.set('frequency', frequency);
    
    this.notifyConnections('midiNote', midiNote);
    this.notifyConnections('frequency', frequency);
  }
  
  scaleToMidi(scaleDegree, key, mode) {
    const SCALE_INTERVALS = {
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
      melodic_minor: [0, 2, 3, 5, 7, 9, 11]
    };
    
    const KEY_TO_MIDI = {
      'C': 60, 'C#': 61, 'D': 62, 'D#': 63, 'E': 64, 'F': 65,
      'F#': 66, 'G': 67, 'G#': 68, 'A': 69, 'A#': 70, 'B': 71
    };
    
    const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.major;
    const rootMidi = KEY_TO_MIDI[key] || 60;
    
    const octaveOffset = Math.floor(scaleDegree / intervals.length);
    const normalizedDegree = ((scaleDegree % intervals.length) + intervals.length) % intervals.length;
    const interval = intervals[normalizedDegree];
    const midiNote = rootMidi + interval + (octaveOffset * 12);
    
    return Math.max(0, Math.min(127, midiNote));
  }
  
  midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }
  
  connect(targetNode, outputName = 'midiNote', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
    
    // If connecting to a Web Audio node, create a ConstantSourceNode bridge
    if (targetNode && typeof targetNode.connect === 'function' && targetNode.constructor.name !== 'ScaleToMidiNode') {
      const bridgeKey = \`\${targetNode.constructor.name}_\${inputName}\`;
      if (!this.bridges.has(bridgeKey)) {
        const constantSource = this.audioContext.createConstantSource();
        constantSource.start();
        
        // Connect to the target parameter
        if (inputName === 'frequency' && targetNode.frequency) {
          constantSource.connect(targetNode.frequency);
        } else if (inputName === 'gain' && targetNode.gain) {
          constantSource.connect(targetNode.gain);
        } else if (inputName === 'Q' && targetNode.Q) {
          constantSource.connect(targetNode.Q);
        } else if (inputName === 'delayTime' && targetNode.delayTime) {
          constantSource.connect(targetNode.delayTime);
        }
        
        this.bridges.set(bridgeKey, constantSource);
      }
    }
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          // Custom node connection
          conn.target.receiveInput(conn.inputName, value);
        } else if (conn.target && typeof conn.target.connect === 'function') {
          // Web Audio node connection - update the bridge
          const bridgeKey = \`\${conn.target.constructor.name}_\${conn.inputName}\`;
          const bridge = this.bridges.get(bridgeKey);
          if (bridge && bridge.offset) {
            bridge.offset.value = value;
          }
        }
      });
  }
}`

          case 'DisplayNode':
            return `// Display Node Implementation
class DisplayNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    
    this.setProperty('currentValue', 0);
    this.setProperty('label', 'Display');
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  
  receiveInput(inputName, value) {
    if (inputName === 'input') {
      const numValue = Number(value) || 0;
      this.setProperty('currentValue', numValue);
      this.outputs.set('output', numValue);
      this.notifyConnections('output', numValue);
    }
  }
  
  connect(targetNode, outputName = 'output', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value);
        }
      });
  }
}`

          case 'MidiInputNode':
            return `// MIDI Input Node Implementation
class MidiInputNode {
  constructor(id, audioContext, midiAccess) {
    this.id = id;
    this.audioContext = audioContext;
    this.midiAccess = midiAccess;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    
    this.setProperty('channel', 1);
    this.setProperty('deviceName', '');
    
    this.setupMidiListeners();
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
    if (name === 'channel') {
      this.setupMidiListeners();
    }
  }
  
  setupMidiListeners() {
    if (!this.midiAccess) return;
    
    const channel = this.properties.get('channel') || 1;
    
    this.midiAccess.inputs.forEach((input) => {
      input.onmidimessage = (event) => {
        if (!event.data || event.data.length < 2) return;
        
        const status = event.data[0];
        const data1 = event.data[1];
        const data2 = event.data.length > 2 ? event.data[2] : 0;
        const messageChannel = (status & 0x0f) + 1;
        
        if (messageChannel === channel) {
          const messageType = status & 0xf0;
          
          switch (messageType) {
            case 0x90: // Note on
              this.outputs.set('note', data1);
              this.outputs.set('velocity', data2);
              this.notifyConnections('note', data1);
              this.notifyConnections('velocity', data2);
              break;
              
            case 0x80: // Note off
              this.outputs.set('note', data1);
              this.outputs.set('velocity', 0);
              this.notifyConnections('note', data1);
              this.notifyConnections('velocity', 0);
              break;
              
            case 0xb0: // Control change
              this.outputs.set('cc', data2);
              this.notifyConnections('cc', data2);
              break;
              
            case 0xe0: // Pitch bend
              const pitchValue = (data2 << 7) | data1;
              this.outputs.set('pitch', pitchValue);
              this.notifyConnections('pitch', pitchValue);
              break;
          }
        }
      };
    });
  }
  
  connect(targetNode, outputName = 'note', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value);
        }
      });
  }
}`

          case 'SoundFileNode':
            return `// Sound File Node Implementation
class SoundFileNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    this.gainNode = audioContext.createGain();
    this.audioBuffer = null;
    
    this.setProperty('fileName', '');
    this.setProperty('duration', 0);
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  
  receiveInput(inputName, value) {
    if (inputName === 'trigger' && value > 0) {
      this.trigger();
    }
  }
  
  trigger() {
    if (!this.audioBuffer) {
      console.warn('No audio buffer loaded for SoundFileNode');
      return;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = this.audioBuffer;
    source.connect(this.gainNode);
    source.start();
  }
  
  getAudioOutput() {
    return this.gainNode;
  }
  
  connect(targetNode, outputName = 'output', inputName = 'input') {
    if (targetNode.receiveInput) {
      this.connections.push({ target: targetNode, outputName, inputName });
    } else {
      // Direct audio connection
      this.gainNode.connect(targetNode);
    }
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value);
        }
      });
  }
}`

          case 'GreaterThanNode':
            return `// Greater Than Node Implementation
class GreaterThanNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    this.inputs = { input1: 0, input2: 0 };
    
    this.setProperty('threshold', 0);
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  
  receiveInput(inputName, value) {
    if (inputName === 'input1' || inputName === 'input2') {
      this.inputs[inputName] = Number(value) || 0;
      this.compute();
    }
  }
  
  compute() {
    const result = this.inputs.input1 > this.inputs.input2 ? 1 : 0;
    this.outputs.set('result', result);
    this.notifyConnections('result', result);
  }
  
  connect(targetNode, outputName = 'result', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value);
        }
      });
  }
}`

          case 'EqualsNode':
            return `// Equals Node Implementation
class EqualsNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    this.inputs = { input1: 0, input2: 0 };
    
    this.setProperty('tolerance', 0.001);
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  
  receiveInput(inputName, value) {
    if (inputName === 'input1' || inputName === 'input2') {
      this.inputs[inputName] = Number(value) || 0;
      this.compute();
    }
  }
  
  compute() {
    const tolerance = this.properties.get('tolerance') || 0.001;
    const result = Math.abs(this.inputs.input1 - this.inputs.input2) <= tolerance ? 1 : 0;
    this.outputs.set('result', result);
    this.notifyConnections('result', result);
  }
  
  connect(targetNode, outputName = 'result', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value);
        }
      });
  }
}`

          case 'SelectNode':
            return `// Select Node Implementation
class SelectNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    this.inputs = { selector: 0, input: 0 };
    
    this.setProperty('numOutputs', 2);
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  
  receiveInput(inputName, value) {
    if (inputName === 'selector' || inputName === 'input') {
      this.inputs[inputName] = Number(value) || 0;
      this.compute();
    }
  }
  
  compute() {
    const selector = Math.floor(this.inputs.selector);
    const numOutputs = this.properties.get('numOutputs') || 2;
    const inputValue = this.inputs.input;
    
    // Clear all outputs
    for (let i = 0; i < numOutputs; i++) {
      this.outputs.set(\`output\${i}\`, 0);
    }
    
    // Set the selected output
    if (selector >= 0 && selector < numOutputs) {
      this.outputs.set(\`output\${selector}\`, inputValue);
      this.notifyConnections(\`output\${selector}\`, inputValue);
    }
  }
  
  connect(targetNode, outputName = 'output0', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value);
        }
      });
  }
}`

          case 'RandomNode':
            return `// Random Node Implementation
class RandomNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    
    this.setProperty('min', 0);
    this.setProperty('max', 1);
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  
  receiveInput(inputName, value) {
    if (inputName === 'trigger' && value > 0) {
      this.generate();
    }
  }
  
  generate() {
    const min = this.properties.get('min') || 0;
    const max = this.properties.get('max') || 1;
    const randomValue = Math.random() * (max - min) + min;
    this.outputs.set('value', randomValue);
    this.notifyConnections('value', randomValue);
  }
  
  connect(targetNode, outputName = 'value', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value);
        }
      });
  }
}`

          case 'TimerNode':
            return `// Timer Node Implementation
class TimerNode {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
    this.intervalId = null;
    
    this.setProperty('interval', 1000);
    this.setProperty('count', 0);
    this.setProperty('isRunning', false);
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  
  startTimer() {
    if (this.intervalId) return; // Already running
    
    this.setProperty('isRunning', true);
    const interval = this.properties.get('interval') || 1000;
    
    this.intervalId = setInterval(() => {
      const currentCount = this.properties.get('count') || 0;
      const newCount = currentCount + 1;
      this.setProperty('count', newCount);
      this.outputs.set('count', newCount);
      this.notifyConnections('count', newCount);
    }, interval);
  }
  
  stopTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.setProperty('isRunning', false);
  }
  
  resetTimer() {
    this.stopTimer();
    this.setProperty('count', 0);
    this.outputs.set('count', 0);
    this.notifyConnections('count', 0);
  }
  
  connect(targetNode, outputName = 'count', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value);
        }
      });
  }
}`

          default:
            return `// ${nodeType} - Basic Implementation
class ${nodeType} {
  constructor(id, audioContext) {
    this.id = id;
    this.audioContext = audioContext;
    this.properties = new Map();
    this.outputs = new Map();
    this.connections = [];
  }
  
  setProperty(name, value) {
    this.properties.set(name, value);
  }
  
  connect(targetNode, outputName = 'output', inputName = 'input') {
    this.connections.push({ target: targetNode, outputName, inputName });
  }
  
  notifyConnections(outputName, value) {
    this.connections
      .filter(conn => conn.outputName === outputName)
      .forEach(conn => {
        if (conn.target.receiveInput) {
          conn.target.receiveInput(conn.inputName, value);
        }
      });
  }
}`
        }
      })
      .join('\n\n')
  }

  const generateConnections = (edges: Edge[], nodes: AudioNode[], idMap: Map<string, string>) => {
    const customNodeTypes = [
      'SliderNode',
      'ButtonNode',
      'GreaterThanNode',
      'EqualsNode',
      'SelectNode',
      'MidiInputNode',
      'MidiToFreqNode',
      'DisplayNode',
      'SoundFileNode',
      'RandomNode',
      'TimerNode',
      'ScaleToMidiNode',
    ]

    return edges
      .map(edge => {
        const sourceId = idMap.get(edge.source)
        const targetId = idMap.get(edge.target)
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)

        if (!sourceNode || !targetNode) return ''

        const isSourceCustom = customNodeTypes.includes(getNodeType(sourceNode))
        const isTargetCustom = customNodeTypes.includes(getNodeType(targetNode))

        const sourceHandle = edge.sourceHandle || 'output'
        const targetHandle = edge.targetHandle || 'input'

        if (isSourceCustom && isTargetCustom) {
          // Custom to Custom connection
          return `${sourceId}.connect(${targetId}, '${sourceHandle}', '${targetHandle}');`
        } else if (isSourceCustom && !isTargetCustom) {
          // Custom to Web Audio connection
          if (getNodeType(sourceNode) === 'SoundFileNode') {
            // SoundFileNode has audio output
            return `${sourceId}.connect(${targetId});`
          } else {
            // Control connection - create bridge
            return `${sourceId}.connect(${targetId}, '${sourceHandle}', '${targetHandle}');`
          }
        } else if (!isSourceCustom && isTargetCustom) {
          // Web Audio to Custom connection - this should work now with ScaleToMidiNode included
          return `// Connect ${getNodeType(sourceNode)} output to ${getNodeType(targetNode)} input
${sourceId}.connect(${targetId}, '${sourceHandle}', '${targetHandle}');`
        } else {
          // Web Audio to Web Audio connection
          if (targetHandle !== 'input') {
            // Connection to AudioParam
            return `${sourceId}.connect(${targetId}.${targetHandle});`
          } else {
            // Normal audio connection
            return `${sourceId}.connect(${targetId});`
          }
        }
      })
      .filter(Boolean)
      .join('\n')
  }

  const generateUIControls = (
    customNodes: AudioNode[],
    idMap: Map<string, string>,
    allNodes: AudioNode[],
    edges: Edge[]
  ) => {
    const interactiveNodes = customNodes.filter(node =>
      ['SliderNode', 'ButtonNode', 'RandomNode', 'TimerNode'].includes(node.nodeType)
    )

    const hasOscillators = allNodes.some(node => node.nodeType === 'OscillatorNode')

    // Always generate UI controls to include the play button
    return `// Create UI controls for interactive nodes
function createAudioControls() {
  // Create main controls container
  const controlsContainer = document.createElement('div');
  controlsContainer.id = 'audio-controls';
  controlsContainer.style.cssText = \`
    padding: 20px;
    background: #f5f5f5;
    border-radius: 8px;
    margin: 20px 0;
    font-family: Arial, sans-serif;
  \`;

  // Create title
  const title = document.createElement('h3');
  title.textContent = 'Audio Controls';
  title.style.cssText = 'margin: 0 0 15px 0; color: #333;';
  controlsContainer.appendChild(title);

  // Create controls wrapper
  const controlsWrapper = document.createElement('div');
  controlsWrapper.style.cssText = 'display: flex; flex-wrap: wrap; gap: 20px;';
  controlsContainer.appendChild(controlsWrapper);

${interactiveNodes
  .map(node => {
    const nodeId = idMap.get(node.id)
    const nodeType = node.nodeType
    const properties = getNodeProperties(node)

    switch (nodeType) {
      case 'SliderNode': {
        const min = Array.from(properties.entries()).find(([key]) => key === 'min')?.[1] || 0
        const max = Array.from(properties.entries()).find(([key]) => key === 'max')?.[1] || 100
        const step = Array.from(properties.entries()).find(([key]) => key === 'step')?.[1] || 1
        const value = Array.from(properties.entries()).find(([key]) => key === 'value')?.[1] || 50
        const label =
          Array.from(properties.entries()).find(([key]) => key === 'label')?.[1] || 'Slider'

        // Find what this slider is connected to
        const sliderConnections = edges.filter((edge: any) => edge.source === node.id)

        return `
  // Create ${label} slider control
  const ${nodeId}Container = document.createElement('div');
  ${nodeId}Container.style.cssText = 'display: flex; flex-direction: column; gap: 8px; min-width: 200px;';
  
  const ${nodeId}Label = document.createElement('label');
  ${nodeId}Label.textContent = '${label}';
  ${nodeId}Label.style.cssText = 'font-weight: bold; color: #333;';
  
  const ${nodeId}Slider = document.createElement('input');
  ${nodeId}Slider.type = 'range';
  ${nodeId}Slider.id = '${nodeId}-slider';
  ${nodeId}Slider.min = '${min}';
  ${nodeId}Slider.max = '${max}';
  ${nodeId}Slider.step = '${step}';
  ${nodeId}Slider.value = '${value}';
  ${nodeId}Slider.style.cssText = 'width: 100%;';
  
  const ${nodeId}Value = document.createElement('span');
  ${nodeId}Value.id = '${nodeId}-value';
  ${nodeId}Value.textContent = '${value}';
  ${nodeId}Value.style.cssText = 'text-align: center; font-family: monospace; background: #fff; padding: 4px; border-radius: 4px;';
  
  ${nodeId}Container.appendChild(${nodeId}Label);
  ${nodeId}Container.appendChild(${nodeId}Slider);
  ${nodeId}Container.appendChild(${nodeId}Value);
  controlsWrapper.appendChild(${nodeId}Container);
  
  // Add event listener for slider
  ${nodeId}Slider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    ${nodeId}Value.textContent = value;
    ${nodeId}.setProperty('value', value);
    
    // Update connected audio parameters
    ${sliderConnections
      .map((conn: any) => {
        const targetNode = allNodes.find(n => n.id === conn.target)
        const targetNodeId = idMap.get(conn.target)
        const targetHandle = conn.targetHandle

        if (targetNode && targetNodeId && getNodeType(targetNode) !== 'SliderNode') {
          // Check if it's a custom node that needs receiveInput
          if (
            [
              'MidiToFreqNode',
              'GreaterThanNode',
              'EqualsNode',
              'SelectNode',
              'ScaleToMidiNode',
            ].includes(getNodeType(targetNode))
          ) {
            return `${targetNodeId}.receiveInput('${targetHandle}', value);`
          }
          // Check if it's an AudioParam (frequency, gain, etc.)
          else if (['frequency', 'detune', 'gain', 'delayTime', 'Q'].includes(targetHandle)) {
            return `${targetNodeId}.${targetHandle}.value = value;`
          } else {
            return `${targetNodeId}.${targetHandle} = value;`
          }
        }
        return ''
      })
      .filter(Boolean)
      .join('\n    ')}
  });`
      }

      case 'ButtonNode': {
        const buttonLabel =
          Array.from(properties.entries()).find(([key]) => key === 'label')?.[1] || 'Click Me'

        return `
  // Create ${buttonLabel} button control
  const ${nodeId}Container = document.createElement('div');
  ${nodeId}Container.style.cssText = 'display: flex; flex-direction: column; gap: 8px; align-items: center;';
  
  const ${nodeId}Button = document.createElement('button');
  ${nodeId}Button.id = '${nodeId}-button';
  ${nodeId}Button.textContent = '${buttonLabel}';
  ${nodeId}Button.style.cssText = 'padding: 12px 24px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;';
  
  ${nodeId}Container.appendChild(${nodeId}Button);
  controlsWrapper.appendChild(${nodeId}Container);
  
  // Add event listener for button
  ${nodeId}Button.addEventListener('click', () => {
    ${nodeId}.trigger();
  });`
      }

      case 'RandomNode': {
        return `
  // Create Random Generator control
  const ${nodeId}Container = document.createElement('div');
  ${nodeId}Container.style.cssText = 'display: flex; flex-direction: column; gap: 8px; min-width: 200px;';
  
  const ${nodeId}Label = document.createElement('label');
  ${nodeId}Label.textContent = 'Random Generator';
  ${nodeId}Label.style.cssText = 'font-weight: bold; color: #333;';
  
  const ${nodeId}Controls = document.createElement('div');
  ${nodeId}Controls.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  
  const ${nodeId}Generate = document.createElement('button');
  ${nodeId}Generate.id = '${nodeId}-generate';
  ${nodeId}Generate.textContent = 'Generate';
  ${nodeId}Generate.style.cssText = 'padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;';
  
  const ${nodeId}Display = document.createElement('span');
  ${nodeId}Display.id = '${nodeId}-display';
  ${nodeId}Display.textContent = '0';
  ${nodeId}Display.style.cssText = 'font-family: monospace; background: #fff; padding: 4px 8px; border-radius: 4px; min-width: 60px; text-align: center;';
  
  ${nodeId}Controls.appendChild(${nodeId}Generate);
  ${nodeId}Controls.appendChild(${nodeId}Display);
  ${nodeId}Container.appendChild(${nodeId}Label);
  ${nodeId}Container.appendChild(${nodeId}Controls);
  controlsWrapper.appendChild(${nodeId}Container);
  
  // Add event listeners for random generator
  ${nodeId}Generate.addEventListener('click', () => {
    ${nodeId}.generate();
    const value = ${nodeId}.outputs.get('value');
    ${nodeId}Display.textContent = value.toFixed(3);
  });`
      }

      case 'TimerNode': {
        return `
  // Create Timer control
  const ${nodeId}Container = document.createElement('div');
  ${nodeId}Container.style.cssText = 'display: flex; flex-direction: column; gap: 8px; min-width: 200px;';
  
  const ${nodeId}Label = document.createElement('label');
  ${nodeId}Label.textContent = 'Timer';
  ${nodeId}Label.style.cssText = 'font-weight: bold; color: #333;';
  
  const ${nodeId}Controls = document.createElement('div');
  ${nodeId}Controls.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  
  const ${nodeId}Start = document.createElement('button');
  ${nodeId}Start.id = '${nodeId}-start';
  ${nodeId}Start.textContent = 'Start';
  ${nodeId}Start.style.cssText = 'padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;';
  
  const ${nodeId}Stop = document.createElement('button');
  ${nodeId}Stop.id = '${nodeId}-stop';
  ${nodeId}Stop.textContent = 'Stop';
  ${nodeId}Stop.style.cssText = 'padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;';
  
  const ${nodeId}Display = document.createElement('span');
  ${nodeId}Display.id = '${nodeId}-display';
  ${nodeId}Display.textContent = 'Stopped';
  ${nodeId}Display.style.cssText = 'font-family: monospace; background: #fff; padding: 4px 8px; border-radius: 4px; min-width: 80px; text-align: center;';
  
  ${nodeId}Controls.appendChild(${nodeId}Start);
  ${nodeId}Controls.appendChild(${nodeId}Stop);
  ${nodeId}Controls.appendChild(${nodeId}Display);
  ${nodeId}Container.appendChild(${nodeId}Label);
  ${nodeId}Container.appendChild(${nodeId}Controls);
  controlsWrapper.appendChild(${nodeId}Container);
  
  // Add event listeners for timer
  ${nodeId}Start.addEventListener('click', () => {
    ${nodeId}.startTimer();
    ${nodeId}Display.textContent = 'Running';
  });
  
  ${nodeId}Stop.addEventListener('click', () => {
    ${nodeId}.stopTimer();
    ${nodeId}Display.textContent = 'Stopped';
  });`
      }

      default:
        return ''
    }
  })
  .join('')}
  
  // Add Start Audio button (always present)
  const startAudioContainer = document.createElement('div');
  startAudioContainer.style.cssText = 'display: flex; justify-content: center; margin-bottom: 15px;';
  
  const startAudioButton = document.createElement('button');
  startAudioButton.id = 'start-audio-button';
  startAudioButton.textContent = '▶️ Start Audio';
  startAudioButton.style.cssText = 'padding: 15px 30px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
  
  let isAudioActive = false;
  
  startAudioButton.addEventListener('click', async () => {
    try {
      if (!isAudioActive) {
        // Start audio
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        
        // Start any oscillators or other nodes that need to be started
        ${
          hasOscillators
            ? allNodes
                .filter(node => node.nodeType === 'OscillatorNode')
                .map(node => {
                  const nodeId = idMap.get(node.id)
                  return `if (${nodeId} && typeof ${nodeId}.start === 'function' && !${nodeId}._started) {
          ${nodeId}.start();
          ${nodeId}._started = true;
        }`
                })
                .join('\n        ')
            : '// No oscillators to start'
        }
        
        startAudioButton.textContent = '⏹️ Stop Audio';
        startAudioButton.style.background = '#ef4444';
        isAudioActive = true;
      } else {
        // Stop audio
        await audioContext.suspend();
        startAudioButton.textContent = '▶️ Start Audio';
        startAudioButton.style.background = '#10b981';
        isAudioActive = false;
      }
    } catch (error) {
      console.error('Failed to toggle audio:', error);
      startAudioButton.textContent = '❌ Audio Failed';
      startAudioButton.style.background = '#6b7280';
    }
  });
  
  startAudioContainer.appendChild(startAudioButton);
  controlsContainer.insertBefore(startAudioContainer, controlsWrapper);

  // Add controls to the page
  document.body.insertBefore(controlsContainer, document.body.firstChild);
}`
  }

  const generateJavaScriptCode = (nodes: AudioNode[], edges: Edge[]) => {
    // Create a mapping of original IDs to sanitized IDs
    const idMap = new Map(nodes.map(node => [node.id, sanitizeId(node.id)]))

    // Separate custom nodes from Web Audio nodes
    const customNodeTypes = [
      'SliderNode',
      'ButtonNode',
      'GreaterThanNode',
      'EqualsNode',
      'SelectNode',
      'MidiInputNode',
      'MidiToFreqNode',
      'DisplayNode',
      'SoundFileNode',
      'RandomNode',
      'TimerNode',
      'ScaleToMidiNode',
    ]

    const webAudioNodes = nodes.filter(node => !customNodeTypes.includes(getNodeType(node)))
    const customNodes = nodes.filter(node => customNodeTypes.includes(getNodeType(node)))

    // Check if there are any MediaStreamAudioSourceNode nodes or MIDI nodes
    const hasMicrophoneInput = nodes.some(
      node => getNodeType(node) === 'MediaStreamAudioSourceNode'
    )
    const hasMidiInput = nodes.some(node => getNodeType(node) === 'MidiInputNode')

    // Generate custom node class definitions
    const customNodeClasses = generateCustomNodeClasses(customNodes)

    const code = `// Generated Audio Graph Code
${customNodeClasses.length > 0 ? `${customNodeClasses}\n` : ''}${
      hasMicrophoneInput
        ? `
// Note: This code includes microphone input. To use it:
// 1. Request microphone permission using getUserMedia
// 2. Wrap the code in an async function

// Create AudioContext globally so UI controls can access it
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

async function createAudioGraph() {
  // Request microphone access
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
`
        : hasMidiInput
          ? `
// Note: This code includes MIDI input. To use it:
// 1. Request MIDI access using requestMIDIAccess
// 2. Wrap the code in an async function

// Create AudioContext globally so UI controls can access it
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

async function createAudioGraph() {
  // Request MIDI access
  const midiAccess = await navigator.requestMIDIAccess();
`
          : `
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
`
    }

// Create Web Audio nodes
${webAudioNodes
  .map(node => {
    const nodeId = idMap.get(node.id)
    const nodeType = getNodeType(node)

    // Handle special cases that don't follow the pattern
    if (nodeType === 'AudioDestinationNode') {
      return `const ${nodeId} = audioContext.destination;`
    }

    if (nodeType === 'MicrophoneInput' || nodeType === 'MediaStreamAudioSourceNode') {
      return `const ${nodeId} = audioContext.createMediaStreamSource(stream);`
    }

    if (nodeType === 'DelayNode') {
      return `const ${nodeId} = audioContext.createDelay(1.0);`
    }

    // For all other nodes, just remove 'Node' suffix to get the method name
    const methodName = nodeType.replace('Node', '')
    return `const ${nodeId} = audioContext.create${methodName}();`
  })
  .join('\n')}

// Create custom nodes
${customNodes
  .map(node => {
    const nodeId = idMap.get(node.id)
    const nodeType = getNodeType(node)

    if (nodeType === 'MidiInputNode') {
      return `const ${nodeId} = new MidiInputNode('${nodeId}', audioContext, midiAccess);`
    } else if (nodeType === 'SoundFileNode') {
      return `const ${nodeId} = new SoundFileNode('${nodeId}', audioContext);`
    } else {
      return `const ${nodeId} = new ${nodeType}('${nodeId}', audioContext);`
    }
  })
  .join('\n')}

// Set Web Audio node properties
${webAudioNodes
  .map(node => {
    const properties = getNodeProperties(node)
    const nodeId = idMap.get(node.id)
    const nodeType = getNodeType(node)

    // Filter properties to only include actual audio properties, not MobX internals
    const audioProperties = properties
      ? Array.from(properties.entries())
          .filter(([key]) => {
            // Filter out MobX internal properties
            if (key.startsWith('_') || key.endsWith('_')) return false
            if (
              [
                'enhancer_',
                'name_',
                'data_',
                'hasMap_',
                'keysAtom_',
                'interceptors_',
                'changeListeners_',
                'dehancer',
              ].includes(key)
            )
              return false
            // Only include known audio properties
            const validAudioProperties = [
              'frequency',
              'detune',
              'gain',
              'delayTime',
              'Q',
              'type',
              'threshold',
              'knee',
              'ratio',
              'attack',
              'release',
              'pan',
              'offset',
              'loop',
              'loopStart',
              'loopEnd',
              'playbackRate',
              'autostart',
            ]
            return validAudioProperties.includes(key)
          })
          .filter(([, value]) => value !== null && value !== undefined) // Filter out null/undefined values
      : []

    // Skip nodes with no meaningful properties to export
    if (audioProperties.length === 0) {
      return ''
    }

    // Set all properties after creation
    const paramSetters = audioProperties
      .map(([key, value]) => {
        // Handle different property types
        if (key === 'type' && (nodeType === 'OscillatorNode' || nodeType === 'BiquadFilterNode')) {
          return `${nodeId}.${key} = '${value}';`
        }
        // AudioParam properties (frequency, gain, delayTime, etc.)
        if (
          [
            'frequency',
            'detune',
            'gain',
            'delayTime',
            'Q',
            'threshold',
            'knee',
            'ratio',
            'attack',
            'release',
            'pan',
            'offset',
          ].includes(key)
        ) {
          return `${nodeId}.${key}.value = ${value};`
        }
        // Boolean properties
        if (key === 'loop' || key === 'autostart') {
          return `${nodeId}.${key} = ${value};`
        }
        // Other properties
        return `${nodeId}.${key} = ${JSON.stringify(value)};`
      })
      .join('\n')

    return paramSetters
  })
  .filter(Boolean)
  .join('\n')}

// Set custom node properties
${customNodes
  .map(node => {
    const properties = getNodeProperties(node)
    const nodeId = idMap.get(node.id)

    // Filter properties to only include meaningful custom node properties
    const customProperties = Array.from(properties.entries())
      .filter(([key]) => {
        // Filter out MobX internal properties
        if (key.startsWith('_') || key.endsWith('_')) return false
        if (
          [
            'enhancer_',
            'name_',
            'data_',
            'hasMap_',
            'keysAtom_',
            'interceptors_',
            'changeListeners_',
            'dehancer',
          ].includes(key)
        )
          return false
        // Include common custom node properties
        const validCustomProperties = [
          'value',
          'min',
          'max',
          'step',
          'label',
          'scaleDegree',
          'key',
          'mode',
          'baseFreq',
          'baseMidi',
          'currentValue',
          'channel',
          'deviceName',
          'fileName',
          'duration',
          'interval',
          'count',
          'midiNote',
          'frequency',
        ]
        return validCustomProperties.includes(key)
      })
      .filter(([, value]) => value !== null && value !== undefined) // Filter out null/undefined values

    const paramSetters = customProperties
      .map(([key, value]) => {
        return `${nodeId}.setProperty('${key}', ${JSON.stringify(value)});`
      })
      .join('\n')

    return paramSetters
  })
  .filter(Boolean)
  .join('\n')}

// Connect nodes
${generateConnections(edges, nodes, idMap)}

// Note: Oscillators will be started by the "Start Audio" button
// This is required by browser autoplay policies
${
  hasMicrophoneInput || hasMidiInput
    ? `}

// Call the function to create the audio graph
createAudioGraph().catch(console.error);`
    : ''
}

// Create UI controls for interactive nodes
${generateUIControls(customNodes, idMap, nodes, edges)}

// Initialize UI controls when page loads
document.addEventListener('DOMContentLoaded', () => {
  createAudioControls();
});

// Note: AudioContext will be started when user clicks "Start Audio" button
// This is required by browser autoplay policies
`
    return code
  }

  return (
    <>
      <button
        onClick={handleExport}
        disabled={!hasNodes}
        className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
          hasNodes
            ? 'hover:bg-[#999] dark:hover:bg-[#999] cursor-pointer'
            : 'cursor-not-allowed opacity-50'
        }`}
        title={hasNodes ? 'Export as JavaScript' : 'Please add nodes to export JS'}
        type="button"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-yellow-500" fill="currentColor">
          <path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z" />
        </svg>
      </button>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div
            ref={modalRef}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full p-6 relative"
          >
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              onClick={handleCloseModal}
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
              Exported JavaScript Code
            </h2>
            <div className="flex items-center mb-2">
              <button
                onClick={handleCopy}
                className="flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors mr-2"
                type="button"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] select-text">
              <SyntaxHighlighter language="javascript" style={oneDark} wrapLongLines>
                {code}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

export default ExportJSButton
