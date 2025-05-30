export interface SampleAudio {
  name: string
  fileName: string
  description: string
  category: 'drums' | 'synth' | 'voice' | 'fx' | 'loop'
}

export const sampleAudioList: SampleAudio[] = [
  {
    name: 'Kick Drum',
    fileName: 'kick.wav',
    description: 'Basic kick drum sample',
    category: 'drums',
  },
  {
    name: 'Snare Drum',
    fileName: 'snare.wav',
    description: 'Crisp snare drum hit',
    category: 'drums',
  },
  {
    name: 'Hi-Hat',
    fileName: 'hihat.wav',
    description: 'Closed hi-hat sample',
    category: 'drums',
  },
  {
    name: 'Bass Loop',
    fileName: 'bass-loop.wav',
    description: 'Short bass guitar loop',
    category: 'loop',
  },
  {
    name: 'Synth Lead',
    fileName: 'synth-lead.wav',
    description: 'Electronic synth lead sound',
    category: 'synth',
  },
]

/**
 * Load a sample audio file from the public/samples directory
 */
export async function loadSampleAudio(fileName: string): Promise<File> {
  try {
    const response = await fetch(`./samples/${fileName}`)
    if (!response.ok) {
      throw new Error(`Failed to load sample: ${response.statusText}`)
    }

    const blob = await response.blob()

    // Create a File object from the blob
    const file = new File([blob], fileName, {
      type: blob.type || 'audio/wav',
    })

    return file
  } catch (error) {
    console.error(`Error loading sample audio ${fileName}:`, error)
    throw error
  }
}
