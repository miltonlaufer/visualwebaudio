# Visual Web Audio - User Guide

Welcome to Visual Web Audio! This comprehensive guide will walk you through all the features and functionality of this powerful browser-based audio synthesis application.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Working with Nodes](#working-with-nodes)
4. [Making Connections](#making-connections)
5. [Audio Controls](#audio-controls)
6. [Recording Audio](#recording-audio)
7. [Project Management](#project-management)
8. [Quick Examples](#quick-examples)
9. [Custom Nodes](#custom-nodes)
10. [Export Functionality](#export-functionality)
11. [Keyboard Shortcuts](#keyboard-shortcuts)
12. [Tips and Best Practices](#tips-and-best-practices)
13. [Troubleshooting](#troubleshooting)

## Getting Started

Visual Web Audio is a web-based application that runs entirely in your browser. No installation is required!

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Audio output device (speakers or headphones)
- For MIDI features: MIDI-compatible device (optional)

### First Launch
1. Open the application in your web browser
2. Allow audio permissions when prompted
3. You'll see the main interface with an empty canvas
4. Start by adding your first audio node from the Node Palette

## Interface Overview

### Main Components

#### Header Bar
- **Logo & Title**: Visual Web Audio branding
- **Play/Stop Button**: Controls audio playback (green = play, red = stop)
- **Record Button**: Start/stop audio recording (only available during playback)
- **Quick Examples**: Dropdown with pre-built audio setups
- **Project Button**: Access project management features
- **Export JS**: Generate JavaScript code from your audio graph
- **Clear All**: Remove all nodes and connections
- **Undo/Redo**: Navigate through your editing history
- **Dark Mode Toggle**: Switch between light and dark themes
- **Help (?)**: Access this user guide
- **GitHub Ribbon**: Link to the open-source repository

#### Node Palette (Left Panel)
Organized categories of audio nodes:
- **Sources**: Audio generators (Oscillator, Audio Buffer, etc.)
- **Effects**: Audio processors (Gain, Filter, Delay, etc.)
- **Analysis**: Audio analysis tools (Analyser, etc.)
- **Custom**: Special nodes (Button, Slider, Timer, etc.)
- **Destination**: Audio output (Destination Node)

#### Canvas (Center)
The main workspace where you:
- Add and arrange audio nodes
- Create connections between nodes
- Visualize your audio graph

#### Property Panel (Right Panel)
- View and edit properties of selected nodes
- Real-time parameter adjustment
- Node metadata and documentation

### Mobile Interface
On mobile devices:
- Hamburger menus provide access to Node Palette and controls
- Touch-friendly interaction
- Responsive design adapts to screen size

## Working with Nodes

### Adding Nodes
1. **From Node Palette**: Click any node type to add it to the canvas
2. **Drag & Drop**: Drag nodes from palette to specific canvas locations
3. **Quick Examples**: Use pre-built setups as starting points

### Node Types

#### Audio Sources
- **Oscillator**: Generates waveforms (sine, square, sawtooth, triangle)
- **Audio Buffer**: Plays audio files
- **Media Element Audio Source**: Uses HTML audio/video elements
- **Media Stream Audio Source**: Captures microphone input

#### Audio Effects
- **Gain**: Controls volume/amplitude
- **Biquad Filter**: Frequency filtering (lowpass, highpass, bandpass, etc.)
- **Delay**: Echo and delay effects
- **Convolver**: Reverb and impulse response processing
- **Dynamics Compressor**: Audio compression
- **Wave Shaper**: Distortion and waveshaping

#### Analysis Nodes
- **Analyser**: Frequency and waveform analysis
- **Audio Worklet**: Custom audio processing

#### Custom Nodes
- **Button**: Trigger events and control other nodes
- **Slider**: Real-time parameter control
- **Timer**: Scheduled events and automation
- **Display**: Visual feedback and monitoring
- **Sound File**: Audio file playback with trigger control
- **MIDI Input**: MIDI device integration

### Node Properties
Each node has configurable properties:
- **Frequency**: Oscillator pitch, filter cutoff
- **Gain**: Volume levels
- **Type**: Waveform shapes, filter types
- **Timing**: Delay times, attack/release
- **Q Factor**: Filter resonance

### Selecting and Editing Nodes
1. **Click** a node to select it
2. **Properties Panel** shows editable parameters
3. **Real-time Changes**: Modifications apply immediately during playback
4. **Delete**: Select node and press Delete key

## Making Connections

### Audio Connections
Connect audio outputs to audio inputs:
1. **Click and Drag** from an output port to an input port
2. **Visual Feedback**: Connection lines show audio flow
3. **Multiple Connections**: One output can connect to multiple inputs

### Control Connections
Connect control signals (from custom nodes):
1. **Trigger Connections**: Button → Oscillator (start/stop)
2. **Parameter Control**: Slider → Gain (volume control)
3. **Automation**: Timer → Multiple parameters

### Connection Rules
- Audio outputs (circles) connect to audio inputs (circles)
- Control outputs (squares) connect to control inputs (squares)
- One output can connect to multiple inputs
- Inputs can only receive one connection at a time

### Managing Connections
- **Delete Connection**: Click the connection line and press Delete
- **Reconnect**: Drag from output to new input
- **Visual Indicators**: Different colors for audio vs. control signals

## Audio Controls

### Playback Control
- **Play Button**: Start audio processing and playback
- **Stop Button**: Stop all audio processing
- **Global Control**: Affects entire audio graph simultaneously

### Volume and Monitoring
- **Master Volume**: Control overall output level
- **Node-level Gain**: Individual volume controls per audio path
- **Visual Feedback**: Analyser nodes show audio levels and spectrums

### Audio Context
- **Sample Rate**: Typically 44.1kHz (browser dependent)
- **Buffer Size**: Optimized for low latency
- **Audio Destination**: Routes to your system's audio output

## Recording Audio

### Starting a Recording
1. **Start Playback**: Click the Play button
2. **Click Record**: Record button becomes available during playback
3. **Recording Indicator**: Button turns red when recording

### Recording Process
- **Format**: WAV (16-bit PCM stereo)
- **Quality**: Full audio quality, no compression
- **Real-time**: Records exactly what you hear
- **Duration**: No time limits (limited by available memory)

### Stopping Recording
- **Manual Stop**: Click the Record button again
- **Auto-stop**: Recording stops when playback stops
- **Pause Behavior**: Pausing playback automatically stops and saves recording

### Managing Recordings
Access via Project → Recordings tab:
- **View All**: List of all saved recordings
- **Download**: Save recordings to your computer
- **Rename**: Edit recording names (preserves creation date)
- **Delete**: Remove unwanted recordings
- **Storage**: Recordings saved locally in your browser

## Project Management

### Saving Projects
1. **Click Project Button** in header
2. **Projects Tab**: Enter project name
3. **Save**: Stores complete audio graph configuration
4. **Local Storage**: Projects saved in your browser

### Loading Projects
1. **Project → Projects Tab**
2. **Select Project**: Click on any saved project
3. **Load**: Replaces current graph with saved configuration
4. **Confirmation**: Warns if current work will be lost

### Project Features
- **Auto-save**: Projects include all nodes, connections, and properties
- **Naming**: Descriptive names help organize your work
- **Export**: Projects can be exported as JavaScript code
- **Import**: Load projects from exported code

### Storage Management
- **Local Storage**: All data stored in your browser
- **Privacy**: No data sent to external servers
- **Backup**: Export important projects as code
- **Cleanup**: Delete unused projects to free space

## Quick Examples

### Available Examples
- **Basic Oscillator**: Simple tone generator
- **Filter Sweep**: Oscillator with animated filter
- **Echo Effect**: Delay-based echo system
- **Sound File Player**: Audio file playback with controls
- **MIDI Controller**: MIDI input demonstration
- **Complex Synthesis**: Multi-oscillator setup

### Using Examples
1. **Examples Dropdown**: Click in header
2. **Select Example**: Choose from available options
3. **Auto-load**: Example replaces current graph
4. **Modification**: Use as starting point for your own creations

### Learning from Examples
- **Study Connections**: See how nodes are linked
- **Parameter Settings**: Observe property configurations
- **Best Practices**: Learn efficient graph structures
- **Experimentation**: Modify examples to understand behavior

## Custom Nodes

### Button Node
- **Purpose**: Trigger events and control other nodes
- **Connections**: Trigger output connects to control inputs
- **Behavior**: Click to send trigger signal
- **Use Cases**: Start/stop oscillators, trigger samples

### Slider Node
- **Purpose**: Real-time parameter control
- **Range**: Configurable min/max values
- **Output**: Continuous control signal
- **Use Cases**: Volume control, filter sweeps, modulation

### Timer Node
- **Purpose**: Scheduled events and automation
- **Interval**: Configurable timing (milliseconds)
- **Output**: Periodic trigger signals
- **Use Cases**: Rhythmic patterns, automated parameter changes

### Display Node
- **Purpose**: Visual monitoring and feedback
- **Input**: Accepts audio or control signals
- **Display**: Real-time value visualization
- **Use Cases**: Level monitoring, parameter feedback

### Sound File Node
- **Purpose**: Audio file playback with control
- **File Support**: Common audio formats (MP3, WAV, OGG)
- **Trigger Input**: Start/stop playback control
- **Use Cases**: Samples, backing tracks, sound effects

### MIDI Input Node
- **Purpose**: MIDI device integration
- **Requirements**: MIDI-compatible device
- **Permissions**: Browser MIDI access required
- **Outputs**: Note, velocity, and control data
- **Use Cases**: Keyboard control, MIDI controllers

## Export Functionality

### JavaScript Export
1. **Export JS Button**: Click in header
2. **Generated Code**: Complete JavaScript implementation
3. **Standalone**: Code runs independently of the app
4. **Web Audio API**: Uses standard browser audio APIs

### Export Features
- **Complete Graph**: All nodes and connections included
- **Property Values**: Current parameter settings preserved
- **Runnable Code**: Ready to use in web applications
- **Documentation**: Comments explain code structure

### Using Exported Code
- **Web Development**: Integrate into websites
- **Learning**: Study Web Audio API implementation
- **Backup**: Alternative project storage method
- **Sharing**: Send audio graphs to others

## Keyboard Shortcuts

### General
- **Ctrl/Cmd + Z**: Undo last action
- **Ctrl/Cmd + Y**: Redo last action
- **Delete**: Remove selected node or connection
- **Escape**: Deselect all items

### Playback
- **Spacebar**: Toggle play/stop (when canvas focused)
- **R**: Toggle recording (during playback)

### Navigation
- **Tab**: Cycle through focusable elements
- **Arrow Keys**: Fine-tune node positions (when selected)

### Custom Node Shortcuts
- **Enter**: Activate button nodes, confirm slider values
- **Escape**: Cancel editing, deselect nodes

## Tips and Best Practices

### Audio Graph Design
- **Start Simple**: Begin with basic oscillator → gain → destination
- **Add Gradually**: Build complexity step by step
- **Use Gain Nodes**: Control volume at multiple points
- **Monitor Levels**: Use analyser nodes to visualize audio

### Performance Optimization
- **Minimize Nodes**: Use only what you need
- **Efficient Routing**: Avoid unnecessary connections
- **Gain Control**: Prevent audio clipping and distortion
- **Browser Resources**: Complex graphs may impact performance

### Creative Techniques
- **Modulation**: Use LFOs to animate parameters
- **Layering**: Combine multiple oscillators
- **Effects Chains**: Series of connected processors
- **Feedback Loops**: Creative (but careful) signal routing

### Project Organization
- **Descriptive Names**: Clear project and recording names
- **Regular Saves**: Save work frequently
- **Export Backups**: Keep code exports of important projects
- **Documentation**: Use display nodes to label sections

## Troubleshooting

### Audio Issues
**No Sound Output**:
- Check browser audio permissions
- Verify system volume and audio device
- Ensure audio graph connects to destination node
- Check for muted gain nodes

**Distorted Audio**:
- Reduce gain levels throughout signal chain
- Check for clipping at analyser nodes
- Avoid excessive feedback
- Monitor overall output levels

**Latency Issues**:
- Close other audio applications
- Reduce browser tab count
- Simplify complex audio graphs
- Check system audio buffer settings

### Interface Issues
**Nodes Not Appearing**:
- Check browser zoom level
- Verify canvas area is visible
- Try refreshing the page
- Clear browser cache if needed

**Connection Problems**:
- Ensure compatible port types (audio to audio, control to control)
- Check for existing connections on input ports
- Verify nodes are properly loaded
- Try recreating problematic connections

**Property Panel Empty**:
- Click directly on a node to select it
- Ensure node is fully loaded
- Try selecting a different node first
- Refresh page if issue persists

### Browser Compatibility
**Web Audio Support**:
- Use modern browser versions
- Chrome and Firefox recommended
- Safari and Edge also supported
- Avoid Internet Explorer

**MIDI Issues**:
- Enable Web MIDI in browser settings
- Connect MIDI device before opening app
- Grant MIDI permissions when prompted
- Check device compatibility

### Performance Issues
**Slow Response**:
- Reduce number of active nodes
- Close other browser tabs
- Restart browser if needed
- Check system resources

**Memory Issues**:
- Clear browser cache
- Delete unused projects and recordings
- Avoid extremely long recordings
- Restart application periodically

### Getting Help
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Refer to this guide and README
- **Community**: Connect with other users
- **Source Code**: Explore the open-source implementation

---

## Contributing

Visual Web Audio is open source! Contributions are welcome:
- **Bug Reports**: Help identify and fix issues
- **Feature Requests**: Suggest new functionality
- **Code Contributions**: Submit pull requests
- **Documentation**: Improve guides and examples

Visit the [GitHub repository](https://github.com/miltonlaufer/visualwebaudio) to get involved! 