import Dexie, { Table } from 'dexie'

export interface SavedProject {
  id?: number
  name: string
  data: string // JSON string of the project data
  createdAt: Date
  updatedAt: Date
  description?: string
}

export class ProjectDatabase extends Dexie {
  projects!: Table<SavedProject>

  constructor() {
    super('VisualWebAudioDB')
    this.version(1).stores({
      projects: '++id, name, createdAt, updatedAt',
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
