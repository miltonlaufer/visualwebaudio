import Dexie, { Table } from 'dexie'

export interface SavedProject {
  id?: number
  name: string
  data: string // JSON string of the project data
  createdAt: Date
  updatedAt: Date
  description?: string
}

export interface AudioRecording {
  id?: number
  name: string
  projectName: string
  audioData: Blob
  duration: number // duration in seconds
  createdAt: Date
  size: number // file size in bytes
}

export class ProjectDatabase extends Dexie {
  projects!: Table<SavedProject>
  recordings!: Table<AudioRecording>

  constructor() {
    super('VisualWebAudioDB')
    this.version(2).stores({
      projects: '++id, name, createdAt, updatedAt',
      recordings: '++id, name, projectName, createdAt, duration, size',
    })
  }
}

export const db = new ProjectDatabase()

// Database operations
export const projectOperations = {
  // Save a new project
  async saveProject(name: string, data: string, description?: string): Promise<number> {
    const now = new Date()
    return await db.projects.add({
      name,
      data,
      description,
      createdAt: now,
      updatedAt: now,
    })
  },

  // Update existing project
  async updateProject(id: number, name: string, data: string, description?: string): Promise<void> {
    await db.projects.update(id, {
      name,
      data,
      description,
      updatedAt: new Date(),
    })
  },

  // Get all projects
  async getAllProjects(): Promise<SavedProject[]> {
    return await db.projects.orderBy('updatedAt').reverse().toArray()
  },

  // Get project by ID
  async getProject(id: number): Promise<SavedProject | undefined> {
    return await db.projects.get(id)
  },

  // Delete project
  async deleteProject(id: number): Promise<void> {
    await db.projects.delete(id)
  },

  // Check if project name exists
  async projectNameExists(name: string, excludeId?: number): Promise<boolean> {
    const projects = await db.projects.where('name').equals(name).toArray()
    if (excludeId) {
      return projects.some(p => p.id !== excludeId)
    }
    return projects.length > 0
  },
}

// Recording operations
export const recordingOperations = {
  // Save a new recording
  async saveRecording(
    name: string,
    projectName: string,
    audioData: Blob,
    duration: number
  ): Promise<number> {
    const now = new Date()
    return await db.recordings.add({
      name,
      projectName,
      audioData,
      duration,
      size: audioData.size,
      createdAt: now,
    })
  },

  // Get all recordings
  async getAllRecordings(): Promise<AudioRecording[]> {
    return await db.recordings.orderBy('createdAt').reverse().toArray()
  },

  // Get recording by ID
  async getRecording(id: number): Promise<AudioRecording | undefined> {
    return await db.recordings.get(id)
  },

  // Delete recording
  async deleteRecording(id: number): Promise<void> {
    await db.recordings.delete(id)
  },

  // Get recordings by project name
  async getRecordingsByProject(projectName: string): Promise<AudioRecording[]> {
    return await db.recordings.where('projectName').equals(projectName).toArray()
  },

  // Update recording name
  async updateRecordingName(id: number, newName: string): Promise<void> {
    await db.recordings.update(id, { name: newName })
  },
}
