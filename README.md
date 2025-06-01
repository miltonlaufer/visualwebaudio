# Visual Web Audio (alpha)

[![CI](https://github.com/miltonlaufer/visualwebaudio/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/miltonlaufer/visualwebaudio/actions/workflows/pr-checks.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3-646CFF?logo=vite)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-238%2F238%20passing-brightgreen)](https://github.com/miltonlaufer/visualwebaudio)
[![Coverage](https://img.shields.io/badge/Coverage-60.4%25-yellow)](https://github.com/miltonlaufer/visualwebaudio)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Table of Contents

- [Live Demo](#live-demo)
- [Overview](#overview)
- [Graphical Programming Interface: Exportable to JavaScript Code](#graphical-programming-interface-exportable-to-javascript-code)
- [Key Features](#key-features)
- [PWA Support](#pwa-support)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Examples](#examples)
- [Contributing](#contributing)



https://github.com/user-attachments/assets/919c4a86-6ff8-468a-a6d2-2eaa60518154

## Live Demo

🌐 **[Try Visual Web Audio Online](https://www.miltonlaufer.com.ar/visualwebaudio/)** - Experience the application in your browser!

## Overview

A **type-driven React TypeScript application** for visual Web Audio API editing that bridges visual audio engineering with code generation. This project demonstrates innovative type-driven development by extracting all node information directly from TypeScript's Web Audio API definitions.

### Core Innovation: Type-Driven Development

Unlike traditional audio editors that hardcode node definitions, this project:
- Extracts metadata directly from TypeScript's Web Audio API definitions (`@types/web`)
- Automatically discovers new nodes and properties when TypeScript definitions are updated
- Ensures type safety throughout the entire application
- Stays current with Web Audio API evolution without manual updates

## Graphical Programming Interface: Exportable to JavaScript Code

Visual Web Audio offers a unique **Graphical Programming Interface** that transforms visual audio graphs into executable JavaScript code:
- **Visual Design**: Create complex audio graphs using drag-and-drop interface
- **Real-time Validation**: Visual feedback ensures valid connections and properties
- **Code Generation**: Export visual graphs as clean, executable JavaScript code
- **Copy-to-Clipboard**: One-click copying with syntax highlighting

## Key Features

- **Visual Audio Graph Editor**: Drag-and-drop node creation with type validation and color-coded connections
- **Metadata-Driven Architecture**: 18+ Web Audio API nodes automatically discovered from TypeScript definitions
- **Custom Nodes System**: 10+ interactive custom nodes including buttons, sliders, MIDI input, and sound file players with pause/resume persistence
- **Voice Effects Processing**: Real-time microphone input with robot voice, vocoder, harmonizer, and transformer effects
- **Project Management**: Export/Import projects as JSON with unsaved changes tracking and undo/redo system / IndexedDB storage
- **Real-time Audio Processing**: Web Audio API integration with memory leak prevention and lifecycle management
- **Error Handling**: Comprehensive error boundaries and connection validation
- **Progressive Web App**: Installable with offline support and caching

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation & Development

```bash
# Clone and install
git clone https://github.com/miltonlaufer/visualwebaudio.git
cd visualwebaudio
npm install

# Start development server (includes automatic type extraction)
npm run dev

# Other useful commands
npm run build        # Build for production
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report
npm run test:coverage:ui # Run tests with coverage and UI
npm run type-check   # TypeScript type checking
npm run lint         # ESLint code quality
```

### Tech Stack

- **React 19** with TypeScript
- **Vite** for development and building
- **MobX State Tree** for type-safe state management
- **React Flow** for visual graph editing
- **Tailwind CSS** for styling
- **Vitest** for testing (60.4% coverage)


### CI/CD
GitHub Actions automatically runs type checking, tests, and linting on all PRs.

### Type-Driven Benefits
1. **Automatic API Updates**: Updating `@types/web` brings new Web Audio features automatically
2. **Type Safety**: Full TypeScript coverage ensures runtime reliability
3. **Reduced Maintenance**: No manual node definitions to maintain
4. **Future-Proof**: Adapts to API changes without code modifications

## Architecture

### Type-Driven Workflow

```
TypeScript Web Audio API Definitions (@types/web)
                    ↓
            extract-web-audio-types.js
                    ↓
         Generated Metadata (JSON)
                    ↓
            AudioNodeFactory
                    ↓
        Dynamic Node Creation & Management
                    ↓
         React Components (Visual Layer)
```

### Tech Stack

- **React 19** with TypeScript
- **Vite** for development and building
- **MobX State Tree** for type-safe state management
- **React Flow** for visual graph editing
- **Tailwind CSS** for styling
- **Vitest** for testing (60.4% coverage)

## Examples

The application includes 21+ working audio examples:

**Basic Audio Processing**: **Basic Oscillator**, **Microphone Input with Delay**, **Delay Effect**, **Filter Sweep**, **Stereo Panning**, **Compressor Effect**, **Tremolo Effect**, **Ring Modulation**, **Chord Synthesis**, **Waveshaper Distortion**, **Phaser Effect**, **Simple Noise**, **Amplitude Envelope**, **Beat Frequency**, **Convolution Reverb**, **Microphone Reverb**, **Stereo Effects**

**Voice Effects** (NEW): **Robot Voice (Ring Mod)**, **Vocoder Voice**, **Voice Harmonizer**, **Voice Pitch Shifter** - Transform your voice with real-time microphone processing

**Synthesizers**: **Vintage Analog Synth** - Classic analog synthesizer with oscillators, filters, and envelopes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all checks pass: `npm run type-check && npm run test && npm run lint`
5. Submit a pull request

## License

MIT License - see the LICENSE file for details.