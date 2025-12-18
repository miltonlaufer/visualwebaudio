/**
 * Chat Persistence Service
 *
 * Handles saving and loading chat conversations to IndexedDB.
 */

import type { SerializedConversation } from '~/stores/ChatStore'

const DB_NAME = 'visualwebaudio-chat'
const DB_VERSION = 1
const STORE_NAME = 'conversations'

export class ChatPersistenceService {
  private db: IDBDatabase | null = null

  /******************* INITIALIZATION ***********************/

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create conversations store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
    })
  }

  /******************* CRUD OPERATIONS ***********************/

  async saveConversation(conversation: SerializedConversation): Promise<void> {
    if (!this.db) {
      console.warn('ChatPersistenceService: DB not initialized')
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(conversation)

      request.onerror = () => {
        console.error('Failed to save conversation:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve()
      }
    })
  }

  async getConversation(id: string): Promise<SerializedConversation | null> {
    if (!this.db) {
      console.warn('ChatPersistenceService: DB not initialized')
      return null
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onerror = () => {
        console.error('Failed to get conversation:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve(request.result || null)
      }
    })
  }

  async getAllConversations(): Promise<SerializedConversation[]> {
    if (!this.db) {
      console.warn('ChatPersistenceService: DB not initialized')
      return []
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onerror = () => {
        console.error('Failed to get all conversations:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        // Sort by updatedAt descending
        const conversations = request.result || []
        conversations.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        resolve(conversations)
      }
    })
  }

  async deleteConversation(id: string): Promise<void> {
    if (!this.db) {
      console.warn('ChatPersistenceService: DB not initialized')
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onerror = () => {
        console.error('Failed to delete conversation:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve()
      }
    })
  }

  async clearAllConversations(): Promise<void> {
    if (!this.db) {
      console.warn('ChatPersistenceService: DB not initialized')
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onerror = () => {
        console.error('Failed to clear conversations:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve()
      }
    })
  }

  /******************* UTILITIES ***********************/

  async getConversationCount(): Promise<number> {
    if (!this.db) return 0

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.count()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  isInitialized(): boolean {
    return this.db !== null
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
