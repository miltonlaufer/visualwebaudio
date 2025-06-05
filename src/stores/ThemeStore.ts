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
          // Use saved preference
          self.isDarkMode = saved === 'dark'
        } else {
          // No saved preference - default to dark mode
          // Only check system preference if user explicitly wants to respect it
          if (typeof window !== 'undefined' && window.matchMedia) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches

            // If user has an explicit system preference, respect it
            // Otherwise, default to dark mode
            if (prefersLight && !prefersDark) {
              self.isDarkMode = false
            } else {
              // Default to dark mode (covers prefersDark=true, no preference, or both false)
              self.isDarkMode = true
            }
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
