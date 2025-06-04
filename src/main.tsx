import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from '~/components/ErrorBoundary'
import { scan } from 'react-scan'

if (!import.meta.env.PROD) {
  scan({
    enabled: true,
  })
}

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
      })

      console.log('SW: Service worker registered successfully', registration)

      // Check for updates immediately
      await registration.update()

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        console.log('SW: Update found, new service worker installing')
        const newWorker = registration.installing

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('SW: New service worker state:', newWorker.state)
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('SW: New service worker installed, dispatching update event')
              // Dispatch custom event for the UpdateNotification component
              window.dispatchEvent(
                new CustomEvent('vite:pwa-update', {
                  detail: {
                    type: 'UPDATE_AVAILABLE',
                    updateSW: async () => {
                      if (registration.waiting) {
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
                        navigator.serviceWorker.addEventListener('controllerchange', () => {
                          window.location.reload()
                        })
                      } else {
                        window.location.reload()
                      }
                    },
                  },
                })
              )
            }
          })
        }
      })

      // Check if there's already a waiting service worker
      if (registration.waiting) {
        console.log('SW: Service worker is waiting, dispatching update event')
        window.dispatchEvent(
          new CustomEvent('vite:pwa-update', {
            detail: {
              type: 'UPDATE_AVAILABLE',
              updateSW: async () => {
                if (registration.waiting) {
                  registration.waiting.postMessage({ type: 'SKIP_WAITING' })
                  navigator.serviceWorker.addEventListener('controllerchange', () => {
                    window.location.reload()
                  })
                }
              },
            },
          })
        )
      }
    } catch (error) {
      console.error('SW: Service worker registration failed:', error)
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
