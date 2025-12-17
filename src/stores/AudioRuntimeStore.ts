/**
 * Audio Runtime Store
 *
 * Manages the runtime audio state including AudioContext lifecycle.
 * This is a facade that provides a clean API for audio operations.
 *
 * Responsibilities:
 * - AudioContext creation and lifecycle
 * - Audio node instances (volatile, not serialized)
 * - Playback state
 *
 * Note: For backward compatibility, this store delegates to AudioGraphStore
 * which still contains the core implementation.
 */

import { types, Instance, getRoot } from 'mobx-state-tree'
import type { IRootStore } from './RootStore'

/******************* MODEL ***********************/

export const AudioRuntimeStore = types
  .model('AudioRuntimeStore', {
    // Runtime state is stored in AudioGraphStore for backward compatibility
  })
  .views(self => ({
    get root(): IRootStore {
      return getRoot(self) as IRootStore
    },

    get audioGraph() {
      return this.root.audioGraph
    },

    /******************* AUDIO CONTEXT VIEWS ***********************/

    get audioContext(): AudioContext | null {
      return this.audioGraph.audioContext
    },

    get isAudioContextRunning(): boolean {
      return this.audioGraph.audioContext?.state === 'running'
    },

    get isAudioContextSuspended(): boolean {
      return this.audioGraph.audioContext?.state === 'suspended'
    },

    get sampleRate(): number {
      return this.audioGraph.audioContext?.sampleRate ?? 44100
    },

    /******************* PLAYBACK VIEWS ***********************/

    get isPlaying(): boolean {
      return this.root.isPlaying
    },

    /******************* AUDIO NODE VIEWS ***********************/

    get audioNodeCount(): number {
      return this.audioGraph.audioNodes.size
    },

    hasAudioNode(nodeId: string): boolean {
      return this.audioGraph.audioNodes.has(nodeId)
    },

    getAudioNode(nodeId: string): AudioNode | undefined {
      return this.audioGraph.audioNodes.get(nodeId)
    },

    /******************* ANALYZER VIEWS ***********************/

    get globalAnalyzer(): AnalyserNode | null {
      return this.audioGraph.globalAnalyzer
    },
  }))
  .actions(self => ({
    /******************* PLAYBACK ACTIONS ***********************/

    async play(): Promise<void> {
      if (!self.root.isPlaying) {
        await self.audioGraph.togglePlayback()
      }
    },

    async stop(): Promise<void> {
      if (self.root.isPlaying) {
        await self.audioGraph.togglePlayback()
      }
    },

    async togglePlayback(): Promise<void> {
      await self.audioGraph.togglePlayback()
    },

    /******************* AUDIO CONTEXT ACTIONS ***********************/

    async resumeAudioContext(): Promise<void> {
      if (self.audioGraph.audioContext?.state === 'suspended') {
        await self.audioGraph.audioContext.resume()
      }
    },
  }))

export interface IAudioRuntimeStore extends Instance<typeof AudioRuntimeStore> {}
