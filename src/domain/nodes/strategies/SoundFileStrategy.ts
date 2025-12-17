/**
 * Sound File Node Strategy
 *
 * Handles audio file loading and playback triggered by input signals.
 * Manages AudioBuffer and GainNode for audio output.
 */

import {
  BaseNodeStrategy,
  type INodeStrategyContext,
  type IInputProcessingResult,
} from './INodeStrategy'

// Store audio state outside the strategy instance (volatile state)
const audioState = new Map<
  string,
  {
    audioContext?: AudioContext
    gainNode?: GainNode
    audioBuffer?: AudioBuffer
    bufferSource?: AudioBufferSourceNode
  }
>()

export class SoundFileStrategy extends BaseNodeStrategy {
  readonly nodeType = 'SoundFileNode'

  initialize(context: INodeStrategyContext): void {
    // Initialize audio state container
    audioState.set(context.state.id, {})

    // Check if we have stored audio data to restore
    if (context.audioContext) {
      this.setupAudioNodes(context)
      this.restoreAudioBuffer(context)
    }
  }

  handleInput(
    context: INodeStrategyContext,
    inputName: string,
    value: unknown
  ): IInputProcessingResult | void {
    if (inputName === 'trigger' && Number(value) > 0) {
      this.performTrigger(context)
    }
    return undefined
  }

  onAudioContextChange(context: INodeStrategyContext, audioContext: AudioContext): void {
    const state = audioState.get(context.state.id)
    if (state) {
      state.audioContext = audioContext
      this.setupAudioNodes(context)
      this.restoreAudioBuffer(context)
    }
  }

  cleanup(context: INodeStrategyContext): void {
    const state = audioState.get(context.state.id)
    if (state) {
      if (state.bufferSource) {
        try {
          state.bufferSource.stop()
          state.bufferSource.disconnect()
        } catch {
          // Ignore errors during cleanup
        }
      }
      if (state.gainNode) {
        state.gainNode.disconnect()
      }
      audioState.delete(context.state.id)
    }
  }

  trigger(context: INodeStrategyContext): IInputProcessingResult | void {
    this.performTrigger(context)
    return undefined
  }

  private setupAudioNodes(context: INodeStrategyContext): void {
    const state = audioState.get(context.state.id)
    if (!state?.audioContext) return

    state.gainNode = state.audioContext.createGain()
    state.gainNode.gain.value = context.state.properties.get('gain') || 1
  }

  private async restoreAudioBuffer(context: INodeStrategyContext): Promise<void> {
    const state = audioState.get(context.state.id)
    if (!state?.audioContext) return

    const audioBufferData = context.state.properties.get('audioData')
    const fileName = context.state.properties.get('fileName')

    if (audioBufferData && fileName) {
      try {
        if (typeof audioBufferData !== 'string') {
          throw new Error('Invalid audioBufferData format - expected base64 string')
        }

        const arrayBuffer = this.base64ToArrayBuffer(audioBufferData)
        state.audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer)
        context.state.setOutput('loaded', 1)
      } catch (error) {
        console.error('SoundFileStrategy: Error restoring audio buffer:', error)
        context.state.setOutput('loaded', 0)
      }
    } else {
      context.state.setOutput('loaded', 0)
    }
  }

  private performTrigger(context: INodeStrategyContext): void {
    const state = audioState.get(context.state.id)

    if (!state?.audioContext || !state.audioBuffer || !state.gainNode) {
      console.warn(
        'SoundFileStrategy: Cannot trigger - missing audio context, buffer, or gain node'
      )
      return
    }

    // Check audio context state
    if (state.audioContext.state === 'closed') {
      console.warn('SoundFileStrategy: Audio context is closed')
      return
    }

    if (state.audioContext.state === 'suspended') {
      state.audioContext.resume().then(() => this.playBuffer(context))
      return
    }

    this.playBuffer(context)
  }

  private playBuffer(context: INodeStrategyContext): void {
    const state = audioState.get(context.state.id)
    if (!state?.audioContext || !state.audioBuffer || !state.gainNode) return

    // Stop previous playback
    if (state.bufferSource) {
      try {
        state.bufferSource.stop()
        state.bufferSource.disconnect()
      } catch {
        // Ignore
      }
    }

    // Create new buffer source
    state.bufferSource = state.audioContext.createBufferSource()
    state.bufferSource.buffer = state.audioBuffer
    state.bufferSource.loop = context.state.properties.get('loop') || false
    state.bufferSource.playbackRate.value = context.state.properties.get('playbackRate') || 1

    // Update gain
    state.gainNode.gain.value = context.state.properties.get('gain') || 1

    // Connect and play
    state.bufferSource.connect(state.gainNode)
    state.bufferSource.start()
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Get the audio output node for connecting to other audio nodes.
   * This is called by the audio graph when making connections.
   */
  getAudioOutput(nodeId: string): GainNode | null {
    return audioState.get(nodeId)?.gainNode || null
  }
}
