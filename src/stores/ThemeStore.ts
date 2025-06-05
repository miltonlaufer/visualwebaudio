import { types, Instance } from 'mobx-state-tree'
import { createContext, useContext } from 'react'

export const ThemeStore = types
  .model('ThemeStore', {
    isDarkMode: types.optional(types.boolean, true),
  })
  .actions(self => ({
    toggleDarkMode() {
      self.isDarkMode = !self.isDarkMode
      this.updateDocumentClass()
      this.saveToLocalStorage()
    },
    setDarkMode(isDark: boolean) {
      self.isDarkMode = isDark
      this.updateDocumentClass()
      this.saveToLocalStorage()
    },
    updateDocumentClass() {
      if (typeof document !== 'undefined') {
        if (self.isDarkMode) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    },
    saveToLocalStorage() {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('visualwebaudio-theme', self.isDarkMode ? 'dark' : 'light')
      }
    },
    loadFromLocalStorage() {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('visualwebaudio-theme')
        if (saved) {
          self.isDarkMode = saved === 'dark'
        } else {
          // Default to dark mode if no saved preference and no system preference
          if (typeof window !== 'undefined' && window.matchMedia) {
            // Check system preference, but default to dark if no preference
            self.isDarkMode =
              window.matchMedia('(prefers-color-scheme: dark)').matches ||
              !window.matchMedia('(prefers-color-scheme: light)').matches
          } else {
            // Fallback to dark mode if window/matchMedia not available
            self.isDarkMode = true
          }
        }
        this.updateDocumentClass()
      }
    },
  }))

export type ThemeStoreType = Instance<typeof ThemeStore>

export const createThemeStore = (): ThemeStoreType => {
  const store = ThemeStore.create()
  store.loadFromLocalStorage()
  return store
}

// React Context for the theme store
export const ThemeStoreContext = createContext<ThemeStoreType | null>(null)

export const useThemeStore = () => {
  const store = useContext(ThemeStoreContext)
  if (!store) {
    throw new Error('useThemeStore must be used within a ThemeStoreProvider')
  }
  return store
}
