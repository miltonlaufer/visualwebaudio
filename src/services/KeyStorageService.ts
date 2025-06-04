import CryptoJS from 'crypto-js'
import Dexie, { Table } from 'dexie'

export interface EncryptedKey {
  id?: number
  keyName: string
  encryptedData: string
  salt: string
  createdAt: Date
  updatedAt: Date
}

export class KeyDatabase extends Dexie {
  keys!: Table<EncryptedKey>

  constructor() {
    super('VisualWebAudioKeysDB')
    this.version(1).stores({
      keys: '++id, keyName, createdAt, updatedAt',
    })
  }
}

export const keyDb = new KeyDatabase()

export type StorageType = 'session' | 'encrypted'

export interface KeyStorageOptions {
  storageType: StorageType
  password?: string // Required for encrypted storage
}

export class KeyStorageService {
  private static readonly SESSION_PREFIX = 'vwa_key_'
  private static readonly SALT_LENGTH = 32

  /**
   * Store an API key
   */
  static async storeKey(
    keyName: string,
    apiKey: string,
    options: KeyStorageOptions
  ): Promise<void> {
    if (options.storageType === 'session') {
      // Store in session storage (unencrypted)
      sessionStorage.setItem(this.SESSION_PREFIX + keyName, apiKey)
    } else if (options.storageType === 'encrypted') {
      if (!options.password) {
        throw new Error('Password is required for encrypted storage')
      }

      // Generate a random salt
      const salt = CryptoJS.lib.WordArray.random(this.SALT_LENGTH).toString()

      // Derive key from password and salt
      const derivedKey = CryptoJS.PBKDF2(options.password, salt, {
        keySize: 256 / 32,
        iterations: 10000,
      })

      // Encrypt the API key
      const encrypted = CryptoJS.AES.encrypt(apiKey, derivedKey.toString()).toString()

      // Store in IndexedDB
      const now = new Date()
      const existingKey = await keyDb.keys.where('keyName').equals(keyName).first()

      if (existingKey) {
        await keyDb.keys.update(existingKey.id!, {
          encryptedData: encrypted,
          salt,
          updatedAt: now,
        })
      } else {
        await keyDb.keys.add({
          keyName,
          encryptedData: encrypted,
          salt,
          createdAt: now,
          updatedAt: now,
        })
      }
    }
  }

  /**
   * Retrieve an API key
   */
  static async retrieveKey(keyName: string, options: KeyStorageOptions): Promise<string | null> {
    if (options.storageType === 'session') {
      return sessionStorage.getItem(this.SESSION_PREFIX + keyName)
    } else if (options.storageType === 'encrypted') {
      if (!options.password) {
        throw new Error('Password is required for encrypted storage')
      }

      const storedKey = await keyDb.keys.where('keyName').equals(keyName).first()
      if (!storedKey) {
        return null
      }

      try {
        // Derive key from password and stored salt
        const derivedKey = CryptoJS.PBKDF2(options.password, storedKey.salt, {
          keySize: 256 / 32,
          iterations: 10000,
        })

        // Decrypt the API key
        const decryptedBytes = CryptoJS.AES.decrypt(storedKey.encryptedData, derivedKey.toString())
        const decryptedKey = decryptedBytes.toString(CryptoJS.enc.Utf8)

        if (!decryptedKey) {
          throw new Error('Invalid password')
        }

        return decryptedKey
      } catch {
        throw new Error('Failed to decrypt key. Invalid password?')
      }
    }

    return null
  }

  /**
   * Check if a key exists
   */
  static async hasKey(keyName: string, storageType: StorageType): Promise<boolean> {
    if (storageType === 'session') {
      return sessionStorage.getItem(this.SESSION_PREFIX + keyName) !== null
    } else if (storageType === 'encrypted') {
      const storedKey = await keyDb.keys.where('keyName').equals(keyName).first()
      return !!storedKey
    }
    return false
  }

  /**
   * Remove a key
   */
  static async removeKey(keyName: string, storageType: StorageType): Promise<void> {
    if (storageType === 'session') {
      sessionStorage.removeItem(this.SESSION_PREFIX + keyName)
    } else if (storageType === 'encrypted') {
      const storedKey = await keyDb.keys.where('keyName').equals(keyName).first()
      if (storedKey?.id) {
        await keyDb.keys.delete(storedKey.id)
      }
    }
  }

  /**
   * List all stored key names
   */
  static async listKeys(): Promise<{ session: string[]; encrypted: string[] }> {
    const sessionKeys: string[] = []
    const encryptedKeys: string[] = []

    // Get session keys
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(this.SESSION_PREFIX)) {
        sessionKeys.push(key.substring(this.SESSION_PREFIX.length))
      }
    }

    // Get encrypted keys
    const storedKeys = await keyDb.keys.toArray()
    encryptedKeys.push(...storedKeys.map(k => k.keyName))

    return { session: sessionKeys, encrypted: encryptedKeys }
  }

  /**
   * Clear all keys
   */
  static async clearAllKeys(): Promise<void> {
    // Clear session keys
    const keysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(this.SESSION_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key))

    // Clear encrypted keys
    await keyDb.keys.clear()
  }
}
