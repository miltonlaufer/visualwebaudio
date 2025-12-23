import Dexie, { Table } from 'dexie'
import type { CompositeNodePort } from '~/types'

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

export interface SavedCompositeNode {
  id?: number
  definitionId: string
  name: string
  description: string
  inputs: CompositeNodePort[]
  outputs: CompositeNodePort[]
  internalGraph: string // JSON string of CompositeNodeInternalGraph
  createdAt: Date
  updatedAt: Date
}

export class ProjectDatabase extends Dexie {
  projects!: Table<SavedProject>
  recordings!: Table<AudioRecording>
  compositeNodes!: Table<SavedCompositeNode>

  constructor() {
    super('VisualWebAudioDB')
    this.version(2).stores({
      projects: '++id, name, createdAt, updatedAt',
      recordings: '++id, name, projectName, createdAt, duration, size',
    })
    this.version(3).stores({
      projects: '++id, name, createdAt, updatedAt',
      recordings: '++id, name, projectName, createdAt, duration, size',
      compositeNodes: '++id, definitionId, name, createdAt, updatedAt',
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

// Composite Node operations
export const compositeNodeOperations = {
  // Save a new composite node
  async saveCompositeNode(
    definitionId: string,
    name: string,
    description: string,
    inputs: CompositeNodePort[],
    outputs: CompositeNodePort[],
    internalGraph: string
  ): Promise<number> {
    const now = new Date()
    return await db.compositeNodes.add({
      definitionId,
      name,
      description,
      inputs,
      outputs,
      internalGraph,
      createdAt: now,
      updatedAt: now,
    })
  },

  // Update existing composite node
  async updateCompositeNode(
    id: number,
    name: string,
    description: string,
    inputs: CompositeNodePort[],
    outputs: CompositeNodePort[],
    internalGraph: string
  ): Promise<void> {
    await db.compositeNodes.update(id, {
      name,
      description,
      inputs,
      outputs,
      internalGraph,
      updatedAt: new Date(),
    })
  },

  // Get all composite nodes
  async getAllCompositeNodes(): Promise<SavedCompositeNode[]> {
    return await db.compositeNodes.orderBy('updatedAt').reverse().toArray()
  },

  // Get composite node by ID
  async getCompositeNode(id: number): Promise<SavedCompositeNode | undefined> {
    return await db.compositeNodes.get(id)
  },

  // Get composite node by definition ID
  async getCompositeNodeByDefinitionId(
    definitionId: string
  ): Promise<SavedCompositeNode | undefined> {
    return await db.compositeNodes.where('definitionId').equals(definitionId).first()
  },

  // Delete composite node
  async deleteCompositeNode(id: number): Promise<void> {
    await db.compositeNodes.delete(id)
  },

  // Check if composite node name exists
  async compositeNodeNameExists(name: string, excludeId?: number): Promise<boolean> {
    const nodes = await db.compositeNodes.where('name').equals(name).toArray()
    if (excludeId) {
      return nodes.some(n => n.id !== excludeId)
    }
    return nodes.length > 0
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
